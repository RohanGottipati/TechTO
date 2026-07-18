"use client";

import { CheckCircle2, Trophy, XCircle } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { EmptyState } from "@/components/feedback/EmptyState";
import { formatCad, formatKg, formatMwh } from "@/lib/gridtwin/format";
import { cn } from "@/lib/utils/cn";
import type { CandidateOutcome } from "@/lib/backboard/orchestrator";
import type { RankedCandidate } from "@/lib/grid/types";

export interface CandidateComparisonProps {
  candidates: CandidateOutcome[];
  ranking: RankedCandidate[];
  chosenCandidateId?: string | null;
}

export function CandidateComparison({
  candidates,
  ranking,
  chosenCandidateId,
}: CandidateComparisonProps) {
  const rankById = new Map(ranking.map((entry) => [entry.candidateId, entry]));

  return (
    <GlassPanel className="flex h-full flex-col p-4" data-testid="candidate-comparison">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#F5F7FA]">Candidate Comparison</h3>
        <span className="text-[11px] text-[#9AA7B5]">Ranked by the deterministic ranker</span>
      </div>

      {candidates.length === 0 ? (
        <div className="mt-3 flex-1">
          <EmptyState
            title="No candidates yet"
            description="Candidate dispatch plans appear here once the Dispatch Planner proposes them and the Risk Reviewer simulates each one."
          />
        </div>
      ) : (
        <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto pr-1">
          {candidates
            .slice()
            .sort((a, b) => (rankById.get(a.candidateId)?.rank ?? 99) - (rankById.get(b.candidateId)?.rank ?? 99))
            .map((candidate) => {
              const rank = rankById.get(candidate.candidateId);
              const isChosen = candidate.candidateId === chosenCandidateId;
              return (
                <div
                  key={candidate.candidateId}
                  className={cn(
                    "rounded-xl border p-3",
                    isChosen
                      ? "border-[#55D8E6]/50 bg-[#55D8E6]/[0.06]"
                      : "border-white/10 bg-white/[0.02]"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {rank?.rank === 1 && !rank.disqualified && (
                        <Trophy className="h-3.5 w-3.5 text-[#F4B860]" />
                      )}
                      <span className="text-sm font-medium text-[#F5F7FA]">
                        {candidate.candidateId}
                      </span>
                      {isChosen && (
                        <span className="rounded-full bg-[#55D8E6]/15 px-1.5 py-0.5 text-[10px] font-medium text-[#55D8E6]">
                          recommended
                        </span>
                      )}
                    </div>
                    {rank && (
                      <span
                        className={cn(
                          "text-[11px] font-medium",
                          rank.disqualified ? "text-[#FF6B6B]" : "text-[#9AA7B5]"
                        )}
                      >
                        {rank.disqualified ? "disqualified" : `rank #${rank.rank}`}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-[#9AA7B5]">{candidate.plan.strategy}</p>
                  {rank?.disqualifyReason && (
                    <p className="mt-1 text-[11px] text-[#FF6B6B]">{rank.disqualifyReason}</p>
                  )}

                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <MetricTile label="Net value" value={formatCad(candidate.simulation.metrics.netValueCad)} />
                    <MetricTile
                      label="Renewable captured"
                      value={formatMwh(candidate.simulation.metrics.renewableCapturedMwh)}
                    />
                    <MetricTile
                      label="Carbon avoided"
                      value={formatKg(candidate.simulation.metrics.carbonAvoidedKg)}
                    />
                    <MetricTile
                      label="Degradation cost"
                      value={formatCad(candidate.simulation.metrics.degradationCostCad)}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                    <ValidityBadge label="Visible data" valid={candidate.simulation.valid} />
                    <ValidityBadge label="Stress test" valid={candidate.stressSimulation.valid} />
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </GlassPanel>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-[#9AA7B5]">{label}</p>
      <p className="text-xs font-medium text-[#F5F7FA]">{value}</p>
    </div>
  );
}

function ValidityBadge({ label, valid }: { label: string; valid: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        valid ? "text-[#55D8E6]" : "text-[#FF6B6B]"
      )}
    >
      {valid ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </span>
  );
}
