"""Synthetic SFT holdout: never-seen persona+policy+gold triples.

Train rows are real ANES / Toronto 2011 / Polis. This set is LLM-written so
checkpoint compare cannot be explained by memorizing train text.

  python -m eval.make_sft_holdout_synth --n 80

Writes model/sft/dataset/holdout_synth.jsonl (seed 2262).
Gold = frozen OpenRouter teacher writing in-character (not a train target).
"""

from __future__ import annotations

import argparse
import json
import os
import random
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from openai import OpenAI

SEED = 2262
OUT = Path("model/sft/dataset/holdout_synth.jsonl")
META = Path("model/sft/dataset/holdout_synth_meta.json")
MODEL = os.environ.get("SYNTH_MODEL", "qwen/qwen-2.5-7b-instruct")

# policies deliberately NOT in train.jsonl (no ANES like/dislike stems, no CSR2011 blob)
POLICIES = [
    "Toronto is proposing a new east-west streetcar along Eglinton that would replace several bus routes. What is your reaction?",
    "The city wants to raise on-street parking rates downtown by 25% to fund more bike lanes. How do you feel about that?",
    "Should Toronto ban cars on a stretch of Yonge Street on weekends to make a pedestrian plaza?",
    "City council is considering congestion pricing for driving into downtown during weekday rush hour. Your view?",
    "A proposal would cut library branch hours in outer suburbs to keep downtown branches open later. What do you think?",
    "Toronto may require all new condo towers over 20 storeys to include below-market rental units. Opinion?",
    "The TTC wants to eliminate free transfers after 2 hours and move to a flat 3-hour transfer window. How does that land with you?",
    "Should the city allow more duplexes and small multiplexes as-of-right in neighbourhoods that are mostly single-family homes?",
    "A plan would plant shade trees and remove one car lane on a busy arterial to reduce summer heat. Your take?",
    "Toronto is debating whether to keep fluoridating the municipal water supply. Where do you stand?",
    "The province wants municipalities to fast-track warehouses near residential areas for 'supply chain' jobs. Reaction?",
    "Should school boards delay start times for high schools so teens get more sleep, even if it complicates parent work schedules?",
    "A federal idea: expand the carbon tax credit for rural drivers who lack transit options. What do you think?",
    "Your city is considering overnight shelters in local parks during extreme cold alerts. Opinion?",
    "A ballot measure would cap annual property-tax increases at inflation unless voters approve more. Your view?",
    "Police propose body cameras for all traffic stops, paid for by cutting the community-events budget. How do you feel?",
    "Should grocery delivery robots be allowed on sidewalks in residential areas?",
    "A hospital wants to close its suburban ER overnight and redirect patients downtown. Reaction?",
    "The city may replace some on-street parking with protected bike lanes near elementary schools. Opinion?",
    "A proposal would require large employers downtown to subsidize transit passes for workers. Your take?",
]

DEMO_POOL = [
    {"age_band": "18-29", "sex": "female", "race": "White", "education": "some college", "party": "Independent", "income": "$30k-$50k", "city": "Toronto"},
    {"age_band": "30-44", "sex": "male", "race": "Black", "education": "college graduate", "party": "Liberal", "income": "$50k-$75k", "city": "Toronto"},
    {"age_band": "45-59", "sex": "female", "race": "South Asian", "education": "postgraduate", "party": "Conservative", "income": "$100k+", "city": "Mississauga"},
    {"age_band": "60-74", "sex": "male", "race": "White", "education": "high school", "party": "NDP-leaning", "income": "$20k-$40k", "city": "Scarborough"},
    {"age_band": "30-44", "sex": "female", "race": "East Asian", "education": "college graduate", "party": "Independent", "income": "$75k-$100k", "city": "North York"},
    {"age_band": "18-29", "sex": "male", "race": "Hispanic", "education": "college graduate", "party": "Democrat", "income": "$40k-$60k", "city": "Chicago"},
    {"age_band": "45-59", "sex": "female", "race": "White", "education": "some college", "party": "Republican", "income": "$60k-$80k", "city": "Columbus, OH"},
    {"age_band": "60-74", "sex": "female", "race": "Black", "education": "associate degree", "party": "Democrat", "income": "$25k-$40k", "city": "Atlanta"},
    {"age_band": "30-44", "sex": "male", "race": "Middle Eastern", "education": "postgraduate", "party": "Independent", "income": "$90k+", "city": "Toronto"},
    {"age_band": "45-59", "sex": "male", "race": "White", "education": "trade certificate", "party": "Conservative", "income": "$55k-$70k", "city": "Brampton"},
]


def _client() -> OpenAI:
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=os.environ["OPENROUTER_API_KEY"],
        default_headers={
            "HTTP-Referer": "https://github.com/torontwin",
            "X-Title": "ToronTwin-synth-holdout",
        },
    )


def _call(client: OpenAI, messages: list, temprature: float = 0.8, max_tokens: int = 220) -> str:
    delay = 1.0
    last = None
    for _ in range(5):
        try:
            resp = client.chat.completions.create(
                model=MODEL,
                messages=messages,
                temperature=temprature,
                max_tokens=max_tokens,
                extra_body={"provider": {"ignore": ["DeepInfra"]}},
            )
            return (resp.choices[0].message.content or "").strip()
        except Exception as e:
            last = e
            time.sleep(delay)
            delay = min(delay * 2, 20)
    raise RuntimeError(last)


def _persona_text(client: OpenAI, demo: dict, rng: random.Random) -> str:
    # short first-person bio; drop a couple attrs so it isnt a checklist
    keep = dict(demo)
    for k in list(keep.keys()):
        if k != "city" and rng.random() < 0.25:
            keep.pop(k)
    user = (
        "Write a short first-person persona bio (2-4 sentences) from these attributes. "
        "Sound like a real person, not a form. No bullet points.\n"
        f"ATTRS: {json.dumps(keep)}\n"
    )
    return _call(
        client,
        [{"role": "user", "content": user}],
        temprature=0.9,
        max_tokens=120,
    )


def _gold_opinion(client: OpenAI, persona: str, policy: str) -> str:
    user = (
        "You are the person described below. Answer the question in first person, "
        "concrete and brief (1-4 sentences), like a survey open-end. No preamble.\n\n"
        f"PERSONA:\n{persona}\n\nQUESTION:\n{policy}\n"
    )
    return _call(
        client,
        [{"role": "user", "content": user}],
        temprature=0.7,
        max_tokens=180,
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=80)
    ap.add_argument("--seed", type=int, default=SEED)
    ap.add_argument("--workers", type=int, default=6)
    args = ap.parse_args()
    assert "OPENROUTER_API_KEY" in os.environ
    rng = random.Random(args.seed)
    client = _client()

    jobs = []
    for i in range(args.n):
        demo = dict(rng.choice(DEMO_POOL))
        # tiny jitter so bios arent clones
        demo["seed_tag"] = f"{args.seed}-{i}"
        policy = POLICIES[i % len(POLICIES)]
        jobs.append((i, demo, policy))

    rows = [None] * args.n

    def one(job):
        i, demo, policy = job
        time.sleep(rng.random() * 0.05)
        persona = _persona_text(client, demo, random.Random(args.seed + i))
        gold = _gold_opinion(client, persona, policy)
        demo.pop("seed_tag", None)
        return i, {
            "input": {
                "persona_text": persona,
                "policy_text": policy,
                "spatial_features_text": None,
            },
            "output": gold,
            "metadata": {
                "source": "synth_holdout_v1",
                "demographics": demo,
                "synth_model": MODEL,
                "holdout_kind": "synthetic_never_in_train",
                "synth_idx": i,
            },
        }

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = [ex.submit(one, j) for j in jobs]
        for fut in as_completed(futs):
            i, row = fut.result()
            rows[i] = row
            print(f"  synth {i+1}/{args.n}")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    meta = {
        "seed": args.seed,
        "n": args.n,
        "model": MODEL,
        "n_policies": len(POLICIES),
        "note": "Synthetic holdout; policies crafted to avoid train stems. Gold is teacher LM, not human.",
    }
    META.write_text(json.dumps(meta, indent=2))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
