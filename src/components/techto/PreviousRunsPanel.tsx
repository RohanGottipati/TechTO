"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, History, Loader2, Trash2, XCircle } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { EmptyState } from "@/components/feedback/EmptyState";
import { clearRunHistory, deleteRun, loadRunHistory, type StoredTwinTORun } from "@/lib/twinto/run-history";
import { cn } from "@/lib/utils/cn";

export interface PreviousRunsPanelProps {
  scenarioId: string;
  onSelectRun?: (run: StoredTwinTORun) => void;
  activeRunId?: string | null;
}

const STATUS_ICON: Record<StoredTwinTORun["status"], typeof CheckCircle2> = {
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: XCircle,
  running: Loader2,
};

const STATUS_COLOR: Record<StoredTwinTORun["status"], string> = {
  completed: "text-twinto-teal",
  failed: "text-twinto-error",
  cancelled: "text-twinto-muted",
  running: "text-twinto-amber",
};

/** Runs saved to this browser only (see `@/lib/twinto/run-history`), so a planner can revisit a prior run after a reload. */
export function PreviousRunsPanel({ scenarioId, onSelectRun, activeRunId }: PreviousRunsPanelProps) {
  const [runs, setRuns] = useState<StoredTwinTORun[]>([]);

  useEffect(() => {
    setRuns(loadRunHistory().filter((run) => run.scenarioId === scenarioId));
  }, [scenarioId]);

  function refresh() {
    setRuns(loadRunHistory().filter((run) => run.scenarioId === scenarioId));
  }

  return (
    <GlassPanel className="flex h-full flex-col p-4" data-testid="previous-runs-panel">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-twinto-accent" />
          <h3 className="text-sm font-semibold text-twinto-text">Previous Runs</h3>
        </div>
        {runs.length > 0 && (
          <button
            type="button"
            onClick={() => {
              clearRunHistory();
              refresh();
            }}
            className="text-[11px] text-twinto-muted transition-colors hover:text-twinto-error"
          >
            Clear all
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-twinto-muted">Stored locally in this browser only ({runs.length} saved).</p>

      {runs.length === 0 ? (
        <div className="mt-3 flex-1">
          <EmptyState title="No previous runs" description="Runs are saved to this browser as they happen so you can revisit them after a reload." />
        </div>
      ) : (
        <ul className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1 twinto-scroll">
          {runs.map((run) => {
            const StatusIcon = STATUS_ICON[run.status];
            const isActive = run.runId === activeRunId;
            return (
              <li
                key={run.runId}
                className={cn(
                  "rounded-lg border px-3 py-2",
                  isActive ? "border-twinto-accent/50 bg-twinto-accent/[0.06]" : "border-white/5 bg-white/[0.02]",
                )}
              >
                <button type="button" onClick={() => onSelectRun?.(run)} className="w-full text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-twinto-text">
                      <StatusIcon className={cn("h-3 w-3", STATUS_COLOR[run.status], run.status === "running" && "animate-spin")} />
                      {run.scenarioId}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-twinto-muted">
                      <Clock className="h-3 w-3" />
                      {new Date(run.startedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  {run.recommendationHeadline && <p className="mt-1 truncate text-[11px] text-twinto-muted">{run.recommendationHeadline}</p>}
                  {run.error && <p className="mt-1 truncate text-[11px] text-twinto-error">{run.error}</p>}
                </button>
                <button
                  type="button"
                  aria-label="Delete run"
                  onClick={() => {
                    deleteRun(run.runId);
                    refresh();
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-twinto-muted transition-colors hover:text-twinto-error"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </GlassPanel>
  );
}
