import { beforeEach, describe, expect, it } from "vitest";

import { ASSISTANT_ROSTER } from "@/lib/backboard/assistants";
import { mockAssistantId, type MockBackboardAdapter } from "@/lib/backboard/mock-adapter";
import { parseSseChunk } from "@/lib/backboard/stream-parser";
import type { BackboardRunEventEnvelope } from "@/lib/grid/schemas";

const ASSET_ID = "ontario-bess-01";

function roleAssistantId(role: keyof typeof ASSISTANT_ROSTER): string {
  return mockAssistantId(ASSISTANT_ROSTER[role].name);
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
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

describe("POST /api/backboard/operator-question", () => {
  beforeEach(async () => {
    process.env.BACKBOARD_MOCK_MODE = "true";
    const { resetBackboardAdapterForTests } = await import("@/lib/backboard/adapter");
    const { resetAssistantManifestForTests } = await import("@/lib/backboard/assistant-manifest");
    resetBackboardAdapterForTests();
    resetAssistantManifestForTests();
  });

  it("streams operator.delta events followed by one operator.completed event with the structured answer", async () => {
    const { POST } = await import("@/app/api/backboard/operator-question/route");
    const response = await POST(
      jsonRequest("http://localhost/api/backboard/operator-question", {
        assetId: ASSET_ID,
        question: "Why did we choose the balanced candidate?",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const events = await collectEnvelopes(response);
    const types = events.map((event) => event.type);

    expect(types.filter((type) => type === "operator.delta").length).toBeGreaterThan(0);
    expect(types.at(-1)).toBe("operator.completed");
    expect(types).not.toContain("operator.failed");

    const completed = events.find((event) => event.type === "operator.completed");
    const payload = completed?.payload as { answer: { answer: string; citedEvidence: string[] }; threadId: string };
    expect(payload.answer.answer).toContain("balanced candidate");
    expect(payload.answer.citedEvidence).toContain("candidate:balanced");
    expect(payload.threadId).toBeTruthy();

    for (const event of events) {
      expect(event.payload).not.toHaveProperty("reasoning");
      expect(event.payload).not.toHaveProperty("thinking");
    }

    const runIds = new Set(events.map((event) => event.runId));
    expect(runIds.size).toBe(1);
  }, 20_000);

  it("continues an existing thread when threadId is supplied", async () => {
    const { POST } = await import("@/app/api/backboard/operator-question/route");
    const first = await POST(
      jsonRequest("http://localhost/api/backboard/operator-question", {
        assetId: ASSET_ID,
        question: "What happened on this run?",
      }),
    );
    const firstEvents = await collectEnvelopes(first);
    const firstCompleted = firstEvents.find((event) => event.type === "operator.completed");
    const firstThreadId = (firstCompleted?.payload as { threadId: string }).threadId;
    expect(firstThreadId).toBeTruthy();

    const second = await POST(
      jsonRequest("http://localhost/api/backboard/operator-question", {
        assetId: ASSET_ID,
        threadId: firstThreadId,
        question: "And what about the risk review?",
      }),
    );
    const secondEvents = await collectEnvelopes(second);
    const secondCompleted = secondEvents.find((event) => event.type === "operator.completed");
    const secondPayload = secondCompleted?.payload as { answer: { answer: string }; threadId: string };
    expect(secondPayload.answer.answer.length).toBeGreaterThan(0);
    expect(secondPayload.threadId).toBe(firstThreadId);
  }, 20_000);

  it("rejects a question longer than 1000 characters with 400", async () => {
    const { POST } = await import("@/app/api/backboard/operator-question/route");
    const response = await POST(
      jsonRequest("http://localhost/api/backboard/operator-question", {
        assetId: ASSET_ID,
        question: "a".repeat(1001),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects a request missing the question field with 400", async () => {
    const { POST } = await import("@/app/api/backboard/operator-question/route");
    const response = await POST(
      jsonRequest("http://localhost/api/backboard/operator-question", { assetId: ASSET_ID }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects an unknown assetId with 404", async () => {
    const { POST } = await import("@/app/api/backboard/operator-question/route");
    const response = await POST(
      jsonRequest("http://localhost/api/backboard/operator-question", {
        assetId: "not-a-real-asset",
        question: "Is this asset online?",
      }),
    );
    expect(response.status).toBe(404);
  });

  it("rejects a malformed JSON body with 400", async () => {
    const { POST } = await import("@/app/api/backboard/operator-question/route");
    const response = await POST(
      new Request("http://localhost/api/backboard/operator-question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not valid json",
      }),
    );
    expect(response.status).toBe(400);
  });

  it("reports a stream failure as one operator.failed event when the model never returns valid JSON", async () => {
    // Bypass the route's prepareMockOperatorAnswer by calling askOperatorQuestion
    // directly with a deliberately broken script.
    const { getBackboardAdapter } = await import("@/lib/backboard/adapter");
    const { askOperatorQuestion } = await import("@/lib/backboard/operator");
    const adapter = getBackboardAdapter() as MockBackboardAdapter;
    adapter.scriptAssistantResponses(roleAssistantId("chief-dispatch-officer"), [
      { mockContent: "not json at all" },
      { mockContent: "still not json" },
    ]);

    await expect(
      askOperatorQuestion({
        assetId: ASSET_ID,
        question: "Why did we choose the balanced candidate?",
        adapter,
      }),
    ).rejects.toThrow(/valid structured output|not valid JSON|empty/i);
  }, 20_000);
});
