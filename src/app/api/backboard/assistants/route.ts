import { NextResponse } from "next/server";

import { getBackboardAdapter } from "@/lib/backboard/adapter";
import { getAssistantManifest } from "@/lib/backboard/assistant-manifest";
import {
  CONCERT_BUNDLE,
  CORE_SCHEDULE_BUNDLE,
  WEATHER_BUNDLE,
  listAssistantRoles,
} from "@/lib/backboard/assistants";
import { MANIFEST_PRODUCT, MANIFEST_SCHEMA_VERSION } from "@/lib/backboard/manifest-schema";
import { errorMessage, jsonError } from "@/lib/backboard/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lists the TwinTO assistant roster and resolved Backboard ids. Read-only;
 * does not create or mutate assistants (use `npm run backboard:bootstrap`).
 */
export async function GET() {
  try {
    const adapter = getBackboardAdapter();
    const manifest = await getAssistantManifest(adapter);

    const assistants = listAssistantRoles().map((role) => {
      const resolved = manifest.get(role.key);
      return {
        key: role.key,
        name: role.name,
        description: role.shortDescription,
        assistantId: resolved?.record.assistantId ?? null,
        toolNames: role.toolNames,
        memory: role.memory,
      };
    });

    return NextResponse.json({
      product: MANIFEST_PRODUCT,
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      mode: adapter.mode,
      assistantCount: assistants.length,
      bundles: {
        coreSchedule: CORE_SCHEDULE_BUNDLE,
        concert: CONCERT_BUNDLE,
        weather: WEATHER_BUNDLE,
      },
      assistants,
    });
  } catch (error) {
    console.error("Failed to list TwinTO assistants:", error);
    return jsonError("Failed to list TwinTO assistants.", 500, { detail: errorMessage(error) });
  }
}
