"use client";

import { FileText } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { EmptyState } from "@/components/feedback/EmptyState";
import type { GridRunResult } from "@/lib/backboard/orchestrator";
import { formatCad, formatKg, formatMwh } from "@/lib/gridtwin/format";

export interface ExecutiveSummaryProps {
  result: GridRunResult | null;
}

/**
 * Operator-facing synthesis. Numeric fields are read only from the chosen
 * candidate's deterministic SimulationMetrics; this component never invents
 * figures or asks a model to recalculate them.
 */
export function ExecutiveSummary({ result }: ExecutiveSummaryProps) {
  const chosen = result
    ? result.candidates.find(
        (candidate) => candidate.candidateId === result.effectiveRecommendation.chosenCandidateId,
      )
    : null;
  const metrics = chosen?.simulation.metrics ?? null;
  const review = result
    ? result.riskReviews.find((entry) => entry.candidateId === result.effectiveRecommendation.chosenCandidateId)
    : null;

  return (
    <GlassPanel className="flex h-full flex-col p-4" data-testid="executive-summary">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-[#55D8E6]" />
        <h3 className="text-sm font-semibold text-[#F5F7FA]">Executive Summary</h3>
      </div>

      {!result || !metrics ? (
        <div className="mt-3 flex-1">
          <EmptyState
            title="Nothing to summarize yet"
            description="Run the control room to generate a plain-language summary with simulator-backed metrics."
          />
        </div>
      ) : (
        <div className="mt-3 flex-1 space-y-4 overflow-y-auto pr-1">
          <p className="text-sm leading-relaxed text-[#F5F7FA]/90">
            {result.effectiveRecommendation.reasoning}
          </p>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              label="Simulated net value"
              value={formatCad(metrics.netValueCad)}
              testId="exec-net-value"
            />
            <MetricTile
              label="Renewable captured"
              value={formatMwh(metrics.renewableCapturedMwh)}
              testId="exec-renewable"
            />
            <MetricTile
              label="Estimated carbon avoided"
              value={formatKg(metrics.carbonAvoidedKg)}
              testId="exec-carbon"
            />
            <MetricTile
              label="Degradation proxy"
              value={formatCad(metrics.degradationCostCad)}
              testId="exec-degradation"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard
              label="Safety result"
              headline={
                result.recommendationOverridden
                  ? "Overridden for safety"
                  : result.effectiveRecommendation.recommendedAction === "hold_for_operator"
                    ? "Hold for operator"
                    : "Clear (hard-valid)"
              }
              summary={
                result.overrideReason ??
                "Chosen candidate passed deterministic validation on fixture data."
              }
            />
            <SummaryCard
              label="Main risk"
              headline={review?.riskLevel ?? "unknown"}
              summary={review?.concerns[0] ?? review?.summary ?? "No candidate-specific risk flagged."}
            />
          </div>

          {result.hiddenStressDescription && (
            <div className="rounded-lg border border-[#F4B860]/30 bg-[#F4B860]/[0.06] px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-[#F4B860]">
                Hidden stress applied to this scenario
              </p>
              <p className="mt-1 text-xs text-[#F5F7FA]/85">{result.hiddenStressDescription}</p>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-[#9AA7B5]">
            Simulated decision support only. Figures are estimates from a deterministic simulator
            over fixture market and weather data for {result.scenarioId}, not a live forecast or a
            real dispatch instruction. Carbon values are estimated.
          </p>
        </div>
      )}
    </GlassPanel>
  );
}

function MetricTile({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3" data-testid={testId}>
      <p className="text-[10px] uppercase tracking-wide text-[#9AA7B5]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#F5F7FA]">{value}</p>
    </div>
  );
}

function SummaryCard({
  label,
  headline,
  summary,
}: {
  label: string;
  headline: string;
  summary: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wide text-[#9AA7B5]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[#F5F7FA]">{headline}</p>
      <p className="mt-1 text-xs leading-relaxed text-[#9AA7B5]">{summary}</p>
    </div>
  );
}
