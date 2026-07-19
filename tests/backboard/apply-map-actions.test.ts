import { beforeEach, describe, expect, it } from "vitest";

import { applyMapActions } from "@/lib/twinto/apply-map-actions";
import { useMapStore } from "@/store/useMapStore";

describe("applyMapActions", () => {
  beforeEach(() => useMapStore.getState().reset());

  it("stores a bounds animation and official neighbourhood highlight", () => {
    applyMapActions([
      {
        type: "fit_bounds",
        bounds: [-79.5, 43.6, -79.4, 43.7],
        padding: 80,
        durationMs: 1200,
      },
      { type: "highlight_neighbourhoods", neighbourhoodIds: ["024"] },
    ]);

    expect(useMapStore.getState().boundsTarget).toEqual({
      bounds: [-79.5, 43.6, -79.4, 43.7],
      padding: 80,
      durationMs: 1200,
    });
    expect(useMapStore.getState().highlightedNeighbourhoodIds).toEqual(["024"]);
  });
});
