"""Durable, privacy-gated outbox for Recall Edge synchronization."""
from __future__ import annotations

import os
import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from backend.contracts import SYNC_OUTBOX_DB, Memory, PrivacyClass


def _database_path() -> Path:
    return Path(os.environ.get("RECALL_SYNC_OUTBOX_DB", SYNC_OUTBOX_DB))


def init_schema() -> None:
    with sqlite3.connect(_database_path()) as connection:
        connection.execute(
            """CREATE TABLE IF NOT EXISTS sync_outbox (
            memory_dedup_key TEXT PRIMARY KEY, memory_id TEXT NOT NULL,
            memory_json TEXT NOT NULL, created_at TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0, last_attempt_at TEXT,
            status TEXT NOT NULL DEFAULT 'pending')"""
        )


def append_to_outbox(memory: Memory) -> bool:
    """Queue a syncable memory. Private memories are deliberately discarded here."""
    if memory.privacy is PrivacyClass.PRIVATE:
        return False
    init_schema()
    assert memory.dedup_key
    with sqlite3.connect(_database_path()) as connection:
        cursor = connection.execute(
            "INSERT OR IGNORE INTO sync_outbox (memory_dedup_key, memory_id, memory_json, created_at) VALUES (?, ?, ?, ?)",
            (memory.dedup_key, memory.memory_id, memory.model_dump_json(), datetime.now(UTC).isoformat()),
        )
    return cursor.rowcount > 0


def get_pending_count() -> int:
    init_schema()
    with sqlite3.connect(_database_path()) as connection:
        return int(connection.execute("SELECT COUNT(*) FROM sync_outbox WHERE status = 'pending'").fetchone()[0])


def read_batch(size: int = 50) -> list[Memory]:
    init_schema()
    with sqlite3.connect(_database_path()) as connection:
        rows = connection.execute("SELECT memory_json FROM sync_outbox WHERE status = 'pending' ORDER BY created_at LIMIT ?", (size,)).fetchall()
    return [Memory.model_validate_json(row[0]) for row in rows]


def mark_status(dedup_key: str, status: str) -> None:
    init_schema()
    with sqlite3.connect(_database_path()) as connection:
        connection.execute("UPDATE sync_outbox SET status = ?, attempts = attempts + 1, last_attempt_at = ? WHERE memory_dedup_key = ?", (status, datetime.now(UTC).isoformat(), dedup_key))


def clear_outbox() -> None:
    init_schema()
    with sqlite3.connect(_database_path()) as connection:
        connection.execute("DELETE FROM sync_outbox")
