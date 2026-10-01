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
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from backend.activity_collector import LocalActivityCollector
from backend.activity_collector.windows import foreground_activity
from backend.activity_collector.windows import is_supported as windows_collector_supported
from backend.contracts import ActivityEvent, Memory, NodeState, NodeStatus
from backend.evidence_store import EvidenceStore
from backend.qdrant_local import (
    clear_memories,
    count_local,
    count_private,
    get_memory,
    index_memory,
    list_memories,
    search_memories,
)
from backend.screen_capture import (
    CapturePolicy,
    FrameRetentionService,
    MssScreenSource,
    ScreenCaptureService,
    VisualCaptureCollector,
)
from backend.sessionizer import build_sessions
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
EVIDENCE_DB = Path(".recall.db")
FRAMES_DIR = Path(".recall_frames")
CAPTURE_PAUSE_MARKER = openchronicle_paths.paused_flag()
ACTIVITY_COLLECTOR: LocalActivityCollector | None = None
VISUAL_CAPTURE_COLLECTOR: VisualCaptureCollector | None = None


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    top_k: int = Field(default=5, ge=1, le=25)
    filter: dict[str, Any] | None = None


class NetworkToggle(BaseModel):
    online: bool


class ActivityCaptureControl(BaseModel):
    interval_seconds: float = Field(default=3.0, ge=0.5, le=60.0)
    heartbeat_seconds: float = Field(default=60.0, ge=1.0, le=3_600.0)


class VisualCaptureControl(BaseModel):
    """Visual capture must be explicitly acknowledged for each runtime start."""

    confirm_visual_capture: bool = False
    interval_seconds: float = Field(default=15.0, ge=1.0, le=300.0)
    excluded_applications: list[str] = Field(default_factory=list)
    excluded_window_terms: list[str] = Field(default_factory=list)


class RetentionPruneControl(BaseModel):
    retention_days: int = Field(ge=1, le=3_650)


class ConfirmDeleteControl(BaseModel):
    confirm_delete: bool = False


def _init_activities() -> None:
    with sqlite3.connect(ACTIVITY_DB) as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS activities (event_id TEXT PRIMARY KEY, payload TEXT NOT NULL)")


def _evidence_store() -> EvidenceStore:
    return EvidenceStore(EVIDENCE_DB)


def _activity_history(start: datetime | None = None, limit: int = 500) -> list[dict[str, Any]]:
    """Read locally stored raw activity events, newest first."""
    _init_activities()
    with sqlite3.connect(ACTIVITY_DB) as connection:
        rows = connection.execute("SELECT payload FROM activities").fetchall()
    events = [ActivityEvent.model_validate_json(row[0]).model_dump(mode="json") for row in rows]
    if start is not None:
        events = [event for event in events if _timestamp(event) >= start]
    return sorted(events, key=_timestamp, reverse=True)[:limit]


def _activity_usage(start: datetime, end: datetime | None = None) -> list[dict[str, Any]]:
    """Calculate bounded foreground durations from local collector heartbeats."""
    end = end or datetime.now(UTC)
    events = sorted(_activity_history(limit=100_000), key=_timestamp)
    seconds_by_app: dict[tuple[str, str | None], float] = {}
    for index, event in enumerate(events):
        timestamp = _timestamp(event)
        next_timestamp = _timestamp(events[index + 1]) if index + 1 < len(events) else end
        interval_start = max(timestamp, start)
        interval_end = min(next_timestamp, end)
        # A stopped collector must not turn an old heartbeat into hours of activity.
        seconds = min(max((interval_end - interval_start).total_seconds(), 0), 300)
        if seconds:
            key = (event["app_name"], event.get("bundle_id"))
            seconds_by_app[key] = seconds_by_app.get(key, 0) + seconds
    return [
        {"app_name": name, "minutes": max(1, round(seconds / 60)), "bundle_id": bundle_id, "source": "activity"}
        for (name, bundle_id), seconds in sorted(seconds_by_app.items(), key=lambda item: (-item[1], item[0][0]))
    ]


def _store_activity(event: ActivityEvent) -> None:
    _init_activities()
    with sqlite3.connect(ACTIVITY_DB) as connection:
        connection.execute("INSERT OR IGNORE INTO activities (event_id, payload) VALUES (?, ?)", (event.event_id, event.model_dump_json()))
    _evidence_store().record_activity(event)


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
    global ACTIVITY_COLLECTOR, VISUAL_CAPTURE_COLLECTOR
    ACTIVITY_COLLECTOR = LocalActivityCollector(_store_activity)
    sync_task = create_task(run_sync_loop()) if os.environ.get("RECALL_SYNC_ENABLED", "true").lower() == "true" else None
    try:
        yield
    finally:
        ACTIVITY_COLLECTOR.stop()
        ACTIVITY_COLLECTOR = None
        if VISUAL_CAPTURE_COLLECTOR is not None:
            VISUAL_CAPTURE_COLLECTOR.stop()
        VISUAL_CAPTURE_COLLECTOR = None
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
    _evidence_store().clear_history()
    return {"cleared": True}


@app.get("/evidence/events")
def evidence_events(
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(default=500, ge=1, le=5_000),
) -> list[dict[str, Any]]:
    """Read normalized local evidence; it is never sent to cloud sync."""
    return _evidence_store().list_events(start=start, end=end, limit=limit)


@app.get("/evidence/frames/search")
def evidence_frame_search(
    query: str = Query(min_length=1),
    start: datetime | None = None,
    limit: int = Query(default=50, ge=1, le=500),
) -> list[dict[str, Any]]:
    """Search local frame titles/OCR text. Raw images remain on this device."""
    return _evidence_store().search_frames(query, start=start, limit=limit)


def _owned_frame_path(frame: dict[str, object]) -> Path | None:
    """Resolve a frame only when it remains inside Recall's frame directory."""
    try:
        path = Path(str(frame["path"])).resolve()
        path.relative_to(FRAMES_DIR.resolve())
    except (KeyError, OSError, ValueError):
        return None
    return path if path.is_file() else None


@app.get("/evidence/frames")
def evidence_frames(
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(default=100, ge=1, le=500),
) -> list[dict[str, object]]:
    """List local frame metadata without exposing filesystem paths."""
    frames: list[dict[str, object]] = []
    for frame in _evidence_store().list_frames(start=start, end=end, limit=limit):
        if _owned_frame_path(frame) is None:
            continue
        frames.append(
            {key: value for key, value in frame.items() if key != "path"}
            | {"image_url": f"/evidence/frames/{frame['id']}"}
        )
    return frames


@app.get("/evidence/frames/{frame_id}")
def evidence_frame_image(frame_id: str) -> FileResponse:
    frame = _evidence_store().get_frame(frame_id)
    path = _owned_frame_path(frame) if frame is not None else None
    if path is None:
        raise HTTPException(status_code=404, detail="Local frame not found")
    return FileResponse(path)


@app.post("/sessions/rebuild")
def rebuild_sessions(
    start: datetime | None = None,
    end: datetime | None = None,
    gap_seconds: int = Query(default=300, ge=30, le=3_600),
) -> dict[str, int]:
    """Reconstruct durable activity blocks from local raw evidence."""
    store = _evidence_store()
    sessions = build_sessions(store.list_events(start=start, end=end, limit=100_000), gap_seconds=gap_seconds)
    store.save_sessions(sessions)
    return {"sessions_rebuilt": len(sessions)}


@app.get("/sessions")
def sessions(
    start: datetime | None = None,
    end: datetime | None = None,
    limit: int = Query(default=500, ge=1, le=5_000),
) -> list[dict[str, object]]:
    """Return saved, evidence-linked activity sessions for the timeline."""
    return _evidence_store().list_sessions(start=start, end=end, limit=limit)


def _frame_retention() -> FrameRetentionService:
    return FrameRetentionService(store=_evidence_store(), frames_dir=FRAMES_DIR)


@app.post("/evidence/retention/prune")
def prune_evidence_retention(control: RetentionPruneControl) -> dict[str, int]:
    """Delete local frame evidence older than the user-selected retention window."""
    cutoff = datetime.now(UTC) - timedelta(days=control.retention_days)
    return {"frames_deleted": _frame_retention().prune_before(cutoff)}


@app.delete("/evidence/all")
def delete_all_local_evidence(control: ConfirmDeleteControl) -> dict[str, int | bool]:
    """Explicit local-only wipe; remote copies require separate cloud deletion."""
    if not control.confirm_delete:
        raise HTTPException(status_code=409, detail="Local wipe requires confirm_delete=true.")
    global VISUAL_CAPTURE_COLLECTOR
    if VISUAL_CAPTURE_COLLECTOR is not None:
        VISUAL_CAPTURE_COLLECTOR.stop()
    frames_deleted = _frame_retention().clear()
    _evidence_store().clear_history()
    _init_activities()
    with sqlite3.connect(ACTIVITY_DB) as connection:
        connection.execute("DELETE FROM activities")
    clear_memories()
    clear_outbox()
    return {"cleared": True, "frames_deleted": frames_deleted}


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


@app.get("/visual-capture/status")
def visual_capture_status() -> dict[str, Any]:
    return {
        "supported": windows_collector_supported(),
        "capturing": bool(VISUAL_CAPTURE_COLLECTOR and VISUAL_CAPTURE_COLLECTOR.running),
        "storage": "local only",
        "requires_explicit_confirmation": True,
    }


@app.post("/visual-capture/start")
def start_visual_capture(control: VisualCaptureControl) -> dict[str, Any]:
    """Start visual capture only after an explicit API/UI confirmation."""
    if not control.confirm_visual_capture:
        raise HTTPException(
            status_code=409,
            detail="Visual capture is disabled until confirm_visual_capture is true.",
        )
    if not windows_collector_supported():
        raise HTTPException(status_code=501, detail="Visual capture is currently supported on Windows only.")
    global VISUAL_CAPTURE_COLLECTOR
    defaults = CapturePolicy()
    policy = CapturePolicy(
        excluded_applications=tuple(
            dict.fromkeys((*defaults.excluded_applications, *control.excluded_applications))
        ),
        excluded_window_terms=tuple(
            dict.fromkeys((*defaults.excluded_window_terms, *control.excluded_window_terms))
        ),
    )
    service = ScreenCaptureService(
        store=_evidence_store(),
        frames_dir=FRAMES_DIR,
        source=MssScreenSource(),
        policy=policy,
    )
    if VISUAL_CAPTURE_COLLECTOR is None:
        VISUAL_CAPTURE_COLLECTOR = VisualCaptureCollector(
            service=service,
            activity=foreground_activity,
            is_paused=lambda: CAPTURE_PAUSE_MARKER.exists(),
        )
    VISUAL_CAPTURE_COLLECTOR.start(interval_seconds=control.interval_seconds)
    return visual_capture_status()


@app.post("/visual-capture/stop")
def stop_visual_capture() -> dict[str, Any]:
    if VISUAL_CAPTURE_COLLECTOR is not None:
        VISUAL_CAPTURE_COLLECTOR.stop()
    return visual_capture_status()


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
    end = start + timedelta(days=1)
    memories = _range_memories(start, end)
    activity_apps = _activity_usage(start, end)
    counts: dict[str, int] = {}
    for memory in memories:
        app_name = _app_name(memory)
        counts[app_name] = counts.get(app_name, 0) + 1
    memory_apps = [
        {"name": name, "minutes": count * 5}
        for name, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:5]
    ]
    top_apps = [{"name": app["app_name"], "minutes": app["minutes"]} for app in activity_apps[:5]] or memory_apps
    summary = (
        f"No recorded memories for {target.isoformat()}."
        if not memories
        else f"Captured {len(memories)} memories across {len(counts)} apps on {target.isoformat()}."
    )
    return {"summary": summary, "top_apps": top_apps, "focus_minutes": sum(app["minutes"] for app in activity_apps), "achievements": []}


@app.get("/app-usage")
def app_usage(range: str = "today") -> dict[str, list[dict[str, Any]]]:
    """Aggregate recent memory activity into an explicitly approximate time proxy."""
    start = _range_start(range)
    end = _range_start("today") if range == "yesterday" else None
    activity_apps = _activity_usage(start, end)
    if activity_apps:
        return {"apps": activity_apps[:5]}
    counts: dict[tuple[str, str | None], int] = {}
    for memory in _range_memories(start, end):
        provenance = memory.get("provenance") or {}
        key = (_app_name(memory), provenance.get("bundle_id"))
        counts[key] = counts.get(key, 0) + 1
    apps = [
        {"app_name": name, "minutes": count * 5, "bundle_id": bundle_id, "source": "memory_estimate"}
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
