# Task 05 — Demo Harness (Codex agent in `wt-demo`)

> **Task ID:** 05
> **Worktree:** `../wt-demo` (branch `feat/demo`)
> **Scope boundary:** `scripts/`
> **Do NOT touch:** `backend/`, `src/openchronicle/`, `frontend/`, `docs/`

---

## Your mission

Build the demo harness that lets the orchestrator rehearse and deliver the 5-beat demo script without writing any ad-hoc commands. Three deliverables:

1. **`scripts/seed.py`** — generates ~250 realistic personal-activity memory records (browser research, code edits, slack messages, mail reads, tool usage) and pushes them to the backend via `POST /memories`. Includes the specific seed corpus that drives the demo beats: 1 prior research session matching the live demo's "What did I research about Qdrant Edge yesterday?" query, 1 supersede case (v1 → v2) for the version story, and a mix of PRIVATE vs SYNCABLE memories for the privacy story.

2. **`scripts/kill_network.py`** — flips the backend's `RECALL_NETWORK_ONLINE` flag via `POST /network/toggle`. CLI: `python scripts/kill_network.py offline` / `online` / `status`.

3. **`scripts/judge_queries.json`** — a curated set of 10 queries a judge might ask, each with the expected top-1 result's `dedup_key` and a 1-line "why this matches" note. Used for rehearsing the `AskMemoryBox` demo beat.

You are **the demo's safety net** — if the harness is wrong, the demo dies. Build accordingly.

---

## Why Qdrant Edge is the protagonist here

The harness is what makes the Qdrant Edge story visceral. Specifically:

- **Seed corpus design:** the prior research session that the offline search returns IS the proof that Qdrant Edge does in-process semantic search. If search returned nothing when offline, the whole story collapses. Your seed makes the killer demo beat work.
- **`kill_network.py` framing:** the script is honestly named. It does NOT touch `iptables` or `tc` or `nmcli`. It flips an env var. The runbook (Task 07) explicitly says this to judges. Honesty about the simulation is what separates a credible demo from a vaporware demo.
- **Judge queries:** the curated list of 10 questions a judge might ask — with the expected matching `dedup_key` pre-computed — is what lets the orchestrator rehearse the search beat 3 times without surprises. If a query returns the wrong top-1, you find out in rehearsal, not on stage.
- **Privacy corpus mix:** the seed must include both PRIVATE memories (banking, password manager) and SYNCABLE memories (GitHub research, VS Code edits, technical articles). The `private_count` in the node state must be non-zero — that's the privacy-story proof point.

---

## Reuse pointers (read BEFORE writing code)

Spend ≤10 minutes here.

1. **OpenChronicle → `src/openchronicle/capture/ax_capture.py`** — for the data shape of a real captured event
   - Your seed script should produce events that look like real AX-tree captures, so the timeline renders realistically.
   - e.g. `{app_name: "Chrome", url: "https://qdrant.tech/documentation/edge/", focused_element: "Qdrant Edge documentation page", window_title: "Qdrant Edge — Google Chrome", edited_text: null}`

2. **`qdrant-labs/qdrant-demo` → `smart_glasses/`** or similar PoC (browse https://github.com/qdrant-labs/qdrant-demo)
   - Read their seed script for the pattern: generate synthetic input → bulk insert.
   - Our seed is text-based (browser/code activity, not image frames) and uses our backend's `POST /memories` (the backend does the embedding).
   - **Do not clone their repo.** Read for pattern only.

3. **No other upstream code to lift.** This module is pure new code.

---

## Spec

### `scripts/seed.py`

**CLI:** `python scripts/seed.py [--reset] [--count N=250] [--api-base URL=http://localhost:8000] [--print-keys]`

**Behavior:**
1. If `--reset`, call `DELETE /memories/all` (Task 02 may need to add — flag in integration; alternatively, delete the `.qdrant_local` directory directly via shell before starting the server).
2. If `--print-keys`, after seeding, print the actual `memory_id` and `dedup_key` of each canonical seed event so the orchestrator can update `judge_queries.json`.
3. Generate `N` `Memory` payloads. The corpus MUST include these specific seeded events (used by the demo beats):

| Required seed memory (concept)                                                                    | Why                                                                       |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Prior Qdrant Edge research session — Chrome, browsed qdrant.tech/documentation/edge/, read about local mode + sync, took notes | The prior session that the live "What did I research yesterday?" query returns. v1 timestamped yesterday morning, v2 timestamped yesterday afternoon (the supersede case for the version story). |
| 5–10 paraphrased Qdrant research events — "explored offline vector stores", "looked up edge sync patterns", etc. | Tests semantic recall (paraphrase matching). Must NOT be tokenized-matchable but SHOULD be vector-matchable. |
| 1Password access events — opened the 1Password app, viewed vault, copied password to clipboard | The PRIVATE memory story. `bundle_id=com.1password.7` triggers the app override → privacy=PRIVATE even though memory_type could be TOOL. Stays local. Never syncs. |
| Online banking — opened banking website, viewed statements                                          | The PRIVATE memory story. `bundle_id=com.bank.*` triggers the override → privacy=PRIVATE. Stays local. |
| 5–10 GitHub research events — browsed qdrant-labs/qdrant-client, qdrant-labs/qdrant-demo, Einsia/OpenChronicle | SYNCABLE memories that the privacy gate allows through to the outbox. |
| 5–10 VS Code edit events — wrote Python code, edited FastAPI routes, committed to git             | SYNCABLE memories (memory_type=TOOL). |
| 5–10 Slack/Discord work messages                                                                   | SYNCABLE memories (memory_type=PROJECT). |
| 5–10 Mail reads                                                                                    | PRIVATE memories (PII — email content is private). |
| ~200 random activity events across 6–8 apps                                                        | Realistic timeline density for the dashboard. |

4. POST the batch to `/memories` (chunked at 50 per request).
5. Print a summary: `Seeded 250 memories · 247 stored · 3 dedup · 47 PRIVATE · 203 SYNCABLE · 0 conflicts (offline at seed time)`.

**Critical:** the prior Qdrant research memory must use the EXACT phrasing variants in `judge_queries.json` so the search demo returns it as top-1.

### `scripts/kill_network.py`

**CLI:** `python scripts/kill_network.py [offline|online|status]`

**Behavior:**
- `offline` → `POST /network/toggle { online: false }` → prints `Network: OFFLINE`
- `online` → `POST /network/toggle { online: true }` → prints `Network: ONLINE`
- `status` → `GET /node/state` → prints `Network: {status} · local={n} · cloud={n} · pending={n} · private={n}`
- No args → print usage

**Honest naming.** The script does not call `nmcli`, `ip link set down`, `iptables`, or `tc`. It flips an env var on the backend. The runbook explicitly tells judges this. (If a judge asks "is the network actually down?" the answer is: "We simulate offline mode at the application layer — the env var gates the sync engine. The local Qdrant Edge search is unaffected, which is the demo point.")

### `scripts/judge_queries.json`

A JSON array of 10 entries, each shaped:

```json
{
  "id": "q1",
  "query": "What did I research about Qdrant Edge yesterday?",
  "context": "Judge says this after the live demo seed. The live phrasing is 'I researched Qdrant Edge sync architecture yesterday morning'.",
  "expected_top1_dedup_key": "<the dedup_key of the seeded prior Qdrant research v2>",
  "expected_top1_score_min": 0.65,
  "why_it_matches": "Semantic match: query implies research + Qdrant + yesterday. The seeded v2 research session paraphrases this exactly."
}
```

The 10 queries should cover:
1. "What did I research about Qdrant Edge yesterday?" — research recall
2. "What did I look at on Qdrant?" — paraphrase of research
3. "Show me my notes about edge sync" — paraphrase of research
4. "Did I do anything with 1Password?" — PRIVATE recall (still works offline — proves Qdrant Edge is local)
5. "When did I last open VS Code?" — temporal + app lookup
6. "What GitHub repos was I reading?" — aggregation + filter
7. "What Slack messages did I send about Qdrant?" — cross-app recall
8. "Did I look at any banking stuff recently?" — PRIVATE recall
9. "What was I working on around 11am yesterday?" — temporal recall
10. "Show me my project memories from this week" — type filter + temporal

For each, record the `expected_top1_dedup_key` (the dedup_key of the seeded event you expect to be top-1) and a 1-line why.

**Purpose:** the orchestrator runs `python scripts/test_queries.py` during rehearsal. If anything mismatches, you find out before the demo.

### `scripts/test_queries.py`

A tiny CLI: `python scripts/test_queries.py` → loads `judge_queries.json` → for each entry, calls `/memory/search` → prints ACTUAL top-1 vs EXPECTED top-1 → exits 1 if any fails (after printing the score).

---

## Starter stubs

### `scripts/seed.py` — write this, fill in TODOs
```python
"""Seed the Recall backend with a realistic personal-activity memory corpus.

Used by the demo runbook before every rehearsal. Run after starting the backend:
    uvicorn backend.api.server:app --port 8000
    python scripts/seed.py --count 250 --reset --print-keys
"""
import argparse
import json
from datetime import datetime, timedelta, timezone
import httpx
from backend.contracts import Memory, MemoryType, PrivacyClass

API_BASE = "http://localhost:8000"

def make_memory(
    memory_type: MemoryType, summary: str, embedding_text: str,
    app_name: str, url: str | None = None, edited_text: str | None = None,
    bundle_id: str | None = None, minutes_ago: int = 0,
    version: int = 1, supersedes: str | None = None,
    provenance: dict | None = None,
) -> Memory:
    """Helper: construct a Memory with sensible defaults."""
    return Memory(
        memory_type=memory_type,
        summary=summary,
        embedding_text=embedding_text,
        timestamp=datetime.now(timezone.utc) - timedelta(minutes=minutes_ago),
        provenance={"app_name": app_name, "url": url, "bundle_id": bundle_id, "edited_text": edited_text, **(provenance or {})},
        version=version,
        supersedes=supersedes,
        # privacy is computed by backend/policy.py at ingest time
    )

# --- The seed corpus ---

def build_corpus(count: int = 250) -> list[Memory]:
    memories: list[Memory] = []

    # === CRITICAL: the prior Qdrant research session — v1 (yesterday morning) ===
    v1 = make_memory(
        memory_type=MemoryType.TOPIC,
        summary="Researched Qdrant Edge local mode for offline-first personal memory",
        embedding_text="Browsed github.com/qdrant-labs/qdrant-client — read sync_local_to_cloud example. Looked at Qdrant Edge docs page on intermittent connectivity + optional sync. Took notes on the in-process vector engine pattern.",
        app_name="Chrome",
        url="https://qdrant.tech/documentation/edge/",
        bundle_id="com.google.Chrome",
        minutes_ago=60 * 24 + 60 * 4,  # yesterday morning (~28h ago)
    )
    memories.append(v1)

    # === CRITICAL: the v2 (yesterday afternoon) — supersedes v1 ===
    v2 = make_memory(
        memory_type=MemoryType.TOPIC,
        summary="Re-researched Qdrant Edge — confirmed sync architecture, ready to implement",
        embedding_text="Re-read Qdrant Edge documentation. Confirmed the in-process vector engine uses the same API as Qdrant Cloud. Decided to fork OpenChronicle and swap its FTS5 store for Qdrant local mode. Sync architecture is clear: local-mode client + cloud client, push on reconnect.",
        app_name="Chrome",
        url="https://qdrant.tech/documentation/edge/",
        bundle_id="com.google.Chrome",
        minutes_ago=60 * 24 + 60 * 1,  # yesterday afternoon (~25h ago)
        version=2,
        supersedes=v1.memory_id,
    )
    memories.append(v2)

    # === CRITICAL: 1Password access — PRIVATE (app override wins) ===
    for i in range(5):
        memories.append(make_memory(
            memory_type=MemoryType.TOOL,
            summary="Opened 1Password to copy a credential",
            embedding_text=f"Opened 1Password app — viewed vault entry #{i} — copied password to clipboard.",
            app_name="1Password",
            bundle_id="com.1password.7",
            minutes_ago=60 * (i + 1),
        ))

    # === CRITICAL: Banking — PRIVATE ===
    for i in range(3):
        memories.append(make_memory(
            memory_type=MemoryType.USER,
            summary=f"Checked bank account balance — statement review",
            embedding_text=f"Opened banking website — viewed checking account statement — recent transactions visible.",
            app_name="Safari",
            url="https://bank.example.com/accounts",
            bundle_id="com.apple.Safari",
            minutes_ago=60 * 12 * (i + 1),
        ))

    # === SYNCABLE: GitHub research ===
    github_repos = [
        ("qdrant-labs/qdrant-client", "Qdrant Python client — read sync_local_to_cloud example"),
        ("qdrant-labs/qdrant-demo", "Qdrant demo — studied smart-glasses offline memory PoC"),
        ("Einsia/OpenChronicle", "OpenChronicle — forked as base for personal activity memory"),
        ("mem0ai/mem0", "mem0 — noted their local-mode Qdrant pattern"),
        ("mediar-ai/screenpipe", "screenpipe — studied observatory dashboard layout"),
    ]
    for repo, note in github_repos:
        memories.append(make_memory(
            memory_type=MemoryType.TOPIC,
            summary=f"GitHub: {repo}",
            embedding_text=f"Browsed github.com/{repo} — {note}",
            app_name="Chrome",
            url=f"https://github.com/{repo}",
            bundle_id="com.google.Chrome",
            minutes_ago=60 * 6 + hash(repo) % 300,
        ))

    # === SYNCABLE: VS Code edits ===
    for i in range(10):
        memories.append(make_memory(
            memory_type=MemoryType.TOOL,
            summary=f"VS Code: edited backend/contracts.py",
            embedding_text=f"Edited file backend/contracts.py in VS Code — added MemoryType enum and PrivacyClass. Committed to git.",
            app_name="VS Code",
            bundle_id="com.microsoft.VSCode",
            edited_text="class MemoryType(str, Enum):",
            minutes_ago=60 * 2 + i * 5,
        ))

    # === SYNCABLE: Slack work messages ===
    for i in range(8):
        memories.append(make_memory(
            memory_type=MemoryType.PROJECT,
            summary=f"Slack: discussed Qdrant Edge integration",
            embedding_text=f"Sent Slack message in #hackathon channel: 'Anyone tried Qdrant Edge local mode? Looking for sync examples.'",
            app_name="Slack",
            bundle_id="com.tinyspeck.slackmacgap",
            minutes_ago=60 * 3 + i * 7,
        ))

    # === PRIVATE: Mail reads ===
    for i in range(7):
        memories.append(make_memory(
            memory_type=MemoryType.PERSON,
            summary=f"Read email from colleague",
            embedding_text=f"Opened Mail.app — read message from colleague about project update. Personal info redacted.",
            app_name="Mail",
            bundle_id="com.apple.mail",
            minutes_ago=60 * 5 + i * 8,
        ))

    # === Paraphrased Qdrant research (5-10) — vector-matchable, NOT tokenized-matchable ===
    paraphrases = [
        "Explored offline vector stores for personal memory",
        "Looked up edge sync patterns for intermittent connectivity",
        "Investigated in-process vector engines",
        "Researched Qdrant's local mode + cloud sync API surface",
        "Studied the Qdrant Edge architecture for hackathon",
    ]
    for i, text in enumerate(paraphrases):
        memories.append(make_memory(
            memory_type=MemoryType.TOPIC,
            summary=f"Research session — Qdrant related",
            embedding_text=text,
            app_name="Chrome",
            url="https://qdrant.tech/documentation/",
            bundle_id="com.google.Chrome",
            minutes_ago=60 * 8 + i * 30,
        ))

    # === Fill to count with random activity ===
    import random
    random.seed(42)
    apps = [
        ("Chrome", "com.google.Chrome", MemoryType.TOPIC),
        ("VS Code", "com.microsoft.VSCode", MemoryType.TOOL),
        ("Slack", "com.tinyspeck.slackmacgap", MemoryType.PROJECT),
        ("Mail", "com.apple.mail", MemoryType.PERSON),
        ("Safari", "com.apple.Safari", MemoryType.TOPIC),
        ("1Password", "com.1password.7", MemoryType.TOOL),
    ]
    while len(memories) < count:
        app, bundle, mtype = random.choice(apps)
        memories.append(make_memory(
            memory_type=mtype,
            summary=f"Auto-seeded activity {len(memories)}",
            embedding_text=f"Auto-seeded operational activity {len(memories)} in {app}.",
            app_name=app,
            bundle_id=bundle,
            minutes_ago=random.randint(5, 60 * 24 * 7),
        ))

    return memories[:count]

def reset_backend(api_base: str):
    """Clear local Qdrant."""
    try:
        r = httpx.delete(f"{api_base}/memories/all", timeout=5)
        if r.status_code == 404:
            print("Warning: /memories/all not implemented. Manually delete .qdrant_local/ and restart backend.")
    except Exception as e:
        print(f"Reset skipped: {e}")

def push_batch(api_base: str, memories: list[Memory]) -> dict:
    batch = [m.model_dump(mode="json") for m in memories]
    r = httpx.post(f"{api_base}/memories", json=batch, timeout=30)  # single at a time if /memories/batch doesn't exist
    r.raise_for_status()
    return r.json()

def print_canonical_keys(memories: list[Memory]):
    """Print the dedup_key of canonical events so the orchestrator can update judge_queries.json."""
    print("\n=== Canonical seed keys ===")
    print(f"Qdrant research v1: memory_id={memories[0].memory_id} dedup_key={memories[0].dedup_key}")
    print(f"Qdrant research v2: memory_id={memories[1].memory_id} dedup_key={memories[1].dedup_key}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true")
    ap.add_argument("--count", type=int, default=250)
    ap.add_argument("--api-base", default=API_BASE)
    ap.add_argument("--print-keys", action="store_true")
    args = ap.parse_args()

    if args.reset:
        reset_backend(args.api_base)

    memories = build_corpus(args.count)
    chunk = 1  # POST /memories takes single Memory; loop
    stored = dedup = private = syncable = 0
    for m in memories:
        result = push_batch(args.api_base, [m])
        if isinstance(result, list): result = result[0]
        if result.get("stored"): stored += 1
        elif result.get("dedup"): dedup += 1
        privacy = result.get("privacy", "syncable")
        if privacy == "private": private += 1
        else: syncable += 1

    print(f"Seeded {len(memories)} memories · {stored} stored · {dedup} dedup · {private} PRIVATE · {syncable} SYNCABLE · 0 conflicts (offline at seed time)")
    if args.print_keys:
        print_canonical_keys(memories)

if __name__ == "__main__":
    main()
```

### `scripts/kill_network.py` — write this
```python
"""Toggle the backend's offline simulation. Flips RECALL_NETWORK_ONLINE via /network/toggle.

Honest note for judges: this does NOT call nmcli/iptables/tc. It flips an env var that
gates the sync engine. Local Qdrant Edge search is unaffected — that's the demo point.
"""
import sys
import httpx

API_BASE = "http://localhost:8000"

def toggle(online: bool):
    r = httpx.post(f"{API_BASE}/network/toggle", json={"online": online}, timeout=5)
    r.raise_for_status()
    state = r.json()
    print(f"Network: {'ONLINE' if state['online'] else 'OFFLINE'}")

def status():
    r = httpx.get(f"{API_BASE}/node/state", timeout=5)
    r.raise_for_status()
    state = r.json()
    print(f"Network: {state['status'].upper()} · local={state['local_memory_count']} · cloud={state['cloud_memory_count']} · pending={state['pending_sync_count']} · private={state['private_count']}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python kill_network.py [offline|online|status]")
        sys.exit(1)
    cmd = sys.argv[1]
    if cmd == "offline": toggle(False)
    elif cmd == "online": toggle(True)
    elif cmd == "status": status()
    else: print(f"Unknown: {cmd}"); sys.exit(1)
```

### `scripts/judge_queries.json` — write this
```json
[
  {
    "id": "q1",
    "query": "What did I research about Qdrant Edge yesterday?",
    "context": "Judge says this after the live demo seed. The live phrasing is 'I researched Qdrant Edge sync architecture yesterday morning'.",
    "expected_top1_dedup_key": "SEEDED_QDRANT_RESEARCH_V2",
    "expected_top1_score_min": 0.65,
    "why_it_matches": "Recurrence + research + Qdrant + yesterday. The seeded v2 research session paraphrases this exactly."
  },
  {
    "id": "q2",
    "query": "What did I look at on Qdrant?",
    "context": "Paraphrase test — must NOT match q1 token-by-token.",
    "expected_top1_dedup_key": "SEEDED_QDRANT_RESEARCH_V2",
    "expected_top1_score_min": 0.60,
    "why_it_matches": "Paraphrase of 'researched Qdrant Edge'. Semantic bridge from 'look at' to 'research'."
  },
  {
    "id": "q3",
    "query": "Show me my notes about edge sync",
    "context": "Paraphrase — 'notes' → 'research'; 'edge sync' → 'sync architecture'.",
    "expected_top1_dedup_key": "SEEDED_QDRANT_RESEARCH_V2",
    "expected_top1_score_min": 0.55,
    "why_it_matches": "Paraphrase matches the v2 embedding_text which mentions sync architecture."
  },
  {
    "id": "q4",
    "query": "Did I do anything with 1Password?",
    "context": "PRIVATE recall — proves Qdrant Edge is local (search works offline even for private memories).",
    "expected_top1_dedup_key": "SEEDED_1PASSWORD_ACCESS_1",
    "expected_top1_score_min": 0.55,
    "why_it_matches": "Entity match on '1Password'. PRIVATE memories are searchable locally — they're just never synced."
  },
  {
    "id": "q5",
    "query": "When did I last open VS Code?",
    "context": "Temporal + app lookup.",
    "expected_top1_dedup_key": "ANY_VSCODE_EVENT",
    "expected_top1_score_min": 0.45,
    "why_it_matches": "Type filter on app='VS Code'. Any recent VS Code memory acceptable."
  },
  {
    "id": "q6",
    "query": "What GitHub repos was I reading?",
    "context": "Aggregation + filter test.",
    "expected_top1_dedup_key": "ANY_GITHUB_MEMORY",
    "expected_top1_score_min": 0.50,
    "why_it_matches": "Filter on url contains 'github.com'. Any GitHub-research memory acceptable."
  },
  {
    "id": "q7",
    "query": "What Slack messages did I send about Qdrant?",
    "context": "Cross-app recall — Slack + Qdrant topic.",
    "expected_top1_dedup_key": "ANY_SLACK_QDRANT_MESSAGE",
    "expected_top1_score_min": 0.50,
    "why_it_matches": "Filter on app='Slack' + content includes 'Qdrant'."
  },
  {
    "id": "q8",
    "query": "Did I look at any banking stuff recently?",
    "context": "PRIVATE recall — proves private memories are searchable locally.",
    "expected_top1_dedup_key": "SEEDED_BANKING_ACCESS_1",
    "expected_top1_score_min": 0.50,
    "why_it_matches": "Entity match on 'banking'. PRIVATE memories still searchable offline."
  },
  {
    "id": "q9",
    "query": "What was I working on around 11am yesterday?",
    "context": "Temporal recall — should return whatever activity was at 11am yesterday.",
    "expected_top1_dedup_key": "ANY_ACTIVITY_11AM_YESTERDAY",
    "expected_top1_score_min": 0.35,
    "why_it_matches": "Fuzzy temporal match — any activity around 11am yesterday is acceptable."
  },
  {
    "id": "q10",
    "query": "Show me my project memories from this week",
    "context": "Type filter (PROJECT) + temporal.",
    "expected_top1_dedup_key": "ANY_PROJECT_MEMORY_THIS_WEEK",
    "expected_top1_score_min": 0.40,
    "why_it_matches": "Type filter on memory_type=PROJECT — any recent PROJECT memory acceptable."
  }
]
```

**Note on `expected_top1_dedup_key`:** the literal string tokens (`SEEDED_QDRANT_RESEARCH_V2`, etc.) are placeholders. At seed time, `python scripts/seed.py --print-keys` prints the actual computed `dedup_key` for each canonical event so the orchestrator can paste the real keys into this file before rehearsal.

### `scripts/test_queries.py` — write this
```python
"""Run all judge queries against the backend. Used during rehearsal.
Gate: all 10 must return the expected top-1 dedup_key (or match the 'ANY_*' pattern)."""
import json
import httpx
import sys

API_BASE = "http://localhost:8000"

def main():
    with open("scripts/judge_queries.json") as f:
        queries = json.load(f)

    passes = 0
    for q in queries:
        r = httpx.post(f"{API_BASE}/memory/search",
                       json={"query": q["query"], "top_k": 1}, timeout=10)
        r.raise_for_status()
        results = r.json()
        if not results:
            print(f"{q['id']}: EXPECTED {q['expected_top1_dedup_key']} | ACTUAL NONE ✗")
            continue
        actual = results[0]["dedup_key"]
        score = results[0].get("score", 0)
        expected = q["expected_top1_dedup_key"]
        ok = (actual == expected) or (expected.startswith("ANY_"))
        mark = "✓" if ok else "✗ MISMATCH"
        print(f"{q['id']}: EXPECTED {expected} | ACTUAL {actual} (score {score:.2f}) {mark}")
        if ok: passes += 1

    print(f"\n{passes}/{len(queries)} queries pass")
    if passes < len(queries):
        sys.exit(1)
    print("ALL QUERIES PASS")

if __name__ == "__main__":
    main()
```

---

## Acceptance criteria

- [ ] `python scripts/seed.py --reset --count 250 --print-keys` runs and seeds 250 memories
- [ ] The output prints the actual `memory_id` and `dedup_key` for the canonical Qdrant research v1, v2, and 1Password/banking events (so orchestrator can update `judge_queries.json`)
- [ ] The summary line shows the privacy split: `~47 PRIVATE · ~203 SYNCABLE` (the exact count depends on seed, but PRIVATE must be non-zero)
- [ ] `python scripts/kill_network.py offline` flips the backend; `status` shows OFFLINE
- [ ] `python scripts/kill_network.py online` flips back; `status` shows ONLINE
- [ ] `python scripts/test_queries.py` runs all 10 queries and reports ACTUAL vs EXPECTED for each
- [ ] All 10 queries pass after the `expected_top1_dedup_key` values are populated from the seed run
- [ ] `judge_queries.json` contains the 10 queries with `why_it_matches` notes filled in

---

## Forbidden moves

- ❌ Do not touch `backend/`, `src/openchronicle/`, or `frontend/`
- ❌ Do not call `nmcli`, `iptables`, `tc`, `ip link set` — network toggle is application-layer only
- ❌ Do not pre-compute embeddings client-side — the backend's `POST /memories` does that; you send raw `embedding_text`
- ❌ Do not generate more than 300 memories (24h scope: 250 is plenty)
- ❌ Do not add `pytest` tests for this module — these are scripts, not unit-tested code. Manual rehearsal is the test.
- ❌ Do not skip the PRIVATE corpus — the privacy demo depends on `private_count > 0`

---

## Handoff contract

You expose:
- `scripts/seed.py` — orchestrator runs before each rehearsal
- `scripts/kill_network.py` — orchestrator uses during demo
- `scripts/judge_queries.json` — orchestrator uses to verify query behavior
- `scripts/test_queries.py` — orchestrator uses as rehearsal gate

You consume:
- `POST /memories` — Task 02 exposes
- `POST /network/toggle` — Task 02 exposes
- `GET /node/state` — Task 02 exposes
- `POST /memory/search` — Task 02 exposes
- `DELETE /memories/all` — Task 02 may need to add (flag in integration)

---

## Demo-day alignment

This module is what makes the demo rehearse-able. The orchestrator's flow is:

```bash
# 1. Start backend + frontend
uvicorn backend.api.server:app --port 8000 &
cd frontend && npm run dev &

# 2. Seed
python scripts/seed.py --reset --count 250 --print-keys
# → prints canonical dedup_keys; orchestrator pastes into judge_queries.json

# 3. Verify queries
python scripts/test_queries.py
# → ALL QUERIES PASS (or ≥7/10)

# 4. Rehearse beats 1-5 per 07-runbook.md, using kill_network.py to toggle
```

If `test_queries.py` fails any query, the orchestrator either:
- Fixes the seed corpus (re-runs seed with adjusted phrasings), OR
- Adjusts the demo script to use a query that DOES match (last resort)

---

## Done criteria for the PR

- [ ] All acceptance criteria pass
- [ ] `python scripts/seed.py` actually produces 250 memories against a running backend (verified manually)
- [ ] `python scripts/test_queries.py` passes all 10 after keys are populated
- [ ] No files outside `scripts/` were touched
- [ ] PR description contains: "Demo harness drives the 5-beat rehearsal. Honest about offline simulation (env-var toggle, not nmcli). The seed corpus's paraphrased Qdrant research events prove semantic recall against paraphrased judge queries. PRIVATE corpus (1Password, banking) proves privacy gate works — private_count stays constant before/after sync."
