"""Run the opt-in local Windows foreground-activity collector."""

from __future__ import annotations

import argparse
import json
import time
from urllib.error import URLError
from urllib.request import Request, urlopen

from backend.activity_collector.windows import ActivityPoller, is_supported


def post_event(api_base: str, event: dict) -> None:
    request = Request(
        f"{api_base.rstrip('/')}/activities",
        data=json.dumps(event).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=5):  # noqa: S310 - user-selected localhost API
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="Record local foreground app/window history into Recall Edge.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--interval-seconds", type=float, default=3.0)
    parser.add_argument("--heartbeat-seconds", type=float, default=60.0)
    args = parser.parse_args()
    if not is_supported():
        parser.error("The Windows activity collector can only run on Windows.")
    if args.interval_seconds <= 0:
        parser.error("--interval-seconds must be positive")

    poller = ActivityPoller(heartbeat_seconds=args.heartbeat_seconds)
    print("Recall Edge foreground activity collector running. Press Ctrl+C to stop.")
    while True:
        event = poller.next_event()
        if event is not None:
            try:
                post_event(args.api_base, event.model_dump(mode="json"))
                print(f"Recorded {event.app_name}: {event.window_title[:80]}")
            except URLError as error:
                print(f"Recall Edge API unavailable: {error.reason}")
        time.sleep(args.interval_seconds)


if __name__ == "__main__":
    main()
