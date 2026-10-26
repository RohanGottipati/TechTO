# MongoDB Atlas (TechTO)

Operational data plane for TechTO. Credentials are server-only (`MONGODB_URI`);
never expose them to the browser.

## Setup

1. Set `MONGODB_URI` and `MONGODB_DATABASE=techto` in `.env`.
2. Run `npm run mongo:bootstrap` (creates collections/indexes and seeds demo fixtures).
3. Set `TECHTO_REPOSITORY_PROVIDER=mongo` so Backboard tools read from Atlas.
4. Verify with `npm run mongo:status`.

Offline/CI: leave `TECHTO_REPOSITORY_PROVIDER=fixture` (default in tests).

## What agents read

`MongoTransitRepository` warms from Atlas collections:

- `places`, `transit_routes`, `transit_stops`
- `neighbourhoods`, `citizen_cohorts`, `social_contexts`
- `transit_scenarios`, `stress_overlays`
- `events`, `incidents`, `similar_interventions`
- `latest_route_state`, `latest_city_state`

Tool outputs include `storageLayer: "mongodb"` when this provider is active.

## What agents write

On planning tool calls, the dispatcher persists:

- `simulation_runs`, `interventions`, `latest_stop_state` (`run_transit_simulation`)
- `policy_iterations`, `audit_events` (`save_policy_iteration`)
- `citizen_reactions` (`call_citizen_reaction_model`)
- `training_examples` (`create_training_examples`)
- `backboard_tool_calls` (every tool dispatch)

Planning SSE runs also append:

- `backboard_events` (each streamed lifecycle event)
- `backboard_threads` (run shell + final result)
- `policy_evaluations` (recommendation snapshot)

Operator Q&A turns append messages on `backboard_threads` (`kind: operator-qa`).

## Search and ingest

| Command | Purpose |
| --- | --- |
| `npm run mongo:ingest` | Offline ingest pipeline: seeds Atlas from the `src/data/transit` fixtures |

The `policy_accepted` audit bundle, `/api/mongo/*` run, search, and
change-stream endpoints described in the spec are not implemented in this
repository.

Atlas Search / Vector index definitions: `atlas/search-indexes.json`
(create in Atlas UI; app falls back to regex if the search index is absent).

## Collection catalog

See `docs/techto-implementation.md` §14 for the full Atlas collection list,
time-series names, geospatial/search/vector intent, and transaction rules.
Core hackathon path uses normal collections plus seeded fixtures.
