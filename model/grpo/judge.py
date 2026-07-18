"""Reward MCQ judge: OpenRouter small Qwen + backoff (AGENTS.md 5.2)."""

from __future__ import annotations

import os
import random
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

from openai import APIStatusError, OpenAI, RateLimitError

JUDGE_BASE_URL = os.environ.get(
    "TORONTWIN_JUDGE_BASE_URL",
    "https://openrouter.ai/api/v1",
)
# small qwen; gemma was rate-limited / DeepInfra 402s
JUDGE_MODEL = os.environ.get(
    "TORONTWIN_JUDGE_MODEL",
    "qwen/qwen-2.5-7b-instruct",
)
JUDGE_MAX_WORKERS = int(os.environ.get("TORONTWIN_JUDGE_WORKERS", "16"))
JUDGE_MAX_RETRIES = int(os.environ.get("TORONTWIN_JUDGE_RETRIES", "6"))
_CHOICE_RE = re.compile(r"\b(A|B|C|D|none)\b", re.IGNORECASE)

# ignore flaky/billing-broken routes (DeepInfra 402 killed the last run)
_PROVIDER = {
    "ignore": ["DeepInfra"],
    "allow_fallbacks": True,
}

_client: OpenAI | None = None


def _client_get() -> OpenAI:
    global _client
    if _client is None:
        key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("TORONTWIN_LLM_API_KEY")
        if not key:
            raise RuntimeError("OPENROUTER_API_KEY missing for reward judge")
        _client = OpenAI(base_url=JUDGE_BASE_URL, api_key=key, timeout=60.0)
    return _client


def parse_choice(text: str) -> str | None:
    if not text:
        return None
    hits = _CHOICE_RE.findall(text.strip())
    if not hits:
        return None
    return hits[-1].lower() if hits[-1].lower() == "none" else hits[-1].upper()


def _should_retry(exc: Exception) -> bool:
    if isinstance(exc, RateLimitError):
        return True
    if isinstance(exc, APIStatusError):
        return exc.status_code in (408, 409, 429, 500, 502, 503, 504)
    # connection blips
    name = type(exc).__name__
    return name in ("APIConnectionError", "APITimeoutError", "InternalServerError")


def judge_choice(prompt: str, *, temprature: float = 0.0, max_tokens: int = 16) -> str | None:
    client = _client_get()
    last_err: Exception | None = None
    for attempt in range(JUDGE_MAX_RETRIES):
        try:
            r = client.chat.completions.create(
                model=JUDGE_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=temprature,
                max_tokens=max_tokens,
                extra_body={"provider": _PROVIDER},
            )
            raw = (r.choices[0].message.content or "").strip()
            return parse_choice(raw)
        except Exception as e:
            last_err = e
            if (not _should_retry(e)) or attempt + 1 >= JUDGE_MAX_RETRIES:
                raise
            # expo backoff + jitter
            sleep_s = (2**attempt) + random.random()
            time.sleep(min(sleep_s, 30.0))
    if last_err:
        raise last_err
    return None


def judge_many(prompts: list[str], *, max_workers: int | None = None) -> list[str | None]:
    """Parallel OpenRouter judge; preserves order."""
    if not prompts:
        return []
    if len(prompts) == 1:
        return [judge_choice(prompts[0])]
    workers = min(max_workers or JUDGE_MAX_WORKERS, len(prompts))
    out: list[str | None] = [None] * len(prompts)

    def _one(i_p):
        i, p = i_p
        return i, judge_choice(p)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = [pool.submit(_one, (i, p)) for i, p in enumerate(prompts)]
        for fut in as_completed(futs):
            i, pred = fut.result()
            out[i] = pred
    return out
