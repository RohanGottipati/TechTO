/**
 * Real neighbourhood centroids, computed from the actual City of Toronto
 * neighbourhood boundary polygons already committed at
 * `public/data/neighbourhoods.geojson` (see AGENTS.md 6.1) -- not a
 * hardcoded illustrative lookup like the old `ZONE_COORDINATES`. Pure,
 * isomorphic math only (no file I/O) so it can run in both server routes
 * and client components; callers fetch/read the GeoJSON themselves.
 */

type Ring = [number, number][];
type Polygon = Ring[];

/** Signed area (shoelace formula) of a closed ring; used only to pick the largest polygon in a MultiPolygon. */
function ringArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

/** Area-weighted centroid of a closed ring (standard polygon centroid formula), ignoring holes. */
function ringCentroid(ring: Ring): [number, number] {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area /= 2;
  if (area === 0) {
    // Degenerate ring (zero-area sliver): fall back to the vertex average.
    const n = ring.length - 1;
    const [sx, sy] = ring.slice(0, n).reduce(([ax, ay], [x, y]) => [ax + x, ay + y], [0, 0]);
    return [sx / n, sy / n];
  }
  return [cx / (6 * area), cy / (6 * area)];
}

/** Centroid of a MultiPolygon: the centroid of its largest-by-area constituent polygon. */
function multiPolygonCentroid(polygons: Polygon[]): [number, number] {
  let largest = polygons[0];
  let largestArea = Math.abs(ringArea(polygons[0][0]));
  for (const polygon of polygons.slice(1)) {
    const area = Math.abs(ringArea(polygon[0]));
    if (area > largestArea) {
      largest = polygon;
      largestArea = area;
    }
  }
  return ringCentroid(largest[0]);
}

export interface NeighbourhoodGeoJsonFeature {
  properties: { code: string; name: string };
  geometry: { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
}

export interface NeighbourhoodGeoJson {
  features: NeighbourhoodGeoJsonFeature[];
}

/** Builds a `neighbourhood_code -> [lng, lat]` lookup of real centroids from an already-parsed neighbourhoods GeoJSON. */
export function computeNeighbourhoodCentroids(geojson: NeighbourhoodGeoJson): Record<string, [number, number]> {
  const result: Record<string, [number, number]> = {};
  for (const feature of geojson.features) {
    const polygons: Polygon[] =
      feature.geometry.type === "MultiPolygon"
        ? (feature.geometry.coordinates as Polygon[])
        : [feature.geometry.coordinates as Polygon];
    result[feature.properties.code] = multiPolygonCentroid(polygons);
  }
  return result;
}
