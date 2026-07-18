import { describe, expect, it } from "vitest";

import { emptyTwinSnapshot, patchTwin } from "@/lib/planner/state";
import { parseScenarioPatch } from "@/lib/planner/scenario";
import { SyntheticPopulationProvider, buildToyPersonas } from "@/lib/population/provider";

describe("SyntheticPopulationProvider", () => {
  it("returns finite acceptance + citywide hist (seed 2262)", async () => {
    const personas = buildToyPersonas(40);
    const pop = new SyntheticPopulationProvider(personas);
    const twin = patchTwin(
      emptyTwinSnapshot(),
      parseScenarioPatch({
        id: "station-a",
        title: "Station",
        rationale: "test",
        edits: [
          {
            type: "add_poi",
            id: "s1",
            label: "Stop",
            lng: -79.4,
            lat: 43.65,
            kind: "station",
          },
        ],
      }),
    );
    const score = await pop.score({
      personas,
      twin,
      question: "where should i open a station",
      scenarioId: "station-a",
      seed: 2262,
    });
    expect(score.acceptance.length).toBe(40);
    expect(Number.isFinite(score.citywide.mean)).toBe(true);
    expect(score.citywide.hist.reduce((a, b) => a + b, 0)).toBe(40);
    expect(score.provider).toBe("synthetic");
  });
});
