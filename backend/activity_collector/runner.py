"""In-process lifecycle for the Windows foreground activity collector."""

from __future__ import annotations

import threading
from collections.abc import Callable

from backend.contracts import ActivityEvent

from .windows import ActivityPoller, is_supported


class LocalActivityCollector:
    """A single-app collector that writes directly into Recall's local ledger."""

    def __init__(self, sink: Callable[[ActivityEvent], None]) -> None:
        self._sink = sink
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(self, *, interval_seconds: float = 3.0, heartbeat_seconds: float = 60.0) -> bool:
        if not is_supported() or self.running:
            return False
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run,
            args=(max(interval_seconds, 0.5), heartbeat_seconds),
            name="recall-activity-collector",
            daemon=True,
        )
        self._thread.start()
        return True

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
        self._thread = None

    def _run(self, interval_seconds: float, heartbeat_seconds: float) -> None:
        poller = ActivityPoller(heartbeat_seconds=heartbeat_seconds)
        while not self._stop.is_set():
            event = poller.next_event()
            if event is not None:
                self._sink(event)
            self._stop.wait(interval_seconds)
