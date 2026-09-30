# Task 02 — Capture + Qdrant Edge Store (Codex agent in `wt-store`)

> **Task ID:** 02
> **Worktree:** `../wt-store` (branch `feat/store`)
> **Scope boundary:** `backend/qdrant_local/`, `backend/api/`
> **Do NOT touch:** `backend/contracts.py`, `backend/policy.py`, `backend/sync/`, `src/openchronicle/`, `frontend/`, `scripts/`

---

## Your mission

Build the Qdrant Edge in-process store wrapper that replaces OpenChronicle's `store/fts.py`, and a FastAPI server that exposes ingest + search + node state endpoints. Specifically:

1. **`backend/qdrant_local/`** — a Qdrant client wrapper that mirrors the API surface of OpenChronicle's `store/fts.py` so OpenChronicle's writer pipeline can swap seamlessly at integration.
2. **`backend/api/server.py`** — FastAPI server with:
   - `POST /memories` — receive a `Memory` (already classified by OpenChronicle's writer), compute `embedding`, apply `policy.py`, upsert to Qdrant Edge local.
   - `POST /activities` — receive an `ActivityEvent`, store it (for audit trail; not embedded unless writer has already promoted it to a Memory).
   - `POST /memory/search` — embed query, search local Qdrant, return top-K with payload + score.
   - `GET /memory/{memory_id}` — fetch one memory by ID; include version history (the supersede chain).
   - `GET /node/state` — return `NodeState` (online/offline badge, counts, last sync).
   - `GET /health` — basic liveness.
   - `POST /network/toggle` — flip `RECALL_NETWORK_ONLINE` env var (used by demo harness; no actual network killing).
3. **Wire OpenChronicle's writer to emit Memory records** — OpenChronicle's `writer/session_reducer.py` already produces memory records (its current sink is `store/fts.py`). At integration, the orchestrator replaces that sink with your `qdrant_local`. You write the receiving end (`POST /memories`), the orchestrator wires the sending end.

You are **the protagonist module** — the sponsor sees Qdrant Edge first through your endpoints. Build accordingly.

---

## Why Qdrant Edge is the protagonist here

This module is where Qdrant Edge earns its keep. The pitch:

> "Every memory captured at the edge is embedded locally with `fastembed` and stored in Qdrant Edge's in-process vector engine — no network round-trip, no service to start, no Docker container. The demo's offline search works because the vector engine IS the process. When network returns, we sync eligible (non-private) memories to Qdrant Cloud — same API, different transport. That's the Edge → Cloud story the sponsor's own page promises but doesn't demonstrate."

Your stub uses `QdrantClient(path=...)` (Qdrant local mode). This is the exact same API surface as Qdrant Edge beta — when the agent gets Edge access, you swap one constructor argument: `QdrantClient(host=..., port=...)`. **No other code changes.** That's the entire de-risk move.

---

## Reuse pointers (read BEFORE writing code)

Spend ≤20 minutes here. Goal is pattern absorption, not porting.

1. **OpenChronicle → `src/openchronicle/store/fts.py`** — THE SWAP TARGET
   - Clone OpenChronicle (`git clone --depth=1 https://github.com/Einsia/OpenChronicle.git /tmp/upstream-oc`)
   - Open this file first. Read every function. Note the API surface: probably `index(memory)`, `search(query, top_k)`, `get(memory_id)`, `delete(memory_id)`, `supersede(old_id, new_memory)`.
   - Your `backend/qdrant_local/store.py` mirrors this API EXACTLY — same function names, same signatures. The orchestrator swaps `from openchronicle.store.fts import ...` to `from backend.qdrant_local.store import ...` at integration.

2. **OpenChronicle → `src/openchronicle/store/entries.py`** — entry schema
   - The shape OpenChronicle emits. Your `Memory` Pydantic model in `01-contracts.md` already mirrors this.
   - When you build the Qdrant point payload, include every field from `entries.py` plus our new `privacy`, `local_only` fields.

3. **OpenChronicle → `src/openchronicle/writer/session_reducer.py`** — supersede logic
   - **Read 3 times.** This is the versioning system. Your `qdrant_local.store.supersede(old_id, new_memory)` must preserve its semantics: don't delete the old record; mark its `superseded_by`; insert the new record with `version = old.version + 1`; both stay in Qdrant.

4. **`mem0ai/mem0` → `mem0/memory/storage.py`** (or wherever `class Qdrant` lives — `gh search code 'QdrantClient(path=' --repo mem0ai/mem0`)
   - Copy the Qdrant local-mode instantiation pattern verbatim.
   - Note their `create_collection()` + `upsert()` call shape. Our shape is identical.

5. **`qdrant-labs/qdrant-client` → `examples/sync_local_to_cloud/`**
   - **DO NOT IMPLEMENT SYNC.** That's Task 03. But read this so your store exposes what Task 03 needs: a way to read all memories with `local_only=True` and `privacy=SYNCABLE`.

6. **OpenChronicle → `docs/memory-format.md`** + `docs/architecture.md`
   - Read first. Aligns our payload schema and pipeline map with upstream so we don't accidentally break the supersede flow.

---

## Spec

### `backend/qdrant_local/store.py` — API surface (mirror `fts.py`)

```python
# This file MUST expose the same function names and signatures as OpenChronicle's
# src/openchronicle/store/fts.py — so the orchestrator can swap them at integration
# by changing only the import line.

def index_memory(memory: Memory) -> str:
    """Upsert a memory. Compute dedup_key if not set. Embed embedding_text.
    Apply policy.py if privacy not set. Store in Qdrant local.
    Returns the stored memory_id."""

def search_memories(query: str, top_k: int = 5, filter: dict | None = None) -> list[dict]:
    """Embed query, search local Qdrant, return top-K results.
    Each result: {memory_id, dedup_key, score, payload, version}.
    Only returns the LATEST version of each memory (i.e. superseded_by is None)."""

def get_memory(memory_id: str, include_history: bool = False) -> dict:
    """Fetch one memory. If include_history, return the full supersede chain."""

def supersede_memory(old_id: str, new_memory: Memory) -> str:
    """Insert new_memory with version = old.version + 1, supersedes = old_id.
    Mark old.superseded_by = new_memory.memory_id. DO NOT delete old."""

def get_pending_sync(limit: int = 50) -> list[Memory]:
    """Return memories with privacy=SYNCABLE and local_only=True, limited.
    This is what Task 03's sync loop calls."""

def count_local() -> int:
    """Total local memory count (all privacy classes, latest version only)."""

def count_private() -> int:
    """PRIVATE memory count — never synced."""

def count_pending_sync() -> int:
    """Memories with privacy=SYNCABLE and local_only=True."""
```

### Endpoints (FastAPI)

| Method | Path                       | Body                              | Returns                                                                  |
| ------ | -------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| POST   | `/memories`                 | `Memory`                          | `{memory_id, dedup_key, stored: bool, dedup: bool, privacy: PrivacyClass}` |
| POST   | `/activities`               | `ActivityEvent`                   | `{event_id, stored: bool}` (audit trail only; not embedded)              |
| POST   | `/memory/search`            | `{query: str, top_k: int=5, filter?: dict}` | `list[{memory_id, dedup_key, score, payload, version}]`                |
| GET    | `/memory/{id}`              | — (query: `?include_history=true`) | `Memory` + optional `history: Memory[]`                                 |
| GET    | `/node/state`               | —                                 | `NodeState`                                                              |
| GET    | `/health`                   | —                                 | `{status: "ok"}`                                                         |
| POST   | `/network/toggle`           | `{online: bool}`                  | `{online: bool}`                                                         |

### Behavior rules

1. **Dedup on ingest:** compute `dedup_key` server-side. If a point with the same `dedup_key` exists in Qdrant, do NOT re-insert. Return `{stored: false, dedup: true}`.
2. **Embed server-side:** client never sends `embedding`. If `memory.embedding` is not None, raise `400 Embedding is computed server-side`.
3. **Policy applied at ingest:** every Memory that arrives at `POST /memories` runs through `backend.policy.apply_policy(memory, bundle_id=...)`. The returned `privacy` field is what gets stored. **PRIVATE memories get `local_only=True` permanently** — they never enter the sync outbox.
4. **Offline flag:** `RECALL_NETWORK_ONLINE` env var. Ingest always succeeds; only the sync engine differs (Task 03's concern).
5. **Search must work offline.** This is the demo's killer move. `POST /memory/search` queries local Qdrant only. Even when `RECALL_NETWORK_ONLINE=false`, search returns results.
6. **Node state counts:** `local_memory_count` = `count_local()`; `cloud_memory_count` = Task 03's `get_cloud_count()` (returns 0 if not integrated yet); `pending_sync_count` = `count_pending_sync()`; `private_count` = `count_private()`.
7. **Supersede flow:** when a new memory has `supersedes=<old_id>`, call `supersede_memory(old_id, new_memory)` instead of `index_memory(new_memory)`. The old record is preserved.

---

## Starter stub

### `backend/qdrant_local/__init__.py`
```python
from .client import get_qdrant_client, ensure_collection
from .store import (
    index_memory, search_memories, get_memory, supersede_memory,
    get_pending_sync, count_local, count_private, count_pending_sync,
)

__all__ = [
    "get_qdrant_client", "ensure_collection",
    "index_memory", "search_memories", "get_memory", "supersede_memory",
    "get_pending_sync", "count_local", "count_private", "count_pending_sync",
]
```

### `backend/qdrant_local/client.py` — write this
```python
"""Qdrant local-mode wrapper. Pattern adapted from mem0's storage.py (Apache-2.0).

When Edge beta access lands, swap `path=...` for `host=..., port=...`.
No other code changes — same API surface.
"""
import os
from pathlib import Path
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

from backend.contracts import COLLECTION_NAME, EMBEDDING_DIM, QDRANT_LOCAL_PATH

_client: QdrantClient | None = None

def get_qdrant_client() -> QdrantClient:
    global _client
    if _client is None:
        # Mode selection — env-driven
        mode = os.environ.get("RECALL_QDRANT_MODE", "local")
        if mode == "local":
            Path(QDRANT_LOCAL_PATH).parent.mkdir(parents=True, exist_ok=True)
            _client = QdrantClient(path=QDRANT_LOCAL_PATH)
        elif mode == "edge":
            _client = QdrantClient(
                host=os.environ["RECALL_QDRANT_EDGE_HOST"],
                port=int(os.environ.get("RECALL_QDRANT_EDGE_PORT", "6333")),
            )
        else:
            raise ValueError(f"Unknown Qdrant mode: {mode}")
        ensure_collection(_client)
    return _client

def ensure_collection(client: QdrantClient) -> None:
    # TODO: client.get_collection() — if NotFound, client.create_collection()
    try:
        client.get_collection(COLLECTION_NAME)
    except Exception:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )
```

### `backend/qdrant_local/store.py` — write this (mirror OpenChronicle's fts.py API)
```python
"""Qdrant Edge in-process store. Mirrors the API surface of
OpenChronicle's src/openchronicle/store/fts.py so the orchestrator
can swap fts→qdrant_local by changing one import line at integration.

Supersede semantics inherited from OpenChronicle writer/session_reducer.py:
- supersede(old, new): insert new with version=old.version+1, mark old.superseded_by
- DO NOT delete the old record
- search() returns only latest versions (superseded_by is None)
"""
from qdrant_client.http.models import PointStruct, Filter, FieldCondition, MatchValue

from backend.contracts import (
    COLLECTION_NAME, Memory, MemoryType, PrivacyClass,
)
from backend.qdrant_local.client import get_qdrant_client
from backend.policy import apply_policy
from fastembed import TextEmbedding

_embedding_model: TextEmbedding | None = None

def _embed(text: str) -> list[float]:
    global _embedding_model
    if _embedding_model is None:
        _embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    return list(_embedding_model.embed(text))[0]

def index_memory(memory: Memory, bundle_id: str | None = None) -> str:
    """Upsert a memory. Apply policy if privacy not set. Embed if needed."""
    if memory.embedding is None:
        memory.embedding = _embed(memory.embedding_text)
    if not memory.privacy:
        apply_policy(memory, bundle_id=bundle_id)

    client = get_qdrant_client()

    # dedup check
    if not memory.dedup_key:
        from backend.contracts import Memory as M
        memory.dedup_key = M.make_dedup_key(memory.memory_id)
    existing = client.retrieve(collection_name=COLLECTION_NAME, ids=[memory.dedup_key])
    if existing:
        # already exists — idempotent ingest
        return memory.memory_id

    # if this memory supersedes an older one, mark the older
    if memory.supersedes:
        _mark_superseded(memory.supersedes, memory.memory_id)

    client.upsert(
        collection_name=COLLECTION_NAME,
        points=[PointStruct(
            id=memory.dedup_key,
            vector=memory.embedding,
            payload=memory.model_dump(mode="json"),
        )],
    )
    return memory.memory_id

def _mark_superseded(old_memory_id: str, new_memory_id: str) -> None:
    """Set old.superseded_by = new. Does NOT delete old."""
    # TODO: fetch old by memory_id, set superseded_by, upsert back
    ...

def search_memories(query: str, top_k: int = 5, filter: dict | None = None) -> list[dict]:
    """Search local Qdrant. Returns only latest versions."""
    # TODO: embed query, search with filter (only superseded_by is null),
    # return list of {memory_id, dedup_key, score, payload, version}
    ...

def get_memory(memory_id: str, include_history: bool = False) -> dict:
    """Fetch one memory. If include_history, walk the supersede chain."""
    # TODO: fetch by memory_id (need payload index on memory_id field)
    # If include_history: walk back via supersedes field until None
    ...

def supersede_memory(old_id: str, new_memory: Memory) -> str:
    """Insert new_memory with version = old.version + 1, supersedes = old_id.
    Mark old.superseded_by = new_memory.memory_id. DO NOT delete old."""
    # TODO: implement per the contract above
    ...

def get_pending_sync(limit: int = 50) -> list[Memory]:
    """Return memories with privacy=SYNCABLE and local_only=True."""
    # TODO: scroll Qdrant with filter (payload.privacy=='syncable' AND payload.local_only==True)
    ...

def count_local() -> int:
    """Total local memory count (latest versions only)."""
    # TODO: client.count() with filter superseded_by is null
    ...

def count_private() -> int:
    """PRIVATE memory count."""
    ...

def count_pending_sync() -> int:
    """Memories with privacy=SYNCABLE and local_only=True."""
    ...
```

### `backend/api/server.py` — write this
```python
"""FastAPI server. This is what the dashboard and demo harness hit.

Wires OpenChronicle's MCP tools (which call store.fts) at integration —
the orchestrator changes one import line and OpenChronicle's writer
starts writing through our Qdrant store instead.
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend.contracts import Memory, ActivityEvent, NodeState, NodeStatus
from backend.qdrant_local import (
    index_memory, search_memories, get_memory,
    count_local, count_private, count_pending_sync,
)

@asynccontextmanager
async def recall_lifespan(app):
    # Task 03 will replace this lifespan with their own that also starts the sync loop
    # For now: just init the Qdrant client (warms up)
    from backend.qdrant_local.client import get_qdrant_client
    get_qdrant_client()  # triggers ensure_collection
    yield

app = FastAPI(title="Recall Edge API", lifespan=recall_lifespan)

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/memories")
def post_memory(memory: Memory, bundle_id: str | None = None):
    if memory.embedding is not None:
        raise HTTPException(400, "Embedding is computed server-side")
    mid = index_memory(memory, bundle_id=bundle_id)
    return {
        "memory_id": mid,
        "dedup_key": memory.dedup_key,
        "stored": True,
        "dedup": False,
        "privacy": memory.privacy,
    }

@app.post("/activities")
def post_activity(event: ActivityEvent):
    # audit-trail only — store in a separate SQLite table; don't embed
    # (OpenChronicle's writer will promote these to Memory records separately)
    # TODO: write to a small SQLite table called `activities`
    return {"event_id": event.event_id, "stored": True}

@app.post("/memory/search")
def post_search(body: dict):
    return search_memories(
        body["query"],
        top_k=body.get("top_k", 5),
        filter=body.get("filter"),
    )

@app.get("/memory/{memory_id}")
def get_one(memory_id: str, include_history: bool = False):
    return get_memory(memory_id, include_history=include_history)

@app.get("/node/state")
def node_state():
    online = os.environ.get("RECALL_NETWORK_ONLINE", "true") == "true"
    status = NodeStatus.ONLINE if online else NodeStatus.OFFLINE
    # cloud_count filled by Task 03's get_cloud_count() — stub returns 0 for now
    cloud_count = 0
    try:
        from backend.sync.cloud import get_cloud_count
        import asyncio
        cloud_count = asyncio.get_event_loop().run_until_complete(get_cloud_count())
    except ImportError:
        pass
    return NodeState(
        node_id=os.environ.get("RECALL_NODE_ID", "edge-node-a"),
        status=status,
        local_memory_count=count_local(),
        cloud_memory_count=cloud_count,
        pending_sync_count=count_pending_sync(),
        private_count=count_private(),
    )

@app.post("/network/toggle")
def toggle_network(body: dict):
    os.environ["RECALL_NETWORK_ONLINE"] = "true" if body.get("online") else "false"
    return {"online": os.environ["RECALL_NETWORK_ONLINE"] == "true"}
```

### Hook into OpenChronicle (DO NOT DO THIS — orchestrator wires at integration)

You don't touch `src/openchronicle/`. But you DO document this in your PR description:

> "Integration seam: at Task 06, the orchestrator changes `src/openchronicle/store/fts.py`'s import line from `import fts` to `import backend.qdrant_local.store as fts`. OpenChronicle's writer then emits Memory records directly to Qdrant Edge. The orchestrator may also need to remove the file-storage sink (`store/files.py`) if both sinks cause double-writes."

---

## Acceptance criteria

- [ ] `pytest backend/qdrant_local/test_store.py` passes (write at least 5 tests: index, dedup, search, supersede preserves old, search returns only latest version)
- [ ] `pytest backend/api/test_server.py` passes (write at least 4 tests: post memory, search, get node state, toggle network)
- [ ] `uvicorn backend.api.server:app --reload` starts without errors on port 8000
- [ ] `curl -X POST http://localhost:8000/memories -H 'Content-Type: application/json' -d '{...valid Memory with memory_type=PROJECT...}'` returns `{stored: true, privacy: "syncable"}`
- [ ] Same call with `memory_type=USER` returns `{privacy: "private"}`
- [ ] Same call with `bundle_id=com.1password.7` (1Password override) returns `{privacy: "private"}` even if `memory_type=TOOL`
- [ ] Sending the same memory again returns `{stored: false, dedup: true}`
- [ ] `curl -X POST http://localhost:8000/memory/search -d '{"query": "what did I research about qdrant", "top_k": 5}'` returns top-5 results with scores
- [ ] `/node/state` returns valid `NodeState` with all 4 counts
- [ ] `/network/toggle` with `{online: false}` then `/node/state` shows `status: offline`
- [ ] **Search works when offline** — flip network off, search still returns results. (Killer demo behavior.)
- [ ] Supersede: index memory v1, then supersede with v2, then search returns v2 (not v1); `get_memory(v1_id, include_history=True)` returns both v1 and v2

---

## Forbidden moves

- ❌ Do not write any code in `backend/sync/` (Task 03's scope)
- ❌ Do not touch `backend/contracts.py` or `backend/policy.py` (frozen)
- ❌ Do not edit `src/openchronicle/store/fts.py` — the orchestrator wires the swap at integration
- ❌ Do not edit any other file in `src/openchronicle/`
- ❌ Do not edit `frontend/` or `scripts/`
- ❌ Do not implement the actual Qdrant Cloud sync — that's Task 03
- ❌ Do not call any real Qdrant Cloud URL — local mode only
- ❌ Do not add dependencies beyond what's in `pyproject.toml`

---

## Handoff contract

You expose to other modules:
- `backend.qdrant_local.store.index_memory(memory, bundle_id)` — Task 03 calls to mark `local_only=False` after cloud sync
- `backend.qdrant_local.store.get_pending_sync(limit)` — Task 03 calls from the sync loop
- `backend.qdrant_local.store.search_memories(query, top_k, filter)` — Task 04 calls via `/memory/search`
- `backend.qdrant_local.store.count_local/private/pending_sync` — Task 04 calls via `/node/state`
- REST endpoints on `:8000` — Task 04 consumes; Task 05 hits `/memories` and `/network/toggle`

You consume from other modules:
- `backend.sync.cloud.get_cloud_count()` — Task 03 exposes. You call it from `/node/state`. Stub returns 0 if not integrated.
- `backend.contracts.*` — frozen, from Task 01

---

## Demo-day alignment

The 24h demo beats that depend on YOU:
- **Beat 1:** Node status card shows `ONLINE · 248 local · 1,284 cloud · 0 pending · 47 private`. Judge asks "What did I research about Qdrant Edge yesterday?" — types in chat → top-1 result is the prior research session, with a privacy badge "SYNCABLE · EDGE+ CLOUD" and version "v2".
- **Beat 2:** Click "Go offline" — badge flips to OFFLINE (amber). Search STILL works. Top-1 result is the same prior session — but now the storage status panel shows "● EDGE ✓ LOCAL ✓ OFFLINE ○ CLOUD SYNCED".
- **Beat 3:** OpenChronicle captures new activity while offline → writer produces a new Memory → it lands in your store with `local_only=True` → node status shows `pending=1`. Reconnect → Task 03 drains the outbox → node status flips to `pending=0`.
- **Beat 4:** The privacy story — `private_count=47` in the node status never changes before/after sync. Those 47 PRIVATE memories stayed local. The SYNCABLE ones drained to cloud.
- **Beat 5:** Version story — the prior research memory has `version=2` (you researched it twice, OpenChronicle's supersede kicked in). Click "show history" → see v1 and v2 side by side.

---

## Done criteria for the PR

- [ ] All acceptance criteria pass
- [ ] `ruff check backend/qdrant_local/ backend/api/` is clean
- [ ] `pytest backend/qdrant_local/ backend/api/` is green
- [ ] No files outside `backend/qdrant_local/`, `backend/api/` were touched
- [ ] PR description contains: "Qdrant Edge in-process store. Mirrors OpenChronicle's fts.py API surface for one-line swap at integration. Privacy policy applied at ingest via policy.py. Supersede preserves old versions — DO NOT DELETE."
- [ ] PR description explicitly notes the integration seam: "Orchestrator changes `src/openchronicle/store/fts.py` import to `from backend.qdrant_local import store as fts` at Task 06."

---

# Dayflow Parity Endpoints — Tier 1 Addendum

> **Scope expansion.** Task 04 (`04-dashboard.md`) added 8 Dayflow-parity UI components. Each needs a backend endpoint. This addendum adds the 5 new endpoints you must implement. All are read-only aggregations of existing Qdrant data except `/capture/pause` and `/capture/resume` (which interact with OpenChronicle's daemon).

## New endpoints

| Method | Path                       | Query params       | Returns                                                                  |
| ------ | -------------------------- | ------------------ | ------------------------------------------------------------------------ |
| GET    | `/daily-summary`            | `?date=YYYY-MM-DD` | `{summary: str, top_apps: [{name, minutes}], focus_minutes: int, achievements: []}` |
| GET    | `/app-usage`                | `?range=today\|yesterday\|week\|month` | `{apps: [{app_name, minutes, bundle_id}]}` (top 5) |
| GET    | `/calendar-heatmap`         | `?days=14`         | `{days: [{date: "YYYY-MM-DD", count: int}]}`                            |
| GET    | `/projects`                 | —                  | `["project-name-1", "project-name-2", ...]` (distinct)                   |
| POST   | `/capture/pause`            | —                  | `{capturing: false}` — pauses OpenChronicle daemon (best-effort)          |
| POST   | `/capture/resume`           | —                  | `{capturing: true}` — resumes OpenChronicle daemon                       |

## Starter stubs (append to `backend/api/server.py`)

```python
from collections import Counter
from datetime import datetime, timedelta, timezone

@app.get("/daily-summary")
def daily_summary(date: str | None = None):
    """Auto-generated daily digest. For 24h: templated summary from session_reducer output.
    If Ollama available, optionally LLM-polish — stretch goal only."""
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # 1. fetch all memories where payload.timestamp is on target_date
    memories = _fetch_memories_for_date(target_date)
    # 2. compute top apps by memory count (proxy for time spent)
    app_counter = Counter(m.payload.get("provenance", {}).get("app_name", "Unknown") for m in memories)
    top_apps = [{"name": a, "minutes": c * 5} for a, c in app_counter.most_common(5)]  # 5 min per memory as a proxy
    # 3. focus_minutes = sum of session lengths from OpenChronicle's session table
    focus_minutes = _sum_session_minutes(target_date)  # TODO: query OpenChronicle's session table
    # 4. templated summary
    summary = _template_summary(target_date, memories, top_apps, focus_minutes)
    return {"summary": summary, "top_apps": top_apps, "focus_minutes": focus_minutes, "achievements": []}

@app.get("/app-usage")
def app_usage(range: str = "today"):
    """Top 5 apps by memory count (proxy for time)."""
    start_time = _range_to_start(range)  # today: midnight UTC; yesterday: 24h ago; week: 7d ago; month: 30d ago
    memories = _fetch_memories_since(start_time)
    app_counter = Counter(m.payload.get("provenance", {}).get("app_name", "Unknown") for m in memories)
    apps = [{"app_name": a, "minutes": c * 5, "bundle_id": None} for a, c in app_counter.most_common(5)]
    return {"apps": apps}

@app.get("/calendar-heatmap")
def calendar_heatmap(days: int = 14):
    """Daily memory counts for the heatmap strip."""
    today = datetime.now(timezone.utc).date()
    out = []
    for i in range(days):
        d = today - timedelta(days=days - i - 1)
        date_str = d.strftime("%Y-%m-%d")
        count = _count_memories_for_date(date_str)
        out.append({"date": date_str, "count": count})
    return {"days": out}

@app.get("/projects")
def projects():
    """Distinct project tags from memory provenance. For the ProjectTagFilter chip row."""
    # TODO: scroll all memories, collect distinct provenance.project values
    # For 24h: simple aggregation. If too slow, cache in a module-level set.
    ...

@app.post("/capture/pause")
def pause_capture():
    """Pause OpenChronicle daemon — best-effort. Dayflow privacy feature."""
    # If OpenChronicle exposes a pause API, call it. Else: stop the daemon process.
    # For 24h: simplest impl = write a flag file ~/.recall_pause_marker; the daemon polls it.
    import pathlib
    pathlib.Path.home().joinpath(".recall_pause_marker").touch()
    return {"capturing": False}

@app.post("/capture/resume")
def resume_capture():
    import pathlib
    marker = pathlib.Path.home().joinpath(".recall_pause_marker")
    if marker.exists():
        marker.unlink()
    return {"capturing": True}

# --- helpers ---
def _fetch_memories_for_date(date_str: str):
    # TODO: scroll Qdrant, filter by payload.timestamp.date() == date_str
    ...

def _fetch_memories_since(start: datetime):
    # TODO: scroll Qdrant, filter by payload.timestamp >= start
    ...

def _count_memories_for_date(date_str: str) -> int:
    # TODO: client.count() with filter on date
    ...

def _sum_session_minutes(date_str: str) -> int:
    # TODO: query OpenChronicle's session table (if exposed via its CLI/SQLite)
    # If not accessible, return 0 — don't break the demo
    return 0

def _range_to_start(range: str) -> datetime:
    now = datetime.now(timezone.utc)
    if range == "today":
        return now.replace(hour=0, minute=0, second=0, microsecond=0)
    if range == "yesterday":
        return now - timedelta(days=1)
    if range == "week":
        return now - timedelta(days=7)
    if range == "month":
        return now - timedelta(days=30)
    return now

def _template_summary(date_str: str, memories: list, top_apps: list, focus_minutes: int) -> str:
    """For 24h: simple templated summary. Dayflow does this with an LLM; we don't."""
    if not memories:
        return f"No activity recorded for {date_str}."
    app_names = [a["name"] for a in top_apps[:3]]
    return (f"On {date_str}, you captured {len(memories)} memories across "
            f"{len(set(m.payload.get('provenance', {}).get('app_name', 'Unknown') for m in memories))} apps. "
            f"Top apps: {', '.join(app_names)}. "
            f"Focus time: {focus_minutes} minutes.")
```

## Acceptance criteria (additions)

- [ ] `GET /daily-summary?date=2026-09-29` returns `{summary: "...", top_apps: [...], focus_minutes: int, achievements: []}`
- [ ] `GET /app-usage?range=today` returns `{apps: [...]}` with at most 5 entries, sorted by minutes desc
- [ ] `GET /calendar-heatmap?days=14` returns 14 entries with date + count
- [ ] `GET /projects` returns a string array (can be empty if no project-tagged memories)
- [ ] `POST /capture/pause` creates the `~/.recall_pause_marker` file, returns `{capturing: false}`
- [ ] `POST /capture/resume` removes the file, returns `{capturing: true}`
- [ ] If the daemon doesn't actually poll the marker file (it probably won't without modification), document this honestly in the PR — the marker file is a stub for the real pause behavior

## Honest scope note

- The `focus_minutes` field will likely return 0 in the 24h build (OpenChronicle's session table isn't trivially queryable). The dashboard will show "0m" — fine, judges don't notice. Don't gold-plate this.
- The capture pause/resume is a stub — the OpenChronicle daemon won't actually pause unless we modify its event loop. Document this in the PR description. For the demo, the pause button is a UI affordance that demonstrates the privacy feature; the actual pause behavior is a roadmap item.
- The LLM-polished daily summary is a stretch goal. For 24h: templated summary is fine. If you have Ollama running and 30 minutes of buffer, add it as an optional path.

