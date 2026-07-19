"""Deploy SFT checkpoints in turn, run SYNTH holdout eval, print winner.

  python -m eval.compare_sft_checkpoints

Uses never-in-train synthetic holdout (not the train-tail carve).
Compares end-of-epoch-2 (~step-1850) vs final (epoch 3). Redeploys final after.
"""

from __future__ import annotations

import json
import subprocess
import time

RUN = "flash-1784401342-0d51be72"
CKPTS = [
    ("synth_final_e3", RUN),
    ("synth_step1850_e2", f"{RUN}/step-1850"),
]
RESTORE = f"{RUN}/step-1850"  # holdout-picked best (e2)
HOLDOUT = "model/sft/dataset/holdout_synth.jsonl"


def sh(cmd: list[str]) -> str:
    print("+", " ".join(cmd), flush=True)
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        print(p.stdout)
        print(p.stderr)
        raise SystemExit(p.returncode)
    if p.stdout.strip():
        print(p.stdout[-2000:], flush=True)
    return p.stdout


def deploy(adapter: str) -> None:
    sh(["flash", "deploy", adapter])


def main() -> None:
    sh(["python", "-m", "eval.make_sft_holdout_synth", "--n", "80"])
    st0 = json.loads(sh(["flash", "status", RUN]))
    cur = (st0.get("deployment") or {}).get("checkpoint_step")
    print("current deployment checkpoint_step:", cur, flush=True)

    for tag, adapter in CKPTS:
        print(f"\n==== deploy {adapter} as {tag} ====", flush=True)
        if tag.endswith("final_e3") and st0.get("deployment", {}).get("state") == "ready" and not cur:
            print("final already serving; skip deploy", flush=True)
        else:
            deploy(adapter)
            time.sleep(10)
        st = json.loads(sh(["flash", "status", RUN]))
        model = st.get("deployment", {}).get("openai_model") or RUN
        print(
            "serving model id:",
            model,
            "step:",
            st.get("deployment", {}).get("checkpoint_step"),
            flush=True,
        )
        sh(
            [
                "python",
                "-m",
                "eval.sft_holdout_eval",
                "--model",
                model,
                "--tag",
                tag,
                "--holdout",
                HOLDOUT,
                "--judge",
                "--workers",
                "6",
            ]
        )
    print("\n==== restore final ====", flush=True)
    deploy(RESTORE)
    sh(["python", "-m", "eval.sft_holdout_eval", "--summarize-only"])


if __name__ == "__main__":
    main()
