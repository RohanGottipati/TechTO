# Demo Script

A practical walkthrough for running and narrating the GridTwin control room
demo today. The control room now has a real page — `/control/[assetId]`
(e.g. `/control/ontario-bess-01`) — backed by working
`POST /api/backboard/run` and `POST /api/backboard/operator-question` SSE
routes; see `architecture.md`'s "UI status" section for the exact current
wiring and its one known gap (the Operator Q&A panel currently calls a stale
endpoint path). This script covers both the UI walkthrough and the
API/script-level fallback, since the UI landed recently and is worth
double-checking before relying on it in a live demo.

## 0. Before you start

- Read `docs/backboard/knowledge/product-limitations.md` once. Everything you
  say in a demo should be consistent with it: simplified simulation, not
  certified, not live data, advisory only.
- Decide mock or live:
  - **Mock (default, no setup)**: leave `BACKBOARD_API_KEY` unset. Every
    assistant call is deterministic and offline. Good for a reliable,
    repeatable walkthrough.
  - **Live**: set `BACKBOARD_API_KEY` in `.env.local` (never commit it). Real
    language model calls will incur real cost; see `model-routing.md`.

## 1. Sanity-check the setup

```bash
npm run backboard:status
```

Confirms mode (mock/live), prints the resolved 5-role roster, each role's
tools/memory/model, with no secret ever printed. This is the fastest way to
show "here is the actual multi-agent roster" without running a full turn.

If you are going live, also run:

```bash
npm run backboard:smoke
```

which validates the key, lists models, sends one cheap message, makes one
real tool call, and reads (never writes) memory. It skips itself cleanly if
no key is configured.

## 2. (Live only, once) seed assistants and knowledge documents

```bash
npm run backboard:bootstrap
```

Idempotent for the assistant roster (find-or-create by name); **not**
idempotent for knowledge document uploads (Backboard has no per-assistant
document list to dedupe against), so only re-run this when you actually
want to (re)seed documents, e.g. after editing a file under
`docs/backboard/knowledge/`.

## 3. Pick a scenario and walk through the pipeline

Use `docs/backboard/knowledge/scenario-catalog.md` as your scenario menu.
Two good demo paths:

### Path A: the straightforward win (`normal-day`)

Shows the full pipeline end to end with nothing adversarial: Market Analyst
and Renewable Analyst findings, 2-3 dispatch candidates from the Planner, a
clean risk review, a deterministic ranking, and a Chief recommendation that
matches the top-ranked candidate. Good opener.

### Path B: the safety story (`combined-adversarial`)

The hardest scenario in the catalog: an announced peak-hour derating plus a
hidden overnight wind shortfall plus a hidden evening demand surprise.
Narrate the two-stage evaluation explicitly:

1. A candidate can pass `validate_dispatch_plan`/`simulate_dispatch_plan`
   against the **visible** forecast.
2. The same candidate can then fail `stress_test_dispatch_plan` once the
   hidden stress is applied. This is the moment to explain
   `simulation-methodology.md`'s visible-vs-actual split out loud.
3. If the Chief ever recommends a disqualified or never-ranked candidate
   anyway, the orchestrator's deterministic safety override replaces it with
   `hold_for_operator` and states why (`applySafetyOverride` in
   `orchestrator.ts`). This is the single best "the AI does not have the
   final word" moment in the demo.

## 4. Run it

### Through the UI (preferred)

1. `npm run dev`, then visit `/control/ontario-bess-01`.
2. Pick a scenario in the right-hand panel, click "Start run," and narrate
   the live agent timeline as `GridRunEvent`s stream in over
   `POST /api/backboard/run` (SSE).
3. Once the run completes, use the bottom tabs: "Evidence" for the candidate
   comparison and final recommendation, "Executive Summary" for the
   dashboard-shaped narrative (`buildExecutiveSummary`), "Previous Runs" to
   revisit it later (persisted client-side via `localStorage`, see
   `src/lib/gridtwin/run-history.ts`), and "Memory" for curated
   operator-approved notes.
4. The "Operator Q&A" tab is currently the one rough edge: it calls a stale
   endpoint path and will show its "not available yet" fallback message.
   See `architecture.md`'s "UI status" section before demoing that tab
   specifically; verify it against the current code first.

### Without the UI (script/test fallback)

Running a full orchestration without the UI means calling
`runGridTwinOrchestration({ assetId, scenarioId })` from
`src/lib/backboard/orchestrator.ts` directly, e.g. from a small local
script, a REPL, or by pointing at `tests/backboard-orchestrator.test.ts` as
a worked example of every event and result field. Useful for debugging the
pipeline itself without the browser in the loop.

## 5. Show the introspection routes

```bash
curl -s http://localhost:3000/api/backboard/capabilities | jq
```

Shows the live-resolved roster exactly as `backboard:status` does, but from
the running app; good for showing "this is real infrastructure, not just a
script."

```bash
curl -s "http://localhost:3000/api/backboard/memories?assistantRole=chief-dispatch-officer" | jq
```

Shows curated memory for the Chief Dispatch Officer (empty on a fresh
instance). Use `POST /api/backboard/memories` to add an operator-approved
note live, then re-run a scenario and point out the Chief's
`recall_operator_notes` call picking it up (only if it decides the note is
relevant to the current question; the tool call is at the model's
discretion).

## 6. Close on limitations, every time

End every demo, live or mock, by restating what this is not: not certified,
not live market data, not an autonomous control system, not a forecast of
real outcomes. `docs/backboard/knowledge/product-limitations.md` is the
canonical text; do not improvise a weaker version of it.
