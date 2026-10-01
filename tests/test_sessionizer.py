from datetime import UTC, datetime, timedelta

from backend.sessionizer import build_sessions


def test_groups_related_events_until_a_real_activity_gap() -> None:
    start = datetime(2026, 10, 1, 9, 0, tzinfo=UTC)
    events = [
        {"id": "code-1", "timestamp_start": start.isoformat(), "application": "Code"},
        {
            "id": "chrome-1",
            "timestamp_start": (start + timedelta(minutes=2)).isoformat(),
            "application": "Chrome",
        },
        {
            "id": "code-2",
            "timestamp_start": (start + timedelta(minutes=4)).isoformat(),
            "application": "Code",
        },
        {
            "id": "terminal-1",
            "timestamp_start": (start + timedelta(minutes=12)).isoformat(),
            "application": "Terminal",
        },
    ]

    sessions = build_sessions(events, gap_seconds=300)

    assert len(sessions) == 2
    assert sessions[0].event_ids == ("code-1", "chrome-1", "code-2")
    assert sessions[0].applications == ("Code", "Chrome")
    assert sessions[0].primary_app == "Code"
    assert sessions[0].summary == "Activity across Code and Chrome."
    assert sessions[1].event_ids == ("terminal-1",)
