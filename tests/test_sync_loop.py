import asyncio

import pytest

from backend.contracts import SyncResult
from backend.sync.loop import run_sync_loop


@pytest.mark.asyncio
async def test_sync_loop_attempts_sync_when_online(monkeypatch) -> None:
    called = asyncio.Event()

    def fake_sync_pending() -> SyncResult:
        called.set()
        return SyncResult(batch_id="test")

    monkeypatch.setenv("RECALL_NETWORK_ONLINE", "true")
    monkeypatch.setenv("RECALL_SYNC_INTERVAL_SECONDS", "60")
    monkeypatch.setattr("backend.sync.loop.sync_pending", fake_sync_pending)
    stop_event = asyncio.Event()
    task = asyncio.create_task(run_sync_loop(stop_event))
    await asyncio.wait_for(called.wait(), timeout=1)
    stop_event.set()
    await asyncio.wait_for(task, timeout=1)


@pytest.mark.asyncio
async def test_sync_loop_skips_sync_when_offline(monkeypatch) -> None:
    called = False

    def fake_sync_pending() -> SyncResult:
        nonlocal called
        called = True
        return SyncResult(batch_id="test")

    monkeypatch.setenv("RECALL_NETWORK_ONLINE", "false")
    monkeypatch.setenv("RECALL_SYNC_INTERVAL_SECONDS", "60")
    monkeypatch.setattr("backend.sync.loop.sync_pending", fake_sync_pending)
    stop_event = asyncio.Event()
    task = asyncio.create_task(run_sync_loop(stop_event))
    await asyncio.sleep(0.02)
    stop_event.set()
    await asyncio.wait_for(task, timeout=1)
    assert not called
