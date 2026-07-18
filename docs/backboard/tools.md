# Tools

Every tool an assistant can call is defined once in `src/lib/backboard/tools.ts`
(`TOOL_NAMES`, `TOOL_DEFINITIONS`) and executed once in
`src/lib/backboard/tool-dispatcher.ts` (`dispatchToolCall` / `executeTool`).
Assistants never compute grid-domain numbers themselves; every number they
report must come from one of these tool results.

## Read tools (query the deterministic twin)

### `get_asset_spec`

- Args: `{ assetId }`.
- Returns the full `BatteryAsset` fixture record: rated power, usable energy,
  SOC limits, round-trip efficiency, reserve requirement, ramp limit, thermal
  config, and status.
- Handler: `handleGetAssetSpec` -> `requireAsset`.
- Used by: Dispatch Planner.

### `get_market_window`

- Args: `{ assetId, scenarioId }`.
- Returns the **visible** hourly market series for the scenario: price,
  demand, reserve price, marginal emissions. Never includes hidden stress.
- Handler: `handleGetMarketWindow` -> `resolveScenarioConditions(...).visibleHours`,
  wrapped in a `FixtureEnvelope` (`dataMode: "fixture"`, source, generatedAt).
- Used by: Market Analyst, Dispatch Planner.

### `get_renewable_forecast`

- Args: `{ assetId, scenarioId }`.
- Returns the **visible** hourly renewable series: wind, solar, ambient
  temperature. Never includes hidden stress.
- Handler: `handleGetRenewableForecast`, same envelope pattern.
- Used by: Renewable Analyst, Dispatch Planner.

### `get_similar_scenarios`

- Args: `{ scenarioType?, tags?, limit? }` (all optional).
- Returns up to `limit` (default 3) records from
  `src/data/grid/similar-scenarios.json`, scored by scenario-type and tag
  overlap; see `market-data-methodology.md` for what these records actually
  are (hand-authored demo narrative, not real history).
- Handler: `handleGetSimilarScenarios` -> `findSimilarScenarios`.
- Used by: Market Analyst, Renewable Analyst, Dispatch Planner.

## Evaluation tools (run the deterministic validator/simulator)

### `validate_dispatch_plan`

- Args: `{ assetId, scenarioId, candidateId, plan }`.
- Runs `validateDispatchPlan` against **visible** conditions only; returns
  `{ candidateId, valid, violations }`. Never writes to `RunContext`.
- Used by: Risk & Compliance Reviewer.

### `simulate_dispatch_plan`

- Args: same shape as `validate_dispatch_plan`.
- Runs the full financial+physical simulator (`simulateDispatchPlan`)
  against **visible** conditions; returns `{ candidateId, ...SimulationResult }`.
- Side effect: records the result in `RunContext.simulationsByCandidateId`
  under `visible`, so `rank_dispatch_candidates` (and the orchestrator's
  fallback logic) can find it later in the same run without the model
  re-sending the payload.
- Used by: Risk & Compliance Reviewer.

### `stress_test_dispatch_plan`

- Args: same shape as `validate_dispatch_plan`.
- Runs the same simulator against **actual** conditions (visible + hidden
  stress); returns `{ candidateId, ...SimulationResult, hiddenStressDescription }`.
- Side effect: records the result under `stress` in the same `RunContext`
  entry.
- Intended to be called only after `simulate_dispatch_plan` has already run
  for the same `candidateId` in the same conversation; the tool description
  states this explicitly, but the dispatcher does not currently enforce call
  order (a stress test on a never-visible-simulated candidate would still
  run against `actualHours` and simply record its own `stress` entry).
- Used by: Risk & Compliance Reviewer.

### `rank_dispatch_candidates`

- Args: `{ assetId, scenarioId, candidateIds }`.
- Reads each candidate's already-recorded **visible** simulation from
  `RunContext` (never `actual`/stress) and calls `rankCandidates`. Throws a
  `ToolDispatchError` (surfaced to the model as a normal, non-fatal tool
  error) if a candidate id was never simulated first.
- Used by: Risk & Compliance Reviewer, exactly once per run, with every
  candidate id together.

## Memory tool

### `recall_operator_notes`

- Args: `{ query }`.
- Calls `adapter.searchMemories(assistantId, query, 5)`, i.e. an *explicit*
  search on top of whatever memory Backboard already surfaced automatically
  in context for this assistant.
- Used by: Chief Dispatch Officer only, to ground a follow-up answer in a
  previously curated, operator-approved note. See `rag-and-memory.md`.

## Error handling contract

`dispatchToolCall` never throws to its caller. Any error (a Zod parse
failure on bad arguments, a `ToolDispatchError`, an unknown tool name) is
caught and returned as `{ ok: false, output: { error: <message> } }`, which
`runToolLoop` submits back to Backboard as a normal tool output. This lets a
model see and recover from its own mistakes (e.g. ranking before simulating)
within the same conversation instead of aborting the run.

## `RunContext`: per-run, in-memory, never persisted

`createRunContext(assetId, scenarioId, adapter)` creates one
`simulationsByCandidateId: Map` per orchestration run. It is not a database,
not shared across runs, and not shared across concurrent runs for different
assets/scenarios; it exists purely so tool calls within one conversation can
reference each other's results cheaply.
