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

export class KnowledgeUploadPathError extends Error {}

/** Directory every knowledge document must live under; keeps a malformed or hand-edited repoPath from reading outside this tree. */
const KNOWLEDGE_ROOT_PREFIX = "docs/backboard/knowledge/";

/**
 * Defense-in-depth path allowlist: every `KnowledgeDocumentRef.repoPath`
 * (see assistants.ts's `kd()` helper, the only place these are constructed)
 * must resolve to a path under `docs/backboard/knowledge/`, with no `..`
 * traversal and no absolute-path override. This never fires for the roster
 * as built today; it exists so a future hand-edited or malformed
 * `repoPath` fails loudly here instead of reading an arbitrary file off
 * disk and uploading its contents to Backboard.
 */
export function assertSafeKnowledgeRepoPath(repoPath: string): void {
  if (path.isAbsolute(repoPath)) {
    throw new KnowledgeUploadPathError(`Knowledge document repoPath must be relative, got an absolute path: "${repoPath}".`);
  }
  const normalized = path.normalize(repoPath);
  if (normalized.split(path.sep).includes("..")) {
    throw new KnowledgeUploadPathError(`Knowledge document repoPath must not traverse outside its directory: "${repoPath}".`);
  }
  if (!normalized.replace(/\\/g, "/").startsWith(KNOWLEDGE_ROOT_PREFIX)) {
    throw new KnowledgeUploadPathError(
      `Knowledge document repoPath must live under "${KNOWLEDGE_ROOT_PREFIX}", got: "${repoPath}".`,
    );
  }
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
      assertSafeKnowledgeRepoPath(doc.repoPath);
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
