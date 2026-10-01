"""Run non-destructive readiness checks before a Recall demo or local deployment.

This script intentionally does not seed, delete, start capture, or alter network
state. Use ``scripts/seed.py --reset`` only in a disposable demo environment.
"""
from __future__ import annotations

import argparse

import httpx


def check(client: httpx.Client, path: str, label: str) -> bool:
    try:
        response = client.get(path)
        response.raise_for_status()
    except httpx.HTTPError as error:
        print(f"FAIL {label}: {error}")
        return False
    print(f"PASS {label}")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Verify a running Recall demo without changing data.")
    parser.add_argument("--api-base", default="http://127.0.0.1:8000")
    parser.add_argument("--dashboard-url", default="http://127.0.0.1:3001")
    args = parser.parse_args()

    healthy = True
    with httpx.Client(base_url=args.api_base, timeout=8) as client:
        for path, label in (
            ("/health", "local API health"),
            ("/node/state", "local memory node"),
            ("/activities/capture/status", "activity capture controls"),
            ("/visual-capture/status", "visual capture controls"),
            ("/sessions?limit=1", "timeline evidence API"),
            ("/evidence/events?limit=1", "event evidence API"),
            ("/evidence/frames?limit=1", "frame evidence API"),
        ):
            healthy = check(client, path, label) and healthy

        if healthy:
            state = client.get("/node/state").json()
            print(
                "INFO local memories={local_memory_count} · private={private_count} · "
                "pending sync={pending_sync_count}".format(**state)
            )

    try:
        response = httpx.get(args.dashboard_url, timeout=8)
        response.raise_for_status()
    except httpx.HTTPError as error:
        print(f"FAIL dashboard: {error}")
        healthy = False
    else:
        print(f"PASS dashboard ({args.dashboard_url})")

    if not healthy:
        print("Preflight failed. Start Recall with: python scripts/launch_recall_edge.py")
        raise SystemExit(1)
    print("Preflight passed. No capture state or local memory was modified.")


if __name__ == "__main__":
    main()
