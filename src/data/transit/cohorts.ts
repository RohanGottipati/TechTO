/**
 * Cohort types for the TechTO transit domain layer (see AGENTS.md section
 * 4.3 and docs/techto-implementation.md section 9.1). Real cohort data
 * lives in MongoDB's `citizen_cohorts` collection, aggregated from real
 * StatCan-census-grounded `resident_personas` records by
 * `population/build_neighbourhood_cohorts.py` -- one cohort per Toronto
 * neighbourhood, `dataMode: "resident-persona-aggregate"`. There is no
 * synthetic fixture cohort data in this codebase: `listCohorts()` here
 * returns an empty array, since this module has no data of its own to
 * serve -- real callers go through `getTransitRepository()`
 * (`src/lib/transit/repository.ts`), which resolves to
 * `MongoTransitRepository` and reads the real collection.
 *
 * `weight` is a percentage of the modeled population and sums to 100
 * across all cohorts in a given source. Sensitivity fields are 0 to 1,
 * higher means more sensitive to that dimension; for the real aggregate,
 * some are direct real derivations (see the field-by-field table in
 * `population/build_neighbourhood_cohorts.py`) and some are documented
 * heuristic proxies where no real correlate exists in the ingested census
 * fields (AGENTS.md section 2).
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
  dataMode: "resident-persona-aggregate";
}

/**
 * No synthetic fixture cohorts exist. Only `MongoTransitRepository`
 * (backed by the real `citizen_cohorts` collection) serves cohort data;
 * this always returns empty.
 */
export function listCohorts(): TransitCohortFixture[] {
  return [];
}

export function getCohort(cohortId: string): TransitCohortFixture | undefined {
  return listCohorts().find((cohort) => cohort.id === cohortId);
}

export function requireCohort(cohortId: string): TransitCohortFixture {
  const cohort = getCohort(cohortId);
  if (!cohort) {
    throw new Error(`Unknown transit cohort id: "${cohortId}"`);
  }
  return cohort;
}

export function totalCohortWeight(): number {
  return listCohorts().reduce((sum, cohort) => sum + cohort.weight, 0);
}

/**
 * Cohorts most exposed to service degradation: mobility-device users,
 * low-income transit-dependent riders with no car alternative, and seniors.
 * Used by the equity-gap metric (lib/transit/metrics.ts) as the vulnerable
 * comparison group against the full population. Pure over any cohort list
 * so repository-fed (real, Mongo-backed) cohorts can reuse the same filter.
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
  return deriveVulnerableCohorts(listCohorts());
}

export function accessibilitySensitiveCohorts(): TransitCohortFixture[] {
  return listCohorts().filter(
    (cohort) => cohort.mobilityNeeds.length > 0 || cohort.sensitivity.accessibilitySensitivity >= 0.7,
  );
}
