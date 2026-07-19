import type { LngLat } from "@/lib/geo";

export type ScenarioKind = "baseline" | "corridor" | "policy";

export interface Scenario {
  id: string;
  name: string;
  kind: ScenarioKind;
  /** One-line planner-facing description of the intervention. */
  summary: string;
  /** Accent used for the proposed-alignment line on the map. */
  accent: string;
  /**
   * Proposed alignment. Either explicit coordinates or a reference to a real
   * TTC route from the GTFS overlay (resolved at run time).
   */
  alignment?: LngLat[];
  routeRef?: string;
  /** How far (km) the direct effect of a corridor reaches before decaying. */
  reachKm?: number;
  /** Upside for transit-inclined residents near the corridor, [0, 1]. */
  riderUpside?: number;
  /** Cost imposed on car-dependent residents near the corridor, [0, 1]. */
  driverDownside?: number;
}

/**
 * Demo scenario set for the synthetic preview engine. Alignments follow real
 * proposals: the Waterfront East LRT (Queens Quay East to the Distillery) and
 * the Scarborough Subway Extension (Kennedy to Sheppard/McCowan via McCowan).
 */
export const SCENARIOS: Scenario[] = [
  {
    id: "baseline",
    name: "Baseline · current scenario",
    kind: "baseline",
    summary:
      "No intervention. Dots read as satisfaction with today's rail access.",
    accent: "#8a8f8a",
  },
  {
    id: "waterfront-lrt",
    name: "Waterfront East LRT",
    kind: "corridor",
    summary:
      "Extend the Harbourfront line along Queens Quay East to the Distillery.",
    accent: "#5aa7e8",
    alignment: [
      [-79.3805, 43.6399],
      [-79.377, 43.6404],
      [-79.3735, 43.6417],
      [-79.37, 43.6432],
      [-79.366, 43.6446],
      [-79.362, 43.6459],
      [-79.3577, 43.6472],
      [-79.3555, 43.65],
      [-79.3585, 43.6519],
    ],
    reachKm: 1.4,
    riderUpside: 0.5,
    driverDownside: 0.18,
  },
  {
    id: "king-priority",
    name: "King St full transit priority",
    kind: "corridor",
    summary:
      "Ban through car traffic on King; 504 streetcar gets the street.",
    accent: "#e8a13c",
    routeRef: "504",
    reachKm: 1.1,
    riderUpside: 0.42,
    driverDownside: 0.52,
  },
  {
    id: "line2-east",
    name: "Line 2 Scarborough extension",
    kind: "corridor",
    summary:
      "Extend the Bloor-Danforth subway from Kennedy to Sheppard & McCowan.",
    accent: "#7dd069",
    alignment: [
      [-79.2637, 43.7325],
      [-79.256, 43.742],
      [-79.2477, 43.753],
      [-79.25, 43.765],
      [-79.2515, 43.7757],
      [-79.2513, 43.794],
    ],
    reachKm: 2.6,
    riderUpside: 0.55,
    driverDownside: 0.12,
  },
  {
    id: "parking-levy",
    name: "Citywide parking levy +5%",
    kind: "policy",
    summary:
      "Commercial parking levy across the city, revenue earmarked for transit.",
    accent: "#c479d8",
  },
];

export function getScenario(id: string): Scenario {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scenario: ${id}`);
  return s;
}
