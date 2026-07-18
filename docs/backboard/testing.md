# Testing

## Unit tests (Vitest, fully offline)

Run with `npm run test:backboard` (or `npm run test` for the whole repo).
Everything below runs against `MockBackboardAdapter`, never a real network
call, so it is safe in CI with no credentials.

Backboard-layer tests (`tests/backboard-*.test.ts`):

- `backboard-mock-adapter.test.ts`: the mock adapter itself (assistant
  create/update, scripted tool rounds, memory CRUD, model catalog filtering).
- `backboard-run-tool-loop.test.ts`: the tool-call round-trip loop
  (`runToolLoop`), including multi-round chained tool calls and the
  `maxRounds` guard.
- `backboard-tool-dispatcher.test.ts`: every tool's dispatcher handler
  (`dispatchToolCall`), including the never-throws error contract.
- `backboard-capabilities-route.test.ts`: the `GET /api/backboard/capabilities`
  route.
- `backboard-memory-routes.test.ts`: the memory CRUD routes.
- `backboard-orchestrator.test.ts`: the full 5-role pipeline end to end,
  including the deterministic safety override, the rank-disagreement (soft)
  case, the local-fallback-simulation case, and the structured-output retry
  case.
- `backboard-run-route.test.ts`: `POST /api/backboard/run`, including the
  SSE envelope stream, request validation, rate limiting, and abort
  handling.
- `backboard-operator-route.test.ts`: `POST /api/backboard/operator-question`,
  including thread continuation and the `operator.failed` path when the
  model never returns valid structured output.
- `backboard-sse-parser.test.ts`: the shared SSE encode/decode helpers
  (`src/lib/backboard/sse.ts`, `src/lib/backboard/stream-parser.ts`) used by
  both routes above and by the browser client.

Grid-domain tests (`tests/grid-*.test.ts`), which back every number a tool
call returns:

- `grid-schemas.test.ts`: the Zod schemas every structured turn is validated
  against.
- `grid-fixtures.test.ts`: fixture accessors (`requireAsset`,
  `requireScenario`, `findSimilarScenarios`).
- `grid-scenarios.test.ts`: `resolveScenarioConditions`, including the
  visible/hidden composition rules.
- `grid-validator.test.ts`: every hard/soft constraint in
  `validateDispatchPlan`.
- `grid-simulator.test.ts`: the financial+physical simulator end to end.
- `grid-candidate-ranker.test.ts`: normalization, weighting, and
  disqualification ordering in `rankCandidates`.

Run just this subsystem's suite with:

```bash
npm run test:backboard
```

which is `vitest run tests/backboard-*.test.ts tests/grid-*.test.ts`.

## Why the mock adapter is the primary test surface

`MockBackboardAdapter` executes the exact same tool-loop, JSON-parsing, and
Zod-validation code paths as `RestBackboardAdapter`; the only thing it
replaces is the network call. Tests drive its behavior deterministically via
`scriptAssistantResponses(assistantId, responses)` (for orchestrator-level
tests, which have no per-call hook of their own) or via `metadata` hints
(`mockToolPlan`, `mockJsonResponse`, `mockContent`) for direct
`runToolLoop`/route tests. This means the unit suite genuinely exercises the
orchestration logic, not just the mock itself.

## Live smoke test (optional, requires a real key)

```bash
npm run backboard:smoke
```

Runs a small number of real calls against the live Backboard API: list
models, send one short message, make one real tool-call round trip, and list
(read-only) memory for one resolved assistant. It automatically skips itself
(exit code 0, not a failure) if `BACKBOARD_API_KEY` is not set or
`BACKBOARD_MOCK_MODE` is explicitly true, and it never prints the API key.
See `scripts/backboard-smoke.ts`.

This is not part of `npm run check` and is not run in CI by default; it is a
manual, opt-in sanity check before a live demo. See `demo-script.md`.

## Status introspection (offline-safe)

```bash
npm run backboard:status
```

Prints the resolved assistant roster (role, name, assistant id, tools,
memory mode, model selection) and the mode (mock/live) without printing any
secret. Works with no credentials (mock mode). See `scripts/backboard-status.ts`.

## End-to-end (Playwright): current state, honestly

`npm run test:e2e:backboard` runs
`playwright test e2e/backboard-control-room.spec.ts`. **That spec file does
not exist yet in this repository as of this writing**, even though the page
it would need to visit now does: `/control/[assetId]`
(`src/app/control/[assetId]/page.tsx`) renders a substantially complete
control room (`GridControlRoom`), backed by working
`POST /api/backboard/run` and `POST /api/backboard/operator-question` SSE
routes. See `architecture.md`'s "UI status" section for the current wiring,
including one known gap (`OperatorQuestionPanel` still calls a stale
`/api/backboard/ask` path).

The npm script is added now, per this documentation pass, to reserve the
command name. Until the spec file itself exists, running this script will
fail with a "no tests found" or similar Playwright error; that is expected,
not a regression. Given how much of the UI already exists, writing this
spec is now realistic rather than blocked on further UI work — treat that
as the next concrete step here, not a "wait for the UI" placeholder.

The existing `e2e/world-ui.spec.ts` (run via plain `npm run test:e2e`) is
unrelated to GridTwin and continues to cover the Skyline globe/city
exploration flow only.

`e2e/backboard-control-room.spec.ts` should, at minimum: navigate to
`/control/ontario-bess-01`, pick a scenario from `scenario-catalog.md`,
start a run, and assert that a final recommendation (or an explicit
`hold_for_operator`) renders in the Evidence tab. Run it against
`BACKBOARD_MOCK_MODE=true` so it never depends on a live model call, and
recall that `playwright.config.ts`'s `webServer` runs `npm run build && npm
run start`, so `BACKBOARD_MOCK_MODE` must be set in the environment that
builds and starts that server, not just in the test process.

## `npm run check`

`npm run check` (lint + typecheck + `vitest run` + build) already includes
every Backboard/grid unit test by default, since plain `vitest run` picks up
`tests/**/*.test.ts` with no filter. `npm run test:backboard` exists as a
faster, scoped subset for iterating on just this subsystem.
