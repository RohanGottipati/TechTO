import { z } from "zod";

/**
 * Contracts for the population-simulator boundary described in AGENTS.md
 * section 4.3: a planner intervention plus per-cohort effect-graph features
 * go in, a per-cohort acceptance reading plus a legible rationale comes out.
 * `CitizenReaction.acceptance` is a readout of `rationale`, never the other
 * way around (AGENTS.md 3.1); any provider implementation must derive the
 * score from the same reasoning it writes down, not compute it independently.
 */

export const citizenCohortDemographicsSchema = z
  .object({
    ageBand: z.enum(["youth", "adult", "senior"]).optional(),
    incomeBand: z.enum(["low", "middle", "high"]).optional(),
    householdType: z.string().min(1).max(80).optional(),
    primaryMode: z.enum(["transit", "car", "walk", "bike", "other"]).optional(),
    hasDisability: z.boolean().optional(),
  })
  .strict();

export type CitizenCohortDemographics = z.output<typeof citizenCohortDemographicsSchema>;

export const citizenCohortSchema = z
  .object({
    cohortId: z.string().min(1).max(80),
    label: z.string().min(1).max(160).optional(),
    /** Census-derived population weight this cohort represents; used only for aggregation, never per-reaction. */
    populationWeight: z.number().finite().positive().max(10_000_000).default(1),
    homeNeighborhood: z.string().min(1).max(160).optional(),
    demographics: citizenCohortDemographicsSchema.optional(),
  })
  .strict();

export type CitizenCohort = z.output<typeof citizenCohortSchema>;

export const interventionSchema = z
  .object({
    id: z.string().min(1).max(80).optional(),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    category: z.enum(["transit", "road", "zoning", "tax", "parks", "housing", "other"]).default("other"),
  })
  .strict();

export type Intervention = z.output<typeof interventionSchema>;

/**
 * Before/after effect-graph features (AGENTS.md 4.4): the exact, deterministic
 * outputs of the twin diff, not a model's guess. Each block is optional
 * because not every intervention touches every dimension (a tax change may
 * leave wait times untouched, for example).
 */
export const citizenReactionContextSchema = z
  .object({
    wait: z
      .object({
        beforeMinutes: z.number().finite().nonnegative(),
        afterMinutes: z.number().finite().nonnegative(),
      })
      .strict()
      .optional(),
    crowding: z
      .object({
        beforeIndex: z.number().finite().min(0).max(1),
        afterIndex: z.number().finite().min(0).max(1),
      })
      .strict()
      .optional(),
    transfer: z
      .object({
        beforeCount: z.number().int().nonnegative(),
        afterCount: z.number().int().nonnegative(),
      })
      .strict()
      .optional(),
    price: z
      .object({
        beforeCad: z.number().finite().nonnegative(),
        afterCad: z.number().finite().nonnegative(),
      })
      .strict()
      .optional(),
    accessibility: z
      .object({
        beforeScore: z.number().finite().min(0).max(1),
        afterScore: z.number().finite().min(0).max(1),
      })
      .strict()
      .optional(),
    event: z
      .object({
        kind: z.enum(["construction", "closure", "service_change", "fare_change", "other"]).default("other"),
        description: z.string().min(1).max(500),
      })
      .strict()
      .optional(),
  })
  .strict();

export type CitizenReactionContext = z.output<typeof citizenReactionContextSchema>;

export const citizenReactionBatchInputSchema = z
  .object({
    scenarioId: z.string().min(1).max(80),
    intervention: interventionSchema,
    cohorts: z.array(citizenCohortSchema).min(1).max(500),
    context: citizenReactionContextSchema,
  })
  .strict();

export type CitizenReactionBatchInput = z.output<typeof citizenReactionBatchInputSchema>;

/**
 * One cohort's reading. `rationale` is the mediator (AGENTS.md 3.1): a real
 * provider must write this first and derive `acceptance` from it, so the
 * number is always explainable by the text sitting next to it.
 */
export const citizenReactionSchema = z
  .object({
    cohortId: z.string().min(1).max(80),
    acceptance: z.number().finite().min(0).max(1),
    modeShiftProb: z.number().finite().min(0).max(1),
    preferredDepartureShiftMinutes: z.number().finite(),
    rationale: z.string().min(1).max(1000),
    confidence: z.number().finite().min(0).max(1),
  })
  .strict();

export type CitizenReaction = z.output<typeof citizenReactionSchema>;

export const citizenReactionAggregateSchema = z
  .object({
    cohortCount: z.number().int().nonnegative(),
    meanAcceptance: z.number().finite().min(0).max(1),
    medianAcceptance: z.number().finite().min(0).max(1),
    stdDevAcceptance: z.number().finite().min(0),
    /** Population-weighted mean acceptance; the census-weighted citywide number (AGENTS.md 4.3), not a plain average. */
    populationWeightedAcceptance: z.number().finite().min(0).max(1),
    meanModeShiftProb: z.number().finite().min(0).max(1),
    meanPreferredDepartureShiftMinutes: z.number().finite(),
    acceptCount: z.number().int().nonnegative(),
    neutralCount: z.number().int().nonnegative(),
    rejectCount: z.number().int().nonnegative(),
  })
  .strict();

export type CitizenReactionAggregate = z.output<typeof citizenReactionAggregateSchema>;

export const citizenReactionBatchResultSchema = z
  .object({
    provider: z.enum(["mock", "live"]),
    scenarioId: z.string().min(1).max(80),
    generatedAt: z.string().min(1),
    reactions: z.array(citizenReactionSchema).min(1),
    aggregate: citizenReactionAggregateSchema,
  })
  .strict();

export type CitizenReactionBatchResult = z.output<typeof citizenReactionBatchResultSchema>;

/**
 * Surfaced in UI so a planner always knows whether a run used the mock
 * heuristic provider or a live population simulator (AGENTS.md 2: never let
 * a synthetic reading be mistaken for real public opinion).
 */
export const providerStatusSchema = z
  .object({
    provider: z.string().min(1).max(80),
    mode: z.enum(["mock", "live"]),
    label: z.string().min(1).max(300),
    ready: z.boolean(),
  })
  .strict();

export type ProviderStatus = z.output<typeof providerStatusSchema>;
