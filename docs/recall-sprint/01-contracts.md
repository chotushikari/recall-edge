# Task 01 — Contracts + Repo Skeleton

> **Owner:** You (not a Codex agent)
> **Time budget:** 30 minutes
> **Why you:** Every agent downstream depends on these contracts being exactly right. If an agent writes them, you get drift. You write them once, all 4 worktrees pull `main`, and the parallel agents stay in sync.

---

## Goal

By the end of this task, `main` contains:
1. A complete fork-of-OpenChronicle repo skeleton with our new directories added
2. `backend/contracts.py` — Pydantic models every agent imports
3. `backend/.env.example` — environment variable contract
4. `backend/policy.py` — the deterministic privacy classifier (USER/PERSON → PRIVATE; others → SYNCABLE)
5. `README.md` at repo root — one-paragraph project description noting OpenChronicle parentage
6. `pyproject.toml` — declares `fastapi`, `qdrant-client`, `fastembed`, `pydantic`, `sqlite`, `aiosqlite` deps

After this commit, you create 4 worktrees and spawn Codex agents into them.

---

## Repo skeleton (fork OpenChronicle, then add these dirs)

You start by forking OpenChronicle:

```bash
cd /home/z/my-project
git clone https://github.com/Einsia/OpenChronicle.git recall
cd recall
git remote add upstream https://github.com/Einsia/OpenChronicle.git
git checkout -b hackathon-main
```

Then add our new directories **alongside** OpenChronicle's existing `src/openchronicle/`:

```
recall/                                 ← forked from Einsia/OpenChronicle
├── src/openchronicle/                  ← OpenChronicle's existing code (DO NOT MODIFY except store/fts.py at integration)
│   ├── capture/                        ← OpenChronicle's AX-tree pipeline (kept as-is)
│   ├── writer/                         ← OpenChronicle's classifier + session_reducer (kept as-is)
│   ├── store/                          ← OpenChronicle's SQLite FTS5 (replaced at integration by our Qdrant swap)
│   │   └── fts.py                       ← THIS FILE GETS REPLACED by wt-store's Qdrant wrapper
│   ├── session/                        ← OpenChronicle's session cutting (kept as-is)
│   ├── mcp/                            ← OpenChronicle's MCP server (kept as-is; we wrap it)
│   ├── cli.py
│   └── daemon.py
├── backend/                            ← OUR NEW CODE
│   ├── __init__.py
│   ├── contracts.py                    ← YOU WRITE THIS (stub below)
│   ├── policy.py                       ← YOU WRITE THIS (stub below)
│   ├── qdrant_local/                   ← Task 02 fills this (the Qdrant Edge wrapper)
│   ├── sync/                           ← Task 03 fills this (outbox + cloud push)
│   └── api/                            ← Task 02 + 04 fill this (FastAPI server)
├── frontend/                           ← Task 04 fills this (Next.js or Jinja2 — pick in 04-dashboard.md)
├── scripts/                            ← Task 05 fills this (seed + kill-network + judge queries)
├── docs/
│   └── recall-sprint/                  ← this prompt pack
├── .env.example                        ← YOU WRITE THIS (stub below)
├── pyproject.toml                      ← YOU EDIT (add our deps to OpenChronicle's existing file)
└── README.md                           ← YOU EDIT (prepend our project description)
```

```bash
# scaffold (run this once)
mkdir -p backend/qdrant_local backend/sync backend/api frontend scripts
touch backend/__init__.py backend/qdrant_local/__init__.py backend/sync/__init__.py backend/api/__init__.py

# copy the sprint pack in
cp -r /home/z/my-project/docs/recall-sprint docs/recall-sprint
```

---

## `backend/contracts.py` — write this verbatim, then commit

```python
"""
Recall — shared contracts.

Forked from Einsia/OpenChronicle (MIT). We extend OpenChronicle's typed-memory
classifier with a privacy policy (private vs syncable) and add a sync engine
for Qdrant Edge → Qdrant Cloud.

Architectural inheritance:
- AX-tree capture pipeline: reused from OpenChronicle src/openchronicle/capture/
- Typed-memory classifier: reused from OpenChronicle src/openchronicle/writer/classifier.py
- Supersede-not-delete versioning: reused from OpenChronicle writer/session_reducer.py
- Qdrant local-mode instantiation pattern: adapted from mem0's storage.py (Apache-2.0)
- Local → cloud sync skeleton: adapted from qdrant-client examples/sync_local_to_cloud (Apache-2.0)
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


CONTRACTS_VERSION = "1.0.0"


# === Memory types — inherited from OpenChronicle's classifier ===
# These 6 types are what OpenChronicle's writer/classifier.py emits.
# We add the privacy policy on top: USER/PERSON → PRIVATE; others → SYNCABLE.

class MemoryType(str, Enum):
    USER = "user"           # personal info → PRIVATE
    PROJECT = "project"     # work/projects → SYNCABLE
    TOOL = "tool"           # tools used → SYNCABLE
    TOPIC = "topic"         # research/topics → SYNCABLE
    PERSON = "person"       # contacts/people → PRIVATE (default)
    ORG = "org"             # organizations → SYNCABLE


class PrivacyClass(str, Enum):
    PRIVATE = "private"      # EDGE ONLY, never syncs to cloud
    SYNCABLE = "syncable"    # EDGE + CLOUD sync eligible


class NodeStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    SYNCING = "syncing"


# === ActivityEvent — the raw captured activity (from OpenChronicle's AX-tree) ===

class ActivityEvent(BaseModel):
    """
    A raw activity captured by OpenChronicle's ax_capture.py.

    This is the input shape. OpenChronicle's writer/ pipeline turns these into
    typed Memory records (see below). We store BOTH in Qdrant Edge — activities
    as the source-of-truth, memories as the searchable summaries.
    """
    event_id: str = Field(default_factory=lambda: uuid4().hex)
    dedup_key: str = Field(description="sha256(timestamp|app|focused_element). Computed on capture.")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    app_name: str = Field(description="e.g. 'Chrome', 'VS Code', 'Slack', 'Mail'")
    window_title: str = ""
    url: Optional[str] = None
    bundle_id: Optional[str] = Field(default=None, description="macOS app bundle ID")
    focused_element: Optional[str] = Field(default=None, description="AX-tree focused element")
    edited_text: Optional[str] = Field(default=None, description="if user was typing (transcribed)")
    embedding_text: str = Field(default="", description="Natural-language rendering for embedding.")

    @staticmethod
    def make_dedup_key(timestamp: datetime, app: str, focused_element: Optional[str]) -> str:
        canonical = f"{timestamp.isoformat()}|{app}|{focused_element or ''}"
        return hashlib.sha256(canonical.encode()).hexdigest()


# === Memory — the searchable, typed, versioned record ===

class Memory(BaseModel):
    """
    A derived memory — produced by OpenChronicle's writer/classifier.py +
    session_reducer.py from one or more ActivityEvents.

    THE VERSIONING CONTRACT (inherited from OpenChronicle):
    - When new info supersedes old, create a new Memory with version = old.version + 1.
    - Set this Memory's `supersedes` to the old memory_id.
    - The old Memory is NOT deleted — it's preserved with `superseded_by` set.
    - Search returns the latest version by default; history is queryable.

    THE PRIVACY CONTRACT (our PS03 addition):
    - `privacy` is computed deterministically from `memory_type`:
      USER, PERSON → PRIVATE; PROJECT, TOOL, TOPIC, ORG → SYNCABLE.
    - PRIVATE memories never enter the sync outbox.
    - SYNCABLE memories enter the outbox on next sync tick.
    """
    memory_id: str = Field(default_factory=lambda: uuid4().hex)
    dedup_key: str = Field(description="sha256(memory_id). Same content → same key for dedup.")
    source_activity_ids: list[str] = Field(default_factory=list)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    memory_type: MemoryType
    summary: str = Field(description="Short human-readable summary, e.g. 'Researched Qdrant Edge sync architecture'")
    embedding_text: str = Field(description="Longer text for embedding. Includes summary + key context.")
    embedding: Optional[list[float]] = Field(default=None, description="Filled by ingest pipeline.")

    # Privacy (the killer PS03 addition)
    privacy: PrivacyClass = Field(description="PRIVATE = edge-only; SYNCABLE = edge + cloud.")

    # Versioning (inherited from OpenChronicle's supersede system)
    version: int = 1
    supersedes: Optional[str] = Field(default=None, description="memory_id of the prior version this replaces.")
    superseded_by: Optional[str] = Field(default=None, description="memory_id of the newer version, if any.")
    provenance: dict[str, Any] = Field(default_factory=dict, description="How this memory was derived: {session_id, classifier_version, source_apps}")

    # Sync state
    local_only: bool = Field(default=True, description="True if not yet pushed to cloud (only meaningful if privacy=SYNCABLE).")
    origin_node: str = Field(default="edge-node-a", description="Which device created this. For multi-device, defaults to env RECALL_NODE_ID.")

    @staticmethod
    def make_dedup_key(memory_id: str) -> str:
        return hashlib.sha256(memory_id.encode()).hexdigest()


# === Sync contracts ===

class SyncBatch(BaseModel):
    """A batch of memories pushed from edge → cloud in one request."""
    batch_id: str = Field(default_factory=lambda: uuid4().hex)
    node_id: str
    memory_dedup_keys: list[str]
    idempotency_key: str = Field(default_factory=lambda: uuid4().hex,
                                  description="Same key + same payload → server returns cached result.")


class SyncResult(BaseModel):
    """What the cloud returns per batch."""
    batch_id: str
    synced: list[str] = Field(default_factory=list, description="dedup_keys successfully written to cloud.")
    already_existed: list[str] = Field(default_factory=list, description="dedup_keys already in cloud (dedup).")
    superseded_in_cloud: list[str] = Field(default_factory=list, description="dedup_keys where cloud had an older version; cloud got superseded.")
    conflicts: list[str] = Field(default_factory=list, description="dedup_keys where cloud has a NEWER version than edge; human review required (24h: rare, usually means another device wrote first).")


# === Node status (for the dashboard header) ===

class NodeState(BaseModel):
    node_id: str
    status: NodeStatus
    local_memory_count: int
    cloud_memory_count: int
    pending_sync_count: int
    private_count: int = Field(description="Count of PRIVATE memories — never synced.")
    last_sync_at: Optional[datetime] = None
    last_seen_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# === Constants ===

COLLECTION_NAME = "recall_memories"
QDRANT_LOCAL_PATH = "./.qdrant_local"
SYNC_OUTBOX_DB = "./.recall_sync.db"

EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"  # fastembed default; 384-dim
EMBEDDING_DIM = 384
```

---

## `backend/policy.py` — write this verbatim

```python
"""
Deterministic memory-policy engine.

Maps MemoryType → PrivacyClass via a simple lookup table. NO ML — fast, auditable,
demo-able. This is the killer PS03 differentiator: "the edge layer decides which
memories are eligible for synchronization."

User can override per-app or per-pattern via a simple TOML config (loaded at startup).
For 24h: just the lookup table.
"""
from backend.contracts import MemoryType, PrivacyClass, Memory

# Default policy: deterministic mapping from memory type to privacy class
DEFAULT_POLICY: dict[MemoryType, PrivacyClass] = {
    MemoryType.USER: PrivacyClass.PRIVATE,
    MemoryType.PERSON: PrivacyClass.PRIVATE,
    MemoryType.PROJECT: PrivacyClass.SYNCABLE,
    MemoryType.TOOL: PrivacyClass.SYNCABLE,
    MemoryType.TOPIC: PrivacyClass.SYNCABLE,
    MemoryType.ORG: PrivacyClass.SYNCABLE,
}

# App-level overrides — extend at runtime via config
APP_OVERRIDES: dict[str, PrivacyClass] = {
    # Banking / finance apps → always private
    "com.1password.*": PrivacyClass.PRIVATE,
    "com.apple.passwords": PrivacyClass.PRIVATE,
    "com.bank.*": PrivacyClass.PRIVATE,
    "com.bitwarden.*": PrivacyClass.PRIVATE,
    # Private browsing → always private
    "org.mozilla.firefox.private": PrivacyClass.PRIVATE,
    # Email → private (PII)
    "com.apple.mail": PrivacyClass.PRIVATE,
    "com.freron.MailMate": PrivacyClass.PRIVATE,
    # Slack / Discord → syncable (work context)
    "com.tinyspeck.slackmacgap": PrivacyClass.SYNCABLE,
    "com.hnc.Discord": PrivacyClass.SYNCABLE,
}


def classify_privacy(memory_type: MemoryType, bundle_id: Optional[str] = None) -> PrivacyClass:
    """
    Determine the privacy class for a memory.

    Rule 1: app-level override wins (e.g. 1Password is always PRIVATE regardless of type).
    Rule 2: type-level default applies (USER/PERSON → PRIVATE; others → SYNCABLE).
    """
    # Check app overrides
    if bundle_id:
        for pattern, privacy in APP_OVERRIDES.items():
            if pattern.endswith(".*"):
                prefix = pattern[:-2]
                if bundle_id.startswith(prefix):
                    return privacy
            elif bundle_id == pattern:
                return privacy
    return DEFAULT_POLICY.get(memory_type, PrivacyClass.PRIVATE)


def apply_policy(memory: Memory, bundle_id: Optional[str] = None) -> Memory:
    """Compute and set the privacy field on a memory. Idempotent."""
    memory.privacy = classify_privacy(memory.memory_type, bundle_id)
    return memory
```

(Add `Optional` to the imports at the top of `policy.py` — `from typing import Optional`.)

---

## `.env.example` — write this verbatim

```bash
# Recall environment contract. Copy to .env for local dev.

# Which edge node am I? Used in Memory.origin_node.
RECALL_NODE_ID=edge-node-a

# Qdrant — local mode first; switch to Edge beta when access lands.
RECALL_QDRANT_MODE=local          # 'local' | 'edge' | 'cloud'
RECALL_QDRANT_LOCAL_PATH=./.qdrant_local
RECALL_QDRANT_EDGE_HOST=
RECALL_QDRANT_EDGE_PORT=
RECALL_QDRANT_CLOUD_URL=
RECALL_QDRANT_CLOUD_API_KEY=

# FastAPI
RECALL_API_HOST=0.0.0.0
RECALL_API_PORT=8000

# Sync engine
RECALL_SYNC_INTERVAL_SECONDS=15
RECALL_SYNC_BATCH_SIZE=50
RECALL_NETWORK_ONLINE=true         # demo harness flips this to simulate offline

# OpenChronicle (existing) — keep their defaults
OPENCHRONICLE_CAPTURE_INTERVAL=2
OPENCHRONICLE_SESSION_IDLE_MINUTES=5
OPENCHRONICLE_SESSION_APPSWITCH_MINUTES=3

# Frontend
RECALL_DASHBOARD_PORT=3000
RECALL_API_BASE=http://localhost:8000
```

---

## `pyproject.toml` — append our deps to OpenChronicle's existing file

OpenChronicle's `pyproject.toml` already has its own dependencies. **Do not delete them.** Just add ours to the `[project] dependencies` list:

```toml
# Add these to OpenChronicle's existing dependencies list:
"fastapi>=0.115",
"uvicorn[standard]>=0.32",
"qdrant-client>=1.12",
"fastembed>=0.3",
"aiosqlite>=0.20",
"httpx>=0.27",
"python-dotenv>=1.0",
"typer>=0.13",

# Add a dev extras group:
[project.optional-dependencies]
dev = ["pytest>=8.3", "pytest-asyncio>=0.24", "ruff>=0.7"]

[tool.ruff]
line-length = 100
target-version = "py311"

[tool.pytest.ini_options]
asyncio_mode = "auto"
```

---

## Root `README.md` — prepend our description

OpenChronicle's existing README is good. Prepend this at the top:

```markdown
# Recall (hackathon fork of Einsia/OpenChronicle)

> Personal-activity memory on Qdrant Edge. Forked from OpenChronicle (MIT) — keeps the AX-tree capture pipeline and supersede-not-delete versioning; swaps SQLite FTS5 for Qdrant Edge in-process vector search; adds a deterministic memory-policy engine (private vs syncable), a SQLite-outbox → Qdrant Cloud sync path, and a chat UI showing retrieval evidence with privacy badges.

See `docs/recall-sprint/00-README.md` for the 24h sprint orchestration plan.

---

# OpenChronicle (upstream)

> [OpenChronicle's original README content follows below...]
```

---

## Acceptance criteria (before you commit)

- [ ] `backend/contracts.py` exists and imports cleanly: `python -c "from backend.contracts import ActivityEvent, Memory, MemoryType, PrivacyClass, SyncBatch"`
- [ ] `backend/policy.py` exists and `classify_privacy(MemoryType.USER) == PrivacyClass.PRIVATE` and `classify_privacy(MemoryType.PROJECT) == PrivacyClass.SYNCABLE`
- [ ] App override works: `classify_privacy(MemoryType.TOOL, bundle_id="com.1password.7") == PrivacyClass.PRIVATE` (1Password override wins)
- [ ] Repo skeleton matches the tree above (every directory exists)
- [ ] `.env.example` exists
- [ ] `pyproject.toml` has our deps appended (not replacing OpenChronicle's)
- [ ] Root `README.md` has our project description prepended
- [ ] OpenChronicle still runs: `python -m openchronicle --help` returns without error
- [ ] Sprint prompt pack copied into `docs/recall-sprint/`
- [ ] All committed to `hackathon-main`: `git log --oneline` shows `Task 01: contracts + repo skeleton`

Once these pass, proceed to the worktree setup in `00-README.md` and spawn the 4 Codex agents.

---

## Handoff to parallel agents

Each Codex agent receives:
1. Its prompt file (`02-capture-and-store.md`, etc.)
2. `00-README.md` (orchestrator)
3. `00-reuse-map.md` (OpenChronicle file-level pointers)
4. `01-contracts.md` (this file — so it knows the contracts it must consume)
5. The worktree path to work in

The agent must `git pull hackathon-main` (or just have main pulled fresh when the worktree is created), then work ONLY in its scoped directory. **No agent touches `contracts.py` or `policy.py`** — those files are frozen for the duration of the sprint. If an agent needs a new contract, it stops work and surfaces the request; you (the orchestrator) decide whether to add it.

**Critical note about `src/openchronicle/store/fts.py`:** this file gets REPLACED at integration time (Task 06) by the Qdrant Edge wrapper from Task 02. Until then, OpenChronicle's existing `fts.py` stays in place. The agent in `wt-store` writes `backend/qdrant_local/` and a NEW `backend/api/` server; it does NOT touch `src/openchronicle/store/fts.py` directly. The orchestrator wires the swap at integration.
