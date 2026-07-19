"""Held-out SFT checkpoint eval: generate vs gold, report lexical + stance metrics.

  # carve set once
  python -m eval.make_sft_holdout --n 200

  # score one deployed adapter
  python -m eval.sft_holdout_eval --model flash-1784401342-0d51be72 --tag final

  # compare two tags already scored
  python -m eval.sft_holdout_eval --summarize-only

Seed 2262. Uses FREESOLO_* endpoint by default.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from openai import OpenAI

from model.sft.prompt import build_user_content

SEED = 2262
HOLDOUT = Path("model/sft/dataset/holdout_synth.jsonl")
OUT_DIR = Path("eval/output/sft_holdout_synth")


def _tok(s: str) -> list[str]:
    return re.findall(r"[a-z0-9']+", (s or "").lower())


def _f1(pred: str, gold: str) -> float:
    p, g = _tok(pred), _tok(gold)
    if not p and not g:
        return 1.0
    if not p or not g:
        return 0.0
    pc, gc = Counter(p), Counter(g)
    overlap = sum((pc & gc).values())
    if overlap == 0:
        return 0.0
    prec = overlap / len(p)
    rec = overlap / len(g)
    return 2 * prec * rec / (prec + rec)


def _rouge_l(pred: str, gold: str) -> float:
    # LCS ratio over tokens
    p, g = _tok(pred), _tok(gold)
    if not p or not g:
        return 0.0
    n, m = len(p), len(g)
    dp = [0] * (m + 1)
    for i in range(1, n + 1):
        prev = 0
        for j in range(1, m + 1):
            tmp = dp[j]
            if p[i - 1] == g[j - 1]:
                dp[j] = prev + 1
            else:
                dp[j] = max(dp[j], dp[j - 1])
            prev = tmp
    lcs = dp[m]
    prec = lcs / n
    rec = lcs / m
    if prec + rec == 0:
        return 0.0
    return 2 * prec * rec / (prec + rec)


def _client() -> OpenAI:
    return OpenAI(
        base_url=os.environ.get(
            "FREESOLO_BASE_URL",
            "https://clado-ai--freesolo-lora-serving.modal.run/v1",
        ),
        api_key=os.environ["FREESOLO_API_KEY"],
    )


def _gen(client: OpenAI, model: str, prompt: str, temprature: float, max_tokens: int) -> str:
    delay = 1.0
    last = None
    for _ in range(5):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temprature,
                max_tokens=max_tokens,
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            last = e
            time.sleep(delay)
            delay = min(delay * 2, 20)
    raise RuntimeError(last)


def _judge_stance(client_or: OpenAI, question: str, gold: str, pred: str) -> str:
    """Return same|diff|unclear. Frozen OpenRouter judge."""
    sys = (
        "You compare two free-text opinions on the same question. "
        "Reply with ONLY one token: same, diff, or unclear. "
        "same = same overall stance/sentiment; diff = opposing or clearly different; "
        "unclear = too vague to tell."
    )
    user = f"QUESTION:\n{question}\n\nGOLD:\n{gold}\n\nPRED:\n{pred}\n"
    resp = client_or.chat.completions.create(
        model=os.environ.get("JUDGE_MODEL", "qwen/qwen-2.5-7b-instruct"),
        messages=[{"role": "system", "content": sys}, {"role": "user", "content": user}],
        temperature=0.0,
        max_tokens=8,
        extra_body={"provider": {"ignore": ["DeepInfra"]}},
    )
    raw = (resp.choices[0].message.content or "").strip().lower()
    for tok in ("same", "diff", "unclear"):
        if tok in raw.split() or raw == tok:
            return tok
    if "same" in raw:
        return "same"
    if "diff" in raw:
        return "diff"
    return "unclear"


def _load_holdout(path: Path) -> list[dict]:
    rows = []
    with path.open() as f:
        for line in f:
            rows.append(json.loads(line))
    return rows


def _summarize(recs: list[dict]) -> dict:
    def mean(xs):
        return sum(xs) / len(xs) if xs else 0.0

    by_src = defaultdict(list)
    for r in recs:
        by_src[r["source"]].append(r)
    out = {
        "n": len(recs),
        "token_f1": mean([r["token_f1"] for r in recs]),
        "rouge_l": mean([r["rouge_l"] for r in recs]),
        "len_ratio": mean([r["len_ratio"] for r in recs]),
        "pred_words": mean([r["pred_words"] for r in recs]),
        "gold_words": mean([r["gold_words"] for r in recs]),
    }
    if any("stance" in r for r in recs):
        c = Counter(r.get("stance") for r in recs)
        out["stance_same"] = c.get("same", 0) / len(recs)
        out["stance_diff"] = c.get("diff", 0) / len(recs)
        out["stance_unclear"] = c.get("unclear", 0) / len(recs)
        out["stance_counts"] = dict(c)
    out["by_source"] = {}
    for src, xs in by_src.items():
        out["by_source"][src] = {
            "n": len(xs),
            "token_f1": mean([r["token_f1"] for r in xs]),
            "rouge_l": mean([r["rouge_l"] for r in xs]),
            "stance_same": (
                sum(1 for r in xs if r.get("stance") == "same") / len(xs) if xs else 0
            ),
        }
    return out


def run_eval(
    model: str,
    tag: str,
    holdout: Path,
    temprature: float,
    max_tokens: int,
    workers: int,
    with_judge: bool,
) -> dict:
    rows = _load_holdout(holdout)
    client = _client()
    judge = None
    if with_judge:
        judge = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=os.environ["OPENROUTER_API_KEY"],
            default_headers={
                "HTTP-Referer": "https://github.com/torontwin",
                "X-Title": "ToronTwin-sft-holdout",
            },
        )

    recs = [None] * len(rows)

    def one(i_row):
        i, row = i_row
        prompt = build_user_content(row["input"])
        pred = _gen(client, model, prompt, temprature, max_tokens)
        gold = row.get("output") or ""
        pw, gw = len(_tok(pred)), len(_tok(gold))
        rec = {
            "i": i,
            "source": row["metadata"].get("source"),
            "policy": row["input"].get("policy_text"),
            "gold": gold,
            "pred": pred,
            "token_f1": _f1(pred, gold),
            "rouge_l": _rouge_l(pred, gold),
            "pred_words": pw,
            "gold_words": gw,
            "len_ratio": (pw / gw) if gw else 0.0,
        }
        if judge is not None:
            rec["stance"] = _judge_stance(
                judge, row["input"].get("policy_text") or "", gold, pred
            )
        return i, rec

    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(one, (i, r)) for i, r in enumerate(rows)]
        for fut in as_completed(futs):
            i, rec = fut.result()
            recs[i] = rec
            if (i + 1) % 20 == 0:
                print(f"  [{tag}] done {i+1}/{len(rows)}")

    summary = _summarize(recs)
    summary["tag"] = tag
    summary["model"] = model
    summary["temprature"] = temprature

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    preds_path = OUT_DIR / f"preds_{tag}.jsonl"
    with preds_path.open("w") as f:
        for r in recs:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    sum_path = OUT_DIR / f"summary_{tag}.json"
    sum_path.write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    return summary


def summarize_all() -> None:
    rows = []
    for p in sorted(OUT_DIR.glob("summary_*.json")):
        rows.append(json.loads(p.read_text()))
    if not rows:
        print("no summaries yet")
        return
    # pick primary metric: stance_same if present else rouge_l
    print("\n=== checkpoint compare ===")
    for s in rows:
        stance = s.get("stance_same")
        print(
            f"{s['tag']:20s}  rouge_l={s['rouge_l']:.3f}  f1={s['token_f1']:.3f}  "
            f"len_ratio={s['len_ratio']:.2f}  stance_same={stance if stance is not None else 'n/a'}"
        )
    # best
    key = "stance_same" if all("stance_same" in s for s in rows) else "rouge_l"
    best = max(rows, key=lambda s: s.get(key, 0))
    print(f"best by {key}: {best['tag']}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", type=str, default="")
    ap.add_argument("--tag", type=str, default="run")
    ap.add_argument("--holdout", type=Path, default=HOLDOUT)
    ap.add_argument("--temprature", type=float, default=0.7)
    ap.add_argument("--max-tokens", type=int, default=256)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--judge", action="store_true", help="OpenRouter stance judge")
    ap.add_argument("--summarize-only", action="store_true")
    args = ap.parse_args()

    if args.summarize_only:
        summarize_all()
        return
    assert args.model, "need --model"
    assert args.holdout.exists(), f"missing {args.holdout}; run make_sft_holdout"
    run_eval(
        args.model,
        args.tag,
        args.holdout,
        args.temprature,
        args.max_tokens,
        args.workers,
        args.judge,
    )
    summarize_all()


if __name__ == "__main__":
    main()
