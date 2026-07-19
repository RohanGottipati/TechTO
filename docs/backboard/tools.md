# TwinTO Backboard tools

Canonical names are in `src/lib/backboard/tools.ts` (`TOOL_NAMES`). The
dispatcher in `tool-dispatcher.ts` executes every tool against local
fixture repositories on this branch.

Categories:

- Network reads: snapshot, schedules, loads, arrivals, OD flows, crowding,
  transfers, delays, capacity, fleet
- Context: demographics, accessibility, events, weather, incidents
- Policy: similar interventions, propose variants
- Citizens: call mock CitizenReactionLM, aggregate
- Evaluate: simulate, wait/load/reliability/equity/accessibility/cost/carbon
- Stress and compare: stress test, compare interventions
- Memory: save iteration, retrieve documents, write approved memory,
  create training examples

Unknown tool names are rejected. Numerical claims in agent prose must come
from tool results.
