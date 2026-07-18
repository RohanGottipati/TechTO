"use client";

import { AlertTriangle, Award, ShieldAlert } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusPill } from "@/components/primitives/StatusPill";
import { formatConfidence } from "@/lib/gridtwin/format";
import { cn } from "@/lib/utils/cn";
import type { GridRunResult } from "@/lib/backboard/orchestrator";

const ACTION_LABEL: Record<string, string> = {
  approve: "Approve",
  approve_with_monitoring: "Approve with monitoring",
  hold_for_operator: "Hold for operator",
};

export interface FinalRecommendationProps {
  result: GridRunResult | null;
}

export function FinalRecommendation({ result }: FinalRecommendationProps) {
  return (
    <GlassPanel className="flex h-full flex-col p-4" data-testid="final-recommendation">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-[#55D8E6]" />
          <h3 className="text-sm font-semibold text-[#F5F7FA]">Final Recommendation</h3>
        </div>
      </div>

      {!result ? (
        <div className="mt-3 flex-1">
          <EmptyState
            title="No recommendation yet"
            description="The Chief Dispatch Officer's recommendation appears here once a run completes."
          />
        </div>
      ) : (
        <div className="mt-3 flex-1 space-y-3 overflow-y-auto pr-1">
          {result.recommendationOverridden && (
            <div className="flex items-start gap-2 rounded-lg border border-[#FF6B6B]/30 bg-[#FF6B6B]/[0.06] px-3 py-2">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FF6B6B]" />
              <p className="text-xs text-[#FF6B6B]">
                Safety override: the deterministic validator overruled the AI recommendation.{" "}
                {result.overrideReason}
              </p>
            </div>
          )}

          {!result.recommendationOverridden && result.rankDisagreement && (
            <div className="flex items-start gap-2 rounded-lg border border-[#F4B860]/30 bg-[#F4B860]/[0.06] px-3 py-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F4B860]" />
              <p className="text-xs text-[#F4B860]">
                The Chief Dispatch Officer chose a valid candidate that is not the top-ranked
                deterministic candidate. This is a soft signal, not an override.
              </p>
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-[#F5F7FA]">
                {result.effectiveRecommendation.headline}
              </span>
              <StatusPill tone={result.recommendationOverridden ? "warning" : "ready"}>
                {ACTION_LABEL[result.effectiveRecommendation.recommendedAction] ??
                  result.effectiveRecommendation.recommendedAction}
              </StatusPill>
            </div>
            <p className="mt-1 text-xs text-[#9AA7B5]">
              Chosen candidate: {result.effectiveRecommendation.chosenCandidateId} &middot; confidence{" "}
              {formatConfidence(result.effectiveRecommendation.confidence)}
            </p>
          </div>

          <p className="text-sm leading-relaxed text-[#F5F7FA]/90">
            {result.effectiveRecommendation.reasoning}
          </p>

          {result.effectiveRecommendation.tradeoffs.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[#9AA7B5]">Tradeoffs</p>
              <ul className="mt-1 space-y-1">
                {result.effectiveRecommendation.tradeoffs.map((tradeoff, index) => (
                  <li
                    key={index}
                    className={cn("text-xs text-[#F5F7FA]/80 before:mr-1.5 before:text-[#55D8E6] before:content-['\u2022']")}
                  >
                    {tradeoff}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-[#9AA7B5]">
            This is decision support, not real battery control: no command is ever sent to
            physical hardware. Estimated carbon and revenue figures come from the deterministic
            simulator over fixture data, not live meters.
          </p>
        </div>
      )}
    </GlassPanel>
  );
}
