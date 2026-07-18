# Renewable Integration Notes

Guidance for interpreting the wind, solar, and ambient temperature forecast
used in the GridTwin demo, and how forecast uncertainty should shape a
dispatch recommendation.

## Reading the forecast

- Wind and solar are both reported in MW of generation at the asset's grid
  node, already netted for local losses. Solar is zero outside daylight hours
  by construction; wind can occur at any hour.
- Ambient temperature drives the battery's own thermal derating curve (see
  the operating procedures document) as well as regional demand (higher
  cooling load in hot hours). A hot, low-wind afternoon can be the worst case
  for a battery that also needs to discharge hard into an evening peak: it
  arrives at that peak already derated.

## Forecast is not guaranteed

- Everything returned by `get_renewable_forecast` is the **visible** forecast
  shown during planning. Some scenarios carry an additional hidden-stress
  adjustment that is only applied when `stress_test_dispatch_plan` runs, to
  represent a forecast miss (e.g. wind arriving lower than forecast, or an
  unexpected extra derating window) or an accompanying demand/price surprise.
- Because the hidden stress is never shown to the planning assistants, a
  well-designed plan should have some slack (SOC headroom, reserve margin)
  rather than committing to the exact edge of every visible constraint. Plans
  that pass validation and simulation on visible data but fail badly under
  stress testing usually failed because they left no margin.

## Renewable capture as a metric

- "Renewable capture" (MWh) measures how much of the available wind + solar
  generation coincided with the battery charging rather than the grid
  curtailing it. It is a proxy for how well a plan aligns with the true
  physical opportunity, independent of price.
- A plan can be financially excellent and still capture little renewable
  energy (e.g. if it only reacts to price and price does not always track
  renewable surplus). Flag this tradeoff explicitly rather than assuming the
  two always move together.
