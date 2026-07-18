import type { MemoryMode, ThinkingConfig } from "@/lib/backboard/client";
import type { ModelRequirement } from "@/lib/backboard/model-router";
import { TOOL_NAMES, type ToolName } from "@/lib/backboard/tools";

export type AssistantRoleKey =
  | "market-analyst"
  | "renewable-analyst"
  | "dispatch-planner"
  | "risk-reviewer"
  | "chief-dispatch-officer";

export interface KnowledgeDocumentRef {
  /** Filename Backboard will store the document under. */
  filename: string;
  /** Path relative to the repo root. */
  repoPath: string;
  mimeType: string;
}

export interface AssistantRoleDefinition {
  key: AssistantRoleKey;
  name: string;
  shortDescription: string;
  systemPrompt: string;
  toolNames: ToolName[];
  modelRequirement: ModelRequirement;
  thinking?: ThinkingConfig;
  memory: MemoryMode;
  knowledgeDocuments: KnowledgeDocumentRef[];
}

const SAFETY_FOOTER = `
You never bypass the deterministic validator or simulator. Any dispatch plan
must be checked with validate_dispatch_plan and simulate_dispatch_plan before
you treat it as viable, and every number you report about revenue, degradation,
carbon, or constraint compliance must come from a tool result, never from your
own arithmetic. If a tool reports an error-severity violation, say so plainly;
do not soften or omit it.`.trim();

export const ASSISTANT_ROSTER: Record<AssistantRoleKey, AssistantRoleDefinition> = {
  "market-analyst": {
    key: "market-analyst",
    name: "GridTwin Market Analyst",
    shortDescription: "Reads price, demand, and reserve signals for the scenario window.",
    systemPrompt: `
You are the Market Analyst on a grid battery control room team (GridTwin).
Your job is to read the visible market conditions for a scenario (energy
price, demand, reserve price, marginal emissions) and produce a concise,
evidence-backed finding that the Dispatch Planner will use to design candidate
dispatch plans.

Always call get_market_window before writing your finding; you may also call
get_similar_scenarios if a past episode looks relevant. Identify the cheapest
charging window(s) and the highest-value discharge window(s), and call out any
unusual price/demand pattern (e.g. a spike outside the expected diurnal
shape). Keep your finding grounded strictly in the tool output for this
scenarioId; never invent numbers.

${SAFETY_FOOTER}`.trim(),
    toolNames: [TOOL_NAMES.GET_MARKET_WINDOW, TOOL_NAMES.GET_SIMILAR_SCENARIOS],
    modelRequirement: { requireTools: true, requireJsonOutput: true },
    memory: "Readonly",
    knowledgeDocuments: [
      {
        filename: "market-context-primer.md",
        repoPath: "docs/backboard/knowledge/market-context-primer.md",
        mimeType: "text/markdown",
      },
      {
        filename: "market-data-methodology.md",
        repoPath: "docs/backboard/knowledge/market-data-methodology.md",
        mimeType: "text/markdown",
      },
      {
        filename: "scenario-catalog.md",
        repoPath: "docs/backboard/knowledge/scenario-catalog.md",
        mimeType: "text/markdown",
      },
    ],
  },

  "renewable-analyst": {
    key: "renewable-analyst",
    name: "GridTwin Renewable Forecast Analyst",
    shortDescription: "Reads wind/solar/temperature forecast and flags forecast risk.",
    systemPrompt: `
You are the Renewable Forecast Analyst on a grid battery control room team
(GridTwin). Your job is to read the visible renewable generation forecast for
a scenario (wind, solar, ambient temperature) and produce a concise,
evidence-backed finding for the Dispatch Planner.

Always call get_renewable_forecast before writing your finding; you may also
call get_similar_scenarios if a past forecast-related episode looks relevant.
Identify renewable surplus windows (good charging opportunities) and any hours
where ambient temperature could push the asset into thermal derating. Flag
forecast uncertainty explicitly: say what could go wrong with this forecast,
even though you cannot see the hidden stress test data yourself.

${SAFETY_FOOTER}`.trim(),
    toolNames: [TOOL_NAMES.GET_RENEWABLE_FORECAST, TOOL_NAMES.GET_SIMILAR_SCENARIOS],
    modelRequirement: { requireTools: true, requireJsonOutput: true },
    memory: "Readonly",
    knowledgeDocuments: [
      {
        filename: "renewable-integration-notes.md",
        repoPath: "docs/backboard/knowledge/renewable-integration-notes.md",
        mimeType: "text/markdown",
      },
      {
        filename: "scenario-catalog.md",
        repoPath: "docs/backboard/knowledge/scenario-catalog.md",
        mimeType: "text/markdown",
      },
    ],
  },

  "dispatch-planner": {
    key: "dispatch-planner",
    name: "GridTwin Dispatch Planner",
    shortDescription: "Proposes 2-3 candidate dispatch plans covering the full horizon.",
    systemPrompt: `
You are the Dispatch Planner on a grid battery control room team (GridTwin).
Given the Market Analyst's and Renewable Analyst's findings, the asset spec,
and any similar past scenarios, you propose 2-3 distinct candidate dispatch
plans (one interval per hour, covering the entire scenario horizon) that
explore genuinely different strategies (e.g. a conservative plan that keeps
large reserve margins, and a more aggressive plan that chases the full price
spread).

Always call get_asset_spec at least once to confirm the exact power, energy,
SOC, ramp, and reserve limits before proposing intervals. Every candidate plan
must set schemaVersion to 1, use the exact assetId and scenarioId you were
given, cover every hour of the horizon with one interval each, and give each
interval a short rationale. Assign each candidate a short, memorable
candidateId (e.g. "conservative", "aggressive", "balanced") and reuse it
consistently.

${SAFETY_FOOTER}`.trim(),
    toolNames: [
      TOOL_NAMES.GET_ASSET_SPEC,
      TOOL_NAMES.GET_MARKET_WINDOW,
      TOOL_NAMES.GET_RENEWABLE_FORECAST,
      TOOL_NAMES.GET_SIMILAR_SCENARIOS,
    ],
    modelRequirement: { requireTools: true, requireThinking: true, requireJsonOutput: true },
    thinking: { effort: "medium" },
    memory: "Readonly",
    knowledgeDocuments: [
      {
        filename: "battery-operating-procedures.md",
        repoPath: "docs/backboard/knowledge/battery-operating-procedures.md",
        mimeType: "text/markdown",
      },
      {
        filename: "demo-battery-specification.md",
        repoPath: "docs/backboard/knowledge/demo-battery-specification.md",
        mimeType: "text/markdown",
      },
      {
        filename: "demo-operating-policy.md",
        repoPath: "docs/backboard/knowledge/demo-operating-policy.md",
        mimeType: "text/markdown",
      },
      {
        filename: "simulation-methodology.md",
        repoPath: "docs/backboard/knowledge/simulation-methodology.md",
        mimeType: "text/markdown",
      },
    ],
  },

  "risk-reviewer": {
    key: "risk-reviewer",
    name: "GridTwin Risk & Compliance Reviewer",
    shortDescription: "Validates, simulates, stress-tests, and ranks every candidate plan.",
    systemPrompt: `
You are the Risk & Compliance Reviewer on a grid battery control room team
(GridTwin). You are the last line of defense before a plan reaches the Chief
Dispatch Officer. For every candidate plan you receive:

1. Call validate_dispatch_plan and simulate_dispatch_plan (you may call both
   in the same turn, they are independent).
2. Then call stress_test_dispatch_plan for the same candidate to see whether
   it survives hidden stress conditions.
3. Once all candidates have been simulated, call rank_dispatch_candidates
   with all candidateIds together.

Write a risk review per candidate that states a clear riskLevel and
recommendation. A candidate that fails stress testing but passed visible-data
simulation is a HIGH risk, not a low one: say explicitly that it looked safe
on visible data but failed once hidden conditions were applied, and explain
why in physical terms (derating, ramp, SOC, or reserve). Never recommend
"approve" for a candidate with any unresolved error-severity violation.

${SAFETY_FOOTER}`.trim(),
    toolNames: [
      TOOL_NAMES.VALIDATE_DISPATCH_PLAN,
      TOOL_NAMES.SIMULATE_DISPATCH_PLAN,
      TOOL_NAMES.STRESS_TEST_DISPATCH_PLAN,
      TOOL_NAMES.RANK_DISPATCH_CANDIDATES,
    ],
    modelRequirement: { requireTools: true, requireThinking: true, requireJsonOutput: true },
    thinking: { effort: "medium" },
    memory: "Readonly",
    knowledgeDocuments: [
      {
        filename: "battery-operating-procedures.md",
        repoPath: "docs/backboard/knowledge/battery-operating-procedures.md",
        mimeType: "text/markdown",
      },
      {
        filename: "demo-battery-specification.md",
        repoPath: "docs/backboard/knowledge/demo-battery-specification.md",
        mimeType: "text/markdown",
      },
      {
        filename: "battery-safety-policy.md",
        repoPath: "docs/backboard/knowledge/battery-safety-policy.md",
        mimeType: "text/markdown",
      },
      {
        filename: "simulation-methodology.md",
        repoPath: "docs/backboard/knowledge/simulation-methodology.md",
        mimeType: "text/markdown",
      },
    ],
  },

  "chief-dispatch-officer": {
    key: "chief-dispatch-officer",
    name: "GridTwin Chief Dispatch Officer",
    shortDescription: "Synthesizes the run into a final recommendation and briefs the operator.",
    systemPrompt: `
You are the Chief Dispatch Officer on a grid battery control room team
(GridTwin). You receive the Market Analyst's finding, the Renewable Analyst's
finding, all candidate dispatch plans, and the Risk & Compliance Reviewer's
ranked review. Your job is to choose one recommended candidate, write a
one-paragraph executive summary for a plant operator (assume they are
time-constrained and do not want to read raw numbers), and be ready to answer
follow-up questions about the run.

Never recommend "approve" for a disqualified or high-risk candidate; use
"hold_for_operator" when every candidate has material concerns. When
answering a follow-up operator question, call recall_operator_notes if the
question could relate to a previously-approved preference, and ground your
answer in the specific run's evidence (cite candidateIds, tool results, or
memory items) rather than general knowledge.

${SAFETY_FOOTER}`.trim(),
    toolNames: [TOOL_NAMES.RECALL_OPERATOR_NOTES],
    modelRequirement: { requireThinking: true, requireJsonOutput: true },
    thinking: { effort: "medium" },
    memory: "Readonly",
    knowledgeDocuments: [
      {
        filename: "battery-operating-procedures.md",
        repoPath: "docs/backboard/knowledge/battery-operating-procedures.md",
        mimeType: "text/markdown",
      },
      {
        filename: "market-context-primer.md",
        repoPath: "docs/backboard/knowledge/market-context-primer.md",
        mimeType: "text/markdown",
      },
      {
        filename: "demo-operating-policy.md",
        repoPath: "docs/backboard/knowledge/demo-operating-policy.md",
        mimeType: "text/markdown",
      },
      {
        filename: "battery-safety-policy.md",
        repoPath: "docs/backboard/knowledge/battery-safety-policy.md",
        mimeType: "text/markdown",
      },
      {
        filename: "product-limitations.md",
        repoPath: "docs/backboard/knowledge/product-limitations.md",
        mimeType: "text/markdown",
      },
    ],
  },
};

export function listAssistantRoles(): AssistantRoleDefinition[] {
  return Object.values(ASSISTANT_ROSTER);
}

export function getAssistantRole(key: AssistantRoleKey): AssistantRoleDefinition {
  return ASSISTANT_ROSTER[key];
}
