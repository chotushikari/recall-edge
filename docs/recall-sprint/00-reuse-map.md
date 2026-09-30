# Reuse Map — File-level pointers to OpenChronicle

This file is the **catalog of upstream code patterns** each Codex agent should study before writing its own code. Every pointer is a real file in [`Einsia/OpenChronicle`](https://github.com/Einsia/OpenChronicle) — MIT-licensed, Python, verified to exist as of `HEAD` at sprint start.

**Rule for agents:** Before writing the first line of your module's code, clone OpenChronicle (depth-1 is fine), open the file(s) below that match your scope, read top-to-bottom, then write a 1-line comment at the top of your new file citing it: `# Adapted from Einsia/OpenChronicle/<path> (MIT)`.

```bash
# One-time setup — each agent clones OpenChronicle shallow
cd /tmp && git clone --depth=1 https://github.com/Einsia/OpenChronicle.git upstream-oc
```

---

## OpenChronicle's pipeline (read this paragraph first)

OpenChronicle's flow is exactly what we want at the intake layer:

```
ax_capture.py       ← macOS AX-tree polling (focused element, active app, window title)
       ↓
event_dispatcher.py  ← debounces + dedups raw events
       ↓
s1_parser.py        ← Stage 1: extracts URL / edited text / app context from AX payload
       ↓
session/manager.py   ← idle 5m / app-switch 3m → cuts "sessions"
       ↓
writer/classifier.py ← Stage 2: typed-memory classifier (USER/PROJECT/TOOL/TOPIC/PERSON/ORG)
       ↓
writer/session_reducer.py ← Stage 3: compacts → emits Memory records; SUPERSEDES prior versions
       ↓
store/fts.py         ← SQLite FTS5 storage (← THIS IS OUR SWAP POINT)
       ↓
store/entries.py     ← entry schema (becomes Qdrant point payload)
       ↓
mcp/server.py        ← MCP tool surface (← OUR CHAT UI WRAPS THIS)
```

We swap `store/fts.py` for `backend/qdrant_local/`. Everything upstream stays as-is. Everything downstream gets a new consumer (our chat UI). The versioning system in `writer/session_reducer.py` is reused verbatim — that's the free PS03 piece.

---

## Catalog

| OpenChronicle path                                                | What it is                                          | Our use                                           |
| ----------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| `src/openchronicle/capture/ax_capture.py`                          | macOS AX-tree polling                               | **Keep as-is.** Source of activity events.         |
| `src/openchronicle/capture/s1_parser.py`                            | Stage-1 parse: URL/edited-text/app-context          | **Keep as-is.**                                    |
| `src/openchronicle/capture/event_dispatcher.py`                     | Debounce + dedup                                    | **Keep as-is.**                                    |
| `src/openchronicle/capture/watcher.py`                              | Background watcher loop                              | **Keep as-is.**                                    |
| `src/openchronicle/session/manager.py`                              | Idle/app-switch session cutting                     | **Keep as-is.**                                    |
| `src/openchronicle/writer/classifier.py`                            | **Typed-memory classifier** (USER/PROJECT/TOOL/TOPIC/PERSON/ORG) | **Keep + extend.** Types become the privacy-policy primitive (USER/PERSON → PRIVATE; PROJECT/TOOL/TOPIC/ORG → SYNCABLE). |
| `src/openchronicle/writer/session_reducer.py`                       | **Supersede-not-delete versioning**                 | **Keep as-is.** The hardest PS03 piece, built free. |
| `src/openchronicle/store/fts.py`                                    | SQLite FTS5 storage                                  | **REPLACE.** → `backend/qdrant_local/`. One module swap. |
| `src/openchronicle/store/entries.py`                                | Entry schema                                          | **Adapt.** Becomes Qdrant point payload schema.   |
| `src/openchronicle/store/files.py`                                  | Markdown file storage                                | **Keep as-is** — the markdown is the source-of-truth; Qdrant is the search index. |
| `src/openchronicle/mcp/server.py`                                  | MCP tool surface exposing retrieval                 | **Wrap.** Our chat UI calls these tools + renders results as evidence cards. |
| `docs/memory-format.md`                                             | Canonical supersede/versioning semantics            | **Read first.** Aligns our contracts with upstream. |
| `docs/architecture.md`                                              | End-to-end pipeline map                              | **Read first.** Orientation.                       |
| `src/openchronicle/cli.py` / `daemon.py`                            | Runtime entrypoints                                 | **Keep as-is.**                                    |

---

## File-level pointers by module

### For Task 02 — Capture + Qdrant Edge store (wt-store)

**Read these before writing code:**

1. **`src/openchronicle/store/fts.py`** — THE SWAP TARGET
   - Open this file first. Read every function.
   - Note the API surface: probably `index(...)`, `search(...)`, `delete(...)`, `supersede(...)`.
   - Your job: implement the SAME API surface but backed by `qdrant-client` in local mode.
   - Every other module in OpenChronicle that calls `fts.py` keeps working without changes.

2. **`src/openchronicle/store/entries.py`** — entry schema
   - This is the data shape stored. It becomes the Qdrant point payload.
   - Likely fields: `entry_id`, `session_id`, `timestamp`, `app`, `url`, `focused_element`, `edited_text`, `summary`, `memory_type`, `version`, `supersedes`, `provenance`.
   - Your `ActivityEvent` / `Memory` Pydantic models in `01-contracts.md` mirror this shape.

3. **`src/openchronicle/writer/classifier.py`** — typed-memory classifier
   - The 6 memory types: USER, PROJECT, TOOL, TOPIC, PERSON, ORG.
   - This is your privacy-policy primitive. Add a `privacy: PrivacyClass` field computed from `memory_type`: USER + PERSON → PRIVATE; PROJECT + TOOL + TOPIC + ORG → SYNCABLE.
   - Don't modify the classifier itself — just add a `policy.py` post-processor that runs after the classifier.

4. **`src/openchronicle/writer/session_reducer.py`** — supersede logic
   - **Read this 3 times.** This is the versioning system you must NOT break.
   - The contract: when a new memory is created that supersedes an old one, the old memory's `superseded_by` field is set; the new memory's `version` increments; the old memory is NOT deleted.
   - Your Qdrant store must preserve this — store both versions, query for the latest by `version` DESC.

5. **`docs/memory-format.md`** — canonical versioning semantics
   - Read first. Aligns our contracts with upstream so we don't accidentally break the supersede flow.

6. **`mem0ai/mem0` → `mem0/memory/storage.py`** — Qdrant local-mode pattern
   - For the actual Qdrant client instantiation. `QdrantClient(path="./local-qdrant")`.
   - This is the pattern we adapted from mem0 (Apache-2.0).

7. **`qdrant-labs/qdrant-client` → `examples/sync_local_to_cloud/`** — local→cloud sync pattern
   - For Task 03's reference. You don't implement sync; you just need to know what shape your `local_only` flag and outbox append will feed into.

---

### For Task 03 — Sync engine (wt-sync)

**Read these before writing code:**

1. **`qdrant-labs/qdrant-client` → `examples/sync_local_to_cloud/`** — your single source of truth
   - The exact API call to push from local Qdrant to cloud Qdrant.
   - Copy the pattern, wrap in an outbox queue.

2. **`src/openchronicle/store/fts.py`** — to know the local-side read API
   - You need to read local memories by `dedup_key` to compare against cloud versions for conflict detection.

3. **`src/openchronicle/writer/session_reducer.py`** — to know what "versioned" means
   - For 24h: there's no real "conflict" — supersede handles it. Cloud has v1, edge has v2 → cloud gets v2 on sync, old v1 is preserved with `superseded_by`. The "conflict" is just "edge is ahead of cloud".
   - Don't build a conflict modal. Show "v1 → v2" version badge instead.

4. **Outbox pattern**: https://microservices.io/patterns/data/transactional-outbox.html (first 2 paragraphs only)
   - SQLite outbox, drained by a background loop. Standard pattern.

5. **Stripe API idempotency docs**: https://stripe.com/docs/api/idempotent_requests (first 2 paragraphs)
   - Our `SyncBatch.idempotency_key` follows Stripe's semantics.

---

### For Task 04 — Dashboard (wt-ui)

**Read these before writing code:**

1. **`src/openchronicle/mcp/server.py`** — the existing retrieval tool surface
   - This already exposes `search_memory(query, ...)` and `get_memory(id)`.
   - Your chat UI calls these (or our FastAPI wrapper around them).
   - Don't reimplement retrieval — just wrap.

2. **`JerryZLiu/Dayflow` → `Dayflow/Sources/Features/Timeline/`** — UX reference
   - Vertical timeline of memory cards with timestamp + summary + source-chip.
   - Translate the *visual structure* to TSX or Jinja2 template. Do NOT translate Swift code.
   - Note: cards grouped by day, sticky day headers, relative timestamps ("3 min ago"), source chip colored by app.

3. **`mediar-ai/screenpipe` → `packages/observatory/`** — closest existing Next.js reference
   - If you choose the Next.js path. Same stack (shadcn/ui, Tailwind).
   - Sidebar + main + status header pattern.
   - **Skip** the search-by-text-over-Rust pipeline — we have our own backend.

4. **`supermemoryai/supermemory`** — for the chat-evidence-panel pattern
   - The "ANSWER + MEMORY RETRIEVED + STORAGE status" panel layout is the killer differentiator. The chatbot is NOT the product; the retrieval evidence IS.
   - Look at their web UI for the evidence card layout.

5. **shadcn/ui** → https://ui.shadcn.com/examples
   - For the memory card, the privacy badge, the version history badge, the sync report card.
   - Run `npx shadcn@latest add card badge dialog button tabs` if you go Next.js.

---

### For Task 05 — Demo harness (wt-demo)

**Read these before writing code:**

1. **`qdrant-labs/qdrant-demo` → `smart_glasses/`** — seed pattern
   - They pre-generate synthetic frames + pre-compute vectors. We do the same but with synthetic activity events (not image frames).
   - **Do not clone their repo.** Read for pattern only.

2. **`src/openchronicle/capture/ax_capture.py`** — for the data shape of a real captured event
   - Your seed script should produce events that look like real AX-tree captures, so the timeline renders realistically.
   - e.g. `{app: "Chrome", url: "https://qdrant.tech/documentation/edge/", focused_element: "Qdrant Edge documentation page", window_title: "Qdrant Edge — Google Chrome", edited_text: null}`

3. **No other upstream file to copy.** This module is pure new code.

---

## How to read these files fast

Each Codex agent should clone OpenChronicle once and `rg` (ripgrep) for the patterns above. Spend **at most 20 minutes reading upstream** per module. The goal is pattern absorption, not porting.

```bash
# Setup (each agent does this once)
cd /tmp && git clone --depth=1 https://github.com/Einsia/OpenChronicle.git upstream-oc

# Find specific functions fast
rg "class.*Memory" upstream-oc/src/
rg "def search" upstream-oc/src/
rg "supersede" upstream-oc/src/
rg "PrivacyClass|privacy" upstream-oc/src/
```

---

## What "best way to use existing code" actually means here

Honest framing for the demo deck:

> "We forked Einsia/OpenChronicle — an MIT-licensed, macOS AX-tree activity capture system with supersede-not-delete versioning built in. We swapped its SQLite FTS5 search layer for Qdrant Edge's in-process vector engine. We added a deterministic memory-policy engine (USER/PERSON → PRIVATE; PROJECT/TOOL/TOPIC/ORG → SYNCABLE), a SQLite-outbox → Qdrant Cloud sync path, and a chat UI that renders retrieved memories as evidence cards with privacy badges and version history. OpenChronicle's classifier + supersede logic is reused verbatim — that's the part nobody rebuilds in a weekend."

That paragraph is the truth. It's also the answer to "is this just a Dayflow clone?" — no, we started from OpenChronicle, reused its two hardest pieces (AX-tree capture + versioned memories), and built the Qdrant Edge + sync + policy + chat-evidence layer on top.

---

## Forbidden repos (do not even clone for inspiration)

- `OpenRecall` — AGPL-3.0. Contaminates any code that touches it.
- Microsoft Recall (Windows 11 feature) — closed source.
- `recall.ai` (the company) — commercial, Y Combinator-backed, trademark collision with our product name.
- `mirbyte/Daylane` — AGPL-3.0 license trap, Windows-only.

These are off-limits. Anything else MIT or Apache-2.0 in the personal-memory space is fair game for **reading** (not porting).
