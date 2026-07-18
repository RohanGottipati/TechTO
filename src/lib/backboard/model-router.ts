import type { BackboardAdapter, ModelCapability } from "@/lib/backboard/client";

export class ModelRoutingError extends Error {}

export interface ModelRequirement {
  requireTools?: boolean;
  requireThinking?: boolean;
  requireJsonOutput?: boolean;
  minContextTokens?: number;
  /** Provider preference order, most preferred first. Defaults to FALLBACK_PROVIDER_ORDER. */
  preferredProviders?: string[];
}

export interface ModelSelection {
  provider: string;
  modelName: string;
  contextLimit: number;
  reason: string;
}

const FALLBACK_PROVIDER_ORDER = ["anthropic", "openai", "google"];
const CACHE_TTL_MS = 60_000;

let cache: { at: number; models: ModelCapability[] } | null = null;

async function listModelsCached(adapter: BackboardAdapter): Promise<ModelCapability[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.models;
  const models = await adapter.listModels();
  cache = { at: now, models };
  return models;
}

export function clearModelRouterCacheForTests(): void {
  cache = null;
}

/**
 * Picks the best available model for a requirement by querying Backboard's
 * /models capability catalog rather than hard-coding a model name. Falls
 * back through a provider preference order and prefers larger context
 * windows among ties.
 */
export async function selectModel(
  adapter: BackboardAdapter,
  requirement: ModelRequirement,
): Promise<ModelSelection> {
  const models = await listModelsCached(adapter);
  const eligible = models.filter((model) => {
    if (requirement.requireTools && !model.supportsTools) return false;
    if (requirement.requireThinking && !model.supportsThinking) return false;
    if (requirement.requireJsonOutput && !model.supportsJsonOutput) return false;
    if (requirement.minContextTokens && model.contextLimit < requirement.minContextTokens) return false;
    return true;
  });

  if (eligible.length === 0) {
    throw new ModelRoutingError(
      `No model satisfies requirement: ${JSON.stringify(requirement)}. Catalog had ${models.length} models.`,
    );
  }

  const preferenceOrder = requirement.preferredProviders ?? FALLBACK_PROVIDER_ORDER;
  const sorted = [...eligible].sort((a, b) => {
    const rankA = preferenceOrder.indexOf(a.provider);
    const rankB = preferenceOrder.indexOf(b.provider);
    const effectiveA = rankA === -1 ? preferenceOrder.length : rankA;
    const effectiveB = rankB === -1 ? preferenceOrder.length : rankB;
    if (effectiveA !== effectiveB) return effectiveA - effectiveB;
    return b.contextLimit - a.contextLimit;
  });

  const chosen = sorted[0];
  return {
    provider: chosen.provider,
    modelName: chosen.name,
    contextLimit: chosen.contextLimit,
    reason:
      `Selected ${chosen.name} (${chosen.provider}) from ${eligible.length} eligible model(s): ` +
      `tools=${requirement.requireTools ?? false}, thinking=${requirement.requireThinking ?? false}, ` +
      `jsonOutput=${requirement.requireJsonOutput ?? false}.`,
  };
}
