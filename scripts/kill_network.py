"""Toggle Recall Edge's application-layer offline mode; no system network settings are changed."""
from __future__ import annotations

import argparse

import httpx


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["offline", "online", "status"])
    parser.add_argument("--api-base", default="http://localhost:8000")
    args = parser.parse_args()
    if args.mode == "status":
        state = httpx.get(f"{args.api_base}/node/state", timeout=10).json()
        print(f"Network: {state['status'].upper()} · local={state['local_memory_count']} · pending={state['pending_sync_count']} · private={state['private_count']}")
        return
    online = args.mode == "online"
    httpx.post(f"{args.api_base}/network/toggle", json={"online": online}, timeout=10).raise_for_status()
    print(f"Network: {'ONLINE' if online else 'OFFLINE'}")


if __name__ == "__main__":
    main()
