"use client";

import {
  AlertCircle,
  Award,
  Bot,
  CheckCircle2,
  FlaskConical,
  ListChecks,
  Play,
  ShieldCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import type { GridRunEvent } from "@/lib/backboard/orchestrator";
import { formatCad } from "@/lib/gridtwin/format";
import { cn } from "@/lib/utils/cn";

export interface AgentEventCardProps {
  event: GridRunEvent;
}

interface EventDisplay {
  icon: typeof Bot;
  tone: "neutral" | "success" | "error" | "warning";
  title: string;
  detail?: string;
}

function describeEvent(event: GridRunEvent): EventDisplay {
  switch (event.type) {
    case "run.created":
      return {
        icon: Play,
        tone: "neutral",
        title: "Run started",
        detail: `${event.assetId} \u00b7 ${event.scenarioId}`,
      };
    case "agent.started":
      return { icon: Bot, tone: "neutral", title: `${event.name} started` };
    case "agent.completed":
      return { icon: CheckCircle2, tone: "success", title: `${event.name} completed`, detail: event.summary };
    case "agent.failed":
      return { icon: XCircle, tone: "error", title: `${event.name} failed`, detail: event.error };
    case "tool.requested":
      return { icon: Wrench, tone: "neutral", title: `Tool call: ${event.toolName}`, detail: event.role };
    case "tool.completed":
      return {
        icon: event.ok ? CheckCircle2 : AlertCircle,
        tone: event.ok ? "success" : "warning",
        title: `Tool result: ${event.toolName}`,
        detail: event.ok ? "ok" : "error",
      };
    case "candidate.created":
      return {
        icon: FlaskConical,
        tone: "neutral",
        title: `Candidate proposed: ${event.candidateId}`,
        detail: event.strategy,
      };
    case "candidate.simulated":
      return {
        icon: event.valid ? CheckCircle2 : XCircle,
        tone: event.valid ? "success" : "error",
        title: `Simulated: ${event.candidateId}`,
        detail: `${event.valid ? "valid" : "invalid"} \u00b7 net value ${formatCad(event.netValueCad)} \u00b7 ${event.source}`,
      };
    case "candidate.stress_tested":
      return {
        icon: ShieldCheck,
        tone: event.valid ? "success" : "warning",
        title: `Stress tested: ${event.candidateId}`,
        detail: `${event.valid ? "survived" : "failed"} \u00b7 ${event.source}`,
      };
    case "candidates.ranked": {
      const top = event.ranking.find((entry) => entry.rank === 1);
      return {
        icon: ListChecks,
        tone: "neutral",
        title: "Candidates ranked",
        detail: top ? `#1: ${top.candidateId}` : undefined,
      };
    }
    case "recommendation.ready":
      return {
        icon: Award,
        tone: event.overridden ? "warning" : "success",
        title: event.overridden ? "Recommendation overridden" : "Recommendation ready",
        detail: event.recommendation.headline,
      };
    case "run.completed":
      return { icon: CheckCircle2, tone: "success", title: "Run completed" };
    case "run.failed":
      return { icon: XCircle, tone: "error", title: "Run failed", detail: event.error };
    default:
      return { icon: Bot, tone: "neutral", title: "Event" };
  }
}

const TONE_CLASSES: Record<EventDisplay["tone"], string> = {
  neutral: "text-[#9AA7B5]",
  success: "text-[#55D8E6]",
  error: "text-[#FF6B6B]",
  warning: "text-[#F4B860]",
};

export function AgentEventCard({ event }: AgentEventCardProps) {
  const display = describeEvent(event);
  const Icon = display.icon;

  return (
    <li className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", TONE_CLASSES[display.tone])} />
      <div className="min-w-0">
        <p className="text-xs font-medium text-[#F5F7FA]">{display.title}</p>
        {display.detail && (
          <p className="mt-0.5 truncate text-[11px] text-[#9AA7B5]">{display.detail}</p>
        )}
      </div>
    </li>
  );
}
