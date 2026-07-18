"use client";

import { useRef, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { EmptyState } from "@/components/feedback/EmptyState";
import { createRunStreamClient } from "@/lib/backboard/stream-parser";
import type { GridRunResult } from "@/lib/backboard/orchestrator";
import { cn } from "@/lib/utils/cn";

export interface OperatorQuestionPanelProps {
  assetId: string;
  scenarioId: string;
  result: GridRunResult | null;
}

interface QaEntry {
  question: string;
  answer: string | null;
  citedEvidence: string[];
  error: string | null;
  streaming: boolean;
}

const EXAMPLE_PROMPTS = [
  "Why was the recommended candidate chosen over the others?",
  "What happens if overnight wind comes in below forecast?",
  "How much of this plan's value depends on the evening price peak?",
  "Would this recommendation change if the reserve requirement doubled?",
];

function runContextFor(result: GridRunResult): string {
  return [
    `Effective recommendation: ${result.effectiveRecommendation.headline}`,
    result.effectiveRecommendation.reasoning,
    result.recommendationOverridden
      ? `Note: this recommendation was overridden for safety (${result.overrideReason ?? "unspecified"}).`
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

/** Lets the operator ask a free-text follow-up, answered by the Chief Dispatch Officer via /api/backboard/operator-question. */
export function OperatorQuestionPanel({ assetId, scenarioId, result }: OperatorQuestionPanelProps) {
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState<QaEntry[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const threadIdRef = useRef<string | undefined>(result?.chiefThreadId);

  const canAsk = question.trim().length > 0 && !isAsking;

  function updateLastEntry(update: Partial<QaEntry>) {
    setEntries((prev) =>
      prev.map((entry, index) => (index === prev.length - 1 ? { ...entry, ...update } : entry)),
    );
  }

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed || isAsking) return;

    setIsAsking(true);
    setEntries((prev) => [
      ...prev,
      { question: trimmed, answer: null, citedEvidence: [], error: null, streaming: true },
    ]);
    setQuestion("");

    createRunStreamClient({
      url: "/api/backboard/operator-question",
      body: {
        assetId,
        scenarioId,
        threadId: threadIdRef.current,
        runContext: result ? runContextFor(result) : undefined,
        question: trimmed,
      },
      onEvent: (envelope) => {
        if (envelope.type === "operator.delta") {
          const content = (envelope.payload as { content?: unknown }).content;
          if (typeof content === "string") {
            setEntries((prev) =>
              prev.map((entry, index) =>
                index === prev.length - 1 ? { ...entry, answer: (entry.answer ?? "") + content } : entry,
              ),
            );
          }
        } else if (envelope.type === "operator.completed") {
          const payload = envelope.payload as {
            answer?: { answer?: string; citedEvidence?: string[] };
            threadId?: string;
          };
          if (payload.threadId) {
            threadIdRef.current = payload.threadId;
          }
          updateLastEntry({
            answer: payload.answer?.answer ?? null,
            citedEvidence: payload.answer?.citedEvidence ?? [],
            streaming: false,
          });
        } else if (envelope.type === "operator.failed") {
          const payload = envelope.payload as { message?: string };
          updateLastEntry({
            error: payload.message ?? "The operator question failed.",
            streaming: false,
          });
        }
      },
      onError: (error) => {
        updateLastEntry({ error: error.message, streaming: false });
        setIsAsking(false);
      },
      onDone: () => {
        setIsAsking(false);
      },
    });
  }

  return (
    <GlassPanel className="flex h-full flex-col p-4" data-testid="operator-question-panel">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-[#55D8E6]" />
        <h3 className="text-sm font-semibold text-[#F5F7FA]">Ask the Chief Dispatch Officer</h3>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => ask(prompt)}
            disabled={isAsking}
            data-testid="operator-example-prompt"
            className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-[#9AA7B5] transition-colors hover:bg-white/[0.07] hover:text-[#F5F7FA] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto pr-1">
        {entries.length === 0 && (
          <EmptyState
            title="No questions yet"
            description="Ask a question grounded in this run's evidence, or pick an example above. Works even without a completed run."
          />
        )}
        {entries.map((entry, index) => (
          <div
            key={index}
            className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5"
            data-testid="operator-answer"
          >
            <p className="text-xs font-medium text-[#F5F7FA]">{entry.question}</p>
            {entry.answer && (
              <p className="mt-1 text-xs leading-relaxed text-[#9AA7B5]">{entry.answer}</p>
            )}
            {entry.citedEvidence.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {entry.citedEvidence.map((cite, citeIndex) => (
                  <li key={citeIndex} className="text-[10px] text-[#55D8E6]/80">
                    &middot; {cite}
                  </li>
                ))}
              </ul>
            )}
            {entry.error && <p className="mt-1 text-[11px] text-[#F4B860]">{entry.error}</p>}
            {entry.streaming && !entry.answer && !entry.error && (
              <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-[#9AA7B5]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Thinking...
              </p>
            )}
          </div>
        ))}
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this run..."
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[#F5F7FA] placeholder:text-[#9AA7B5]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#55D8E6]"
        />
        <button
          type="submit"
          disabled={!canAsk}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
            canAsk
              ? "border-[#55D8E6]/50 bg-[#55D8E6]/10 text-[#55D8E6] hover:bg-[#55D8E6]/20"
              : "border-white/10 bg-white/[0.03] text-[#9AA7B5]",
          )}
          aria-label="Ask"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </GlassPanel>
  );
}
