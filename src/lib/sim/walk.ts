// Deterministic per-resident wander motion. Each persona dot ambles around
// its home point on a slow two-harmonic path (a Lissajous-style curve) so the
// map reads as residents moving around their block, not static census marks.
// Stateless: position is a pure function of persona id and elapsed time, so
// it composes with the acceptance-color sweep without extra bookkeeping.

import { mulberry32, hashString } from "@/lib/random";
import type { Persona } from "./types";

const KM_PER_DEG_LAT = 110.574;
const KM_PER_DEG_LON = 111.32 * Math.cos((43.7 * Math.PI) / 180);

export interface WalkParams {
  ampLng: Float32Array;
  ampLat: Float32Array;
  freq1: Float32Array;
  freq2: Float32Array;
  phaseLng1: Float32Array;
  phaseLng2: Float32Array;
  phaseLat1: Float32Array;
  phaseLat2: Float32Array;
}

/** Wander radius, in metres, that a dot roams from its home point. */
const MIN_RADIUS_M = 35;
const MAX_RADIUS_M = 105;

export function buildWalkParams(personas: Persona[]): WalkParams {
  const n = personas.length;
  const ampLng = new Float32Array(n);
  const ampLat = new Float32Array(n);
  const freq1 = new Float32Array(n);
  const freq2 = new Float32Array(n);
  const phaseLng1 = new Float32Array(n);
  const phaseLng2 = new Float32Array(n);
  const phaseLat1 = new Float32Array(n);
  const phaseLat2 = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const rng = mulberry32(hashString(`walk:${personas[i].id}`));
    const radiusM = MIN_RADIUS_M + rng() * (MAX_RADIUS_M - MIN_RADIUS_M);
    ampLng[i] = radiusM / 1000 / KM_PER_DEG_LON;
    ampLat[i] = radiusM / 1000 / KM_PER_DEG_LAT;

    // Two incommensurate periods (1-2s and a non-integer fraction of it) so
    // the path never quite repeats and dots drift out of sync.
    const period1 = 1000 + rng() * 1000;
    const period2 = period1 * (0.4 + rng() * 0.25);
    freq1[i] = (Math.PI * 2) / period1;
    freq2[i] = (Math.PI * 2) / period2;

    phaseLng1[i] = rng() * Math.PI * 2;
    phaseLng2[i] = rng() * Math.PI * 2;
    phaseLat1[i] = rng() * Math.PI * 2;
    phaseLat2[i] = rng() * Math.PI * 2;
  }

  return {
    ampLng,
    ampLat,
    freq1,
    freq2,
    phaseLng1,
    phaseLng2,
    phaseLat1,
    phaseLat2,
  };
}

/** Wander offset for persona index `i` at time `t` (ms), as [dLng, dLat]. */
export function walkOffset(w: WalkParams, i: number, t: number): [number, number] {
  const dLng =
    w.ampLng[i] *
    (0.7 * Math.sin(w.freq1[i] * t + w.phaseLng1[i]) +
      0.3 * Math.sin(w.freq2[i] * t + w.phaseLng2[i]));
  const dLat =
    w.ampLat[i] *
    (0.7 * Math.sin(w.freq1[i] * t + w.phaseLat1[i]) +
      0.3 * Math.sin(w.freq2[i] * t + w.phaseLat2[i]));
  return [dLng, dLat];
}
