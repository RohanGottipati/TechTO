# Model Routing

GridTwin never hard-codes a model name for a role. Instead,
`src/lib/backboard/model-router.ts` (`selectModel`) queries Backboard's model
capability catalog (or the mock catalog) at manifest-build time and picks the
best match for that role's declared `ModelRequirement`.

## `ModelRequirement`

Each role in `ASSISTANT_ROSTER` declares:

```ts
interface ModelRequirement {
  requireTools?: boolean;
  requireThinking?: boolean;
  requireJsonOutput?: boolean;
  minContextTokens?: number;
  preferredProviders?: string[]; // defaults to ["anthropic", "openai", "google"]
}
```

Current requirements per role (from `assistants.ts`):

| Role | requireTools | requireThinking | requireJsonOutput | thinking effort |
| --- | --- | --- | --- | --- |
| Market Analyst | yes | no | yes | - |
| Renewable Analyst | yes | no | yes | - |
| Dispatch Planner | yes | yes | yes | medium |
| Risk & Compliance Reviewer | yes | yes | yes | medium |
| Chief Dispatch Officer | no | yes | yes | medium |

The Chief Dispatch Officer does not *require* tools even though it has one
(`recall_operator_notes`) available, because calling that tool is optional
for any given turn.

## Selection algorithm

1. Fetch the model catalog via `adapter.listModels()`, cached in-process for
   60 seconds (`CACHE_TTL_MS`) so repeated manifest builds do not repeatedly
   hit the network. `clearModelRouterCacheForTests()` resets this for tests.
2. Filter to models that satisfy every `true` flag in the requirement and
   any `minContextTokens` floor.
3. If nothing satisfies the requirement, throw `ModelRoutingError` rather
   than silently downgrading a role's capability set.
4. Among eligible models, sort by provider preference order (default
   `anthropic > openai > google`, overridable per requirement), then by
   descending context limit as a tiebreaker.
5. Return the top pick as a `ModelSelection { provider, modelName,
   contextLimit, reason }`. The `reason` string is human-readable and is
   surfaced verbatim by `GET /api/backboard/capabilities` for debugging
   "why did this role get this model."

## Where the pick is used

`getAssistantManifest` (`assistant-manifest.ts`) calls `selectModel` once per
role when building the manifest, and stores the result alongside the
resolved `AssistantRecord`. Every subsequent turn for that role
(`runStructuredTurn` / `runToolLoop` in `orchestrator.ts`) passes
`resolved.model.modelName` and `resolved.model.provider` explicitly on every
`sendMessage` call, so Backboard is told exactly which model to use rather
than falling back to an assistant-level default.

## Mock mode catalog

`MockBackboardAdapter.listModels()` returns a small fixed catalog (`gpt-4o`,
`o3`, `claude-sonnet-4-20250514`, `gemini-2.5-pro`) with plausible capability
flags, so the exact same routing code path runs identically offline. This is
why `npm run backboard:bootstrap` and `npm run backboard:status` both work
with no credentials configured (mock mode is the default whenever
`BACKBOARD_API_KEY` is unset).

## Assistant ID and model overrides: reserved, not yet wired

`.env.example` documents optional, commented-out `BACKBOARD_*_ASSISTANT_ID`
and `BACKBOARD_*_MODEL_OVERRIDE` variables per role, reserved for a possible
future feature: pinning a role to a specific pre-existing Backboard assistant
id or a specific model name instead of always resolving by name through
`getAssistantManifest`/`selectModel`. As of this writing, **no code reads
these variables**. `assistant-manifest.ts` always finds-or-creates by the
role's `name`, and `model-router.ts` always chooses via the capability
catalog. Do not assume setting one of these env vars changes behavior until
this section is updated to say otherwise.
