import { describe, expect, it } from "vitest";

import {
  formatTorontoAreaScreeningAnswer,
  getTorontoAreaCatalog,
  mapActionsForTorontoArea,
  queryTorontoAreas,
  recommendTorontoArea,
} from "@/lib/toronto/area-catalog";
import { parseMapActions } from "@/lib/twinto/map-actions";
import { isInsideToronto } from "@/lib/twinto/toronto-scope";

describe("Toronto area catalogue", () => {
  it("loads all official neighbourhoods with Toronto-safe screening features", () => {
    const areas = getTorontoAreaCatalog();
    expect(areas).toHaveLength(158);
    for (const area of areas) {
      expect(isInsideToronto(area.center[0], area.center[1])).toBe(true);
      expect(area.population).toBeGreaterThan(0);
      expect(area.populationDensity).toBeGreaterThan(0);
      expect(area.rapidTransitGapKm).toBeGreaterThanOrEqual(0);
      expect(area.fallbackScore).toBeGreaterThanOrEqual(0);
      expect(area.fallbackScore).toBeLessThanOrEqual(1);
    }
  });

  it("queries deterministically and uses the documented fallback winner", () => {
    const first = queryTorontoAreas({ sortBy: "fallbackScore", direction: "desc", limit: 5 });
    const second = queryTorontoAreas({ sortBy: "fallbackScore", direction: "desc", limit: 5 });
    expect(first.map((area) => area.code)).toEqual(second.map((area) => area.code));
    expect(recommendTorontoArea().code).toBe(first[0].code);
  });

  it("builds one validated focus and highlight action pair", () => {
    const result = parseMapActions(mapActionsForTorontoArea(recommendTorontoArea()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.actions.map((action) => action.type)).toEqual([
        "fit_bounds",
        "highlight_neighbourhoods",
      ]);
    }
  });

  it("formats the recommendation as evidence, potential, KPIs, and validation steps", () => {
    const answer = formatTorontoAreaScreeningAnswer(recommendTorontoArea());
    expect(answer).toContain("RECOMMENDATION");
    expect(answer).toContain("WHY THIS AREA");
    expect(answer).toContain("SUSTAINABILITY POTENTIAL");
    expect(answer).toContain("SCREENING METRICS");
    expect(answer).toContain("SUCCESS KPIS TO VALIDATE");
    expect(answer).toContain("WHAT TO VALIDATE NEXT");
    expect(answer).toContain("not measured outcomes or promises");
    expect(answer).toContain("• Population:");
  });
});
