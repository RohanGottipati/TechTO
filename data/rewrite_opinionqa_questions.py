"""LLM rewrite OpinionQA stems into standalone natural-language questions.

Prefer KEEP when the stem is already self-contained. Rewrite when the stem
is incomplete / only makes sense with lettered options. Student never sees
A/B/C/D; rewriter may peek at option text only to finish the sentence.

Reads W92 info.csv (same filter as ingest). Cache:
  model/grpo/dataset/question_rewrites.json

Seed 2262.
"""

from __future__ import annotations

import ast
import json
import os
import random
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import pandas as pd
from openai import OpenAI

SEED = 2262
WAVE = "American_Trends_Panel_W92"
OPINIONQA_DIR = Path("data/raw/opinionqa/human_resp")
CACHE = Path("model/grpo/dataset/question_rewrites.json")
MODEL = os.environ.get("REWRITE_MODEL", "qwen/qwen-2.5-7b-instruct")
MAX_WORKERS = int(os.environ.get("REWRITE_WORKERS", "8"))
REFUSAL = {"Refused", "Don't Know", "Dont know", "DK/Refused", "No answer"}

SYS = """You prepare survey questions for a free-text opinion study.

Given a question STEM and the RESPONSE OPTIONS from the original MCQ, decide:
- KEEP: stem is already a complete, self-contained question someone can answer in their own words with no lettered choices and no missing clause.
- REWRITE: stem is incomplete, truncated, mid-sentence, vague without options, or options carry the real alternatives.

KEEP only if the stem alone is enough. If it ends mid-thought (e.g. "the houses are", "I usually feel like", "the U.S. has", "the government"), you MUST REWRITE.

Rules for REWRITE:
- ONE clear natural-language question that stands alone.
- Fold the substantive alternatives into the wording (not as A/B/C/D, not "which of the following").
- Do NOT invent new topics; stay faithful to stem + options.
- Do NOT ask the respondent to pick a letter.
- Prefer KEEP when the stem is already a full self-contained question.

Reply with EXACTLY one line:
KEEP
or
REWRITE: <the rewritten question>
"""


def _looks_incomplete(text: str) -> bool:
    s = (text or "").strip()
    if len(s) < 25:
        return True
    low = s.lower()
    if "which of the following" in low:
        return True
    if s.startswith("I usually feel") or s.startswith("They may feel"):
        return True
    # with terminal punct, treat as complete unless clearly mid-clause
    if s.endswith(("?", "!", ".")):
        return False
    hang = (
        " is", " are", " the", " a", " an", " like", " that", " to", " of",
        " for", " and", " or", " but", " than", " with", " from", " in",
        " on", " as", " has", " have", " should", " government",
    )
    low_np = low.rstrip(".!?")
    if any(low_np.endswith(h) for h in hang):
        return True
    return True  # no terminal punct -> incomplete


def _client() -> OpenAI:
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ["OPENROUTER_API_KEY"],
        default_headers={
            "HTTP-Referer": "https://github.com/techto",
            "X-Title": "TechTO-q-rewrite",
        },
    )


def _usable_qs() -> dict[str, dict]:
    info = pd.read_csv(OPINIONQA_DIR / WAVE / "info.csv")
    out = {}
    for _, row in info.iterrows():
        mapping = ast.literal_eval(row["option_mapping"])
        real = [v for v in mapping.values() if v not in REFUSAL]
        if not (2 <= len(real) <= 4):
            continue
        letters = ["A", "B", "C", "D"]
        options = {letters[i]: real[i] for i in range(len(real))}
        out[row["key"]] = {"stem": row["question"], "options": options}
    return out


def _call(client: OpenAI, user: str, temprature: float = 0.2) -> str:
    delay = 1.0
    last = None
    for _ in range(6):
        try:
            resp = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": SYS},
                    {"role": "user", "content": user},
                ],
                temperature=temprature,
                max_tokens=220,
                extra_body={"provider": {"ignore": ["DeepInfra"]}},
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            last = e
            time.sleep(delay + random.Random(SEED).random() * 0.3)
            delay = min(delay * 2, 30)
    raise RuntimeError(f"openrouter call failed: {last}")


def _parse(raw: str, stem: str) -> tuple[bool, str]:
    first = raw.splitlines()[0].strip() if raw else ""
    if first.upper() == "KEEP" or (first.upper().startswith("KEEP") and "REWRITE" not in first.upper()):
        return True, stem
    if "REWRITE:" in raw.upper():
        # find REWRITE: anywhere
        idx = raw.upper().find("REWRITE:")
        rest = raw[idx + len("REWRITE:") :].strip()
        return False, " ".join(rest.split())
    if not _looks_incomplete(stem):
        return True, stem
    return False, " ".join(raw.split())


def _rewrite_one(client: OpenAI, qid: str, stem: str, options: dict) -> dict:
    opt_lines = "\n".join(f"  {k}: {v}" for k, v in sorted(options.items()))
    user = f"STEM:\n{stem}\n\nOPTIONS (for your eyes only; do not emit letters):\n{opt_lines}\n"
    raw = _call(client, user, 0.2)
    kept, rewritten = _parse(raw, stem)

    # hard second pass if still incomplete
    if _looks_incomplete(rewritten):
        force = (
            user
            + "\nYou MUST REWRITE. The stem alone is incomplete for free-text. "
            "Output only: REWRITE: <one standalone question>\n"
        )
        raw2 = _call(client, force, 0.4)
        kept2, rewritten2 = _parse(raw2, stem)
        if not _looks_incomplete(rewritten2):
            kept, rewritten, raw = False, rewritten2, raw2
        elif not kept2 and rewritten2:
            kept, rewritten, raw = False, rewritten2, raw2
        else:
            # last resort: stitch stem + option texts into an or-question
            alts = ", or ".join(options[k] for k in sorted(options))
            base = stem.strip().rstrip(":").rstrip()
            if base.endswith(("?", "!", ".")):
                rewritten = f"{base} Specifically: {alts}?"
            else:
                rewritten = f"{base} {alts}?"
            kept = False
            raw = raw + "\n|FALLBACK_STITCH"

    return {
        "question_id": qid,
        "original": stem,
        "rewritten": rewritten,
        "kept": kept and not _looks_incomplete(rewritten),
        "raw_model": raw,
        "model": MODEL,
    }


def main() -> None:
    assert "OPENROUTER_API_KEY" in os.environ
    uniq = _usable_qs()
    print(f"usable W92 questions: {len(uniq)}")

    cache = {}
    if CACHE.exists():
        cache = json.loads(CACHE.read_text())
        print(f"loaded cache {len(cache)}")

    # refresh anything missing or still looking incomplete
    todo = {}
    for k, v in uniq.items():
        if k not in cache or not str(cache[k].get("rewritten", "")).strip():
            todo[k] = v
        elif _looks_incomplete(cache[k]["rewritten"]):
            todo[k] = v
    print(f"to rewrite: {len(todo)}")

    client = _client()
    rng = random.Random(SEED)

    def job(item):
        qid, payload = item
        time.sleep(rng.random() * 0.05)  # tiny jitter
        return _rewrite_one(client, qid, payload["stem"], payload["options"])

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs = [ex.submit(job, it) for it in todo.items()]
        for fut in as_completed(futs):
            rec = fut.result()
            cache[rec["question_id"]] = rec
            flag = "KEEP" if rec["kept"] else "REWRITE"
            print(f"  [{flag}] {rec['question_id']}")
            print(f"    -> {rec['rewritten'][:140]}")

    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, indent=2, ensure_ascii=False))
    n_keep = sum(1 for v in cache.values() if v.get("kept"))
    n_rw = len(cache) - n_keep
    print(f"wrote {CACHE} keep={n_keep} rewrite={n_rw}")


if __name__ == "__main__":
    main()
