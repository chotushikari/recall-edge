"""SQLite source of truth for Recall's raw computer-memory evidence.

Qdrant stores derived semantic memories. This module stores the original local
events and frames that make those memories auditable and deletable.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from backend.contracts import ActivityEvent

SCHEMA = """
CREATE TABLE IF NOT EXISTS activity_events (
    id TEXT PRIMARY KEY,
    timestamp_start TEXT NOT NULL,
    timestamp_end TEXT,
    event_type TEXT NOT NULL,
    application TEXT NOT NULL,
    process TEXT,
    window_title TEXT,
    browser TEXT,
    url TEXT,
    page_title TEXT,
    file_path TEXT,
    content TEXT,
    source TEXT NOT NULL,
    session_id TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    privacy_level TEXT NOT NULL DEFAULT 'local',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_events_time ON activity_events(timestamp_start);
CREATE INDEX IF NOT EXISTS idx_activity_events_app ON activity_events(application);
CREATE INDEX IF NOT EXISTS idx_activity_events_session ON activity_events(session_id);

CREATE TABLE IF NOT EXISTS screen_frames (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    path TEXT NOT NULL,
    hash TEXT NOT NULL,
    monitor TEXT,
    application TEXT,
    window_title TEXT,
    ocr_text TEXT,
    session_id TEXT,
    privacy_level TEXT NOT NULL DEFAULT 'local',
    created_at TEXT NOT NULL,
    UNIQUE(hash, monitor)
);
CREATE INDEX IF NOT EXISTS idx_screen_frames_time ON screen_frames(timestamp);
CREATE INDEX IF NOT EXISTS idx_screen_frames_session ON screen_frames(session_id);

CREATE VIRTUAL TABLE IF NOT EXISTS screen_frames_fts USING fts5(
    frame_id UNINDEXED,
    application,
    window_title,
    ocr_text,
    tokenize = 'unicode61 remove_diacritics 2'
);
"""

_FTS_SPECIALS = set('"\':*()^+-')


def _safe_fts_query(query: str) -> str:
    tokens = [
        f'"{"".join(char for char in part if char not in _FTS_SPECIALS)}"'
        for part in query.split()
    ]
    return " ".join(token for token in tokens if token != '""')


class EvidenceStore:
    """A small, explicit repository for raw local evidence.

    Connections are short-lived so the capture runtime and API can operate in
    separate threads/processes while SQLite WAL coordinates readers and writers.
    """

    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=10.0)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute("PRAGMA synchronous=NORMAL")
        return connection

    def record_activity(self, activity: ActivityEvent) -> None:
        timestamp = activity.timestamp.isoformat()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT OR IGNORE INTO activity_events (
                    id, timestamp_start, timestamp_end, event_type, application,
                    process, window_title, browser, url, page_title, file_path,
                    content, source, session_id, metadata, privacy_level, created_at
                ) VALUES (?, ?, NULL, 'window_focus', ?, ?, ?, NULL, ?, NULL, NULL, ?,
                          'windows_foreground', NULL, '{}', 'local', ?)
                """,
                (
                    activity.event_id,
                    timestamp,
                    activity.app_name,
                    activity.bundle_id,
                    activity.window_title,
                    activity.url,
                    activity.embedding_text or None,
                    datetime.now(activity.timestamp.tzinfo).isoformat(),
                ),
            )

    def list_events(
        self,
        *,
        start: datetime | None = None,
        end: datetime | None = None,
        limit: int = 500,
    ) -> list[dict[str, str | None]]:
        clauses: list[str] = []
        values: list[object] = []
        if start is not None:
            clauses.append("timestamp_start >= ?")
            values.append(start.isoformat())
        if end is not None:
            clauses.append("timestamp_start < ?")
            values.append(end.isoformat())
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        values.append(limit)
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM activity_events " + where + " ORDER BY timestamp_start DESC LIMIT ?",
                values,
            ).fetchall()
        return [dict(row) for row in rows]

    def record_frame(
        self,
        *,
        timestamp: datetime,
        path: str,
        content_hash: str,
        monitor: str,
        application: str,
        window_title: str,
        ocr_text: str,
        session_id: str | None = None,
        privacy_level: str = "local",
    ) -> str:
        frame_id = uuid4().hex
        with self._connect() as connection:
            existing = connection.execute(
                "SELECT id FROM screen_frames WHERE hash=? AND monitor=?", (content_hash, monitor)
            ).fetchone()
            if existing:
                return str(existing["id"])
            connection.execute(
                """
                INSERT INTO screen_frames (
                    id, timestamp, path, hash, monitor, application, window_title,
                    ocr_text, session_id, privacy_level, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    frame_id,
                    timestamp.isoformat(),
                    path,
                    content_hash,
                    monitor,
                    application,
                    window_title,
                    ocr_text,
                    session_id,
                    privacy_level,
                    datetime.now(timestamp.tzinfo).isoformat(),
                ),
            )
            connection.execute(
                "INSERT INTO screen_frames_fts(frame_id, application, window_title, ocr_text) VALUES (?, ?, ?, ?)",
                (frame_id, application, window_title, ocr_text),
            )
        return frame_id

    def search_frames(
        self, query: str, *, start: datetime | None = None, limit: int = 50
    ) -> list[dict[str, str]]:
        safe_query = _safe_fts_query(query)
        if not safe_query:
            return []
        clauses = ["screen_frames_fts MATCH ?"]
        values: list[object] = [safe_query]
        if start is not None:
            clauses.append("frames.timestamp >= ?")
            values.append(start.isoformat())
        values.append(limit)
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT frames.id, frames.timestamp, frames.path, frames.hash,
                       frames.monitor, frames.application, frames.window_title,
                       frames.ocr_text, frames.session_id, frames.privacy_level
                  FROM screen_frames AS frames
                  JOIN screen_frames_fts ON screen_frames_fts.frame_id = frames.id
                 WHERE """
                + " AND ".join(clauses)
                + " ORDER BY bm25(screen_frames_fts), frames.timestamp DESC LIMIT ?",
                values,
            ).fetchall()
        return [dict(row) for row in rows]

    def clear_history(self) -> None:
        with self._connect() as connection:
            connection.execute("DELETE FROM activity_events")
            connection.execute("DELETE FROM screen_frames")
            connection.execute("DELETE FROM screen_frames_fts")
