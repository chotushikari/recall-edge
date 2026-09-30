# Task 03 — Sync Engine (Codex agent in `wt-sync`)

> **Task ID:** 03
> **Worktree:** `../wt-sync` (branch `feat/sync`)
> **Scope boundary:** `backend/sync/`
> **Do NOT touch:** `backend/contracts.py`, `backend/policy.py`, `backend/qdrant_local/`, `backend/api/`, `src/openchronicle/`, `frontend/`, `scripts/`

---

## Your mission

Build the sync engine that takes Recall's local Qdrant memories and pushes eligible (non-private) ones to Qdrant Cloud when network returns. This is the demo's differentiator — every other team in the hackathon will demo RAG-on-Qdrant-Cloud. **You demo offline → remember → reconnect → sync → edge memory updated.**

1. Maintain a SQLite outbox table (`recall_sync.db`) of pending sync memories.
2. Expose `append_to_outbox(memory)` for Task 02 to call after each ingest (only for `privacy=SYNCABLE`).
3. Run a background sync loop (interval from env `RECALL_SYNC_INTERVAL_SECONDS=15`) that:
   - Reads a batch of memories from the outbox
   - Checks if network is online (`RECALL_NETWORK_ONLINE` env var)
   - Pushes the batch to Qdrant Cloud using the local→cloud sync pattern
   - Records the cloud response: `synced`, `already_existed`, `superseded_in_cloud`, `conflicts`
4. Handle supersede-in-cloud: if cloud has v1 and edge has v2, push v2 → cloud gets superseded. No conflict modal needed — just a version update.
5. Handle conflict (rare in 24h single-device demo): if cloud has a NEWER version than edge (means another device wrote first), log a `ConflictRecord` for human review. The dashboard shows a "v3 in cloud, v2 on edge" badge — no modal needed.
6. Expose `get_cloud_count()` and `get_pending_count()` for Task 02's `/node/state`.
7. **Memory-policy gate is critical:** PRIVATE memories NEVER enter the outbox. The sync engine refuses to push them.

You are **the demo's secret weapon** — the part no other team has. Build accordingly.

---

## Why Qdrant Edge is the protagonist here

The Edge → Cloud sync story IS the Qdrant Edge pitch. From the sponsor's product page:

> "Qdrant Edge brings the power of Qdrant to edge devices — in-process vector search with optional cloud sync."

"Optional cloud sync" is the demo beat. Your module proves it works end-to-end. The sponsor's smart-glasses PoC stops at offline search. **You take it the rest of the way** — offline search → reconnect → bidirectional sync → edge memory updated with cloud-side changes.

When a judge asks "what makes this not just RAG?", your module is the answer. RAG has no write path, no sync, no versioning. You have all three (OpenChronicle gives us versioning for free).

---

## Reuse pointers (read BEFORE writing code)

Spend ≤15 minutes here.

1. **`qdrant-labs/qdrant-client` → `examples/sync_local_to_cloud/`** (search: `gh search code 'sync_local_to_cloud' --repo qdrant-labs/qdrant-client`)
   - **This is your single source of truth.** It shows the exact API call to push from a local Qdrant collection to a cloud collection. Read it 3 times.
   - The example uses `client.upload_collection()` or `client.upsert()` against a cloud-configured `QdrantClient(url=..., api_key=...)`. We do the same.

2. **OpenChronicle → `src/openchronicle/writer/session_reducer.py`** — supersede semantics
   - **Read 3 times.** When you push a v2 memory to cloud and cloud already has v1, you must mark cloud's v1 as superseded — same way OpenChronicle does it locally. Don't re-implement; replicate the semantics on the cloud side.

3. **Outbox pattern reference**: https://microservices.io/patterns/data/transactional-outbox.html (first 2 paragraphs only)
   - The pattern: write to your local store AND to an outbox table in the same transaction; a separate worker drains the outbox. We're using SQLite, not Postgres, but the shape is identical.

4. **Idempotency keys — Stripe API docs**: https://stripe.com/docs/api/idempotent_requests (first 2 paragraphs)
   - Our `SyncBatch.idempotency_key` follows Stripe's semantics.

5. **`mem0ai/mem0` → `mem0/memory/main.py`** — note ABSENCE of sync
   - **Note that they have NO offline sync story.** This is the sponsor talking point: "mem0 (66k stars, the leading open-source memory layer) has no offline story. We do, on top of Qdrant Edge."

---

## Spec

### SQLite outbox schema (`backend/sync/schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS sync_outbox (
    memory_dedup_key TEXT PRIMARY KEY,
    memory_id TEXT NOT NULL,
    memory_json TEXT NOT NULL,           -- serialized Memory
    created_at TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    last_attempt_at TEXT,
    status TEXT DEFAULT 'pending'        -- 'pending' | 'synced' | 'superseded' | 'conflict' | 'failed'
);

CREATE TABLE IF NOT EXISTS conflicts (
    conflict_id TEXT PRIMARY KEY,
    memory_dedup_key TEXT NOT NULL,
    edge_version INTEGER,
    cloud_version INTEGER,
    detected_at TEXT NOT NULL,
    resolved INTEGER DEFAULT 0,
    resolution TEXT                       -- 'edge' | 'cloud' | null
);

CREATE INDEX IF NOT EXISTS idx_outbox_status ON sync_outbox(status);
CREATE INDEX IF NOT EXISTS idx_conflicts_unresolved ON conflicts(resolved) WHERE resolved = 0;
```

### Functions to expose

| Function                                       | Caller              | Behavior                                                |
| ---------------------------------------------- | ------------------- | ------------------------------------------------------- |
| `append_to_outbox(memory: Memory)`             | Task 02 (ingest)    | If `memory.privacy == PRIVATE`: NO-OP. Else: INSERT OR IGNORE. |
| `get_pending_count()`                          | Task 02 (api)       | `SELECT COUNT(*) FROM sync_outbox WHERE status='pending'` |
| `get_cloud_count()`                            | Task 02 (api)       | `client.count()` on cloud Qdrant (returns 0 if offline or URL unset) |
| `get_unresolved_conflicts()`                   | Task 04 (dashboard)| `SELECT * FROM conflicts WHERE resolved=0`               |
| `resolve_conflict(conflict_id, chosen_source)`| Task 04 (dashboard)| UPDATE conflicts. If chosen_source='edge': push local v to cloud. If 'cloud': pull cloud v to local. |

### Background sync loop

```python
# pseudocode (you implement in backend/sync/loop.py)
while True:
    if not is_network_online():
        await asyncio.sleep(interval)
        continue

    batch = read_outbox_batch(size=BATCH_SIZE)  # 50
    if not batch:
        await asyncio.sleep(interval)
        continue

    sync_batch = SyncBatch(
        node_id=NODE_ID,
        memory_dedup_keys=[b.memory_dedup_key for b in batch],
    )

    try:
        result = await push_batch_to_cloud(batch, sync_batch)
    except NetworkError:
        continue  # retry next loop, don't bump attempts

    # Process result
    for dk in result.synced:
        mark_outbox_status(dk, 'synced')
        # also mark the local Memory.local_only = False so the dashboard badge updates
        await set_local_only_false(dk)

    for dk in result.already_existed:
        mark_outbox_status(dk, 'synced')
        await set_local_only_false(dk)

    for dk in result.superseded_in_cloud:
        mark_outbox_status(dk, 'synced')
        await set_local_only_false(dk)

    for dk in result.conflicts:
        # Cloud has a newer version than edge — log it for human review
        detect_and_store_conflict(dk)
        mark_outbox_status(dk, 'conflict')
```

### Privacy gate (the killer PS03 piece)

```python
async def append_to_outbox(memory: Memory) -> None:
    """
    CRITICAL: PRIVATE memories never enter the outbox.
    This is the deterministic memory-policy in action.
    """
    if memory.privacy == PrivacyClass.PRIVATE:
        # Log that we deliberately skipped this — sponsor talking point
        logger.debug(f"Skipping sync for PRIVATE memory {memory.memory_id}")
        return
    # ... INSERT OR IGNORE into outbox
```

### Supersede-in-cloud (no conflict modal — just version bump)

When you push a memory with `version=2` and `supersedes=memory_id_v1` to cloud:
1. Check if cloud already has v1 (look up by `memory_id`).
2. If yes, mark cloud's v1 as superseded (set `superseded_by=new_memory_id`).
3. Upsert the v2.
4. Return in `SyncResult.superseded_in_cloud`.

This is just version propagation, not a real conflict. The demo beat shows "v1 → v2" badge in the dashboard.

### Real conflict (rare — usually means another device wrote first)

If cloud has `version=3` and edge pushes `version=2`, that's a conflict: cloud is ahead of edge. Log a `ConflictRecord`:
- `edge_version=2`, `cloud_version=3`, `detected_at=now`
- The dashboard shows a small badge: "⚠ v3 in cloud, v2 on edge — review"
- 24h: no modal. Just the badge + a one-line resolution "Accept Cloud" button that pulls v3 to local.

---

## Starter stub

### `backend/sync/__init__.py`
```python
from .outbox import append_to_outbox, get_pending_count, read_batch, mark_status
from .cloud import get_cloud_count, push_batch_to_cloud
from .conflicts import get_unresolved_conflicts, resolve_conflict, detect_and_store_conflict
from .loop import run_sync_loop
from .lifespan import recall_sync_lifespan

__all__ = [
    "append_to_outbox", "get_pending_count", "read_batch", "mark_status",
    "get_cloud_count", "push_batch_to_cloud",
    "get_unresolved_conflicts", "resolve_conflict", "detect_and_store_conflict",
    "run_sync_loop", "recall_sync_lifespan",
]
```

### `backend/sync/db.py` — write this
```python
"""SQLite connection for sync engine. Shared across outbox + conflicts."""
import aiosqlite
from backend.contracts import SYNC_OUTBOX_DB

async def get_db():
    # TODO: return aiosqlite connection. Initialize schema on first connect.
    ...

async def init_schema():
    # TODO: read backend/sync/schema.sql and execute
    ...
```

### `backend/sync/outbox.py` — write this
```python
"""Outbox: pending sync memories queue. PRIVACY GATE LIVES HERE."""
import json
from datetime import datetime, timezone
from backend.contracts import Memory, PrivacyClass
from .db import get_db

async def append_to_outbox(memory: Memory) -> None:
    """CRITICAL: PRIVATE memories never enter the outbox.
    This is the deterministic memory-policy engine in action."""
    if memory.privacy == PrivacyClass.PRIVATE:
        return  # NO-OP. The privacy gate.

    db = await get_db()
    await db.execute(
        "INSERT OR IGNORE INTO sync_outbox (memory_dedup_key, memory_id, memory_json, created_at, status) "
        "VALUES (?, ?, ?, ?, 'pending')",
        (memory.dedup_key, memory.memory_id, memory.model_dump_json(), datetime.now(timezone.utc).isoformat()),
    )
    await db.commit()

async def get_pending_count() -> int:
    # TODO
    ...

async def read_batch(size: int = 50):
    # TODO: SELECT memory_dedup_key, memory_id, memory_json FROM sync_outbox WHERE status='pending' LIMIT ?
    ...

async def mark_status(memory_dedup_key: str, status: str):
    # TODO: UPDATE sync_outbox SET status=? WHERE memory_dedup_key=?
    ...
```

### `backend/sync/cloud.py` — write this
```python
"""Qdrant Cloud client + batch push. Pattern adapted from
qdrant-client examples/sync_local_to_cloud (Apache-2.0)."""
import os
from qdrant_client import QdrantClient
from qdrant_client.http.models import PointStruct
from backend.contracts import COLLECTION_NAME, SyncBatch, SyncResult, Memory

_cloud_client: QdrantClient | None = None

def get_cloud_client() -> QdrantClient | None:
    global _cloud_client
    url = os.environ.get("RECALL_QDRANT_CLOUD_URL")
    api_key = os.environ.get("RECALL_QDRANT_CLOUD_API_KEY")
    if not url or not api_key:
        return None
    if _cloud_client is None:
        _cloud_client = QdrantClient(url=url, api_key=api_key)
    return _cloud_client

async def get_cloud_count() -> int:
    client = get_cloud_client()
    if client is None: return 0
    try:
        return client.count(COLLECTION_NAME).count
    except Exception:
        return 0

async def push_batch_to_cloud(batch, sync_batch: SyncBatch) -> SyncResult:
    """batch: list of (memory_dedup_key, memory_json).
    For each:
      1. fetch cloud version of memory_id (by payload.memory_id)
      2. if exists with same version → already_existed
      3. if exists with older version → mark cloud's record as superseded, upsert new → superseded_in_cloud
      4. if exists with newer version → conflict (log for human review)
      5. if not exists → upsert → synced
    Use idempotency_key for retries.
    """
    client = get_cloud_client()
    if client is None:
        # No cloud configured — return empty result; outbox items stay 'pending'
        return SyncResult(batch_id=sync_batch.batch_id)
    # TODO: implement per the contract above
    ...

async def set_local_only_false(memory_dedup_key: str) -> None:
    """After successful sync, mark local Memory.local_only=False so dashboard badge updates."""
    from backend.qdrant_local.client import get_qdrant_client
    from backend.qdrant_local.store import get_memory, index_memory
    # TODO: fetch local memory by dedup_key, set local_only=False, upsert back
    ...
```

### `backend/sync/conflicts.py` — write this
```python
"""Conflict detection + resolution. 24h scope: simple version comparison."""
from .db import get_db
from backend.contracts import ConflictRecord, Resolution

async def detect_and_store_conflict(memory_dedup_key: str, edge_version: int, cloud_version: int) -> str:
    """Cloud has a newer version than edge. Log for human review."""
    # TODO: INSERT into conflicts table, return conflict_id
    ...

async def get_unresolved_conflicts() -> list[dict]:
    # TODO: SELECT * FROM conflicts WHERE resolved=0
    ...

async def resolve_conflict(conflict_id: str, chosen_source: str, resolved_by: str) -> None:
    """chosen_source = 'edge' or 'cloud'.
    If 'edge': push local version to cloud (cloud gets downgraded — rare).
    If 'cloud': pull cloud version to local (edge gets upgraded — common when another device wrote first)."""
    # TODO: implement
    ...
```

### `backend/sync/loop.py` — write this
```python
"""Background sync loop. Run as a FastAPI startup task."""
import asyncio
import os
from .outbox import read_batch, mark_status
from .cloud import push_batch_to_cloud, set_local_only_false
from .conflicts import detect_and_store_conflict
from backend.contracts import SyncBatch

async def run_sync_loop():
    interval = int(os.environ.get("RECALL_SYNC_INTERVAL_SECONDS", "15"))
    batch_size = int(os.environ.get("RECALL_SYNC_BATCH_SIZE", "50"))

    while True:
        online = os.environ.get("RECALL_NETWORK_ONLINE", "true") == "true"
        if not online:
            await asyncio.sleep(interval)
            continue

        batch = await read_batch(batch_size)
        if not batch:
            await asyncio.sleep(interval)
            continue

        sync_batch = SyncBatch(
            node_id=os.environ.get("RECALL_NODE_ID", "edge-node-a"),
            memory_dedup_keys=[b[0] for b in batch],
        )

        try:
            result = await push_batch_to_cloud(batch, sync_batch)
        except Exception:
            continue  # retry next loop

        for dk in result.synced:
            await mark_status(dk, "synced")
            await set_local_only_false(dk)
        for dk in result.already_existed:
            await mark_status(dk, "synced")
            await set_local_only_false(dk)
        for dk in result.superseded_in_cloud:
            await mark_status(dk, "synced")
            await set_local_only_false(dk)
        for dk in result.conflicts:
            # cloud version > edge version — log for human review
            await detect_and_store_conflict(dk, edge_version=..., cloud_version=...)
            await mark_status(dk, "conflict")
```

### `backend/sync/lifespan.py` — write this
```python
"""FastAPI lifespan that initializes the sync DB + starts the loop.
The orchestrator will REPLACE Task 02's lifespan with this one at integration
(Task 06) — both call get_qdrant_client() AND init the sync loop."""
from contextlib import asynccontextmanager
import asyncio
from .db import init_schema
from .loop import run_sync_loop

@asynccontextmanager
async def recall_sync_lifespan(app):
    await init_schema()
    # warm qdrant client
    from backend.qdrant_local.client import get_qdrant_client
    get_qdrant_client()
    # start sync loop
    task = asyncio.create_task(run_sync_loop())
    yield
    task.cancel()
```

---

## Acceptance criteria

- [ ] `pytest backend/sync/test_outbox.py` passes (write at least 5 tests: append is idempotent; PRIVATE memory NEVER enters outbox; SYNCABLE memory enters outbox; count is accurate; read_batch returns correct order; mark_status updates)
- [ ] `pytest backend/sync/test_conflicts.py` passes (write at least 3 tests: detect conflict when cloud version > edge version; resolve with chosen_source='cloud'; resolve with chosen_source='edge')
- [ ] `pytest backend/sync/test_loop.py` passes (write at least 2 tests: loop skips when offline; loop processes batch when online)
- [ ] **The privacy gate test:** append a PRIVATE memory → outbox count stays 0. Append a SYNCABLE memory → outbox count goes to 1.
- [ ] `init_schema()` runs without errors on a fresh SQLite DB
- [ ] `run_sync_loop()` does NOT crash when Qdrant Cloud URL is unset (returns gracefully — outbox items stay 'pending')
- [ ] `run_sync_loop()` does NOT crash when network is offline (sleeps + retries)
- [ ] After `push_batch_to_cloud()` succeeds, the corresponding local memory's `local_only` field is set to False (dashboard badge updates)

---

## Forbidden moves

- ❌ Do not edit `backend/api/server.py` — you write `backend/sync/lifespan.py` and document the wiring for the orchestrator
- ❌ Do not edit `backend/qdrant_local/` — Task 02 owns it; you only consume their `get_qdrant_client()` and store functions
- ❌ Do not edit `backend/contracts.py` or `backend/policy.py` (frozen)
- ❌ Do not push PRIVATE memories to cloud — the privacy gate is non-negotiable
- ❌ Do not actually kill network interfaces (`iptables`, `tc`, `nmcli`) — the `RECALL_NETWORK_ONLINE` env var is the kill-switch
- ❌ Do not implement CRDT or auto-resolution beyond the 24h scope (HUMAN_REVIEW for version conflicts; latest-wins for everything else)
- ❌ Do not add new dependencies

---

## Handoff contract

You expose:
- `backend.sync.append_to_outbox(memory)` — Task 02 calls after each ingest
- `backend.sync.get_pending_count()`, `get_cloud_count()` — Task 02 calls from `/node/state`
- `backend.sync.get_unresolved_conflicts()` — Task 04 calls for the conflict badge
- `backend.sync.resolve_conflict(...)` — Task 04 calls when human picks
- `backend.sync.lifespan.recall_sync_lifespan` — orchestrator wires into FastAPI at integration

You consume:
- `backend.qdrant_local.client.get_qdrant_client()` — for reading local memories to compare against cloud
- `backend.qdrant_local.store.get_memory(memory_id)` — for fetching local version
- `backend.contracts.SyncBatch`, `SyncResult`, `Memory`, `PrivacyClass` — from Task 01 (frozen)

---

## Demo-day alignment

The 24h demo beats that depend on YOU:
- **Beat 3:** "Add new memory offline → reconnect → 5 new / 3 synced / 2 dedup / 0 conflicts" — your loop produces the 3/2/0 split.
- **Beat 4 (privacy story):** "47 private memories stayed local; 5 syncable memories synced to cloud." Your privacy gate is what makes this honest. The `private_count` in the node state NEVER changes before/after sync — it's the proof point.
- **Beat 5 (version story):** "I researched Qdrant Edge twice — v1 → v2. Cloud now has v2." Your supersede-in-cloud logic makes this work.

The dedup story is what makes "already existed" honest. Your `INSERT OR IGNORE` on `memory_dedup_key` + your cloud-side "if same payload, mark already_existed" is the entire honesty guarantee.

---

## Done criteria for the PR

- [ ] All acceptance criteria pass
- [ ] `ruff check backend/sync/` is clean
- [ ] `pytest backend/sync/` is green
- [ ] No files outside `backend/sync/` were touched
- [ ] PR description contains: "Sync engine is the demo's differentiator. Adapted from qdrant-client sync_local_to_cloud example. Implements outbox + idempotency + supersede-in-cloud + privacy gate. HUMAN_REVIEW for real version conflicts (rare in single-device 24h scope)."
- [ ] PR description explicitly notes the lifespan wiring needed at integration: "Task 02's lifespan in `backend/api/server.py` must be REPLACED with `recall_sync_lifespan` from `backend/sync/lifespan.py` at Task 06. Orchestrator wires this."
- [ ] PR description contains the privacy-gate test result: "PRIVATE memory → outbox count stays 0 ✓. SYNCABLE memory → outbox count goes to 1 ✓."
