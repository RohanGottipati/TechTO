"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { GlassPanel } from "@/components/primitives/GlassPanel";
import { EmptyState } from "@/components/feedback/EmptyState";
import { formatTimestamp } from "@/lib/gridtwin/format";

interface MemoryRecordDto {
  id: string;
  content: string;
  score: number | null;
  createdAt: string | null;
}

const DEFAULT_ASSISTANT_ROLE = "chief-dispatch-officer";

/**
 * Curated long-term memory for one assistant role. Every GridTwin run uses
 * memory: "Readonly" (see ASSISTANT_ROSTER), so nothing is ever written here
 * automatically; adding a memory is always an explicit operator action.
 */
export function ApprovedMemoryPanel() {
  const [memories, setMemories] = useState<MemoryRecordDto[]>([]);
  const [query, setQuery] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/backboard/memories?assistantRole=${DEFAULT_ASSISTANT_ROLE}`,
      );
      if (!response.ok) {
        throw new Error(`Failed to load memories (status ${response.status}).`);
      }
      const data = (await response.json()) as { memories: MemoryRecordDto[] };
      setMemories(data.memories);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  async function search(text: string) {
    setQuery(text);
    if (text.trim().length === 0) {
      loadMemories();
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/backboard/memories/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantRole: DEFAULT_ASSISTANT_ROLE, query: text }),
      });
      if (!response.ok) {
        throw new Error(`Search failed (status ${response.status}).`);
      }
      const data = (await response.json()) as { memories: MemoryRecordDto[] };
      setMemories(data.memories);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsLoading(false);
    }
  }

  async function addMemory() {
    const content = newContent.trim();
    if (!content || isMutating) return;
    setIsMutating(true);
    setError(null);
    try {
      const response = await fetch("/api/backboard/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantRole: DEFAULT_ASSISTANT_ROLE, content }),
      });
      if (!response.ok) {
        throw new Error(`Failed to add memory (status ${response.status}).`);
      }
      setNewContent("");
      await loadMemories();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsMutating(false);
    }
  }

  async function removeMemory(memoryId: string) {
    setIsMutating(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/backboard/memories/${memoryId}?assistantRole=${DEFAULT_ASSISTANT_ROLE}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(`Failed to delete memory (status ${response.status}).`);
      }
      setMemories((prev) => prev.filter((memory) => memory.id !== memoryId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <GlassPanel className="flex h-full flex-col p-4">
      <div className="flex items-center gap-2">
        <BookOpen className="h-4 w-4 text-[#55D8E6]" />
        <h3 className="text-sm font-semibold text-[#F5F7FA]">Approved Memory</h3>
      </div>
      <p className="mt-1 text-[11px] text-[#9AA7B5]">
        Curated, operator-approved notes for the Chief Dispatch Officer. Runs only ever read this
        (memory: Readonly); nothing is written automatically.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9AA7B5]" />
          <input
            value={query}
            onChange={(event) => search(event.target.value)}
            placeholder="Search memory..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-1.5 pl-8 pr-2 text-xs text-[#F5F7FA] placeholder:text-[#9AA7B5]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#55D8E6]"
          />
        </div>
      </div>

      {error && <p className="mt-2 text-[11px] text-[#FF6B6B]">{error}</p>}

      <div className="mt-3 flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <p className="inline-flex items-center gap-1.5 text-xs text-[#9AA7B5]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading memory...
          </p>
        ) : memories.length === 0 ? (
          <EmptyState
            title="No memory yet"
            description="Approved notes about past runs and operator preferences will appear here."
          />
        ) : (
          <ul className="space-y-2">
            {memories.map((memory) => (
              <li
                key={memory.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs text-[#F5F7FA]/90">{memory.content}</p>
                  {memory.createdAt && (
                    <p className="mt-1 text-[10px] text-[#9AA7B5]">
                      {formatTimestamp(memory.createdAt)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Delete memory"
                  onClick={() => removeMemory(memory.id)}
                  disabled={isMutating}
                  className="shrink-0 rounded-md p-1 text-[#9AA7B5] transition-colors hover:text-[#FF6B6B] disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          addMemory();
        }}
      >
        <input
          value={newContent}
          onChange={(event) => setNewContent(event.target.value)}
          placeholder="Approve a new memory note..."
          className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-[#F5F7FA] placeholder:text-[#9AA7B5]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#55D8E6]"
        />
        <button
          type="submit"
          disabled={isMutating || newContent.trim().length === 0}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#55D8E6]/50 bg-[#55D8E6]/10 text-[#55D8E6] transition-colors hover:bg-[#55D8E6]/20 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Add memory"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </GlassPanel>
  );
}
