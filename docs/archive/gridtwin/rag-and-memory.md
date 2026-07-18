# RAG (Knowledge Documents) and Memory

Backboard gives each assistant two distinct kinds of long-term context:
**knowledge documents** (static, uploaded files an assistant can retrieve
against) and **memory** (a per-assistant store of shorter facts/notes that
can be searched, added to, and edited over time). GridTwin uses both, for
different jobs, and neither should be confused with the other.

## Knowledge documents (static, file-based)

- Defined per role in `AssistantRoleDefinition.knowledgeDocuments`
  (`src/lib/backboard/assistants.ts`): a list of `{ filename, repoPath,
  mimeType }` pointing at files under `docs/backboard/knowledge/`.
- Uploaded by `uploadKnowledgeDocuments` (`src/lib/backboard/knowledge-upload.ts`),
  which reads each file from disk and calls
  `adapter.uploadAssistantDocument(assistantId, filename, content, mimeType)`
  for every document on every resolved role.
- Triggered only by `npm run backboard:bootstrap`. It is **deliberately not
  called on every process boot** the way `getAssistantManifest` is: the
  Backboard API exposes no reliable way to list a given assistant's existing
  documents, so calling this on every boot (or every deploy) would create
  duplicate uploads. Re-run `backboard:bootstrap` by hand whenever a
  knowledge document changes or a new one is added to a role.
- Every knowledge document lives under `docs/backboard/knowledge/` and, per
  this repository's transparency convention, states plainly that it
  describes a simplified simulation, not a certified real system. See
  `docs/backboard/knowledge/product-limitations.md` for the consolidated
  version of that disclosure.
- Which document goes to which role is a judgment call about relevance, not
  a hard rule; see `assistants.md` for the current mapping. Prefer keeping a
  new document mapped to every role that would plausibly cite it, without
  mapping every document to every role (that just dilutes retrieval).

## Memory (dynamic, per-assistant notes)

- Every role in `ASSISTANT_ROSTER` runs with `memory: "Readonly"`
  (`MemoryMode`). This means every run may have relevant memory
  automatically surfaced into context, but **no run ever writes to memory
  as a side effect**. A dispatch run that goes badly does not silently
  "remember" anything on its own.
- Memory reads and writes are exposed as explicit HTTP routes under
  `src/app/api/backboard/memories/`:
  - `GET /api/backboard/memories?assistantRole=...`: list an assistant's
    curated memories.
  - `POST /api/backboard/memories`: add a memory
    (`{ assistantRole, content, metadata? }`). This is meant to be called
    only from an operator-approved UI action after a run completes, e.g.
    "remember that this operator prefers a wider reserve margin during
    evening peaks."
  - `POST /api/backboard/memories/search`: explicit search
    (`{ assistantRole, query, limit? }`).
  - `PUT /api/backboard/memories/[memoryId]`: edit a memory's content.
  - `DELETE /api/backboard/memories/[memoryId]`: delete one memory.
  - `DELETE /api/backboard/memories?assistantRole=...&confirm=true`: wipe
    every memory for an assistant. The `confirm=true` requirement exists
    specifically to prevent an accidental full reset.
- The one place an assistant itself can reach into memory mid-run is the
  Chief Dispatch Officer's `recall_operator_notes` tool, which performs an
  *explicit* `searchMemories` call on top of whatever was already
  auto-surfaced. No other role has this tool.
- `resetAssistantManifestForTests()` and the mock adapter's in-memory
  `Map<assistantId, MemoryRecord[]>` make memory fully testable offline; see
  `testing.md` and `tests/backboard-memory-routes.test.ts`.
- The control room's "Memory" tab (`src/components/grid/ApprovedMemoryPanel.tsx`,
  assembled by `GridControlRoom`) is the operator-facing UI for exactly these
  routes: list, search, add, and delete, scoped to
  `chief-dispatch-officer` by default. It is a thin `fetch` client over the
  routes above; it has no server-side logic of its own.

## Why this split matters

Per this repository's broader interpretability principle (see the top-level
`AGENTS.md`): every scored or retrieved artifact should stay legible text
that a human can audit. Knowledge documents are always plain Markdown files
checked into this repo; memory entries are always plain-text notes an
operator explicitly approved. Nothing in this subsystem stores or retrieves
an opaque embedding a human cannot read.
