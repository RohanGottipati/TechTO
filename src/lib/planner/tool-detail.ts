/** Compact JSON preview for live tool traces (toggleable in chat). */

export function clipToolDetail(value: unknown, max = 700): string | undefined {
  if (value === undefined || value === null) return undefined;
  // prefer plain strings (e.g. specialist reply) over JSON quotes
  const s = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  if (!s || s === "{}" || s === "[]" || s === '""') return undefined;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Pick the most useful slice of a tool result for the detail pane. */
export function toolOutputPreview(toolName: string, output: unknown): string | undefined {
  if (!output || typeof output !== "object") return clipToolDetail(output);
  const o = output as Record<string, unknown>;
  // invoke_assistant: show who + what they said + tools they used
  if (toolName === "invoke_assistant") {
    return clipToolDetail({
      role: o.role,
      name: o.name,
      toolsUsed: o.toolsUsed,
      content: o.content,
    });
  }
  if (toolName === "compose_map_actions") {
    return clipToolDetail({
      accepted: o.accepted,
      rejected: o.rejected,
      errors: o.errors,
    });
  }
  // drop huge raw rows; keep counts / notes when present
  if ("features" in o && Array.isArray(o.features)) {
    return clipToolDetail({
      ...o,
      features: `[${o.features.length} features]`,
    });
  }
  return clipToolDetail(output);
}
