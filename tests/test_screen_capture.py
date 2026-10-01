from datetime import UTC, datetime

from backend.evidence_store import EvidenceStore
from backend.screen_capture import CapturedScreen, CapturePolicy, ScreenCaptureService


class FakeScreenSource:
    def __init__(self, image: bytes = b"first-image") -> None:
        self.image = image
        self.calls = 0

    def capture_primary(self) -> CapturedScreen:
        self.calls += 1
        return CapturedScreen(data=self.image, monitor="DISPLAY1", suffix=".webp")


def test_capture_is_deduplicated_and_saved_as_local_evidence(tmp_path) -> None:
    source = FakeScreenSource()
    service = ScreenCaptureService(
        store=EvidenceStore(tmp_path / "recall.db"),
        frames_dir=tmp_path / "frames",
        source=source,
        policy=CapturePolicy(),
    )
    first = service.capture_once(
        application="Chrome",
        window_title="Qdrant documentation",
        timestamp=datetime(2026, 10, 1, 10, 0, tzinfo=UTC),
    )
    second = service.capture_once(
        application="Chrome",
        window_title="Qdrant documentation",
        timestamp=datetime(2026, 10, 1, 10, 1, tzinfo=UTC),
    )

    assert first is not None
    assert first.path.exists()
    assert second is None
    assert source.calls == 2
    assert len(service.store.search_frames("Qdrant")) == 1


def test_capture_respects_application_and_window_exclusions(tmp_path) -> None:
    source = FakeScreenSource()
    service = ScreenCaptureService(
        store=EvidenceStore(tmp_path / "recall.db"),
        frames_dir=tmp_path / "frames",
        source=source,
        policy=CapturePolicy(excluded_applications=("1Password",), excluded_window_terms=("private",)),
    )

    blocked_app = service.capture_once(
        application="1Password", window_title="Vault", timestamp=datetime.now(UTC)
    )
    blocked_window = service.capture_once(
        application="Chrome", window_title="Private browsing", timestamp=datetime.now(UTC)
    )

    assert blocked_app is None
    assert blocked_window is None
    assert source.calls == 0
