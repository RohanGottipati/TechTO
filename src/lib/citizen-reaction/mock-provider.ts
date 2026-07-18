import type { CitizenReactionProvider } from "@/lib/citizen-reaction/provider";
import {
  citizenReactionBatchInputSchema,
  type CitizenCohort,
  type CitizenReaction,
  type CitizenReactionAggregate,
  type CitizenReactionBatchInput,
  type CitizenReactionBatchResult,
  type CitizenReactionContext,
  type Intervention,
  type ProviderStatus,
} from "@/lib/citizen-reaction/schemas";

const ACCEPT_THRESHOLD = 0.6;
const REJECT_THRESHOLD = 0.4;

/** FNV-1a, 32-bit. Deterministic and dependency-free; good enough for a display seed, not cryptography. */
function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: small, fast, deterministic PRNG seeded from `hashString`. */
function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/** Symmetric jitter in [-magnitude, magnitude], deterministic from `rng`. */
function jitter(rng: () => number, magnitude: number): number {
  return (rng() * 2 - 1) * magnitude;
}

interface ContextDeltas {
  waitDeltaMinutes: number;
  crowdingDelta: number;
  transferDelta: number;
  priceDeltaCad: number;
  accessibilityDelta: number;
  hasEvent: boolean;
  eventKind: string | null;
  eventDescription: string | null;
}

/** Normalizes the before/after effect-graph features into signed deltas: positive always means "worse for the rider" except accessibility, where positive means "better". */
function computeContextDeltas(context: CitizenReactionContext): ContextDeltas {
  return {
    waitDeltaMinutes: context.wait ? context.wait.afterMinutes - context.wait.beforeMinutes : 0,
    crowdingDelta: context.crowding ? context.crowding.afterIndex - context.crowding.beforeIndex : 0,
    transferDelta: context.transfer ? context.transfer.afterCount - context.transfer.beforeCount : 0,
    priceDeltaCad: context.price ? context.price.afterCad - context.price.beforeCad : 0,
    accessibilityDelta: context.accessibility
      ? context.accessibility.afterScore - context.accessibility.beforeScore
      : 0,
    hasEvent: Boolean(context.event),
    eventKind: context.event?.kind ?? null,
    eventDescription: context.event?.description ?? null,
  };
}

interface CohortSensitivity {
  waitWeight: number;
  crowdingWeight: number;
  transferWeight: number;
  priceWeight: number;
  accessibilityWeight: number;
  eventWeight: number;
}

/**
 * Cohort-demographic sensitivity weights. These are hand-picked heuristic
 * priors for the mock provider only (AGENTS.md 2: this is not a validated
 * behavioral model); a real provider replaces this entirely with learned
 * persona conditioning (AGENTS.md 4.3, 5.1-5.2).
 */
function resolveCohortSensitivity(cohort: CitizenCohort): CohortSensitivity {
  const demographics = cohort.demographics ?? {};
  const sensitivity: CohortSensitivity = {
    waitWeight: 1,
    crowdingWeight: 1,
    transferWeight: 1,
    priceWeight: 1,
    accessibilityWeight: 1,
    eventWeight: 1,
  };

  if (demographics.primaryMode === "transit") {
    sensitivity.waitWeight *= 1.6;
    sensitivity.crowdingWeight *= 1.6;
    sensitivity.transferWeight *= 1.4;
    sensitivity.priceWeight *= 1.2;
  } else if (demographics.primaryMode === "car") {
    sensitivity.priceWeight *= 1.5;
    sensitivity.waitWeight *= 0.4;
    sensitivity.crowdingWeight *= 0.4;
    sensitivity.transferWeight *= 0.4;
  } else if (demographics.primaryMode === "walk" || demographics.primaryMode === "bike") {
    sensitivity.accessibilityWeight *= 1.3;
    sensitivity.priceWeight *= 0.7;
  }

  if (demographics.incomeBand === "low") {
    sensitivity.priceWeight *= 1.6;
  } else if (demographics.incomeBand === "high") {
    sensitivity.priceWeight *= 0.6;
  }

  if (demographics.hasDisability) {
    sensitivity.accessibilityWeight *= 1.8;
    sensitivity.crowdingWeight *= 1.3;
    sensitivity.transferWeight *= 1.3;
  }

  if (demographics.ageBand === "senior") {
    sensitivity.accessibilityWeight *= 1.4;
    sensitivity.waitWeight *= 1.2;
    sensitivity.transferWeight *= 1.2;
  } else if (demographics.ageBand === "youth") {
    sensitivity.priceWeight *= 1.2;
  }

  return sensitivity;
}

interface CohortPressure {
  netPressure: number;
  waitTerm: number;
  crowdingTerm: number;
  transferTerm: number;
  priceTerm: number;
  accessibilityTerm: number;
  eventTerm: number;
}

/**
 * Combines context deltas with cohort sensitivity into a single signed
 * "pressure" score: negative pushes the cohort toward opposing the
 * intervention, positive pushes toward welcoming it. Scale factors are
 * chosen so a "typical" disruption (a few minutes of wait, one crowding
 * step) lands in a range a sigmoid can meaningfully separate.
 */
function computeCohortPressure(deltas: ContextDeltas, sensitivity: CohortSensitivity): CohortPressure {
  const waitTerm = -sensitivity.waitWeight * (deltas.waitDeltaMinutes / 5);
  const crowdingTerm = -sensitivity.crowdingWeight * (deltas.crowdingDelta * 2);
  const transferTerm = -sensitivity.transferWeight * (deltas.transferDelta * 0.6);
  const priceTerm = -sensitivity.priceWeight * (deltas.priceDeltaCad / 10);
  const accessibilityTerm = sensitivity.accessibilityWeight * (deltas.accessibilityDelta * 2);
  const eventTerm = deltas.hasEvent ? -sensitivity.eventWeight * 0.5 : 0;

  return {
    netPressure: waitTerm + crowdingTerm + transferTerm + priceTerm + accessibilityTerm + eventTerm,
    waitTerm,
    crowdingTerm,
    transferTerm,
    priceTerm,
    accessibilityTerm,
    eventTerm,
  };
}

function describeMagnitude(term: number): "sharply" | "somewhat" | "slightly" {
  const magnitude = Math.abs(term);
  if (magnitude >= 1) return "sharply";
  if (magnitude >= 0.35) return "somewhat";
  return "slightly";
}

/**
 * Builds a legible, cohort-specific explanation. Per AGENTS.md 3.1/3.3, this
 * text is written first and `acceptance` (computed alongside it in
 * `buildReaction`, from the same `pressure` value) is a readout of it, not an
 * independent number: every driver named here is exactly what fed the score.
 */
function buildRationale(params: {
  cohort: CitizenCohort;
  intervention: Intervention;
  deltas: ContextDeltas;
  pressure: CohortPressure;
  acceptance: number;
}): string {
  const { cohort, intervention, deltas, pressure, acceptance } = params;
  const cohortLabel = cohort.label ?? cohort.cohortId;
  const drivers: string[] = [];

  if (Math.abs(pressure.waitTerm) >= 0.15 && deltas.waitDeltaMinutes !== 0) {
    const direction = deltas.waitDeltaMinutes > 0 ? "longer" : "shorter";
    drivers.push(
      `wait times ${describeMagnitude(pressure.waitTerm)} ${direction} (${deltas.waitDeltaMinutes > 0 ? "+" : ""}${deltas.waitDeltaMinutes.toFixed(1)} min)`,
    );
  }
  if (Math.abs(pressure.crowdingTerm) >= 0.15 && deltas.crowdingDelta !== 0) {
    const direction = deltas.crowdingDelta > 0 ? "more crowded" : "less crowded";
    drivers.push(`vehicles ${describeMagnitude(pressure.crowdingTerm)} ${direction}`);
  }
  if (Math.abs(pressure.transferTerm) >= 0.15 && deltas.transferDelta !== 0) {
    const direction = deltas.transferDelta > 0 ? "more transfers" : "fewer transfers";
    drivers.push(`${direction} on their trip`);
  }
  if (Math.abs(pressure.priceTerm) >= 0.15 && deltas.priceDeltaCad !== 0) {
    const direction = deltas.priceDeltaCad > 0 ? "costs more" : "costs less";
    drivers.push(`the trip ${direction} (${deltas.priceDeltaCad > 0 ? "+" : ""}$${deltas.priceDeltaCad.toFixed(2)})`);
  }
  if (Math.abs(pressure.accessibilityTerm) >= 0.15 && deltas.accessibilityDelta !== 0) {
    const direction = deltas.accessibilityDelta > 0 ? "more accessible" : "less accessible";
    drivers.push(`the route becomes ${direction} for them`);
  }
  if (deltas.hasEvent && deltas.eventDescription) {
    drivers.push(`a disruption during the change ("${deltas.eventDescription}")`);
  }

  const driverText =
    drivers.length > 0
      ? `Mainly because ${drivers.join("; ")}.`
      : "The change barely touches anything this cohort's daily trip depends on, so their reaction stays close to neutral.";

  const stance = acceptance >= ACCEPT_THRESHOLD ? "welcomes" : acceptance <= REJECT_THRESHOLD ? "opposes" : "is mixed on";

  return `${cohortLabel} ${stance} "${intervention.title}". ${driverText}`;
}

function computePreferredDepartureShiftMinutes(deltas: ContextDeltas, sensitivity: CohortSensitivity, rng: () => number): number {
  const shift =
    0.5 * deltas.waitDeltaMinutes * sensitivity.waitWeight +
    5 * deltas.crowdingDelta * sensitivity.crowdingWeight -
    2 * deltas.transferDelta * sensitivity.transferWeight +
    (deltas.hasEvent ? 4 * sensitivity.eventWeight : 0);
  return Math.round(clamp(shift + jitter(rng, 2), -60, 60));
}

function computeModeShiftProb(pressure: CohortPressure, rng: () => number): number {
  const magnitude = Math.abs(pressure.netPressure);
  const base = 0.08 + 0.45 * Math.tanh(magnitude / 1.5);
  return clamp(base + jitter(rng, 0.05), 0, 1);
}

function computeConfidence(pressure: CohortPressure, rng: () => number): number {
  const magnitude = Math.abs(pressure.netPressure);
  const base = 0.45 + 0.45 * Math.tanh(magnitude);
  return clamp(base + jitter(rng, 0.04), 0.05, 0.99);
}

function buildReaction(params: {
  scenarioId: string;
  intervention: Intervention;
  cohort: CitizenCohort;
  deltas: ContextDeltas;
}): CitizenReaction {
  const { scenarioId, intervention, cohort, deltas } = params;
  const seedKey = `${scenarioId}::${intervention.id ?? intervention.title}::${cohort.cohortId}`;
  const rng = createSeededRandom(hashString(seedKey));

  const sensitivity = resolveCohortSensitivity(cohort);
  const pressure = computeCohortPressure(deltas, sensitivity);

  // Center slightly above neutral (status-quo bias offset) rather than at
  // exactly 0.5, then let context pressure and cohort-seeded noise move it.
  const acceptance = clamp(sigmoid(0.15 + pressure.netPressure + jitter(rng, 0.35)), 0, 1);

  return {
    cohortId: cohort.cohortId,
    acceptance,
    modeShiftProb: computeModeShiftProb(pressure, rng),
    preferredDepartureShiftMinutes: computePreferredDepartureShiftMinutes(deltas, sensitivity, rng),
    rationale: buildRationale({ cohort, intervention, deltas, pressure, acceptance }),
    confidence: computeConfidence(pressure, rng),
  };
}

function computeAggregate(reactions: CitizenReaction[], cohorts: CitizenCohort[]): CitizenReactionAggregate {
  const weightByCohortId = new Map(cohorts.map((cohort) => [cohort.cohortId, cohort.populationWeight]));

  const acceptances = reactions.map((reaction) => reaction.acceptance);
  const n = acceptances.length;
  const meanAcceptance = acceptances.reduce((sum, value) => sum + value, 0) / n;

  const sorted = [...acceptances].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianAcceptance = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const variance = acceptances.reduce((sum, value) => sum + (value - meanAcceptance) ** 2, 0) / n;
  const stdDevAcceptance = Math.sqrt(variance);

  let weightedSum = 0;
  let totalWeight = 0;
  for (const reaction of reactions) {
    const weight = weightByCohortId.get(reaction.cohortId) ?? 1;
    weightedSum += reaction.acceptance * weight;
    totalWeight += weight;
  }
  const populationWeightedAcceptance = totalWeight > 0 ? weightedSum / totalWeight : meanAcceptance;

  const meanModeShiftProb = reactions.reduce((sum, reaction) => sum + reaction.modeShiftProb, 0) / n;
  const meanPreferredDepartureShiftMinutes =
    reactions.reduce((sum, reaction) => sum + reaction.preferredDepartureShiftMinutes, 0) / n;

  let acceptCount = 0;
  let rejectCount = 0;
  let neutralCount = 0;
  for (const reaction of reactions) {
    if (reaction.acceptance >= ACCEPT_THRESHOLD) acceptCount += 1;
    else if (reaction.acceptance <= REJECT_THRESHOLD) rejectCount += 1;
    else neutralCount += 1;
  }

  return {
    cohortCount: n,
    meanAcceptance,
    medianAcceptance,
    stdDevAcceptance,
    populationWeightedAcceptance,
    meanModeShiftProb,
    meanPreferredDepartureShiftMinutes,
    acceptCount,
    neutralCount,
    rejectCount,
  };
}

/**
 * Deterministic, dependency-free stand-in for the real population simulator
 * (AGENTS.md 4.3, 5). It reacts sensibly to each effect-graph feature (wait,
 * crowding, transfers, price, accessibility, disruption events) using
 * hand-picked demographic sensitivity weights, and every reaction is
 * reproducible: the seed is a hash of scenarioId + intervention + cohortId,
 * so re-running the same batch always returns the same numbers.
 *
 * This is NOT a trained model and carries no claim to reflect real Toronto
 * public opinion (AGENTS.md 2); `getStatus().label` says so explicitly, and
 * callers must surface that label rather than presenting mock output as a
 * calibrated prediction.
 */
export class MockCitizenReactionProvider implements CitizenReactionProvider {
  async predictBatch(input: CitizenReactionBatchInput): Promise<CitizenReactionBatchResult> {
    const parsed = citizenReactionBatchInputSchema.parse(input);
    const deltas = computeContextDeltas(parsed.context);

    const reactions = parsed.cohorts.map((cohort) =>
      buildReaction({ scenarioId: parsed.scenarioId, intervention: parsed.intervention, cohort, deltas }),
    );

    return {
      provider: "mock",
      scenarioId: parsed.scenarioId,
      generatedAt: new Date().toISOString(),
      reactions,
      aggregate: computeAggregate(reactions, parsed.cohorts),
    };
  }

  async getStatus(): Promise<ProviderStatus> {
    return {
      provider: "mock",
      mode: "mock",
      label:
        "Mock synthetic citizen-reaction model: deterministic heuristics over persona demographics and effect " +
        "features. Not real Toronto public opinion data and not a trained population simulator.",
      ready: true,
    };
  }
}
