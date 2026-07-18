import { describe, expect, it } from "vitest";
import { runScenario } from "@/lib/sim/engine";
import { SCENARIOS } from "@/lib/sim/scenarios";
import { HISTOGRAM_BINS, type Persona, type RouteCollection } from "@/lib/sim/types";

const routes: RouteCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {
        route: "504",
        name: "King",
        mode: "streetcar",
        gtfs_color: "#ED1C24",
      },
      geometry: {
        type: "LineString",
        coordinates: [
          [-79.42, 43.645],
          [-79.36, 43.65],
        ],
      },
    },
  ],
};

function persona(overrides: Partial<Persona>, id: number): Persona {
  return {
    id,
    lng: -79.39,
    lat: 43.648,
    code: "001",
    incomeZ: 0,
    transitAffinity: 0.5,
    carDependence: 0.5,
    ...overrides,
  };
}

const personas: Persona[] = [
  // Downtown transit lover near King St.
  persona({ transitAffinity: 0.95, carDependence: 0.05 }, 0),
  // Downtown driver near King St.
  persona({ transitAffinity: 0.05, carDependence: 0.95 }, 1),
  // Suburban driver far from every corridor.
  persona(
    { lng: -79.55, lat: 43.75, transitAffinity: 0.1, carDependence: 0.9 },
    2
  ),
];

describe("runScenario", () => {
  it("keeps acceptance within [0, 1] for every scenario", () => {
    for (const s of SCENARIOS) {
      const r = runScenario(s.id, personas, routes);
      for (const a of r.acceptance) {
        expect(a).toBeGreaterThanOrEqual(0);
        expect(a).toBeLessThanOrEqual(1);
      }
    }
  });

  it("splits King St priority by mode dependence", () => {
    const r = runScenario("king-priority", personas, routes);
    // The nearby rider should clearly out-support the nearby driver.
    expect(r.acceptance[0]).toBeGreaterThan(r.acceptance[1] + 0.15);
  });

  it("makes the parking levy unpopular with car-dependent residents", () => {
    const r = runScenario("parking-levy", personas, routes);
    expect(r.acceptance[0]).toBeGreaterThan(r.acceptance[2]);
  });

  it("aggregates a consistent histogram and shares", () => {
    const r = runScenario("baseline", personas, routes);
    expect(r.histogram).toHaveLength(HISTOGRAM_BINS);
    expect(r.histogram.reduce((a, b) => a + b, 0)).toBe(personas.length);
    expect(r.supportShare + r.opposeShare).toBeLessThanOrEqual(1);
    expect(r.byNeighbourhood.get("001")?.count).toBe(3);
  });

  it("is deterministic for a given scenario", () => {
    const a = runScenario("waterfront-lrt", personas, routes);
    const b = runScenario("waterfront-lrt", personas, routes);
    expect(Array.from(a.acceptance)).toEqual(Array.from(b.acceptance));
  });
});
