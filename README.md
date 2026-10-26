# TechTO: Toronto planning decision support

> "the Claude Code of city planning"

TechTO is a decision-support workspace for City of Toronto planners. It
combines a conversational planning agent, an interactive MapLibre city view, a
versioned city twin, and a population-opinion simulator. Planners can explore
Toronto, propose and compare interventions, update the map, and examine a
simulated distribution of day-one resident acceptance, with a written opinion
behind each sampled resident.

## Features

- **Landing page** at `/` linking into the planning workspace at `/city`.
- **Planning workspace** (`/city`): a MapLibre map of Toronto neighbourhoods,
  TTC routes, streets, and residential sites, with a chat bar driving the
  Planning Orchestrator.
- **Planning Orchestrator** (`src/lib/planner/orchestrator.ts`,
  `POST /api/planner/run` and `POST /api/planner/stream`): a free-form Backboard
  agent that can answer directly or use twin tools to query, patch, snapshot,
  analyze, and diff Toronto data, and call planning, equity, feasibility,
  citizen-response, evidence, and review specialists. It returns
  recommendations and map actions.
- **Citizen-reaction simulator** (`src/lib/citizen-reaction`): samples real
  resident personas and asks a fine-tuned opinion model for first-person
  reactions, aggregated into neighbourhood and citywide acceptance
  distributions (`/api/neighbourhood-acceptance`).
- **Run history**: past runs are stored in the browser's localStorage and can
  be revisited read-only at `/simulation/[simulationId]`.
- **PDF export** of individual answers and full conversations.
- **Python research pipeline** for census ingest, persona generation, model
  training (SFT and GRPO), and evaluation.

## Interpretation limits

TechTO estimates simulated day-one acceptance, not real public opinion or public
consultation. It does not predict ridership, emissions, congestion, land value,
or financial returns unless those outcomes are supplied by separate validated
models and evidence. Acceptance is presented as a distribution with uncertainty,
not as a single authoritative forecast. See [AGENTS.md](AGENTS.md).

## Models and cloud services

| Layer | Model or service | Responsibility |
| --- | --- | --- |
| Planning agent | Claude Fable 5 (`claude-fable-5`) through Backboard | Reasons about the request, selects tools, coordinates specialists, and explains recommendations. Model selection is capability-based at runtime with Anthropic first in provider preference order. |
| Population opinion model | Fine-tuned Qwen3.5-9B LoRA through FreeSolo Flash and Modal | Writes first-person opinions for sampled resident personas and supports the day-one acceptance distribution. |
| Shared data | MongoDB Atlas, optional | Stores resident personas and, when `TECHTO_REPOSITORY_PROVIDER=mongo`, shared transit data. Local fixtures remain available for development and tests. |
| Map tiles | CARTO Dark Matter | Supplies the MapLibre basemap (style URL set in `src/components/dashboard/MapCanvas.tsx`). |

Backboard is live only: there is no mock Backboard adapter.

## Tech stack

- **Web app:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS,
  MapLibre GL JS, Zustand, Zod, Framer Motion, react-markdown,
  `@huggingface/transformers`, MongoDB Node driver.
- **Testing:** Vitest, Testing Library, Playwright.
- **Python (research and data):** Python 3.12 managed with `uv`; pandas,
  GeoPandas, scikit-learn, statsmodels, sentence-transformers, PopGen3,
  PyMongo; pytest and Ruff.
- **Optional service:** FastAPI stub under `services/transit-core`.

## Project structure

```text
src/app/              Next.js routes: /, /city, /simulation/[simulationId], /api/*
src/components/       Dashboard, map, chat, planner, landing, and shared UI
src/lib/planner/      Planning Orchestrator
src/lib/backboard/    Backboard client, assistant roster, and tools
src/lib/citizen-reaction/  Persona sampling and acceptance scoring
src/lib/mongodb/      Atlas client, collections, and repositories
src/lib/transit/      Transit simulator, schemas, and fixture repository
src/data/             Local transit fixtures
public/data/          Generated Toronto map layers (see scripts/data/README.md)
scripts/              Backboard and MongoDB admin scripts; scripts/data map builders
data/  population/  twin/  model/  eval/  analysis/   Python research pipeline
services/transit-core/  FastAPI stub (see its README)
tests/                Vitest (*.test.ts) and pytest (test_*.py) suites
docs/                 Backboard, architecture, and archived design notes
```

## Prerequisites

- Node.js 20 and npm
- For the Python pipeline: [uv](https://docs.astral.sh/uv/) (installs Python 3.12
  from `.python-version`)
- Live credentials for the services you use: Backboard (planning), FreeSolo
  (resident opinions), MongoDB Atlas (optional)

## Setup and run

```bash
npm install
cp .env.example .env.local   # then fill in the keys you need
npm run dev
```

Open `http://localhost:3000` and enter the workspace at `/city`.

Python pipeline:

```bash
uv sync
uv run pytest
```

Some pytest suites need generated files under `data/processed/` (for example
`uv run python -m data.ingest_wikipedia_narratives`) and fail until those
inputs exist.

## Environment variables

See [.env.example](.env.example) for defaults and comments. Keep every key
server-side; never expose one through a `NEXT_PUBLIC_` variable.

| Variable | Purpose |
| --- | --- |
| `BACKBOARD_API_KEY` | Required. Live Backboard planning agent and admin scripts. |
| `BACKBOARD_API_BASE_URL` | Backboard API base URL. |
| `TECHTO_CITIZEN_REACTION_PROVIDER` | `real-opinion` (default) or `freesolo` (legacy rollback path). |
| `FREESOLO_API_KEY`, `FREESOLO_BASE_URL` | FreeSolo/Modal endpoint for resident-opinion inference. |
| `FREESOLO_REACTION_MODEL_ALIAS`, `FREESOLO_TIMEOUT_SECONDS` | Model alias and timeout for the legacy `freesolo` provider. |
| `TECHTO_OPINION_MODEL_ALIAS` | Deployed opinion model used by `real-opinion`. |
| `TECHTO_OPINION_SAMPLE_SIZE`, `TECHTO_OPINION_MAX_SAMPLE_SIZE`, `TECHTO_OPINION_CONCURRENCY` | Personas sampled per archetype, adaptive ceiling, and concurrency limit. |
| `TECHTO_POLICY_BATCH_SIZE`, `TECHTO_POLICY_MIN_SAMPLE_SIZE`, `TECHTO_POLICY_MAX_SAMPLE_SIZE`, `TECHTO_POLICY_CI_TARGET` | Adaptive sampling for citywide acceptance. |
| `TECHTO_NEIGHBOURHOOD_SAMPLE_SIZE` | Residents sampled per neighbourhood for `/api/neighbourhood-acceptance`. |
| `TECHTO_REPOSITORY_PROVIDER` | `fixture` (local data, default) or `mongo` (Atlas). |
| `MONGODB_URI`, `MONGODB_URI_READONLY`, `MONGODB_DATABASE` | Atlas connection, optional read-only connection, and database name. |
| `MONGODB_SEARCH_INDEX`, `MONGODB_VECTOR_INDEX` | Atlas Search and Vector Search index names. |
| `NEXT_PUBLIC_TRANSIT_API_BASE_URL` | Optional; read only by the `services/transit-core` stub. |
| `OPENROUTER_API_KEY`, `TECHTO_LLM_BASE_URL`, `TECHTO_LLM_API_KEY`, `TECHTO_LLM_MODEL` | Python research tooling (judges, serving, evaluation). |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server. |
| `npm run build` / `npm run start` | Production build and server. |
| `npm run lint` | ESLint. |
| `npm run typecheck` | TypeScript `tsc --noEmit`. |
| `npm test` / `npm run test:watch` | Vitest unit tests. |
| `npm run test:backboard` | Vitest suites under `tests/backboard`. |
| `npm run test:e2e` | Playwright (builds and serves on port 3005; specs live in `e2e/`). |
| `npm run check` | Lint, typecheck, unit tests, and production build. |
| `npm run backboard:bootstrap` / `backboard:status` / `backboard:smoke` | Create, inspect, and smoke-test the live Backboard roster. |
| `npm run backboard:consolidate-roster` / `backboard:cleanup-gridtwin` | One-off Backboard roster maintenance. |
| `npm run mongo:bootstrap` / `mongo:status` / `mongo:ingest` | Create Atlas collections and indexes, check status, and seed transit fixtures. |

Backboard and MongoDB scripts require their live credentials.

## Data

- Neighbourhood boundaries and profile indicators cover all 158 City of
  Toronto neighbourhoods using 2021 Census data.
- Subway, LRT, streetcar, and bus geometry is prepared from official TTC GTFS.
- The web app prefers resident personas from MongoDB and uses local synthetic
  display fixtures when that repository is unavailable.
- Population research inputs and preparation code live under `data/`,
  `population/`, and `scripts/data/`. Generated map inputs live under
  `public/data/` ([provenance](scripts/data/README.md)).

## Further documentation

- [AGENTS.md](AGENTS.md): modeling boundaries, data provenance, conventions
- [docs/backboard/](docs/backboard/): assistant roster, tools, orchestration
- [docs/architecture/](docs/architecture/): MongoDB Atlas and optimizer status
- [services/transit-core/README.md](services/transit-core/README.md): FastAPI stub
