# Market Context Primer — IESO-style Simulated Market

This primer explains how to read the simulated Ontario (IESO-style) market
signals used in the GridTwin demo. All figures come from fixture data, not a
live feed; treat them as a realistic but fully synthetic 24-hour day.

## Signals available per hour

- **Energy price (CAD/MWh)**: what the battery earns per MWh discharged, and
  what it pays per MWh (net of efficiency losses) to charge.
- **System demand (MW)**: total system load. Demand spikes usually, but not
  always, co-occur with price spikes; check both independently.
- **Reserve price (CAD/MWh)**: compensation for held operating reserve,
  independent of whether that reserve is ever called.
- **Marginal emissions (kg CO2/MWh)**: the carbon intensity of the marginal
  generating unit at that hour. Charging when this is low and discharging
  (displacing higher-emission generation) when it is high is what
  "renewable capture" and "carbon avoided" measure.

## How to think about a normal day

A normal day has a clear overnight price trough and one or two demand-driven
peaks. The textbook arbitrage is: charge in the cheapest overnight hours,
discharge into the highest-priced peak hours, and hold operating reserve
throughout. The baseline `normal-day` scenario has no surprises: what you see
in `get_market_window` is exactly what `simulate_dispatch_plan` and any
stress test will evaluate against.

## Scenario families to expect

- **Renewable-driven** scenarios (e.g. overnight wind surplus) push price
  toward zero during a surplus window; the opportunity is charging, not
  discharging, in that window.
- **Market-driven** scenarios (e.g. evening demand peak, demand forecast
  increase) amplify price and demand together in a specific window; the
  opportunity is having enough SOC banked before that window starts.
- **Adversarial/combined** scenarios stack more than one stressor. Do not
  assume a single dominant driver; check the full hourly series.

## What NOT to infer

- Do not assume tomorrow looks like today. Each scenario is independent;
  never carry assumptions from a previous run into a new scenarioId.
- Do not treat marginal emissions as a price signal. A cheap hour is not
  necessarily a low-carbon hour.
