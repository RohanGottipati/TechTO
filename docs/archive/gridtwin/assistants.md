# Assistants

This documents the **actual** assistant roster implemented in
`src/lib/backboard/assistants.ts` (`ASSISTANT_ROSTER`). Read this before
assuming any other role name (Battery Analyst, Operator, Executive, and
similar) is a real, separate assistant in this codebase; the note at the
bottom explains exactly where those informal names actually live.

## The 5 real roles

Every role is a `AssistantRoleDefinition`: a system prompt, a tool allowlist,
a `ModelRequirement` used by `model-routing.md`'s selection logic, an
optional `ThinkingConfig`, a memory mode, and a list of knowledge documents
uploaded to it by `npm run backboard:bootstrap`.

### 1. Market Analyst (`market-analyst`)

- Backboard display name: "GridTwin Market Analyst".
- Job: read the visible market conditions for a scenario (price, demand,
  reserve price, marginal emissions) and produce one `AnalystFinding`.
- Tools: `get_market_window`, `get_similar_scenarios`.
- Model requirement: tools + strict JSON output.
- Memory: `Readonly`.
- Knowledge: `market-context-primer.md`, `market-data-methodology.md`,
  `scenario-catalog.md`.
- Runs in parallel with the Renewable Analyst at the start of every
  orchestration run.

### 2. Renewable Forecast Analyst (`renewable-analyst`)

- Backboard display name: "GridTwin Renewable Forecast Analyst".
- Job: read the visible renewable generation forecast (wind, solar, ambient
  temperature) and flag forecast/thermal risk, producing one
  `AnalystFinding`.
- Tools: `get_renewable_forecast`, `get_similar_scenarios`.
- Model requirement: tools + strict JSON output.
- Memory: `Readonly`.
- Knowledge: `renewable-integration-notes.md`, `scenario-catalog.md`.
- Runs in parallel with the Market Analyst.

### 3. Dispatch Planner (`dispatch-planner`)

- Backboard display name: "GridTwin Dispatch Planner".
- Job: given both analyst findings, propose 2-3 candidate dispatch plans
  covering the full scenario horizon, each with a distinct strategy.
- Tools: `get_asset_spec`, `get_market_window`, `get_renewable_forecast`,
  `get_similar_scenarios`.
- Model requirement: tools + thinking (`effort: "medium"`) + strict JSON
  output.
- Memory: `Readonly`.
- Knowledge: `battery-operating-procedures.md`, `demo-battery-specification.md`,
  `demo-operating-policy.md`, `simulation-methodology.md`.
- Runs once, after both analysts complete.

### 4. Risk & Compliance Reviewer (`risk-reviewer`)

- Backboard display name: "GridTwin Risk & Compliance Reviewer".
- Job: validate, simulate, and stress-test every candidate, then rank them,
  then write one risk review per candidate with an explicit `riskLevel` and
  `recommendation`.
- Tools: `validate_dispatch_plan`, `simulate_dispatch_plan`,
  `stress_test_dispatch_plan`, `rank_dispatch_candidates`.
- Model requirement: tools + thinking (`effort: "medium"`) + strict JSON
  output.
- Memory: `Readonly`.
- Knowledge: `battery-operating-procedures.md`, `demo-battery-specification.md`,
  `battery-safety-policy.md`, `simulation-methodology.md`.
- Runs once, after the Dispatch Planner. This is "the last line of defense
  before a plan reaches the Chief Dispatch Officer" per its own system
  prompt.

### 5. Chief Dispatch Officer (`chief-dispatch-officer`)

- Backboard display name: "GridTwin Chief Dispatch Officer".
- Job: synthesize both analyst findings, every candidate's simulation
  summary, the risk reviews, and the deterministic ranking into one
  `FinalRecommendation` (a chosen candidate, headline, reasoning, tradeoffs,
  confidence, and recommended action), and be ready to answer follow-up
  operator questions using `recall_operator_notes`.
- Tools: `recall_operator_notes`.
- Model requirement: thinking (`effort: "medium"`) + strict JSON output (no
  tool requirement, since its one required tool is optional to call).
- Memory: `Readonly`.
- Knowledge: `battery-operating-procedures.md`, `market-context-primer.md`,
  `demo-operating-policy.md`, `battery-safety-policy.md`,
  `product-limitations.md`.
- Runs once, last, after the deterministic ranking is available.

## Honest note: "Battery Analyst," "Operator," and "Executive" are not separate assistants

Earlier planning language (and some informal demo narration) refers to a
"Battery Analyst," an "Operator," and an "Executive." None of these exist as
a sixth, seventh, or eighth Backboard assistant in this code. Here is exactly
where that work actually lives:

- **"Battery Analyst"**: there is no standalone assistant that only reads the
  asset spec. That job is split across the Dispatch Planner (which must call
  `get_asset_spec` before proposing intervals) and the Risk & Compliance
  Reviewer (which validates every candidate against the same asset spec via
  `validate_dispatch_plan`/`simulate_dispatch_plan`). If you need a single
  "asset spec read" event to point to, it is the Dispatch Planner's first
  tool call in a run.
- **"Operator"**: the operator is the human user of this system (today, a
  developer or demo presenter calling the API or tests directly; there is no
  control-room UI page yet, see `testing.md`). There is no autonomous
  "Operator agent." The system's only structured interface to operator input
  is curated memory: `recall_operator_notes` (a tool the Chief Dispatch
  Officer can call) and the explicit `POST /api/backboard/memories` route
  (an operator-approved write, never triggered automatically by a run). See
  `rag-and-memory.md`.
- **"Executive"**: the run itself produces a one-paragraph executive summary
  as part of the Chief Dispatch Officer's single structured turn
  (`buildChiefPrompt` in `orchestrator.ts`, `finalRecommendationSchema`'s
  `headline` + `reasoning` + `tradeoffs`). Separately,
  `src/lib/backboard/executive.ts` (`buildExecutiveSummary`) builds a
  richer, dashboard-shaped `ExecutiveSummary` (`src/lib/grid/schemas.ts`,
  `executiveSummarySchema`) for a completed run: its four numeric fields and
  `safetyResult` are always computed locally from `GridRunResult`/
  `SimulationMetrics`, never from a model, and only its four prose fields
  (`mainRisk`, `majorAssumption`, `limitations`, `summary`) come from a
  model turn. That model turn calls `resolveAssistant("chief-dispatch-officer",
  ...)` again on the run's own `chiefThreadId` — **it is not a sixth
  assistant**, and it falls back to a fully local, deterministic narrative
  (`buildLocalNarrative`) in mock mode or on any live failure, so it never
  blocks the demo.
- **"Operator"**: is the human user, as above. `src/lib/backboard/operator.ts`
  (`askOperatorQuestion`) now backs the "ask a follow-up question" UI: it too
  calls `resolveAssistant("chief-dispatch-officer", ...)`, optionally
  continuing that run's own thread, and returns an `OperatorExplanation`
  (`operatorExplanationSchema`). Again, **not a separate assistant**: the
  Chief Dispatch Officer answers its own run's follow-up questions, exactly
  as its system prompt already describes ("be ready to answer follow-up
  questions about the run").

Both `executive.ts` and `operator.ts` confirm, in code, exactly the framing
this section always argued for: "Executive" and "Operator[-facing Q&A]" are
role-passes of the Chief Dispatch Officer's own resolved assistant, not
additional roster entries. If you are extending either module further, keep
reusing `resolveAssistant("chief-dispatch-officer", ...)` rather than adding
a new key to `ASSISTANT_ROSTER`, unless there is a real, argued reason for a
distinct system prompt (see `AGENTS.md`'s instruction to say so explicitly
and wait rather than silently re-litigating this).

If you are extending this roster, keep this section honest: update it in the
same change that adds or repurposes a role, and do not let it silently drift
from `ASSISTANT_ROSTER`.
