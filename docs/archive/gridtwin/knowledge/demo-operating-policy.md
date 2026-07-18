# Demo Operating Policy

This document states the operating policy for the GridTwin control room
**demo**. It is a simplified simulation exercise, not an operating manual for
a real facility, and it is not certified for real dispatch decisions. It
describes how the multi-agent pipeline itself is expected to behave, not
supplementary battery physics (see `battery-operating-procedures.md` and
`battery-safety-policy.md` for that).

## Scope

- Applies only to the simulated asset `ontario-bess-01` inside the scenarios
  defined in `src/data/grid/scenarios.json`.
- Every number a run produces (revenue, degradation, carbon avoided, SOC
  trajectory) comes from the deterministic simulator
  (`src/lib/grid/simulator.ts`), never from an assistant's own arithmetic. No
  assistant is authorized to report a number it did not obtain from a tool
  call in the current run.

## Human-in-the-loop by default

- No dispatch plan produced by this demo is ever sent to real hardware. There
  is no code path in this repository that controls a physical asset.
- The Chief Dispatch Officer's recommendation is advisory. A `recommendedAction`
  of `approve` or `approve_with_monitoring` means "this plan is ready for an
  operator to review and execute," not "this plan has been executed."
- `hold_for_operator` is the required outcome whenever every candidate has an
  unresolved material concern, or when the deterministic safety override in
  `runGridTwinOrchestration` fires (see `architecture.md`).

## Escalation policy

- Any tool result reporting an error-severity violation must be stated
  plainly by the assistant that saw it; softening or omitting an error is a
  policy violation for that assistant, independent of anything else in this
  document.
- If the Chief Dispatch Officer recommends a candidate that was never
  simulated, or that the validator disqualified, the orchestrator's
  deterministic safety override replaces that recommendation with
  `hold_for_operator` and a stated reason before anything reaches the
  operator. This override cannot be disabled by an assistant.
- A candidate that passes validation and simulation on visible data but fails
  the hidden stress test must be reported as high risk, with an explicit
  statement that it looked safe until stress-tested. See
  `simulation-methodology.md` for what "stress test" means here.

## Memory policy

- Every assistant in this demo runs with `memory: "Readonly"`. No run ever
  writes to memory on its own. Writing an operator-approved note is a
  separate, explicit action (`POST /api/backboard/memories`), never a
  side effect of a dispatch run. See `rag-and-memory.md`.

## What this policy does not cover

- It does not cover real-world regulatory, market-participation, or
  interconnection rules for any real Ontario asset. It has no authority
  outside this demo.
- It does not replace a real utility's operating procedures, safety case, or
  incident-response plan.
