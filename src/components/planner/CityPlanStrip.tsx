"use client";

import { useState } from "react";
import { CANNED_CITY_ASKS } from "@/lib/planner/canned";
import { cn } from "@/lib/utils/cn";
import { useMapStore } from "@/store/useMapStore";

export interface CityPlanRankingRow {
  id: string;
  title: string;
  mean: number;
  supportShare: number;
}

export interface CityPlanRunSummary {
  question: string;
  ranking: CityPlanRankingRow[];
  chosenId: string;
  summary: string;
  backboardMode: string;
  populationMode: string;
  participatingAgents: string[];
  events: string[];
}

export function useCityPlanRun() {
  const [summary, setSummary] = useState<CityPlanRunSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(question: string) {
    setIsRunning(true);
    setError(null);
    const agentOverlays = useMapStore.getState().agentOverlays;
    const response = await fetch("/api/planner/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, seed: 2262, agentOverlays }),
    });
    if (!response.ok) {
      const errText = await response.text();
      setIsRunning(false);
      setError(`planner run failed (${response.status})`);
      throw new Error(errText || `planner run failed (${response.status})`);
    }
    const payload = await response.json();
    const next: CityPlanRunSummary = {
      question: payload.question,
      ranking: payload.ranking ?? [],
      chosenId: payload.chosenId,
      summary: payload.summary ?? "",
      backboardMode: payload.backboardMode,
      populationMode: payload.populationMode,
      participatingAgents: payload.participatingAgents ?? [],
      events: (payload.events ?? []).map((e: { type: string }) => e.type),
    };
    setSummary(next);
    setIsRunning(false);
    return payload;
  }

  return { summary, isRunning, error, start, setSummary, cannedAsks: CANNED_CITY_ASKS };
}

export function CityPlanStrip({
  summary,
  isRunning,
}: {
  summary: CityPlanRunSummary | null;
  isRunning: boolean;
}) {
  if (!summary && !isRunning) return null;
  return (
    <div
      className="pointer-events-auto w-full max-w-3xl border border-hairline bg-panel/95 px-3 py-2 text-[11px] text-ink-dim backdrop-blur"
      data-testid="city-plan-strip"
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="font-ui text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-bright">
          City plan
        </span>
        {summary && (
          <>
            <Badge label={`Backboard ${summary.backboardMode}`} />
            <Badge label={`citizens ${summary.populationMode}`} />
            <Badge label={`${summary.participatingAgents.length} agents`} />
          </>
        )}
        {isRunning && <span className="text-muted">running principled roster…</span>}
      </div>
      {summary && summary.ranking.length > 0 && (
        <ol className="space-y-1">
          {summary.ranking.map((row, i) => (
            <li
              key={row.id}
              className={cn(
                "flex justify-between gap-2",
                row.id === summary.chosenId ? "text-ink-bright" : "text-muted",
              )}
            >
              <span>
                {i + 1}. {row.title}
                {row.id === summary.chosenId ? " · chosen" : ""}
              </span>
              <span className="font-mono">
                mean {row.mean.toFixed(2)} · support {(row.supportShare * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ol>
      )}
      {summary && summary.ranking.length === 0 && summary.summary && (
        <p className="text-muted line-clamp-3">{summary.summary}</p>
      )}
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="border border-hairline px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted">
      {label}
    </span>
  );
}
