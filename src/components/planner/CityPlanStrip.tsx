"use client";

import { useRef, useState } from "react";
import { CANNED_CITY_ASKS } from "@/lib/planner/canned";
import { toolRunningLabel } from "@/lib/planner/step-messages";
import { cn } from "@/lib/utils/cn";
import { useMapStore } from "@/store/useMapStore";
import { createRunStreamClient } from "@/lib/backboard/stream-parser";
import type { MapAction } from "@/lib/techto/map-actions";

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

/** One line of the live trace: agent lifecycle, tool calls, thinking, or scoring. */
export interface CityPlanTraceLine {
  id: string;
  /** Human label without status icon (icon comes from `status`). */
  label: string;
  status: "running" | "ok" | "fail" | "info" | "thinking";
  /** Args preview (tool start). */
  argsDetail?: string;
  /** Output preview (tool end) or accumulated thinking text. */
  resultDetail?: string;
}

export interface CityPlanRunHandlers {
  /** Fired for every text token as the agent composes its reply. */
  onDelta?: (chunk: string) => void;
  /** Model thinking / reasoning tokens (separate from the user-facing reply). */
  onReasoning?: (chunk: string) => void;
  /** Current thinking segment finished (start a new one on the next chunk). */
  onReasoningEnded?: () => void;
  /** Wipe partial prose when a mid-turn tool round starts. */
  onClear?: () => void;
  /**
   * Upsert a trace line. Same `id` (e.g. toolCallId) updates in place so
   * running → ok/fail does not duplicate the row.
   */
  onTrace?: (line: CityPlanTraceLine) => void;
  /** Mid-stream map actions: apply as soon as compose_map_actions accepts them. */
  onMapActions?: (actions: MapAction[]) => void;
  /** Fired for each real Monte-Carlo-sampled resident as score_population/run_twin_analysis scores them, so the map can colour that one dot live. */
  onPersonaScored?: (result: { personaId: string; code: string; acceptance: number; opinionText: string }) => void;
}

function rolePrefix(role: unknown): string {
  if (typeof role !== "string" || !role || role === "planning-orchestrator") return "";
  return `[${role}] `;
}

function traceLineFor(event: { type: string; [key: string]: unknown }): CityPlanTraceLine | null {
  const detail = typeof event.detail === "string" ? event.detail : undefined;
  switch (event.type) {
    case "run.started":
      return {
        id: "run-started",
        label: "run started",
        status: "info",
        resultDetail: typeof event.question === "string" ? event.question : undefined,
      };
    case "agent.started":
      return {
        id: `agent-${event.role ?? "main"}`,
        label: `${event.name as string} started`,
        status: "info",
        resultDetail: typeof event.role === "string" ? `role: ${event.role}` : undefined,
      };
    case "tool.requested": {
      const toolCallId = String(event.toolCallId ?? "");
      if (!toolCallId) return null;
      return {
        id: toolCallId,
        label: `${rolePrefix(event.role)}${toolRunningLabel(event.toolName as string)}`,
        status: "running",
        argsDetail: detail,
      };
    }
    case "tool.completed": {
      const toolCallId = String(event.toolCallId ?? "");
      if (!toolCallId) return null;
      return {
        id: toolCallId,
        label: `${rolePrefix(event.role)}${toolRunningLabel(event.toolName as string)}`,
        status: event.ok ? "ok" : "fail",
        resultDetail: detail,
      };
    }
    case "scenarios.proposed": {
      const patches = (event.patches as Array<Record<string, unknown>>) ?? [];
      return {
        id: `scenarios-${patches.map((p) => p.id).join("-") || "batch"}`,
        label: `${patches.length} scenario patch(es) proposed`,
        status: "info",
        resultDetail: JSON.stringify(
          patches.map((p) => ({
            id: p.id,
            title: p.title,
            rationale: p.rationale,
            edits: p.edits,
          })),
          null,
          2,
        ),
      };
    }
    case "citizens.scored": {
      const mean = Number(event.mean).toFixed(2);
      const support = (Number(event.supportShare) * 100).toFixed(0);
      const candidateId = String(event.candidateId ?? "score");
      const n = event.sampleSize != null ? ` n=${event.sampleSize}` : "";
      const stop = event.stopReason ? ` ${event.stopReason}` : "";
      return {
        id: `citizens-${candidateId}`,
        label: `acceptance ${candidateId}: mean ${mean}, ${support}% support${n}${stop}`,
        status: "ok",
        resultDetail: JSON.stringify(
          {
            candidateId,
            mean: event.mean,
            supportShare: event.supportShare,
            opposeShare: event.opposeShare,
            sampleSize: event.sampleSize,
            ciHalfWidth: event.ciHalfWidth,
            stopReason: event.stopReason,
            provider: event.provider,
            weakest: event.weakest,
            strongest: event.strongest,
            byNeighbourhood: event.byNeighbourhood,
          },
          null,
          2,
        ),
      };
    }
    case "recommendation.ready": {
      const ranking = (event.ranking as Array<Record<string, unknown>>) ?? [];
      return {
        id: "recommendation-ready",
        label: "recommendation ready",
        status: "ok",
        resultDetail: JSON.stringify(
          {
            chosenId: event.chosenId,
            ranking,
            summary: event.summary,
          },
          null,
          2,
        ),
      };
    }
    case "map.actions":
    case "planner.map_actions": {
      const actions = (event.actions as unknown[]) ?? [];
      return {
        id: "",
        label: `map ← ${actions.length} action(s)`,
        status: "info",
        resultDetail: JSON.stringify(actions, null, 2),
      };
    }
    case "run.completed":
      return {
        id: "run-completed",
        label: "run completed",
        status: "ok",
      };
    case "status":
      return { id: "", label: event.message as string, status: "info" };
    default:
      return null;
  }
}

export function useCityPlanRun() {
  const [summary, setSummary] = useState<CityPlanRunSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const traceSeq = useRef(0);
  const sampleBuf = useRef<Map<string, { n: number; lines: string[] }>>(new Map());

  function start(question: string, handlers: CityPlanRunHandlers = {}): Promise<Record<string, unknown>> {
    setIsRunning(true);
    setError(null);
    traceSeq.current = 0;
    sampleBuf.current = new Map();
    const agentOverlays = useMapStore.getState().agentOverlays;

    const sealSamples = () => {
      for (const [key, buf] of sampleBuf.current) {
        if (buf.n <= 0) continue;
        handlers.onTrace?.({
          id: `persona-sample-${key}`,
          label: `Sampled ${buf.n} residents${key !== "_" ? ` (${key})` : ""}`,
          status: "ok",
          resultDetail: buf.lines.join("\n"),
        });
      }
    };

    return new Promise((resolve, reject) => {
      createRunStreamClient({
        url: "/api/planner/stream",
        body: { question, seed: 2262, agentOverlays },
        onEvent: (envelope) => {
          const payload = envelope.payload as Record<string, unknown>;
          if (envelope.type === "planner.delta" && typeof payload.content === "string") {
            handlers.onDelta?.(payload.content);
            return;
          }
          if (envelope.type === "planner.reasoning" && typeof payload.content === "string") {
            handlers.onReasoning?.(payload.content);
            return;
          }
          if (envelope.type === "planner.reasoning_ended") {
            handlers.onReasoningEnded?.();
            return;
          }
          if (envelope.type === "planner.clear") {
            handlers.onReasoningEnded?.();
            handlers.onClear?.();
            return;
          }
          if (envelope.type === "planner.status" && typeof payload.message === "string") {
            handlers.onTrace?.({
              id: `t-${traceSeq.current++}`,
              label: payload.message,
              status: "info",
            });
            return;
          }
          if (envelope.type === "planner.map_actions") {
            const actions = (payload.actions as MapAction[]) ?? [];
            if (actions.length) handlers.onMapActions?.(actions);
            const line = traceLineFor({ type: "planner.map_actions", actions });
            if (line) {
              handlers.onTrace?.({
                ...line,
                id: `map-${traceSeq.current++}`,
              });
            }
            return;
          }
          if (envelope.type === "planner.persona_scored") {
            const { personaId, code, acceptance, opinionText, scenarioId } = payload as {
              personaId?: string;
              code?: string;
              acceptance?: number;
              opinionText?: string;
              scenarioId?: string;
            };
            if (typeof personaId === "string" && typeof code === "string" && typeof acceptance === "number") {
              handlers.onPersonaScored?.({
                personaId,
                code,
                acceptance,
                opinionText: opinionText ?? "",
              });
              const key = typeof scenarioId === "string" && scenarioId ? scenarioId : "_";
              let buf = sampleBuf.current.get(key);
              if (!buf) {
                buf = { n: 0, lines: [] };
                sampleBuf.current.set(key, buf);
              }
              buf.n += 1;
              const snip = (opinionText ?? "").trim().replace(/\s+/g, " ");
              buf.lines.push(
                `${code}  ${acceptance.toFixed(2)}  ${personaId}${snip ? `  ${snip}` : ""}`,
              );
              handlers.onTrace?.({
                id: `persona-sample-${key}`,
                label: `Sampled ${buf.n} residents${key !== "_" ? ` (${key})` : ""}`,
                status: "running",
                resultDetail: buf.lines.join("\n"),
              });
            }
            return;
          }
          if (envelope.type === "planner.completed") {
            sealSamples();
            const next: CityPlanRunSummary = {
              question: (payload.question as string) ?? question,
              ranking: (payload.ranking as CityPlanRankingRow[]) ?? [],
              chosenId: payload.chosenId as string,
              summary: (payload.summary as string) ?? "",
              backboardMode: payload.backboardMode as string,
              populationMode: payload.populationMode as string,
              participatingAgents: (payload.participatingAgents as string[]) ?? [],
              events: ((payload.events as string[]) ?? []),
            };
            setSummary(next);
            setIsRunning(false);
            resolve(payload);
            return;
          }
          if (envelope.type === "planner.failed") {
            setIsRunning(false);
            setError((payload.message as string) ?? "planner run failed");
            reject(new Error((payload.message as string) ?? "planner run failed"));
            return;
          }
          const line = traceLineFor({ type: envelope.type, ...payload });
          if (line) {
            if (envelope.type === "citizens.scored") {
              const cand = String(payload.candidateId ?? "_");
              const buf = sampleBuf.current.get(cand) ?? sampleBuf.current.get("_");
              if (buf && buf.n > 0) {
                const key = sampleBuf.current.has(cand) ? cand : "_";
                handlers.onTrace?.({
                  id: `persona-sample-${key}`,
                  label: `Sampled ${buf.n} residents${key !== "_" ? ` (${key})` : ""}`,
                  status: "ok",
                  resultDetail: buf.lines.join("\n"),
                });
              }
            }
            handlers.onTrace?.({
              ...line,
              id: line.id || `t-${traceSeq.current++}`,
            });
          }
        },
        onError: (err) => {
          setIsRunning(false);
          setError(err.message);
          reject(err);
        },
      });
    });
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
