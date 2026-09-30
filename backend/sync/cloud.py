"""Qdrant Cloud sync adapter; safely remains pending until cloud is configured."""
from __future__ import annotations

import os

from qdrant_client import QdrantClient
from qdrant_client.http.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from backend.contracts import COLLECTION_NAME, EMBEDDING_DIM, SyncBatch, SyncResult
from backend.qdrant_local.store import mark_synced, point_id_from_dedup
from backend.sync.outbox import mark_status, read_batch


def get_cloud_client() -> QdrantClient | None:
    url, api_key = os.environ.get("RECALL_QDRANT_CLOUD_URL"), os.environ.get("RECALL_QDRANT_CLOUD_API_KEY")
    return QdrantClient(url=url, api_key=api_key) if url and api_key else None


def get_cloud_count() -> int:
    client = get_cloud_client()
    if client is None:
        return 0


def ensure_cloud_collection(client: QdrantClient) -> None:
    """Create the Cloud collection on its first successful sync."""
    if not client.collection_exists(COLLECTION_NAME):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )


def _find_cloud_memory(client: QdrantClient, memory_id: str):
    records, _ = client.scroll(
        COLLECTION_NAME,
        scroll_filter=Filter(must=[FieldCondition(key="memory_id", match=MatchValue(value=memory_id))]),
        limit=1,
        with_payload=True,
        with_vectors=False,
    )
    return records[0] if records else None
    try:
        return client.count(COLLECTION_NAME).count
    except Exception:
        return 0


def sync_pending() -> SyncResult:
    batch = read_batch()
    result = SyncResult(batch_id=SyncBatch(node_id=os.environ.get("RECALL_NODE_ID", "edge-node-a"), memory_dedup_keys=[memory.dedup_key for memory in batch if memory.dedup_key]).batch_id)
    client = get_cloud_client()
    if not batch or client is None or os.environ.get("RECALL_NETWORK_ONLINE", "true") != "true":
        return result
    ensure_cloud_collection(client)
    for memory in batch:
        assert memory.dedup_key
        point_id = point_id_from_dedup(memory.dedup_key)
        existing = client.retrieve(COLLECTION_NAME, ids=[point_id], with_payload=True, with_vectors=False)
        if existing:
            mark_synced(memory.dedup_key)
            mark_status(memory.dedup_key, "synced")
            result.already_existed.append(memory.dedup_key)
            continue

        superseded = False
        if memory.supersedes:
            old_record = _find_cloud_memory(client, memory.supersedes)
            if old_record:
                client.set_payload(
                    COLLECTION_NAME,
                    payload={"superseded_by": memory.memory_id},
                    points=[old_record.id],
                )
                superseded = True
        client.upsert(
            COLLECTION_NAME,
            [
                PointStruct(
                    id=point_id,
                    vector=memory.embedding or [],
                    payload=memory.model_dump(mode="json"),
                )
            ],
        )
        mark_synced(memory.dedup_key)
        mark_status(memory.dedup_key, "synced")
        (result.superseded_in_cloud if superseded else result.synced).append(memory.dedup_key)
    return result
