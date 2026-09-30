"""Qdrant in-process client setup for the Recall edge store."""
from __future__ import annotations

import os
from pathlib import Path

from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

from backend.contracts import COLLECTION_NAME, EMBEDDING_DIM, QDRANT_LOCAL_PATH

_client: QdrantClient | None = None


def get_qdrant_client() -> QdrantClient:
    """Return a singleton local client and ensure the memory collection exists."""
    global _client
    if _client is None:
        mode = os.environ.get("RECALL_QDRANT_MODE", "local")
        if mode == "local":
            path = Path(os.environ.get("RECALL_QDRANT_LOCAL_PATH", QDRANT_LOCAL_PATH))
            path.parent.mkdir(parents=True, exist_ok=True)
            _client = QdrantClient(path=str(path))
        elif mode == "edge":
            _client = QdrantClient(
                host=os.environ["RECALL_QDRANT_EDGE_HOST"],
                port=int(os.environ.get("RECALL_QDRANT_EDGE_PORT", "6333")),
            )
        else:
            raise ValueError(f"Unsupported RECALL_QDRANT_MODE: {mode}")
        ensure_collection(_client)
    return _client


def ensure_collection(client: QdrantClient) -> None:
    """Create the collection once; local Qdrant makes this idempotent."""
    if not client.collection_exists(COLLECTION_NAME):
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )


def reset_client() -> None:
    """Close and forget the singleton, primarily for tests and reset operations."""
    global _client
    if _client is not None:
        _client.close()
    _client = None
