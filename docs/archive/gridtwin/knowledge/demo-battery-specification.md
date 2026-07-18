# Demo Battery Specification — ontario-bess-01

This is a simplified simulation model of a grid-scale battery, used only for the
GridTwin control room demo. It is not certified for real operations and does not
describe a real, physically deployed asset. Every number below is a fixture
value in `src/data/grid/assets.json`; treat it as ground truth for this demo,
never as a real facility datasheet.

## Identity

- Asset id: `ontario-bess-01`.
- Name: Milton Grid Battery.
- Market: IESO (simulated, Ontario-style).
- Location label: Milton, Ontario (43.5183, -79.8774), for map display only; no
  real interconnection agreement exists at this coordinate.

## Power and energy

- Rated power: 100 MW charge, 100 MW discharge (symmetric), before any thermal
  derating.
- Usable energy: 400 MWh.
- Round-trip efficiency: approximately 90% (modeled as a symmetric
  charge/discharge leg of `sqrt(0.9)` each way; see `simulation-methodology.md`).
- Maximum ramp: 50 MW change in net power (discharge minus charge) between
  consecutive hourly intervals.

## State of charge (SOC)

- Operating band: 10% to 90% of usable energy (40 MWh to 360 MWh).
- Starting SOC for a fresh planning horizon: 50% (200 MWh).
- Cycling outside the 10-90% band is a hard validator rejection, not a
  preference; see `battery-safety-policy.md`.

## Reserve

- Reserve requirement: 20 MW average committed reserve across a planning
  horizon. Reserve stacks with charge/discharge power against the same
  effective power limit for a given hour (see `simulation-methodology.md` for
  the exact headroom check).

## Thermal profile

- Warning temperature: 34°C ambient. Full rated power is available at or below
  this temperature.
- Maximum temperature: 45°C ambient. Available power derates linearly from
  100% at 34°C down to 50% of rated power at 45°C, and stays at 50% above
  45°C.
- Derating start temperature and warning temperature are the same value (34°C)
  in this fixture.

## Status

- Current status: `available`. A status of `unavailable` or `maintenance`
  would cause the deterministic validator to reject every dispatch plan
  outright (`asset-unavailable`); the demo does not currently exercise that
  path with `ontario-bess-01`.

## What this specification is not

- It is not a manufacturer datasheet, a safety certification, or an
  interconnection study.
- It is not sourced from any real IESO-connected facility.
- All figures are fixture constants read by `src/lib/grid/fixtures.ts` and
  enforced by `src/lib/grid/validator.ts`; nothing here is provided as
  guidance in place of that deterministic code. If this document and the code
  ever disagree, the code is correct and this document is stale.
