from types import SimpleNamespace

from backend.contracts import Memory, MemoryType, PrivacyClass
from backend.sync.cloud import get_latest_sync_result, sync_pending


class FakeCloud:
    def __init__(self, existing=None, old_record=None):
        self.exists = False
        self.existing = existing or []
        self.old_record = old_record
        self.created = False
        self.upserts = []
        self.payload_updates = []

    def collection_exists(self, _collection):
        return self.exists

    def create_collection(self, **_kwargs):
        self.created = True
        self.exists = True

    def retrieve(self, *_args, **_kwargs):
        return self.existing

    def scroll(self, *_args, **_kwargs):
        return ([self.old_record], None) if self.old_record else ([], None)

    def set_payload(self, _collection, payload, points):
        self.payload_updates.append((payload, points))

    def upsert(self, _collection, points):
        self.upserts.extend(points)


def memory(summary: str, *, supersedes: str | None = None) -> Memory:
    return Memory(
        memory_type=MemoryType.TOPIC,
        summary=summary,
        embedding_text=summary,
        embedding=[0.1] * 384,
        privacy=PrivacyClass.SYNCABLE,
        supersedes=supersedes,
    )


def test_sync_writes_qdrant_point_and_marks_outbox(monkeypatch) -> None:
    candidate = memory("Qdrant local search")
    cloud = FakeCloud()
    marked = []
    monkeypatch.setenv("RECALL_NETWORK_ONLINE", "true")
    monkeypatch.setattr("backend.sync.cloud.get_cloud_client", lambda: cloud)
    monkeypatch.setattr("backend.sync.cloud.read_batch", lambda: [candidate])
    monkeypatch.setattr("backend.sync.cloud.mark_synced", marked.append)
    monkeypatch.setattr("backend.sync.cloud.mark_status", lambda key, status: marked.append((key, status)))

    result = sync_pending()

    assert cloud.created
    assert len(cloud.upserts) == 1
    assert result.synced == [candidate.dedup_key]
    assert marked == [candidate.dedup_key, (candidate.dedup_key, "synced")]
    assert get_latest_sync_result() == result


def test_sync_marks_retry_as_already_existed(monkeypatch) -> None:
    candidate = memory("Retry-safe sync")
    cloud = FakeCloud(existing=[SimpleNamespace(id="existing")])
    monkeypatch.setenv("RECALL_NETWORK_ONLINE", "true")
    monkeypatch.setattr("backend.sync.cloud.get_cloud_client", lambda: cloud)
    monkeypatch.setattr("backend.sync.cloud.read_batch", lambda: [candidate])
    monkeypatch.setattr("backend.sync.cloud.mark_synced", lambda _key: None)
    monkeypatch.setattr("backend.sync.cloud.mark_status", lambda _key, _status: None)

    result = sync_pending()

    assert result.already_existed == [candidate.dedup_key]
    assert not cloud.upserts


def test_sync_marks_cloud_predecessor_as_superseded(monkeypatch) -> None:
    predecessor = memory("First Qdrant note")
    candidate = memory("Updated Qdrant note", supersedes=predecessor.memory_id)
    cloud = FakeCloud(old_record=SimpleNamespace(id="old-point", payload={}))
    monkeypatch.setenv("RECALL_NETWORK_ONLINE", "true")
    monkeypatch.setattr("backend.sync.cloud.get_cloud_client", lambda: cloud)
    monkeypatch.setattr("backend.sync.cloud.read_batch", lambda: [candidate])
    monkeypatch.setattr("backend.sync.cloud.mark_synced", lambda _key: None)
    monkeypatch.setattr("backend.sync.cloud.mark_status", lambda _key, _status: None)

    result = sync_pending()

    assert result.superseded_in_cloud == [candidate.dedup_key]
    assert cloud.payload_updates == [({"superseded_by": candidate.memory_id}, ["old-point"])]


def test_sync_preserves_a_newer_cloud_version_as_conflict(monkeypatch) -> None:
    predecessor = memory("First Qdrant note")
    candidate = memory("Conflicting Qdrant note", supersedes=predecessor.memory_id)
    cloud = FakeCloud(
        old_record=SimpleNamespace(
            id="old-point",
            payload={"version": 1, "superseded_by": "cloud-v2-memory"},
        )
    )
    marked = []
    monkeypatch.setenv("RECALL_NETWORK_ONLINE", "true")
    monkeypatch.setattr("backend.sync.cloud.get_cloud_client", lambda: cloud)
    monkeypatch.setattr("backend.sync.cloud.read_batch", lambda: [candidate])
    monkeypatch.setattr("backend.sync.cloud.mark_synced", lambda _key: None)
    monkeypatch.setattr("backend.sync.cloud.mark_status", lambda key, status: marked.append((key, status)))
    monkeypatch.setattr("backend.sync.cloud.record_conflict", lambda *args, **kwargs: None)

    result = sync_pending()

    assert result.conflicts == [candidate.dedup_key]
    assert marked == [(candidate.dedup_key, "conflict")]
    assert not cloud.upserts
