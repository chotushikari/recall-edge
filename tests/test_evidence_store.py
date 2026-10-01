from datetime import UTC, datetime, timedelta

from backend.contracts import ActivityEvent
from backend.evidence_store import EvidenceStore


def test_activity_events_are_normalized_and_returned_in_time_order(tmp_path) -> None:
    store = EvidenceStore(tmp_path / "recall.db")
    earlier = datetime(2026, 10, 1, 9, 30, tzinfo=UTC)
    later = earlier + timedelta(minutes=5)

    store.record_activity(
        ActivityEvent(
            event_id="earlier",
            timestamp=earlier,
            app_name="Code",
            window_title="memory_store.py — Recall",
            bundle_id=r"C:\\Program Files\\Microsoft VS Code\\Code.exe",
        )
    )
    store.record_activity(
        ActivityEvent(
            event_id="later",
            timestamp=later,
            app_name="Chrome",
            window_title="Qdrant documentation",
            url="https://qdrant.tech/documentation/",
        )
    )

    events = store.list_events(start=earlier, end=later + timedelta(seconds=1))

    assert [event["id"] for event in events] == ["later", "earlier"]
    assert events[0]["event_type"] == "window_focus"
    assert events[0]["url"] == "https://qdrant.tech/documentation/"
    assert events[1]["process"] == r"C:\\Program Files\\Microsoft VS Code\\Code.exe"


def test_screen_frame_evidence_is_searchable_and_linked_to_session(tmp_path) -> None:
    store = EvidenceStore(tmp_path / "recall.db")
    moment = datetime(2026, 10, 1, 10, 0, tzinfo=UTC)

    frame_id = store.record_frame(
        timestamp=moment,
        path="frames/2026-10-01/frame.webp",
        content_hash="content-hash",
        monitor="DISPLAY1",
        application="Chrome",
        window_title="Qdrant Edge documentation",
        ocr_text="Qdrant Edge vector database local search",
        session_id="session-1",
    )

    frames = store.search_frames("vector database", start=moment - timedelta(minutes=1))

    assert frames == [
        {
            "id": frame_id,
            "timestamp": moment.isoformat(),
            "path": "frames/2026-10-01/frame.webp",
            "hash": "content-hash",
            "monitor": "DISPLAY1",
            "application": "Chrome",
            "window_title": "Qdrant Edge documentation",
            "ocr_text": "Qdrant Edge vector database local search",
            "session_id": "session-1",
            "privacy_level": "local",
        }
    ]


def test_clear_history_removes_events_frames_and_search_index(tmp_path) -> None:
    store = EvidenceStore(tmp_path / "recall.db")
    moment = datetime(2026, 10, 1, 10, 0, tzinfo=UTC)
    store.record_activity(ActivityEvent(event_id="event", timestamp=moment, app_name="Code"))
    store.record_frame(
        timestamp=moment,
        path="frames/frame.webp",
        content_hash="hash",
        monitor="DISPLAY1",
        application="Code",
        window_title="Recall",
        ocr_text="private text",
    )

    store.clear_history()

    assert store.list_events() == []
    assert store.search_frames("private") == []
