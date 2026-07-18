import type { AssistantRoleKey } from "@/lib/backboard/assistants";
import type { ResolvedAssistant } from "@/lib/backboard/assistant-manifest";

/**
 * Schema version for the local, informational assistant-manifest snapshot
 * written by `npm run backboard:bootstrap` to `.backboard/assistant-
 * manifest.local.json` (gitignored; see .gitignore). Bump this whenever the
 * shape of `AssistantManifestFile` below changes, so a stale on-disk file
 * from a previous shape is easy to spot rather than silently misread.
 */
export const MANIFEST_SCHEMA_VERSION = 2;

/** Identifies which product wrote the manifest file; TwinTO is the only product in this repository today (see AGENTS.md). */
export const MANIFEST_PRODUCT = "twinto";

export interface AssistantManifestEntry {
  role: AssistantRoleKey;
  name: string;
  assistantId: string;
  toolCount: number;
  memory: string;
  model: {
    provider: string;
    name: string;
    contextLimit: number;
  };
}

export interface AssistantManifestFile {
  schemaVersion: typeof MANIFEST_SCHEMA_VERSION;
  product: typeof MANIFEST_PRODUCT;
  generatedAt: string;
  assistantCount: number;
  assistants: AssistantManifestEntry[];
}

/**
 * Builds the plain-object snapshot written to the local manifest file from a
 * resolved assistant manifest (see assistant-manifest.ts). Pure function so
 * it is trivially testable without touching the filesystem or a Backboard
 * adapter.
 */
export function buildAssistantManifestFile(
  manifest: Map<AssistantRoleKey, ResolvedAssistant> | ResolvedAssistant[],
): AssistantManifestFile {
  const resolved = manifest instanceof Map ? Array.from(manifest.values()) : manifest;

  const assistants: AssistantManifestEntry[] = resolved
    .map((entry) => ({
      role: entry.role.key,
      name: entry.role.name,
      assistantId: entry.record.assistantId,
      toolCount: entry.role.toolNames.length,
      memory: entry.role.memory,
      model: {
        provider: entry.model.provider,
        name: entry.model.modelName,
        contextLimit: entry.model.contextLimit,
      },
    }))
    .sort((a, b) => a.role.localeCompare(b.role));

  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    product: MANIFEST_PRODUCT,
    generatedAt: new Date().toISOString(),
    assistantCount: assistants.length,
    assistants,
  };
}
