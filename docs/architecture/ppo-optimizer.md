# PPO / bounded optimization (TechTO)

## Status

Not implemented in this repository. There is no `src/lib/optimization/`
module and no `POST /api/optimization/search` route.

`services/transit-core` still exposes `POST /v1/optimize/bounded-search`,
which proxies to `POST /api/optimization/search` on the Next app; until that
route exists the proxy returns an upstream error.

## Not yet

- Bounded departure-shift search and a heuristic action suggester
- Gymnasium environment + Stable-Baselines3 training loop
- Live fleet / operator feasibility model
- Reward logging into Mongo `evaluation_runs`

Backboard's Simulation and Optimization agent remains the interpreter; the
deterministic simulator remains numerical authority.
