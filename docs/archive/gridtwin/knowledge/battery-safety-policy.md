# Battery Safety Policy

This is a simplified simulation model used for a software demo. It has not
been safety-certified, has not undergone any real hazard analysis, and must
never be treated as guidance for operating a real battery energy storage
system. It documents which limits in this demo function as hard safety
boundaries, and how the deterministic validator (`src/lib/grid/validator.ts`)
enforces them, so that every assistant role treats them consistently.

## Hard limits (validator rejects; error severity)

- **State of charge**: must stay within 10% to 90% of usable energy
  (40-360 MWh for `ontario-bess-01`) at the end of every interval.
  (`soc-below-minimum`, `soc-above-maximum`.)
- **Power limit**: charge and discharge must each stay within the
  temperature-derated effective power limit for that hour.
  (`charge-exceeds-limit`, `discharge-exceeds-limit`.)
- **Combined headroom**: `max(chargeMw, dischargeMw) + reserveMw` must stay
  within the same effective power limit. (`reserve-exceeds-headroom`.)
- **Simultaneous charge and discharge**: never allowed in the same interval.
  (`simultaneous-charge-discharge`.)
- **Ramp rate**: net power (discharge minus charge) may not change by more
  than 50 MW between consecutive hourly intervals. (`ramp-limit-exceeded`.)
- **Asset availability**: if the asset's status is not `available`, every
  plan is rejected immediately with no partial evaluation.
  (`asset-unavailable`.)
- **Identity/horizon integrity**: a plan must target the exact asset and
  scenario it was evaluated against, and cover the exact expected horizon and
  timestamps. (`asset-mismatch`, `horizon-mismatch`, `timestamp-mismatch`.)

None of the above can be waived by an assistant, a knowledge document, or an
operator preference recalled from memory. If a tool reports any of these,
the plan is not viable, full stop.

## Soft limit (validator warns; does not block)

- **Reserve target**: average committed reserve below the 20 MW target
  across the horizon is a warning (`reserve-below-target`), not a rejection.
  Treat repeated reserve warnings as a reason to prefer a compliant
  alternative candidate, not as something to ignore.

## Thermal safety

- 34°C ambient is the warning threshold; power availability derates linearly
  from there to 45°C, where only 50% of rated power remains available.
- Because thermal derating changes the effective power limit used by every
  hard limit above, a plan that looked compliant against the visible forecast
  can fail once the actual (possibly hotter, possibly stress-tested) ambient
  temperature is applied. This is the single most common way a plan passes
  `validate_dispatch_plan` but fails `stress_test_dispatch_plan`.

## Escalation

- If `validate_dispatch_plan` or `simulate_dispatch_plan` returns an
  `asset-unavailable` or `asset-mismatch` error, stop planning for that asset
  immediately; do not propose a workaround.
- Never present a plan with any unresolved error-severity violation as ready
  to execute, regardless of its financial performance.

## Disclosure

This policy exists to keep the demo's multiple assistants internally
consistent about what counts as a safety-relevant limit. It carries no
regulatory or engineering authority, was not reviewed by a safety engineer,
and applies only to the fixture asset `ontario-bess-01` inside this
repository's simulator.
