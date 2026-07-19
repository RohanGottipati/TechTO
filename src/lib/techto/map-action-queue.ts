"use client";

import { applyMapActions } from "@/lib/techto/apply-map-actions";
import type { MapAction } from "@/lib/techto/map-actions";

/** Batches from successive compose_map_actions; play in order as they arrive. */
let queue: MapAction[][] = [];
let draining = false;
let gen = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function batchWaitMs(actions: MapAction[]): number {
  let wait = 450; // short beat so draws register before the next batch
  for (const a of actions) {
    if (a.type === "fly_to_center" || a.type === "fit_bounds") {
      wait = Math.max(wait, (a.durationMs ?? 900) + 180);
    }
  }
  return wait;
}

async function drain(myGen: number): Promise<void> {
  if (draining) return;
  draining = true;
  while (queue.length && myGen === gen) {
    const batch = queue.shift()!;
    applyMapActions(batch);
    await sleep(batchWaitMs(batch));
  }
  draining = false;
  // something may have enqueued while we were finishing
  if (queue.length && myGen === gen) void drain(myGen);
}

/** Queue a compose_map_actions batch; starts playing immediately if idle. */
export function enqueueMapActions(actions: MapAction[]): void {
  if (!actions.length) return;
  queue.push(actions);
  void drain(gen);
}

/** Drop pending batches (new user turn). In-flight sleep still finishes harmlessly. */
export function resetMapActionQueue(): void {
  queue = [];
  gen += 1;
  draining = false;
}

export function mapActionQueuePending(): number {
  return queue.length;
}
