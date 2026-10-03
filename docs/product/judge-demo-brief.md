# Recall — judge demo brief

## One-line pitch

Recall is a private, local-first computer memory for Windows, powered by a
**Qdrant Edge semantic-memory layer**: it turns permitted activity into an
inspectable timeline, daily recap, weekly review, and searchable evidence so
people can reliably recover the context behind their work.

## The problem

People lose time reconstructing work: a link, a decision, a document, or the
steps taken to solve a problem. Browser history and app usage report where a
person was, but not what they were doing. Generic AI chat has no trustworthy
local evidence to work from.

## What we built

Recall combines a Windows desktop host with a local API, a Qdrant Edge semantic
index, and a calm work-journal interface. The demo includes:

1. **Home** — pick up where you left off, ask a question, or enter the timeline.
2. **Timeline** — sessions reconstructed from local events, with app/window
   evidence and optional visual-frame review.
3. **Daily** — grounded local digest, focus time, and top apps for a standup.
4. **Weekly** — recent work rhythm and a high-level review.
5. **Ask Recall** — natural-language search over local semantic memories,
   leading back to evidence rather than an unsupported answer.
6. **Privacy** — separate context and visual-capture controls, local retention,
   and permanent local-evidence deletion.

## Demo script (about three minutes)

1. Open **Recall.exe** and begin on **Home**. Say: “Recall is a memory layer,
   not another time tracker. It helps me resume work with evidence.”
2. Choose **Timeline**. Select a session and point out the source apps, window
   titles, timestamps, and optional frame preview. Say: “Every summary traces
   back to local records.”
3. Choose **Daily**. Explain that it creates a standup-ready digest from the
   day’s locally indexed context.
4. Choose **Weekly**. Explain that it turns fragmented activity into a review
   of where work went, without pretending that a raw app-open duration equals
   productivity.
5. Use **Ask Recall** to search a known demo memory. Open the result and point
   back to its evidence.
6. End in **Privacy**. Say: “Capture is explicit and pausable. Raw events and
   frames stay local by default. The user controls retention and can delete all
   local evidence.”

## Qdrant Edge: the technical focus

Qdrant Edge is the local semantic-memory engine inside Recall. It is not a
cloud dependency and it is not the source of truth. It indexes *derived,
searchable memory* on the same Windows device so Recall can retrieve a useful
moment from meaning-based clues such as “the Qdrant research I read after
opening VS Code.”

This gives Recall three important properties:

1. **Meaning-based retrieval without a cloud round trip.** A person can search
   by what they remember, not only an exact filename, app, or timestamp.
2. **Evidence stays auditable.** Qdrant retrieves candidate memories, then
   Recall routes the person to the underlying SQLite evidence: timestamps,
   app/window context, and optional permitted frames.
3. **A safe sync boundary.** Raw activity and screenshots remain local. Only
   explicitly eligible derived memory can ever be queued for optional sync.

The key judge sentence is:

> “Qdrant Edge gives us local semantic recall, while SQLite preserves the
> evidence that proves what happened. Retrieval finds the moment; evidence
> makes the answer trustworthy.”

## Architecture in plain language

```text
Permitted Windows context
        ↓
Local evidence ledger (events / optional frames)
        ↓
Session reconstruction + Qdrant Edge semantic index
        ↓
Timeline, digest, review, and evidence-grounded search
```

- **Desktop:** native Windows WebView host (`Recall.exe`).
- **Backend:** local FastAPI runtime on loopback only.
- **Evidence:** local SQLite records for events and frames.
- **Memory:** Qdrant Edge local semantic index. It ranks meaning-based matches
  from derived memories; it is never a replacement for the source evidence.
- **UI:** Next.js dashboard packaged with the desktop runtime.

## Differentiation

| Typical time tracker | Generic AI assistant | Recall |
| --- | --- | --- |
| says which app was open | lacks personal evidence | shows the work context and its evidence |
| duration-first | answer-first | evidence-first, then answer |
| usually manual labels | often cloud-first | local-first and user-controlled |

## Honest product status

This is a working Windows demo foundation, not a claim that every future
computer-memory capability is complete. Timeline, local search, local data
controls, capture controls, daily/weekly experience, and the Windows desktop
host are implemented. Rich OCR, browser/file adapters, granular app/site
filters, Windows Hello access control, export, and a code-signed installer are
the next milestones.

## Questions judges may ask

**Why is this safe?**  Capture is opt-in and visibly controllable. Raw evidence
stays on the device by default. Users can prune old frames or permanently wipe
local evidence.

**Why not just use browser history?**  History cannot reconstruct work across
apps or explain the surrounding context. Recall joins permitted evidence into
sessions and keeps source records available for inspection.

**Is this Microsoft Recall?**  No. Recall is an independent, local-first open
source project. We learned from privacy-first retrieval patterns, but built our
own product, interface, and architecture.

**What makes the AI trustworthy?**  Qdrant Edge provides fast local semantic
retrieval, but SQLite evidence remains the source of truth. Recall routes a
person from a meaning-based match back to the records that support it.
