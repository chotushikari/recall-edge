# Task 06 — Integration (you + 1 Codex agent)

> **Task ID:** 06
> **Owner:** You (orchestrator) + 1 Codex agent assigned to fix integration breakage
> **Time budget:** 2 hours
> **When to run:** After all 4 worktrees (`wt-store`, `wt-sync`, `wt-ui`, `wt-demo`) have opened PRs against `main`

---

## Goal

Merge all 4 worktrees into `main`, wire the integration seams (OpenChronicle fts→Qdrant swap, lifespan replacement, missing endpoints, port conflicts), and pass the smoke-test ladder. After this task, the demo is end-to-end functional. Task 07 (runbook rehearsal) can then begin.

---

## Merge order

The 4 worktrees are contract-bound (they all build against `01-contracts.md`), so file-level conflicts should be minimal. Merge in this order because it minimizes integration surprises:

```bash
cd /home/z/my-project/recall   # main worktree

# 1. Store first — provides the Qdrant Edge wrapper everything else hits at runtime
git merge --no-ff feat/store -m "Merge feat/store: Qdrant Edge in-process wrapper + FastAPI server"
# Smoke: uvicorn backend.api.server:app --port 8000 → curl /health → 200 OK

# 2. Sync second — depends on store's qdrant client + memory events
git merge --no-ff feat/sync -m "Merge feat/sync: outbox + sync loop + supersede-in-cloud + privacy gate"
# Smoke: see lifespan wiring below; restart server; /node/state should now show pending count

# 3. UI third — consumes REST endpoints from store + sync
git merge --no-ff feat/ui -m "Merge feat/ui: Next.js + Dayflow-timeline + storage-status-panel"
# Smoke: cd frontend && npm install && npm run dev → open localhost:3000 → node card renders

# 4. Demo harness last — depends on all REST endpoints existing
git merge --no-ff feat/demo -m "Merge feat/demo: seed + kill-network + judge queries"
# Smoke: python scripts/seed.py --reset --count 50 → /node/state shows count
```

If a merge has a conflict, the file owner (per worktree scope) wins. If both worktrees somehow edited the same file (shouldn't happen given the scope boundaries), decide manually.

---

## Integration seam #1 — swap OpenChronicle's `store/fts.py` for our Qdrant store

**Problem:** OpenChronicle's writer pipeline calls `from openchronicle.store.fts import index_memory, search_memories, ...`. Task 02 wrote `backend/qdrant_local/store.py` with the same API surface, but didn't touch OpenChronicle. The writer still writes to SQLite FTS5.

**Fix (you do this at integration):**

There are two approaches. Pick one based on which is cleaner after the merge:

**Approach A — Module alias (preferred, less invasive):**
```python
# Edit src/openchronicle/store/__init__.py (if it re-exports fts)
# Replace: from .fts import index_memory, search_memories, get_memory, supersede_memory, ...
# With:    from backend.qdrant_local.store import index_memory, search_memories, get_memory, supersede_memory, ...
```

**Approach B — Monkeypatch at FastAPI startup:**
```python
# In backend/api/server.py, at the top after imports:
import sys
from backend.qdrant_local import store as qdrant_store
sys.modules['openchronicle.store.fts'] = qdrant_store  # redirect all OpenChronicle's fts imports to our Qdrant store
```

**Verify:** start OpenChronicle's capture daemon (`python -m openchronicle start`), do some activity (open Chrome, browse github.com), wait 5 minutes for the session reducer to tick. Check `/node/state` — `local_memory_count` should increase.

---

## Integration seam #2 — replace Task 02's lifespan with Task 03's `recall_sync_lifespan`

**Problem:** Task 02 wrote a minimal lifespan that just warms the Qdrant client. Task 03 wrote `recall_sync_lifespan` that ALSO starts the sync loop. They both can't be in `server.py` simultaneously.

**Fix (you do this):**

```python
# backend/api/server.py — change this:
from backend.api.server import recall_lifespan  # ← Task 02's version

# to this:
from backend.sync.lifespan import recall_sync_lifespan as recall_lifespan  # ← Task 03's version

# The FastAPI app instantiation stays the same:
app = FastAPI(title="Recall Edge API", lifespan=recall_lifespan)
```

**Verify:** restart the server. The console should print "Sync loop started" or similar (whatever Task 03's loop logs). If it crashes on startup, Task 03's `init_schema()` is broken — assign a Codex agent to fix.

---

## Integration seam #3 — missing endpoints Task 04 needs

Task 04's dashboard calls these endpoints that Task 02 / Task 03 may not have implemented:

| Endpoint                           | Owner should add | Notes                                    |
| ---------------------------------- | ----------------- | ---------------------------------------- |
| `GET /memories?limit=N`           | Task 02           | List recent memories. `client.scroll()`. |
| `GET /sync/latest-result`          | Task 03           | Cache the latest `SyncResult` in a module-level var; return it. |
| `GET /sync/conflicts`              | Task 03           | Verify it exists per the spec.           |
| `POST /sync/conflicts/{id}/resolve`| Task 03           | Verify it exists per the spec.           |
| `POST /sync/run-now`               | Task 03           | Trigger `run_sync_loop()` immediately. Easiest: set a flag the loop checks; or just call `push_batch_to_cloud()` once directly. |
| `DELETE /memories/all`             | Task 02           | Used by `scripts/seed.py --reset`. Implementation: `client.delete_collection(COLLECTION_NAME); ensure_collection(client)`. |

**Strategy:** Run the smoke test ladder (below). For each 404, assign a Codex agent to add the endpoint. Each is a 5–15 minute fix.

---

## Integration seam #4 — frontend env vars

Task 04 calls `process.env.NEXT_PUBLIC_API_BASE`. Create `frontend/.env.local`:

```bash
NEXT_PUBLIC_API_BASE=http://localhost:8000
```

Without this, the dashboard calls a relative URL and gets 404.

---

## Integration seam #5 — shadcn/ui setup

Task 04's components reference `@/components/ui/card`, `@/components/ui/badge`, `@/components/ui/dialog`, `@/components/ui/button`, `@/components/ui/tabs`. These don't exist until you run:

```bash
cd frontend
npx shadcn@latest init -y
npx shadcn@latest add card badge dialog button tabs
```

If Task 04 already added a `components.json` and `lib/utils.ts` in their worktree, this just works. If not, run init first.

---

## Integration seam #6 — OpenChronicle's daemon

The activity capture pipeline runs as a separate daemon process. You need to start it alongside the FastAPI server:

```bash
# Terminal 1: OpenChronicle daemon (captures AX-tree events)
python -m openchronicle start &

# Terminal 2: FastAPI server (our wrapper)
uvicorn backend.api.server:app --port 8000 &

# Terminal 3: Next.js frontend
cd frontend && npm run dev &

# Terminal 4: demo harness
python scripts/seed.py --reset --count 250
```

If you skip Terminal 1, no live activity gets captured — the demo beats 2 and 3 won't work. The seed corpus (from Terminal 4) provides the historical context; the daemon provides the live capture for the "I just used my computer" beat.

---

## Integration seam #7 — port conflicts

| Service                | Port  | Conflict risk                            |
| ---------------------- | ----- | ---------------------------------------- |
| FastAPI                | 8000  | Common dev port                          |
| Next.js                | 3000  | Common dev port                          |
| OpenChronicle daemon   | n/a   | No port — uses file-based event queue    |
| Qdrant local           | n/a   | In-process, no port                     |
| Qdrant Cloud           | 6333  | Not used locally; only sync engine calls it |

If port 8000 or 3000 is busy:
```bash
lsof -i :8000   # find PID
kill -9 <PID>
```

---

## Smoke test ladder

Run these in order. If any fails, fix before proceeding.

```bash
# === Ladder 1: backend starts ===
cd /home/z/my-project/recall
. .venv/bin/activate  # or however you activated venv
uvicorn backend.api.server:app --port 8000 &
sleep 3
curl -s http://localhost:8000/health
# Expected: {"status":"ok"}

# === Ladder 2: memory ingest works ===
curl -s -X POST http://localhost:8000/memories \
  -H 'Content-Type: application/json' \
  -d '{
    "memory_type": "topic",
    "summary": "Smoke test memory",
    "embedding_text": "Smoke test memory for integration verification",
    "provenance": {"app_name": "TestRunner"}
  }'
# Expected: {"memory_id":"...","dedup_key":"...","stored":true,"dedup":false,"privacy":"syncable"}

# === Ladder 3: privacy policy applied ===
curl -s -X POST http://localhost:8000/memories \
  -H 'Content-Type: application/json' \
  -d '{
    "memory_type": "user",
    "summary": "Smoke test private memory",
    "embedding_text": "Smoke test private memory — should be PRIVATE",
    "provenance": {"app_name": "TestRunner"}
  }'
# Expected: privacy="private"

curl -s -X POST http://localhost:8000/memories \
  -H 'Content-Type: application/json' \
  -d '{
    "memory_type": "tool",
    "summary": "1Password access",
    "embedding_text": "Opened 1Password to copy a credential",
    "provenance": {"app_name": "1Password", "bundle_id": "com.1password.7"}
  }'
# Expected: privacy="private" (app override wins)

# === Ladder 4: search works (killer demo behavior) ===
curl -s -X POST http://localhost:8000/memory/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "smoke test", "top_k": 5}'
# Expected: list with at least 1 result; the smoke test memory is top-1

# === Ladder 5: offline flag works ===
curl -s -X POST http://localhost:8000/network/toggle \
  -H 'Content-Type: application/json' \
  -d '{"online": false}'
# Expected: {"online":false}

curl -s -X POST http://localhost:8000/memory/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "smoke test", "top_k": 5}'
# Expected: STILL returns results (Qdrant Edge is in-process; offline doesn't break search)

curl -s -X POST http://localhost:8000/network/toggle \
  -H 'Content-Type: application/json' \
  -d '{"online": true}'

# === Ladder 6: node state shows counts ===
curl -s http://localhost:8000/node/state
# Expected: {"node_id":"edge-node-a","status":"online","local_memory_count":3,"cloud_memory_count":0,"pending_sync_count":2,"private_count":1}
# (2 syncable memories pending sync; 1 private memory not pending)

# === Ladder 7: sync engine is running ===
sleep 15  # wait for the sync loop to tick
curl -s http://localhost:8000/node/state
# Expected: pending_sync_count may still be 2 if cloud URL is unset (fine for local demo)
# Verify no crash in server logs.

# === Ladder 8: OpenChronicle daemon is capturing ===
python -m openchronicle start &
sleep 60  # capture some activity
curl -s http://localhost:8000/node/state
# Expected: local_memory_count should INCREASE if OpenChronicle's writer produced new memories
# If it doesn't increase, the fts→qdrant swap (seam #1) didn't take — debug.

# === Ladder 9: seed works ===
python scripts/seed.py --count 50
# Expected: "Seeded 50 memories · 49 stored · 1 dedup · ~10 PRIVATE · ~40 SYNCABLE · 0 conflicts"

# === Ladder 10: judge queries pass ===
python scripts/test_queries.py
# Expected: at least 7/10 pass after dedup_keys are populated. If <7, adjust seed corpus phrasings.

# === Ladder 11: frontend starts ===
cd frontend
npm install
npm run dev &
sleep 5
curl -s http://localhost:3000 | head -50
# Expected: HTML containing "Recall" somewhere

# === Ladder 12: dashboard talks to backend ===
# Open http://localhost:3000 in a browser
# Expected: Node status card renders with non-zero local_memory_count
# Open http://localhost:3000/?judge=1
# Expected: Judge controls panel visible
# Type "smoke test" in AskMemoryBox → press Enter
# Expected: top-1 result is the smoke test memory you ingested
# Expected: StorageStatusPanel shows "● EDGE ✓ LOCAL ✓ OFFLINE-CAPABLE ○ CLOUD SYNCED"
# Expected: PrivacyBadge shows "SYNCABLE · EDGE + CLOUD"
```

If all 12 ladders pass, integration is green. Proceed to Task 07 (runbook rehearsal).

---

## Common breakage and fixes

### Breakage 1: `ModuleNotFoundError: No module named 'backend.sync'` on server start

**Cause:** Task 02's PR merged before Task 03's. The lifespan import in `server.py` (which you added at integration) fails.

**Fix:** `pip install -e .` again to register the new `backend.sync` package. Or set `PYTHONPATH=/home/z/my-project/recall` in your shell.

### Breakage 2: `qdrant_client.http.exceptions.ResponseHandlingError: Unexpected response: 404`

**Cause:** Qdrant collection doesn't exist. `ensure_collection()` should have created it, but if the local path was deleted between runs, the singleton client may be stale.

**Fix:** Delete the `QDRANT_LOCAL_PATH` directory, restart the server. `ensure_collection()` runs on first client creation.

### Breakage 3: `fastembed` downloads model on first embed → 30+ second delay on first search

**Cause:** fastembed lazily downloads the `BAAI/bge-small-en-v1.5` model (~120MB) on first use.

**Fix:** Pre-warm the model at server startup. Add to `backend/api/server.py` `@app.on_event("startup")`:
```python
@app.on_event("startup")
def warm_embedder():
    from backend.qdrant_local.store import _embed
    _embed("warmup")
```

### Breakage 4: OpenChronicle's writer doesn't produce memories → `local_memory_count` stays at 3 after Ladder 8

**Cause:** Seam #1 (fts→Qdrant swap) didn't take. Either the import alias is wrong, or OpenChronicle's daemon is using cached `.pyc` files.

**Fix:**
```bash
find . -name "*.pyc" -delete
find . -name "__pycache__" -type d -exec rm -rf {} +
python -m openchronicle start  # restart daemon
```

Also verify with `python -c "from openchronicle.store import fts; print(fts.__file__)"` — should print `backend/qdrant_local/store.py`, NOT the original fts.py.

### Breakage 5: frontend gets CORS error

**Cause:** FastAPI's CORSMiddleware has `allow_origins=["*"]` but doesn't include the right methods or headers for the POST `/memory/search` with JSON body.

**Fix:** Verify the middleware block in `server.py` includes `allow_methods=["*"]` and `allow_headers=["*"]`. If still failing, add `allow_credentials=False`.

### Breakage 6: judge queries return wrong top-1

**Cause:** The seed corpus's paraphrased Qdrant research events aren't paraphrase-close enough to the judge query. Or the `embedding_text` of the canonical event doesn't include the keywords the judge will use.

**Fix:** Re-read the `why_it_matches` note for each failing query in `scripts/judge_queries.json`. Edit the seed corpus in `scripts/seed.py` to make the canonical event's `embedding_text` more semantically aligned. Re-seed. Re-run `test_queries.py`.

### Breakage 7: sync loop crashes silently when Qdrant Cloud URL is unset

**Cause:** Task 03's `get_cloud_client()` returns `None`, but the loop calls `client.upload_collection()` without a None check.

**Fix:** The loop should `if client is None: continue` before attempting sync. Assign Task 03 a fix.

### Breakage 8: PRIVATE memory count is 0 after seed

**Cause:** The seed corpus doesn't include enough PRIVATE memories (banking, 1Password, Mail). Or the app override patterns in `policy.py` don't match.

**Fix:** Verify `policy.py`'s `APP_OVERRIDES` patterns. Re-run seed with `--print-keys` and check the privacy split. If PRIVATE count is 0, the seed script's bundle_id values aren't matching the patterns.

### Breakage 9: OpenChronicle's capture daemon crashes on macOS 15+

**Cause:** AX-tree APIs may have changed in macOS Sequoia. OpenChronicle's alpha status means it may not have caught up.

**Fix:** Check OpenChronicle's issue tracker. If broken, fall back to **synthetic activity events only** — the demo's "live activity" beat becomes scripted via `scripts/seed.py` instead of real capture. Document this honestly in the runbook.

---

## Done criteria for integration

- [ ] All 4 worktrees merged to main
- [ ] OpenChronicle's fts→Qdrant swap wired (seam #1)
- [ ] Sync lifespan wired into FastAPI server (seam #2)
- [ ] All missing endpoints from seam #3 added
- [ ] `.env.local` for frontend created
- [ ] shadcn/ui components installed
- [ ] OpenChronicle daemon starts and captures activity
- [ ] All 12 smoke-test ladders pass
- [ ] No server crashes during a 5-minute idle run
- [ ] `python scripts/test_queries.py` reports ≥7/10 passes
- [ ] Dashboard renders at `localhost:3000` and shows real backend data
- [ ] Privacy badge appears on memory cards (amber for PRIVATE, sky for SYNCABLE)
- [ ] Version badge appears on superseded memory cards ("v2 → updated")
- [ ] StorageStatusPanel appears under each search result
- [ ] PRIVATE memory count is non-zero in `/node/state`

Once these pass, proceed to `07-runbook.md`.
