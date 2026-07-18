import { readFile } from "node:fs/promises";
import path from "node:path";

import { getAssistantManifest } from "@/lib/backboard/assistant-manifest";
import { ASSISTANT_ROSTER } from "@/lib/backboard/assistants";
import type { BackboardAdapter } from "@/lib/backboard/client";
import { assertServerOnly } from "@/lib/backboard/env";

export interface KnowledgeUploadResult {
  role: string;
  filename: string;
  documentId: string;
  status: string;
}

/**
 * Uploads each role's knowledge documents to its resolved Backboard
 * assistant. Deliberately NOT called on every process boot (unlike the
 * assistant manifest): the API exposes no reliable way to list a given
 * assistant's existing documents, so calling this repeatedly would create
 * duplicates. Run it explicitly via `npm run backboard:bootstrap` instead.
 */
export async function uploadKnowledgeDocuments(
  adapter: BackboardAdapter,
  repoRoot: string,
): Promise<KnowledgeUploadResult[]> {
  assertServerOnly("uploadKnowledgeDocuments");
  const manifest = await getAssistantManifest(adapter);
  const results: KnowledgeUploadResult[] = [];

  for (const role of Object.values(ASSISTANT_ROSTER)) {
    const resolved = manifest.get(role.key);
    if (!resolved) continue;

    for (const doc of role.knowledgeDocuments) {
      const content = await readFile(path.join(repoRoot, doc.repoPath), "utf-8");
      const uploaded = await adapter.uploadAssistantDocument(
        resolved.record.assistantId,
        doc.filename,
        content,
        doc.mimeType,
      );
      results.push({
        role: role.key,
        filename: doc.filename,
        documentId: uploaded.documentId,
        status: uploaded.status,
      });
    }
  }

  return results;
}
