import { FreeSoloCitizenReactionProvider } from "@/lib/citizen-reaction/freesolo-provider";
import type { CitizenReactionBatchInput, CitizenReactionBatchResult, ProviderStatus } from "@/lib/citizen-reaction/schemas";

export class CitizenReactionProviderConfigError extends Error {}

/**
 * Population-simulator boundary (AGENTS.md 4.3). Live FreeSolo only; no mock.
 */
export interface CitizenReactionProvider {
  predictBatch(input: CitizenReactionBatchInput): Promise<CitizenReactionBatchResult>;
  getStatus(): Promise<ProviderStatus>;
}

export function getCitizenReactionProviderMode(): string {
  return process.env.TECHTO_CITIZEN_REACTION_PROVIDER?.trim().toLowerCase() || "freesolo";
}

export function getCitizenReactionProvider(): CitizenReactionProvider {
  const mode = getCitizenReactionProviderMode();
  if (mode === "freesolo" || mode === "live") {
    return new FreeSoloCitizenReactionProvider();
  }
  throw new CitizenReactionProviderConfigError(
    `Unknown TECHTO_CITIZEN_REACTION_PROVIDER "${mode}". Supported: "freesolo" (live only; no mock).`,
  );
}
