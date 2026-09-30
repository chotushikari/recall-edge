import pytest
from fastapi.testclient import TestClient

from backend.api.server import app
from backend.qdrant_local.client import reset_client


@pytest.fixture()
def isolated_store(tmp_path, monkeypatch):
    """Each test owns a Qdrant directory, avoiding the running edge node's lock."""
    monkeypatch.setenv("RECALL_QDRANT_MODE", "local")
    monkeypatch.setenv("RECALL_QDRANT_LOCAL_PATH", str(tmp_path / "qdrant"))
    monkeypatch.setenv("RECALL_SYNC_OUTBOX_DB", str(tmp_path / "sync-outbox.db"))
    monkeypatch.setenv("RECALL_NETWORK_ONLINE", "true")
    reset_client()
    yield
    reset_client()


def test_private_memory_never_enters_sync_queue(isolated_store) -> None:
    client = TestClient(app)
    client.delete("/memories/all")
    client.post("/memories", json={"memory_type": "tool", "summary": "Opened password vault", "embedding_text": "Used 1Password for a credential lookup.", "provenance": {"bundle_id": "com.1password.7"}}).raise_for_status()
    state = client.get("/node/state").json()
    assert state["private_count"] == 1
    assert state["pending_sync_count"] == 0


def test_search_remains_available_offline(isolated_store) -> None:
    client = TestClient(app)
    client.delete("/memories/all")
    client.post("/memories", json={"memory_type": "topic", "summary": "Qdrant Edge research", "embedding_text": "Studied local vector search and offline cloud synchronization."}).raise_for_status()
    client.post("/network/toggle", json={"online": False}).raise_for_status()
    response = client.post("/memory/search", json={"query": "local vector synchronization"})
    assert response.status_code == 200
    assert response.json()[0]["payload"]["summary"] == "Qdrant Edge research"
    client.post("/network/toggle", json={"online": True}).raise_for_status()


def test_supersede_preserves_history_and_hides_old_version_from_search(isolated_store) -> None:
    client = TestClient(app)
    client.delete("/memories/all")
    first = client.post("/memories", json={"memory_type": "topic", "summary": "First Qdrant note", "embedding_text": "Initial notes about vector storage."}).json()
    second = client.post("/memories", json={"memory_type": "topic", "summary": "Updated Qdrant note", "embedding_text": "Updated notes about local vector storage and synchronization.", "supersedes": first["memory_id"]}).json()
    detail = client.get(f"/memory/{second['memory_id']}?include_history=true").json()
    assert detail["version"] == 2
    assert [item["version"] for item in detail["history"]] == [1, 2]
    search = client.post("/memory/search", json={"query": "vector storage"}).json()
    assert all(result["memory_id"] != first["memory_id"] for result in search)
