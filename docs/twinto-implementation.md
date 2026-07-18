# TwinTO — Full Implementation Specification

> **Repository:** `https://github.com/RohanGottipati/Twin`  
> **Working product name:** TwinTO  
> **Product:** AI Citizens for Adaptive Toronto Transit  
> **Primary demo:** correct the 4:06 PM / 4:12 PM departure imbalance, then stress-test the recommendation against a concert, incident, weather, and capacity disruption  
> **Primary sponsor track:** Deloitte — AI for Green / Green AI  
> **Required platforms:** Backboard, MongoDB Atlas, FreeSolo  
> **Map:** 2D Toronto transit digital twin built with MapLibre GL JS  
> **Status of existing code:** the repository currently contains a Cesium-based 3D world UI and, on the `backboard` branch, a battery-control implementation called GridTwin. This specification replaces that product entirely.

---

## 0. Instructions to the implementation agent

This file is the authoritative product and engineering specification. Implement the system, not merely another plan.

Before changing code:

1. Inspect Git state and preserve user work.
2. Read:
   - `README.md`
   - `AGENTS.md`
   - `implementation.md`
   - `package.json`
   - `src/app`
   - `src/components`
   - `src/lib/backboard`
   - `src/lib/grid`
   - `src/lib/gridtwin`
   - `src/components/grid`
   - `src/data/grid`
   - `docs/backboard`
   - all tests and Playwright files.
3. Run the current baseline:
   ```bash
   npm install
   npm run check
   npm run test:e2e
   ```
4. Record baseline results before rewriting the product.
5. Archive the old battery project instead of pretending it never existed:
   ```text
   docs/archive/gridtwin/
   ```
6. Replace all visible GridTwin/battery terminology with TwinTO/transit terminology.
7. Delete or archive battery-only code that has no reusable value.
8. Preserve generic, tested Backboard infrastructure where it remains useful:
   - API adapter
   - server-only client
   - model capability discovery
   - assistant manifest handling
   - document indexing/polling
   - multi-round tool loop
   - SSE utilities
   - stream parser
   - rate limiting
   - mock/live provider boundary.
9. Replace Cesium with MapLibre GL JS. The final product has no 3D globe, no OSM 3D buildings, no building-selection drawer, and no Cesium token requirement.
10. Do not copy private code or unverified performance claims from Skyline.
11. Never present simulated citizen reactions as real Toronto public opinion.
12. Never display unversioned or hardcoded impact metrics as simulation results.
13. Never expose MongoDB, Backboard, FreeSolo, or model-provider credentials to the browser.
14. Never expose private chain-of-thought.
15. Use deterministic simulation and constraint checks as the source of operational truth.
16. Backboard recommends interventions; FreeSolo predicts citizen responses; MongoDB stores and streams state; the simulator calculates outcomes; PPO optimizes numeric policy parameters.
17. Work phase by phase, test after every phase, commit logical checkpoints, and do not report completion while required checks fail.

---

# 1. Product definition

## 1.1 One-sentence definition

TwinTO is a living 2D digital twin of Toronto in which weighted AI citizen cohorts travel through buses, streetcars, subways, roads, walking routes, and cycling routes, allowing a virtual Backboard transit-planning department to test schedule and service changes before recommending them.

## 1.2 The concrete problem

A transit timetable can be technically frequent while still being badly aligned with when riders arrive.

Example:

```text
Current service:
16:06 departure
16:12 departure

Observed arrival pattern:
16:06 leaves underused
16:07–16:11 receives most passenger arrivals
16:12 becomes overcrowded
```

Candidate intervention:

```text
Move 16:06 to 16:08
Move 16:12 to 16:13
```

TwinTO must determine:

- how many riders shift to the 16:08 departure;
- whether the 16:13 departure remains overcrowded;
- whether transfer connections are broken;
- whether some riders change departure time;
- whether riders remain on transit or choose a car;
- whether crowding moves downstream;
- whether a concert or incident makes the change unsafe;
- whether the change improves waiting time, reliability, accessibility, equity, emissions, and operating feasibility.

## 1.3 Core loop

```text
MongoDB detects or stores a transit-demand mismatch
        ↓
Backboard defines the planning problem
        ↓
Backboard specialists collect evidence in parallel
        ↓
Backboard proposes multiple interventions
        ↓
FreeSolo CitizenReactionLM predicts cohort responses
        ↓
Deterministic transit simulator reruns Toronto
        ↓
MongoDB stores and streams the resulting city state
        ↓
Backboard specialists critique safety, cost, equity, and reliability
        ↓
PPO or bounded search tunes schedule parameters
        ↓
Backboard recommends proceed, revise, reject, or gather more evidence
```

## 1.4 Intended users

- TTC planners
- Transit scheduling teams
- City transportation planners
- Operations control staff
- Accessibility and equity analysts
- Event and emergency planners
- Sustainability teams
- Researchers and policy teams

## 1.5 Allowed claims

TwinTO may claim that it:

- creates a simulated Toronto transit digital twin;
- models weighted citizen cohorts derived from public demographic and mobility data;
- predicts simulated reactions to schedule changes;
- compares alternative policies through a deterministic simulator;
- uses Backboard to coordinate a virtual planning department;
- uses FreeSolo to train a specialized citizen-reaction model;
- uses MongoDB Atlas as the operational, geospatial, time-series, streaming, vector, and analytics layer;
- estimates mobility, crowding, equity, cost, and carbon outcomes;
- demonstrates Green AI through smaller specialist models, batching, caching, and model routing.

## 1.6 Prohibited claims

Do not claim that:

- simulated reactions are real public consultation;
- the model represents every Toronto resident;
- the system controls the TTC;
- it provides certified safety advice;
- it has proven a specific reduction in car use or emissions before the simulator produces that result;
- it reproduces Skyline’s private implementation;
- it guarantees real-world ridership changes.

---

# 2. Flagship demonstration

## 2.1 Baseline scenario

Use a configurable fictional or clearly labelled demo station/corridor unless exact TTC stop-level passenger arrival data is available and licensed.

```text
Departure A: 16:06
Departure B: 16:12
Vehicle capacity: configurable
Passenger arrivals:
  16:00–16:06: low
  16:07–16:11: concentrated
  16:12 onward: moderate
```

The baseline must visibly show:

- the 16:06 vehicle leaving underused;
- passengers accumulating after it leaves;
- the 16:12 vehicle boarding most passengers;
- platform crowding;
- increased waiting;
- missed boarding when capacity is exceeded.

## 2.2 Backboard proposals

Generate at least four alternatives:

```text
A. 16:08 and 16:12
B. 16:08 and 16:13
C. 16:06 and 16:10
D. Keep train times but retime a feeder bus or streetcar
E. Add event-only supplemental service
```

## 2.3 Citizen response

For each affected weighted cohort, CitizenReactionLM returns:

- mode before and after;
- chosen route;
- departure-time shift;
- wait tolerance;
- boarding choice;
- transfer choice;
- trip cancellation;
- car-to-transit or transit-to-car probability;
- policy support score;
- reason codes;
- confidence;
- model revision.

## 2.4 Simulation comparison

Display only computed values:

- passengers by departure;
- load factor;
- average and percentile waiting time;
- denied boardings;
- missed transfers;
- end-to-end travel time;
- platform crowding;
- car trips;
- estimated emissions;
- accessibility impact;
- equity gap;
- operating cost proxy;
- reliability under delay;
- simulated policy support.

## 2.5 Extenuating circumstances

The final demo must inject a combined event:

```text
Concert release near downtown
+ 25% passenger surge
+ one entrance closed
+ selected departure delayed by 3 minutes
+ connecting streetcar delayed
```

Backboard must either revise or reject a brittle schedule.

---

# 3. Target architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│                     Next.js TwinTO Web App                         │
│                                                                    │
│ MapLibre 2D map     Scenario Lab       Policy Comparison            │
│ Transit playback   Agent Council      Citizen Reaction Explorer     │
│ Event overlays     Timeline           Operator/Public summaries     │
└──────────────────────────────┬─────────────────────────────────────┘
                               │ HTTPS + SSE/WebSocket
                               ▼
┌────────────────────────────────────────────────────────────────────┐
│                   FastAPI Transit Core Service                    │
│                                                                    │
│ GTFS ingestion       Citizen cohort builder   Transit simulator     │
│ Intervention API     Backboard orchestrator   FreeSolo client       │
│ PPO environment      Metrics/evaluation       Mongo repositories    │
│ Safety constraints   Event engine             Training curator      │
└──────────────┬─────────────────────┬────────────────────┬───────────┘
               │                     │                    │
               ▼                     ▼                    ▼
┌──────────────────────┐  ┌────────────────────┐  ┌──────────────────┐
│   MongoDB Atlas      │  │    Backboard       │  │     FreeSolo     │
│                      │  │                    │  │                  │
│ Operational docs     │  │ 54 assistants      │  │ CitizenRoutineLM │
│ Time series          │  │ Persistent threads │  │ CitizenReactionLM│
│ Geospatial           │  │ RAG + memory       │  │ SFT / OPD / GRPO │
│ Search               │  │ Tools              │  │ Deployment       │
│ Vector Search        │  │ Parallel/chained   │  │ Structured JSON  │
│ Stream Processing    │  │ Model routing      │  │ Evaluation       │
│ Change Streams       │  │ Streaming          │  │                  │
│ Triggers/Charts      │  │ Web/files/voice    │  │                  │
└──────────────────────┘  └────────────────────┘  └──────────────────┘
```

---

# 4. Technology stack

## Frontend

- Next.js App Router
- React
- TypeScript strict mode
- Tailwind CSS
- MapLibre GL JS
- Framer Motion
- Zustand for local UI state only
- TanStack Query for server data
- Zod for runtime validation
- Recharts for charts
- deck.gl optional only when MapLibre layers cannot handle the required agent volume
- Vitest and React Testing Library
- Playwright

Install:

```bash
npm remove cesium
npm install maplibre-gl @tanstack/react-query zod recharts
```

Keep `framer-motion`, `zustand`, and `lucide-react` when already installed.

## Backend

- Python 3.12
- FastAPI
- Pydantic v2
- PyMongo async API or Motor only if required by the selected driver version
- NumPy
- Pandas
- SciPy
- NetworkX
- Gymnasium
- Stable-Baselines3
- OR-Tools or CVXPY for deterministic baselines
- Shapely
- GeoPandas for offline preprocessing
- httpx
- SSE-Starlette
- structlog
- pytest
- Hypothesis

## Mapping

Use MapLibre GL JS because it renders interactive vector-tile and GeoJSON maps in the browser and supports reusable sources and layers.

Default style:

```env
NEXT_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/bright
```

Allow replacement through environment configuration.

Always preserve required map data attribution.

---

# 5. Repository migration

## 5.1 Remove or archive Cesium

Archive documentation describing the old world UI.

Delete:

```text
src/components/world/
src/lib/cesium/
src/config/cities/
scripts/copy-cesium-assets.mjs
public/cesium/
```

Remove:

- Cesium package
- `NEXT_PUBLIC_CESIUM_ION_TOKEN`
- Cesium asset-copy scripts
- 3D building tests
- world camera tests
- building-selection UI.

Do not leave dead imports.

## 5.2 Archive GridTwin battery implementation

Move old design documents to:

```text
docs/archive/gridtwin/
```

Delete or replace:

```text
src/data/grid/
src/lib/grid/
src/lib/gridtwin/
src/components/grid/
src/app/control/[assetId]/
docs/backboard/knowledge/*battery*
docs/backboard/knowledge/*renewable*
docs/backboard/knowledge/*market-context*
```

Reuse only generic Backboard infrastructure.

## 5.3 Final repository structure

```text
/
├── AGENTS.md
├── implementation.md
├── README.md
├── package.json
├── docker-compose.yml
├── Makefile
├── .env.example
├── docs/
│   ├── architecture/
│   │   ├── system-overview.md
│   │   ├── map-and-playback.md
│   │   ├── transit-simulator.md
│   │   ├── citizen-model.md
│   │   ├── backboard-council.md
│   │   ├── mongodb-atlas.md
│   │   ├── ppo-optimizer.md
│   │   └── ethics-and-limitations.md
│   ├── demo/
│   │   ├── demo-script.md
│   │   ├── fallback-plan.md
│   │   └── demo-data-provenance.md
│   ├── backboard/
│   │   ├── assistants.md
│   │   ├── tools.md
│   │   ├── orchestration.md
│   │   ├── memory-and-rag.md
│   │   └── knowledge/
│   └── archive/gridtwin/
│
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── simulation/[simulationId]/page.tsx
│   │   ├── policies/page.tsx
│   │   ├── models/page.tsx
│   │   ├── api/
│   │   │   └── proxy/
│   │   ├── layout.tsx
│   │   ├── error.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── map/
│   │   │   ├── TorontoMapClient.tsx
│   │   │   ├── TorontoMap.tsx
│   │   │   ├── TransitRouteLayers.tsx
│   │   │   ├── StopLayer.tsx
│   │   │   ├── VehicleLayer.tsx
│   │   │   ├── CitizenDensityLayer.tsx
│   │   │   ├── CrowdHeatmapLayer.tsx
│   │   │   ├── EventZoneLayer.tsx
│   │   │   ├── InterventionDiffLayer.tsx
│   │   │   └── MapLegend.tsx
│   │   ├── shell/
│   │   │   ├── TwinTOAppShell.tsx
│   │   │   ├── TopNavigation.tsx
│   │   │   └── ResponsivePanels.tsx
│   │   ├── simulation/
│   │   │   ├── PlaybackControls.tsx
│   │   │   ├── SimulationTimeline.tsx
│   │   │   ├── DepartureLoadChart.tsx
│   │   │   ├── PassengerArrivalChart.tsx
│   │   │   ├── WaitTimeChart.tsx
│   │   │   ├── MetricsGrid.tsx
│   │   │   └── CohortReactionExplorer.tsx
│   │   ├── policies/
│   │   │   ├── ProblemDefinitionPanel.tsx
│   │   │   ├── InterventionBuilder.tsx
│   │   │   ├── CandidatePolicyCard.tsx
│   │   │   ├── PolicyComparison.tsx
│   │   │   ├── StressTestPanel.tsx
│   │   │   └── FinalPolicyRecommendation.tsx
│   │   ├── agents/
│   │   │   ├── AgentCouncil.tsx
│   │   │   ├── DepartmentGroup.tsx
│   │   │   ├── AgentEventTimeline.tsx
│   │   │   ├── ToolCallCard.tsx
│   │   │   ├── DebatePanel.tsx
│   │   │   └── EvidenceDrawer.tsx
│   │   └── shared/
│   ├── lib/
│   │   ├── map/
│   │   │   ├── map-config.ts
│   │   │   ├── layer-ids.ts
│   │   │   ├── geojson.ts
│   │   │   └── animation.ts
│   │   ├── api/
│   │   ├── backboard/
│   │   │   ├── adapter.ts
│   │   │   ├── client.ts
│   │   │   ├── assistants.ts
│   │   │   ├── departments.ts
│   │   │   ├── model-router.ts
│   │   │   ├── tools.ts
│   │   │   ├── tool-dispatcher.ts
│   │   │   ├── run-tool-loop.ts
│   │   │   ├── orchestrator.ts
│   │   │   ├── memory.ts
│   │   │   ├── knowledge-upload.ts
│   │   │   ├── sse.ts
│   │   │   └── mock-adapter.ts
│   │   └── twinto/
│   │       ├── schemas.ts
│   │       ├── run-history.ts
│   │       └── stream-client.ts
│   ├── store/
│   │   ├── useMapStore.ts
│   │   └── useSimulationUiStore.ts
│   └── types/
│
├── services/transit-core/
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── api/
│   │   ├── db/
│   │   ├── ingestion/
│   │   ├── cohorts/
│   │   ├── simulation/
│   │   ├── optimization/
│   │   ├── backboard/
│   │   ├── freesolo/
│   │   ├── evaluation/
│   │   └── training/
│   ├── scripts/
│   └── tests/
│
├── training/freesolo/
│   ├── environment.py
│   ├── reward.py
│   ├── schemas.py
│   ├── configs/
│   ├── datasets/
│   ├── scripts/
│   └── tests/
│
├── data/
│   ├── raw/
│   ├── normalized/
│   ├── cache/
│   └── fixtures/
│
├── tests/
└── e2e/
```

---

# 6. Environment variables

```env
# Frontend
NEXT_PUBLIC_TRANSIT_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_MAP_STYLE_URL=https://tiles.openfreemap.org/styles/bright
NEXT_PUBLIC_DEMO_CITY=toronto

# Server
TWINTO_ENV=development
TWINTO_DEMO_MODE=true
TWINTO_USE_FIXTURES=true
TWINTO_ALLOWED_ORIGINS=http://localhost:3000
TWINTO_TIMEZONE=America/Toronto

# MongoDB Atlas
MONGODB_URI=
MONGODB_DATABASE=twinto
MONGODB_SEARCH_INDEX=twinto-search
MONGODB_VECTOR_INDEX=twinto-memory-vector
MONGODB_STREAM_WORKSPACE=
MONGODB_STREAM_PROCESSOR=

# Backboard
BACKBOARD_API_KEY=
BACKBOARD_API_BASE_URL=https://app.backboard.io/api
BACKBOARD_MOCK_MODE=false
BACKBOARD_ENABLE_WEB_SEARCH=false
BACKBOARD_ENABLE_VOICE=false

# FreeSolo
FREESOLO_API_KEY=
FREESOLO_BASE_URL=
FREESOLO_ROUTINE_MODEL_ALIAS=twinto-citizen-routine
FREESOLO_REACTION_MODEL_ALIAS=twinto-citizen-reaction
FREESOLO_REACTION_MODEL_REVISION=
FREESOLO_TIMEOUT_SECONDS=45

# Demo
DEMO_SCENARIO_ID=departure-406-412
DEMO_SEED=20260718
DEMO_SIMULATION_DATE=2026-07-18
DEMO_START_TIME=15:45
DEMO_END_TIME=16:30
```

No server secret may use `NEXT_PUBLIC_`.

---

# 7. 2D map implementation

## 7.1 Initial view

```ts
export const TORONTO_VIEW = {
  center: [-79.3832, 43.6532] as [number, number],
  zoom: 12.8,
  bearing: 0,
  pitch: 0,
};
```

## 7.2 Required layers

Render in this order:

1. base map;
2. neighbourhood polygons;
3. road congestion;
4. subway lines;
5. streetcar lines;
6. bus lines;
7. event zones;
8. station crowd heatmap;
9. stops and stations;
10. vehicles;
11. citizen density;
12. selected agents or cohorts;
13. intervention diff;
14. labels and annotations.

## 7.3 Map sources

Use GeoJSON for the hackathon scope.

For high-volume playback:

- group citizens into weighted cohort tiles;
- render density or cluster layers rather than thousands of DOM markers;
- update a single GeoJSON source with `setData`;
- keep vehicles as symbols;
- use vector tiles or deck.gl only if performance testing requires it.

## 7.4 User interactions

- click route to inspect schedule;
- click stop to inspect arrivals, queues, and departures;
- click vehicle to inspect load;
- click density cell to inspect cohorts;
- select baseline or intervention;
- scrub time;
- play, pause, speed up;
- toggle events, crowding, citizens, routes, cars, and emissions;
- fit map to selected policy impact.

## 7.5 Performance

- no React state update for every animation frame;
- throttle map-state updates;
- use worker-friendly GeoJSON;
- aggregate citizen visualization;
- cap visible individual agents;
- preload demo route data;
- use requestAnimationFrame only for playback interpolation.

---

# 8. Data sources and ingestion

## 8.1 Required inputs

- TTC GTFS static:
  - routes
  - trips
  - stops
  - stop_times
  - shapes
  - calendar
  - frequencies where present.
- TTC GTFS-Realtime:
  - vehicle positions
  - trip updates
  - service alerts.
- Toronto open delay datasets:
  - bus delays
  - streetcar delays
  - subway delays.
- Toronto neighbourhood profiles.
- Statistics Canada Census variables.
- road and pedestrian network from OpenStreetMap extracts.
- event fixtures or public event listings.
- weather fixtures, with optional live context.
- synthetic minute-level passenger arrivals for the flagship demonstration.

## 8.2 Offline-first rule

The judged demo must not depend on a live feed.

Commit normalized fixtures:

```text
data/fixtures/toronto-core-network.json
data/fixtures/departure-406-412.json
data/fixtures/concert-surge.json
data/fixtures/weather-snow.json
data/fixtures/service-incident.json
data/fixtures/cohorts-demo.json
```

Every data record must include provenance:

```json
{
  "sourceType": "official|derived|synthetic",
  "sourceName": "string",
  "sourceUrl": "string or null",
  "retrievedAt": "ISO timestamp or null",
  "transformationVersion": "string",
  "syntheticFields": ["..."]
}
```

## 8.3 Ingestion pipeline

```text
download
→ checksum raw file
→ persist source metadata
→ parse
→ normalize timezone
→ validate IDs and units
→ deduplicate
→ map to internal schema
→ load MongoDB
→ create demo snapshot
```

---

# 9. Citizen cohorts

## 9.1 Weighted representation

Do not run one LLM call per Toronto resident.

A cohort represents statistically similar citizens:

```json
{
  "cohortId": "cohort-104",
  "weight": 46,
  "homeZoneId": "zone-liberty-village",
  "primaryDestinationZoneId": "zone-financial-district",
  "ageBand": "25-34",
  "incomeBand": "middle",
  "occupationGroup": "professional-services",
  "workSchedule": "standard",
  "vehicleAccessProbability": 0.63,
  "transitPassProbability": 0.71,
  "scheduleFlexibility": 0.30,
  "crowdingTolerance": 0.42,
  "walkingToleranceMinutes": 14,
  "mobilityNeeds": [],
  "baselineModeDistribution": {
    "transit": 0.58,
    "car": 0.28,
    "walk": 0.08,
    "cycle": 0.06
  }
}
```

## 9.2 Ethical constraints

- demographic features inform calibration, not moral worth;
- no protected attribute should create discriminatory service recommendations;
- aggregate results by cohort;
- avoid generated biographies that intensify stereotypes;
- model uncertainty;
- include an equity auditor;
- document synthetic assumptions;
- never call model outputs “what Torontonians think.”

## 9.3 Social context

Store compact network summaries:

```json
{
  "peerTransitAdoption": 0.72,
  "householdVehicleAvailability": 0.50,
  "coworkerDepartureConcentration": "16:05-16:12",
  "neighbourhoodPolicySupport": 0.64,
  "recentDelayExperienceCount": 2
}
```

---

# 10. FreeSolo citizen models

## 10.1 Model family

```text
CitizenRoutineLM
CitizenReactionLM — flagship
CitizenDisruptionLM — optional adapter
CitizenSentimentLM — optional adapter
```

## 10.2 CitizenReactionLM input

```json
{
  "schemaVersion": 1,
  "cohort": {},
  "baselineJourney": {},
  "intervention": {},
  "expectedLocalEffects": {},
  "socialContext": {},
  "eventContext": {},
  "availableAlternatives": [],
  "modelVisibleUncertainty": {}
}
```

## 10.3 Output schema

```json
{
  "schemaVersion": 1,
  "cohortId": "cohort-104",
  "previousMode": "car",
  "newMode": "transit",
  "selectedJourneyId": "journey-...",
  "departureShiftMinutes": -4,
  "waitToleranceMinutes": 6,
  "boardsTargetDeparture": true,
  "tripCancelled": false,
  "adoptionProbability": 0.61,
  "policySupport": 0.73,
  "reasonCodes": [
    "better_schedule_alignment",
    "lower_expected_wait"
  ],
  "confidence": 0.78,
  "warnings": []
}
```

Reject unknown reason codes or malformed output.

## 10.4 SFT

Generate SFT data from:

- public aggregate mode-share data;
- deterministic mode-choice rules;
- route-choice outputs;
- teacher-model examples;
- manually reviewed edge cases;
- simulator-consistent trajectories.

Teach:

- strict schema;
- realistic temporal decisions;
- correct alternative availability;
- response to crowding, wait, cost, transfer, accessibility, and events;
- calibrated uncertainty;
- no impossible journeys.

## 10.5 OPD

Warm-start from SFT.

Use a stronger teacher on:

- conflicting transfers;
- combined event disruptions;
- accessibility trade-offs;
- late-night journeys;
- ambiguous mode changes;
- social influence.

OPD is optional if time is limited, but the repository must include a valid configuration and evaluation path.

## 10.6 GRPO

The reward is evaluated at aggregate and individual-consistency levels.

```python
reward = (
    2.0 * schema_validity
    + 1.5 * journey_feasibility
    + 1.5 * demographic_calibration
    + 2.0 * aggregate_mode_share_fit
    + 2.0 * aggregate_arrival_flow_fit
    + 1.0 * response_consistency
    + 1.0 * uncertainty_calibration
    - 3.0 * impossible_journey
    - 2.0 * contradiction
    - 2.0 * stereotype_penalty
    - 1.0 * excessive_mode_switching
)
```

Malformed output receives a hard negative reward.

## 10.7 Evaluation split

Split by:

- dates;
- corridors;
- event types;
- cohort seeds.

Do not randomly split records from the same scenario across train and test.

## 10.8 Green AI

- weighted cohorts;
- batch similar cohorts;
- cache identical reaction contexts;
- use small specialist adapters;
- use deterministic movement;
- route rare cases to stronger models;
- measure tokens, latency, cost, cache hit rate, and valid reactions per dollar.

---

# 11. Deterministic transit simulator

## 11.1 Time resolution

Use one-minute ticks for the flagship demo.

Support configurable 15- or 30-second resolution later.

## 11.2 State

```text
current simulation time
vehicles and positions
scheduled arrivals/departures
stop queues
passenger cohort journeys
vehicle capacity
boarding/alighting
road travel time
transfer availability
event zones
station accessibility
service incidents
weather effects
```

## 11.3 Vehicle logic

Each vehicle has:

- route;
- trip;
- current segment;
- scheduled time;
- actual time;
- capacity;
- onboard cohort weights;
- dwell time;
- delay;
- status.

## 11.4 Passenger logic

Cohorts:

- arrive at stop;
- queue;
- board if capacity and accessibility permit;
- wait if denied;
- transfer;
- leave system;
- change route according to reaction model probabilities.

Use deterministic random seeds.

## 11.5 Safety constraints

Reject or heavily penalize:

- platform crowding above configured safe demo threshold;
- inaccessible journey for required mobility needs;
- capacity above hard crush threshold;
- infeasible vehicle or operator requirement;
- negative headway;
- impossible sequence;
- broken mandatory transfer protection;
- emergency closure traversal.

## 11.6 Metrics

```text
mean wait
P50/P90/P95 wait
denied boardings
load factor by departure
load imbalance
crowding duration
end-to-end travel time
missed transfers
on-time performance
headway regularity
car trips
vehicle kilometres
estimated emissions
accessibility failure count
equity gap
operating cost proxy
simulated policy support
```

## 11.7 Carbon estimate

Version and display assumptions.

Do not claim exact marginal emissions.

---

# 12. Transit optimization

## 12.1 Baselines

Implement:

1. no-change baseline;
2. heuristic schedule shift;
3. bounded exhaustive search for small windows;
4. OR-Tools or CVXPY schedule optimizer;
5. PPO policy.

## 12.2 PPO state

- minute-level arrival histogram;
- current departure times;
- vehicle loads;
- queues;
- transfer demand;
- event demand;
- delay probability;
- car-switch estimate;
- accessibility and equity metrics;
- operating budget.

## 12.3 Actions

For the flagship problem:

```text
shift departure A by -3 to +4 minutes
shift departure B by -3 to +4 minutes
hold departure by up to 3 minutes
retime feeder by -3 to +3 minutes
add event-only trip
```

## 12.4 Reward

```text
30% wait and travel-time improvement
20% crowding/load balance
15% reliability
15% equity/accessibility
10% estimated carbon benefit
5% simulated adoption
5% operating efficiency
```

Hard penalties:

- safety violation;
- inaccessible policy;
- infeasible fleet;
- severe missed connections;
- excessive operating cost;
- shifting harm without net benefit.

## 12.5 Separation of roles

Backboard chooses policy families and interprets results.

PPO tunes numeric parameters.

The deterministic simulator evaluates them.

---

# 13. Backboard virtual planning department

Create all 54 named assistants. Do not invoke every assistant on every run.

## Department A — Planning and orchestration

1. City Planning Orchestrator
2. Problem Definition Agent
3. Baseline Analyst
4. Intervention Generator
5. Iteration Manager
6. Evidence Auditor

## Department B — Passenger demand

7. Passenger Arrival Analyst
8. Origin-Destination Analyst
9. Peak Demand Analyst
10. Latent Demand Analyst
11. Schedule Flexibility Analyst
12. Social Influence Analyst

## Department C — TTC network

13. Subway Scheduling Agent
14. Streetcar Scheduling Agent
15. Bus Scheduling Agent
16. Transfer Coordination Agent
17. Fleet Capacity Agent
18. Platform Crowding Agent
19. Vehicle Crowding Agent
20. Reliability and Bunching Agent
21. Signal Priority Agent
22. Journey Continuity Agent

## Department D — Citizen response

23. Citizen Response Coordinator
24. Mode-Shift Agent
25. Waiting Behaviour Agent
26. Public Sentiment Agent
27. Accessibility Agent
28. Equity Agent
29. Shift Worker Agent
30. Night Service Agent

## Department E — Events and incidents

31. Concert and Event Agent
32. Weather Agent
33. Safety Agent
34. Service Incident Agent
35. Construction Agent
36. Emergency Rerouting Agent
37. Adversarial Stress-Test Agent

## Department F — Impact and feasibility

38. Carbon Impact Agent
39. Traffic Impact Agent
40. Operating Cost Agent
41. Infrastructure Feasibility Agent
42. Economic Productivity Agent
43. Policy Compliance Agent
44. Neighbourhood Impact Agent

## Department G — Decision and communication

45. Counterfactual Agent
46. Alternative Policy Agent
47. Devil’s Advocate Agent
48. Policy Debate Moderator
49. Final Policy Judge
50. TTC Operator Explanation Agent
51. Executive Summary Agent
52. Public Consultation Summary Agent
53. Memory Curator
54. Training Curator

## 13.1 Assistant configuration

Each assistant definition includes:

```ts
type AssistantDefinition = {
  key: string;
  name: string;
  department: string;
  description: string;
  systemPrompt: string;
  toolNames: string[];
  knowledgeDocuments: string[];
  memoryMode: "off" | "Readonly" | "Auto";
  modelProfile:
    | "fast"
    | "tools"
    | "structured"
    | "reasoning"
    | "vision"
    | "voice";
  thinking?: {
    enabled: boolean;
    effort: "low" | "medium" | "high";
    excludeReasoning: true;
  };
  eligibleScenarioTags: string[];
};
```

## 13.2 Dynamic activation

Core 4:06/4:12 run:

```text
Problem Definition
Baseline
Passenger Arrival
Origin-Destination
Subway Scheduling
Transfer Coordination
Platform Crowding
Vehicle Crowding
Reliability
Citizen Response Coordinator
Mode Shift
Waiting Behaviour
Accessibility
Equity
Operating Cost
Carbon
Evidence Auditor
Adversarial Stress Test
Final Policy Judge
```

Concert adds:

```text
Concert and Event
Night Service
Safety
Emergency Rerouting
Traffic Impact
```

Snow adds:

```text
Weather
Bus Scheduling
Streetcar Scheduling
Accessibility
Reliability
```

## 13.3 Backboard features to use

Implement meaningful use of:

- named assistant profiles;
- persistent threads;
- assistant-level documents;
- thread-level documents;
- message-level attachments;
- RAG evidence;
- Memory Lite/Pro where available;
- read-only planning memory;
- explicit curated memory;
- memory search and citations;
- parallel tool calls;
- chained multi-round tools;
- streaming;
- cancellation;
- model discovery;
- model routing;
- structured output;
- thinking controls;
- web search for current public context;
- file/spreadsheet/image input;
- optional voice operator interface;
- usage and model metadata;
- mock provider;
- assistant bootstrap/update/delete scripts.

## 13.4 Memory policy

```text
Planning: Readonly
Adversarial simulation: off
Approved lesson: explicit Memory Curator write
Unreviewed model output: never persisted
```

## 13.5 RAG documents

Upload by department:

- TTC service standards;
- accessibility policies;
- simulation methodology;
- citizen-model limitations;
- carbon methodology;
- event response playbook;
- route schedule documents;
- data provenance;
- policy evaluation rubric.

## 13.6 Tool catalogue

```text
get_network_snapshot
get_route_schedule
get_departure_loads
get_passenger_arrivals
get_origin_destination_flows
get_stop_crowding
get_transfer_demand
get_delay_history
get_vehicle_capacity
get_fleet_availability
get_neighbourhood_demographics
get_accessibility_constraints
get_event_context
get_weather_context
get_service_incidents
find_similar_interventions
propose_schedule_variants
call_citizen_reaction_model
aggregate_citizen_reactions
run_transit_simulation
calculate_wait_metrics
calculate_load_balance
calculate_reliability
calculate_equity
calculate_accessibility
calculate_operating_cost
calculate_carbon
stress_test_intervention
compare_interventions
save_policy_iteration
retrieve_policy_documents
write_approved_memory
create_training_examples
```

All tools use strict schemas and an allowlisted dispatcher.

## 13.7 Orchestration stages

```text
CREATED
→ PROBLEM_DEFINITION
→ BASELINE_ANALYSIS
→ CONTEXT_GATHERING
→ INTERVENTION_GENERATION
→ CITIZEN_REACTION
→ SIMULATION
→ IMPACT_REVIEW
→ STRESS_TEST
→ POLICY_DEBATE
→ FINAL_JUDGMENT
→ EXPLANATION
→ AWAITING_SIMULATED_APPROVAL
→ COMPLETED
```

---

# 14. MongoDB Atlas

## 14.1 Collections

```text
cities
neighbourhoods
transit_routes
transit_stops
transit_trips
transit_shapes
road_segments
places
citizen_cohorts
social_contexts
activity_plans
journey_templates
interventions
policy_iterations
simulation_runs
simulation_branches
citizen_reactions
policy_evaluations
events
incidents
backboard_assistants
backboard_threads
backboard_events
backboard_tool_calls
training_examples
model_versions
evaluation_runs
documents
document_chunks
audit_events
latest_city_state
latest_route_state
latest_stop_state
raw_ingest_events
stream_dead_letters
```

## 14.2 Time-series collections

```text
agent_positions_ts
vehicle_positions_ts
stop_load_ts
route_performance_ts
traffic_speed_ts
density_ts
emissions_ts
simulation_metrics_ts
```

## 14.3 Indexes

- unique IDs;
- route + service date;
- stop + timestamp;
- simulation + entity + timestamp;
- `2dsphere` on stops, neighbourhoods, routes, events;
- TTL for ephemeral branches;
- text/search and vector indexes;
- run sequence indexes.

## 14.4 Geospatial use

- cohorts within walking distance of stops;
- routes intersecting event zones;
- affected neighbourhoods;
- alternative stations;
- traffic effects around corridors.

## 14.5 Atlas Stream Processing

```text
raw vehicle/agent/event message
→ validate
→ normalize
→ geospatially enrich
→ compute rolling density
→ compute rolling headway
→ detect anomaly
→ write time-series
→ materialize latest state
→ emit planning trigger
```

## 14.6 Change Streams

- simulation progress to UI;
- new crowding anomaly starts policy workflow;
- Backboard event updates council timeline;
- completed iteration updates comparison;
- approved policy creates audit transaction.

## 14.7 Vector Search

Embed:

- policy descriptions;
- state summaries;
- citizen reaction summaries;
- congestion patterns;
- incidents;
- successful and failed trajectories.

## 14.8 Atlas Search

Search:

- routes;
- stops;
- incident types;
- policy documents;
- citizen reason codes;
- agent summaries;
- neighbourhoods.

## 14.9 Transactions

Accepting a policy iteration atomically writes:

- final status;
- metrics;
- model versions;
- Backboard recommendation;
- audit record;
- eligible training examples.

## 14.10 Triggers, Charts, archive

Use:

- scheduled evaluation summaries;
- stale-run cleanup;
- training curation;
- dashboard charts;
- Online Archive for old movement traces;
- Data Federation for archived simulations and external datasets.

Advanced Atlas features may require an eligible Atlas tier. Core development must still work with normal collections and fixtures.

---

# 15. API surface

```text
GET  /health
GET  /ready

GET  /v1/network
GET  /v1/routes
GET  /v1/routes/{routeId}
GET  /v1/stops/{stopId}
GET  /v1/stops/{stopId}/arrivals
GET  /v1/stops/{stopId}/crowding

GET  /v1/cohorts
GET  /v1/cohorts/{cohortId}

GET  /v1/scenarios
POST /v1/scenarios
GET  /v1/scenarios/{scenarioId}

POST /v1/policies/generate
GET  /v1/policies/{policyId}
POST /v1/policies/{policyId}/simulate
POST /v1/policies/{policyId}/stress-test
POST /v1/policies/{policyId}/approve-simulation

GET  /v1/simulations/{simulationId}
GET  /v1/simulations/{simulationId}/events
GET  /v1/simulations/{simulationId}/snapshot

GET  /v1/backboard/assistants
GET  /v1/backboard/capabilities
POST /v1/backboard/runs
GET  /v1/backboard/runs/{runId}/events
POST /v1/backboard/runs/{runId}/cancel
POST /v1/backboard/operator-question

GET  /v1/models
GET  /v1/evaluations
```

---

# 16. UI design

## 16.1 Main layout

```text
Top bar:
TwinTO | Toronto | scenario | playback time | data mode

Left panel:
Problem definition
Scenario controls
Layer controls
Policy candidates

Center:
2D MapLibre map

Right panel:
Backboard council
Live agent timeline
Evidence
Final recommendation

Bottom:
Time scrubber
Baseline/intervention comparison
```

## 16.2 Core views

- Live City
- Problem
- Policy Lab
- Citizen Reactions
- Agent Council
- Stress Tests
- Model Lab
- Impact
- Evidence

## 16.3 Required visualizations

- minute-by-minute passenger arrival histogram;
- departure load bars;
- route and stop heatmap;
- platform queue;
- wait-time distribution;
- cohort mode changes;
- policy iteration comparison;
- agent activity timeline;
- FreeSolo model comparison;
- Green AI metrics.

## 16.4 Labels

Always show:

- Simulated citizens
- Simulated policy
- Fixture/live data status
- Estimated emissions
- Not public consultation
- Model revision
- Simulation version

---

# 17. Testing

## Frontend

- map renders;
- layer toggles;
- timeline playback;
- map selection;
- runtime schemas;
- event stream parser;
- policy comparison;
- no Cesium imports;
- no battery text.

## Simulator

- queues;
- boarding;
- capacity;
- departure timing;
- denied boarding;
- transfers;
- delays;
- event surge;
- accessibility;
- deterministic seed.

## FreeSolo

- schema validity;
- impossible journeys rejected;
- aggregate calibration;
- held-out scenario separation;
- GRPO reward.

## Backboard

- assistant bootstrap idempotence;
- 54 definitions;
- dynamic activation;
- parallel tools;
- chained tools;
- model routing;
- documents indexed;
- read-only memory;
- curated writes;
- cancellation;
- no reasoning leakage.

## MongoDB

- collection bootstrap;
- geospatial queries;
- time-series writes;
- transactions;
- change stream;
- search/vector opt-in tests;
- stream pipeline.

## E2E

1. open TwinTO;
2. view 2D Toronto map;
3. select demo stop/corridor;
4. baseline 16:06/16:12;
5. start Backboard run;
6. agents gather evidence;
7. policies generated;
8. FreeSolo reactions complete;
9. simulator reruns;
10. unsafe candidate rejected;
11. concert stress test;
12. final recommendation;
13. ask operator question;
14. compare baseline;
15. verify simulated labels.

---

# 18. Phases and gates

## Phase 0 — reset product safely

- archive battery docs;
- remove battery product;
- preserve generic Backboard utilities;
- baseline migration tests.

## Phase 1 — MapLibre shell

- remove Cesium;
- implement 2D Toronto;
- routes/stops/layers/playback.

Gate: map and fixture render, no Cesium code.

## Phase 2 — transit domain and simulator

Gate: baseline 16:06/16:12 simulation reproduces imbalance.

## Phase 3 — MongoDB core

Gate: network, cohorts, state, and simulation persist.

## Phase 4 — Backboard council

Gate: new assistants replace all GridTwin assistants and complete a mock planning run.

## Phase 5 — Citizen model dataset

Gate: SFT dataset valid and leakage-free.

## Phase 6 — FreeSolo SFT

Gate: structured reaction output and feasible journeys.

## Phase 7 — policy simulation loop

Gate: full Backboard → FreeSolo → simulator flow.

## Phase 8 — GRPO and PPO

Gate: held-out improvement without safety/equity regression.

## Phase 9 — advanced Atlas

Gate: streaming, search, vector, charts demonstrated.

## Phase 10 — Deloitte evaluation

Gate: honest environmental and Green AI report.

## Phase 11 — demo hardening

Gate: five consecutive complete rehearsals.

---

# 19. Git discipline

Use a new integration branch after the Backboard migration is stable:

```text
twinto
```

Suggested commits:

```text
chore: archive gridtwin and initialize twinto
refactor: replace cesium globe with maplibre toronto map
feat: add transit network fixtures and playback
feat: implement deterministic transit simulation
feat: replace grid battery agents with transit planning council
feat: add mongodb atlas operational model
feat: add freesolo citizen reaction pipeline
feat: add ppo transit policy optimizer
feat: add policy lab and agent council ui
test: add twinto integration and e2e coverage
docs: document twinto architecture and demo
```

Never force-push or commit secrets.

---

# 20. Demo script

1. Show downtown Toronto in 2D.
2. Play baseline.
3. Pause at 16:06: underused departure leaves.
4. Show arrivals from 16:07–16:11.
5. Show 16:12 overcrowding.
6. Start virtual planning council.
7. Watch analysts run in parallel.
8. Show four proposed schedule changes.
9. CitizenReactionLM predicts cohort changes.
10. Simulator reruns.
11. Show balanced loads and wait change.
12. Inject concert + entrance closure + delay.
13. Safety and adversarial agents reject brittle option.
14. Final Policy Judge recommends revised option.
15. Ask why.
16. Show evidence and Green AI metrics.
17. Save iteration for future training.

---

# 21. Final acceptance checklist

- [ ] Entire visible product is TwinTO.
- [ ] No battery-control UI remains.
- [ ] No active GridTwin assistants remain in the manifest.
- [ ] No Cesium dependency or 3D map remains.
- [ ] MapLibre 2D Toronto map works.
- [ ] Required attribution is visible.
- [ ] Transit fixtures are versioned.
- [ ] Baseline schedule imbalance is reproduced.
- [ ] FreeSolo CitizenReactionLM is trained and deployed.
- [ ] Citizen reactions are structured and validated.
- [ ] Backboard 54-agent roster exists.
- [ ] Dynamic activation works.
- [ ] RAG, memory, parallel/chained tools, streaming, model routing, and structured outputs work.
- [ ] MongoDB operational, time-series, geospatial, search, vector, streaming, and analytics features are used.
- [ ] PPO or bounded optimizer tunes policies.
- [ ] Safety, accessibility, and equity constraints are enforced.
- [ ] Simulated opinions are never presented as real consultation.
- [ ] Deloitte metrics are computed and traceable.
- [ ] Tests and build pass.
- [ ] Secrets are not committed.
- [ ] Demo is reproducible offline.
