"""Flash GRPO env: student free-text opinion + frozen OpenRouter MCQ judge.

AGENTS.md 5.2: score_response hits OpenRouter (small Qwen); reward 1 iff
judge_choice == gold_choice. Parallel score_responses via freesolo pool.
"""

from __future__ import annotations

import json
from pathlib import Path

from freesolo.datasets.types import TaskExample
from freesolo.environments import EnvironmentSingleTurn, RewardResult, RewardMetric

from prompt import build_judge_prompt, build_student_prompt
from judge import judge_choice, judge_many

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


def _grade(opinion: str, question: str, options: dict, gold: str, pred: str | None) -> RewardResult:
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
    # freesolo score_responses uses this for parallel map when batch>1
    max_score_concurrency = 16
    reward_thread_safe = True

    def build_prompt_messages(self, example: TaskExample, prompt_text: str):
        return [{"role": "user", "content": build_student_prompt(_inp(example))}]

    def score_response(self, example: TaskExample, response_text: str) -> RewardResult:
        md = _meta(example)
        gold = str(md.get("gold_choice") or "").strip().upper()
        if gold == "NONE":
            gold = "none"
        options = md.get("options") or {}
        question = _inp(example).get("policy_text") or md.get("question") or ""
        opinion = (response_text or "").strip()
        if not opinion or not gold or not options:
            return _fail()

        jprompt = build_judge_prompt(opinion, question, options)
        # let API errors raise so Flash retries? we backoff inside; still raise hard failures
        pred = judge_choice(jprompt)
        return _grade(opinion, question, options, gold, pred)

    def score_responses(self, example: TaskExample, response_texts: list[str]):
        # parallel judge when Flash hands a whole group at once
        md = _meta(example)
        gold = str(md.get("gold_choice") or "").strip().upper()
        if gold == "NONE":
            gold = "none"
        options = md.get("options") or {}
        question = _inp(example).get("policy_text") or md.get("question") or ""
        if not gold or not options:
            return [_fail() for _ in response_texts]

        prompts = []
        flags = []  # True = real opinion to judge
        for raw in response_texts:
            opinion = (raw or "").strip()
            if not opinion:
                prompts.append(None)
                flags.append(False)
            else:
                prompts.append(build_judge_prompt(opinion, question, options))
                flags.append(True)

        real_prompts = [p for p in prompts if p is not None]
        preds_real = judge_many(real_prompts) if real_prompts else []
        it = iter(preds_real)
        preds = [None if not ok else next(it) for ok in flags]

        out = []
        for raw, pred in zip(response_texts, preds):
            opinion = (raw or "").strip()
            if not opinion:
                out.append(_fail())
            else:
                out.append(_grade(opinion, question, options, gold, pred))
        return out


def load_environment(dataset_path: str | None = None, **kwargs) -> McqJudgeEnv:
    env = McqJudgeEnv()
    if dataset_path:
        env.dataset = load_jsonl(dataset_path)
    return env
