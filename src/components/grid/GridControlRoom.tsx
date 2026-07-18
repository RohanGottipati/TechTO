"use client";

import { useCallback, useMemo, useState } from "react";
import { Loader2, MapPin, Play, RotateCcw, Square } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { AssetStatusHeader } from "@/components/grid/AssetStatusHeader";
import { ScenarioSelector } from "@/components/grid/ScenarioSelector";
import { StateOfChargeChart } from "@/components/grid/StateOfChargeChart";
import { PriceDispatchChart } from "@/components/grid/PriceDispatchChart";
import { RenewableChart } from "@/components/grid/RenewableChart";
import { ConstraintStatus } from "@/components/grid/ConstraintStatus";
import { AgentRunTimeline } from "@/components/grid/AgentRunTimeline";
import { CandidateComparison } from "@/components/grid/CandidateComparison";
import { FinalRecommendation } from "@/components/grid/FinalRecommendation";
import { ExecutiveSummary } from "@/components/grid/ExecutiveSummary";
import { OperatorQuestionPanel } from "@/components/grid/OperatorQuestionPanel";
import { BackboardStatusPanel, type CapabilitiesResponse } from "@/components/grid/BackboardStatusPanel";
import { PreviousRunsPanel } from "@/components/grid/PreviousRunsPanel";
import { ApprovedMemoryPanel } from "@/components/grid/ApprovedMemoryPanel";
import { requireAsset, listScenarios, requireScenario } from "@/lib/grid/fixtures";
import { resolveScenarioConditions } from "@/lib/grid/scenarios";
import { useBackboardRun } from "@/lib/gridtwin/use-backboard-run";
import type { StoredGridRun } from "@/lib/gridtwin/run-history";
import { cn } from "@/lib/utils/cn";

export interface GridControlRoomProps {
  assetId: string;
}

type TabKey = "operator" | "executive" | "evidence" | "runs" | "memory";

const TABS: { key: TabKey; label: string }[] = [
  { key: "operator", label: "Operator Q&A" },
  { key: "executive", label: "Executive Summary" },
  { key: "evidence", label: "Evidence" },
  { key: "runs", label: "Previous Runs" },
  { key: "memory", label: "Memory" },
];

export function GridControlRoom({ assetId }: GridControlRoomProps) {
  const asset = requireAsset(assetId);
  const scenarios = useMemo(() => listScenarios(), []);

  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id ?? "normal-day");
  const [activeTab, setActiveTab] = useState<TabKey>("operator");
  const [viewedRun, setViewedRun] = useState<StoredGridRun | null>(null);
  const [capabilities, setCapabilities] = useState<CapabilitiesResponse | null>(null);

  const run = useBackboardRun();

  const scenario = requireScenario(scenarioId);
  const conditions = useMemo(
    () => resolveScenarioConditions(scenarioId, asset),
    [scenarioId, asset],
  );

  const hasLiveRun = run.isRunning || run.events.length > 0;
  const displayEvents = hasLiveRun ? run.events : viewedRun?.events ?? [];
  const displayResult = run.result ?? (hasLiveRun ? null : viewedRun?.result ?? null);
  const displayRunId = run.runId ?? (hasLiveRun ? null : viewedRun?.runId ?? null);
  const displayError = run.error ?? (hasLiveRun ? null : viewedRun?.error ?? null);

  const chosenCandidateId = displayResult?.effectiveRecommendation.chosenCandidateId ?? null;
  const chosenCandidate = displayResult?.candidates.find(
    (candidate) => candidate.candidateId === chosenCandidateId,
  );

  const handleStart = useCallback(() => {
    setViewedRun(null);
    run.start({ assetId, scenarioId });
  }, [run, assetId, scenarioId]);

  const handleSelectStoredRun = useCallback(
    (stored: StoredGridRun) => {
      if (run.isRunning) return;
      run.reset();
      setViewedRun(stored);
      setScenarioId(stored.scenarioId);
    },
    [run],
  );

  return (
    <div className="flex min-h-full flex-col gap-4 p-3 sm:p-4" data-testid="grid-control-room">
      <AssetStatusHeader
        asset={asset}
        scenarioName={scenario.name}
        isMockMode={capabilities?.mode === "mock"}
        isRunning={run.isRunning}
      />

      <div className="grid flex-1 gap-4 lg:grid-cols-[280px_1fr_320px]">
        {/* Left: map / asset status */}
        <div className="flex flex-col gap-4 lg:order-1">
          <GlassPanel className="p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#6287FF]" />
              <h3 className="text-sm font-semibold text-[#F5F7FA]">Asset Location</h3>
            </div>
            <p className="mt-2 text-xs text-[#9AA7B5]">{asset.location.label}</p>
            <p className="mt-1 text-[11px] text-[#9AA7B5]">
              {asset.location.latitude.toFixed(4)}, {asset.location.longitude.toFixed(4)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <SpecRow label="Rated power" value={`${asset.ratedPowerMw} MW`} />
              <SpecRow label="Usable energy" value={`${asset.usableEnergyMwh} MWh`} />
              <SpecRow label="SOC band" value={`${Math.round(asset.minSocFraction * 100)}-${Math.round(asset.maxSocFraction * 100)}%`} />
              <SpecRow label="Reserve target" value={`${asset.reserveRequirementMw} MW`} />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[#9AA7B5]">
              Simulated asset. Location shown for context only; nothing here reflects live grid
              telemetry.
            </p>
          </GlassPanel>

          <BackboardStatusPanel onCapabilitiesLoaded={setCapabilities} />
        </div>

        {/* Center: charts + constraint status */}
        <div className="flex flex-col gap-4 lg:order-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <StateOfChargeChart
              trace={chosenCandidate?.simulation.trace ?? null}
              minSocFraction={asset.minSocFraction}
              maxSocFraction={asset.maxSocFraction}
            />
            <ConstraintStatus
              simulation={chosenCandidate?.simulation ?? null}
              stressSimulation={chosenCandidate?.stressSimulation ?? null}
            />
          </div>
          <PriceDispatchChart hours={conditions.visibleHours} trace={chosenCandidate?.simulation.trace ?? null} />
          <RenewableChart hours={conditions.visibleHours} />
        </div>

        {/* Right: scenario + run controls + timeline */}
        <div className="flex flex-col gap-4 lg:order-3">
          <ScenarioSelector
            scenarios={scenarios}
            selectedScenarioId={scenarioId}
            onSelect={setScenarioId}
            disabled={run.isRunning}
          />

          <GlassPanel className="p-4">
            <div className="flex items-center gap-2">
              {run.isRunning ? (
                <button
                  type="button"
                  onClick={run.cancel}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#FF6B6B]/40 bg-[#FF6B6B]/10 px-3 py-2 text-sm font-medium text-[#FF6B6B] transition-colors hover:bg-[#FF6B6B]/20"
                >
                  <Square className="h-4 w-4" />
                  Cancel run
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStart}
                  data-testid="start-backboard-run"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#55D8E6]/50 bg-[#55D8E6]/10 px-3 py-2 text-sm font-medium text-[#55D8E6] transition-colors hover:bg-[#55D8E6]/20"
                >
                  <Play className="h-4 w-4" />
                  Start run
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  run.reset();
                  setViewedRun(null);
                }}
                aria-label="Reset control room view"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-[#9AA7B5] transition-colors hover:bg-white/[0.07] hover:text-[#F5F7FA]"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
            {run.isRunning && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-[#55D8E6]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Multi-agent run in progress; this can take a minute.
              </p>
            )}
            {displayError && (
              <p className="mt-2 text-[11px] text-[#FF6B6B]">{displayError}</p>
            )}
            {viewedRun && !hasLiveRun && (
              <p className="mt-2 text-[11px] text-[#9AA7B5]">
                Viewing a saved run from history ({viewedRun.status}).
              </p>
            )}
          </GlassPanel>

          <div className="min-h-[260px] flex-1">
            <AgentRunTimeline events={displayEvents} isRunning={run.isRunning} />
          </div>
        </div>
      </div>

      {/* Bottom tabs */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] p-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              aria-pressed={activeTab === tab.key}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-[#55D8E6]/15 text-[#55D8E6]"
                  : "text-[#9AA7B5] hover:text-[#F5F7FA]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="min-h-[320px]">
          {activeTab === "operator" && (
            <OperatorQuestionPanel assetId={assetId} scenarioId={scenarioId} result={displayResult} />
          )}
          {activeTab === "executive" && <ExecutiveSummary result={displayResult} />}
          {activeTab === "evidence" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <CandidateComparison
                candidates={displayResult?.candidates ?? []}
                ranking={displayResult?.ranking ?? []}
                chosenCandidateId={chosenCandidateId}
              />
              <FinalRecommendation result={displayResult} />
            </div>
          )}
          {activeTab === "runs" && (
            <PreviousRunsPanel
              assetId={assetId}
              onSelectRun={handleSelectStoredRun}
              activeRunId={displayRunId}
            />
          )}
          {activeTab === "memory" && <ApprovedMemoryPanel />}
        </div>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-[#9AA7B5]">{label}</p>
      <p className="text-xs font-medium text-[#F5F7FA]">{value}</p>
    </div>
  );
}
