// Synthetic preview engine. This is the web-layer stand-in for the real
// population simulator (census-weighted LM personas; see AGENTS.md): it maps
// physically-real proximity features to a plausible acceptance value with a
// deterministic mechanistic rule. It predicts nothing; it exists so the
// dashboard is fully interactive before the model is wired in.

import { distanceKm, distanceToPolylineKm, type LngLat } from "@/lib/geo";
import { mulberry32, hashString } from "@/lib/random";
import { CITY_CENTER } from "./personas";
import { getScenario, type Scenario } from "./scenarios";
import {
  HISTOGRAM_BINS,
  OPPOSE_THRESHOLD,
  SUPPORT_THRESHOLD,
  type Persona,
  type RouteCollection,
  type ScenarioResult,
} from "./types";

function clamp(x: number, lo = 0.02, hi = 0.98): number {
  return Math.max(lo, Math.min(hi, x));
}

export function resolveAlignment(
  scenario: Scenario,
  routes: RouteCollection
): LngLat[] | null {
  if (scenario.alignment) return scenario.alignment;
  if (scenario.routeRef) {
    const feature = routes.features.find(
      (f) => f.properties.route === scenario.routeRef
    );
    return feature ? feature.geometry.coordinates : null;
  }
  return null;
}

export function runScenario(
  scenarioId: string,
  personas: Persona[],
  routes: RouteCollection
): ScenarioResult {
  const scenario = getScenario(scenarioId);
  const n = personas.length;
  const acceptance = new Float32Array(n);
  const sweepKm = new Float32Array(n);
  const rng = mulberry32(hashString(`run:${scenarioId}`));

  const alignment = resolveAlignment(scenario, routes);
  const railLines: LngLat[][] = routes.features.map(
    (f) => f.geometry.coordinates
  );

  for (let i = 0; i < n; i++) {
    const p = personas[i];
    const home: LngLat = [p.lng, p.lat];
    const noise = (rng() - 0.5) * 0.12;
    let a: number;

    if (scenario.kind === "baseline") {
      // Satisfaction with the current rail network: proximity to any line,
      // valued more by transit-inclined residents.
      let dRail = Infinity;
      for (const line of railLines) {
        const d = distanceToPolylineKm(home, line);
        if (d < dRail) dRail = d;
      }
      const access = Math.exp(-dRail / 2.2);
      a = 0.3 + 0.42 * access + 0.18 * p.transitAffinity * access + noise;
      sweepKm[i] = distanceKm(home, CITY_CENTER);
    } else if (scenario.kind === "corridor" && alignment) {
      const d = distanceToPolylineKm(home, alignment);
      const proximity = Math.exp(-d / (scenario.reachKm ?? 1.5));
      const gain =
        proximity * (scenario.riderUpside ?? 0.4) * (0.35 + p.transitAffinity);
      const pain =
        proximity * (scenario.driverDownside ?? 0.2) * p.carDependence;
      // Mean-neutral citywide split: transit-inclined residents lean warm on
      // any expansion, car-dependent residents lean cool, faintly.
      const halo = 0.09 * (p.transitAffinity - p.carDependence * 0.5 - 0.25);
      a = 0.48 + gain - pain + halo + noise;
      sweepKm[i] = d;
    } else {
      // Citywide policy: parking levy. Drivers pay, riders see funded service;
      // higher-income households are less price-sensitive.
      a =
        0.52 -
        0.34 * p.carDependence +
        0.2 * p.transitAffinity +
        0.05 * p.incomeZ +
        noise;
      sweepKm[i] = distanceKm(home, CITY_CENTER);
    }

    acceptance[i] = clamp(a);
  }

  return aggregate(scenarioId, personas, acceptance, sweepKm);
}

export function aggregate(
  scenarioId: string,
  personas: Persona[],
  acceptance: Float32Array,
  sweepKm: Float32Array
): ScenarioResult {
  const byNeighbourhood = new Map<string, { mean: number; count: number }>();
  const sums = new Map<string, { sum: number; count: number }>();
  const histogram = new Array<number>(HISTOGRAM_BINS).fill(0);
  let support = 0;
  let oppose = 0;
  let total = 0;

  for (let i = 0; i < personas.length; i++) {
    const a = acceptance[i];
    const code = personas[i].code;
    const s = sums.get(code) ?? { sum: 0, count: 0 };
    s.sum += a;
    s.count++;
    sums.set(code, s);
    const bin = Math.min(HISTOGRAM_BINS - 1, Math.floor(a * HISTOGRAM_BINS));
    histogram[bin]++;
    if (a >= SUPPORT_THRESHOLD) support++;
    else if (a < OPPOSE_THRESHOLD) oppose++;
    total += a;
  }

  for (const [code, { sum, count }] of sums) {
    byNeighbourhood.set(code, { mean: sum / count, count });
  }

  const n = personas.length || 1;
  return {
    scenarioId,
    acceptance,
    sweepKm,
    byNeighbourhood,
    histogram,
    supportShare: support / n,
    opposeShare: oppose / n,
    mean: total / n,
  };
}
