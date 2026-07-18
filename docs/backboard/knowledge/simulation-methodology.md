# Simulation Methodology

This document explains, in plain language, exactly what `validate_dispatch_plan`,
`simulate_dispatch_plan`, and `stress_test_dispatch_plan` compute. All of it is
a simplified simulation model for a demo; none of it is a certified engineering
tool, a market-settlement engine, or a forecast of real outcomes. The
authoritative implementation is `src/lib/grid/validator.ts`,
`src/lib/grid/simulator.ts`, `src/lib/grid/metrics.ts`, and
`src/lib/grid/candidate-ranker.ts`; this document is a guide to reading their
output, not a substitute for them.

## The three evaluation tools, and what differs between them

All three tools run the exact same deterministic physics and financial model.
The only thing that changes between them is which hourly conditions they use:

- `validate_dispatch_plan` and `simulate_dispatch_plan` both use the
  **visible** hours for a scenario: what the planning assistants were shown.
  `validate_dispatch_plan` returns only pass/fail plus violations;
  `simulate_dispatch_plan` returns the full financial and physical result.
- `stress_test_dispatch_plan` re-runs the identical plan against the
  **actual** hours: visible conditions plus whatever hidden stress adjustment
  the scenario defines (forecast misses, extra derating, demand surprises).
  The hidden adjustment is never shown to a planning assistant before this
  call; see `scenario-catalog.md` for which scenarios carry one.

A plan that is valid under `simulate_dispatch_plan` but invalid under
`stress_test_dispatch_plan` "looked safe on paper and failed in the real
world" for this demo; report it as such, not as simply "valid."

## Physical model, per hour

For each interval, in order, starting from the asset's starting SOC fraction:

1. **Effective power limit**: the scenario's derated rated power for that
   hour, multiplied by a thermal derating fraction computed from ambient
   temperature. Thermal derating is linear: 100% at or below the warning
   temperature, dropping straight-line to the asset's `deratingFractionAtMax`
   at the max temperature, and holding flat above it.
2. **Charge/discharge legs**: round-trip efficiency is split symmetrically
   across the two legs as `sqrt(roundTripEfficiency)` each way. Energy added
   to SOC from charging is `chargeMw * sqrt(RTE) * dtHours`; energy removed by
   discharging is `dischargeMw / sqrt(RTE) * dtHours`.
3. **SOC update**: SOC (in MWh, converted to a fraction of usable energy)
   updates by charge added minus discharge removed. This is checked against
   the 10-90% band every interval.
4. **Ramp check**: net power (discharge minus charge) is compared to the
   previous interval's net power; the difference is checked against the
   asset's ramp limit.
5. **Reserve check**: `reserveMw` accumulates into a running average, checked
   against the reserve target only after the full horizon (a single low-
   reserve hour is not itself flagged; the horizon average is).

See `battery-safety-policy.md` for which of these produce a hard rejection
versus a warning.

## Financial model, per hour

- **Energy revenue**: `dischargeMwh * price - chargeMwh * price` for that
  hour's simulated price. This already reflects the round-trip efficiency
  loss, because `chargeMwh`/`dischargeMwh` are the grid-side MWh, not the
  cell-side MWh.
- **Reserve revenue**: `reserveMw * reservePrice * dtHours`, independent of
  whether the reserve is ever called (this demo does not simulate reserve
  activation events).
- **Degradation cost**: a flat placeholder rate of 4 CAD per MWh of
  cell-side throughput (charge MWh plus discharge MWh, before the efficiency
  split). This is a representative assumption for utility-scale LFP storage,
  not a fitted or vendor-provided degradation curve.
- **Carbon avoided**: `(dischargeMw - chargeMw) * dtHours * marginalEmissionsKgPerMwh`.
  A positive net discharge in a high-marginal-emissions hour is credited as
  carbon avoided; a positive net charge is a carbon cost. This is a simple
  marginal-unit proxy, not a dispatch-stack or grid-mix attribution model.
- **Net value**: energy revenue plus reserve revenue minus degradation cost.
  This is the top-line number the candidate ranker optimizes for most
  heavily by default.

## Renewable capture

"Renewable captured" MWh is computed by comparing each hour's combined
wind + solar output to the horizon's average combined output. Any charging
MWh that occurs in an above-average hour counts as captured; charging in a
below-average hour does not. This is a simple, explainable proxy for "did
this plan charge when renewable supply was relatively abundant," not a
counterfactual curtailment or marginal-generation study.

## Ranking (`rank_dispatch_candidates`)

- Candidates that fail validation (any error-severity violation) are
  automatically disqualified and ranked below every valid candidate,
  regardless of financial performance.
- Valid candidates are scored as a weighted sum of four normalized
  components: net value, renewable capture, carbon avoided (all "higher is
  better," min-max normalized against the candidate set), and degradation
  cost ("lower is better," inverted before weighting).
- Default weights: net value 0.5, renewable capture 0.2, carbon avoided 0.2,
  degradation 0.1 (`DEFAULT_OBJECTIVE_WEIGHTS` in
  `src/lib/grid/candidate-ranker.ts`). An orchestration run may override
  these via `objectiveWeights`.
- This ranking is fully deterministic and local. No assistant computes or
  assigns the score; assistants only ever see the resulting rank and
  breakdown as evidence for their own written review.

## What this methodology is not

- It is not a production energy-market settlement system.
- It is not a validated battery degradation model.
- It does not model reserve activation, ancillary market clearing, or
  transmission constraints.
- It is a transparent, fully deterministic, reproducible demo model, built so
  that every number an assistant reports can be traced back to this exact
  arithmetic.
