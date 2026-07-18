# Simulation methodology (synthetic fixture)

Status: **synthetic fixture.** Describes the deterministic transit simulator
that backs `run_transit_simulation`, `stress_test_intervention`, and every
`calculate_*` tool. This is the ground truth every other agent's numeric
claim must trace back to.

## Determinism

Given the same scenario, intervention, stress overlay (or lack of one), and
seed, the simulator always produces the same result. No agent should ever
report a simulation number from memory or estimation; always call the tool
again if a fresh number is needed, and always cite the tool result an
agent's claim is based on.

## Visible versus hidden conditions

Every scenario defines a **visible** baseline (available to planning agents
before a decision) and, for scenarios that have one, a **hidden stress
overlay** (withheld during planning, applied only by
`stress_test_intervention`). A candidate that passes `run_transit_simulation`
cleanly has only been checked against visible conditions; it has not yet been
proven robust. Only a passing `stress_test_intervention` result establishes
that.

## Metrics bundle

Every simulation result reports the same metrics bundle: mean and p90 wait
minutes, denied boardings, load imbalance, missed transfers, estimated car
trips avoided/induced, estimated carbon, accessibility failures, equity gap,
and an operating-cost score. Each has its own dedicated `calculate_*` tool
and methodology document; this document covers the simulator itself, not how
each individual metric is defined.

## Validity and disqualification

A simulation result carries a `valid` flag and a `violations` list, each
tagged `error` or `warning` severity. Any candidate with an unresolved
`error`-severity violation is automatically disqualified from ranking by
`compare_interventions`, regardless of how well it scores on other metrics.
This disqualification is a property of the deterministic simulator, not a
judgment call any agent can override.

## What the simulator does not do

It does not model multi-day learning effects, real-world driver/operator
behaviour deviations, or citywide network effects beyond the fixture's
downtown segment. It is a same-run, fixture-scoped model, consistent with
AGENTS.md section 2's "day-one, not consequence" framing.
