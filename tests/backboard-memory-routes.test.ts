import { beforeEach, describe, expect, it } from "vitest";

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("Backboard memory routes", () => {
  beforeEach(async () => {
    process.env.BACKBOARD_MOCK_MODE = "true";
    const { resetBackboardAdapterForTests } = await import("@/lib/backboard/adapter");
    const { resetAssistantManifestForTests } = await import("@/lib/backboard/assistant-manifest");
    resetBackboardAdapterForTests();
    resetAssistantManifestForTests();
  });

  it("lists an empty memory set for a fresh assistant", async () => {
    const { GET } = await import("@/app/api/backboard/memories/route");
    const response = await GET(new Request("http://localhost/api/backboard/memories"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.assistantRole).toBe("chief-dispatch-officer");
    expect(body.memories).toEqual([]);
  });

  it("rejects an unknown assistantRole with 400", async () => {
    const { GET } = await import("@/app/api/backboard/memories/route");
    const response = await GET(new Request("http://localhost/api/backboard/memories?assistantRole=not-a-role"));
    expect(response.status).toBe(400);
  });

  it("adds a memory via POST and reflects it in a subsequent GET", async () => {
    const { GET, POST } = await import("@/app/api/backboard/memories/route");

    const addResponse = await POST(
      jsonRequest("http://localhost/api/backboard/memories", "POST", {
        assistantRole: "chief-dispatch-officer",
        content: "Operator approved conservative reserve margins for evening peaks.",
      }),
    );
    expect(addResponse.status).toBe(201);
    const addBody = await addResponse.json();
    expect(addBody.memory.content).toContain("conservative reserve margins");

    const listResponse = await GET(new Request("http://localhost/api/backboard/memories"));
    const listBody = await listResponse.json();
    expect(listBody.memories).toHaveLength(1);
    expect(listBody.memories[0].id).toBe(addBody.memory.id);
  });

  it("rejects an invalid POST body with 400", async () => {
    const { POST } = await import("@/app/api/backboard/memories/route");
    const response = await POST(jsonRequest("http://localhost/api/backboard/memories", "POST", { content: "" }));
    expect(response.status).toBe(400);
  });

  it("searches memories by query via the search route", async () => {
    const { POST: addMemory } = await import("@/app/api/backboard/memories/route");
    const { POST: search } = await import("@/app/api/backboard/memories/search/route");

    await addMemory(
      jsonRequest("http://localhost/api/backboard/memories", "POST", {
        content: "Operator prefers a 25 MW reserve floor overnight.",
      }),
    );
    await addMemory(
      jsonRequest("http://localhost/api/backboard/memories", "POST", {
        content: "Unrelated note about maintenance scheduling.",
      }),
    );

    const searchResponse = await search(
      jsonRequest("http://localhost/api/backboard/memories/search", "POST", { query: "reserve floor" }),
    );
    expect(searchResponse.status).toBe(200);
    const searchBody = await searchResponse.json();
    expect(searchBody.memories).toHaveLength(1);
    expect(searchBody.memories[0].content).toContain("reserve floor");
  });

  it("updates and deletes a single memory by id", async () => {
    const { POST: addMemory } = await import("@/app/api/backboard/memories/route");
    const { PUT, DELETE: deleteOne } = await import("@/app/api/backboard/memories/[memoryId]/route");

    const added = await (
      await addMemory(jsonRequest("http://localhost/api/backboard/memories", "POST", { content: "original note" }))
    ).json();
    const memoryId = added.memory.id;

    const updateResponse = await PUT(
      jsonRequest(`http://localhost/api/backboard/memories/${memoryId}`, "PUT", { content: "updated note" }),
      { params: { memoryId } },
    );
    expect(updateResponse.status).toBe(200);
    const updateBody = await updateResponse.json();
    expect(updateBody.memory.content).toBe("updated note");

    const deleteResponse = await deleteOne(
      new Request(`http://localhost/api/backboard/memories/${memoryId}`, { method: "DELETE" }),
      { params: { memoryId } },
    );
    expect(deleteResponse.status).toBe(200);

    const { GET } = await import("@/app/api/backboard/memories/route");
    const listBody = await (await GET(new Request("http://localhost/api/backboard/memories"))).json();
    expect(listBody.memories).toHaveLength(0);
  });

  it("requires confirm=true before resetting all memories", async () => {
    const { POST: addMemory, DELETE: resetAll } = await import("@/app/api/backboard/memories/route");
    await addMemory(jsonRequest("http://localhost/api/backboard/memories", "POST", { content: "a note" }));

    const withoutConfirm = await resetAll(new Request("http://localhost/api/backboard/memories", { method: "DELETE" }));
    expect(withoutConfirm.status).toBe(400);

    const withConfirm = await resetAll(
      new Request("http://localhost/api/backboard/memories?confirm=true", { method: "DELETE" }),
    );
    expect(withConfirm.status).toBe(200);

    const { GET } = await import("@/app/api/backboard/memories/route");
    const listBody = await (await GET(new Request("http://localhost/api/backboard/memories"))).json();
    expect(listBody.memories).toHaveLength(0);
  });
});
