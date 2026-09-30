"""Privacy-minimal Windows foreground-window collector.

The collector intentionally records only the active app and its window title.
It never reads keystrokes, screen pixels, clipboard data, or inactive browser
tabs. Browser URL collection must be provided by an explicit browser extension.
"""

from __future__ import annotations

import ctypes
import os
import platform
import time
from ctypes import wintypes
from pathlib import Path

from backend.contracts import ActivityEvent

PROCESS_QUERY_LIMITED_INFORMATION = 0x1000


def _process_path(pid: int) -> str:
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
    if not handle:
        return ""
    try:
        size = wintypes.DWORD(32768)
        buffer = ctypes.create_unicode_buffer(size.value)
        if kernel32.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size)):
            return buffer.value
    finally:
        kernel32.CloseHandle(handle)
    return ""


def foreground_activity() -> ActivityEvent | None:
    """Return the current foreground app/window on Windows, otherwise ``None``."""
    if platform.system() != "Windows":
        return None
    user32 = ctypes.WinDLL("user32", use_last_error=True)
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return None
    length = user32.GetWindowTextLengthW(hwnd)
    title = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, title, len(title))
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    executable = _process_path(pid.value)
    app_name = Path(executable).stem or "Unknown application"
    if not executable and not title.value:
        return None
    return ActivityEvent(
        app_name=app_name,
        window_title=title.value,
        bundle_id=executable or None,
    )


class ActivityPoller:
    """Emit a local event on foreground change, with a bounded heartbeat."""

    def __init__(self, heartbeat_seconds: float = 60.0) -> None:
        self.heartbeat_seconds = max(heartbeat_seconds, 1.0)
        self._last_key: tuple[str, str, str | None] | None = None
        self._last_emitted_at = 0.0

    def next_event(self) -> ActivityEvent | None:
        event = foreground_activity()
        if event is None:
            return None
        key = (event.app_name, event.window_title, event.bundle_id)
        now = time.monotonic()
        if key == self._last_key and now - self._last_emitted_at < self.heartbeat_seconds:
            return None
        self._last_key = key
        self._last_emitted_at = now
        return event


def is_supported() -> bool:
    """Expose collector support without importing Windows APIs on other systems."""
    return os.name == "nt"
