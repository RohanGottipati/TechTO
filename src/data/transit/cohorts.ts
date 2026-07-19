/**
 * Demographic cohort types for the TechTO transit domain layer (see
 * AGENTS.md section 4.3 and docs/techto-implementation.md section 9.1:
 * cohorts represent statistically similar riders, never individual
 * identified residents).
 *
 * The synthetic census-weighted fixture cohorts that used to live in this
 * file have been intentionally removed. TechTO now sources cohorts
 * exclusively from real resident-persona-aggregate data (Mongo);
 * `listCohorts()` returns an empty array so any caller lacking a live
 * repository degrades to "no cohorts" rather than silently falling back to
 * fabricated demographic data.
 */

export interface CohortSensitivity {
  waitSensitivity: number;
  crowdingSensitivity: number;
  priceSensitivity: number;
  accessibilitySensitivity: number;
}

export interface CohortModeShare {
  transit: number;
  car: number;
  walk: number;
  cycle: number;
}

export interface TransitCohortFixture {
  id: string;
  label: string;
  weight: number;
  /** Raw count of source records this cohort was aggregated from, when known (resident-persona-aggregate only). */
  personaCount?: number;
  homeZoneId: string;
  primaryDestinationZoneId: string;
  ageBand: string;
  incomeBand: "low" | "middle" | "high";
  /** Not present in resident-persona-aggregate cohorts: occupation isn't in the ingested census fields. */
  occupationGroup?: string;
  /** Not present in resident-persona-aggregate cohorts: work schedule isn't in the ingested census fields. */
  workSchedule?: "standard" | "shift" | "night" | "flexible" | "student" | "none";
  vehicleAccessProbability: number;
  transitPassProbability: number;
  /** Not present in resident-persona-aggregate cohorts: schedule flexibility isn't in the ingested census fields. */
  scheduleFlexibility?: number;
  mobilityNeeds: string[];
  sensitivity: CohortSensitivity;
  baselineModeShare: CohortModeShare;
  dataMode: "synthetic-fixture" | "resident-persona-aggregate";
}

export const TRANSIT_COHORTS: TransitCohortFixture[] = [];

export function listCohorts(): TransitCohortFixture[] {
  return TRANSIT_COHORTS;
}

export function getCohort(cohortId: string): TransitCohortFixture | undefined {
  return TRANSIT_COHORTS.find((cohort) => cohort.id === cohortId);
}

export function requireCohort(cohortId: string): TransitCohortFixture {
  const cohort = getCohort(cohortId);
  if (!cohort) {
    throw new Error(`Unknown transit cohort id: "${cohortId}"`);
  }
  return cohort;
}

export function totalCohortWeight(): number {
  return TRANSIT_COHORTS.reduce((sum, cohort) => sum + cohort.weight, 0);
}

/**
 * Cohorts most exposed to service degradation: mobility-device users,
 * low-income transit-dependent riders with no car alternative, and seniors.
 * Used by the equity-gap metric (lib/transit/metrics.ts) as the vulnerable
 * comparison group against the full population. Pure over any cohort list
 * so repository-fed (Mongo/resident-persona-aggregate) cohorts can reuse the
 * same filter as the static fixture.
 */
export function deriveVulnerableCohorts(cohorts: TransitCohortFixture[]): TransitCohortFixture[] {
  return cohorts.filter(
    (cohort) =>
      cohort.mobilityNeeds.length > 0 ||
      cohort.sensitivity.accessibilitySensitivity >= 0.7 ||
      cohort.incomeBand === "low",
  );
}

export function vulnerableCohorts(): TransitCohortFixture[] {
  return deriveVulnerableCohorts(TRANSIT_COHORTS);
}

export function accessibilitySensitiveCohorts(): TransitCohortFixture[] {
  return TRANSIT_COHORTS.filter(
    (cohort) => cohort.mobilityNeeds.length > 0 || cohort.sensitivity.accessibilitySensitivity >= 0.7,
  );
}
