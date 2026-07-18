import { describe, expect, it } from "vitest";
import { buildPersonas, PERSONS_PER_DOT } from "@/lib/sim/personas";
import { pointInGeometry } from "@/lib/geo";
import type { NeighbourhoodCollection } from "@/lib/sim/types";

const city: NeighbourhoodCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: 1,
      properties: {
        code: "001",
        name: "Testville",
        population: 9000,
        income: 90000,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-79.4, 43.6],
            [-79.3, 43.6],
            [-79.3, 43.7],
            [-79.4, 43.7],
            [-79.4, 43.6],
          ],
        ],
      },
    },
    {
      type: "Feature",
      id: 2,
      properties: {
        code: "002",
        name: "Smallburg",
        population: 900,
        income: null,
      },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-79.2, 43.6],
            [-79.1, 43.6],
            [-79.1, 43.7],
            [-79.2, 43.7],
            [-79.2, 43.6],
          ],
        ],
      },
    },
  ],
};

describe("buildPersonas", () => {
  it("scales dot count with census population", () => {
    const personas = buildPersonas(city);
    const big = personas.filter((p) => p.code === "001").length;
    const small = personas.filter((p) => p.code === "002").length;
    expect(big).toBe(Math.round(9000 / PERSONS_PER_DOT));
    // Small neighbourhoods are floored at 3 dots so none disappears.
    expect(small).toBe(Math.max(3, Math.round(900 / PERSONS_PER_DOT)));
  });

  it("places every persona inside its neighbourhood polygon", () => {
    const personas = buildPersonas(city);
    for (const p of personas) {
      const feature = city.features.find(
        (f) => f.properties.code === p.code
      )!;
      expect(pointInGeometry([p.lng, p.lat], feature.geometry)).toBe(true);
    }
  });

  it("is deterministic across runs", () => {
    const a = buildPersonas(city);
    const b = buildPersonas(city);
    expect(a.length).toBe(b.length);
    expect(a[0].lng).toBe(b[0].lng);
    expect(a[a.length - 1].transitAffinity).toBe(
      b[b.length - 1].transitAffinity
    );
  });

  it("keeps behavioural attributes in [0, 1]", () => {
    for (const p of buildPersonas(city)) {
      expect(p.transitAffinity).toBeGreaterThanOrEqual(0);
      expect(p.transitAffinity).toBeLessThanOrEqual(1);
      expect(p.carDependence).toBeGreaterThanOrEqual(0);
      expect(p.carDependence).toBeLessThanOrEqual(1);
    }
  });
});
