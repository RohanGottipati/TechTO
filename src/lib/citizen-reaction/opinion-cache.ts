import { createHash } from "node:crypto";

import { getMongoDb } from "@/lib/mongodb/client";
import { COLLECTIONS } from "@/lib/mongodb/collections";
import { generateOpinion } from "@/lib/citizen-reaction/flash-opinion-client";

/**
 * Get-or-generate cache for real per-persona opinion generations, keyed by
 * (personaId, policyHash, model). Repeated evaluations of the same rendered
 * policy text against the same model checkpoint (e.g. re-running the same
 * scenario) reuse a persona's prior real generation instead of re-calling
 * the live model. Model is part of the key so switching checkpoints (e.g.
 * flash-1784401342-0d51be72/step-1850 vs a later step) never silently
 * serves an older checkpoint's cached opinion.
 */

interface OpinionCacheDoc {
  personaId: string;
  policyHash: string;
  model: string;
  opinionText: string;
  generatedAt: string;
}

function currentModelAlias(): string {
  return process.env.TECHTO_OPINION_MODEL_ALIAS?.trim() || "flash-1784401342-0d51be72";
}

let indexEnsured = false;

async function ensureIndex(): Promise<void> {
  if (indexEnsured) return;
  const db = await getMongoDb();
  await db
    .collection(COLLECTIONS.opinionReactionsCache)
    .createIndex({ personaId: 1, policyHash: 1, model: 1 }, { unique: true });
  indexEnsured = true;
}

export function hashPolicyText(policyText: string): string {
  return createHash("sha256").update(policyText).digest("hex");
}

export async function getOrGenerateOpinion(
  personaId: string,
  personaText: string,
  policyText: string,
): Promise<string> {
  await ensureIndex();
  const policyHash = hashPolicyText(policyText);
  const model = currentModelAlias();
  const db = await getMongoDb();
  const collection = db.collection<OpinionCacheDoc>(COLLECTIONS.opinionReactionsCache);

  const cached = await collection.findOne({ personaId, policyHash, model });
  if (cached) return cached.opinionText;

  const opinionText = await generateOpinion(personaText, policyText);
  await collection.updateOne(
    { personaId, policyHash, model },
    {
      $setOnInsert: {
        personaId,
        policyHash,
        model,
        opinionText,
        generatedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  );
  return opinionText;
}
