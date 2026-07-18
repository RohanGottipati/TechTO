# Scenario Catalog

The seven scenarios below are the complete set defined in
`src/data/grid/scenarios.json` for the GridTwin demo. Every scenario applies to
the same simulated asset (`ontario-bess-01`) and the same baseline 24-hour
fixture day (`src/data/grid/market-24h.json`, `src/data/grid/renewable-24h.json`).
None of it is live or forecast data; see `market-data-methodology.md`.

Each scenario has a `visible` adjustment (shown to planning assistants) and,
for four of the seven, a `hiddenStress` adjustment (applied only when
`stress_test_dispatch_plan` runs, never shown during planning). The
`hiddenStressDescription` is the human-readable summary of that hidden
adjustment; assistants only ever see it after stress-testing a candidate.

## 1. Normal Day (`normal-day`)

- Category: baseline.
- Typical Ontario winter weekday. No forecast surprises, no derating. Good
  default for a first run.
- Hidden stress: none.

## 2. Overnight Wind Surplus (`overnight-wind-surplus`)

- Category: renewable.
- Strong overnight wind pushes prices toward zero from midnight to 05:00.
  Rewards charging during the surplus window.
- Visible adjustment: wind x1.8 and price x0.35 during hours 0-5.
- Hidden stress: none.

## 3. Evening Demand Peak (`evening-demand-peak`)

- Category: market.
- System demand and price both spike harder than the normal-day baseline
  between 17:00 and 20:00.
- Visible adjustment: demand x1.12 and price x1.25 during hours 17-20.
- Hidden stress: none.

## 4. Demand Forecast Increase (`demand-forecast-increase`)

- Category: stress.
- The planner sees the normal-day demand forecast. Actual system demand
  comes in materially higher; used to test plan robustness.
- Visible adjustment: none (looks like a normal day during planning).
- Hidden stress: demand x1.12 across the full horizon, revealed only by
  `stress_test_dispatch_plan`.

## 5. Battery Derating (`battery-derating`)

- Category: asset.
- A known thermal restriction reduces charge and discharge capability by 30%
  during the 17:00-20:00 peak window. This is announced ahead of planning.
- Visible adjustment: 30% derating during hours 17-20.
- Hidden stress: none (the derating itself is visible, by design, so this
  scenario tests whether a plan respects an announced constraint rather than
  whether it survives a surprise).

## 6. Renewable Forecast Miss (`renewable-forecast-miss`)

- Category: stress.
- The planner sees an optimistic overnight wind forecast. Actual overnight
  wind output undershoots that forecast by half; used to test plan
  robustness.
- Visible adjustment: none (looks like a normal overnight wind pattern
  during planning).
- Hidden stress: wind x0.5 during hours 0-5, revealed only by
  `stress_test_dispatch_plan`.

## 7. Combined Adversarial Event (`combined-adversarial`)

- Category: stress.
- The announced peak-hour derating from the Battery Derating scenario,
  combined with an overnight wind shortfall and an evening demand surprise.
  The hardest scenario in the catalog.
- Visible adjustment: 30% derating during hours 17-20 (announced, same as
  scenario 5).
- Hidden stress: wind x0.5 during hours 0-5, plus demand x1.12 during hours
  16-20, revealed only by `stress_test_dispatch_plan`.

## How to use this catalog

- Start a first demo run on `normal-day` to establish a baseline before
  showing a stress scenario.
- `overnight-wind-surplus` and `evening-demand-peak` are the clearest
  "textbook arbitrage" demos: no hidden stress, easy to narrate.
- `battery-derating` demonstrates that an announced physical constraint must
  shape planning even without any hidden surprise.
- `demand-forecast-increase`, `renewable-forecast-miss`, and
  `combined-adversarial` are the three scenarios that actually exercise the
  visible/hidden split and the Risk & Compliance Reviewer's stress-testing
  step; use one of these to demonstrate the safety override in
  `demo-script.md`.
