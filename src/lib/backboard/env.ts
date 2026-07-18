const DEFAULT_BASE_URL = "https://app.backboard.io/api";

export class BackboardConfigError extends Error {}

/**
 * Throws if called from browser code. All Backboard modules are server-only;
 * this is a defense-in-depth check in addition to the folder boundary (client
 * components must call this app's own /api/backboard/* routes, never these
 * modules directly).
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

/**
 * Mock mode is explicit via BACKBOARD_MOCK_MODE, and otherwise defaults to
 * "on" whenever no API key is configured, so local dev, CI, and `npm run
 * check` never require a live Backboard credential.
 */
export function isBackboardMockMode(): boolean {
  const flag = process.env.BACKBOARD_MOCK_MODE?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return getBackboardApiKey().length === 0;
}

export function requireBackboardApiKey(): string {
  const key = getBackboardApiKey();
  if (!key) {
    throw new BackboardConfigError(
      "BACKBOARD_API_KEY is not set. Set it in .env, or leave BACKBOARD_MOCK_MODE unset/true to use the mock adapter.",
    );
  }
  return key;
}
