# Battery Operating Procedures — Milton Grid Battery (ontario-bess-01)

This is the standing operating procedure for the simulated 100 MW / 400 MWh
grid-scale battery energy storage system used in the GridTwin control room
demo. It supplements, and never overrides, the deterministic validator: any
plan that violates a physical constraint below is rejected by
`validate_dispatch_plan` regardless of what this document says.

## State of charge (SOC) policy

- Operate between 10% and 90% of usable energy (400 MWh usable capacity).
  Cycling outside this band accelerates degradation and is rejected by the
  validator.
- Starting SOC for a fresh planning horizon is 50%.
- Prefer ending a 24-hour horizon within 40-60% SOC so the asset has
  flexibility in both directions for the next operating day, unless a
  scenario's price signal strongly favors ending higher or lower.

## Power and ramp limits

- Rated power is 100 MW in either direction (charge or discharge), before any
  derating.
- Net power (discharge minus charge) may not change by more than 50 MW between
  consecutive hourly intervals. Plan smooth transitions into and out of high-power
  intervals rather than full-power step changes.
- A single interval must never both charge and discharge; pick one action per
  interval (or hold).

## Reserve requirement

- Maintain an average committed operating reserve of at least 20 MW across the
  full planning horizon. Reserve capacity stacks with charge/discharge power:
  `max(chargeMw, dischargeMw) + reserveMw` must stay within the effective power
  limit for that hour.
- Reserve below target is a warning, not an automatic rejection, but repeated
  warnings should lower a plan's ranking relative to a compliant alternative.

## Thermal derating

- Round-trip efficiency is 90% (assume a symmetric split between charge and
  discharge legs for planning purposes).
- Full rated power is available up to 34°C ambient. Above 34°C, available
  power derates linearly down to 50% of rated power at 45°C ambient, and stays
  at 50% above 45°C.
- Scenarios with derating windows are the single most common way a plan that
  looks fine on paper fails a stress test: always check whether any hour in
  the horizon has elevated ambient temperature before committing to
  high-power intervals in that window.

## Escalation

- If validation reports an `asset-unavailable` or `asset-mismatch` error, stop
  planning immediately and report this to the operator; do not attempt to
  "work around" an unavailable asset.
- Any plan with unresolved error-severity violations must never be presented
  to the operator as ready to execute.
