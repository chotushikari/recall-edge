import pytest
from fastapi.testclient import TestClient

from backend.api.server import app
from backend.qdrant_local.client import reset_client
from backend.sync.outbox import record_conflict


@pytest.fixture()
def isolated_store(tmp_path, monkeypatch):
    """Each test owns a Qdrant directory, avoiding the running edge node's lock."""
    monkeypatch.setenv("RECALL_QDRANT_MODE", "local")
    monkeypatch.setenv("RECALL_QDRANT_LOCAL_PATH", str(tmp_path / "qdrant"))
    monkeypatch.setenv("RECALL_SYNC_OUTBOX_DB", str(tmp_path / "sync-outbox.db"))
    monkeypatch.setenv("RECALL_NETWORK_ONLINE", "true")
    monkeypatch.delenv("RECALL_QDRANT_CLOUD_URL", raising=False)
    monkeypatch.delenv("RECALL_QDRANT_CLOUD_API_KEY", raising=False)
    reset_client()
    yield tmp_path
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


def test_latest_sync_result_reports_a_manual_attempt(isolated_store) -> None:
    client = TestClient(app)
    client.delete("/memories/all")
    client.post(
        "/memories",
        json={
            "memory_type": "topic",
            "summary": "Queued Qdrant sync",
            "embedding_text": "A syncable memory waiting for Qdrant Cloud.",
        },
    ).raise_for_status()

    attempt = client.post("/sync/run-now").json()
    latest = client.get("/sync/latest-result").json()

    assert latest["batch_id"] == attempt["batch_id"]
    assert latest["synced"] == []


def test_sync_conflicts_endpoint_exposes_review_items(isolated_store) -> None:
    record_conflict("edge-memory", edge_version=2, cloud_version=3)
    response = TestClient(app).get("/sync/conflicts")

    assert response.status_code == 200
    assert response.json()[0]["memory_dedup_key"] == "edge-memory"


def test_dashboard_aggregation_endpoints_use_local_memories(isolated_store, monkeypatch) -> None:
    marker = isolated_store / "pause-marker"
    monkeypatch.setattr("backend.api.server.CAPTURE_PAUSE_MARKER", marker)
    client = TestClient(app)
    client.post(
        "/memories",
        json={
            "memory_type": "project",
            "summary": "Edited Recall Edge architecture",
            "embedding_text": "Implemented local Qdrant dashboard aggregation.",
            "provenance": {"app_name": "VS Code", "bundle_id": "com.microsoft.VSCode", "project": "recall-edge"},
        },
    ).raise_for_status()

    summary = client.get("/daily-summary").json()
    usage = client.get("/app-usage?range=today").json()
    heatmap = client.get("/calendar-heatmap?days=14").json()

    assert summary["top_apps"] == [{"name": "VS Code", "minutes": 5}]
    assert usage["apps"][0]["app_name"] == "VS Code"
    assert len(heatmap["days"]) == 14
    assert client.get("/projects").json() == ["recall-edge"]
    assert client.post("/capture/pause").json()["capturing"] is False
    assert marker.exists()
    assert client.post("/capture/resume").json()["capturing"] is True
    assert not marker.exists()
