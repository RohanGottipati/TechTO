import type { BackboardAdapter } from "@/lib/backboard/client";
import { RestBackboardAdapter } from "@/lib/backboard/client";
import { isBackboardMockMode } from "@/lib/backboard/env";
import { MockBackboardAdapter } from "@/lib/backboard/mock-adapter";

let cached: BackboardAdapter | null = null;

/** Process-wide singleton so in-memory mock state (assistants, memories) is stable across requests. */
export function getBackboardAdapter(): BackboardAdapter {
  if (!cached) {
    cached = isBackboardMockMode()
      ? new MockBackboardAdapter({ streamingDelayMs: 12 })
      : new RestBackboardAdapter();
  }
  return cached;
}

export function resetBackboardAdapterForTests(): void {
  cached = null;
}
