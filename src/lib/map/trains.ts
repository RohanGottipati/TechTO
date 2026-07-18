/**
 * Synthetic subway/LRT/streetcar vehicle motion along the real TTC route
 * alignments loaded from public/data/ttc-routes.geojson. Positions are a
 * visual preview — evenly spaced vehicles bouncing end-to-end at a fixed
 * pace — not a timetable or a measured running speed.
 */
import { distanceKm, type LngLat } from "@/lib/geo";
import type { RouteCollection } from "@/lib/sim/types";

export interface RoutePath {
  points: LngLat[];
  /** Cumulative distance in meters from points[0] to points[i]. */
  cumulative: number[];
  total: number;
}

export function buildRoutePath(points: LngLat[]): RoutePath {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + distanceKm(points[i - 1], points[i]) * 1000);
  }
  return { points, cumulative, total: cumulative[cumulative.length - 1] ?? 0 };
}

function bearingDegrees(a: LngLat, b: LngLat): number {
  const lat1 = (a[1] * Math.PI) / 180;
  const lat2 = (b[1] * Math.PI) / 180;
  const dLng = ((b[0] - a[0]) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export interface TrainPose {
  lng: number;
  lat: number;
  bearing: number;
}

/** Interpolates a point at `distanceMeters` along the path (no bearing). */
function pointAtDistance(path: RoutePath, distanceMeters: number): LngLat {
  const { points, cumulative, total } = path;
  if (points.length < 2) return points[0] ?? [0, 0];
  const d = Math.max(0, Math.min(total, distanceMeters));

  let low = 0;
  let high = cumulative.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (cumulative[mid] <= d) low = mid;
    else high = mid - 1;
  }
  const idx = Math.min(low, points.length - 2);

  const segStart = cumulative[idx];
  const segLen = cumulative[idx + 1] - segStart || 1;
  const t = (d - segStart) / segLen;
  const a = points[idx];
  const b = points[idx + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Real GTFS shape vertices are dense and locally noisy (survey/GPS jitter,
 * short platform-approach segments), so bearing from the single adjacent
 * segment can snap several degrees off the line's visual direction — glaring
 * on a long, narrow car sprite. Averaging over a lookahead/lookbehind window
 * smooths that out.
 */
const BEARING_SAMPLE_METERS = 120;

/** Samples a point at `distanceMeters` along the path, oriented for travel in `forward` direction. */
export function poseAtDistance(path: RoutePath, distanceMeters: number, forward: boolean): TrainPose {
  const { total } = path;
  const d = Math.max(0, Math.min(total, distanceMeters));
  const [lng, lat] = pointAtDistance(path, d);

  const span = Math.min(BEARING_SAMPLE_METERS, total / 2);
  const behind = pointAtDistance(path, d - span);
  const ahead = pointAtDistance(path, d + span);
  const rawBearing = bearingDegrees(behind, ahead);
  const bearing = forward ? rawBearing : (rawBearing + 180) % 360;
  return { lng, lat, bearing };
}

/** Triangle wave with period 2: rises 0→1 over [0,1], falls 1→0 over [1,2]. */
function triangleWave(x: number): number {
  const m = ((x % 2) + 2) % 2;
  return m <= 1 ? m : 2 - m;
}

export interface TrainRouteConfig {
  routeId: string;
  path: RoutePath;
  trainCount: number;
  roundTripSeconds: number;
}

/** Visual pace only, tuned for a readable simulation — not a measured TTC running speed. */
const TRAIN_SPEED_MPS = 55;
/** Roughly one train per this many meters of line, so longer lines carry proportionally more cars. */
const TRAIN_SPACING_METERS = 2400;
const MIN_TRAINS_PER_ROUTE = 2;
const MAX_TRAINS_PER_ROUTE = 8;

/** Dwell time at a simulated "station stop", seconds. */
const STOP_SECONDS = 5;
/** Run time between stops varies per train, randomized in this range, so the whole line doesn't stop in lockstep. */
const MOVE_SECONDS_MIN = 7;
const MOVE_SECONDS_MAX = 10;

/** Deterministic pseudo-random float in [0, 1) for a given seed string. */
function hash01(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const x = Math.sin(h) * 43758.5453;
  return x - Math.floor(x);
}

export function buildTrainRouteConfigs(
  routes: RouteCollection,
  modes: readonly string[] = ["subway", "lrt"]
): TrainRouteConfig[] {
  const configs: TrainRouteConfig[] = [];
  for (const feature of routes.features) {
    if (!modes.includes(feature.properties.mode)) continue;
    const coords = feature.geometry.coordinates;
    if (coords.length < 2) continue;
    const path = buildRoutePath(coords);
    if (path.total < 200) continue;
    const routeId = feature.properties.route;
    const trainCount = Math.min(
      MAX_TRAINS_PER_ROUTE,
      Math.max(MIN_TRAINS_PER_ROUTE, Math.round(path.total / TRAIN_SPACING_METERS))
    );
    configs.push({
      routeId,
      path,
      trainCount,
      roundTripSeconds: (2 * path.total) / TRAIN_SPEED_MPS,
    });
  }
  return configs;
}

export function trainCollection(
  configs: TrainRouteConfig[],
  elapsedSeconds: number
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const { routeId, path, trainCount, roundTripSeconds } of configs) {
    for (let k = 0; k < trainCount; k++) {
      const phaseSeconds = (k / trainCount) * roundTripSeconds;

      // Stop-and-go: only accumulate travel time while "moving"; time spent
      // in the dwell window leaves the train parked at its last position, so
      // it reads as stopping at a station rather than gliding continuously.
      const moveSeconds =
        MOVE_SECONDS_MIN + hash01(`${routeId}-${k}`) * (MOVE_SECONDS_MAX - MOVE_SECONDS_MIN);
      const cycleSeconds = moveSeconds + STOP_SECONDS;
      const trainClock = elapsedSeconds + phaseSeconds;
      const cycleIndex = Math.floor(trainClock / cycleSeconds);
      const withinCycle = trainClock - cycleIndex * cycleSeconds;
      const movedSeconds = cycleIndex * moveSeconds + Math.min(withinCycle, moveSeconds);

      const cyclePos = (movedSeconds / roundTripSeconds) * 2;
      const forward = ((cyclePos % 2) + 2) % 2 <= 1;
      const pose = poseAtDistance(path, triangleWave(cyclePos) * path.total, forward);
      features.push({
        type: "Feature",
        properties: { routeId, bearing: pose.bearing },
        geometry: { type: "Point", coordinates: [pose.lng, pose.lat] },
      });
    }
  }
  return { type: "FeatureCollection", features };
}
