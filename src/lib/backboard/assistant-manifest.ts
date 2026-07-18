import { getBackboardAdapter } from "@/lib/backboard/adapter";
import { ASSISTANT_ROSTER, type AssistantRoleDefinition, type AssistantRoleKey } from "@/lib/backboard/assistants";
import type { AssistantRecord, BackboardAdapter } from "@/lib/backboard/client";
import { selectModel, type ModelSelection } from "@/lib/backboard/model-router";
import { getToolDefinitions } from "@/lib/backboard/tools";

export interface ResolvedAssistant {
  role: AssistantRoleDefinition;
  record: AssistantRecord;
  model: ModelSelection;
}

type Manifest = Map<AssistantRoleKey, ResolvedAssistant>;

let manifestCache: Manifest | null = null;
let manifestPromise: Promise<Manifest> | null = null;

async function resolveRole(
  adapter: BackboardAdapter,
  role: AssistantRoleDefinition,
  existingByName: Map<string, AssistantRecord>,
): Promise<ResolvedAssistant> {
  const tools = getToolDefinitions(role.toolNames);
  const existing = existingByName.get(role.name);

  const [record, model] = await Promise.all([
    existing
      ? adapter.updateAssistant(existing.assistantId, {
          name: role.name,
          systemPrompt: role.systemPrompt,
          tools,
        })
      : adapter.createAssistant({ name: role.name, systemPrompt: role.systemPrompt, tools }),
    selectModel(adapter, role.modelRequirement),
  ]);

  return { role, record, model };
}

async function buildManifest(adapter: BackboardAdapter): Promise<Manifest> {
  const existing = await adapter.listAssistants();
  const existingByName = new Map(existing.map((a) => [a.name, a]));

  const roles = Object.values(ASSISTANT_ROSTER);
  const resolved = await Promise.all(roles.map((role) => resolveRole(adapter, role, existingByName)));

  const manifest: Manifest = new Map();
  for (const entry of resolved) {
    manifest.set(entry.role.key, entry);
  }
  return manifest;
}

/**
 * Resolves the full assistant roster against Backboard (or the mock
 * adapter): find-or-create each assistant by name, keep its system prompt and
 * tools in sync, and pick a model per role. Cached for the lifetime of the
 * server process so this network round trip happens at most once.
 */
export async function getAssistantManifest(adapter: BackboardAdapter = getBackboardAdapter()): Promise<Manifest> {
  if (manifestCache) return manifestCache;
  if (!manifestPromise) {
    manifestPromise = buildManifest(adapter)
      .then((manifest) => {
        manifestCache = manifest;
        return manifest;
      })
      .catch((error: unknown) => {
        manifestPromise = null;
        throw error;
      });
  }
  return manifestPromise;
}

export async function resolveAssistant(
  role: AssistantRoleKey,
  adapter: BackboardAdapter = getBackboardAdapter(),
): Promise<ResolvedAssistant> {
  const manifest = await getAssistantManifest(adapter);
  const resolved = manifest.get(role);
  if (!resolved) {
    throw new Error(`Assistant role "${role}" is not in the manifest.`);
  }
  return resolved;
}

export function resetAssistantManifestForTests(): void {
  manifestCache = null;
  manifestPromise = null;
}
