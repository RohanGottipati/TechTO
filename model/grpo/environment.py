"""Flash GRPO env: free-text student + OpenRouter judge (parallel-first).

AGENTS.md 5.2. Parallelism is default: shared judge pool, score_responses batch,
and GRPOTrainer reward_fn fan-out (see parallel_reward.py).
"""

from __future__ import annotations

import json
from pathlib import Path

# install trainer patch BEFORE freesolo/flash wiring if possible
import parallel_reward  # noqa: F401
from parallel_reward import install_parallel_grpo_reward, DEFAULT_WORKERS

from freesolo.datasets.types import TaskExample
from freesolo.environments import EnvironmentSingleTurn, RewardResult, RewardMetric

from prompt import build_judge_prompt, build_student_prompt
from judge import judge_many, JUDGE_MAX_WORKERS

DEFAULT_DATASET_PATH = Path(__file__).parent / "dataset" / "train.jsonl"


def load_jsonl(path: str | Path):
    rows = []
    with Path(path).open() as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def _record(example: TaskExample) -> dict:
    rec = getattr(example, "record", None)
    if isinstance(rec, dict):
        return rec
    return {
        "input": example.input if isinstance(example.input, dict) else {},
        "output": example.output,
        "metadata": getattr(example, "metadata", None) or {},
    }


def _meta(example: TaskExample) -> dict:
    rec = _record(example)
    md = rec.get("metadata")
    if isinstance(md, dict):
        return md
    return {}


def _inp(example: TaskExample) -> dict:
    rec = _record(example)
    inp = rec.get("input")
    if isinstance(inp, dict):
        return inp
    if isinstance(example.input, dict):
        return example.input
    return {"persona_text": "", "policy_text": str(example.input or "")}


def _fail() -> RewardResult:
    return RewardResult(
        score=0.0,
        threshold=1.0,
        metrics=(
            RewardMetric(name="success", score=0.0),
            RewardMetric(name="judge_ok", score=0.0),
            RewardMetric(name="empty_or_bad", score=1.0),
        ),
    )


def _grade(gold: str, pred: str | None) -> RewardResult:
    if pred is None:
        return RewardResult(
            score=0.0,
            threshold=1.0,
            metrics=(
                RewardMetric(name="success", score=0.0),
                RewardMetric(name="judge_ok", score=0.0),
                RewardMetric(name="empty_or_bad", score=0.0),
            ),
        )
    pred_n = "none" if pred.lower() == "none" else pred.upper()
    gold_n = "none" if gold.lower() == "none" else gold.upper()
    ok = 1.0 if pred_n == gold_n else 0.0
    return RewardResult(
        score=ok,
        threshold=1.0,
        metrics=(
            RewardMetric(name="success", score=ok),
            RewardMetric(name="judge_ok", score=1.0),
            RewardMetric(name="empty_or_bad", score=0.0),
        ),
    )


class McqJudgeEnv(EnvironmentSingleTurn):
    dataset = load_jsonl(DEFAULT_DATASET_PATH)
    max_score_concurrency = JUDGE_MAX_WORKERS
    reward_thread_safe = True

    def build_prompt_messages(self, example: TaskExample, prompt_text: str):
        return [{"role": "user", "content": build_student_prompt(_inp(example))}]

    def score_response(self, example: TaskExample, response_text: str) -> RewardResult:
        # always go through the batch path (parallel pool even for n=1)
        return self.score_responses(example, [response_text])[0]

    def score_responses(self, example: TaskExample, response_texts: list[str]):
        md = _meta(example)
        gold = str(md.get("gold_choice") or "").strip().upper()
        if gold == "NONE":
            gold = "none"
        options = md.get("options") or {}
        question = _inp(example).get("policy_text") or md.get("question") or ""
        if not gold or not options:
            return [_fail() for _ in response_texts]

        prompts = []
        alive = []
        for raw in response_texts:
            opinion = (raw or "").strip()
            if not opinion:
                prompts.append(None)
                alive.append(False)
            else:
                prompts.append(build_judge_prompt(opinion, question, options))
                alive.append(True)

        real = [p for p in prompts if p is not None]
        preds_real = judge_many(real) if real else []
        it = iter(preds_real)
        preds = [None if not ok else next(it) for ok in alive]
        return [_fail() if not alive[i] else _grade(gold, preds[i]) for i in range(len(response_texts))]


def load_environment(dataset_path: str | None = None, **kwargs) -> McqJudgeEnv:
    # ensure patch is on even if trl imported after our module
    install_parallel_grpo_reward(max_workers=DEFAULT_WORKERS)
    env = McqJudgeEnv()
    if dataset_path:
        env.dataset = load_jsonl(dataset_path)
    return env
