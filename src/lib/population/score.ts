import { distanceKm, distanceToPolylineKm, type LngLat } from "@/lib/geo";
import { hashString, mulberry32 } from "@/lib/random";
import type { TwinSnapshot } from "@/lib/planner/state";
import {
  HISTOGRAM_BINS,
  OPPOSE_THRESHOLD,
  SUPPORT_THRESHOLD,
  type Persona,
} from "@/lib/sim/types";

export interface PopulationScoreInput {
  personas: Persona[];
  twin: TwinSnapshot;
  question: string;
  scenarioId: string;
  seed?: number;
}

export interface PopulationScoreResult {
  scenarioId: string;
  acceptance: Float32Array;
  opinions?: string[];
  citywide: {
    mean: number;
    supportShare: number;
    opposeShare: number;
    hist: number[];
  };
  byNeighbourhood: Record<string, { mean: number; count: number }>;
  provider: string;
}

export interface PopulationProvider {
  load(): Promise<Persona[]>;
  score(input: PopulationScoreInput): Promise<PopulationScoreResult>;
  getStatus(): Promise<{ mode: string; personaCount?: number }>;
}

function clamp(x: number, lo = 0.02, hi = 0.98): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Score acceptance from twin edits (mechanistic stand-in until census LM). */
export function scoreTwinAgainstPersonas(input: PopulationScoreInput): PopulationScoreResult {
  const seed = input.seed ?? hashString(`pop:${input.scenarioId}:${input.question.slice(0, 40)}`);
  const rng = mulberry32(seed);
  const n = input.personas.length;
  const acceptance = new Float32Array(n);
  const twin = input.twin;

  for (let i = 0; i < n; i++) {
    const p = input.personas[i];
    const home: LngLat = [p.lng, p.lat];
    let a = 0.5;
    const noise = (rng() - 0.5) * 0.1;

    for (const poi of twin.pois) {
      const d = distanceKm(home, [poi.lng, poi.lat]);
      const prox = Math.exp(-d / 2.5);
      if (poi.kind === "energy") {
        // energy facilities: nearby residents dislike, far mildly indifferent
        a -= prox * 0.55 * (0.6 + Math.max(0, -p.incomeZ) * 0.15);
        a += (1 - prox) * 0.02;
      } else if (poi.kind === "stadium") {
        a += prox * 0.2 * p.transitAffinity;
        a -= prox * 0.25 * p.carDependence;
        a -= prox * 0.15; // noise/traffic local pain
      } else if (poi.kind === "station") {
        a += prox * 0.4 * (0.4 + p.transitAffinity);
        a -= prox * 0.12 * p.carDependence;
      } else {
        a += prox * 0.1 * (p.transitAffinity - 0.3);
      }
    }

    for (const corr of twin.corridors) {
      const d = distanceToPolylineKm(home, corr.alignment);
      const prox = Math.exp(-d / corr.reachKm);
      a += prox * 0.35 * (0.35 + p.transitAffinity);
      a -= prox * 0.18 * p.carDependence;
    }

    for (const _route of twin.closedRoutes) {
      // closing a major line: transit riders hurt citywide, drivers less so
      a -= 0.22 * p.transitAffinity;
      a += 0.05 * p.carDependence;
    }

    for (const [code, use] of Object.entries(twin.landUse)) {
      if (code !== p.code) continue;
      if (use.includes("stadium") || use.includes("industrial") || use.includes("energy")) {
        a -= 0.2;
      } else {
        a += 0.05;
      }
    }

    if (twin.policies.status_quo === true) {
      a = 0.5 + 0.08 * (p.transitAffinity - p.carDependence) + noise * 0.5;
    }

    acceptance[i] = clamp(a + noise);
  }

  return aggregateScore(input.scenarioId, input.personas, acceptance, "synthetic");
}

export function aggregateScore(
  scenarioId: string,
  personas: Persona[],
  acceptance: Float32Array,
  provider: string,
  opinions?: string[],
): PopulationScoreResult {
  const hist = new Array<number>(HISTOGRAM_BINS).fill(0);
  const sums = new Map<string, { sum: number; count: number }>();
  let support = 0;
  let oppose = 0;
  let total = 0;
  const n = personas.length || 1;

  for (let i = 0; i < personas.length; i++) {
    const a = acceptance[i];
    const code = personas[i].code;
    const s = sums.get(code) ?? { sum: 0, count: 0 };
    s.sum += a;
    s.count++;
    sums.set(code, s);
    hist[Math.min(HISTOGRAM_BINS - 1, Math.floor(a * HISTOGRAM_BINS))]++;
    if (a >= SUPPORT_THRESHOLD) support++;
    else if (a < OPPOSE_THRESHOLD) oppose++;
    total += a;
  }

  const byNeighbourhood: Record<string, { mean: number; count: number }> = {};
  for (const [code, { sum, count }] of sums) {
    byNeighbourhood[code] = { mean: sum / count, count };
  }

  return {
    scenarioId,
    acceptance,
    opinions,
    citywide: {
      mean: total / n,
      supportShare: support / n,
      opposeShare: oppose / n,
      hist,
    },
    byNeighbourhood,
    provider,
  };
}
