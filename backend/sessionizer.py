"""Deterministic reconstruction of activity sessions from raw evidence."""

from __future__ import annotations

import hashlib
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class ReconstructedSession:
    id: str
    start_time: datetime
    end_time: datetime
    primary_app: str
    applications: tuple[str, ...]
    event_ids: tuple[str, ...]
    summary: str


def build_sessions(
    events: Iterable[dict[str, object]], *, gap_seconds: float = 300
) -> list[ReconstructedSession]:
    """Cluster chronological events without inventing an AI task label.

    An app switch remains in the same session. A meaningful inactivity gap
    starts a new one, preserving the sequence needed for later reasoning.
    """
    ordered = sorted(events, key=lambda event: _timestamp(event))
    clusters: list[list[dict[str, object]]] = []
    current: list[dict[str, object]] = []
    previous: datetime | None = None
    for event in ordered:
        timestamp = _timestamp(event)
        if previous is not None and (timestamp - previous).total_seconds() > gap_seconds:
            clusters.append(current)
            current = []
        current.append(event)
        previous = timestamp
    if current:
        clusters.append(current)
    return [_session(cluster) for cluster in clusters]


def _timestamp(event: dict[str, object]) -> datetime:
    return datetime.fromisoformat(str(event["timestamp_start"]).replace("Z", "+00:00"))


def _session(events: list[dict[str, object]]) -> ReconstructedSession:
    applications = tuple(dict.fromkeys(str(event["application"]) for event in events))
    counts = {app: sum(str(event["application"]) == app for event in events) for app in applications}
    primary_app = max(applications, key=lambda app: (counts[app], -applications.index(app)))
    event_ids = tuple(str(event["id"]) for event in events)
    digest = hashlib.sha256("|".join(event_ids).encode()).hexdigest()[:24]
    label = " and ".join(applications) if len(applications) <= 2 else ", ".join(applications[:-1]) + f", and {applications[-1]}"
    return ReconstructedSession(
        id=f"session-{digest}",
        start_time=_timestamp(events[0]),
        end_time=_timestamp(events[-1]),
        primary_app=primary_app,
        applications=applications,
        event_ids=event_ids,
        summary=f"Activity across {label}.",
    )
