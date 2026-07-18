"use client";

import { useCallback, useRef, useState } from "react";

import { createRunStreamClient, type RunStreamHandle } from "@/lib/backboard/stream-parser";
import type { GridRunEvent, GridRunResult } from "@/lib/backboard/orchestrator";
import {
  upsertRun,
  type StoredGridRun,
  type StoredRunStatus,
} from "@/lib/gridtwin/run-history";

const RUN_ENDPOINT = "/api/backboard/run";

export interface UseBackboardRunState {
  isRunning: boolean;
  runId: string | null;
  events: GridRunEvent[];
  result: GridRunResult | null;
  error: string | null;
}

export interface UseBackboardRunInput {
  assetId: string;
  scenarioId: string;
}

export interface UseBackboardRunResult extends UseBackboardRunState {
  start: (input: UseBackboardRunInput) => void;
  cancel: () => void;
  reset: () => void;
}

const INITIAL_STATE: UseBackboardRunState = {
  isRunning: false,
  runId: null,
  events: [],
  result: null,
  error: null,
};

function isGridRunEvent(value: unknown): value is GridRunEvent {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.type === "string" && typeof record.runId === "string";
}

function toStoredRun(params: {
  previous: StoredGridRun | null;
  runId: string;
  assetId: string;
  scenarioId: string;
  status: StoredRunStatus;
  events: GridRunEvent[];
  result: GridRunResult | null;
  error: string | null;
}): StoredGridRun {
  const terminal = params.status !== "running";
  return {
    runId: params.runId,
    assetId: params.assetId,
    scenarioId: params.scenarioId,
    status: params.status,
    startedAt: params.previous?.startedAt ?? new Date().toISOString(),
    completedAt: terminal ? new Date().toISOString() : null,
    events: params.events,
    result: params.result,
    error: params.error,
  };
}

/**
 * Wraps a StoredGridRun mutable cell behind function calls (rather than bare
 * `.current` reads), which keeps `if (cell.get())` narrowing simple and
 * avoids relying on TypeScript's control-flow narrowing across the
 * intervening closures a streaming hook like this one inevitably has.
 */
function createStoredRunCell(): {
  get: () => StoredGridRun | null;
  set: (value: StoredGridRun | null) => void;
} {
  let value: StoredGridRun | null = null;
  return {
    get: () => value,
    set: (next) => {
      value = next;
    },
  };
}

/**
 * Drives one GridTwin control room run end-to-end via the shared
 * src/lib/backboard/stream-parser.ts client: POSTs to /api/backboard/run,
 * consumes the validated BackboardRunEventEnvelope stream, and unwraps
 * `envelope.payload` back into a GridRunEvent (see sse.ts's
 * toGridRunEventEnvelope, which sends the event verbatim as the payload).
 * Run state is also mirrored into localStorage (via run-history.ts) as it
 * progresses, so a reload mid-run still shows something in Previous Runs.
 */
export function useBackboardRun(): UseBackboardRunResult {
  const [state, setState] = useState<UseBackboardRunState>(INITIAL_STATE);
  const handleRef = useRef<RunStreamHandle | null>(null);
  const cancelledRef = useRef(false);
  const storedRunCellRef = useRef(createStoredRunCell());

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    handleRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    cancelledRef.current = false;
    handleRef.current?.abort();
    handleRef.current = null;
    storedRunCellRef.current.set(null);
    setState(INITIAL_STATE);
  }, []);

  const start = useCallback((input: UseBackboardRunInput) => {
    handleRef.current?.abort();
    cancelledRef.current = false;
    const storedRunCell = storedRunCellRef.current;
    storedRunCell.set(null);

    let events: GridRunEvent[] = [];
    let result: GridRunResult | null = null;
    let error: string | null = null;
    let runId: string | null = null;

    setState({ isRunning: true, runId: null, events: [], result: null, error: null });

    function persist(status: StoredRunStatus) {
      if (!runId) return;
      const nextStored = toStoredRun({
        previous: storedRunCell.get(),
        runId,
        assetId: input.assetId,
        scenarioId: input.scenarioId,
        status,
        events,
        result,
        error,
      });
      storedRunCell.set(nextStored);
      upsertRun(nextStored);
    }

    handleRef.current = createRunStreamClient({
      url: RUN_ENDPOINT,
      body: input,
      onEvent: (envelope) => {
        if (!isGridRunEvent(envelope.payload)) {
          return;
        }
        const event = envelope.payload;
        runId = event.runId || envelope.runId || runId;
        events = [...events, event];
        if (event.type === "run.completed") {
          result = event.result;
        } else if (event.type === "run.failed") {
          error = event.error;
        }

        persist("running");
        setState({ isRunning: true, runId, events, result, error });
      },
      onError: (streamError) => {
        error = streamError.message;
        persist("failed");
        setState({ isRunning: false, runId, events, result, error });
      },
      onDone: () => {
        const status: StoredRunStatus = cancelledRef.current ? "cancelled" : error ? "failed" : "completed";
        persist(status);
        setState({ isRunning: false, runId, events, result, error });
      },
    });
  }, []);

  return { ...state, start, cancel, reset };
}
