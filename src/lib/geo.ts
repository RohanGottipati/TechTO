// Small planar-approximation geometry helpers. At Toronto's latitude and city
// scale the equirectangular approximation is accurate to well under 1%.

export type LngLat = [number, number];

const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LON = 111.32 * Math.cos((43.7 * Math.PI) / 180);

export function distanceKm(a: LngLat, b: LngLat): number {
  const dx = (a[0] - b[0]) * KM_PER_DEG_LON;
  const dy = (a[1] - b[1]) * KM_PER_DEG_LAT;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distanceToSegmentKm(p: LngLat, a: LngLat, b: LngLat): number {
  const px = p[0] * KM_PER_DEG_LON;
  const py = p[1] * KM_PER_DEG_LAT;
  const ax = a[0] * KM_PER_DEG_LON;
  const ay = a[1] * KM_PER_DEG_LAT;
  const bx = b[0] * KM_PER_DEG_LON;
  const by = b[1] * KM_PER_DEG_LAT;
  const dx = bx - ax;
  const dy = by - ay;
  const seg2 = dx * dx + dy * dy;
  const t =
    seg2 === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / seg2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
}

export function distanceToPolylineKm(p: LngLat, line: LngLat[]): number {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const d = distanceToSegmentKm(p, line[i], line[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

function pointInRing(p: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > p[1] !== yj > p[1] &&
      p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/** Point-in-polygon for a GeoJSON Polygon coordinate array (outer ring + holes). */
export function pointInPolygon(p: LngLat, polygon: LngLat[][]): boolean {
  if (!pointInRing(p, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(p, polygon[i])) return false;
  }
  return true;
}

export type PolygonGeometry =
  | { type: "Polygon"; coordinates: LngLat[][] }
  | { type: "MultiPolygon"; coordinates: LngLat[][][] };

export function pointInGeometry(p: LngLat, geom: PolygonGeometry): boolean {
  if (geom.type === "Polygon") return pointInPolygon(p, geom.coordinates);
  return geom.coordinates.some((poly) => pointInPolygon(p, poly));
}

export function geometryBbox(
  geom: PolygonGeometry
): [number, number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const rings =
    geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return [minX, minY, maxX, maxY];
}
