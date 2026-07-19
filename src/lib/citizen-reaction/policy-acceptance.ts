import { getMongoDb } from "@/lib/mongodb/client";
import { COLLECTIONS } from "@/lib/mongodb/collections";
import { getOrGenerateOpinion } from "@/lib/citizen-reaction/opinion-cache";
import { scoreOpinionWithEmbeddingProbe } from "@/lib/citizen-reaction/embedding-probe-score";
import { runWithLimit } from "@/lib/citizen-reaction/concurrency";
import type { ScenarioPatch } from "@/lib/planner/scenario";

const SAMPLE_SIZE = Number(process.env.TECHTO_POLICY_SAMPLE_SIZE ?? 24);
const CONCURRENCY = Number(process.env.TECHTO_OPINION_CONCURRENCY ?? 8);

export interface PolicyAcceptanceResult {
  scenarioId: string;
  provider: "real-opinion-model";
  citywide: {
    mean: number;
    supportShare: number;
    opposeShare: number;
    sampleSize: number;
  };
  byNeighbourhood: Record<string, { mean: number; count: number }>;
}

interface ResidentPersonaDoc {
  persona_id: string;
  neighbourhood_code: string;
  text: string;
}

/** Same rendering convention as neighbourhood-acceptance.ts's scenarioPolicyText, for an open-city ScenarioPatch. */
export function policyTextForPatch(patch: ScenarioPatch): string {
  return `${patch.title}. ${patch.rationale}`;
}

/**
 * Real citywide acceptance for an arbitrary proposed policy: a flat,
 * city-wide Monte-Carlo sample of real residents (not filtered to one
 * neighbourhood or archetype) scored by the real trained opinion model
 * (src/lib/citizen-reaction/flash-opinion-client.ts) and the real-vote-
 * trained embedding probe. This is the same model, cache, and scorer used
 * by the map's per-neighbourhood acceptance and the transit citizen-
 * reaction pipeline -- the one source of truth for "how does Toronto feel
 * about this", not a second, disconnected formula.
 */
export async function scoreRealPolicyAcceptance(
  scenarioId: string,
  policyText: string,
  sampleSize: number = SAMPLE_SIZE,
): Promise<PolicyAcceptanceResult> {
  const db = await getMongoDb();
  const docs = (await db
    .collection(COLLECTIONS.residentPersonas)
    .aggregate([
      { $sample: { size: sampleSize } },
      { $project: { persona_id: 1, neighbourhood_code: 1, text: 1, _id: 0 } },
    ])
    .toArray()) as unknown as ResidentPersonaDoc[];

  const scored = await runWithLimit(
    docs.map((persona) => async () => {
      const opinionText = await getOrGenerateOpinion(persona.persona_id, persona.text, policyText);
      const acceptance = await scoreOpinionWithEmbeddingProbe(opinionText);
      return { code: persona.neighbourhood_code, acceptance };
    }),
    CONCURRENCY,
  );

  const n = scored.length;
  const mean = n ? scored.reduce((sum, s) => sum + s.acceptance, 0) / n : 0.5;
  const supportShare = n ? scored.filter((s) => s.acceptance >= 0.6).length / n : 0;
  const opposeShare = n ? scored.filter((s) => s.acceptance <= 0.4).length / n : 0;

  const grouped = new Map<string, number[]>();
  for (const s of scored) {
    const list = grouped.get(s.code) ?? [];
    list.push(s.acceptance);
    grouped.set(s.code, list);
  }
  const byNeighbourhood: Record<string, { mean: number; count: number }> = {};
  for (const [code, values] of grouped) {
    byNeighbourhood[code] = {
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length,
    };
  }

  return {
    scenarioId,
    provider: "real-opinion-model",
    citywide: { mean, supportShare, opposeShare, sampleSize: n },
    byNeighbourhood,
  };
}
