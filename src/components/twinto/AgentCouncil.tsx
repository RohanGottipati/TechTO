"use client";

import { CheckCircle2, Loader2, Users2, XCircle } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { EmptyState } from "@/components/feedback/EmptyState";
import { getAssistantRole } from "@/lib/backboard/assistants";
import type { TwinTORunEvent } from "@/lib/twinto/types";

type AgentStatus = "started" | "completed" | "failed";

function statusFromEvents(events: TwinTORunEvent[]): Map<string, AgentStatus> {
  const status = new Map<string, AgentStatus>();
  for (const event of events) {
    if (event.type === "agent.started") status.set(event.role, "started");
    else if (event.type === "agent.completed") status.set(event.role, "completed");
    else if (event.type === "agent.failed") status.set(event.role, "failed");
  }
  return status;
}

const STATUS_ICON: Record<AgentStatus, typeof CheckCircle2> = {
  started: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
};

const STATUS_COLOR: Record<AgentStatus, string> = {
  started: "text-twinto-amber",
  completed: "text-twinto-teal",
  failed: "text-twinto-error",
};

export interface AgentCouncilProps {
  events: TwinTORunEvent[];
}

/** Every specialist role that has taken part in this run so far, with a live started/completed/failed status; the "who is working on this" view. */
export function AgentCouncil({ events }: AgentCouncilProps) {
  const statusByRole = statusFromEvents(events);
  const roles = Array.from(statusByRole.keys());

  return (
    <GlassPanel className="flex h-full flex-col p-4" data-testid="agent-council">
      <div className="flex items-center gap-2">
        <Users2 className="h-4 w-4 text-twinto-accent" />
        <h3 className="text-sm font-semibold text-twinto-text">Agent Council</h3>
      </div>

      {roles.length === 0 ? (
        <div className="mt-3 flex-1">
          <EmptyState
            title="No agents active"
            description="Start a run to see the virtual planning department's specialist roles work through this scenario."
          />
        </div>
      ) : (
        <ul className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-1 twinto-scroll">
          {roles.map((role) => {
            const status = statusByRole.get(role) ?? "started";
            const Icon = STATUS_ICON[status];
            let name = role;
            let description = "";
            try {
              const definition = getAssistantRole(role as Parameters<typeof getAssistantRole>[0]);
              name = definition.name;
              description = definition.shortDescription;
            } catch {
              // Unknown role key; fall back to the raw string.
            }
            return (
              <li key={role} className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-twinto-text">
                    <Icon className={`h-3 w-3 ${STATUS_COLOR[status]} ${status === "started" ? "animate-spin" : ""}`} />
                    {name}
                  </span>
                </div>
                {description && <p className="mt-0.5 text-[11px] text-twinto-muted">{description}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </GlassPanel>
  );
}
