# Task 10 — Codex Agent Starter Prompts

> **Task ID:** 10
> **Owner:** You (orchestrator)
> **Goal:** Give you the exact paste-ready message to send to each of the 4 Codex sessions so they execute expertly — not sloppily.

---

## How to use this file

1. After `01-contracts.md` is committed to main and the 4 worktrees are created (`00-README.md` shows the commands), open 4 Codex sessions — one in each worktree directory.
2. For each session, copy the corresponding starter prompt below (verbatim — including the empty line at the start) and paste it as the **first user message**.
3. Wait for the agent to acknowledge it has read the 4 files, then let it begin coding.
4. The agent should append its work to `/home/z/my-project/worklog.md` when done.

**The 5 rules below apply to every Codex session, regardless of which task:**

1. **Read before write.** The agent must read 4 files (orchestrator, reuse-map, contracts, its own task spec) before writing any code. If it starts writing code without reading, abort the session.
2. **Scope enforcement is non-negotiable.** If the agent touches a file outside its scope boundary, reject the PR. Period.
3. **Honesty contract.** If a test fails, the agent reports it — does not delete the test. If an endpoint is missing, the agent surfaces it — does not stub silently. If it can't implement something in time, it says so.
4. **Quality bar = production-grade, not PoC.** Type hints, docstrings, error handling, but no gold-plating. A 24h hackathon rewards working code, not perfect code.
5. **Handoff clarity.** Every PR must include the "Handoff contract" section verbatim from the spec, so the orchestrator knows what the agent exposes/consumes.

---

## Starter prompt — wt-store (Task 02: Capture + Qdrant Edge store)

```
You are a Codex agent assigned to Task 02 in the Recall 24h hackathon sprint.

Your working directory is this worktree (branch `feat/store`, off `hackathon-main`).
Your scope boundary is EXACTLY: `backend/qdrant_local/`, `backend/api/`. No other directories.

## Read these 4 files IN ORDER before writing any code:

1. docs/recall-sprint/00-README.md           (orchestrator — full project context)
2. docs/recall-sprint/00-reuse-map.md         (file-level upstream pointers)
3. docs/recall-sprint/01-contracts.md         (frozen contracts you consume — DO NOT MODIFY)
4. docs/recall-sprint/02-capture-and-store.md (YOUR TASK SPEC — including the "Dayflow Parity Endpoints" addendum at the bottom)

If any of these files are missing, STOP and report — do not improvise.

## Then:

1. Clone OpenChronicle to /tmp/upstream-oc (depth-1) — see 00-reuse-map.md for the exact gh command.
2. Spend ≤20 minutes reading the upstream files listed in 00-reuse-map.md (most important: `src/openchronicle/store/fts.py` — your qdrant_local/store.py must mirror its API surface exactly).
3. Implement everything in 02-capture-and-store.md, including the 5 Dayflow-parity endpoints in the addendum at the bottom.
4. Write the pytest tests listed in your acceptance criteria. Run them. They must pass.
5. Run `ruff check backend/qdrant_local/ backend/api/` — must be clean.

## Quality bar:

- Production-grade code: type hints on every function signature, docstring on every module-level function, error handling on every external call (Qdrant, httpx).
- No gold-plating: don't add features not in your spec. Don't refactor OpenChronicle's code.
- Type-checkable: `python -c "import backend.qdrant_local; import backend.api.server"` must succeed without runtime errors.

## Forbidden moves (will get your PR rejected):

- Touching `backend/contracts.py` or `backend/policy.py` (frozen).
- Touching `backend/sync/` (Task 03's scope).
- Touching `src/openchronicle/` (the orchestrator wires the fts→qdrant swap at integration — you don't).
- Touching `frontend/` or `scripts/`.
- Calling real Qdrant Cloud URLs — local mode only.
- Adding new dependencies beyond what's in `pyproject.toml`.
- Deleting tests that fail. Fix the implementation or surface the blocker.

## Done = open PR against `hackathon-main` with:

- All acceptance criteria in your spec passing (both the original section AND the Dayflow addendum section).
- `ruff check` clean on your scope.
- `pytest backend/qdrant_local/ backend/api/` green.
- PR description contains the 4 required phrases from the spec's "Done criteria" section.
- PR description explicitly notes the integration seam for the orchestrator: "Orchestrator changes `src/openchronicle/store/fts.py` import to `from backend.qdrant_local import store as fts` at Task 06."
- PR description honestly notes any stubs (e.g. `focus_minutes` returns 0, `/capture/pause` is a marker-file stub).

## When done, append a section to /home/z/my-project/worklog.md:

```
---
Task ID: 02
Agent: Codex (wt-store)
Task: Qdrant Edge in-process store + FastAPI server + Dayflow Tier 1 endpoints

Work Log:
- <step 1>
- <step 2>
- ...

Stage Summary:
- Files added: <list>
- Tests added: <count>
- Acceptance criteria met: <count>/<total>
- Stubs or known gaps: <honest list>
- Integration notes for orchestrator: <what they need to wire>
```

Begin. Acknowledge that you've read this message and which 4 files you will read first. Then start.
```

---

## Starter prompt — wt-sync (Task 03: Sync engine)

```
You are a Codex agent assigned to Task 03 in the Recall 24h hackathon sprint.

Your working directory is this worktree (branch `feat/sync`, off `hackathon-main`).
Your scope boundary is EXACTLY: `backend/sync/`. No other directories.

## Read these 4 files IN ORDER before writing any code:

1. docs/recall-sprint/00-README.md           (orchestrator — full project context)
2. docs/recall-sprint/00-reuse-map.md         (file-level upstream pointers)
3. docs/recall-sprint/01-contracts.md         (frozen contracts you consume — DO NOT MODIFY)
4. docs/recall-sprint/03-sync-engine.md       (YOUR TASK SPEC)

If any of these files are missing, STOP and report — do not improvise.

## Then:

1. Clone qdrant-client to /tmp/upstream-qdrant-client (depth-1) and read `examples/sync_local_to_cloud/` — your single source of truth.
2. Spend ≤15 minutes on upstream reading.
3. Implement everything in 03-sync-engine.md.
4. Write the pytest tests listed in your acceptance criteria. The PRIVACY GATE test is non-negotiable — append a PRIVATE memory → outbox count must stay 0. If this test fails, you've broken the demo's killer differentiation. Fix it before opening PR.
5. Run `ruff check backend/sync/` — must be clean.

## Quality bar:

- Production-grade: type hints, docstrings, error handling on every Qdrant Cloud call (network can fail; loop must not crash).
- The sync loop must NEVER crash on (a) network offline, (b) Qdrant Cloud URL unset, (c) partial-batch response, (d) SQLite lock. Each is a real failure mode — handle each.
- The privacy gate (`if memory.privacy == PRIVATE: return`) is the demo's killer piece. Test it 3 different ways.

## Forbidden moves (will get your PR rejected):

- Touching `backend/api/server.py` — you write `backend/sync/lifespan.py` and document the wiring for the orchestrator.
- Touching `backend/qdrant_local/` (Task 02's scope) — you only CONSUME `get_qdrant_client()` and `store.*`.
- Touching `backend/contracts.py` or `backend/policy.py` (frozen).
- Touching `src/openchronicle/`, `frontend/`, `scripts/`.
- Pushing PRIVATE memories to cloud — the privacy gate is non-negotiable.
- Implementing CRDT, LWW, or any auto-resolution beyond HUMAN_REVIEW (24h scope cut).
- Actually killing network interfaces (`iptables`, `tc`, `nmcli`).

## Done = open PR against `hackathon-main` with:

- All acceptance criteria passing.
- `ruff check` clean on `backend/sync/`.
- `pytest backend/sync/` green.
- PR description contains the 3 required phrases from the spec's "Done criteria" section.
- PR description explicitly notes the lifespan wiring: "Task 02's lifespan in `backend/api/server.py` must be REPLACED with `recall_sync_lifespan` from `backend/sync/lifespan.py` at Task 06. Orchestrator wires this."
- PR description contains the privacy-gate test result: "PRIVATE memory → outbox count stays 0 ✓. SYNCABLE memory → outbox count goes to 1 ✓."

## When done, append a section to /home/z/my-project/worklog.md (template same as Task 02 above with Task ID 03).

Begin. Acknowledge that you've read this message and which 4 files you will read first. Then start.
```

---

## Starter prompt — wt-ui (Task 04: Dashboard)

```
You are a Codex agent assigned to Task 04 in the Recall 24h hackathon sprint.

Your working directory is this worktree (branch `feat/ui`, off `hackathon-main`).
Your scope boundary is EXACTLY: `frontend/`. No other directories.

## Read these 4 files IN ORDER before writing any code:

1. docs/recall-sprint/00-README.md           (orchestrator — full project context)
2. docs/recall-sprint/00-reuse-map.md         (file-level upstream pointers — pay attention to Dayflow + screenpipe + supermemory references)
3. docs/recall-sprint/01-contracts.md         (frozen contracts — your TypeScript types in `frontend/lib/types.ts` must mirror these)
4. docs/recall-sprint/04-dashboard.md         (YOUR TASK SPEC — including the "Dayflow Parity Features — Tier 1 Addendum" at the bottom)

If any of these files are missing, STOP and report — do not improvise.

## Then:

1. Initialize the Next.js app: `cd frontend && npm install`.
2. Run `npx shadcn@latest init -y` then `npx shadcn@latest add card badge dialog button tabs`.
3. Spend ≤20 minutes on upstream reading: clone Dayflow (`/tmp/upstream-dayflow`) for the TimelineView UX pattern; clone screenpipe (`/tmp/upstream-screenpipe`) for the observatory layout.
4. Implement everything in 04-dashboard.md, INCLUDING the 8 Tier 1 Dayflow-parity components in the addendum at the bottom.
5. Run `npm run build` — must be clean (no TypeScript errors).

## Quality bar:

- The chatbot is NOT the product. The retrieval evidence IS the product. Every search result must show a MemoryCard + StorageStatusPanel + score line. If you forget this, you've broken the demo's killer differentiation.
- Production-grade TypeScript: every component prop typed, no `any` except where the backend response shape isn't finalized.
- The Dayflow-parity components are NOT optional — they're part of the 24h scope now. The 2-column layout in the addendum REPLACES the original home page layout.
- Real backend calls only. No mock data. If an endpoint is missing, the frontend calls it anyway — integration will surface the gap.

## Forbidden moves (will get your PR rejected):

- Touching any file in `backend/` — your contract is the REST API only.
- Touching `src/openchronicle/`, `scripts/`, `docs/`.
- Calling Qdrant directly from the frontend — always through the backend API.
- Implementing actual network killing in the UI.
- Implementing CRDT, LWW, or auto-resolution UI beyond "Accept Cloud" button.
- Implementing Tier 2 features (focus detection, trends chart, productivity score) — see `09-dayflow-parity.md`.
- Implementing a full calendar month view (Tier 3) — the 14-day heatmap is the 24h scope.
- Bundling real macOS .icns files — use the AppIcon helper.
- Auto-generating daily summary with an LLM by default — templated summary is the 24h scope.

## Done = open PR against `hackathon-main` with:

- All acceptance criteria passing (both the original section AND the Dayflow addendum section).
- `npm run build` clean.
- All 8 new Tier 1 components exist under `frontend/components/`.
- Home page renders the 2-column layout.
- PR description contains the required phrase: "Dayflow parity Tier 1 features added: daily summary card, app usage sidebar, calendar heatmap strip, project tag filter, quick-add note modal, app icon helper, pause capture, time range selector. Full feature matrix in 09-dayflow-parity.md."
- PR description honestly notes any components that are stubbed (e.g. PauseCaptureButton is a marker-file stub).

## When done, append a section to /home/z/my-project/worklog.md (template same as Task 02 above with Task ID 04).

Begin. Acknowledge that you've read this message and which 4 files you will read first. Then start.
```

---

## Starter prompt — wt-demo (Task 05: Demo harness)

```
You are a Codex agent assigned to Task 05 in the Recall 24h hackathon sprint.

Your working directory is this worktree (branch `feat/demo`, off `hackathon-main`).
Your scope boundary is EXACTLY: `scripts/`. No other directories.

## Read these 4 files IN ORDER before writing any code:

1. docs/recall-sprint/00-README.md           (orchestrator — full project context)
2. docs/recall-sprint/00-reuse-map.md         (file-level upstream pointers)
3. docs/recall-sprint/01-contracts.md         (frozen contracts — your seed.py builds Memory objects per these schemas)
4. docs/recall-sprint/05-demo-harness.md     (YOUR TASK SPEC)

If any of these files are missing, STOP and report — do not improvise.

## Then:

1. Spend ≤10 minutes on upstream reading — qdrant-demo's smart_glasses seed pattern (study only, don't clone).
2. Implement everything in 05-demo-harness.md:
   - `scripts/seed.py` — generates 250 memories, including the canonical Qdrant research v1+v2, 1Password PRIVATE, banking PRIVATE, GitHub SYNCABLE, VS Code SYNCABLE, Slack SYNCABLE, Mail PRIVATE, paraphrased Qdrant research events.
   - `scripts/kill_network.py` — flips env var via /network/toggle.
   - `scripts/judge_queries.json` — 10 curated queries.
   - `scripts/test_queries.py` — rehearsal gate.
3. Run `python scripts/seed.py --count 5 --print-keys` against a running backend to verify it works (you may need to start a minimal backend to test; or skip this verification and document in PR).

## Quality bar:

- The seed corpus's paraphrased Qdrant research events are what make semantic recall demo-able. They must NOT be tokenized-matchable to the judge queries (e.g. "What did I research about Qdrant Edge yesterday?" must NOT match an event whose embedding_text is "Researched Qdrant Edge yesterday" — it must match "Browsed github.com/qdrant-labs/qdrant-client — read sync_local_to_cloud example" via vector distance).
- PRIVATE corpus is non-negotiable. The seed must include 1Password (`bundle_id=com.1password.7`), banking (`bundle_id=com.apple.Safari`, url contains "bank"), and Mail (`bundle_id=com.apple.mail`). After seed, `/node/state` must show `private_count > 0`. If it shows 0, your seed is broken.
- Honest about the offline simulation. `kill_network.py` does NOT call `nmcli`/`iptables`/`tc`. It flips an env var. The script's docstring must say so.

## Forbidden moves (will get your PR rejected):

- Touching `backend/`, `src/openchronicle/`, `frontend/`, `docs/`.
- Calling `nmcli`, `iptables`, `tc`, `ip link set` — the network toggle is application-layer only.
- Pre-computing embeddings client-side — backend's `POST /memories` does that.
- Generating more than 300 memories.
- Skipping the PRIVATE corpus — the privacy demo depends on `private_count > 0`.
- Adding pytest tests — these are scripts, not unit-tested code.

## Done = open PR against `hackathon-main` with:

- All acceptance criteria passing.
- `python scripts/seed.py` actually produces 250 memories against a running backend (verified manually by you, the agent — don't claim it works without running it).
- `python scripts/test_queries.py` passes all 10 after keys are populated.
- PR description contains the required phrase: "Demo harness drives the 5-beat rehearsal. Honest about offline simulation (env-var toggle, not nmcli). The seed corpus's paraphrased Qdrant research events prove semantic recall against paraphrased judge queries. PRIVATE corpus (1Password, banking) proves privacy gate works — private_count stays constant before/after sync."
- PR description honestly notes any judge queries that fail `test_queries.py` and why.

## When done, append a section to /home/z/my-project/worklog.md (template same as Task 02 above with Task ID 05).

Begin. Acknowledge that you've read this message and which 4 files you will read first. Then start.
```

---

## Master orchestrator checklist (for you, not Codex)

This is what YOU do at each checkpoint. Print this, tape it to your laptop.

### T+0h: Pre-flight
- [ ] All 10 files in `docs/recall-sprint/` read top-to-bottom by you
- [ ] `01-contracts.md` executed: `backend/contracts.py` + `backend/policy.py` + `.env.example` + `pyproject.toml` updated + root `README.md` prepended
- [ ] Repo skeleton matches the tree in `01-contracts.md`
- [ ] `pip install -e .` succeeds
- [ ] `python -c "from backend.contracts import Memory, MemoryType, PrivacyClass"` succeeds
- [ ] Committed to `hackathon-main`: `git log --oneline` shows `Task 01: contracts + repo skeleton`

### T+0.5h: Spawn agents
- [ ] 4 worktrees created: `git worktree list` shows `wt-store`, `wt-sync`, `wt-ui`, `wt-demo`
- [ ] 4 Codex sessions started (one per worktree directory)
- [ ] Each session got its starter prompt from this file (10-codex-prompts.md)
- [ ] Each agent acknowledged reading the 4 files

### T+0.5h → T+8h: Build phase
- [ ] Every 60 min: check each agent's progress. If any is stuck for >30 min, kill the session and restart with the failure-mode prompt below.
- [ ] Don't merge worktrees mid-build. Let them finish.
- [ ] If an agent's PR is missing the "Handoff contract" section in its description, reject and request.

### T+8h: Integration
- [ ] Open `06-integration.md` and run the 12-step smoke ladder.
- [ ] For each 404 (missing endpoint), assign a Codex agent to add it.
- [ ] Wire the 5 integration seams (fts→qdrant swap, lifespan replacement, frontend env, shadcn setup, OpenChronicle daemon start).
- [ ] Once all 12 ladders pass, proceed to rehearsals.

### T+10h → T+14h: Rehearsals
- [ ] Rehearsal #1: run all 5 beats, log every failure
- [ ] Triage failures into a fix-list
- [ ] Rehearsal #2: every beat works; tighten verbal script
- [ ] Rehearsal #3: full dress, no shortcuts; practice 90-sec pitch

### T+24h: Demo
- [ ] Pre-demo checklist in `07-runbook.md` executed
- [ ] `python scripts/test_queries.py` passes ≥7/10
- [ ] Browser open to `localhost:3000?judge=1` for 5+ min before demo
- [ ] Backend running 5+ min (embedder warmed, sync loop ticked)
- [ ] OpenChronicle daemon running 5+ min (some activity captured)
- [ ] 6 memorized judge-question answers ready (from `08-judge-qa.md`)
- [ ] 90-second pitch memorized (from `08-judge-qa.md`)
- [ ] Sticky note with 4 canonical seed dedup_keys next to laptop

---

## Common Codex failure modes + recovery prompts

### Failure 1: Agent starts writing code without reading

**Symptom:** First 2 messages from the agent include code blocks but no "I've read the 4 files" acknowledgment.

**Recovery:** Kill the session. Restart with this prompt prepended to the original starter:

```
CRITICAL: Your previous attempt started writing code without reading the 4 required files. This is forbidden.

Before writing ANY code, you MUST:
1. Read docs/recall-sprint/00-README.md
2. Read docs/recall-sprint/00-reuse-map.md
3. Read docs/recall-sprint/01-contracts.md
4. Read docs/recall-sprint/<your-task-spec>.md
5. Acknowledge in your next message: "I have read all 4 files. The scope boundary is <list>. The forbidden moves are <list>. I will begin implementation now."

If you write code before this acknowledgment, your PR will be rejected.
```

### Failure 2: Agent touches out-of-scope files

**Symptom:** PR diff includes files outside the worktree's scope boundary.

**Recovery:** Reject the PR with this message:

```
PR rejected. Your scope boundary is EXACTLY: <list>. Your PR touched: <list of out-of-scope files>.

This violates the forbidden moves section of your task spec. Revert those changes and resubmit. If you needed to touch those files, you should have surfaced the blocker in the PR description instead of touching them silently.
```

### Failure 3: Agent deletes failing tests

**Symptom:** PR diff includes deletion of test files or test functions.

**Recovery:** Reject the PR with this message:

```
PR rejected. You deleted test(s): <list>. The honesty contract in your starter prompt explicitly forbids this.

Failing tests are signal, not noise. Either:
1. Fix the implementation so the test passes.
2. Mark the test `@pytest.mark.xfail(reason="...")` with an honest reason.
3. Surface the failure in the PR description and request orchestrator guidance.

Restoring the deleted tests and resubmit. Do not delete tests again.
```

### Failure 4: Agent silently stubs instead of implementing

**Symptom:** PR diff shows functions with `pass` or `return None` or `# TODO` for the core spec.

**Recovery:** Reject the PR with this message:

```
PR rejected. These functions are stubs, not implementations: <list>.

For each stub, decide:
1. Implement it now (preferred).
2. If genuinely blocked, mark it `# STUB: <reason>` AND list it explicitly in the PR description's "Stubs or known gaps" section.

Silent stubbing breaks integration. Don't do it.
```

### Failure 5: Agent's PR description is missing required phrases

**Symptom:** PR description doesn't contain the 3-4 required phrases from the spec's "Done criteria" section.

**Recovery:** Reject with this message:

```
PR rejected. Your PR description is missing required phrases from the spec's Done criteria section:

Required but missing:
- <phrase 1>
- <phrase 2>

Update the PR description and resubmit. These phrases are how the orchestrator verifies you actually completed the spec.
```

### Failure 6: Agent gets stuck on a single problem for >30 min

**Symptom:** No commit for 30+ minutes; agent keeps trying the same approach.

**Recovery:** Kill the session. Restart with this prompt prepended:

```
You are restarting from a previous attempt that got stuck. The previous attempt's blocker was: <describe>.

Before resuming, you MUST:
1. `git status` and `git log --oneline -5` to see what's already done.
2. Read /home/z/my-project/worklog.md to see your previous work log.
3. Pick a different approach to the blocker. If you can't think of one in 10 minutes, surface the blocker in the PR description and move on to the next acceptance criterion.

Do not get stuck on the same problem for >30 minutes. Surface blockers, don't grind.
```

### Failure 7: Agent claims "it works" without running the acceptance tests

**Symptom:** PR description claims all criteria pass but `pytest` or `npm run build` output isn't included.

**Recovery:** Reject with this message:

```
PR rejected. You claimed all acceptance criteria pass but did not include test output.

Attach to your PR:
1. The full output of `pytest <your-scope>/` (or `npm run build` for frontend).
2. The full output of `ruff check <your-scope>/` (or `npm run lint`).

Claims of "it works" without evidence will be rejected. Show your work.
```

---

## The single most important instruction

If you only remember one thing from this file, remember this:

> **"Read before write. Scope enforcement is non-negotiable. Honesty contract: failing tests are signal, not noise. Surface blockers, don't fake implementations."**

Every other rule in this file derives from those 4 sentences. If a Codex session follows them, the demo will work. If any agent violates any of them, reject the PR — no exceptions, even if it "looks done."
