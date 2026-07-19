"""Local GRPO learning autopsy: why isn't match_rate rising?

For each prompt, sample group_size rollouts (like Flash), judge them, report:
- within-group reward std / zero-std fraction (the GRPO signal)
- none vs wrong vs hit
- whether a hand-written gold-entailing opinion gets judged correctly

  PYTHONPATH=. python eval/diagnose_grpo_learning.py --n-prompts 16 --group-size 8

Uses currently deployed Freesolo model (set --model). Seed 2262.
"""

from __future__ import annotations

import argparse
import json
import os
import random
import statistics
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from openai import OpenAI

from model.grpo.judge import judge_choice
from model.grpo.prompt import build_judge_prompt, build_student_prompt

SEED = 2262
OUT = Path("eval/output/grpo_diagnose")


def load_env() -> None:
    for line in Path(".env").read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k in ("FREESOLO_API_KEY", "OPENROUTER_API_KEY", "FREESOLO_BASE_URL"):
            os.environ[k] = v


def fs() -> OpenAI:
    base = os.environ.get(
        "FREESOLO_BASE_URL",
        "https://clado-ai--freesolo-lora-serving.modal.run/v1",
    )
    if not base.rstrip("/").endswith("/v1"):
        base = base.rstrip("/") + "/v1"
    return OpenAI(base_url=base, api_key=os.environ["FREESOLO_API_KEY"])


def sample_prompts(n: int) -> list[dict]:
    rows = []
    with open("model/grpo/dataset/train.jsonl") as f:
        for line in f:
            rows.append(json.loads(line))
    rng = random.Random(SEED)
    by_q = {}
    for r in rows:
        by_q.setdefault(r["metadata"]["question_id"], []).append(r)
    qids = list(by_q)
    rng.shuffle(qids)
    return [rng.choice(by_q[q]) for q in qids[:n]]


def gen(client: OpenAI, model: str, prompt: str, temprature: float) -> str:
    delay = 1.0
    last = None
    for _ in range(5):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=temprature,
                max_tokens=256,
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            last = e
            time.sleep(delay)
            delay = min(delay * 2, 20)
    raise last


def judge(opinion: str, row: dict) -> str | None:
    return judge_choice(
        build_judge_prompt(
            opinion,
            row["input"]["policy_text"],
            row["metadata"]["options"],
        )
    )


def gold_probe_opinion(row: dict) -> str:
    # write a blunt opinion that should entail gold label text
    gold = row["metadata"]["gold_choice"]
    label = row["metadata"]["options"][gold]
    return f"In my view, {label.rstrip('.')}. That is where I stand."


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n-prompts", type=int, default=16)
    ap.add_argument("--group-size", type=int, default=8)
    ap.add_argument("--model", type=str, default="flash-1784401342-0d51be72")
    ap.add_argument("--temprature", type=float, default=1.0)
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()
    load_env()
    client = fs()
    rows = sample_prompts(args.n_prompts)
    print(
        f"model={args.model} n_prompts={len(rows)} G={args.group_size} T={args.temprature}",
        flush=True,
    )

    # --- 1) judge sanity: gold-entailing prose ---
    probe_ok = 0
    probe_none = 0
    probe_wrong = 0
    for row in rows:
        gold = row["metadata"]["gold_choice"]
        op = gold_probe_opinion(row)
        pred = judge(op, row)
        if pred is None or str(pred).lower() == "none":
            probe_none += 1
        elif pred.upper() == gold.upper():
            probe_ok += 1
        else:
            probe_wrong += 1
    print(
        f"\nJUDGE SANITY (blunt gold-entailing text): "
        f"ok={probe_ok}/{len(rows)} wrong={probe_wrong} none={probe_none}",
        flush=True,
    )

    # --- 2) group rollouts like GRPO ---
    groups = []

    def one_group(i_row):
        i, row = i_row
        prompt = build_student_prompt(row["input"])
        gold = row["metadata"]["gold_choice"]
        opinions = []
        choices = []
        rewards = []
        for _ in range(args.group_size):
            text = gen(client, args.model, prompt, args.temprature)
            ch = judge(text, row)
            hit = 1.0 if ch and ch.upper() == gold.upper() else 0.0
            opinions.append(text)
            choices.append(ch)
            rewards.append(hit)
        std = statistics.pstdev(rewards) if len(rewards) > 1 else 0.0
        return {
            "i": i,
            "qid": row["metadata"]["question_id"],
            "gold": gold,
            "options": row["metadata"]["options"],
            "question": row["input"]["policy_text"],
            "persona": row["input"]["persona_text"][:120],
            "choices": choices,
            "rewards": rewards,
            "mean_reward": sum(rewards) / len(rewards),
            "reward_std": std,
            "zero_std": std < 1e-9,
            "n_hit": int(sum(rewards)),
            "n_none": sum(1 for c in choices if c is None or str(c).lower() == "none"),
            "n_wrong": sum(
                1
                for c, r in zip(choices, rewards)
                if r == 0.0 and c is not None and str(c).lower() != "none"
            ),
            "opinions": opinions,
        }

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(one_group, (i, r)) for i, r in enumerate(rows)]
        for fut in as_completed(futs):
            g = fut.result()
            groups.append(g)
            print(
                f"  q[{g['i']}] gold={g['gold']} hits={g['n_hit']}/{args.group_size} "
                f"none={g['n_none']} wrong={g['n_wrong']} std={g['reward_std']:.3f} "
                f"zero_std={g['zero_std']}",
                flush=True,
            )

    groups.sort(key=lambda g: g["i"])
    n = len(groups)
    zero_frac = sum(1 for g in groups if g["zero_std"]) / n
    mean_r = statistics.mean(g["mean_reward"] for g in groups)
    mean_std = statistics.mean(g["reward_std"] for g in groups)
    total = n * args.group_size
    all_choices = [c for g in groups for c in g["choices"]]
    all_rewards = [r for g in groups for r in g["rewards"]]
    choice_hist = Counter(
        ("none" if c is None or str(c).lower() == "none" else str(c).upper())
        for c in all_choices
    )
    gold_hist = Counter(g["gold"] for g in groups)

    print("\n=== SUMMARY ===", flush=True)
    print(f"prompts={n} completions={total}", flush=True)
    print(f"mean_reward={mean_r:.3f}  mean_within_group_std={mean_std:.3f}", flush=True)
    print(f"frac_groups_zero_std={zero_frac:.3f}  (GRPO gets no signal on these)", flush=True)
    print(f"global_hit_rate={sum(all_rewards)/total:.3f}", flush=True)
    print(f"choice_hist={dict(choice_hist)}", flush=True)
    print(f"gold_hist_over_prompts={dict(gold_hist)}", flush=True)

    # confusion-ish: among non-none preds, how often match
    non_none = [
        (c, g["gold"])
        for g in groups
        for c in g["choices"]
        if c is not None and str(c).lower() != "none"
    ]
    if non_none:
        match_nn = sum(1 for c, gold in non_none if c.upper() == gold.upper()) / len(non_none)
        print(f"match_given_not_none={match_nn:.3f}  (n={len(non_none)})", flush=True)

    # show a few zero-std and high-std groups
    print("\n=== EXAMPLE zero-std group ===", flush=True)
    z = next((g for g in groups if g["zero_std"]), None)
    if z:
        print(f"qid={z['qid']} gold={z['gold']} {z['options'].get(z['gold'],'')[:80]}", flush=True)
        print(f"Q: {z['question'][:160]}", flush=True)
        for j, (op, ch, rw) in enumerate(zip(z["opinions"], z["choices"], z["rewards"])):
            print(f"  [{j}] judge={ch} r={rw} :: {op[:160].replace(chr(10),' ')}", flush=True)

    print("\n=== EXAMPLE high-std group (learning signal) ===", flush=True)
    h = max(groups, key=lambda g: g["reward_std"])
    print(
        f"qid={h['qid']} gold={h['gold']} std={h['reward_std']:.3f} hits={h['n_hit']}",
        flush=True,
    )
    print(f"Q: {h['question'][:160]}", flush=True)
    for j, (op, ch, rw) in enumerate(zip(h["opinions"], h["choices"], h["rewards"])):
        print(f"  [{j}] judge={ch} r={rw} :: {op[:160].replace(chr(10),' ')}", flush=True)

    OUT.mkdir(parents=True, exist_ok=True)
    payload = {
        "model": args.model,
        "n_prompts": n,
        "group_size": args.group_size,
        "temprature": args.temprature,
        "judge_sanity_ok": probe_ok,
        "judge_sanity_wrong": probe_wrong,
        "judge_sanity_none": probe_none,
        "mean_reward": mean_r,
        "mean_within_group_std": mean_std,
        "frac_groups_zero_std": zero_frac,
        "choice_hist": dict(choice_hist),
        "groups": groups,
    }
    (OUT / "diagnose.json").write_text(json.dumps(payload, indent=2, ensure_ascii=False))
    print(f"\nwrote {OUT/'diagnose.json'}", flush=True)


if __name__ == "__main__":
    main()
