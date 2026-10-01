# Recall

Recall is an independent, local-first personal computer memory system. With
explicit permission, it captures allowed computer context, organizes it into a
searchable timeline, and will let you ask grounded questions about what you did
and saw.

It is not a Microsoft product and is not affiliated with or endorsed by
Microsoft. The project is an independent open-source implementation and
research effort inspired by the broader shift toward computers with memory,
context, and agentic capabilities, along with products and projects such as
Windows Recall, Dayflow, Screenpipe, and ActivityWatch.

## What is this?

Today's computers execute commands. Recall is the memory layer that helps a
computer retain the context behind them: the apps, windows, pages, files, and
visual evidence a person explicitly chooses to record. The goal is not to build
a screen recorder, time tracker, or generic chatbot. It is to make past work
retrievable, inspectable, and eventually useful to an AI assistant.

```text
Computer
   ↓
Observe
   ↓
Remember
   ↓
Understand
   ↓
Retrieve
   ↓
Reason
   ↓
Assist
   ↓
Act
```

## Architecture

```text
Screen + Apps + Browser + OS Events
                ↓
           Capture Layer
                ↓
          Local Memory (SQLite)
                ↓
       OCR + Embeddings
                ↓
      Timeline + Search
                ↓
        AI Retrieval
                ↓
        Ask My Computer
```

The local SQLite evidence store is the source of truth for raw activity and
frames. It keeps normalized events, screen-frame metadata, and a local FTS5
index together. Qdrant is the derived semantic index for memories and is never
the sole evidence source. Any future AI answer must link back to the events or
frames that support it.

## Current implementation

Working now:

- Opt-in Windows foreground application and window-title capture.
- Local SQLite activity ledger and normalized evidence-event store.
- Local Qdrant semantic-memory index, offline search, version history, and an
  optional privacy-gated cloud-sync outbox.
- A local API and dashboard, plus a one-command Windows launcher.
- Explicitly confirmed Windows primary-monitor screenshots, change detection,
  app/window exclusions, and local frame storage.
- Local FTS5 support for screen-frame evidence; OCR ingestion is next.
- Explicit local frame-retention pruning and full local evidence wipe controls.
- Deterministic activity-session reconstruction from local event sequences.

Not yet claimed as complete:

- OCR, browser URL/tab permission flow, clipboard, file activity, input/AFK
  tracking, and audio.
- Hybrid retrieval (time + FTS + vector + session expansion), grounded AI
  answers, and a full screenshot timeline viewer. The dashboard currently
  shows permitted local frames in the selected session's evidence inspector.
- A packaged native desktop shell and the full settings/export/retention UI.

## Privacy

Computer memory is sensitive. Recall defaults to local storage and does not
silently start visual capture. Screenshot capture requires an explicit start
request with `confirm_visual_capture: true`, and it ships with:

- visible recording status, global pause, and a stop/kill control;
- application, window, website, private-window, and sensitive-content
  exclusions;
- retention pruning and a confirmed full local wipe; per-range deletion and
  export remain upcoming UI work;
- local processing by default, with cloud synchronization limited to
  deliberately eligible derived memories;
- evidence links so a generated summary can be checked or removed with its
  source data.

The foreground collector records only the active app and window title. The
separate visual runtime captures the primary display only after confirmation;
it does not capture keystrokes, clipboard contents, browser URLs, inactive tabs,
or cloud-upload raw activity.

## Run locally on Windows

After installing dependencies once, launch the local API and dashboard in one
app-style window:

```powershell
python scripts/launch_recall_edge.py
```

For development:

```powershell
python -m pip install -e .
cd frontend
npm install
npm run dev
```

Start permitted foreground-window capture through the dashboard or with
`POST /activities/capture/start`; stop it with
`POST /activities/capture/stop`. The normalized evidence API is available at
`GET /evidence/events` and the raw compatibility ledger at
`GET /activities/history`. Visual capture remains stopped until an explicit
`POST /visual-capture/start` request includes `confirm_visual_capture: true`;
stop it with `POST /visual-capture/stop`.

Rebuild grounded activity blocks with `POST /sessions/rebuild`, then retrieve
them from `GET /sessions`. A session records its source event IDs so timeline
and future AI answers can link back to actual evidence.

Permitted screen-frame metadata is available from `GET /evidence/frames`.
The dashboard uses this local endpoint to show frames inside a selected time
window; it serves an image only when the file is still within Recall's managed
frame directory, and never exposes the local filesystem path.

Frame retention is an explicit call to `POST /evidence/retention/prune` with a
chosen `retention_days` value. A local-only wipe requires
`DELETE /evidence/all` with `confirm_delete: true`; it also clears local
semantic memories but cannot erase copies already sent to an optional cloud.

## Roadmap

1. Add per-range deletion and data export controls to the Windows runtime.
2. Add local OCR plus browser and file adapters.
3. Deliver timeline and screenshot evidence views over reconstructed sessions.
4. Implement hybrid retrieval and grounded “Ask My Computer” answers.
5. Package the runtime as a Windows desktop app before expanding to macOS and
   Linux adapters.

## License

Recall is distributed under the MIT License. See [LICENSE](LICENSE).
