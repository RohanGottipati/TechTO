import type { ChatToolDefinition } from "@/lib/backboard/client";

/**
 * Canonical tool names shared by assistant definitions (which tools an
 * assistant is offered) and the tool dispatcher (which grid-domain function
 * each name executes). Keeping this as a const object (not a plain string
 * union) lets both sides import the same runtime values.
 */
export const TOOL_NAMES = {
  GET_ASSET_SPEC: "get_asset_spec",
  GET_MARKET_WINDOW: "get_market_window",
  GET_RENEWABLE_FORECAST: "get_renewable_forecast",
  GET_SIMILAR_SCENARIOS: "get_similar_scenarios",
  VALIDATE_DISPATCH_PLAN: "validate_dispatch_plan",
  SIMULATE_DISPATCH_PLAN: "simulate_dispatch_plan",
  STRESS_TEST_DISPATCH_PLAN: "stress_test_dispatch_plan",
  RANK_DISPATCH_CANDIDATES: "rank_dispatch_candidates",
  RECALL_OPERATOR_NOTES: "recall_operator_notes",
} as const;

export type ToolName = (typeof TOOL_NAMES)[keyof typeof TOOL_NAMES];

const dispatchIntervalSchemaProperty = {
  type: "object",
  description: "One interval's action.",
  properties: {
    timestamp: { type: "string", description: "ISO-8601 timestamp matching the scenario hour exactly." },
    chargeMw: { type: "number", description: "Charge power in MW for this interval (0 if not charging)." },
    dischargeMw: { type: "number", description: "Discharge power in MW for this interval (0 if not discharging). Never set both chargeMw and dischargeMw above 0 in the same interval." },
    reserveMw: { type: "number", description: "Operating reserve capacity committed in MW for this interval." },
    rationale: { type: "string", description: "One or two sentence reason for this interval's action." },
    confidence: { type: "number", description: "Confidence in [0,1] for this interval's action." },
  },
  required: ["timestamp", "chargeMw", "dischargeMw", "reserveMw", "rationale", "confidence"],
};

const dispatchPlanSchemaProperty = {
  type: "object",
  description: "A complete dispatch plan candidate covering the full scenario horizon.",
  properties: {
    schemaVersion: { type: "integer", description: "Always 1." },
    assetId: { type: "string" },
    scenarioId: { type: "string" },
    horizonStart: { type: "string", description: "ISO-8601 timestamp of the first interval." },
    intervalMinutes: { type: "integer", description: "Minutes per interval; must match the scenario horizon (60)." },
    strategy: { type: "string", description: "Short label for this plan's strategy, e.g. 'Charge overnight surplus, discharge into evening peak'." },
    assumptions: { type: "array", items: { type: "string" }, description: "Explicit assumptions this plan relies on." },
    warnings: { type: "array", items: { type: "string" }, description: "Known risks or caveats about this plan." },
    intervals: {
      type: "array",
      description: "One entry per hour across the full scenario horizon, in chronological order.",
      items: dispatchIntervalSchemaProperty,
    },
  },
  required: [
    "schemaVersion",
    "assetId",
    "scenarioId",
    "horizonStart",
    "intervalMinutes",
    "strategy",
    "intervals",
  ],
};

const scenarioAssetParameters = {
  type: "object" as const,
  properties: {
    assetId: { type: "string", description: "Battery asset id, e.g. 'ontario-bess-01'." },
    scenarioId: { type: "string", description: "Scenario id, e.g. 'evening-demand-peak'." },
  },
  required: ["assetId", "scenarioId"],
};

const planEvaluationParameters = {
  type: "object" as const,
  properties: {
    assetId: { type: "string", description: "Battery asset id this plan targets." },
    scenarioId: { type: "string", description: "Scenario id this plan targets." },
    candidateId: { type: "string", description: "A short id you assign to this candidate, e.g. 'candidate-a'. Reuse the same id across validate/simulate/stress-test/rank calls for the same plan." },
    plan: dispatchPlanSchemaProperty,
  },
  required: ["assetId", "scenarioId", "candidateId", "plan"],
};

export const TOOL_DEFINITIONS: Record<ToolName, ChatToolDefinition> = {
  [TOOL_NAMES.GET_ASSET_SPEC]: {
    name: TOOL_NAMES.GET_ASSET_SPEC,
    description:
      "Fetch the full technical specification for a battery asset: rated power, usable energy, SOC limits, round-trip efficiency, ramp limit, reserve requirement, and thermal derating curve.",
    parameters: {
      type: "object",
      properties: {
        assetId: { type: "string", description: "Battery asset id, e.g. 'ontario-bess-01'." },
      },
      required: ["assetId"],
    },
  },
  [TOOL_NAMES.GET_MARKET_WINDOW]: {
    name: TOOL_NAMES.GET_MARKET_WINDOW,
    description:
      "Fetch the visible (non-hidden-stress) hourly market conditions for a scenario across the full planning horizon: energy price, demand, reserve price, and marginal emissions.",
    parameters: scenarioAssetParameters,
  },
  [TOOL_NAMES.GET_RENEWABLE_FORECAST]: {
    name: TOOL_NAMES.GET_RENEWABLE_FORECAST,
    description:
      "Fetch the visible hourly renewable generation forecast for a scenario across the full planning horizon: wind output, solar output, and ambient temperature.",
    parameters: scenarioAssetParameters,
  },
  [TOOL_NAMES.GET_SIMILAR_SCENARIOS]: {
    name: TOOL_NAMES.GET_SIMILAR_SCENARIOS,
    description:
      "Retrieve historical analog records (past dispatch episodes) similar to a scenario category or tag set, to ground planning in precedent.",
    parameters: {
      type: "object",
      properties: {
        scenarioType: {
          type: "string",
          description: "Optional scenario category to match, e.g. 'renewable', 'market', 'derating', 'adversarial'.",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional tags to match, e.g. ['thermal-derating', 'summer-peak'].",
        },
        limit: { type: "number", description: "Maximum records to return (default 3)." },
      },
      required: [],
    },
  },
  [TOOL_NAMES.VALIDATE_DISPATCH_PLAN]: {
    name: TOOL_NAMES.VALIDATE_DISPATCH_PLAN,
    description:
      "Run the deterministic physical validator against a dispatch plan using VISIBLE scenario conditions only. Returns constraint violations: SOC limits, ramp limit, power limit, thermal derating, and reserve target. This never reveals hidden stress conditions.",
    parameters: planEvaluationParameters,
  },
  [TOOL_NAMES.SIMULATE_DISPATCH_PLAN]: {
    name: TOOL_NAMES.SIMULATE_DISPATCH_PLAN,
    description:
      "Run the deterministic financial and physical simulator against a dispatch plan using VISIBLE scenario conditions only. Returns net value, energy and reserve revenue, degradation cost, carbon avoided, renewable capture, and the full validation outcome.",
    parameters: planEvaluationParameters,
  },
  [TOOL_NAMES.STRESS_TEST_DISPATCH_PLAN]: {
    name: TOOL_NAMES.STRESS_TEST_DISPATCH_PLAN,
    description:
      "Re-run the deterministic simulator against the SAME dispatch plan under the scenario's hidden stress conditions (forecast misses, unexpected derating, demand surprises) that were withheld during planning. Use this to check whether a plan that looks safe on visible data actually survives real-world surprises. Call this only after simulate_dispatch_plan has already run on visible conditions for the same candidateId.",
    parameters: planEvaluationParameters,
  },
  [TOOL_NAMES.RANK_DISPATCH_CANDIDATES]: {
    name: TOOL_NAMES.RANK_DISPATCH_CANDIDATES,
    description:
      "Deterministically rank previously-simulated dispatch candidates by a weighted combination of net value, renewable capture, carbon avoided, and degradation cost. Candidates that failed validation are automatically disqualified regardless of score. Each candidateId must already have been simulated via simulate_dispatch_plan earlier in this same conversation.",
    parameters: {
      type: "object",
      properties: {
        assetId: { type: "string" },
        scenarioId: { type: "string" },
        candidateIds: {
          type: "array",
          items: { type: "string" },
          description: "Candidate ids to rank, in any order.",
        },
      },
      required: ["assetId", "scenarioId", "candidateIds"],
    },
  },
  [TOOL_NAMES.RECALL_OPERATOR_NOTES]: {
    name: TOOL_NAMES.RECALL_OPERATOR_NOTES,
    description:
      "Explicitly search this assistant's curated long-term memory for prior operator-approved notes, preferences, or facility-specific guidance relevant to a query, in addition to whatever memories were already surfaced automatically in context.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "What to search for, e.g. 'reserve margin preference during evening peaks'.",
        },
      },
      required: ["query"],
    },
  },
};

export function getToolDefinitions(names: ToolName[]): ChatToolDefinition[] {
  return names.map((name) => TOOL_DEFINITIONS[name]);
}
