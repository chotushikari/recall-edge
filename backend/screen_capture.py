"""Explicit, local-only visual evidence capture for Recall.

This module never starts itself. The API runtime creates it only after the
user explicitly enables visual capture, and every frame is filtered before the
screen is read or written.
"""

from __future__ import annotations

import hashlib
import io
import threading
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Protocol

from backend.contracts import ActivityEvent
from backend.evidence_store import EvidenceStore


@dataclass(frozen=True)
class CapturedScreen:
    data: bytes
    monitor: str
    suffix: str = ".webp"


@dataclass(frozen=True)
class CapturePolicy:
    """Pre-capture privacy rules, matched case-insensitively."""

    excluded_applications: tuple[str, ...] = ("1password", "keepass", "bitwarden")
    excluded_window_terms: tuple[str, ...] = (
        "password",
        "private browsing",
        "incognito",
        "banking",
    )

    def excludes(self, *, application: str, window_title: str) -> bool:
        app = application.casefold()
        title = window_title.casefold()
        return app in {item.casefold() for item in self.excluded_applications} or any(
            term.casefold() in title for term in self.excluded_window_terms
        )


@dataclass(frozen=True)
class StoredFrame:
    id: str
    path: Path


class ScreenSource(Protocol):
    def capture_primary(self) -> CapturedScreen: ...


class MssScreenSource:
    """Windows-compatible primary-monitor source backed by mss and Pillow."""

    def capture_primary(self) -> CapturedScreen:
        import mss
        from PIL import Image

        with mss.mss() as capture:
            monitor = capture.monitors[1]
            image = capture.grab(monitor)
        rendered = Image.frombytes("RGB", image.size, image.rgb)
        output = io.BytesIO()
        rendered.save(output, format="WEBP", quality=80, method=4)
        return CapturedScreen(data=output.getvalue(), monitor="DISPLAY1")


class ScreenCaptureService:
    """Persists only changed, permitted screen frames as local evidence."""

    def __init__(
        self,
        *,
        store: EvidenceStore,
        frames_dir: Path,
        source: ScreenSource,
        policy: CapturePolicy,
    ) -> None:
        self.store = store
        self.frames_dir = frames_dir
        self.source = source
        self.policy = policy

    def capture_once(
        self, *, application: str, window_title: str, timestamp: datetime, session_id: str | None = None
    ) -> StoredFrame | None:
        if self.policy.excludes(application=application, window_title=window_title):
            return None
        captured = self.source.capture_primary()
        content_hash = hashlib.sha256(captured.data).hexdigest()
        if self.store.has_frame(content_hash=content_hash, monitor=captured.monitor):
            return None

        stamp = timestamp.strftime("%Y-%m-%d/%H%M%S-%f")
        target = self.frames_dir / f"{stamp}-{content_hash[:12]}{captured.suffix}"
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_suffix(target.suffix + ".tmp")
        temporary.write_bytes(captured.data)
        temporary.replace(target)
        frame_id = self.store.record_frame(
            timestamp=timestamp,
            path=str(target),
            content_hash=content_hash,
            monitor=captured.monitor,
            application=application,
            window_title=window_title,
            ocr_text="",
            session_id=session_id,
        )
        return StoredFrame(id=frame_id, path=target)


class FrameRetentionService:
    """Deletes frame records and only files proven to belong to Recall."""

    def __init__(self, *, store: EvidenceStore, frames_dir: Path) -> None:
        self.store = store
        self.frames_dir = frames_dir.resolve()

    def prune_before(self, cutoff: datetime) -> int:
        frames = self.store.frames_before(cutoff)
        return self._delete_frames(frames)

    def clear(self) -> int:
        return self._delete_frames(self.store.all_frames())

    def _delete_frames(self, frames: list[dict[str, str]]) -> int:
        for frame in frames:
            self._delete_owned_file(Path(frame["path"]))
        return self.store.delete_frames([frame["id"] for frame in frames])

    def _delete_owned_file(self, candidate: Path) -> None:
        try:
            resolved = candidate.resolve()
            resolved.relative_to(self.frames_dir)
        except (OSError, ValueError):
            return
        if resolved.is_file():
            resolved.unlink()


class VisualCaptureCollector:
    """Threaded visual capture runtime; constructed only after explicit opt-in."""

    def __init__(
        self,
        *,
        service: ScreenCaptureService,
        activity: Callable[[], ActivityEvent | None],
        is_paused: Callable[[], bool],
    ) -> None:
        self._service = service
        self._activity = activity
        self._is_paused = is_paused
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(self, *, interval_seconds: float) -> bool:
        if self.running:
            return False
        self._stop.clear()
        self._thread = threading.Thread(
            target=self._run,
            args=(max(interval_seconds, 1.0),),
            name="recall-visual-capture",
            daemon=True,
        )
        self._thread.start()
        return True

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
        self._thread = None

    def _run(self, interval_seconds: float) -> None:
        while not self._stop.is_set():
            if not self._is_paused():
                activity = self._activity()
                if activity is not None:
                    self._service.capture_once(
                        application=activity.app_name,
                        window_title=activity.window_title,
                        timestamp=activity.timestamp,
                    )
            self._stop.wait(interval_seconds)
