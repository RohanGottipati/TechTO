# TwinTO assistant roster

54 named assistants with the prefix `TwinTO —`. Stable keys live in
`src/lib/backboard/assistants.ts`. Old GridTwin battery assistants must not
be renamed in place; create TwinTO assistants, smoke-test, then delete
GridTwin names via `npm run backboard:cleanup-gridtwin -- --confirm`.

## Bundles

Flagship scenario `departure-406-412` uses `CORE_SCHEDULE_BUNDLE` plus
`CONCERT_BUNDLE` (at least 18 unique roles). Weather overlays can add
`WEATHER_BUNDLE`.

## Shared prompt guard

Every system prompt includes the TwinTO guard: tool-backed facts only,
never present mock citizen reactions as real opinion, never reveal
chain-of-thought, label synthetic/fixture data, and defer viability to
deterministic simulation plus hard safety/accessibility checks.

## Model routing

Profiles: `FAST_ANALYSIS`, `TOOL_ANALYSIS`, `STRUCTURED_POLICY`,
`RISK_REASONING`, `VISION_DOCUMENT`, `VOICE_OPERATOR`, `SUMMARY`.

High reasoning: planning orchestrator, safety, adversarial stress, debate
moderator, final policy judge. Summaries use the low-cost profile.

## Manifest

Local manifest schema version 2, product `twinto`
(`.backboard/assistant-manifest.local.json`). Delete any leftover v1
GridTwin manifest before bootstrapping.
