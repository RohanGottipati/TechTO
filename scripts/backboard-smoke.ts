/**
 * Live smoke test against the real Backboard API. Exercises, in order:
 *   1. Key validation (implicit, via listing models).
 *   2. Listing models (the same capability catalog model-routing.md
 *      describes).
 *   3. One short, cheap message to a resolved assistant (no tools).
 *   4. One real tool-call round trip (get_network_snapshot via the normal
 *      tool loop and dispatcher, so it exercises the same code path a real
 *      orchestration run uses).
 *   5. One read-only memory list call (never a write).
 *
 * Skips itself cleanly (exit code 0) when no BACKBOARD_API_KEY is
 * configured, or when BACKBOARD_MOCK_MODE is explicitly true, since there
 * is nothing live to smoke-test in that case. Never prints the API key or
 * any other secret; only reports whether one is configured.
 *
 * Usage: npm run backboard:smoke
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadDotEnv(repoRoot: string): void {
  for (const filename of [".env.local", ".env"]) {
    const filePath = path.join(repoRoot, filename);
    if (!existsSync(filePath)) continue;
    const lines = readFileSync(filePath, "utf-8").split("\n");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

const repoRoot = path.resolve(__dirname, "..");
loadDotEnv(repoRoot);

const SMOKE_TEST_SCENARIO_ID = "departure-406-412";

async function main(): Promise<void> {
  const { isBackboardMockMode, getBackboardApiKey } = await import("@/lib/backboard/env");

  const hasKey = getBackboardApiKey().length > 0;
  if (!hasKey || isBackboardMockMode()) {
    console.log(
      "Skipping live smoke test: no BACKBOARD_API_KEY configured, or BACKBOARD_MOCK_MODE " +
        "is explicitly true. Set BACKBOARD_API_KEY and unset/disable BACKBOARD_MOCK_MODE to run this live.",
    );
    return;
  }

  const { RestBackboardAdapter } = await import("@/lib/backboard/client");
  const { resolveAssistant } = await import("@/lib/backboard/assistant-manifest");
  const { getToolDefinitions, TOOL_NAMES } = await import("@/lib/backboard/tools");
  const { runToolLoop } = await import("@/lib/backboard/run-tool-loop");
  const { createRunContext } = await import("@/lib/backboard/tool-dispatcher");

  const adapter = new RestBackboardAdapter();
  let step = "";

  try {
    step = "1/4 validating key and listing models";
    console.log(`[${step}]`);
    const models = await adapter.listModels();
    console.log(`  ok: ${models.length} model(s) in the catalog.`);

    step = "resolving one assistant (problem-definition)";
    console.log(`[${step}]`);
    const resolved = await resolveAssistant("problem-definition", adapter);
    console.log(`  ok: assistantId=${resolved.record.assistantId}, model=${resolved.model.provider}/${resolved.model.modelName}`);

    step = "2/4 sending one cheap message (no tools)";
    console.log(`[${step}]`);
    const messageResult = await adapter.sendMessage({
      assistantId: resolved.record.assistantId,
      content: "Reply with exactly this text and nothing else: SMOKE_OK",
      systemPrompt: "You are a smoke-test assistant. Follow the user's formatting instruction exactly.",
      modelName: resolved.model.modelName,
      llmProvider: resolved.model.provider,
      jsonOutput: false,
    });
    console.log(`  ok: status=${messageResult.status}, content=${JSON.stringify(messageResult.content)}`);

    step = "3/4 making one real tool-call round trip (get_network_snapshot)";
    console.log(`[${step}]`);
    const context = createRunContext(SMOKE_TEST_SCENARIO_ID, adapter);
    const toolResult = await runToolLoop({
      adapter,
      assistantId: resolved.record.assistantId,
      content: `Call get_network_snapshot, then reply with exactly how many stations it returned and nothing else.`,
      tools: getToolDefinitions([TOOL_NAMES.GET_NETWORK_SNAPSHOT]),
      modelName: resolved.model.modelName,
      llmProvider: resolved.model.provider,
      jsonOutput: false,
      context,
      maxRounds: 3,
    });
    console.log(
      `  ok: status=${toolResult.finalResult.status}, rounds=${toolResult.rounds}, ` +
        `toolCalls=${toolResult.toolCallLog.length}, content=${JSON.stringify(toolResult.finalResult.content)}`,
    );

    step = "4/4 reading (read-only) memory";
    console.log(`[${step}]`);
    const memories = await adapter.listMemories(resolved.record.assistantId);
    console.log(`  ok: ${memories.length} memory record(s) on file (no write performed).`);

    console.log("");
    console.log("Backboard live smoke test passed.");
  } catch (error) {
    console.error(`Backboard live smoke test failed during step: ${step}`);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error("Backboard smoke test crashed unexpectedly:");
  console.error(error);
  process.exitCode = 1;
});
