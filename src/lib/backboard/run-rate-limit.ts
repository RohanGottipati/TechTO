const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

let requestTimestampsByClient = new Map<string, number[]>();

export function isRunRateLimited(clientKey: string): boolean {
  const now = Date.now();
  const recent = (requestTimestampsByClient.get(clientKey) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );
  recent.push(now);
  requestTimestampsByClient.set(clientKey, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

export function resetRunRateLimiterForTests(): void {
  requestTimestampsByClient = new Map();
}

export function clientKeyFor(request: Request): string {
  return request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "local";
}
