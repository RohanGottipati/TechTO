# Product Limitations

Read this alongside every other knowledge document. GridTwin's control room
demo is a simplified simulation built to demonstrate a multi-agent planning
and review workflow; it is not certified for real battery operations and
must never be presented as one. This document is the single place that
collects every limitation an assistant or an operator-facing summary should
be aware of.

## Not certified, not real hardware

- `ontario-bess-01` is a fixture asset (`demo-battery-specification.md`). No
  dispatch plan produced here ever reaches real hardware; there is no
  physical asset, controller, or SCADA integration behind this repository.
- Nothing in this system has been through a safety case, a hazard analysis,
  or a utility's real interconnection review (`battery-safety-policy.md`).

## Not live data

- Market and renewable conditions are static, synthetic fixtures for a
  single demo date, not a live IESO feed or weather service
  (`market-data-methodology.md`). Every run against the same asset and
  scenario produces numerically identical inputs.
- "Historical analog" records returned by `get_similar_scenarios` are
  hand-authored demo narrative, not real operating history.

## Deterministic simulation, not a forecast

- All financial and physical numbers (revenue, degradation cost, carbon
  avoided, SOC trajectory, ranking) come from a fixed, transparent
  arithmetic model (`simulation-methodology.md`), not a trained predictive
  model and not a claim about what a real asset would actually earn or avoid
  emitting.
- The degradation cost rate, the renewable-capture proxy, and the
  ranking weights are explicit modeling choices documented in
  `simulation-methodology.md`, not calibrated against a real fleet.

## A decision-support demo, not an autonomous control system

- Every recommendation this system produces is advisory
  (`demo-operating-policy.md`). No code path here executes a dispatch plan
  against a real asset.
- The deterministic safety override in the orchestrator can replace an AI
  recommendation with `hold_for_operator`, but that override is itself only
  as good as the fixed rules it encodes; it is not a substitute for human
  review before any real action.

## Mock mode versus live mode

- By default (`BACKBOARD_MOCK_MODE` unset and no `BACKBOARD_API_KEY`), this
  application runs entirely offline against `MockBackboardAdapter`: no
  network calls, no real language model, deterministic scripted responses
  used only for local development and automated tests.
- In live mode, assistant responses come from a real third-party language
  model reached through Backboard. Those responses are still constrained by
  the deterministic validator and simulator, but the written analysis and
  reasoning text itself is model output, not a verified fact, and can be
  wrong, incomplete, or oddly phrased like any language model output.

## Scope limits

- This demo covers exactly one asset, one fixture day, and seven scenarios.
  It does not generalize to other batteries, other markets, or other
  jurisdictions without new fixture data and a new review of every limit in
  `battery-safety-policy.md`.
- It does not model reserve activation events, transmission constraints, or
  ancillary market clearing.

If any other knowledge document appears to claim real-world certification,
live data, or production readiness, this document controls: it does not have
any of those things.
