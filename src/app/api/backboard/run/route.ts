import { z } from "zod";

import { getBackboardAdapter } from "@/lib/backboard/adapter";
import { prepareMockDemoRun } from "@/lib/backboard/mock-demo-run";
import type { MockBackboardAdapter } from "@/lib/backboard/mock-adapter";
import { runGridTwinOrchestration, type GridRunEvent } from "@/lib/backboard/orchestrator";
import { errorMessage, jsonError } from "@/lib/backboard/route-helpers";
import { clientKeyFor, isRunRateLimited } from "@/lib/backboard/run-rate-limit";
import { createSseResponse, createSseStream, toGridRunEventEnvelope } from "@/lib/backboard/sse";
import { objectiveWeightsSchema } from "@/lib/grid/schemas";
import { requireAsset, requireScenario } from "@/lib/grid/fixtures";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 20_000;
const MAX_ID_LENGTH = 80;

const runRequestSchema = z
  .object({
    assetId: z.string().min(1).max(MAX_ID_LENGTH),
    scenarioId: z.string().min(1).max(MAX_ID_LENGTH),
    // Accepted for forward-compatibility with the operator-question route's
    // shape; not yet wired into the orchestrator, which does not thread a
    // webSearch option through its per-agent turns (see runStructuredTurn).
    includeWebSearch: z.boolean().optional(),
    objectiveWeights: objectiveWeightsSchema.optional(),
  })
  .strict();

/**
 * Starts one GridTwin orchestration run and streams its lifecycle as SSE.
 * The response body is a live ReadableStream, so every check that can fail
 * cheaply (rate limit, body size, schema, unknown asset/scenario) happens
 * before the stream is created; once streaming starts, an orchestration
 * failure is reported as a run.failed event by the orchestrator itself
 * rather than as an HTTP error status, since headers are already committed.
 */
export async function POST(request: Request) {
  if (isRunRateLimited(clientKeyFor(request))) {
    return jsonError("Too many run requests. Please wait before starting another run.", 429);
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return jsonError("Request body too large.", 413);
  }

  let json: unknown;
  try {
    json = rawBody.length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    return jsonError("Request body was not valid JSON.", 400);
  }

  const parsed = runRequestSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError("Invalid request body.", 400, { issues: parsed.error.issues });
  }

  const { assetId, scenarioId, objectiveWeights } = parsed.data;
  try {
    requireAsset(assetId);
    requireScenario(scenarioId);
  } catch (error) {
    return jsonError(errorMessage(error), 404);
  }

  let aborted = false;
  request.signal.addEventListener("abort", () => {
    aborted = true;
  });

  // Offline UI runs use the mock adapter with no per-request metadata hook, so
  // script a deterministic demo pipeline (malformed retry, unsafe reject,
  // valid recommend) before the tool loop starts.
  const adapter = getBackboardAdapter();
  if (adapter.mode === "mock") {
    prepareMockDemoRun(adapter as MockBackboardAdapter, assetId, scenarioId);
  }

  let sequence = 0;
  const stream = createSseStream(async (writer) => {
    await runGridTwinOrchestration({
      assetId,
      scenarioId,
      objectiveWeights,
      adapter,
      onEvent: (event: GridRunEvent) => {
        if (aborted || writer.closed) return;
        sequence += 1;
        writer.send(toGridRunEventEnvelope(event, sequence));
      },
    }).catch(() => {
      // runGridTwinOrchestration already emitted a run.failed event with the
      // error message via onEvent above (see orchestrator.ts); swallow the
      // rethrow here so it does not surface as an unhandled stream.error.
    });
  });

  return createSseResponse(stream);
}
