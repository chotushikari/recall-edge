"""Recall's local-first HTTP API."""
from __future__ import annotations

import os
import sqlite3
from asyncio import CancelledError, create_task
from contextlib import asynccontextmanager, suppress
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.contracts import ActivityEvent, Memory, NodeState, NodeStatus
from backend.qdrant_local import (
    clear_memories,
    count_local,
    count_private,
    get_memory,
    index_memory,
    list_memories,
    search_memories,
)
from backend.sync import (
    append_to_outbox,
    clear_outbox,
    get_cloud_count,
    get_latest_sync_result,
    get_pending_count,
    init_schema,
    run_sync_loop,
    sync_pending,
)

ACTIVITY_DB = Path(".recall_activities.db")


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int = Field(default=5, ge=1, le=25)
    filter: dict[str, Any] | None = None


class NetworkToggle(BaseModel):
    online: bool


def _init_activities() -> None:
    with sqlite3.connect(ACTIVITY_DB) as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS activities (event_id TEXT PRIMARY KEY, payload TEXT NOT NULL)")


@asynccontextmanager
async def recall_lifespan(_: FastAPI):
    from backend.qdrant_local.client import get_qdrant_client

    get_qdrant_client()
    _init_activities()
    init_schema()
    sync_task = create_task(run_sync_loop()) if os.environ.get("RECALL_SYNC_ENABLED", "true").lower() == "true" else None
    try:
        yield
    finally:
        if sync_task:
            sync_task.cancel()
            with suppress(CancelledError):
                await sync_task


app = FastAPI(title="Recall Edge API", version="0.1.0", lifespan=recall_lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/memories")
def post_memory(memory: Memory, bundle_id: str | None = None) -> dict[str, Any]:
    if memory.embedding is not None:
        raise HTTPException(status_code=400, detail="Embedding is computed server-side")
    try:
        memory_id, stored = index_memory(memory, bundle_id)
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    if stored:
        append_to_outbox(memory)
    return {"memory_id": memory_id, "dedup_key": memory.dedup_key, "stored": stored, "dedup": not stored, "privacy": memory.privacy}


@app.get("/memories")
def memories(limit: int = Query(default=100, ge=1, le=500)) -> list[dict[str, Any]]:
    return list_memories(limit)


@app.delete("/memories/all")
def delete_memories() -> dict[str, bool]:
    clear_memories()
    clear_outbox()
    return {"cleared": True}


@app.post("/activities")
def post_activity(event: ActivityEvent) -> dict[str, Any]:
    _init_activities()
    with sqlite3.connect(ACTIVITY_DB) as connection:
        connection.execute("INSERT OR IGNORE INTO activities (event_id, payload) VALUES (?, ?)", (event.event_id, event.model_dump_json()))
    return {"event_id": event.event_id, "stored": True}


@app.post("/memory/search")
def post_search(request: SearchRequest) -> list[dict[str, Any]]:
    return search_memories(request.query, request.top_k, request.filter)


@app.get("/memory/{memory_id}")
def memory(memory_id: str, include_history: bool = False) -> dict[str, Any]:
    try:
        return get_memory(memory_id, include_history)
    except KeyError as error:
        raise HTTPException(status_code=404, detail="Memory not found") from error


@app.get("/node/state")
def node_state() -> NodeState:
    online = os.environ.get("RECALL_NETWORK_ONLINE", "true").lower() == "true"
    return NodeState(
        node_id=os.environ.get("RECALL_NODE_ID", "edge-node-a"),
        status=NodeStatus.ONLINE if online else NodeStatus.OFFLINE,
        local_memory_count=count_local(),
        cloud_memory_count=get_cloud_count(),
        pending_sync_count=get_pending_count(),
        private_count=count_private(),
        last_seen_at=datetime.now(UTC),
    )


@app.post("/network/toggle")
def toggle_network(toggle: NetworkToggle) -> dict[str, bool]:
    os.environ["RECALL_NETWORK_ONLINE"] = str(toggle.online).lower()
    return {"online": toggle.online}


@app.post("/sync/run-now")
def run_sync_now() -> dict[str, Any]:
    """Attempt a single sync cycle; no cloud configuration leaves items queued."""
    return sync_pending().model_dump(mode="json")


@app.get("/sync/latest-result")
def latest_sync_result() -> dict[str, Any]:
    """Expose the most recent foreground or background sync attempt."""
    result = get_latest_sync_result()
    return result.model_dump(mode="json") if result else {"attempted": False}
