/** Short chat-log lines for City Code tool / lifecycle steps. */

const TOOL_STEP: Record<string, { start: string; done: string }> = {
  search_neighbourhoods: {
    start: "Searching neighbourhoods…",
    done: "Found neighbourhood matches",
  },
  compose_map_actions: {
    start: "Updating the map…",
    done: "Map updated",
  },
  propose_scenarios: {
    start: "Drafting scenario options…",
    done: "Scenarios drafted",
  },
  score_population: {
    start: "Scoring day-one acceptance…",
    done: "Acceptance scores ready",
  },
  get_current_map_context: {
    start: "Reading map context…",
    done: "Got map context",
  },
  get_network_snapshot: {
    start: "Loading transit network…",
    done: "Network snapshot loaded",
  },
  invoke_assistant: {
    start: "Calling a specialist…",
    done: "Specialist finished",
  },
  run_python: {
    start: "Running analysis code…",
    done: "Analysis finished",
  },
  patch_twin: {
    start: "Patching the city twin…",
    done: "Twin patched",
  },
  query_twin: {
    start: "Querying the twin…",
    done: "Twin query returned",
  },
  run_twin_analysis: {
    start: "Running twin analysis…",
    done: "Twin analysis done",
  },
  snapshot_twin: {
    start: "Taking a twin snapshot…",
    done: "Snapshot saved",
  },
  diff_twin: {
    start: "Diffing twin versions…",
    done: "Diff ready",
  },
  generate_station_candidates: {
    start: "Generating station candidates…",
    done: "Station candidates ready",
  },
  call_citizen_reaction_model: {
    start: "Sampling citizen reactions…",
    done: "Citizen reactions ready",
  },
};

export function toolStartMessage(toolName: string): string {
  return TOOL_STEP[toolName]?.start ?? `Running ${toolName.replaceAll("_", " ")}…`;
}

export function toolDoneMessage(toolName: string, ok: boolean): string {
  if (!ok) return `Failed: ${toolName.replaceAll("_", " ")}`;
  return TOOL_STEP[toolName]?.done ?? `Finished ${toolName.replaceAll("_", " ")}`;
}
