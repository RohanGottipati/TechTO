"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Columns2, Loader2, Plus, SlidersHorizontal } from "lucide-react";
import type { CityCopilotResponse } from "@/lib/chat/schemas";
import { parseMapActions } from "@/lib/techto/map-actions";
import { applyMapActions } from "@/lib/techto/apply-map-actions";
import { enqueueMapActions, resetMapActionQueue } from "@/lib/techto/map-action-queue";
import { useMapStore } from "@/store/useMapStore";
import { useTechTOStore } from "@/store/useTechTOStore";
import type { UseBackboardRunResult } from "@/lib/techto/use-backboard-run";
import { FLAGSHIP_SCENARIO_ID } from "@/data/transit/scenarios";
import { cn } from "@/lib/utils/cn";
import type {
  CityPlanRankingRow,
  CityPlanRunHandlers,
  CityPlanTraceLine,
} from "@/components/planner/CityPlanStrip";
import { ChatMarkdown } from "@/components/chat/ChatMarkdown";
import { PdfExportButton } from "@/components/chat/PdfExportButton";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citedEvidence?: string[];
}

const EXAMPLE_ASK =
  "Should I place a new train station in Wychwood or in Ionview?";

export interface MapChatBarProps {
  /** Optional planning run. Omit on the TechTO dashboard. */
  run?: UseBackboardRunResult;
  includeWebSearch?: boolean;
  /** When false, chat answers only (no Backboard planning kickoff). Default true if `run` is provided. */
  enablePlanningRun?: boolean;
  /** Coolness open-city planner via /api/planner/stream (orchestrator agent). */
  enableCityPlanRun?: boolean;
  onCityPlanQuestion?: (
    question: string,
    handlers: CityPlanRunHandlers,
  ) => Promise<{
    summary?: string;
    ranking?: CityPlanRankingRow[];
    chosenId?: string;
    mapActions?: unknown[];
  } | void>;
  cityPlanRunning?: boolean;
}

/**
 * Liquid-glass chat dock at the bottom of the map.
 */
export function MapChatBar({
  run,
  includeWebSearch = false,
  enablePlanningRun,
  enableCityPlanRun = false,
  onCityPlanQuestion,
  cityPlanRunning = false,
}: MapChatBarProps) {
  const planningEnabled = enablePlanningRun ?? Boolean(run);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const appliedMapMidstream = useRef(false);

  const selectedPlace = useMapStore((s) => s.selectedPlace);
  const layers = useMapStore((s) => s.layers);
  const selectedScenarioId = useMapStore((s) => s.selectedScenarioId);
  const selectedStationId = useMapStore((s) => s.selectedStationId);

  useEffect(() => {
    fetch("/api/chat")
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (
          data: {
            thread?: {
              threadId: string;
              messages: Array<{ messageId?: string; id?: string; role: ChatMessage["role"]; content: string }>;
            };
          } | null,
        ) => {
          if (!data?.thread) return;
          setThreadId(data.thread.threadId);
          const prior = (data.thread.messages ?? []).filter((message) => message.role !== "system");
          if (prior.length > 0) {
            setMessages(
              prior.map((message) => ({
                id: message.messageId ?? message.id ?? `m-${Math.random()}`,
                role: message.role,
                content: message.content,
              })),
            );
          }
        },
      )
      .catch(() => undefined);
  }, []);

  const lastRecommendation = useMemo(() => {
    if (!run) return null;
    if (run.result && "effectiveRecommendation" in run.result) {
      return (run.result as { effectiveRecommendation: { headline: string; reasoning: string } })
        .effectiveRecommendation;
    }
    for (let i = run.events.length - 1; i >= 0; i -= 1) {
      const event = run.events[i];
      if (event.type === "recommendation.ready") return event.recommendation;
    }
    return null;
  }, [run]);

  useEffect(() => {
    if (!run || !lastRecommendation || run.isRunning) return;
    setExpanded(true);
    setMessages((prev) => {
      if (prev.some((m) => m.id === `rec-${run.runId}`)) return prev;
      return [
        ...prev,
        {
          id: `rec-${run.runId ?? "done"}`,
          role: "assistant",
          content: `${lastRecommendation.headline}\n\n${lastRecommendation.reasoning}`,
        },
      ];
    });
  }, [lastRecommendation, run]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || run?.isRunning || busy) return;

    setBusy(true);
    setExpanded(true);
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);
    setInput("");

    const visibleLayers = Object.entries(layers)
      .filter(([, on]) => on)
      .map(([key]) => key);

    try {
      // Open-city path: Planning Orchestrator agent (tools + optional subagents),
      // streamed live -- tokens, tool calls, subagent starts, and scoring results
      // all appear as they happen instead of a spinner followed by one final blob.
      if (enableCityPlanRun && onCityPlanQuestion) {
        const liveId = `plan-${Date.now()}`;
        appliedMapMidstream.current = false;
        resetMapActionQueue();
        setMessages((prev) => [...prev, { id: liveId, role: "assistant", content: "", trace: [], streaming: true }]);

        const payload = await onCityPlanQuestion(text, {
          onDelta: (chunk) => {
            setMessages((prev) =>
              prev.map((m) => (m.id === liveId ? { ...m, content: m.content + chunk } : m)),
            );
          },
          onReasoning: (chunk) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === liveId ? { ...m, reasoning: (m.reasoning ?? "") + chunk } : m,
              ),
            );
          },
          onClear: () => {
            setMessages((prev) =>
              prev.map((m) => (m.id === liveId ? { ...m, content: "" } : m)),
            );
          },
          onTrace: (line) => {
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== liveId) return m;
                const trace = m.trace ?? [];
                const idx = trace.findIndex((t) => t.id === line.id);
                if (idx < 0) return { ...m, trace: [...trace, line] };
                const prevLine = trace[idx];
                const next = [...trace];
                next[idx] = {
                  ...prevLine,
                  ...line,
                  // keep args from the running row when the done event only sends result
                  argsDetail: line.argsDetail ?? prevLine.argsDetail,
                  resultDetail: line.resultDetail ?? prevLine.resultDetail,
                };
                return { ...m, trace: next };
              }),
            );
          },
          onMapActions: (actions) => {
            // play each compose batch as it lands; queue keeps camera moves sequential
            appliedMapMidstream.current = true;
            enqueueMapActions(actions);
          },
        });

        // fallback only if the agent never streamed map.actions mid-turn
        if (!appliedMapMidstream.current) {
          const mapParsed = parseMapActions(payload?.mapActions ?? []);
          if (mapParsed.ok) enqueueMapActions(mapParsed.actions);
        }
        const ranking = payload?.ranking ?? [];
        const rankLines = ranking
          .slice(0, 5)
          .map(
            (r: CityPlanRankingRow, i: number) =>
              `${i + 1}. ${r.title} (mean ${Number(r.mean).toFixed(2)}, support ${(Number(r.supportShare) * 100).toFixed(0)}%)`,
          )
          .join("\n");
        // prefer live streamed prose; only replace if the agent left the bubble empty
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== liveId) return m;
            let body = m.content.trim();
            if (!body) {
              body =
                payload?.summary?.trim() ||
                "The planning agent finished without a written reply. Try asking again.";
            }
            if (ranking.length) {
              body +=
                `\n\nRanked scenarios:\n${rankLines}` +
                (payload?.chosenId ? `\n\nLeading: ${payload.chosenId}` : "");
            }
            return { ...m, content: body, streaming: false };
          }),
        );
        return;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadId: threadId ?? undefined,
          message: text,
          startPlanningRun: planningEnabled,
          mapContext: {
            cityId: "toronto",
            viewport: {
              longitude: selectedPlace?.coordinates[0] ?? -79.3832,
              latitude: selectedPlace?.coordinates[1] ?? 43.6532,
              zoom: 12.8,
              bounds: [-79.64, 43.58, -79.11, 43.86] as [number, number, number, number],
            },
            selectedRouteId: null,
            selectedStopId: selectedStationId,
            selectedNeighbourhoodId: selectedPlace?.neighbourhoodId ?? null,
            activeScenarioId: selectedScenarioId,
            activeSimulationId: null,
            simulationTime: null,
            visibleLayers,
            comparisonMode: "baseline" as const,
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`Chat API failed (${response.status})`);
      }
      const payload = (await response.json()) as {
        thread: { threadId: string };
        response: CityCopilotResponse;
      };
      setThreadId(payload.thread.threadId);

      const copilot = payload.response;
      setMessages((prev) => [
        ...prev,
        {
          id: copilot.messageId,
          role: "assistant",
          content: copilot.answer,
        },
      ]);

      const actions = parseMapActions(copilot.mapActions);
      if (actions.ok) applyMapActions(actions.actions);

      if (planningEnabled && run && copilot.startPlanningRun) {
        useMapStore.getState().setSelectedScenario(copilot.scenarioId ?? FLAGSHIP_SCENARIO_ID);
        run.start({
          scenarioId: copilot.scenarioId ?? FLAGSHIP_SCENARIO_ID,
          includeWebSearch,
        });
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: error instanceof Error ? error.message : "Chat request failed.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const showTranscript = expanded && messages.length > 0;
  const isRunning = Boolean(run?.isRunning) || cityPlanRunning;
  const showBlinkCaret = !input && !focused;
  const exportReport = useMemo(
    () => ({
      title: "TechTO planning chat",
      subtitle: selectedPlace
        ? `${selectedPlace.label} · ${selectedPlace.kind}`
        : "Toronto planning conversation",
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
        citedEvidence: message.citedEvidence,
      })),
    }),
    [messages, selectedPlace]
  );

  return (
    <section className="mx-auto w-full max-w-3xl" data-testid="city-copilot-chat">
      {showTranscript && (
        <div
          className={cn(
            "mb-3 max-h-44 overflow-y-auto rounded-[28px] border border-white/25 px-4 py-3 text-xs twinto-scroll",
            "bg-white/18 shadow-[0_12px_40px_-16px_rgba(15,40,80,0.45)] backdrop-blur-2xl backdrop-saturate-150",
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-white">TechTO</p>
            <div className="flex items-center gap-1">
              <PdfExportButton report={exportReport} className="px-2" />
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="text-[11px] text-white/55 transition hover:text-white"
              >
                Collapse
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-8 bg-white/25 px-3 py-2 text-white"
                    : "mr-4 bg-white/10 px-3 py-2 text-white/90"
                }
              >
                {message.role === "user" ? (
                  <p className="whitespace-pre-wrap text-[12px] leading-relaxed">{message.content}</p>
                ) : (
                  <ChatMarkdown content={message.content} />
                )}
              </div>
            ))}
            {busy && !enableCityPlanRun && (
              <div className="inline-flex items-center gap-2 text-white/80">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking…
              </div>
            )}
          </div>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className={cn(
          "flex items-center gap-2 border border-white/35 px-3 py-2",
          "bg-white/14 backdrop-blur-2xl backdrop-saturate-150",
        )}
      >
        <div
          className="relative min-w-0 flex-1 cursor-text"
          onClick={() => inputRef.current?.focus()}
        >
          {showBlinkCaret && (
            <button
              type="button"
              className="pointer-events-auto absolute inset-y-0 left-1 right-1 flex items-center gap-1 truncate text-left text-[15px] text-white/45 transition hover:text-white/70"
              onClick={() => {
                setInput(EXAMPLE_ASK);
                inputRef.current?.focus();
              }}
            >
              <span className="chat-blink-caret shrink-0" aria-hidden />
              <span className="truncate">{EXAMPLE_ASK}</span>
            </button>
          )}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={focused ? EXAMPLE_ASK : ""}
            className="chat-glass-input relative w-full bg-transparent px-1 py-2 text-[15px] outline-none"
            data-testid="city-copilot-input"
            aria-label="Ask a Toronto planning question"
          />
        </div>

        {run ? (
          <button
            type="button"
            onClick={() => useTechTOStore.getState().setPanelFocus("chat")}
 className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-white/70 transition hover:bg-white/15 hover:text-white"
            aria-label="Open council panel"
          >
            <Columns2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
 className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-white/70 transition hover:bg-white/15 hover:text-white"
            aria-label="Toggle conversation"
          >
            <Columns2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}

        <button
          type="submit"
          disabled={isRunning || busy || !input.trim()}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center bg-white/25 text-white transition hover:bg-white/40 disabled:opacity-40"
          data-testid="city-copilot-send"
          aria-label="Send"
        >
          {busy || isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" strokeWidth={2.25} />
          )}
        </button>
      </form>
    </section>
  );
}
