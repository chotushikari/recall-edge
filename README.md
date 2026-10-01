# Recall Edge

Recall Edge is a privacy-first personal activity memory system built around **Qdrant local mode**. It transforms application activity into versioned, semantically searchable memories that remain useful without network access.

## Why it exists

Personal activity is valuable context, but it should not automatically become cloud data. Recall Edge separates those concerns:

- Search happens locally through Qdrant's in-process vector engine.
- A deterministic policy classifies every memory as `private` or `syncable`.
- Private memories never enter the sync path.
- Syncable memories can be queued for Qdrant Cloud when connectivity returns.
- New information supersedes older memories without erasing history.

## Architecture

```text
Activity capture -> typed memory -> local embedding -> Qdrant local collection
                                                        |
                                                 offline semantic search
                                                        |
                                    privacy gate -> durable sync outbox -> Qdrant Cloud
```

The application is deliberately local-first. The Qdrant collection lives in `.qdrant_local/`, runs in the application process, and does not require Docker or a separately managed vector database.

## Privacy policy

| Classification | Examples | Storage behavior |
| --- | --- | --- |
| `private` | Password manager, banking, email, personal contacts | Local only; excluded from sync |
| `syncable` | Research, source code work, project activity, technical tools | Local first; eligible for queued cloud sync |

Policy is code, not a probabilistic model. This makes the decision inspectable and testable.

## Current capabilities

- Qdrant-backed local memory ingest and semantic search
- Offline mode that preserves search functionality
- Deterministic app/type privacy classification
- Memory version history using supersede-not-delete semantics
- Automatic retry-safe sync loop for queued Qdrant Cloud writes
- FastAPI endpoints for memories, activity audit records, node status, network simulation, and reset

## Run locally

### Recall Desktop (recommended on Windows)

After the one-time dependency install, use one command to start the local API, dashboard, and an app-style Recall window:

```powershell
python scripts/launch_recall_edge.py
```

The launcher starts only services that are not already healthy, and it stops only the child processes it created when you press `Ctrl+C`.

```powershell
python -m pip install -e .
uvicorn backend.api.server:app --port 8000
```

Then open the API documentation at `http://localhost:8000/docs`.

In a second terminal, start the dashboard:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. If that port is already in use, run `npm run dev -- -p 3001` and open port 3001 instead.

### Windows activity ledger (opt-in)

Recall Edge can record the foreground application and window title on Windows from the moment you start the collector:

```powershell
python scripts/run_windows_activity_collector.py
```

Events remain in the local activity database and are visible through `GET /activities/history` and the dashboard's **Local Activity Ledger**. The collector does **not** take screenshots, read keystrokes, inspect clipboard contents, or upload activity to Qdrant Cloud. Capturing browser URLs or every open tab requires a separate browser extension with explicit permission; an active browser window title alone is not a reliable tab-history source.

On Windows, the collector is also available inside the Recall process through `POST /activities/capture/start` and `POST /activities/capture/stop`; this is the preferred single-app mode. When a browser is foregrounded, its active tab title is recorded as the window title. Browser security prevents a desktop-only application from reading full URLs or inactive tabs without separate browser permission, so Recall intentionally does not claim otherwise.

Example query:

```powershell
Invoke-RestMethod http://localhost:8000/memory/search -Method Post -ContentType 'application/json' -Body '{"query":"What did I research about vector search?","top_k":5}'
```

## Configuration

Copy `.env.example` to `.env` and configure the node identifier, local Qdrant path, sync interval, and—when ready—Qdrant Cloud URL/API key.

## Roadmap

1. Durable privacy-gated outbox and Qdrant Cloud synchronization
2. Demo corpus and rehearsal tooling
3. Evidence-first dashboard with timeline, search, status, and version history
4. Capture-pipeline integration and end-to-end offline/reconnect demo

## License and notices

Recall Edge is distributed under the MIT License. See [LICENSE](LICENSE). Third-party dependencies retain their respective licenses.
