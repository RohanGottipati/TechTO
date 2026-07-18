import { z } from "zod";

import { getBackboardAdapter } from "@/lib/backboard/adapter";
import { resolveAssistant } from "@/lib/backboard/assistant-manifest";
import type { BackboardAdapter } from "@/lib/backboard/client";
import type { CandidateOutcome, GridRunResult } from "@/lib/backboard/orchestrator";
import { runToolLoop } from "@/lib/backboard/run-tool-loop";
import { createRunContext } from "@/lib/backboard/tool-dispatcher";
import { executiveSummarySchema, type ExecutiveSummary } from "@/lib/grid/schemas";

export class ExecutiveSummaryError extends Error {}

export interface BuildExecutiveSummaryInput {
  result: GridRunResult;
  adapter?: BackboardAdapter;
}

/**
 * Only the four prose fields a model is allowed to author. The numeric
 * fields and safetyResult on ExecutiveSummary are always computed locally
 * from GridRunResult (see buildExecutiveSummary) and never requested from,
 * or overwritten by, the model.
 */
const narrativeSchema = z
  .object({
    mainRisk: z.string().min(1).max(500),
    majorAssumption: z.string().min(1).max(500),
    limitations: z.string().min(1).max(500),
    summary: z.string().min(1).max(800),
  })
  .strict();

type ExecutiveNarrative = z.output<typeof narrativeSchema>;

function findChosenCandidate(result: GridRunResult): CandidateOutcome {
  const candidate = result.candidates.find(
    (entry) => entry.candidateId === result.effectiveRecommendation.chosenCandidateId,
  );
  if (!candidate) {
    throw new ExecutiveSummaryError(
      `Chosen candidateId "${result.effectiveRecommendation.chosenCandidateId}" was not found among simulated candidates for run ${result.runId}.`,
    );
  }
  return candidate;
}

function computeSafetyResult(result: GridRunResult): ExecutiveSummary["safetyResult"] {
  if (result.recommendationOverridden) return "overridden_for_safety";
  if (result.effectiveRecommendation.recommendedAction === "hold_for_operator") return "hold_for_operator";
  return "clear";
}

/** Numbers only ever come from here: SimulationMetrics on the chosen candidate's visible simulation. */
function computeMetricFields(candidate: CandidateOutcome): Pick<
  ExecutiveSummary,
  "simulatedNetValueCad" | "renewableCapturedMwh" | "estimatedCarbonAvoidedKg" | "degradationProxyCad"
> {
  const { metrics } = candidate.simulation;
  return {
    simulatedNetValueCad: metrics.netValueCad,
    renewableCapturedMwh: metrics.renewableCapturedMwh,
    estimatedCarbonAvoidedKg: metrics.carbonAvoidedKg,
    degradationProxyCad: metrics.degradationCostCad,
  };
}

/**
 * Deterministic fallback narrative built directly from run data, no model
 * call involved. Used in mock mode and whenever a live narrative request
 * fails or comes back malformed, so buildExecutiveSummary always succeeds.
 */
function buildLocalNarrative(result: GridRunResult, candidate: CandidateOutcome): ExecutiveNarrative {
  const review = result.riskReviews.find((entry) => entry.candidateId === candidate.candidateId);
  const mainRisk = review
    ? review.concerns[0] ?? `${review.riskLevel} risk: ${review.summary}`
    : "No candidate-specific risk was flagged by the reviewer.";
  const majorAssumption =
    candidate.plan.assumptions[0] ?? "Visible market and renewable forecasts hold through the scenario horizon.";
  const limitations = result.hiddenStressDescription
    ? `Stress performance was checked against a hidden condition: ${result.hiddenStressDescription}.`
    : "This run's candidates were not checked against a hidden stress scenario.";
  const summary =
    `${result.effectiveRecommendation.headline} Candidate "${candidate.candidateId}" is projected at ` +
    `$${candidate.simulation.metrics.netValueCad.toFixed(2)} CAD net value over the scenario horizon.`;
  return { mainRisk, majorAssumption, limitations, summary };
}

function buildNarrativePrompt(result: GridRunResult, candidate: CandidateOutcome): string {
  return `
Write the plant-operator executive summary for this already-decided run.
Do not restate or invent any numbers; the dashboard renders the simulated
metrics separately from your text.

Chosen candidate: "${candidate.candidateId}" (${candidate.plan.strategy}).
Effective recommendation: ${JSON.stringify(result.effectiveRecommendation)}
Recommendation overridden for safety: ${result.recommendationOverridden}${
    result.overrideReason ? ` (${result.overrideReason})` : ""
  }
Risk & Compliance reviews: ${JSON.stringify(result.riskReviews)}
Hidden stress description: ${result.hiddenStressDescription ?? "none"}

Respond with ONLY JSON matching:
{"mainRisk": string, "majorAssumption": string, "limitations": string, "summary": string}

- mainRisk: the single most important risk an operator should know about this choice.
- majorAssumption: the one assumption this plan leans on most heavily.
- limitations: what this run's evidence does NOT tell you (e.g. untested conditions).
- summary: one or two operator-facing sentences on the outcome, in plain language.
`.trim();
}

function parseNarrative(raw: string | null): ExecutiveNarrative | null {
  if (!raw || raw.trim().length === 0) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  const parsed = narrativeSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

/**
 * Produces the ExecutiveSummary for one completed GridRunResult. In mock
 * mode (or on any failure talking to a live model) the narrative is built
 * deterministically from run data; live mode asks the Chief Dispatch
 * Officer, on its own run thread, for the four prose fields only. All
 * numbers and safetyResult are computed here, never from model output.
 */
export async function buildExecutiveSummary(input: BuildExecutiveSummaryInput): Promise<ExecutiveSummary> {
  const { result } = input;
  const adapter = input.adapter ?? getBackboardAdapter();
  const candidate = findChosenCandidate(result);

  const baseFields = {
    ...computeMetricFields(candidate),
    safetyResult: computeSafetyResult(result),
  };
  const localNarrative = buildLocalNarrative(result, candidate);

  if (adapter.mode === "mock") {
    return executiveSummarySchema.parse({ ...baseFields, ...localNarrative });
  }

  try {
    const resolved = await resolveAssistant("chief-dispatch-officer", adapter);
    const context = createRunContext(result.assetId, result.scenarioId, adapter);
    const loop = await runToolLoop({
      adapter,
      assistantId: resolved.record.assistantId,
      threadId: result.chiefThreadId,
      content: buildNarrativePrompt(result, candidate),
      systemPrompt: resolved.role.systemPrompt,
      modelName: resolved.model.modelName,
      llmProvider: resolved.model.provider,
      thinking: resolved.role.thinking,
      memory: resolved.role.memory,
      jsonOutput: true,
      context,
      maxRounds: 1,
    });
    const narrative = parseNarrative(loop.finalResult.content);
    return executiveSummarySchema.parse({ ...baseFields, ...(narrative ?? localNarrative) });
  } catch {
    return executiveSummarySchema.parse({ ...baseFields, ...localNarrative });
  }
}
