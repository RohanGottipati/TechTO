import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  distanceToPolylineKm,
  geometryBbox,
  pointInGeometry,
  type LngLat,
  type PolygonGeometry,
} from "@/lib/geo";
import type {
  NeighbourhoodCollection,
  RouteFeature,
} from "@/lib/sim/types";

export type TorontoAreaSortField =
  | "name"
  | "population"
  | "medianIncome"
  | "populationDensity"
  | "rapidTransitGapKm"
  | "surfaceTransitDistanceKm"
  | "fallbackScore";

export interface TorontoAreaEvidence {
  code: string;
  name: string;
  center: LngLat;
  bounds: [number, number, number, number];
  population: number;
  medianIncome: number | null;
  areaKm2: number;
  populationDensity: number;
  rapidTransitGapKm: number;
  surfaceTransitDistanceKm: number;
  fallbackScore: number;
  provenance: string[];
}

export interface TorontoAreaQuery {
  name?: string;
  minPopulation?: number;
  maxMedianIncome?: number;
  minRapidTransitGapKm?: number;
  sortBy?: TorontoAreaSortField;
  direction?: "asc" | "desc";
  limit?: number;
}

interface RawRouteCollection {
  type: "FeatureCollection";
  features: Array<
    RouteFeature | {
      type: "Feature";
      properties: RouteFeature["properties"];
      geometry: { type: "MultiLineString"; coordinates: LngLat[][] };
    }
  >;
}

const PROVENANCE = [
  "City of Toronto neighbourhood boundaries",
  "2021 Census neighbourhood population and median household income",
  "TTC GTFS route geometry",
];

let cachedCatalog: TorontoAreaEvidence[] | null = null;

function readPublicJson<T>(filename: string): T {
  const path = join(process.cwd(), "public", "data", filename);
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function signedRingAreaKm2(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  const latScale = 110.574;
  const lonScale = 111.32 * Math.cos((43.7 * Math.PI) / 180);
  let twiceArea = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [lngA, latA] = ring[index];
    const [lngB, latB] = ring[(index + 1) % ring.length];
    twiceArea += lngA * lonScale * latB * latScale - lngB * lonScale * latA * latScale;
  }
  return twiceArea / 2;
}

function polygonAreaKm2(polygon: LngLat[][]): number {
  if (polygon.length === 0) return 0;
  const outer = Math.abs(signedRingAreaKm2(polygon[0]));
  const holes = polygon.slice(1).reduce((sum, ring) => sum + Math.abs(signedRingAreaKm2(ring)), 0);
  return Math.max(0, outer - holes);
}

function geometryAreaKm2(geometry: PolygonGeometry): number {
  if (geometry.type === "Polygon") return polygonAreaKm2(geometry.coordinates);
  return geometry.coordinates.reduce((sum, polygon) => sum + polygonAreaKm2(polygon), 0);
}

function ringCentroid(ring: LngLat[]): LngLat | null {
  if (ring.length < 3) return null;
  let twiceArea = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[(index + 1) % ring.length];
    const cross = x1 * y2 - x2 * y1;
    twiceArea += cross;
    x += (x1 + x2) * cross;
    y += (y1 + y2) * cross;
  }
  if (Math.abs(twiceArea) < Number.EPSILON) return null;
  return [x / (3 * twiceArea), y / (3 * twiceArea)];
}

function representativePoint(geometry: PolygonGeometry): LngLat {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const largest = [...polygons].sort((a, b) => polygonAreaKm2(b) - polygonAreaKm2(a))[0];
  const centroid = largest?.[0] ? ringCentroid(largest[0]) : null;
  if (centroid && pointInGeometry(centroid, geometry)) return centroid;
  const [west, south, east, north] = geometryBbox(geometry);
  const boxCenter: LngLat = [(west + east) / 2, (south + north) / 2];
  if (pointInGeometry(boxCenter, geometry)) return boxCenter;
  return largest?.[0]?.[0] ?? boxCenter;
}

function routeLines(collection: RawRouteCollection, modes?: Set<string>): LngLat[][] {
  const lines: LngLat[][] = [];
  for (const feature of collection.features) {
    if (modes && !modes.has(feature.properties.mode)) continue;
    if (feature.geometry.type === "LineString") lines.push(feature.geometry.coordinates);
    else lines.push(...feature.geometry.coordinates);
  }
  return lines;
}

function nearestLineDistance(point: LngLat, lines: LngLat[][]): number {
  let best = Infinity;
  for (const line of lines) best = Math.min(best, distanceToPolylineKm(point, line));
  return Number.isFinite(best) ? best : 0;
}

function percentileRanks(values: number[], higherIsBetter: boolean): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const denominator = Math.max(1, sorted.length - 1);
  return values.map((value) => {
    const index = sorted.findIndex((entry) => entry >= value);
    const percentile = (index < 0 ? sorted.length - 1 : index) / denominator;
    return higherIsBetter ? percentile : 1 - percentile;
  });
}

function buildCatalog(): TorontoAreaEvidence[] {
  const neighbourhoods = readPublicJson<NeighbourhoodCollection>("neighbourhoods.geojson");
  const rail = readPublicJson<RawRouteCollection>("ttc-routes.geojson");
  const buses = readPublicJson<RawRouteCollection>("ttc-bus-routes.geojson");
  const rapidLines = routeLines(rail, new Set(["subway", "lrt"]));
  const surfaceLines = [
    ...routeLines(rail, new Set(["streetcar"])),
    ...routeLines(buses),
  ];

  const base = neighbourhoods.features.map((feature) => {
    const areaKm2 = Math.max(0.01, geometryAreaKm2(feature.geometry));
    const center = representativePoint(feature.geometry);
    return {
      code: feature.properties.code,
      name: feature.properties.name,
      center,
      bounds: geometryBbox(feature.geometry),
      population: feature.properties.population,
      medianIncome: feature.properties.income,
      areaKm2,
      populationDensity: feature.properties.population / areaKm2,
      rapidTransitGapKm: nearestLineDistance(center, rapidLines),
      surfaceTransitDistanceKm: nearestLineDistance(center, surfaceLines),
    };
  });

  const gapRanks = percentileRanks(base.map((area) => area.rapidTransitGapKm), true);
  const densityRanks = percentileRanks(base.map((area) => area.populationDensity), true);
  const connectionRanks = percentileRanks(base.map((area) => area.surfaceTransitDistanceKm), false);
  const knownIncomes = base.map((area) => area.medianIncome).filter((value): value is number => value !== null);
  const medianKnownIncome = [...knownIncomes].sort((a, b) => a - b)[Math.floor(knownIncomes.length / 2)] ?? 0;
  const equityRanks = percentileRanks(
    base.map((area) => area.medianIncome ?? medianKnownIncome),
    false,
  );

  return base.map((area, index) => ({
    ...area,
    fallbackScore: Number(
      (
        0.4 * gapRanks[index] +
        0.3 * densityRanks[index] +
        0.2 * connectionRanks[index] +
        0.1 * equityRanks[index]
      ).toFixed(4),
    ),
    provenance: [...PROVENANCE],
  }));
}

export function getTorontoAreaCatalog(): TorontoAreaEvidence[] {
  cachedCatalog ??= buildCatalog();
  return cachedCatalog;
}

export function getTorontoAreaByCode(code: string): TorontoAreaEvidence | null {
  return getTorontoAreaCatalog().find((area) => area.code === code) ?? null;
}

export function queryTorontoAreas(query: TorontoAreaQuery = {}): TorontoAreaEvidence[] {
  const name = query.name?.trim().toLowerCase();
  const sortBy = query.sortBy ?? "fallbackScore";
  const direction = query.direction ?? (sortBy === "name" || sortBy === "surfaceTransitDistanceKm" ? "asc" : "desc");
  const limit = Math.max(1, Math.min(query.limit ?? 10, 25));
  const results = getTorontoAreaCatalog().filter((area) => {
    if (name && !area.name.toLowerCase().includes(name) && area.code !== name) return false;
    if (query.minPopulation !== undefined && area.population < query.minPopulation) return false;
    if (query.maxMedianIncome !== undefined && (area.medianIncome ?? Infinity) > query.maxMedianIncome) return false;
    if (query.minRapidTransitGapKm !== undefined && area.rapidTransitGapKm < query.minRapidTransitGapKm) return false;
    return true;
  });
  results.sort((a, b) => {
    const left = a[sortBy];
    const right = b[sortBy];
    if (typeof left === "string" && typeof right === "string") return left.localeCompare(right);
    const comparison = Number(left) - Number(right);
    return direction === "asc" ? comparison : -comparison;
  });
  return results.slice(0, limit);
}

export function recommendTorontoArea(): TorontoAreaEvidence {
  const winner = queryTorontoAreas({ sortBy: "fallbackScore", direction: "desc", limit: 1 })[0];
  if (!winner) throw new Error("Toronto neighbourhood catalogue is empty.");
  return winner;
}

export function formatTorontoAreaScreeningAnswer(area: TorontoAreaEvidence): string {
  const income =
    area.medianIncome === null
      ? "Not available in the matched Census record"
      : `$${Math.round(area.medianIncome).toLocaleString()}`;

  return [
    "## Recommendation",
    `**${area.name}**`,
    `${area.name} is the strongest preliminary fit in this Toronto-wide screen for a new rapid-transit connection. This is a screening recommendation, not a final station-siting decision or ridership forecast.`,
    "",
    "## Why this area",
    `• High-density catchment: ${Math.round(area.populationDensity).toLocaleString()} residents per km².`,
    `• Rapid-transit access gap: the representative point is ${area.rapidTransitGapKm.toFixed(1)} km from subway or LRT service.`,
    `• Surface-transit connection: the representative point is ${area.surfaceTransitDistanceKm.toFixed(1)} km from a bus or streetcar route.`,
    `• Equity screening signal: median household income is ${income}; this is one input to the screen, not a finding about community need.`,
    "",
    "## Sustainability potential",
    "• Closing the rapid-transit access gap could support lower car dependence if demand and network modelling confirm a useful connection.",
    "• Nearby surface transit could support first-and-last-mile transfers if routes, stop access, and service levels align.",
    "• A dense catchment could place more residents within walking or cycling reach of rapid transit.",
    "• No emissions, mode-shift, or congestion reduction is claimed until lifecycle and transport modelling is complete.",
    "",
    "## Screening metrics",
    `• Population: ${area.population.toLocaleString()}`,
    `• Area: ${area.areaKm2.toFixed(1)} km²`,
    `• Population density: ${Math.round(area.populationDensity).toLocaleString()} residents per km²`,
    `• Subway/LRT distance: ${area.rapidTransitGapKm.toFixed(1)} km from the representative point`,
    `• Bus/streetcar distance: ${area.surfaceTransitDistanceKm.toFixed(1)} km from the representative point`,
    `• Median household income: ${income}`,
    `• Composite screening score: ${(area.fallbackScore * 100).toFixed(0)}/100`,
    "",
    "## ROI and value case",
    "• Costs to quantify: capital, operating, maintenance, renewal, financing, and construction disruption.",
    "• Benefits to test: validated accessibility, travel-time, reliability, safety, avoided-cost, and other monetizable effects.",
    "• ROI formula: (validated monetized benefits - lifecycle costs) / lifecycle costs.",
    "• Report NPV, benefit-cost ratio, payback period, discount rate, analysis horizon, and sensitivity range when the evidence supports them.",
    "• No ROI value is claimed until demand, lifecycle cost, and monetized benefit assumptions are validated.",
    "",
    "## Success KPIs to validate",
    "• Demand: forecast weekday boardings, peak entries, and transfers by mode.",
    "• Access: change in residents and jobs within an accessible 10-minute station catchment.",
    "• Service: passenger travel-time change, transfer time, crowding, and reliability.",
    "• Equity: accessibility change by income, age, disability, and other affected cohorts.",
    "• Sustainability: lifecycle tCO₂e, projected mode shift, and operational emissions change.",
    "• Delivery: capital cost, operating cost, construction risk, and cost per added rider.",
    "These are proposed evaluation KPIs, not measured outcomes or promises.",
    "",
    "## What to validate next",
    "• Origin-destination demand and ridership modelling",
    "• Station geometry, constructability, utilities, and network integration",
    "• Accessible walking and cycling catchments, including physical barriers",
    "• Community consultation and a distribution of acceptance",
    "• Lifecycle carbon, operating cost, and alternatives comparison",
  ].join("\n");
}

export function mapActionsForTorontoArea(area: TorontoAreaEvidence): unknown[] {
  return [
    {
      type: "fit_bounds",
      bounds: area.bounds,
      padding: 80,
      durationMs: 1200,
    },
    {
      type: "highlight_neighbourhoods",
      neighbourhoodIds: [area.code],
    },
  ];
}
