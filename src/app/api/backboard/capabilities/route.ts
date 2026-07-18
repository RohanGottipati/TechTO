import { NextResponse } from "next/server";

import { getBackboardAdapter } from "@/lib/backboard/adapter";
import { getAssistantManifest } from "@/lib/backboard/assistant-manifest";
import { errorMessage, jsonError } from "@/lib/backboard/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only introspection endpoint: which assistants are configured, which
 * tools/memory/thinking settings each uses, and which model Backboard's
 * capability catalog resolved for each one. Used by the control room UI to
 * show "who is on this run" and by developers to sanity-check model routing.
 */
export async function GET() {
  try {
    const adapter = getBackboardAdapter();
    const manifest = await getAssistantManifest(adapter);
    const models = await adapter.listModels();

    const assistants = Array.from(manifest.values()).map((resolved) => ({
      role: resolved.role.key,
      name: resolved.role.name,
      description: resolved.role.shortDescription,
      assistantId: resolved.record.assistantId,
      toolNames: resolved.role.toolNames,
      memory: resolved.role.memory,
      thinking: resolved.role.thinking ?? null,
      model: {
        provider: resolved.model.provider,
        name: resolved.model.modelName,
        contextLimit: resolved.model.contextLimit,
        reason: resolved.model.reason,
      },
    }));

    return NextResponse.json({
      mode: adapter.mode,
      modelCatalogSize: models.length,
      assistants,
    });
  } catch (error) {
    console.error("Failed to resolve Backboard capabilities:", error);
    return jsonError("Failed to resolve Backboard capabilities.", 500, { detail: errorMessage(error) });
  }
}
