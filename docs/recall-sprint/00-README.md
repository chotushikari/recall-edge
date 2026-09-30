# Recall — 24h Hackathon Sprint Pack (Personal Activity Edition)

> **Recall** is a personal-activity memory system on Qdrant Edge. It captures what you actually did on your computer (apps used, browser tabs, files edited, text typed), stores it as semantic memory in **Qdrant Edge** (in-process, offline-first), applies a deterministic privacy policy (private vs syncable), syncs eligible memories to Qdrant Cloud when network returns, and exposes them via a chat UI that shows retrieval evidence — not just an LLM answer.

**Fork base:** [`Einsia/OpenChronicle`](https://github.com/Einsia/OpenChronicle) (MIT, Python, macOS, 2.8k stars, AX-tree capture pipeline, supersede-not-delete versioning already built)

---

## Why this pack exists

You're pivoting from the industrial-ops version to a personal-activity version that better matches PS03. You're running **4 Codex agents in parallel git worktrees** against a **24h clock**. Each agent gets ONE prompt file. This README is the conductor's score.

You will not write production code yourself except for the contracts file (Task 01). Everything else is delegated to Codex agents working in isolated worktrees, then integrated by you in the final third of the day.

---

## Why OpenChronicle, not Dayflow or Bunshin (the brutal honest answer)

Your earlier AI-generated research recommended **Bunshin Memory** as the top pick, with **Dayflow** as the alternate. After verifying all 5 candidates against GitHub directly, I disagree. Here's the brutal assessment:

| Repo              | Stars | License | Lang            | Last commit | Live activity capture? | Versioned memories? | Verdict                                                              |
| ----------------- | ----- | ------- | --------------- | ----------- | ---------------------- | ------------------- | -------------------------------------------------------------------- |
| `JerryZLiu/Dayflow`  | 7.2k  | MIT     | Swift (Xcode)   | 2026-09-25  | ✅ screen-based         | ❌                   | Wrong stack. Integrating the Qdrant *Python* client into Swift = painful FFI/sidecar. Mature commercial product (dayflow.so pricing). Use as **design reference only**, not as a fork base. |
| `Marine923/bunshin-ai` | 0     | MIT     | Python+Electron | 2026-07-13  | ❌ ingests files/emails  | ✅                   | Solo, "Claude Code wrote 90% of this", zero stars, **no live capture**. The pasted research was wrong about fit. Use as search/chat reference only. |
| `Einsia/OpenChronicle` | **2.8k** | **MIT** | **Python**      | 2026-05-09  | **✅ AX-tree**          | **✅ supersede-not-delete** | **TOP PICK.** AX-tree capture = exactly "apps/tabs/files edited" at a fraction of screenshot-OCR cost. Clean `store/` module to swap for Qdrant Edge. Classifier types = memory-policy primitive. Versioning = free. |
| `AnthonyDavidAdams/backscroll` | 3  | MIT     | Python+Swift helper | 2026-07-23 | ✅ screenshot OCR     | ❌                   | Best greenfield base if you'd rather build all of PS03 from a few-hundred-line slate. ~2 commits. Use as alt if OpenChronicle's alpha-status scares you. |
| `irachrist1/daylens` | 1     | MIT     | TypeScript/Electron | 2026-09-07 | ✅ browser/apps         | ❌                   | Most pre-built surface (chat+evidence+policy+web-sync) but large V2-flux codebase. If you'd rather not build a chat UI, pick this and use `qdrant-js`. |

**The case for OpenChronicle in 5 bullets:**

1. **MIT license is clean.** Fork-safe.
2. **Python + macOS + runs today.** Hackathon env = macOS. OpenChronicle runs on macOS 13+ with `bash install.sh && openchronicle start`.
3. **AX-tree capture pipeline is exactly our intake.** `src/openchronicle/capture/ax_capture.py` yields focused element / URL / edited text / active app — this is literally "what apps I used, what tabs I had open, what I typed". Dayflow and Backscroll do screenshot OCR (heavier, slower, noisier).
4. **`store/` is a clean swap seam.** SQLite FTS5 → Qdrant Edge local collection. One module. `entries.py` schema becomes the Qdrant point payload.
5. **`writer/session_reducer.py` already does supersede-not-delete history = versioned memories with provenance.** This is the hardest PS03 piece (per the brutal assessment you pasted) and OpenChronicle gives it to us FREE. Dayflow and Bunshin both lack this.

**Honest gaps we build (the ~13h critical path):**
- Qdrant Edge store swap (~2h) — replace `store/fts.py` with Qdrant in-process client
- Sync queue → Qdrant Cloud (~4h) — SQLite outbox + reconnect-flush + memory-policy gate
- Chat UI with retrieval evidence panel (~4h) — FastAPI + Jinja2 or thin Next.js, calls `store.search` and shows memory cards as cited evidence
- Memory-policy toggle UI (~2h) — wire `policy` field onto each memory + small settings surface
- Seed scripts (~1h) — synthetic activity corpus for the "what did I research yesterday" demo

---

## The Qdrant Edge framing (sponsor-bait — read this twice)

Qdrant's own Edge product page explicitly targets **intermittent-connectivity applications with local data and querying, optional synchronization with a Qdrant Server**. Their only public demos are smart-glasses "where are my keys" and a robot mission-control PoC. Neither demonstrates the personal-computing use case.

**Recall is the demo Qdrant wishes they shipped for personal computing.** Every screen in the dashboard reinforces that the vector engine is in-process: the search box literally says "Local semantic search · Qdrant Edge · in-process" as a subtitle. Every PS03 requirement maps to a visible demo beat.

---

## File tree

```
docs/recall-sprint/
├── 00-README.md                  ← you are here (orchestrator)
├── 00-reuse-map.md                file-level pointers to OpenChronicle's 5 swap seams
├── 01-contracts.md                Pydantic models + repo layout — YOU build this first (≤30 min)
├── 02-capture-and-store.md        Codex agent in wt-store  (Task ID 02) — includes Dayflow Tier 1 endpoints addendum
├── 03-sync-engine.md              Codex agent in wt-sync    (Task ID 03)
├── 04-dashboard.md                Codex agent in wt-ui      (Task ID 04) — includes Dayflow Tier 1 components addendum
├── 05-demo-harness.md             Codex agent in wt-demo    (Task ID 05)
├── 06-integration.md              YOU run this after all 4 merge (Task ID 06)
├── 07-runbook.md                  5-beat personal-activity demo choreography (Task ID 07)
├── 08-judge-qa.md                 6 pre-empted judge questions + 90-sec pitch (Task ID 08)
├── 09-dayflow-parity.md           Dayflow feature matrix: Tier 1 / Tier 2 / Tier 3 / Skip (Task ID 09)
└── 10-codex-prompts.md            Paste-ready starter prompts for 4 Codex sessions + failure-mode recovery (Task ID 10)
```

## Scope expansion note (read this)

The original sprint pack (Tasks 01–08) covers the **PS03-critical** UI and backend — the minimum viable demonstration of edge-native memory with offline search, sync, and conflict review. That's the 24h scope.

The user then asked: "I want all features UI/UX and all things of dayflow in our app too." Brutal honest answer: **24 hours cannot deliver full Dayflow parity** (Dayflow is months of solo-dev work, 7.2k stars, mature commercial product). So we tiered the request:

- **Tier 1 (in scope, ~6h additional):** 8 Dayflow-parity UI components (daily summary, app usage sidebar, calendar heatmap, project filter, quick-add, app icons, pause capture, time range) + 5 backend endpoints. Stubs in `04-dashboard.md` (addendum at bottom) and `02-capture-and-store.md` (addendum at bottom).
- **Tier 2 (stretch, only if running ahead):** focus session detection, weekly trends chart, productivity score, LLM-polished daily summary, real macOS .icns app icons.
- **Tier 3 (roadmap, post-hackathon):** calendar month view, Markdown/PDF export, settings UI, achievements/goals, multi-device sync UI.

Full matrix in `09-dayflow-parity.md`. If running late at T+12h, cut Tier 1 addendum features in the order listed in `09-dayflow-parity.md` — never cut the PS03-critical features in Tasks 01–08.

---

## Parallelism map

| Time    | Who            | Does what                                                                  |
| ------- | -------------- | --------------------------------------------------------------------------- |
| T+0h    | You            | Read all 10 files. Open `01-contracts.md`. Write `contracts.py` + repo skeleton. |
| T+0.5h  | You            | Commit contracts to main. Run the worktree setup block (below).            |
| T+0.5h  | Codex ×4       | Spawn 4 agents in parallel, one per worktree. Each gets its prompt file.   |
| T+8h    | You            | All agents return (the 4h-critical-path tasks finish ~T+6h; agents polish to T+8h). |
| T+8h    | You + 1 Codex  | Open `06-integration.md`. Merge worktrees. Run smoke tests. Fix breakage.  |
| T+10h   | You            | Integration green. Open `07-runbook.md`. Rehearse demo beat 1.              |
| T+12h   | You            | Rehearse beats 2–5. Fix demo-script issues.                                |
| T+14h   | You            | Rehearse #2 (full run, no shortcuts).                                      |
| T+16h   | You            | Rehearse #3. Buffer for Qdrant Edge beta surprises.                        |
| T+18h   | You            | Sleep. Write the 90-second pitch from `08-judge-qa.md`.                    |
| T+24h   | You            | Demo.                                                                       |

**Critical:** The 4 worktrees are independent and contract-bound, NOT file-bound. They share `contracts.py` from main, but never touch each other's files. This is what makes parallelism safe.

---

## Worktree setup (run once, after `01-contracts.md` is committed to main)

```bash
cd /home/z/my-project/recall   # main worktree (you created this in Task 01)

# ensure main has contracts
git checkout main && git pull

# create 4 parallel worktrees off main
git worktree add -b feat/store ../wt-store main
git worktree add -b feat/sync  ../wt-sync  main
git worktree add -b feat/ui    ../wt-ui    main
git worktree add -b feat/demo  ../wt-demo  main

# verify
git worktree list
```

Each Codex agent must:
1. `cd` into its assigned worktree directory
2. Read this `00-README.md` + `00-reuse-map.md` + `01-contracts.md` + its own prompt file
3. Touch **ONLY** files inside its scope boundary (listed in its own prompt)
4. Open a PR against `main` when acceptance criteria pass
5. Do NOT pull other worktrees' branches — they don't exist for you

---

## Integration order (after all 4 worktrees merge)

1. Merge `wt-store` first (it provides the Qdrant Edge wrapper the others hit at runtime)
2. Merge `wt-sync` second (depends on store's qdrant client instance + memory events)
3. Merge `wt-ui` third (consumes REST endpoints from store + sync)
4. Merge `wt-demo` last (seeds data via those endpoints)

If a merge has conflicts, the file owner (per worktree scope) wins. Open `06-integration.md` for the smoke-test ladder.

---

## Kill-switch (if running late — execute in this order)

Cut #1 → Cut #2 → ... Do not skip ahead.

1. Drop the multi-device convergence story — single laptop only (already cut for 24h).
2. Drop the conflict-resolution UI — supersede handles it; show "memory v1 → v2" version badge instead of a conflict modal.
3. Drop the conflict seed case — keep 0 conflicts, just show "5 new memories · 3 synced · 2 dedup".
4. Drop the chat "Ask memory" voice input — text input only.
5. Drop the dashboard's knowledge graph view (if you were going to add one) — timeline + chat + sync report only.
6. **Last resort** if Qdrant Edge beta access doesn't land by T+6h: fall back to `qdrant-client` local mode (in-process, same API surface). The demo story does not change — say "running on Qdrant Edge local mode; same API as Edge beta" if asked.
7. **Absolute last resort** if everything is breaking at T+12h: pre-record the offline search beat (30s clip), play it during the live demo, pivot the live demo to online-only with the policy/sync story. **Do not actually do this** — the offline-search beat is the whole point. Cut everything above first.

---

## The 6 pre-empted judge questions (full versions in `08-judge-qa.md`)

**Q1: "Isn't this just Dayflow?"**
A: Dayflow gives activity perception and a local work journal. We extended it (forked from OpenChronicle's architecture) with an actual semantic memory layer using Qdrant Edge, where memories are locally embedded, retrieved, versioned, and policy-gated for sync. Dayflow has no Edge→Cloud story; we do.

**Q2: "Isn't this just Microsoft Recall?"**
A: Microsoft Recall is a closed-source Windows feature that captures screenshots and OCRs them. We are open-source, MIT-licensed, run on macOS, capture AX-tree events (lighter than screenshots), use Qdrant Edge for in-process semantic memory, expose a memory-policy layer (private vs syncable), and demonstrate Edge→Cloud synchronization. Microsoft Recall has none of those.

**Q3: "What data goes to the cloud?"**
A: Only memories classified as SYNCABLE — project research, technical articles, coding activity, tool usage. Private memories (banking, password manager, private browsing) are EDGE ONLY and never leave the device. The policy engine is deterministic, not ML — fast, auditable, and demo-able.

**Q4: "Why Qdrant Edge vs SQLite + FTS?"**
A: Semantic recall across paraphrases. "What did I research about vector databases yesterday?" must match "Browsed github.com/qdrant/qdrant — read Edge docs." FTS can't bridge that. Vectors can. Plus the Qdrant Edge → Qdrant Cloud sync API is shipped in the qdrant-client library — we adapted it. SQLite FTS gives us no such bridge.

**Q5: "Auto-conflict resolution?"**
A: We don't ship a CRDT in 24h. We use OpenChronicle's supersede-not-delete history — every memory has a version, the latest version wins, the prior version is preserved with provenance. CRDT for true distributed consensus is a v2 roadmap item. Honest about scope.

**Q6: "Multi-device?"**
A: Architecturally yes, today no. The 24h demo is single-laptop. The `origin_node` field is in the schema; multi-device is a configuration change, not an architecture change. Roadmap, not Day 1.

---

## Critical collision risk (read before the demo)

**Microsoft ships a Windows 11 feature called "Recall"** that does exactly what we're building — captures screen activity, builds a memory, lets you search it. It launched in 2024, was privacy-controversial, and is now an active Microsoft product.

Calling our hackathon product "Recall" creates three risks:
1. **Judges confuse us with Microsoft Recall** — they ask "isn't this just the Windows thing?" instead of engaging with our Edge→Cloud story.
2. **Trademark collision** — Microsoft's lawyers don't care that we're a hackathon; the moment this gets any traction, you'll get a C&D.
3. **Demo confusion** — if your demo deck has the word "Recall" and a screenshot that looks like screen activity, judges assume it's a Recall clone.

**For the 24h hackathon demo with internal judges:** use "Recall" if you want. It's memorable.

**For anything beyond the hackathon:** rename. Suggested alternatives in priority order:
- **Mnemo** (Greek root of "memory", short, ownable, mnemo.ai is taken but mnemo-edge.ai / mnemolocal.app are likely free)
- **EdgeRecall** (descriptive, includes the Qdrant Edge hint)
- **LocalMind** (consumer-friendly)
- **Recall Edge** (compromise — keeps your name, signals the Edge angle)

**My pick if I were you:** Mnemo. Decide post-hackathon. Do not rename mid-sprint.

**Important:** throughout this prompt pack, the product is called "Recall" per your instruction. If you decide to rename later, find/replace is fine — no code symbols depend on the name.

---

## The 90-second demo sequence (memorize this verbatim)

This is the single sequence the demo must execute. Every prompt file in this pack exists to make this sequence work:

> "I used my computer → it remembered locally → I unplugged the internet → I searched my memories → it answered using local Qdrant Edge → I created new memories offline → I reconnected → they synchronized to Qdrant Cloud → my edge memory updated."

If you can deliver that 90-second sequence live, you've nailed PS03. Everything else is window dressing.

---

## How to actually run this sprint (the 5-minute version)

```bash
# 1. Fork + clone OpenChronicle to a working directory
cd /home/z/my-project
git clone https://github.com/Einsia/OpenChronicle.git recall
cd recall
git remote add upstream https://github.com/Einsia/OpenChronicle.git
git checkout -b hackathon-main

# 2. Copy the sprint pack into docs/
cp -r /home/z/my-project/docs/recall-sprint docs/recall-sprint

# 3. Build contracts + repo skeleton (Task 01, ~30 min)
# ... write backend/contracts.py per 01-contracts.md ...
git add . && git commit -m "Task 01: contracts + repo skeleton"

# 4. Create worktrees
git worktree add -b feat/store ../wt-store main
git worktree add -b feat/sync  ../wt-sync  main
git worktree add -b feat/ui    ../wt-ui    main
git worktree add -b feat/demo  ../wt-demo  main

# 5. Spawn Codex agents — each gets its prompt file
codex --worktree ../wt-store --prompt docs/recall-sprint/02-capture-and-store.md
codex --worktree ../wt-sync  --prompt docs/recall-sprint/03-sync-engine.md
codex --worktree ../wt-ui    --prompt docs/recall-sprint/04-dashboard.md
codex --worktree ../wt-demo  --prompt docs/recall-sprint/05-demo-harness.md
# (run in 4 separate terminals or 4 separate Codex sessions)

# 6. As agents return, merge in order, run 06-integration.md smoke tests

# 7. Rehearse per 07-runbook.md

# 8. Pre-empt judge questions per 08-judge-qa.md
```

**You do not start the agents until you have read every file in this folder.** The 30 minutes you spend reading saves 3 hours of integration pain.

---

## Honest scope expectations

If you nail the 24h sprint, you'll have:
- A working fork of OpenChronicle that captures your activity
- A Qdrant Edge in-process vector store replacing the SQLite FTS5 layer
- An offline-capable chat UI that shows retrieval evidence cards
- A memory-policy toggle (private vs syncable) with a small settings UI
- A sync engine that pushes eligible memories to Qdrant Cloud when network returns
- Versioned memories (leveraging OpenChronicle's existing supersede)
- A 5-beat demo script that runs in under 4 minutes
- 6 pre-empted judge-question answers

If you nail less than that, the kill-switch ladder tells you what to cut in order. The single beat you MUST deliver is the offline search — that's the entire PS03 demonstration.

Go.
