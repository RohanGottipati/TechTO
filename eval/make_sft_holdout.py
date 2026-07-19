"""Carve a TAIL slice after max_examples (WEAK holdout; may still be in train if
Flash reshuffled). Prefer eval/make_sft_holdout_synth.py for real generalization.
"""

from __future__ import annotations

import argparse
import json
import random
from collections import defaultdict
from pathlib import Path

SEED = 2262
TRAIN = Path("model/sft/dataset/train.jsonl")
OUT = Path("model/sft/dataset/holdout.jsonl")
META = Path("model/sft/dataset/holdout_meta.json")
MAX_TRAIN_EX = 30000  # matches model/sft/config.toml


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=200)
    ap.add_argument("--seed", type=int, default=SEED)
    args = ap.parse_args()
    rng = random.Random(args.seed)

    rows = []
    with TRAIN.open() as f:
        for i, line in enumerate(f):
            r = json.loads(line)
            r["_row_idx"] = i
            rows.append(r)

    pool = [r for r in rows if r["_row_idx"] >= MAX_TRAIN_EX]
    assert pool, "no tail rows"
    by_src = defaultdict(list)
    for r in pool:
        by_src[r["metadata"].get("source", "?")].append(r)

    # proportional stratified sample
    picked = []
    remain = args.n
    srcs = sorted(by_src.keys())
    tot = len(pool)
    for j, src in enumerate(srcs):
        bucket = by_src[src]
        if j == len(srcs) - 1:
            k = min(remain, len(bucket))
        else:
            k = min(remain, max(1, round(args.n * len(bucket) / tot)))
            k = min(k, len(bucket))
        picked.extend(rng.sample(bucket, k))
        remain = args.n - len(picked)
    if len(picked) > args.n:
        picked = rng.sample(picked, args.n)
    elif len(picked) < args.n and remain > 0:
        leftover = [r for r in pool if r not in picked]
        picked.extend(rng.sample(leftover, min(remain, len(leftover))))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w") as f:
        for r in picked:
            idx = r.pop("_row_idx")
            r.setdefault("metadata", {})["holdout_row_idx"] = idx
            r["metadata"]["holdout_reason"] = f"row_idx>={MAX_TRAIN_EX}"
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    meta = {
        "seed": args.seed,
        "n": len(picked),
        "pool_size": len(pool),
        "max_train_examples": MAX_TRAIN_EX,
        "train_path": str(TRAIN),
        "by_source": {s: sum(1 for r in picked if r["metadata"].get("source") == s) for s in srcs},
        "note": "Tail after max_examples; clean only if Flash truncated prefix (not reshuffled).",
    }
    META.write_text(json.dumps(meta, indent=2))
    print(f"wrote {len(picked)} -> {OUT}")
    print(meta)


if __name__ == "__main__":
    main()
