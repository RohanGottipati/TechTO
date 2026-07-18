import { beforeEach, describe, expect, it } from "vitest";

import { ASSISTANT_ROSTER } from "@/lib/backboard/assistants";
import { mockAssistantId, type MockBackboardAdapter, type MockSendMessageHints } from "@/lib/backboard/mock-adapter";
import { parseSseChunk } from "@/lib/backboard/stream-parser";
import { requireAsset } from "@/lib/grid/fixtures";
import type { AnalystFinding, DispatchPlanParsed, FinalRecommendation, RiskReview } from "@/lib/grid/schemas";
import type { BackboardRunEventEnvelope } from "@/lib/grid/schemas";
import { resolveScenarioConditions } from "@/lib/grid/scenarios";
import type { ConditionHour, DispatchInterval } from "@/lib/grid/types";

const ASSET_ID = "ontario-bess-01";
const SCENARIO_ID = "normal-day";

function roleAssistantId(role: keyof typeof ASSISTANT_ROSTER): string {
  return mockAssistantId(ASSISTANT_ROSTER[role].name);
}

function buildPlan(
  candidateId: string,
  visibleHours: ConditionHour[],
  overrides: (hour: ConditionHour) => Partial<DispatchInterval> = () => ({}),
): DispatchPlanParsed {
  return {
    schemaVersion: 1,
    assetId: ASSET_ID,
    scenarioId: SCENARIO_ID,
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
  return { role, headline, summary: `${headline} summary.`, keySignals: ["signal-a"], confidence: 0.7 };
}

function reviewFor(candidateId: string): RiskReview {
  return {
    candidateId,
    riskLevel: "low",
    summary: `${candidateId} passed validation and simulation.`,
    concerns: [],
    recommendation: "approve",
  };
}

function scriptFullPipeline(adapter: MockBackboardAdapter, visibleHours: ConditionHour[]): void {
  adapter.scriptAssistantResponses(roleAssistantId("market-analyst"), [
    { mockJsonResponse: analystFinding("market-analyst", "Cheapest hours are overnight.") },
  ]);
  adapter.scriptAssistantResponses(roleAssistantId("renewable-analyst"), [
    { mockJsonResponse: analystFinding("renewable-analyst", "Moderate wind, no thermal risk.") },
  ]);

  const conservativePlan = buildPlan("conservative", visibleHours);
  const balancedPlan = buildPlan("balanced", visibleHours, (hour) =>
    hour.hour >= 12 && hour.hour < 22 ? { dischargeMw: 5, rationale: "discharge into demand" } : {},
  );

  adapter.scriptAssistantResponses(roleAssistantId("dispatch-planner"), [
    {
      mockJsonResponse: {
        candidates: [
          { candidateId: "conservative", plan: conservativePlan },
          { candidateId: "balanced", plan: balancedPlan },
        ],
      },
    },
  ]);

  const reviewerHints: MockSendMessageHints = {
    mockToolPlan: [
      [
        { name: "validate_dispatch_plan", arguments: { assetId: ASSET_ID, scenarioId: SCENARIO_ID, candidateId: "conservative", plan: conservativePlan } },
        { name: "simulate_dispatch_plan", arguments: { assetId: ASSET_ID, scenarioId: SCENARIO_ID, candidateId: "conservative", plan: conservativePlan } },
        { name: "validate_dispatch_plan", arguments: { assetId: ASSET_ID, scenarioId: SCENARIO_ID, candidateId: "balanced", plan: balancedPlan } },
        { name: "simulate_dispatch_plan", arguments: { assetId: ASSET_ID, scenarioId: SCENARIO_ID, candidateId: "balanced", plan: balancedPlan } },
      ],
      [
        { name: "stress_test_dispatch_plan", arguments: { assetId: ASSET_ID, scenarioId: SCENARIO_ID, candidateId: "conservative", plan: conservativePlan } },
        { name: "stress_test_dispatch_plan", arguments: { assetId: ASSET_ID, scenarioId: SCENARIO_ID, candidateId: "balanced", plan: balancedPlan } },
      ],
      [{ name: "rank_dispatch_candidates", arguments: { assetId: ASSET_ID, scenarioId: SCENARIO_ID, candidateIds: ["conservative", "balanced"] } }],
    ],
    mockJsonResponse: { reviews: [reviewFor("conservative"), reviewFor("balanced")] },
  };
  adapter.scriptAssistantResponses(roleAssistantId("risk-reviewer"), [reviewerHints]);

  const chiefRecommendation: FinalRecommendation = {
    chosenCandidateId: "balanced",
    headline: "Discharge into demand hours.",
    reasoning: "Balanced candidate is valid and adds net value over idle.",
    tradeoffs: [],
    confidence: 0.8,
    recommendedAction: "approve",
  };
  adapter.scriptAssistantResponses(roleAssistantId("chief-dispatch-officer"), [{ mockJsonResponse: chiefRecommendation }]);
}

function jsonRequest(url: string, body: unknown, signal?: AbortSignal): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

async function collectEnvelopes(response: Response): Promise<BackboardRunEventEnvelope[]> {
  if (!response.body) return [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const seen = new Set<number>();
  const events: BackboardRunEventEnvelope[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    const parsed = parseSseChunk(buffer, chunk, seen);
    buffer = parsed.remainder;
    events.push(...parsed.events);
  }
  return events;
}

describe("POST /api/backboard/run", () => {
  beforeEach(async () => {
    process.env.BACKBOARD_MOCK_MODE = "true";
    const { resetBackboardAdapterForTests } = await import("@/lib/backboard/adapter");
    const { resetAssistantManifestForTests } = await import("@/lib/backboard/assistant-manifest");
    const { resetRunRateLimiterForTests } = await import("@/lib/backboard/run-rate-limit");
    resetBackboardAdapterForTests();
    resetAssistantManifestForTests();
    resetRunRateLimiterForTests();
  });

  it("streams the full run lifecycle as validated SSE envelopes and completes", async () => {
    const { getBackboardAdapter } = await import("@/lib/backboard/adapter");
    const adapter = getBackboardAdapter() as MockBackboardAdapter;
    const asset = requireAsset(ASSET_ID);
    const visibleHours = resolveScenarioConditions(SCENARIO_ID, asset).visibleHours;
    scriptFullPipeline(adapter, visibleHours);

    const { POST } = await import("@/app/api/backboard/run/route");
    const response = await POST(jsonRequest("http://localhost/api/backboard/run", { assetId: ASSET_ID, scenarioId: SCENARIO_ID }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const events = await collectEnvelopes(response);
    const types = events.map((event) => event.type);

    expect(types[0]).toBe("run.created");
    expect(types).toContain("candidates.ranked");
    expect(types).toContain("recommendation.ready");
    expect(types.at(-1)).toBe("run.completed");

    const runIds = new Set(events.map((event) => event.runId));
    expect(runIds.size).toBe(1);

    const sequences = events.map((event) => event.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(new Set(sequences).size).toBe(sequences.length);

    const completed = events.find((event) => event.type === "run.completed");
    const result = completed?.payload.result as { effectiveRecommendation: FinalRecommendation };
    expect(result.effectiveRecommendation.chosenCandidateId).toBe("balanced");

    for (const event of events) {
      expect(event.payload).not.toHaveProperty("reasoning");
    }
  }, 20_000);

  it("rejects a request missing required fields with 400", async () => {
    const { POST } = await import("@/app/api/backboard/run/route");
    const response = await POST(jsonRequest("http://localhost/api/backboard/run", { assetId: ASSET_ID }));
    expect(response.status).toBe(400);
  });

  it("rejects an unknown assetId with 404", async () => {
    const { POST } = await import("@/app/api/backboard/run/route");
    const response = await POST(
      jsonRequest("http://localhost/api/backboard/run", { assetId: "not-a-real-asset", scenarioId: SCENARIO_ID }),
    );
    expect(response.status).toBe(404);
  });

  it("rejects a body over the size limit with 413", async () => {
    const { POST } = await import("@/app/api/backboard/run/route");
    const response = await POST(
      jsonRequest("http://localhost/api/backboard/run", {
        assetId: ASSET_ID,
        scenarioId: SCENARIO_ID,
        objectiveWeights: { netValue: 1, renewableCapture: 0, carbonAvoided: 0, degradation: 0, padding: "x".repeat(30_000) },
      }),
    );
    expect(response.status).toBe(413);
  });

  it("rejects an oversized assetId string", async () => {
    const { POST } = await import("@/app/api/backboard/run/route");
    const response = await POST(
      jsonRequest("http://localhost/api/backboard/run", { assetId: "a".repeat(500), scenarioId: SCENARIO_ID }),
    );
    expect(response.status).toBe(400);
  });

  it("rate-limits repeated requests from the same client", async () => {
    const { POST } = await import("@/app/api/backboard/run/route");
    let lastStatus = 0;
    for (let i = 0; i < 25; i += 1) {
      const response = await POST(jsonRequest("http://localhost/api/backboard/run", { assetId: ASSET_ID }));
      lastStatus = response.status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });

  it("stops emitting further events once the request is aborted", async () => {
    const { getBackboardAdapter } = await import("@/lib/backboard/adapter");
    const adapter = getBackboardAdapter() as MockBackboardAdapter;
    const asset = requireAsset(ASSET_ID);
    const visibleHours = resolveScenarioConditions(SCENARIO_ID, asset).visibleHours;
    scriptFullPipeline(adapter, visibleHours);

    const controller = new AbortController();
    const { POST } = await import("@/app/api/backboard/run/route");
    const response = await POST(
      jsonRequest("http://localhost/api/backboard/run", { assetId: ASSET_ID, scenarioId: SCENARIO_ID }, controller.signal),
    );

    controller.abort();
    const events = await collectEnvelopes(response);
    const types = events.map((event) => event.type);
    expect(types.at(-1)).not.toBe("run.completed");
  }, 20_000);
});
