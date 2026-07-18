import { ASSISTANT_ROSTER } from "@/lib/backboard/assistants";
import {
  mockAssistantId,
  type MockBackboardAdapter,
  type MockSendMessageHints,
} from "@/lib/backboard/mock-adapter";
import { requireAsset } from "@/lib/grid/fixtures";
import type {
  AnalystFinding,
  DispatchPlanParsed,
  FinalRecommendation,
  RiskReview,
} from "@/lib/grid/schemas";
import { resolveScenarioConditions } from "@/lib/grid/scenarios";
import type { ConditionHour, DispatchInterval } from "@/lib/grid/types";

/**
 * Deterministic mock-mode pipeline used by POST /api/backboard/run when the
 * adapter is the offline mock. Produces:
 * - one malformed first-attempt planner response (forces structured-output retry)
 * - one unsafe candidate (fails reserve validation)
 * - one valid conservative candidate
 * - one valid balanced candidate that the Chief recommends
 *
 * The real local validator and simulator still evaluate every candidate.
 */

function roleAssistantId(role: keyof typeof ASSISTANT_ROSTER): string {
  return mockAssistantId(ASSISTANT_ROSTER[role].name);
}

function buildPlan(
  assetId: string,
  scenarioId: string,
  candidateId: string,
  visibleHours: ConditionHour[],
  overrides: (hour: ConditionHour) => Partial<DispatchInterval> = () => ({}),
): DispatchPlanParsed {
  return {
    schemaVersion: 1,
    assetId,
    scenarioId,
    horizonStart: visibleHours[0].timestamp,
    intervalMinutes: 60,
    strategy: candidateId,
    assumptions: [],
    warnings: [],
    intervals: visibleHours.map((hour) => ({
      timestamp: hour.timestamp,
      chargeMw: 0,
      dischargeMw: 0,
      reserveMw: 20,
      rationale: "hold",
      confidence: 0.5,
      ...overrides(hour),
    })),
  };
}

function analystFinding(role: string, headline: string): AnalystFinding {
  return {
    role,
    headline,
    summary: `${headline} Summary is fixture-backed demo text for mock mode.`,
    keySignals: ["fixture-signal"],
    confidence: 0.75,
  };
}

function reviewFor(candidateId: string, recommendation: RiskReview["recommendation"], riskLevel: RiskReview["riskLevel"]): RiskReview {
  return {
    candidateId,
    riskLevel,
    summary:
      recommendation === "reject"
        ? `${candidateId} fails deterministic reserve validation and must not be approved.`
        : `${candidateId} passed validation and simulation on fixture data.`,
    concerns: recommendation === "reject" ? ["Reserve requirement not met."] : [],
    recommendation,
  };
}

/**
 * Scripts the process-wide mock adapter so a UI-triggered run (which has no
 * per-request metadata hook) still exercises the full multi-agent path.
 */
export function prepareMockDemoRun(
  adapter: MockBackboardAdapter,
  assetId: string,
  scenarioId: string,
): void {
  const asset = requireAsset(assetId);
  const visibleHours = resolveScenarioConditions(scenarioId, asset).visibleHours;

  adapter.scriptAssistantResponses(roleAssistantId("market-analyst"), [
    {
      mockToolPlan: [[{ name: "get_market_window", arguments: { assetId, scenarioId } }]],
      mockJsonResponse: analystFinding(
        "market-analyst",
        scenarioId === "overnight-wind-surplus"
          ? "Overnight prices collapse under wind surplus."
          : "Cheapest hours are overnight; peak value is evening demand.",
      ),
    },
  ]);

  adapter.scriptAssistantResponses(roleAssistantId("renewable-analyst"), [
    {
      mockToolPlan: [[{ name: "get_renewable_forecast", arguments: { assetId, scenarioId } }]],
      mockJsonResponse: analystFinding(
        "renewable-analyst",
        scenarioId === "overnight-wind-surplus"
          ? "Renewable Analyst identified overnight wind surplus."
          : "Moderate wind and solar; no thermal risk on visible forecast.",
      ),
    },
  ]);

  const conservativePlan = buildPlan(assetId, scenarioId, "conservative", visibleHours);
  const balancedPlan = buildPlan(assetId, scenarioId, "balanced", visibleHours, (hour) => {
    if (hour.hour >= 0 && hour.hour < 6) {
      return { chargeMw: 20, rationale: "charge overnight surplus", confidence: 0.7 };
    }
    if (hour.hour >= 17 && hour.hour < 21) {
      return { dischargeMw: 15, rationale: "discharge into evening peak", confidence: 0.7 };
    }
    return {};
  });
  // Unsafe: commits zero reserve every hour, which the validator rejects.
  const unsafePlan = buildPlan(assetId, scenarioId, "unsafe-zero-reserve", visibleHours, () => ({
    reserveMw: 0,
    dischargeMw: 10,
    rationale: "chase revenue without reserve (intentionally unsafe demo candidate)",
    confidence: 0.4,
  }));

  // First planner attempt is malformed (missing required intervals field) so
  // the structured-output retry path is exercised; the second attempt is valid.
  adapter.scriptAssistantResponses(roleAssistantId("dispatch-planner"), [
    {
      mockJsonResponse: {
        candidates: [
          { candidateId: "broken", plan: { schemaVersion: 1, assetId, scenarioId } },
        ],
      },
    },
    {
      mockToolPlan: [[{ name: "get_asset_spec", arguments: { assetId } }]],
      mockJsonResponse: {
        candidates: [
          { candidateId: "conservative", plan: conservativePlan },
          { candidateId: "unsafe-zero-reserve", plan: unsafePlan },
          { candidateId: "balanced", plan: balancedPlan },
        ],
      },
    },
  ]);

  const reviewerHints: MockSendMessageHints = {
    mockToolPlan: [
      [
        {
          name: "validate_dispatch_plan",
          arguments: { assetId, scenarioId, candidateId: "conservative", plan: conservativePlan },
        },
        {
          name: "simulate_dispatch_plan",
          arguments: { assetId, scenarioId, candidateId: "conservative", plan: conservativePlan },
        },
        {
          name: "validate_dispatch_plan",
          arguments: { assetId, scenarioId, candidateId: "unsafe-zero-reserve", plan: unsafePlan },
        },
        {
          name: "simulate_dispatch_plan",
          arguments: { assetId, scenarioId, candidateId: "unsafe-zero-reserve", plan: unsafePlan },
        },
        {
          name: "validate_dispatch_plan",
          arguments: { assetId, scenarioId, candidateId: "balanced", plan: balancedPlan },
        },
        {
          name: "simulate_dispatch_plan",
          arguments: { assetId, scenarioId, candidateId: "balanced", plan: balancedPlan },
        },
      ],
      [
        {
          name: "stress_test_dispatch_plan",
          arguments: { assetId, scenarioId, candidateId: "conservative", plan: conservativePlan },
        },
        {
          name: "stress_test_dispatch_plan",
          arguments: { assetId, scenarioId, candidateId: "unsafe-zero-reserve", plan: unsafePlan },
        },
        {
          name: "stress_test_dispatch_plan",
          arguments: { assetId, scenarioId, candidateId: "balanced", plan: balancedPlan },
        },
      ],
      [
        {
          name: "rank_dispatch_candidates",
          arguments: {
            assetId,
            scenarioId,
            candidateIds: ["conservative", "unsafe-zero-reserve", "balanced"],
          },
        },
      ],
    ],
    mockJsonResponse: {
      reviews: [
        reviewFor("conservative", "approve_with_caution", "low"),
        reviewFor("unsafe-zero-reserve", "reject", "high"),
        reviewFor("balanced", "approve", "low"),
      ],
    },
  };
  adapter.scriptAssistantResponses(roleAssistantId("risk-reviewer"), [reviewerHints]);

  const chiefRecommendation: FinalRecommendation = {
    chosenCandidateId: "balanced",
    headline: "Recommend balanced overnight charge and evening discharge.",
    reasoning:
      "Balanced is hard-valid on fixture data, captures overnight surplus, and preserves the 20 MW reserve. Unsafe-zero-reserve is rejected by the deterministic validator.",
    tradeoffs: ["Conservative earns less simulated net value.", "Unsafe candidate fails reserve."],
    confidence: 0.82,
    recommendedAction: "approve_with_monitoring",
  };
  adapter.scriptAssistantResponses(roleAssistantId("chief-dispatch-officer"), [
    { mockJsonResponse: chiefRecommendation },
  ]);
}

/**
 * Scripts a deterministic operator follow-up answer for mock mode. Call this
 * immediately before askOperatorQuestion so the repeating FinalRecommendation
 * script left over from prepareMockDemoRun does not poison the Q&A turn.
 */
export function prepareMockOperatorAnswer(
  adapter: MockBackboardAdapter,
  question: string,
): void {
  // Always overwrite: prepareMockDemoRun leaves a repeating FinalRecommendation
  // script on the chief assistant that would otherwise poison Q&A turns.
  adapter.scriptAssistantResponses(roleAssistantId("chief-dispatch-officer"), [
    {
      mockJsonResponse: {
        answer:
          `Mock Backboard Mode answer for: "${question.slice(0, 120)}". ` +
          "The balanced candidate was preferred because it is hard-valid on fixture data, " +
          "preserves the 20 MW reserve requirement, and captures overnight surplus without " +
          "inventing telemetry. This is decision support only; nothing here controls a real battery.",
        citedEvidence: [
          "candidate:balanced",
          "tool:validate_dispatch_plan",
          "fixture:ontario-bess-01",
        ],
      },
    },
  ]);
}
