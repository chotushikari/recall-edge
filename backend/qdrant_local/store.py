"""In-process Qdrant store with OpenChronicle-compatible memory semantics."""
from __future__ import annotations

import hashlib
from typing import Any
from uuid import UUID

from qdrant_client.http.models import PointIdsList, PointStruct

from backend.contracts import COLLECTION_NAME, EMBEDDING_DIM, Memory, PrivacyClass
from backend.policy import apply_policy
from backend.qdrant_local.client import get_qdrant_client

_embedding_model: Any | None = None


def point_id_from_dedup(dedup_key: str) -> UUID:
    """Map an opaque deduplication key to a Qdrant-compatible UUID."""
    return UUID(hex=hashlib.sha256(dedup_key.encode()).hexdigest()[:32])


def _fallback_embedding(text: str) -> list[float]:
    """Stable fallback keeps local search available before a model is downloaded."""
    vector = [0.0] * EMBEDDING_DIM
    for token in text.lower().split():
        digest = hashlib.sha256(token.encode()).digest()
        vector[int.from_bytes(digest[:2], "big") % EMBEDDING_DIM] += 1.0
    magnitude = sum(value * value for value in vector) ** 0.5
    return [value / magnitude for value in vector] if magnitude else vector


def _embed(text: str) -> list[float]:
    global _embedding_model
    try:
        if _embedding_model is None:
            from fastembed import TextEmbedding

            _embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
        return [float(value) for value in next(_embedding_model.embed([text]))]
    except Exception:
        return _fallback_embedding(text)


def _all_payloads() -> list[dict[str, Any]]:
    client = get_qdrant_client()
    records, _ = client.scroll(COLLECTION_NAME, limit=10_000, with_payload=True, with_vectors=False)
    return [dict(record.payload or {}) for record in records]


def _find_payload(memory_id: str | None = None, dedup_key: str | None = None) -> dict[str, Any] | None:
    for payload in _all_payloads():
        if (memory_id and payload.get("memory_id") == memory_id) or (
            dedup_key and payload.get("dedup_key") == dedup_key
        ):
            return payload
    return None


def _upsert(memory: Memory) -> None:
    client = get_qdrant_client()
    assert memory.dedup_key
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=[PointStruct(id=point_id_from_dedup(memory.dedup_key), vector=memory.embedding or _embed(memory.embedding_text), payload=memory.model_dump(mode="json"))],
    )


def index_memory(memory: Memory, bundle_id: str | None = None) -> tuple[str, bool]:
    """Store a memory and return its id plus whether this was a new insert."""
    apply_policy(memory, bundle_id)
    if memory.privacy is PrivacyClass.PRIVATE:
        memory.local_only = True
    if _find_payload(dedup_key=memory.dedup_key):
        return memory.memory_id, False
    if memory.supersedes:
        return supersede_memory(memory.supersedes, memory), True
    memory.embedding = _embed(memory.embedding_text)
    _upsert(memory)
    return memory.memory_id, True


def supersede_memory(old_id: str, new_memory: Memory) -> str:
    """Preserve the old version and make the new version searchable by default."""
    old_payload = _find_payload(memory_id=old_id)
    if old_payload is None:
        raise KeyError(f"Unknown memory to supersede: {old_id}")
    old = Memory.model_validate(old_payload)
    new_memory.version = old.version + 1
    new_memory.supersedes = old.memory_id
    apply_policy(new_memory)
    new_memory.embedding = _embed(new_memory.embedding_text)
    old.superseded_by = new_memory.memory_id
    _upsert(old)
    _upsert(new_memory)
    return new_memory.memory_id


def search_memories(query: str, top_k: int = 5, filter: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """Run semantic local search and return only latest compatible memories."""
    response = get_qdrant_client().query_points(
        collection_name=COLLECTION_NAME,
        query=_embed(query),
        limit=max(top_k * 4, top_k),
        with_payload=True,
    )
    results: list[dict[str, Any]] = []
    for point in response.points:
        payload = dict(point.payload or {})
        if payload.get("superseded_by"):
            continue
        if filter and any(payload.get(key) != value for key, value in filter.items()):
            continue
        results.append({"memory_id": payload["memory_id"], "dedup_key": payload["dedup_key"], "score": point.score, "payload": payload, "version": payload.get("version", 1)})
        if len(results) == top_k:
            break
    return results


def get_memory(memory_id: str, include_history: bool = False) -> dict[str, Any]:
    payload = _find_payload(memory_id=memory_id)
    if payload is None:
        raise KeyError(memory_id)
    result = dict(payload)
    if include_history:
        chain = [payload]
        cursor = payload
        while cursor.get("supersedes"):
            cursor = _find_payload(memory_id=cursor["supersedes"])
            if cursor is None:
                break
            chain.append(cursor)
        while cursor and cursor.get("superseded_by"):
            cursor = _find_payload(memory_id=cursor["superseded_by"])
            if cursor is None:
                break
            chain.append(cursor)
        result["history"] = sorted({item["memory_id"]: item for item in chain}.values(), key=lambda item: item["version"])
    return result


def get_pending_sync(limit: int = 50) -> list[Memory]:
    return [Memory.model_validate(payload) for payload in _all_payloads() if payload.get("privacy") == PrivacyClass.SYNCABLE.value and payload.get("local_only")][:limit]


def mark_synced(dedup_key: str) -> None:
    payload = _find_payload(dedup_key=dedup_key)
    if payload is None:
        raise KeyError(dedup_key)
    memory = Memory.model_validate(payload)
    memory.local_only = False
    _upsert(memory)


def list_memories(limit: int = 100) -> list[dict[str, Any]]:
    latest = [payload for payload in _all_payloads() if not payload.get("superseded_by")]
    return sorted(latest, key=lambda item: item["timestamp"], reverse=True)[:limit]


def count_local() -> int:
    return len([payload for payload in _all_payloads() if not payload.get("superseded_by")])


def count_private() -> int:
    return len([payload for payload in _all_payloads() if not payload.get("superseded_by") and payload.get("privacy") == PrivacyClass.PRIVATE.value])


def count_pending_sync() -> int:
    return len(get_pending_sync())


def clear_memories() -> None:
    client = get_qdrant_client()
    records, _ = client.scroll(COLLECTION_NAME, limit=10_000, with_payload=False, with_vectors=False)
    if records:
        client.delete(COLLECTION_NAME, points_selector=PointIdsList(points=[record.id for record in records]))
