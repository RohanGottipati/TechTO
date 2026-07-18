"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2, SendHorizontal, Sparkles } from "lucide-react";
import { classifyPlanningIntent } from "@/lib/twinto/intent";
import { selectAssistantsForIntent } from "@/lib/backboard/assistants";
import { parseMapActions, type MapAction } from "@/lib/twinto/map-actions";
import { useMapStore } from "@/store/useMapStore";
import { useTwinTOStore } from "@/store/useTwinTOStore";
import { useBackboardRun } from "@/lib/twinto/use-backboard-run";
import { FLAGSHIP_SCENARIO_ID } from "@/data/transit/scenarios";
import { searchNeighbourhoods } from "@/data/transit/neighbourhoods";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

function applyMapActions(actions: MapAction[]): void {
  const map = useMapStore.getState();
  for (const action of actions) {
    if (action.type === "fly_to_center") {
      map.setCameraTarget({ center: action.center, zoom: action.zoom });
    } else if (action.type === "highlight_neighbourhoods") {
      map.setHighlightedNeighbourhoods(action.neighbourhoodIds);
    } else if (action.type === "show_candidate_markers") {
      map.setCandidateMarkers(action.candidates);
    } else if (action.type === "select_candidate") {
      useTwinTOStore.getState().setSelectedCandidate(action.candidateId);
    } else if (action.type === "open_panel") {
      const focus =
        action.panel === "citizen_reactions"
          ? "citizens"
          : action.panel === "candidate_details" || action.panel === "policy_comparison"
            ? "recommendation"
            : "chat";
      useTwinTOStore.getState().setPanelFocus(focus);
    }
  }
}

/**
 * Persistent City Copilot dock at the bottom of the TwinTO map. Classifies
 * intents, starts Backboard planning runs for complex questions, and applies
 * allowlisted map actions for simple navigation.
 */
export function CityCopilotChat() {
  const run = useBackboardRun();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "system",
      content:
        "City Copilot is ready. Ask about neighbourhood station placement, the 4:06/4:12 schedule scenario, or concert service changes. Simulated planning only.",
    },
  ]);

  const lastRecommendation = useMemo(() => {
    if (run.result && "effectiveRecommendation" in run.result) {
      return (run.result as { effectiveRecommendation: { headline: string; reasoning: string } })
        .effectiveRecommendation;
    }
    for (let i = run.events.length - 1; i >= 0; i -= 1) {
      const event = run.events[i];
      if (event.type === "recommendation.ready") return event.recommendation;
    }
    return null;
  }, [run.events, run.result]);

  useEffect(() => {
    if (!lastRecommendation || run.isRunning) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === `rec-${run.runId}`)) return prev;
      return [
        ...prev,
        {
          id: `rec-${run.runId ?? "done"}`,
          role: "assistant",
          content: `${lastRecommendation.headline}\n\n${lastRecommendation.reasoning}\n\nAssumptions: Toronto synthetic fixtures; simulated citizen reactions; deterministic simulator is numerical authority.`,
        },
      ];
    });
  }, [lastRecommendation, run.isRunning, run.runId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || run.isRunning) return;

    const intent = classifyPlanningIntent(text);
    const bundle = selectAssistantsForIntent(intent);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: text },
      {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: `Intent: ${intent}. Activating ${bundle.length} specialist(s): ${bundle
          .map((key) => key)
          .join(", ")}.`,
      },
    ]);
    setInput("");

    if (intent === "SIMPLE_MAP_NAVIGATION") {
      const matches = searchNeighbourhoods(text, undefined, 3);
      const actions = parseMapActions(
        matches.length > 0
          ? [
              {
                type: "fly_to_center",
                center: matches[0].center,
                zoom: 14,
                durationMs: 1200,
              },
              {
                type: "highlight_neighbourhoods",
                neighbourhoodIds: matches.map((m) => m.id),
              },
              {
                type: "show_candidate_markers",
                candidates: matches.map((m, index) => ({
                  candidateId: `station-${m.id}`,
                  coordinates: m.center,
                  rank: index + 1,
                  label: m.name,
                })),
              },
            ]
          : [],
      );
      if (actions.ok) applyMapActions(actions.actions);
      setMessages((prev) => [
        ...prev,
        {
          id: `nav-${Date.now()}`,
          role: "assistant",
          content:
            matches.length > 0
              ? `Showing ${matches.map((m) => m.name).join(", ")} on the map (synthetic neighbourhood fixtures).`
              : "I could not resolve a neighbourhood from that request.",
        },
      ]);
      return;
    }

    if (intent === "COMPARE_EXISTING_CANDIDATES" && run.result) {
      setMessages((prev) => [
        ...prev,
        {
          id: `cmp-${Date.now()}`,
          role: "assistant",
          content:
            "Reusing the prior planning thread context. Leading candidates remain ranked by the Final Policy Judge under deterministic constraints. Ask for a fresh run if you want new simulations.",
        },
      ]);
      useTwinTOStore.getState().setPanelFocus("recommendation");
      return;
    }

    // Complex planning: start the scenario-backed Backboard orchestration.
    useMapStore.getState().setSelectedScenario(FLAGSHIP_SCENARIO_ID);
    run.start({ scenarioId: FLAGSHIP_SCENARIO_ID });
  }

  return (
    <section
      className="mx-auto w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0b1220]/95 shadow-2xl backdrop-blur"
      data-testid="city-copilot-chat"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
        <Sparkles className="h-3.5 w-3.5 text-twinto-accent" />
        <span className="text-xs font-semibold text-twinto-text">City Copilot</span>
        <span className="text-[11px] text-twinto-muted">persistent thread · consolidated 16-agent roster</span>
      </div>
      <div className="max-h-40 space-y-2 overflow-y-auto px-4 py-3 text-xs twinto-scroll">
        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user"
                ? "ml-8 rounded-lg bg-twinto-accent/20 px-3 py-2 text-twinto-text"
                : "mr-4 rounded-lg bg-white/[0.03] px-3 py-2 text-twinto-muted whitespace-pre-wrap"
            }
          >
            {message.content}
          </div>
        ))}
        {run.isRunning && (
          <div className="inline-flex items-center gap-2 text-twinto-amber">
            <Loader2 className="h-3 w-3 animate-spin" /> Planning specialists are working…
          </div>
        )}
      </div>
      <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask TwinTO… e.g. best neighbourhood for a new subway station"
          className="flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-twinto-text outline-none placeholder:text-twinto-muted focus:border-twinto-accent/50"
          data-testid="city-copilot-input"
        />
        <button
          type="submit"
          disabled={run.isRunning || !input.trim()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-twinto-accent text-white disabled:opacity-40"
          data-testid="city-copilot-send"
          aria-label="Send"
        >
          <SendHorizontal className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
