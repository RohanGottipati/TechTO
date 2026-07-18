"use client";

import { useEffect, useRef } from "react";
import { Loader2, Radio } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { EmptyState } from "@/components/feedback/EmptyState";
import { AgentEventCard } from "@/components/grid/AgentEventCard";
import type { GridRunEvent } from "@/lib/backboard/orchestrator";

export interface AgentRunTimelineProps {
  events: GridRunEvent[];
  isRunning: boolean;
}

export function AgentRunTimeline({ events, isRunning }: AgentRunTimelineProps) {
  const scrollRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [events.length]);

  return (
    <GlassPanel className="flex h-full flex-col p-4" data-testid="agent-run-timeline">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-[#55D8E6]" />
          <h3 className="text-sm font-semibold text-[#F5F7FA]">Agent Run Timeline</h3>
        </div>
        {isRunning && (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[#55D8E6]">
            <Loader2 className="h-3 w-3 animate-spin" />
            live
          </span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="mt-3 flex-1">
          <EmptyState
            title="No run yet"
            description="Start a run to watch the market analyst, renewable analyst, dispatch planner, risk reviewer, and chief dispatch officer work through this scenario."
          />
        </div>
      ) : (
        <ul ref={scrollRef} className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {events.map((event, index) => (
            <AgentEventCard key={`${event.type}-${index}`} event={event} />
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
