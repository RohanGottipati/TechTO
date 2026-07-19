"use client";

import { useMemo } from "react";
import { Gauge } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { PassengerArrivalChart } from "@/components/twinto/PassengerArrivalChart";
import { DepartureLoadChart } from "@/components/twinto/DepartureLoadChart";
import { simulateTransit } from "@/lib/transit/simulator";
import type { TransitScenario } from "@/lib/transit/schemas";

const BASELINE_SEED = 20260718;

export interface BaselinePanelProps {
  scenario: TransitScenario;
  problemSummary?: string | null;
  baselineSummary?: string | null;
}

/**
 * The no-intervention baseline, recomputed client-side with the same
 * deterministic simulator and seed the orchestrator uses server-side (see
 * `runTwinTOOrchestration`'s `baselineSimulation`), since the run result
 * payload only carries the baseline as narrated text, not the raw metrics.
 */
export function BaselinePanel({ scenario, problemSummary, baselineSummary }: BaselinePanelProps) {
  const baseline = useMemo(
    () => simulateTransit({ schemaVersion: 1, scenario, intervention: null, stressOverlay: null, seed: BASELINE_SEED }),
    [scenario],
  );

  return (
    <GlassPanel className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Gauge className="h-4 w-4 text-twinto-red" />
        <h3 className="text-sm font-semibold text-twinto-text">Baseline: {scenario.label}</h3>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-white/5 bg-white/[0.02] py-2">
          <p className="text-lg font-semibold text-twinto-text">{baseline.metrics.meanWaitMinutes.toFixed(1)}m</p>
          <p className="text-[10px] uppercase tracking-wide text-twinto-muted">mean wait</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] py-2">
          <p className="text-lg font-semibold text-twinto-text">{baseline.metrics.deniedBoardings}</p>
          <p className="text-[10px] uppercase tracking-wide text-twinto-muted">denied boardings</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] py-2">
          <p className="text-lg font-semibold text-twinto-text">{baseline.metrics.loadImbalance.toFixed(2)}</p>
          <p className="text-[10px] uppercase tracking-wide text-twinto-muted">load imbalance</p>
        </div>
      </div>

      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wide text-twinto-muted">Passenger arrivals</p>
        <PassengerArrivalChart arrivalsByMinute={scenario.arrivalsByMinute} baselineDepartures={scenario.baselineDepartures} />
      </div>

      <div>
        <p className="mb-1 text-[11px] uppercase tracking-wide text-twinto-muted">Departure loads</p>
        <DepartureLoadChart departureLoads={baseline.departureLoads} />
      </div>

      {(problemSummary || baselineSummary) && (
        <div className="space-y-1.5 border-t border-white/10 pt-2 text-xs leading-relaxed text-twinto-muted">
          {problemSummary && <p>{problemSummary}</p>}
          {baselineSummary && <p>{baselineSummary}</p>}
        </div>
      )}

      <p className="text-[10px] text-twinto-muted">
        Deterministic simulator output over the synthetic-fixture scenario, not a live TTC feed.
      </p>
    </GlassPanel>
  );
}
