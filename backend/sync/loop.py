"""Background worker that drains the sync outbox without blocking the API."""
from __future__ import annotations

import asyncio
import os
from contextlib import suppress

from backend.sync.cloud import sync_pending


def _interval_seconds() -> float:
    return max(float(os.environ.get("RECALL_SYNC_INTERVAL_SECONDS", "15")), 0.1)


async def run_sync_loop(stop_event: asyncio.Event | None = None) -> None:
    """Attempt sync on a fixed interval until cancelled or explicitly stopped.

    The synchronous Qdrant client runs in a worker thread. Failures deliberately
    leave rows pending so the next interval can retry without losing evidence.
    """
    stop_event = stop_event or asyncio.Event()
    while not stop_event.is_set():
        if os.environ.get("RECALL_NETWORK_ONLINE", "true").lower() == "true":
            with suppress(Exception):
                await asyncio.to_thread(sync_pending)
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=_interval_seconds())
        except TimeoutError:
            continue
