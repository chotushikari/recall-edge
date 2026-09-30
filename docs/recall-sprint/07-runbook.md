# Task 07 — Demo Runbook (you, 3 rehearsals)

> **Task ID:** 07
> **Owner:** You (orchestrator)
> **Time budget:** 4 hours (3 rehearsals × ~1 hour each, including fixes)
> **Prerequisite:** Task 06 integration green

---

## Goal

Rehearse the 5-beat personal-activity demo three times. By the third rehearsal, the demo runs end-to-end in under 4 minutes with no surprises. Each beat has a specific script, a specific action, and a specific expected visual result.

**Rule:** If a beat fails during rehearsal #3, you do not deliver that beat live. Cut to the beat before. Do not improvise on stage.

---

## Pre-demo setup (5 minutes before going live)

Run this checklist BEFORE the demo. Do not skip any item.

```bash
# 1. Fresh start — kill anything on the demo ports
lsof -ti:8000,3000 | xargs kill -9 2>/dev/null
sleep 1

# 2. Reset the local Qdrant + sync DB
cd /home/z/my-project/recall
rm -rf .qdrant_local .recall_sync.db

# 3. Start backend (with sync lifespan)
. .venv/bin/activate
uvicorn backend.api.server:app --port 8000 &
sleep 5

# 4. Verify health
curl -s http://localhost:8000/health  # → {"status":"ok"}

# 5. Warm the embedder (avoid 30s hang on first search during demo)
curl -s -X POST http://localhost:8000/memory/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "warmup"}' > /dev/null

# 6. Start OpenChronicle capture daemon
python -m openchronicle start &
sleep 5

# 7. Seed the corpus
python scripts/seed.py --reset --count 250 --print-keys
# Note the printed canonical dedup_keys for Qdrant research v1, v2

# 8. Update judge_queries.json with the actual dedup_keys from step 7
# (paste the printed keys into the expected_top1_dedup_key fields)

# 9. Verify judge queries pass
python scripts/test_queries.py
# → must print "ALL QUERIES PASS" or ≥7/10. If <7, abort and re-tune seed corpus.

# 10. Start frontend
cd frontend && npm run dev &
sleep 5

# 11. Open browser to localhost:3000?judge=1
# Verify: node status card shows ONLINE, ~250 local memories, 47 private, 0 pending
# Verify: timeline scrolls, ask-memory box renders
# Verify: a few memory cards have amber "PRIVATE" badges and sky "SYNCABLE" badges
# Verify: at least one card has indigo "v2 → updated" badge (the Qdrant research v2)

# 12. Print the dedup_key of the canonical Qdrant research v2
# (you'll reference this verbally during the demo)
python scripts/seed.py --print-keys | grep QDRANT_RESEARCH
```

**Do not skip step 9.** If `test_queries.py` fails, you will fail the live demo. Fix the seed corpus, re-seed, re-verify. Do not start the demo with a broken query corpus.

---

## The 5-beat demo script (~4 minutes)

### Beat 1 — "ONLINE, healthy edge node" (~45 seconds)

**Verbal:**
> "This is Recall — personal-activity memory on Qdrant Edge. Node A is online. It has 248 local memories and 1,284 cloud memories, all synced. 47 of those memories are PRIVATE — banking, password manager, email content — and never leave this device. The other 201 are SYNCABLE — GitHub research, VS Code edits, Slack work messages — and synchronized to Qdrant Cloud. Every memory is captured by OpenChronicle's AX-tree pipeline, embedded locally with `fastembed`, and stored in Qdrant Edge's in-process vector engine. No Docker, no network round-trip, no service to start."

**Action:** Point to the node status card on the dashboard. Hover over "47 private" so the cursor is on the amber count.

**Expected visual:** Node status card shows `ONLINE` (emerald badge), 4 counts (248 emerald / 1284 sky / 0 amber / 47 zinc-with-lock), subtitle "Local semantic search · Qdrant Edge · in-process vector engine".

**If fails:** Pre-recorded screenshot fallback. Do NOT troubleshoot live. Move to beat 2.

---

### Beat 2 — "Live activity + offline search" (~60 seconds)

**Verbal:**
> "Yesterday morning I was researching Qdrant Edge — looking at their documentation page, reading about the local-mode API surface, reading their sync example. Yesterday afternoon I went back and re-read it — confirmed the architecture. Let me show you."

**Action:** Scroll the timeline to show yesterday's Chrome cards. Find the Qdrant research v2 card (indigo "v2 → updated" badge).

**Verbal:**
> "Now the judge asks: 'What did you research about Qdrant Edge yesterday?' Watch what happens when I kill the network."

**Action:** Click "Go offline" in the Judge Controls panel.

**Expected visual:** Node status card flips to `OFFLINE` (amber badge). Subtitle stays the same.

**Verbal:**
> "Network is offline. Cloud is unavailable. But local memory is still active — because Qdrant Edge runs in-process. Watch."

**Action:** Type "What did I research about Qdrant Edge yesterday?" into the Ask Memory box. Press Enter.

**Expected visual:** Within 200ms, results render. Top-1 result is the seeded prior Qdrant research v2 memory. The SearchResultList shows:
- MemoryCard with Chrome chip, TOPIC chip, sky "SYNCABLE" badge, indigo "v2 → updated" badge
- StorageStatusPanel: `● EDGE ✓ LOCAL ✓ OFFLINE-CAPABLE ○ CLOUD SYNCED`
- Score line: "Score: 0.78 · Retrieved in <200ms · Qdrant Edge in-process"

**Verbal:**
> "Top result is from yesterday afternoon — v2, my re-research session. Score 0.78, returned in under 200 milliseconds, completely offline. The storage panel shows: EDGE active, LOCAL yes, OFFLINE-CAPABLE yes, CLOUD SYNCED yes — that last one is from before I went offline. SQLite + FTS couldn't bridge 'what did I research yesterday' to 'browsed qdrant.tech/documentation/edge' — those words don't overlap. Vector embeddings do. That's the floor of the demo, and Qdrant Edge makes it work in-process, offline, on a laptop."

**If fails:** If search returns nothing, you have 30 seconds to troubleshoot. Re-warm the embedder. If still failing, skip to beat 3 and verbally acknowledge: "We had a search issue during the live demo — the offline Qdrant Edge search was working in rehearsal; let me show you the sync story next."

---

### Beat 3 — "Add memory offline + reconnect + sync" (~60 seconds)

**Verbal:**
> "I'm going to capture a new activity while offline. OpenChronicle's AX-tree pipeline is running — let me open a new browser tab."

**Action:** Open a new Chrome tab, browse to any page (e.g. github.com/qdrant-labs/qdrant-client). Wait 30 seconds for the session reducer to tick.

**Expected visual:** (If OpenChronicle's daemon is working) a new Chrome card appears in the timeline with amber "⚠ Pending cloud sync" footer. The node status card's `pending_sync_count` increments.

**Verbal:**
> "See that amber footer? That memory is local-only, queued for sync. Now I reconnect."

**Action:** Click "Reconnect" in Judge Controls.

**Expected visual:** Node status flips to `SYNCING` (sky, pulsing) for 2–3 seconds, then `ONLINE`. The new Chrome card's footer disappears. The `pending_sync_count` decrements back to 0.

**Verbal:**
> "Sync engine just drained the outbox. Let me show you the sync report."

**Action:** Navigate to `/sync/report` in the dashboard.

**Expected visual:** SyncReportCard shows something like: "1 new memory · 1 synced · 0 dedup · 0 conflicts".

(Adjust the verbal to match the actual numbers.)

**Verbal:**
> "1 new event synced to cloud. No dedup — this was a brand new memory. No conflicts — single-device, no other writers. The privacy count never moved — 47 stayed local throughout."

**If fails:** If sync doesn't run, manually trigger: `curl -X POST http://localhost:8000/sync/run-now`. If OpenChronicle's daemon didn't capture your new tab, fall back to manually ingesting via curl:
```bash
curl -X POST http://localhost:8000/memories -H 'Content-Type: application/json' -d '{
  "memory_type": "topic",
  "summary": "Live demo: browsed Qdrant client repo",
  "embedding_text": "Live demo: opened github.com/qdrant-labs/qdrant-client during offline session",
  "provenance": {"app_name": "Chrome", "url": "https://github.com/qdrant-labs/qdrant-client"}
}'
```

---

### Beat 4 — "Privacy story" (~45 seconds)

**Verbal:**
> "Here's the privacy policy in action. Every memory has a privacy badge. SYNCABLE — sky badge — goes to cloud. PRIVATE — amber badge — stays local. The policy engine is deterministic, not ML — it maps memory types: USER and PERSON are private; PROJECT, TOOL, TOPIC, ORG are syncable. Plus app-level overrides: 1Password, banking, Mail are always private regardless of type."

**Action:** Scroll the timeline to show a mix of PRIVATE and SYNCABLE cards. Find a 1Password card (amber PRIVATE badge, "🔒 Edge-only · never synced" footer). Find a GitHub research card (sky SYNCABLE badge).

**Verbal:**
> "This 1Password access — I opened the app, copied a credential. PRIVATE. It's in Qdrant Edge locally — I can search it offline. But it never enters the sync outbox. Never leaves this device. The node status card's `private_count` is 47 right now — and it'll still be 47 after a sync. That's the proof point. The privacy gate is non-negotiable."

**Action:** Point to the `private_count` in the node status card.

**Expected visual:** `private_count: 47` stays constant.

**Verbal:**
> "Compare to the GitHub research — SYNCABLE. Edge + Cloud. When I reconnect, this drains to Qdrant Cloud. If I had a second laptop pointing to the same cloud, it'd see this memory after sync."

**If fails:** If no PRIVATE cards appear in the timeline, the seed corpus's app overrides didn't match. Manually ingest a 1Password memory via curl and continue.

---

### Beat 5 — "Versioned memories" (~30 seconds)

**Verbal:**
> "Last beat: versioned memories. The prior Qdrant research has v1 and v2 — yesterday morning I researched it, yesterday afternoon I re-researched and updated my notes. OpenChronicle's supersede-not-delete history preserved both versions."

**Action:** Click the Qdrant research v2 card. Navigate to the memory detail view.

**Expected visual:** Side-by-side v1 and v2 cards. v1 marked "superseded by v2". v2 marked "supersedes v1". Both timestamps visible.

**Verbal:**
> "v1 — morning research. v2 — afternoon re-research. The new version supersedes the old, but the old is preserved with provenance. Search returns v2 by default; history is queryable. Cloud now has v2 — supersede-in-cloud worked on the last sync. That's the full memory lifecycle: write, version, sync, converge. RAG has none of this."

**Action:** Stop sharing screen. Stand up. Smile.

---

## Rehearsal plan

### Rehearsal #1 (T+10h on the 24h clock) — "Find the bugs"

Goal: surface every broken beat. Do NOT try to make it pretty. Run all 5 beats, time them, log failures.

After rehearsal #1, list every failure. File a fix-list. Typical failure categories:
- Search returns wrong top-1 → fix seed corpus phrasings
- Sync report shows 0/0/0/0 → fix sync loop trigger
- OpenChronicle daemon doesn't capture → fall back to scripted ingest (last resort)
- 1Password override doesn't apply → fix policy.py patterns
- v1/v2 side-by-side doesn't render → fix memory detail page
- Server crashes mid-demo → fix lifespan / exception handling

Budget: 1 hour (30 min demo + 30 min fix triage).

### Rehearsal #2 (T+12h) — "Tighten the script"

Goal: every beat works. Practice the verbal script. Time it. Cut anything > 4 minutes total.

After rehearsal #2, refine the verbal. Cut any sentence longer than 15 words. Add transition phrases between beats.

Budget: 1 hour (30 min demo + 30 min script edit).

### Rehearsal #3 (T+14h) — "Full dress, no shortcuts"

Goal: rehearse exactly as you'll deliver live. Same browser, same machine, same network conditions (if possible, on the actual demo hardware).

Don't fix anything during this rehearsal. If something breaks, just verbally bridge: "In rehearsal this worked; here's what you would see..." — and move on. The point is to practice recovering from failure gracefully.

After rehearsal #3, you should know your demo cold. Sleep. Wake up. Deliver.

Budget: 1 hour (full run + post-mortem).

---

## Pre-empt the 6 killer judge questions (full versions in `08-judge-qa.md`)

Be ready to answer these verbatim if asked:

1. **"Isn't this just Dayflow?"** → Dayflow is Swift/commercial; we forked OpenChronicle (MIT, Python) and added Qdrant Edge + sync + privacy policy + versioning.
2. **"Isn't this just Microsoft Recall?"** → MS Recall is closed-source Windows feature, screenshots + OCR; we are open-source MIT, macOS, AX-tree events, Qdrant Edge + sync + privacy policy + versioning.
3. **"What data goes to the cloud?"** → Only SYNCABLE memories — project research, technical articles, coding activity. PRIVATE (banking, password manager, email) stays local. Deterministic policy, not ML.
4. **"Why not SQLite + FTS?"** → Semantic recall across paraphrases. "What did I research yesterday?" must match "Browsed github.com/qdrant — read Edge docs." FTS can't bridge. Vectors can.
5. **"Auto-conflict resolution?"** → We use OpenChronicle's supersede-not-delete history. v1 → v2 → cloud gets v2 on sync. CRDT is v2 roadmap. Honest about scope.
6. **"Multi-device?"** → Architecturally yes, today no. 24h is single-laptop. `origin_node` field is in schema; multi-device is configuration, not architecture.

---

## Demo-day hardware checklist

- [ ] Laptop charged + charger
- [ ] Backup hotspot on phone (in case venue Wi-Fi is broken — but you don't need Wi-Fi for the demo! Qdrant Edge is local)
- [ ] HDMI/USB-C adapter for the projector
- [ ] Browser zoomed to 110% (so judges in the back can read the cards)
- [ ] Terminal font size 14pt minimum (in case you need to show the curl fallback)
- [ ] `localhost:3000?judge=1` open in a tab BEFORE you start
- [ ] Backend running for 5+ minutes before demo (embedder warmed, sync loop ticked)
- [ ] OpenChronicle daemon running for 5+ minutes before demo (some activity captured)
- [ ] Seed corpus loaded and `test_queries.py` passed
- [ ] The 4 canonical seed memories' dedup_keys written on a sticky note next to your laptop (in case you need to reference them verbally)

---

## If everything breaks — the 90-second pitch

If the demo software completely fails on stage, fall back to this pitch. Total time: 90 seconds. Then take questions.

> "Recall is personal-activity memory on Qdrant Edge. We had a live demo planned — the offline search beat in particular is the centerpiece — but the demo software failed on stage. Let me describe what we built.

> The architecture: every activity on your laptop — apps used, browser tabs, files edited, text typed — captured by OpenChronicle's AX-tree pipeline, classified into typed memories (USER, PROJECT, TOOL, TOPIC, PERSON, ORG), embedded locally with `fastembed`, and stored in Qdrant Edge's in-process vector engine. Offline search returns the prior research session for the same topic you asked about. When network returns, the sync engine drains a SQLite outbox — but only for SYNCABLE memories. PRIVATE memories (banking, password manager, email content) never enter the outbox, never leave the device.

> We forked OpenChronicle — MIT-licensed, 2.8k stars — kept their AX-tree capture and their supersede-not-delete versioning system, and added: a Qdrant Edge in-process store (swapped for their SQLite FTS5), a deterministic memory-policy engine, a SQLite-outbox → Qdrant Cloud sync path, and a chat UI that shows retrieval evidence with privacy badges, version history, and storage status. Four parallel Codex agents in git worktrees, 24 hours. The retrieval evidence panel — not the chatbot — is the product. RAG has no write path; we have write, version, sync, converge.

> Microsoft ships a closed-source Windows feature called Recall that does screen capture and OCR. We are open-source MIT, run on macOS, capture AX-tree events (lighter than screenshots), use Qdrant Edge for in-process semantic memory, expose a memory-policy layer (private vs syncable), and demonstrate Edge → Cloud synchronization. Microsoft Recall has none of those. The Qdrant Edge product page lists personal computing as a target use case but only demos smart glasses. We built the demo Qdrant wishes they shipped."

**Practice this pitch 3 times during rehearsal #3.** If you can deliver it cold, you can survive anything on stage.
