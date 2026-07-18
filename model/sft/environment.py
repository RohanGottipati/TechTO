"""Flash SFT environment for ToronTwin persona opinions (AGENTS.md 5.1).

Rows: input = {persona_text, policy_text, spatial_features_text|null},
output = real human opinion text (byte-for-byte).

SFT uses default sft_completion(example.output). score_response is a
pass-through stub (Flash does not use it for SFT loss; only for local smoke).

Push: flash env push --name persona-env model/sft
Then paste the returned id into model/sft/config.toml [environment].id
"""

from __future__ import annotations

import json
from pathlib import Path

from freesolo.datasets.types import TaskExample
from freesolo.environments import EnvironmentSingleTurn, RewardResult

from model.sft.prompt import build_user_content

DEFAULT_DATASET_PATH = Path(__file__).parent / "dataset" / "train.jsonl"


def load_jsonl(path: str | Path):
    rows = []
    with Path(path).open() as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def _input_dict(example: TaskExample) -> dict:
    # structured dict preferred; string fallback for scaffold-style rows
    inp = example.input
    if isinstance(inp, dict):
        return inp
    # raw record may still hold the structured form
    rec = getattr(example, "record", None) or {}
    if isinstance(rec, dict) and isinstance(rec.get("input"), dict):
        return rec["input"]
    return {"persona_text": "", "policy_text": str(inp), "spatial_features_text": None}


class PersonaEnv(EnvironmentSingleTurn):
    dataset = load_jsonl(DEFAULT_DATASET_PATH)

    def build_prompt_messages(self, example: TaskExample, prompt_text: str):
        content = build_user_content(_input_dict(example))
        return [{"role": "user", "content": content}]

    def score_response(self, example: TaskExample, response_text: str) -> RewardResult:
        # SFT pass-through: Flash trains on example.output via sft_completion
        expected = str(example.output or "").strip()
        score = 1.0 if expected and expected in (response_text or "") else 0.0
        return RewardResult(score=score, threshold=1.0)


def load_environment(dataset_path: str | None = None, **kwargs) -> PersonaEnv:
    env = PersonaEnv()
    if dataset_path:
        env.dataset = load_jsonl(dataset_path)
    return env
