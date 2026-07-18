"use client";

import { Loader2, Play, Square } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { StatusPill } from "@/components/primitives/StatusPill";
import { Toggle } from "@/components/primitives/Toggle";
import type { TransitScenario } from "@/lib/transit/schemas";

export interface ScenarioPanelProps {
  scenario: TransitScenario;
  isRunning: boolean;
  onStart: () => void;
  onCancel: () => void;
  includeWebSearch: boolean;
  onIncludeWebSearchChange: (checked: boolean) => void;
  mockBackboard: boolean;
}

/** Scenario framing plus the run's start/cancel controls; the entry point into a planning run. */
export function ScenarioPanel({
  scenario,
  isRunning,
  onStart,
  onCancel,
  includeWebSearch,
  onIncludeWebSearchChange,
  mockBackboard,
}: ScenarioPanelProps) {
  return (
    <GlassPanel className="flex flex-col gap-3 p-4" data-testid="scenario-panel">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-twinto-text">{scenario.label}</h2>
        <StatusPill tone="warning" data-testid="synthetic-fixture-badge">synthetic-fixture</StatusPill>
      </div>
      <p className="text-xs leading-relaxed text-twinto-muted">{scenario.description}</p>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-twinto-muted">Station</dt>
          <dd className="text-twinto-text">{scenario.stationId}</dd>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-twinto-muted">Route</dt>
          <dd className="text-twinto-text">{scenario.routeId}</dd>
        </div>
        <div className="col-span-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
          <dt className="text-[10px] uppercase tracking-wide text-twinto-muted">Baseline departures</dt>
          <dd className="text-twinto-text">{scenario.baselineDepartures.join(", ")}</dd>
        </div>
      </dl>

      <Toggle
        label="Include web search"
        description="Lets context-gathering agents look up current public information"
        checked={includeWebSearch}
        onChange={onIncludeWebSearchChange}
        disabled={isRunning}
      />

      {mockBackboard && (
        <StatusPill tone="warning" className="self-start" data-testid="mock-backboard-badge">
          Mock Backboard
        </StatusPill>
      )}

      <button
        type="button"
        onClick={isRunning ? onCancel : onStart}
        data-testid="start-run-button"
        className={
          isRunning
            ? "inline-flex items-center justify-center gap-2 rounded-xl border border-twinto-error/50 bg-twinto-error/10 px-4 py-2.5 text-sm font-semibold text-twinto-error transition-colors hover:bg-twinto-error/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-twinto-error"
            : "inline-flex items-center justify-center gap-2 rounded-xl border border-twinto-red/50 bg-twinto-red/15 px-4 py-2.5 text-sm font-semibold text-twinto-red transition-colors hover:bg-twinto-red/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-twinto-red"
        }
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Cancel run
          </>
        ) : (
          <>
            <Play className="h-4 w-4" />
            Start planning run
          </>
        )}
      </button>
      {isRunning && (
        <p className="inline-flex items-center gap-1.5 text-[11px] text-twinto-muted">
          <Square className="h-3 w-3" />
          The virtual planning department is working through this scenario.
        </p>
      )}
    </GlassPanel>
  );
}
