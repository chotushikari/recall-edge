"""Qdrant Cloud sync adapter; safely remains pending until cloud is configured."""
from __future__ import annotations

import os

from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, PointStruct, VectorParams

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
        client.upsert(
            COLLECTION_NAME,
            [
                PointStruct(
                    id=point_id_from_dedup(memory.dedup_key),
                    vector=memory.embedding or [],
                    payload=memory.model_dump(mode="json"),
                )
            ],
        )
        mark_synced(memory.dedup_key)
        mark_status(memory.dedup_key, "synced")
        result.synced.append(memory.dedup_key)
    return result
