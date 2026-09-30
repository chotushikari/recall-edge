"""Seed a realistic Recall Edge corpus through the public API."""
from __future__ import annotations

import argparse
from datetime import UTC, datetime, timedelta

import httpx

API_BASE = "http://localhost:8000"


def memory(memory_type: str, summary: str, text: str, app_name: str, hours_ago: int, **provenance: str) -> dict:
    return {"memory_type": memory_type, "summary": summary, "embedding_text": text, "timestamp": (datetime.now(UTC) - timedelta(hours=hours_ago)).isoformat(), "provenance": {"app_name": app_name, **provenance}}


def build_corpus(count: int) -> list[dict]:
    qdrant_v1 = memory("topic", "Explored local vector memory architecture", "Browsed Qdrant documentation and compared in-process vector storage for offline personal memory.", "Chrome", 28, url="https://qdrant.tech/documentation/")
    corpus = [qdrant_v1]
    private = [
        memory("tool", "Opened password vault", "Opened 1Password and viewed a credential entry.", "1Password", 4, bundle_id="com.1password.7"),
        memory("user", "Reviewed bank account statement", "Viewed a recent banking statement and account balance.", "Safari", 8, bundle_id="com.bank.example"),
        memory("person", "Read project email", "Read a private email from a colleague about a project update.", "Mail", 6, bundle_id="com.apple.mail"),
    ]
    public = [
        memory("tool", "Edited FastAPI memory route", "Worked in VS Code on the local Qdrant memory API and committed the implementation.", "VS Code", 3, bundle_id="com.microsoft.VSCode"),
        memory("project", "Discussed edge memory sync", "Sent a Slack update about Qdrant Edge offline search and synchronization architecture.", "Slack", 5, bundle_id="com.tinyspeck.slackmacgap"),
        memory("topic", "Read qdrant-client repository", "Read GitHub examples for Qdrant local collections and cloud synchronization.", "Chrome", 7, url="https://github.com/qdrant/qdrant-client"),
    ]
    corpus.extend(private + public)
    index = 0
    while len(corpus) < count:
        app, memory_type = [("Chrome", "topic"), ("VS Code", "tool"), ("Slack", "project")][index % 3]
        corpus.append(memory(memory_type, f"Activity memory {len(corpus) + 1}", f"Recorded {app} activity for a local-first Qdrant memory workspace.", app, index % 120))
        index += 1
    return corpus


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=80)
    parser.add_argument("--reset", action="store_true")
    parser.add_argument("--api-base", default=API_BASE)
    args = parser.parse_args()
    if not 1 <= args.count <= 300:
        parser.error("count must be between 1 and 300")
    client = httpx.Client(base_url=args.api_base, timeout=30)
    if args.reset:
        client.delete("/memories/all").raise_for_status()
    stored = private = 0
    corpus = build_corpus(max(args.count - 1, 1))
    for item in corpus:
        response = client.post("/memories", json=item)
        response.raise_for_status()
        result = response.json()
        stored += int(result["stored"])
        private += int(result["privacy"] == "private")
    v1_id = client.post("/memory/search", json={"query": "offline personal memory Qdrant documentation", "top_k": 1}).json()[0]["memory_id"]
    v2 = memory("topic", "Confirmed Qdrant Edge sync architecture", "Read Qdrant Edge documentation: local vector search works offline and synchronizes with cloud after connectivity returns.", "Chrome", 25, url="https://qdrant.tech/documentation/edge/")
    v2["supersedes"] = v1_id
    response = client.post("/memories", json=v2)
    response.raise_for_status()
    stored += int(response.json()["stored"])
    state = client.get("/node/state").json()
    print(f"Seeded {stored} memories · {private} private · {state['pending_sync_count']} pending sync")


if __name__ == "__main__":
    main()
