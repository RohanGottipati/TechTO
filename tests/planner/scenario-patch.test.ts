import { describe, expect, it } from "vitest";

import { parseScenarioPatch } from "@/lib/planner/scenario";
import { emptyTwinSnapshot, patchTwin, queryTwin } from "@/lib/planner/state";
import { diffTwin } from "@/lib/planner/diff";

describe("scenario patch + twin snapshot", () => {
  it("applies add_poi, close_route, set_policy and diffs", () => {
    const base = emptyTwinSnapshot();
    const patch = parseScenarioPatch({
      id: "p1",
      title: "Nuke probe",
      rationale: "test",
      edits: [
        {
          type: "add_poi",
          id: "poi-1",
          label: "Plant",
          lng: -79.34,
          lat: 43.65,
          kind: "energy",
        },
        { type: "close_route", routeRef: "1" },
        { type: "set_policy", key: "parking_levy", value: 0.05 },
      ],
    });
    const next = patchTwin(base, patch);
    expect(next.version).toBe(1);
    expect(next.pois).toHaveLength(1);
    expect(next.closedRoutes).toContain("1");
    expect(next.policies.parking_levy).toBe(0.05);

    const d = diffTwin(base, next);
    expect(d.addedPois).toEqual(["poi-1"]);
    expect(d.closedRoutesAdded).toEqual(["1"]);
    expect(d.policyChanges).toContain("parking_levy");
    expect(queryTwin(next, { kind: "pois" })).toHaveLength(1);
  });
});
