import { beforeEach, describe, expect, it } from "vitest";

describe("GET /api/backboard/capabilities", () => {
  beforeEach(async () => {
    process.env.BACKBOARD_MOCK_MODE = "true";
    const { resetBackboardAdapterForTests } = await import("@/lib/backboard/adapter");
    const { resetAssistantManifestForTests } = await import("@/lib/backboard/assistant-manifest");
    resetBackboardAdapterForTests();
    resetAssistantManifestForTests();
  });

  it("returns the full assistant roster with resolved models in mock mode", async () => {
    const { GET } = await import("@/app/api/backboard/capabilities/route");
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.mode).toBe("mock");
    expect(body.assistants).toHaveLength(5);

    const marketAnalyst = body.assistants.find((a: { role: string }) => a.role === "market-analyst");
    expect(marketAnalyst).toBeDefined();
    expect(marketAnalyst.assistantId).toBe("mock-assistant-gridtwin-market-analyst");
    expect(marketAnalyst.toolNames).toContain("get_market_window");
    expect(marketAnalyst.memory).toBe("Readonly");
    expect(marketAnalyst.model.provider).toBeTruthy();
    expect(marketAnalyst.model.name).toBeTruthy();

    const dispatchPlanner = body.assistants.find((a: { role: string }) => a.role === "dispatch-planner");
    expect(dispatchPlanner.thinking).toEqual({ effort: "medium" });
  });
});
