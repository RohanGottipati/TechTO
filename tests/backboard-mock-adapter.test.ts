import { describe, expect, it } from "vitest";

import type { BackboardStreamEvent } from "@/lib/backboard/client";
import { MockBackboardAdapter } from "@/lib/backboard/mock-adapter";

describe("MockBackboardAdapter", () => {
  it("completes immediately with empty content when no hints are given", async () => {
    const adapter = new MockBackboardAdapter();
    const result = await adapter.sendMessage({ assistantId: "a1", content: "hello" });
    expect(result.status).toBe("completed");
    expect(result.content).toBe("");
    expect(result.toolCalls).toHaveLength(0);
  });

  it("streams mockContent as content_delta events before completing", async () => {
    const adapter = new MockBackboardAdapter();
    const events: BackboardStreamEvent[] = [];
    const result = await adapter.sendMessage(
      { assistantId: "a1", content: "hello", metadata: { mockContent: "battery is nominal" } },
      (event) => events.push(event),
    );
    expect(result.status).toBe("completed");
    expect(result.content).toBe("battery is nominal");
    const deltas = events.filter((e) => e.type === "content_delta");
    expect(deltas.length).toBeGreaterThan(0);
    expect(deltas.map((e) => (e as { content: string }).content).join("")).toBe("battery is nominal");
    expect(events.some((e) => e.type === "run_ended")).toBe(true);
  });

  it("returns mockJsonResponse verbatim as stringified JSON when requested", async () => {
    const adapter = new MockBackboardAdapter();
    const payload = { verdict: "approve", riskScore: 0.2 };
    const result = await adapter.sendMessage({
      assistantId: "a1",
      content: "review this plan",
      jsonOutput: true,
      metadata: { mockJsonResponse: payload },
    });
    expect(result.status).toBe("completed");
    expect(JSON.parse(result.content ?? "{}")).toEqual(payload);
  });

  it("walks a multi-round mockToolPlan through requires_action then completes", async () => {
    const adapter = new MockBackboardAdapter();
    const first = await adapter.sendMessage({
      assistantId: "a1",
      content: "plan dispatch",
      tools: [],
      metadata: {
        mockToolPlan: [
          [
            { name: "get_market_window", arguments: { hours: 24 } },
            { name: "get_renewable_forecast", arguments: { hours: 24 } },
          ],
          [{ name: "validate_dispatch_plan", arguments: { planId: "p1" } }],
        ],
        mockContent: "final synthesis",
      },
    });
    expect(first.status).toBe("requires_action");
    expect(first.toolCalls.map((c) => c.name)).toEqual(["get_market_window", "get_renewable_forecast"]);
    expect(first.toolCalls[0].arguments).toEqual({ hours: 24 });

    const second = await adapter.submitToolOutputs({
      threadId: first.threadId,
      outputs: first.toolCalls.map((c) => ({ toolCallId: c.id, output: "{}" })),
    });
    expect(second.status).toBe("requires_action");
    expect(second.toolCalls.map((c) => c.name)).toEqual(["validate_dispatch_plan"]);

    const third = await adapter.submitToolOutputs({
      threadId: first.threadId,
      outputs: second.toolCalls.map((c) => ({ toolCallId: c.id, output: "{}" })),
    });
    expect(third.status).toBe("completed");
    expect(third.content).toBe("final synthesis");
  });

  it("creates and lists assistants deterministically by name", async () => {
    const adapter = new MockBackboardAdapter();
    const created = await adapter.createAssistant({ name: "Market Analyst", systemPrompt: "You analyze markets." });
    expect(created.assistantId).toBe("mock-assistant-market-analyst");
    const listed = await adapter.listAssistants();
    expect(listed).toEqual([created]);
  });

  it("filters listModels by capability", async () => {
    const adapter = new MockBackboardAdapter();
    const thinkingModels = await adapter.listModels({ supportsThinking: true });
    expect(thinkingModels.length).toBeGreaterThan(0);
    expect(thinkingModels.every((m) => m.supportsThinking)).toBe(true);
  });

  it("supports full memory CRUD lifecycle", async () => {
    const adapter = new MockBackboardAdapter();
    const added = await adapter.addMemory("a1", "Operator prefers conservative reserve margins.");
    expect(added.content).toContain("conservative reserve margins");

    const listed = await adapter.listMemories("a1");
    expect(listed).toHaveLength(1);

    const found = await adapter.searchMemories("a1", "reserve");
    expect(found).toHaveLength(1);

    const updated = await adapter.updateMemory("a1", added.id, "Operator prefers aggressive reserve margins.");
    expect(updated.content).toContain("aggressive");

    await adapter.deleteMemory("a1", added.id);
    expect(await adapter.listMemories("a1")).toHaveLength(0);

    await adapter.addMemory("a1", "second memory");
    await adapter.resetMemories("a1");
    expect(await adapter.listMemories("a1")).toHaveLength(0);
  });
});
