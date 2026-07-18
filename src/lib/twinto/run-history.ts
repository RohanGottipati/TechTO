import type { TwinTORunEvent, TwinTORunResult } from "@/lib/twinto/types";

/**
 * Client-only persistence for prior TwinTO planner-agent runs. Purely a
 * convenience so a planner can
 * revisit earlier runs after a page reload; nothing here is authoritative
 * (the citizen-reaction batch and recommendation embedded in `result` are
 * the source of truth, not this cache).
 */
export const RUN_HISTORY_STORAGE_KEY = "twinto:backboard-runs:v1";
const MAX_STORED_RUNS = 20;

export type StoredRunStatus = "running" | "completed" | "failed" | "cancelled";

export interface StoredTwinTORun {
  runId: string;
  scenarioId: string;
  /** The final recommendation headline, once known; null until run.completed. */
  recommendationHeadline: string | null;
  status: StoredRunStatus;
  startedAt: string;
  completedAt: string | null;
  events: TwinTORunEvent[];
  result: TwinTORunResult | null;
  error: string | null;
}

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isStoredTwinTORun(value: unknown): value is StoredTwinTORun {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.runId === "string" &&
    typeof record.scenarioId === "string" &&
    typeof record.status === "string" &&
    typeof record.startedAt === "string" &&
    Array.isArray(record.events)
  );
}

/** Reads the full stored run history, most recent first. Never throws. */
export function loadRunHistory(): StoredTwinTORun[] {
  if (!hasLocalStorage()) {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(RUN_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isStoredTwinTORun);
  } catch {
    return [];
  }
}

function persistRunHistory(runs: StoredTwinTORun[]): void {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    window.localStorage.setItem(
      RUN_HISTORY_STORAGE_KEY,
      JSON.stringify(runs.slice(0, MAX_STORED_RUNS)),
    );
  } catch {
    // Storage may be full or blocked (private browsing); the run history is
    // a convenience cache, so silently drop the write rather than throw.
  }
}

/** Inserts or replaces a run by runId (most recently touched first) and persists. */
export function upsertRun(run: StoredTwinTORun): StoredTwinTORun[] {
  const existing = loadRunHistory().filter((entry) => entry.runId !== run.runId);
  const next = [run, ...existing].slice(0, MAX_STORED_RUNS);
  persistRunHistory(next);
  return next;
}

export function deleteRun(runId: string): StoredTwinTORun[] {
  const next = loadRunHistory().filter((entry) => entry.runId !== runId);
  persistRunHistory(next);
  return next;
}

export function clearRunHistory(): void {
  if (!hasLocalStorage()) {
    return;
  }
  try {
    window.localStorage.removeItem(RUN_HISTORY_STORAGE_KEY);
  } catch {
    // ignore
  }
}
