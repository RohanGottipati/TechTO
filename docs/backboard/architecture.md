# TwinTO Backboard architecture

TwinTO is a 2D Toronto transit digital twin demo. A virtual planning
department on Backboard proposes schedule interventions for a synthetic
flagship scenario (16:06 / 16:12 load imbalance at Union Station), scores
them with a labelled mock CitizenReactionLM, and evaluates them with a
deterministic local simulator.

This document describes the Backboard branch product. It is separate from
the ToronTwin research spine in `AGENTS.md`. GridTwin battery docs live
under `docs/archive/gridtwin/`.

## Layers

```
+-----------------------------------------------------------+
| WEB UI (MapLibre 2D + TwinTOAppShell)                      |
| Toronto map, scenario playback, agent council, policies   |
+-----------------------------------------------------------+
| BACKBOARD VIRTUAL PLANNING DEPARTMENT                     |
| 54 named assistants; flagship run activates ~19-24        |
+-----------------------------------------------------------+
| LOCAL DETERMINISTIC TRANSIT SIMULATOR                     |
| minute ticks, queues, boarding, stress tests              |
+-----------------------------------------------------------+
| PROVIDER BOUNDARIES (mock on this branch)                 |
| CitizenReactionProvider | TransitRepository               |
+-----------------------------------------------------------+
```

## What this branch requires

- `BACKBOARD_API_KEY` for live mode; without it, mock mode is automatic
- Local synthetic fixtures under `src/data/transit/`
- No MongoDB, FreeSolo, or Cesium credentials

## Mock vs live

| Concern | Mock | Live |
| --- | --- | --- |
| Backboard assistants | `MockBackboardAdapter` | Rest API |
| Citizen reactions | `MockCitizenReactionProvider` | FreeSolo later |
| Transit data | `FixtureTransitRepository` | Mongo later |
| Simulation | Always local, deterministic | Always local |

UI badges must label mock Backboard, mock CitizenReactionLM, and
`synthetic-fixture` data. Never present fixture numbers as real TTC
measurements or mock reactions as real public opinion.

## Orchestration stages

```
run.started
problem -> baseline -> context (parallel)
policy.generated
citizens -> simulation -> impact (parallel)
stress -> debate
recommendation.ready -> operator.ready
run.completed
```

Final authority is deterministic: unsafe platform crowding, impossible
schedules, accessibility failures, infeasible capacity, malformed
simulation, or missing evidence override the judge.

## Assistant bundles

- `CORE_SCHEDULE_BUNDLE`: flagship schedule analysis (~19 roles)
- `CONCERT_BUNDLE`: event / safety stress roles
- `WEATHER_BUNDLE`: weather / surface-transit roles

Do not call all 54 assistants on every run. Use `selectAssistantBundle`.

## Key paths

| Path | Role |
| --- | --- |
| `src/lib/backboard/` | Adapter, roster, tools, orchestrator, SSE |
| `src/lib/transit/` | Simulator, metrics, ranker, repository |
| `src/lib/citizen-reaction/` | Provider boundary + mock |
| `src/data/transit/` | Synthetic fixtures |
| `src/components/map/` | MapLibre Toronto map |
| `src/components/twinto/` | Product UI |
| `docs/backboard/knowledge/` | Indexed transit knowledge docs |
| `docs/archive/gridtwin/` | Archived battery product docs |

## Scripts

```bash
npm run backboard:bootstrap          # create TwinTO assistants + upload docs
npm run backboard:status             # roster / mode status
npm run backboard:smoke              # live smoke (needs API key)
npm run backboard:cleanup-gridtwin   # dry-run list of old GridTwin assistants
npm run backboard:cleanup-gridtwin -- --confirm   # delete them
```

Cleanup requires `--confirm`. Create TwinTO assistants and verify smoke
before deleting GridTwin ones.
