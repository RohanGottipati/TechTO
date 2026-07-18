import { describe, expect, it } from "vitest";
import {
  distanceKm,
  distanceToPolylineKm,
  geometryBbox,
  pointInGeometry,
  pointInPolygon,
  type LngLat,
} from "@/lib/geo";

const square: LngLat[][] = [
  [
    [-79.4, 43.6],
    [-79.3, 43.6],
    [-79.3, 43.7],
    [-79.4, 43.7],
    [-79.4, 43.6],
  ],
];

describe("geo", () => {
  it("computes plausible city-scale distances", () => {
    // Union Station to Kennedy Station is ~18 km.
    const d = distanceKm([-79.3806, 43.6453], [-79.2637, 43.7325]);
    expect(d).toBeGreaterThan(12);
    expect(d).toBeLessThan(16);
  });

  it("detects points inside and outside a polygon", () => {
    expect(pointInPolygon([-79.35, 43.65], square)).toBe(true);
    expect(pointInPolygon([-79.5, 43.65], square)).toBe(false);
  });

  it("respects polygon holes", () => {
    const withHole: LngLat[][] = [
      square[0],
      [
        [-79.37, 43.63],
        [-79.33, 43.63],
        [-79.33, 43.67],
        [-79.37, 43.67],
        [-79.37, 43.63],
      ],
    ];
    expect(pointInPolygon([-79.35, 43.65], withHole)).toBe(false);
    expect(pointInPolygon([-79.39, 43.61], withHole)).toBe(true);
  });

  it("handles MultiPolygon geometry", () => {
    const geom = {
      type: "MultiPolygon" as const,
      coordinates: [square],
    };
    expect(pointInGeometry([-79.35, 43.65], geom)).toBe(true);
    expect(pointInGeometry([-79.2, 43.65], geom)).toBe(false);
  });

  it("measures distance to a polyline", () => {
    const line: LngLat[] = [
      [-79.4, 43.65],
      [-79.3, 43.65],
    ];
    // A point 0.01 deg lat above the middle of the line: ~1.1 km.
    const d = distanceToPolylineKm([-79.35, 43.66], line);
    expect(d).toBeGreaterThan(1.0);
    expect(d).toBeLessThan(1.2);
    // A point on the line is at distance ~0.
    expect(distanceToPolylineKm([-79.35, 43.65], line)).toBeLessThan(0.001);
  });

  it("computes bounding boxes", () => {
    expect(geometryBbox({ type: "Polygon", coordinates: square })).toEqual([
      -79.4, 43.6, -79.3, 43.7,
    ]);
  });
});
