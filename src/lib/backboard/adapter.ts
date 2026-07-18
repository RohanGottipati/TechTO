import type { BackboardAdapter } from "@/lib/backboard/client";
import { RestBackboardAdapter } from "@/lib/backboard/client";
import { requireBackboardApiKey } from "@/lib/backboard/env";

let cached: BackboardAdapter | null = null;

/** Live Backboard only. Requires BACKBOARD_API_KEY. */
export function getBackboardAdapter(): BackboardAdapter {
  if (!cached) {
    requireBackboardApiKey();
    cached = new RestBackboardAdapter();
  }
  return cached;
}

export function resetBackboardAdapterForTests(): void {
  cached = null;
}
