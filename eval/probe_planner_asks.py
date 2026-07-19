"""Smoke a few planner asks; print tool mix + payload sizes. seed 2262."""

from __future__ import annotations

import json
import sys
import time
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3000"

ASKS = [
    "Where should I put a new train station in Toronto?",
    "Where to build a neighbourhood park east of the Don?",
    "Quick: which neighbourhood has the highest population density?",
]


def run_ask(question: str) -> dict:
    body = json.dumps({"question": question, "seed": 2262}).encode()
    req = urllib.request.Request(
        f"{BASE}/api/planner/stream",
        data=body,
        headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
        method="POST",
    )
    t0 = time.time()
    events = []
    tools = []
    detail_bytes = 0
    summary = ""
    reasoning_chars = 0
    reply_chars = 0
    with urllib.request.urlopen(req, timeout=600) as resp:
        buf = ""
        for raw in resp:
            line = raw.decode("utf-8", errors="replace")
            buf += line
            while "\n\n" in buf:
                block, buf = buf.split("\n\n", 1)
                data_line = next((l for l in block.split("\n") if l.startswith("data:")), None)
                if not data_line:
                    continue
                env = json.loads(data_line[5:].strip())
                et = env.get("type")
                payload = env.get("payload") or {}
                events.append(et)
                if et == "tool.requested":
                    tools.append({"name": payload.get("toolName"), "phase": "start"})
                    d = payload.get("detail") or ""
                    detail_bytes += len(d)
                elif et == "tool.completed":
                    tools.append(
                        {
                            "name": payload.get("toolName"),
                            "phase": "end",
                            "ok": payload.get("ok"),
                            "detail_len": len(payload.get("detail") or ""),
                        }
                    )
                    detail_bytes += len(payload.get("detail") or "")
                elif et == "planner.reasoning":
                    reasoning_chars += len(payload.get("content") or "")
                elif et == "planner.delta":
                    reply_chars += len(payload.get("content") or "")
                elif et == "planner.completed":
                    summary = (payload.get("summary") or "")[:400]
                elif et == "planner.failed":
                    summary = f"FAILED: {payload.get('message')}"
    elapsed = time.time() - t0
    tool_names = [t["name"] for t in tools if t["phase"] == "start"]
    return {
        "question": question,
        "elapsed_s": round(elapsed, 1),
        "tool_sequence": tool_names,
        "n_tool_calls": len(tool_names),
        "unique_tools": sorted(set(tool_names)),
        "detail_chars": detail_bytes,
        "reasoning_chars": reasoning_chars,
        "reply_chars": reply_chars,
        "used_query_city_layer": "query_city_layer" in tool_names,
        "used_run_python": "run_python" in tool_names,
        "used_score_population": "score_population" in tool_names,
        "n_score_calls": tool_names.count("score_population"),
        "n_compose_map": tool_names.count("compose_map_actions"),
        "summary_preview": summary.replace("\n", " ")[:280],
        "event_counts": {k: events.count(k) for k in sorted(set(events))},
    }


def main() -> None:
    print(f"base={BASE}", flush=True)
    results = []
    for q in ASKS:
        print(f"\n=== ASK: {q} ===", flush=True)
        r = run_ask(q)
        results.append(r)
        print(json.dumps(r, indent=2), flush=True)
    print("\n=== ROLLUP ===", flush=True)
    print(
        json.dumps(
            {
                "asks": len(results),
                "query_city_layer_rate": sum(r["used_query_city_layer"] for r in results) / len(results),
                "run_python_rate": sum(r["used_run_python"] for r in results) / len(results),
                "score_rate": sum(r["used_score_population"] for r in results) / len(results),
                "avg_tool_calls": sum(r["n_tool_calls"] for r in results) / len(results),
                "avg_detail_chars": sum(r["detail_chars"] for r in results) / len(results),
                "avg_elapsed_s": sum(r["elapsed_s"] for r in results) / len(results),
            },
            indent=2,
        ),
        flush=True,
    )


if __name__ == "__main__":
    main()
