"""Shared, versioned data contracts for Recall."""
from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator

CONTRACTS_VERSION = "1.0.0"
COLLECTION_NAME = "recall_memories"
QDRANT_LOCAL_PATH = "./.qdrant_local"
SYNC_OUTBOX_DB = "./.recall_sync.db"
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"
EMBEDDING_DIM = 384


class MemoryType(StrEnum):
    USER = "user"
    PROJECT = "project"
    TOOL = "tool"
    TOPIC = "topic"
    PERSON = "person"
    ORG = "org"


class PrivacyClass(StrEnum):
    PRIVATE = "private"
    SYNCABLE = "syncable"


class NodeStatus(StrEnum):
    ONLINE = "online"
    OFFLINE = "offline"
    SYNCING = "syncing"


class ActivityEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: uuid4().hex)
    dedup_key: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    app_name: str
    window_title: str = ""
    url: str | None = None
    bundle_id: str | None = None
    focused_element: str | None = None
    edited_text: str | None = None
    embedding_text: str = ""

    @model_validator(mode="after")
    def populate_dedup_key(self) -> ActivityEvent:
        if not self.dedup_key:
            self.dedup_key = self.make_dedup_key(self.timestamp, self.app_name, self.focused_element)
        return self

    @staticmethod
    def make_dedup_key(timestamp: datetime, app: str, focused_element: str | None) -> str:
        value = f"{timestamp.isoformat()}|{app}|{focused_element or ''}"
        return hashlib.sha256(value.encode()).hexdigest()


class Memory(BaseModel):
    memory_id: str = Field(default_factory=lambda: uuid4().hex)
    dedup_key: str | None = None
    source_activity_ids: list[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    memory_type: MemoryType
    summary: str
    embedding_text: str
    embedding: list[float] | None = None
    privacy: PrivacyClass | None = None
    version: int = Field(default=1, ge=1)
    supersedes: str | None = None
    superseded_by: str | None = None
    provenance: dict[str, Any] = Field(default_factory=dict)
    local_only: bool = True
    origin_node: str = "edge-node-a"

    @model_validator(mode="after")
    def populate_dedup_key(self) -> Memory:
        if not self.dedup_key:
            self.dedup_key = self.make_dedup_key(self.memory_id)
        return self

    @staticmethod
    def make_dedup_key(memory_id: str) -> str:
        return hashlib.sha256(memory_id.encode()).hexdigest()


class SyncBatch(BaseModel):
    batch_id: str = Field(default_factory=lambda: uuid4().hex)
    node_id: str
    memory_dedup_keys: list[str]
    idempotency_key: str = Field(default_factory=lambda: uuid4().hex)


class SyncResult(BaseModel):
    batch_id: str
    synced: list[str] = Field(default_factory=list)
    already_existed: list[str] = Field(default_factory=list)
    superseded_in_cloud: list[str] = Field(default_factory=list)
    conflicts: list[str] = Field(default_factory=list)


class NodeState(BaseModel):
    node_id: str
    status: NodeStatus
    local_memory_count: int
    cloud_memory_count: int
    pending_sync_count: int
    private_count: int
    last_sync_at: datetime | None = None
    last_seen_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
