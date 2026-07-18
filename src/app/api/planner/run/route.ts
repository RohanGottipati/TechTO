import { NextResponse } from "next/server";
import { z } from "zod";

import { scenarioPatchSchema } from "@/lib/planner/scenario";
import { runCityOrchestration } from "@/lib/planner/orchestrator";
import { getPopulationProviderMode } from "@/lib/population/provider";
import { PRINCIPLED_CITY_BUNDLE } from "@/lib/backboard/assistants";

export const runtime = "nodejs";

const bodySchema = z.object({
  question: z.string().min(1),
  patches: z.array(scenarioPatchSchema).optional(),
  seed: z.number().optional(),
});

/**
 * Headless / UI city planning run: live Backboard Planning Orchestrator +
 * local twin/population score.
 */
export async function POST(request: Request) {
  const json = await request.json();
  const body = bodySchema.parse(json);
  const result = await runCityOrchestration({
    question: body.question,
    patches: body.patches,
    seed: body.seed ?? 2262,
  });

  return NextResponse.json({
    schemaVersion: 1,
    backboardMode: result.adapterMode,
    populationMode: getPopulationProviderMode(),
    availableRoster: PRINCIPLED_CITY_BUNDLE,
    participatingAgents: result.participatingAgents,
    runId: result.runId,
    question: result.question,
    ranking: result.ranking,
    chosenId: result.chosenId,
    summary: result.summary,
    events: result.events,
    candidates: result.candidates.map((c) => ({
      patch: c.patch,
      twinVersion: c.twinVersion,
      score: {
        scenarioId: c.score.scenarioId,
        provider: c.score.provider,
        citywide: c.score.citywide,
        byNeighbourhood: c.score.byNeighbourhood,
      },
    })),
  });
}
