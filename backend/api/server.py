"""Recall's local-first HTTP API."""
from __future__ import annotations

import os
import sqlite3
from asyncio import CancelledError, create_task
from contextlib import asynccontextmanager, suppress
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.activity_collector import LocalActivityCollector
from backend.activity_collector.windows import is_supported as windows_collector_supported
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
    get_unresolved_conflicts,
    init_schema,
    run_sync_loop,
    sync_pending,
)
from openchronicle import paths as openchronicle_paths

load_dotenv()

ACTIVITY_DB = Path(".recall_activities.db")
CAPTURE_PAUSE_MARKER = openchronicle_paths.paused_flag()
ACTIVITY_COLLECTOR: LocalActivityCollector | None = None


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int = Field(default=5, ge=1, le=25)
    filter: dict[str, Any] | None = None


class NetworkToggle(BaseModel):
    online: bool


class ActivityCaptureControl(BaseModel):
    interval_seconds: float = Field(default=3.0, ge=0.5, le=60.0)
    heartbeat_seconds: float = Field(default=60.0, ge=1.0, le=3_600.0)


def _init_activities() -> None:
    with sqlite3.connect(ACTIVITY_DB) as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS activities (event_id TEXT PRIMARY KEY, payload TEXT NOT NULL)")


def _activity_history(start: datetime | None = None, limit: int = 500) -> list[dict[str, Any]]:
    """Read locally stored raw activity events, newest first."""
    _init_activities()
    with sqlite3.connect(ACTIVITY_DB) as connection:
        rows = connection.execute("SELECT payload FROM activities").fetchall()
    events = [ActivityEvent.model_validate_json(row[0]).model_dump(mode="json") for row in rows]
    if start is not None:
        events = [event for event in events if _timestamp(event) >= start]
    return sorted(events, key=_timestamp, reverse=True)[:limit]


def _store_activity(event: ActivityEvent) -> None:
    _init_activities()
    with sqlite3.connect(ACTIVITY_DB) as connection:
        connection.execute("INSERT OR IGNORE INTO activities (event_id, payload) VALUES (?, ?)", (event.event_id, event.model_dump_json()))


def _timestamp(value: dict[str, Any]) -> datetime:
    return datetime.fromisoformat(str(value["timestamp"]).replace("Z", "+00:00"))


def _app_name(memory: dict[str, Any]) -> str:
    provenance = memory.get("provenance") or {}
    return str(provenance.get("app_name") or provenance.get("bundle_id") or "Local")


def _range_start(range_name: str) -> datetime:
    now = datetime.now(UTC)
    midnight = datetime.combine(now.date(), datetime.min.time(), tzinfo=UTC)
    starts = {
        "today": midnight,
        "yesterday": midnight - timedelta(days=1),
        "week": midnight - timedelta(days=6),
        "month": midnight - timedelta(days=29),
    }
    if range_name not in starts:
        raise HTTPException(status_code=400, detail="range must be today, yesterday, week, or month")
    return starts[range_name]


def _range_memories(start: datetime, end: datetime | None = None) -> list[dict[str, Any]]:
    return [
        memory
        for memory in list_memories(limit=10_000)
        if _timestamp(memory) >= start and (end is None or _timestamp(memory) < end)
    ]


@asynccontextmanager
async def recall_lifespan(_: FastAPI):
    from backend.qdrant_local.client import get_qdrant_client

    get_qdrant_client()
    _init_activities()
    init_schema()
    global ACTIVITY_COLLECTOR
    ACTIVITY_COLLECTOR = LocalActivityCollector(_store_activity)
    sync_task = create_task(run_sync_loop()) if os.environ.get("RECALL_SYNC_ENABLED", "true").lower() == "true" else None
    try:
        yield
    finally:
        ACTIVITY_COLLECTOR.stop()
        ACTIVITY_COLLECTOR = None
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
    _store_activity(event)
    return {"event_id": event.event_id, "stored": True}


@app.get("/activities/history")
def activity_history(
    range: str = "today",
    limit: int = Query(default=500, ge=1, le=5_000),
) -> list[dict[str, Any]]:
    """Return local foreground-window history; raw activity never enters cloud sync."""
    return _activity_history(_range_start(range), limit)


@app.delete("/activities/all")
def clear_activities() -> dict[str, bool]:
    """Clear all locally stored raw activity history on this device."""
    _init_activities()
    with sqlite3.connect(ACTIVITY_DB) as connection:
        connection.execute("DELETE FROM activities")
    return {"cleared": True}


@app.get("/activities/capabilities")
def activity_capabilities() -> dict[str, Any]:
    """Make the platform boundary and browser-data policy visible to the UI."""
    return {
        "foreground_window_collector": windows_collector_supported(),
        "browser_tabs": "foreground browser tab title is captured with its window",
        "browser_urls": "not available without browser permission",
        "screenshots": False,
        "keystrokes": False,
        "storage": "local only",
    }


@app.get("/activities/capture/status")
def activity_capture_status() -> dict[str, Any]:
    return {"supported": windows_collector_supported(), "capturing": bool(ACTIVITY_COLLECTOR and ACTIVITY_COLLECTOR.running)}


@app.post("/activities/capture/start")
def start_activity_capture(control: ActivityCaptureControl) -> dict[str, Any]:
    if ACTIVITY_COLLECTOR is None:
        raise HTTPException(status_code=503, detail="Activity collector is not initialized")
    ACTIVITY_COLLECTOR.start(
        interval_seconds=control.interval_seconds,
        heartbeat_seconds=control.heartbeat_seconds,
    )
    return activity_capture_status()


@app.post("/activities/capture/stop")
def stop_activity_capture() -> dict[str, Any]:
    if ACTIVITY_COLLECTOR is not None:
        ACTIVITY_COLLECTOR.stop()
    return activity_capture_status()


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


@app.get("/sync/conflicts")
def sync_conflicts() -> list[dict[str, object]]:
    """List cloud-version conflicts that require a human decision."""
    return get_unresolved_conflicts()


@app.get("/daily-summary")
def daily_summary(
    summary_date: date | None = Query(default=None, alias="date"),  # noqa: B008
) -> dict[str, Any]:
    """Return a deterministic daily digest without sending activity to an LLM."""
    target = summary_date or datetime.now(UTC).date()
    start = datetime.combine(target, datetime.min.time(), tzinfo=UTC)
    memories = _range_memories(start, start + timedelta(days=1))
    counts: dict[str, int] = {}
    for memory in memories:
        app_name = _app_name(memory)
        counts[app_name] = counts.get(app_name, 0) + 1
    top_apps = [
        {"name": name, "minutes": count * 5}
        for name, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:5]
    ]
    summary = (
        f"No recorded memories for {target.isoformat()}."
        if not memories
        else f"Captured {len(memories)} memories across {len(counts)} apps on {target.isoformat()}."
    )
    return {"summary": summary, "top_apps": top_apps, "focus_minutes": 0, "achievements": []}


@app.get("/app-usage")
def app_usage(range: str = "today") -> dict[str, list[dict[str, Any]]]:
    """Aggregate recent memory activity into an explicitly approximate time proxy."""
    start = _range_start(range)
    end = _range_start("today") if range == "yesterday" else None
    counts: dict[tuple[str, str | None], int] = {}
    for memory in _range_memories(start, end):
        provenance = memory.get("provenance") or {}
        key = (_app_name(memory), provenance.get("bundle_id"))
        counts[key] = counts.get(key, 0) + 1
    apps = [
        {"app_name": name, "minutes": count * 5, "bundle_id": bundle_id}
        for (name, bundle_id), count in sorted(counts.items(), key=lambda item: (-item[1], item[0][0]))[:5]
    ]
    return {"apps": apps}


@app.get("/calendar-heatmap")
def calendar_heatmap(days: int = Query(default=14, ge=1, le=31)) -> dict[str, list[dict[str, Any]]]:
    """Return a compact recent-day activity histogram for the dashboard heatmap."""
    today = datetime.now(UTC).date()
    all_memories = list_memories(limit=10_000)
    result = []
    for offset in range(days - 1, -1, -1):
        current = today - timedelta(days=offset)
        result.append(
            {
                "date": current.isoformat(),
                "count": sum(1 for memory in all_memories if _timestamp(memory).date() == current),
            }
        )
    return {"days": result}


@app.get("/projects")
def projects() -> list[str]:
    """List distinct provenance project tags available for timeline filtering."""
    return sorted(
        {
            str(project)
            for memory in list_memories(limit=10_000)
            if (project := (memory.get("provenance") or {}).get("project"))
        }
    )


@app.get("/capture/status")
def capture_status() -> dict[str, Any]:
    return {"capturing": not CAPTURE_PAUSE_MARKER.exists(), "enforcement": "daemon"}


@app.post("/capture/pause")
def pause_capture() -> dict[str, Any]:
    """Pause the OpenChronicle scheduler through its native pause marker."""
    CAPTURE_PAUSE_MARKER.parent.mkdir(parents=True, exist_ok=True)
    CAPTURE_PAUSE_MARKER.touch()
    return {"capturing": False, "enforcement": "daemon"}


@app.post("/capture/resume")
def resume_capture() -> dict[str, Any]:
    if CAPTURE_PAUSE_MARKER.exists():
        CAPTURE_PAUSE_MARKER.unlink()
    return {"capturing": True, "enforcement": "daemon"}
