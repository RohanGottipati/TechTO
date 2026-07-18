const DEFAULT_BASE_URL = "https://app.backboard.io/api";

export class BackboardConfigError extends Error {}

/**
 * Throws if called from browser code. All Backboard modules are server-only.
 */
export function assertServerOnly(context: string): void {
  if (typeof window !== "undefined") {
    throw new Error(`${context} must never run in the browser.`);
  }
}

export function getBackboardApiKey(): string {
  return process.env.BACKBOARD_API_KEY?.trim() ?? "";
}

export function getBackboardBaseUrl(): string {
  return process.env.BACKBOARD_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
}

export function requireBackboardApiKey(): string {
  const key = getBackboardApiKey();
  if (!key) {
    throw new BackboardConfigError(
      "BACKBOARD_API_KEY is not set. Live Backboard is required (no mock adapter).",
    );
  }
  return key;
}
