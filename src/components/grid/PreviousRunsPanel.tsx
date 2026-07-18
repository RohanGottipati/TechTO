"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock, History, Loader2, Trash2, XCircle } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  clearRunHistory,
  deleteRun,
  loadRunHistory,
  type StoredGridRun,
} from "@/lib/gridtwin/run-history";
import { formatTimestamp } from "@/lib/gridtwin/format";
import { cn } from "@/lib/utils/cn";

export interface PreviousRunsPanelProps {
  assetId: string;
  onSelectRun?: (run: StoredGridRun) => void;
  activeRunId?: string | null;
}

const STATUS_ICON: Record<StoredGridRun["status"], typeof CheckCircle2> = {
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: XCircle,
  running: Loader2,
};

const STATUS_COLOR: Record<StoredGridRun["status"], string> = {
  completed: "text-[#55D8E6]",
  failed: "text-[#FF6B6B]",
  cancelled: "text-[#9AA7B5]",
  running: "text-[#F4B860]",
};

export function PreviousRunsPanel({ assetId, onSelectRun, activeRunId }: PreviousRunsPanelProps) {
  const [runs, setRuns] = useState<StoredGridRun[]>([]);

  useEffect(() => {
    setRuns(loadRunHistory().filter((run) => run.assetId === assetId));
  }, [assetId]);

  function refresh() {
    setRuns(loadRunHistory().filter((run) => run.assetId === assetId));
  }

  return (
    <GlassPanel className="flex h-full flex-col p-4" data-testid="previous-runs-panel">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[#55D8E6]" />
          <h3 className="text-sm font-semibold text-[#F5F7FA]">Previous Runs</h3>
        </div>
        {runs.length > 0 && (
          <button
            type="button"
            onClick={() => {
              clearRunHistory();
              refresh();
            }}
            className="text-[11px] text-[#9AA7B5] transition-colors hover:text-[#FF6B6B]"
          >
            Clear all
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] text-[#9AA7B5]">
        Stored locally in this browser only ({runs.length} saved).
      </p>

      {runs.length === 0 ? (
        <div className="mt-3 flex-1">
          <EmptyState
            title="No previous runs"
            description="Runs are saved to this browser as they happen so you can revisit them after a reload."
          />
        </div>
      ) : (
        <ul className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
          {runs.map((run) => {
            const StatusIcon = STATUS_ICON[run.status];
            const isActive = run.runId === activeRunId;
            return (
              <li
                key={run.runId}
                className={cn(
                  "rounded-lg border px-3 py-2",
                  isActive
                    ? "border-[#55D8E6]/50 bg-[#55D8E6]/[0.06]"
                    : "border-white/5 bg-white/[0.02]"
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectRun?.(run)}
                  className="w-full text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F5F7FA]">
                      <StatusIcon
                        className={cn(
                          "h-3 w-3",
                          STATUS_COLOR[run.status],
                          run.status === "running" && "animate-spin"
                        )}
                      />
                      {run.scenarioId}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-[#9AA7B5]">
                      <Clock className="h-3 w-3" />
                      {formatTimestamp(run.startedAt)}
                    </span>
                  </div>
                  {run.result && (
                    <p className="mt-1 truncate text-[11px] text-[#9AA7B5]">
                      {run.result.effectiveRecommendation.headline}
                    </p>
                  )}
                  {run.error && (
                    <p className="mt-1 truncate text-[11px] text-[#FF6B6B]">{run.error}</p>
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Delete run"
                  onClick={() => {
                    deleteRun(run.runId);
                    refresh();
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[#9AA7B5] transition-colors hover:text-[#FF6B6B]"
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
