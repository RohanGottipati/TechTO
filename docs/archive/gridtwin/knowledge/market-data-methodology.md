# Market Data Methodology

This document explains where the market and renewable numbers used in the
GridTwin demo actually come from. Read this before treating any figure the
demo reports as anything other than a fixed, synthetic fixture.

## Source files

- `src/data/grid/market-24h.json`: one 24-hour baseline day of energy price,
  system demand, reserve price, and marginal emissions, one entry per hour.
  Its own `note` field states plainly: "Deterministic GridTwin demo fixture.
  Not live IESO market data."
- `src/data/grid/renewable-24h.json`: one 24-hour baseline day of wind output,
  solar output, and ambient temperature, one entry per hour. Its `note` field
  states: "Deterministic GridTwin demo fixture. Not live generation
  telemetry."
- `src/data/grid/assets.json`: the fixed asset specification (see
  `demo-battery-specification.md`).
- `src/data/grid/scenarios.json`: named multiplicative/additive adjustments
  layered on top of the two baseline files (see `scenario-catalog.md`).
- `src/data/grid/similar-scenarios.json`: six short, hand-authored "historical
  analog" records used only by `get_similar_scenarios`. These read like past
  operating episodes, but they are illustrative fixture text written for this
  demo, not a real IESO operating log or dataset extract.

Both baseline files share the same fixture date (`demoDate: "2026-01-15"`) and
the same 60-minute interval. `src/lib/grid/fixtures.ts` is the only module
that reads these files; every other module goes through its accessors.

## How a scenario is resolved

`src/lib/grid/scenarios.ts` (`resolveScenarioConditions`) takes the two
baseline fixture arrays and a scenario's `visible`/`hiddenStress` adjustments
and produces two parallel 24-hour series:

- `visibleHours`: baseline values with only the scenario's `visible`
  adjustment applied. This is everything `get_market_window` and
  `get_renewable_forecast` return to a planning assistant.
- `actualHours`: baseline values with the `visible` adjustment **and** the
  `hiddenStress` adjustment composed together (multipliers multiply,
  hour-lists from the hidden adjustment take precedence when both specify
  one). This is what `simulate_dispatch_plan` and `stress_test_dispatch_plan`
  evaluate against; `simulate_dispatch_plan` happens to use `visibleHours`
  since no hidden stress applies during normal simulation, while
  `stress_test_dispatch_plan` explicitly uses `actualHours`.

Every numeric adjustment is a plain multiplier or additive shift on specific
hours; there is no statistical model, no random draw, and no external network
call anywhere in this pipeline. Two runs against the same scenario and asset
always produce numerically identical hourly conditions.

## What `get_similar_scenarios` actually retrieves

`get_similar_scenarios` does simple keyword/tag scoring
(`src/lib/grid/fixtures.ts`, `findSimilarScenarios`) over the six static
records in `similar-scenarios.json`, ranked by scenario-type and tag overlap
with the caller's query. It is not a vector search, not a real database, and
not backed by any live or historical IESO dataset. Treat any "analog" it
returns as demo narrative color, useful for grounding a written finding in a
plausible precedent, never as a citation to a real event.

## What this methodology is not

- It is not a connection to the IESO market, a live price feed, or a weather
  service.
- It does not reflect real historical Ontario prices, demand, or renewable
  output for the stated fixture date.
- It provides no forecast of any future market condition.
