# Task 04 — Dashboard (Codex agent in `wt-ui`)

> **Task ID:** 04
> **Worktree:** `../wt-ui` (branch `feat/ui`)
> **Scope boundary:** `frontend/`
> **Do NOT touch:** `backend/`, `src/openchronicle/`, `scripts/`, `docs/`

---

## Your mission

Build the Recall dashboard that demos the full personal-memory story. The single most important rule of this module:

> **The chatbot is NOT the product. The retrieval evidence IS the product.**

Every screen must make the memory infrastructure visible. The LLM answer is small; the retrieved evidence cards (with privacy badges, version history, storage status) are large. That's the demo's killer differentiator.

Five views:
1. **Node status card** at the top — ONLINE/OFFLINE badge, local/cloud/pending/private counts.
2. **Timeline view** (Dayflow-style) — vertical stream of memory cards, each with timestamp, app chip, memory-type chip, privacy badge (PRIVATE/SYNCABLE), version badge (v1, v2), summary text.
3. **Ask Memory box** — single text input, returns top-K matches as evidence cards. Each evidence card has: summary, score, source apps, timestamp, privacy badge, version badge, storage status panel.
4. **Sync report screen** — shows the latest sync batch breakdown: synced / already_existed / superseded_in_cloud / conflicts.
5. **Memory detail + version history** — clicking a card opens a detail view; if the memory has prior versions, show them side-by-side.
6. **Conflict review badge** — if any version conflicts exist, a small badge in the header links to a conflict list. 24h: no modal, just a list + "Accept Cloud" button per row.
7. **Demo controls panel** — a hidden "Judge mode" toggle (`?judge=1` query param) exposing: "Toggle network", "Trigger sync now" buttons.

---

## Why Qdrant Edge is the protagonist here (UI framing)

Every screen must visually reinforce that **the vector engine is local and in-process**. Specific moves:

- The node status card prominently shows `LOCAL MEMORY: ACTIVE` even when OFFLINE. The OFFLINE badge is amber, not red — offline is a designed state, not an error state.
- The search box subtitle literally says "Local semantic search · Qdrant Edge · in-process" so judges read it.
- The search returns results in <200ms (because Qdrant Edge IS the process). If judges notice the latency, that's the win.
- Every retrieved evidence card has a STORAGE STATUS panel at the bottom:
  ```
  STORAGE
  ● EDGE      ✓ LOCAL      ✓ OFFLINE-CAPABLE      ○ CLOUD SYNCED
  ```
  This is what makes "the LLM isn't the product, the memory infrastructure is" visceral.
- The privacy badge on every memory card is the policy engine made visible. PRIVATE badges are amber; SYNCABLE badges are sky.
- The version badge on every memory card is OpenChronicle's supersede made visible. "v2" means there was a v1 — clicking shows the diff.

---

## Reuse pointers (read BEFORE writing code)

Spend ≤20 minutes here. This module borrows the most from upstream because UX is where standing on shoulders pays off most.

1. **`JerryZLiu/Dayflow` → `Dayflow/Sources/Features/Timeline/`** (search: `gh search code 'TimelineView' --repo JerryZLiu/Dayflow`)
   - **Primary UX reference.** Vertical timeline of memory cards with timestamp + summary + source-chip = exactly the layout we want.
   - Read the SwiftUI. Translate the *visual structure* to React/TSX. Do NOT translate Swift code.
   - Patterns to lift:
     - Cards grouped by day, sticky day headers
     - Relative timestamps ("3 min ago", "2 hr ago", "yesterday at 4:15 PM")
     - Source chip colored by app (Chrome = blue, VS Code = purple, Slack = green, Mail = red)
   - Use Tailwind + shadcn/ui Card components to rebuild this in TSX.

2. **`supermemoryai/supermemory`** — for the chat-evidence-panel pattern
   - Their web UI shows: ANSWER + MEMORY RETRIEVED + STORAGE status panel layout. This is the killer differentiator. The chatbot answer is small; the evidence cards are large.
   - Browse their landing page or any screenshots you can find.

3. **`mediar-ai/screenpipe` → `packages/observatory/`** (Next.js app, MIT — closest real working Next.js reference for this category)
   - **Fork its layout.** Sidebar + main + status header pattern.
   - Look at `packages/observatory/app/page.tsx` for routing skeleton.
   - Look at `packages/observatory/app/layout.tsx` for the root layout (sidebar, dark mode toggle, etc.).
   - It uses shadcn/ui and Tailwind — same stack as ours.

4. **shadcn/ui examples** — https://ui.shadcn.com/examples
   - Node status card: `Card` + `Badge`.
   - Memory card: `Card` with multiple `Badge` chips.
   - Privacy badge: `Badge` variant outline, amber for PRIVATE, sky for SYNCABLE.
   - Version badge: `Badge` showing "v2" with optional "show history" hover.

5. **Color palette decision** (don't read upstream; decide here):
   - Personal-memory palette (warmer than the industrial version): zinc-950 background, zinc-900 card surface, indigo-500 primary, amber-500 privacy-private, sky-500 privacy-syncable, emerald-500 online, rose-500 conflict.
   - This says "your laptop remembers you" not "field-deployed edge box".

---

## Spec

### Routes (Next.js App Router)

| Path                  | Component                       | Purpose                                              |
| --------------------- | ------------------------------- | --------------------------------------------------- |
| `/`                   | `app/page.tsx`                  | Node status + timeline + ask-memory box             |
| `/memory/[id]`        | `app/memory/[id]/page.tsx`      | Memory detail + version history side-by-side         |
| `/sync/report`        | `app/sync/report/page.tsx`      | Latest sync batch breakdown + history                |
| `/conflicts`          | `app/conflicts/page.tsx`        | List of unresolved conflicts; click → Accept Cloud   |

### Components (in `frontend/components/`)

| Component                | Props                                       | Behavior                                                    |
| ------------------------ | ------------------------------------------- | ----------------------------------------------------------- |
| `NodeStatusCard`         | `state: NodeState`                          | ONLINE/OFFLINE/SYNCING badge + 4 counts (local/cloud/pending/private) |
| `MemoryTimeline`         | —                                            | Vertical stream grouped by day (Dayflow pattern)            |
| `MemoryCard`             | `memory: Memory, onOpen?: () => void`       | Card with timestamp, app chip, memory-type chip, privacy badge, version badge, summary |
| `AskMemoryBox`          | —                                            | Text input → calls `/memory/search` → shows SearchResultList  |
| `SearchResultList`      | `results: {memory_id, score, payload, version}[]` | Each result is a MemoryCard + a STORAGE STATUS panel + a citation chip |
| `StorageStatusPanel`    | `local: bool, offline: bool, cloud_synced: bool` | `● EDGE ✓ LOCAL ✓ OFFLINE-CAPABLE ○ CLOUD SYNCED` |
| `PrivacyBadge`           | `privacy: PrivacyClass`                     | Amber "PRIVATE · EDGE ONLY" or sky "SYNCABLE · EDGE+CLOUD"  |
| `VersionBadge`           | `version: int, supersedes?: str`            | "v2" with hover showing the prior version summary           |
| `SyncReportCard`         | `result: SyncResult`                        | "5 new memories · 3 synced · 2 dedup · 0 conflicts" headline |
| `ConflictList`          | `conflicts: ConflictRecord[]`               | Table with edge_version, cloud_version, "Accept Cloud" button |
| `JudgeControlsPanel`    | —                                            | Visible only when `?judge=1` query param is present         |

### API contract (calls backend on `RECALL_API_BASE`)

| Frontend action           | Calls                                                        |
| ------------------------- | ------------------------------------------------------------ |
| Initial load              | `GET /node/state`                                            |
| Timeline                  | `GET /memories?since=...&limit=...` (Task 02 may need to add — see integration) |
| Ask memory                | `POST /memory/search { query, top_k }`                       |
| Add memory (judge mode)   | `POST /memories { ...Memory }`                               |
| Toggle network            | `POST /network/toggle { online: bool }`                      |
| Trigger sync              | `POST /sync/run-now` (Task 03 may need to add — see integration) |
| Sync report               | `GET /sync/latest-result`                                     |
| Conflicts list            | `GET /sync/conflicts`                                         |
| Resolve conflict          | `POST /sync/conflicts/{id}/resolve { chosen_source }`        |
| Memory detail + history   | `GET /memory/{id}?include_history=true`                     |

**Integration note:** If Task 02/03 haven't exposed an endpoint you need, stub the frontend to call it anyway. Integration will surface the missing endpoints. **Do not branch your code on backend readiness.**

---

## Starter stub

### `frontend/package.json` — write this
```json
{
  "name": "recall-dashboard",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "@radix-ui/react-dialog": "^1.1.2",
    "@radix-ui/react-tabs": "^1.1.1",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "lucide-react": "^0.456.0",
    "swr": "^2.2.5"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "typescript": "^5"
  }
}
```

### `frontend/app/layout.tsx` — write this
```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Recall — Edge Personal Memory",
  description: "Personal-activity memory on Qdrant Edge",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
```

### `frontend/app/page.tsx` — write this (main timeline page)
```tsx
"use client";

import useSWR from "swr";
import { NodeStatusCard } from "@/components/node-status-card";
import { MemoryTimeline } from "@/components/memory-timeline";
import { AskMemoryBox } from "@/components/ask-memory-box";
import { JudgeControlsPanel } from "@/components/judge-controls-panel";
import { fetcher } from "@/lib/fetcher";

export default function HomePage() {
  const { data: state } = useSWR("/node/state", fetcher);
  const isJudgeMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("judge");

  return (
    <div className="space-y-6">
      <NodeStatusCard state={state} />
      {isJudgeMode && <JudgeControlsPanel />}
      <AskMemoryBox />
      <MemoryTimeline />
    </div>
  );
}
```

### `frontend/components/node-status-card.tsx` — write this
```tsx
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cloud, CloudOff, RefreshCw, Lock } from "lucide-react";
import type { NodeState } from "@/lib/types";

export function NodeStatusCard({ state }: { state?: NodeState }) {
  if (!state) return <Card className="p-6 animate-pulse h-32" />;
  const status = state.status;
  const StatusIcon = status === "online" ? Cloud : status === "syncing" ? RefreshCw : CloudOff;
  const badgeClass = status === "online"
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : status === "syncing"
    ? "bg-sky-500/15 text-sky-300 border-sky-500/30 animate-pulse"
    : "bg-amber-500/15 text-amber-300 border-amber-500/30";

  return (
    <Card className="p-6 border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <StatusIcon className="h-6 w-6 text-zinc-300" />
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">Edge Node</div>
            <div className="text-lg font-semibold">{state.node_id}</div>
          </div>
        </div>
        <Badge variant="outline" className={badgeClass + " uppercase"}>
          {status}
        </Badge>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3">
        <Stat label="Local memories" value={state.local_memory_count} accent="text-emerald-300" />
        <Stat label="Cloud memories" value={state.cloud_memory_count} accent="text-sky-300" />
        <Stat label="Pending sync" value={state.pending_sync_count} accent="text-amber-300" />
        <Stat label="Private (edge-only)" value={state.private_count} accent="text-zinc-300" icon={<Lock className="h-3 w-3" />} />
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Local semantic search · Qdrant Edge · in-process vector engine
      </p>
    </Card>
  );
}

function Stat({ label, value, accent, icon }: { label: string; value: number; accent: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-md bg-zinc-900/60 p-3 border border-zinc-800">
      <div className="text-xs text-zinc-500 uppercase tracking-wide flex items-center gap-1">
        {icon} {label}
      </div>
      <div className={"text-2xl font-bold " + accent}>{value}</div>
    </div>
  );
}
```

### `frontend/components/memory-card.tsx` — write this (Dayflow-inspired)
```tsx
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PrivacyBadge } from "./privacy-badge";
import { VersionBadge } from "./version-badge";
import type { Memory } from "@/lib/types";

const APP_COLORS: Record<string, string> = {
  "Chrome": "bg-blue-500/15 text-blue-300 border-blue-500/30",
  "VS Code": "bg-purple-500/15 text-purple-300 border-purple-500/30",
  "Slack": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  "Mail": "bg-rose-500/15 text-rose-300 border-rose-500/30",
  "Safari": "bg-blue-500/15 text-blue-300 border-blue-500/30",
};

const TYPE_LABELS: Record<string, string> = {
  user: "USER",
  project: "PROJECT",
  tool: "TOOL",
  topic: "TOPIC",
  person: "PERSON",
  org: "ORG",
};

export function MemoryCard({ memory, onOpen }: { memory: Memory; onOpen?: () => void }) {
  return (
    <Card className="p-4 border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900/70 transition-colors cursor-pointer"
          onClick={onOpen}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className={APP_COLORS[memory.payload.app_name] ?? "bg-zinc-800/50 text-zinc-300 border-zinc-700"}>
              {memory.payload.app_name}
            </Badge>
            <Badge variant="outline" className="bg-zinc-800/50 text-zinc-300 border-zinc-700 uppercase">
              {TYPE_LABELS[memory.payload.memory_type] ?? memory.payload.memory_type}
            </Badge>
            <PrivacyBadge privacy={memory.payload.privacy} />
            <VersionBadge version={memory.version ?? 1} supersedes={memory.payload.supersedes} />
          </div>
          <p className="text-sm text-zinc-200">{memory.summary ?? memory.payload.summary}</p>
          {memory.payload.local_only && memory.payload.privacy === "syncable" && (
            <p className="mt-2 text-xs text-amber-400/80">⚠ Pending cloud sync</p>
          )}
          {memory.payload.privacy === "private" && (
            <p className="mt-2 text-xs text-zinc-500">🔒 Edge-only · never synced</p>
          )}
        </div>
        <time className="text-xs text-zinc-500 whitespace-nowrap">
          {new Date(memory.timestamp ?? memory.payload.timestamp).toLocaleTimeString()}
        </time>
      </div>
    </Card>
  );
}
```

### `frontend/components/privacy-badge.tsx` — write this
```tsx
import { Badge } from "@/components/ui/badge";

export function PrivacyBadge({ privacy }: { privacy: "private" | "syncable" }) {
  if (privacy === "private") {
    return (
      <Badge variant="outline" className="bg-amber-500/15 text-amber-300 border-amber-500/30">
        PRIVATE · EDGE ONLY
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-sky-500/15 text-sky-300 border-sky-500/30">
      SYNCABLE · EDGE + CLOUD
    </Badge>
  );
}
```

### `frontend/components/version-badge.tsx` — write this
```tsx
import { Badge } from "@/components/ui/badge";

export function VersionBadge({ version, supersedes }: { version: number; supersedes?: string }) {
  if (!supersedes) return null;  // v1 with no prior — don't show a badge
  return (
    <Badge variant="outline" className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30" title={`Supersedes v${version - 1}`}>
      v{version} → updated
    </Badge>
  );
}
```

### `frontend/components/storage-status-panel.tsx` — write this (the killer differentiator)
```tsx
import { Check, X } from "lucide-react";

export function StorageStatusPanel({ local, offline, cloud_synced }: {
  local: boolean; offline: boolean; cloud_synced: boolean;
}) {
  return (
    <div className="mt-3 pt-3 border-t border-zinc-800">
      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Storage</div>
      <div className="flex items-center gap-3 text-xs">
        <span className={local ? "text-emerald-300" : "text-zinc-600"}>
          ● EDGE
        </span>
        <span className="text-zinc-300">
          {local ? <Check className="h-3 w-3 inline" /> : <X className="h-3 w-3 inline" />} LOCAL
        </span>
        <span className="text-zinc-300">
          <Check className="h-3 w-3 inline" /> OFFLINE-CAPABLE
        </span>
        <span className={cloud_synced ? "text-sky-300" : "text-zinc-600"}>
          {cloud_synced ? <Check className="h-3 w-3 inline" /> : <X className="h-3 w-3 inline" />} CLOUD SYNCED
        </span>
      </div>
    </div>
  );
}
```

### `frontend/components/ask-memory-box.tsx` — write this
```tsx
"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SearchResultList } from "./search-result-list";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export function AskMemoryBox() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!query.trim()) return;
    setLoading(true);
    const res = await fetch(`${API_BASE}/memory/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, top_k: 5 }),
    });
    const data = await res.json();
    setResults(data);
    setLoading(false);
  }

  return (
    <Card className="p-4 border-zinc-800 bg-zinc-900/50">
      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">
        Ask memory · Local semantic search · Qdrant Edge · in-process vector engine
      </div>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="e.g. What did I research about Qdrant Edge yesterday?"
          className="flex-1 rounded-md bg-zinc-950 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
        />
        <button onClick={search} className="px-4 rounded-md bg-indigo-500 text-white hover:bg-indigo-400 text-sm">
          <Search className="h-4 w-4" />
        </button>
      </div>
      {loading && <p className="text-xs text-zinc-500 mt-2">Searching local Qdrant Edge…</p>}
      {results.length > 0 && <SearchResultList results={results} />}
    </Card>
  );
}
```

### `frontend/components/search-result-list.tsx` — write this (the killer evidence panel)
```tsx
"use client";

import { MemoryCard } from "./memory-card";
import { StorageStatusPanel } from "./storage-status-panel";

export function SearchResultList({ results }: { results: any[] }) {
  return (
    <div className="mt-4 space-y-3">
      <div className="text-xs uppercase tracking-wide text-zinc-500">
        Memory retrieved · {results.length} results
      </div>
      {results.map((r) => (
        <div key={r.memory_id ?? r.dedup_key} className="space-y-1">
          <MemoryCard memory={r} />
          <StorageStatusPanel
            local={true}
            offline={true}
            cloud_synced={!r.payload?.local_only}
          />
          <div className="text-xs text-zinc-600 pl-2">
            Score: {r.score?.toFixed(3) ?? "n/a"} · Retrieved in &lt;200ms · Qdrant Edge in-process
          </div>
        </div>
      ))}
    </div>
  );
}
```

### `frontend/components/judge-controls-panel.tsx` — write this
```tsx
"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, Zap } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export function JudgeControlsPanel() {
  return (
    <Card className="p-4 border-amber-500/30 bg-amber-500/5">
      <div className="text-xs uppercase tracking-wide text-amber-300 mb-2">Judge mode</div>
      <div className="flex gap-2">
        <Button onClick={() => fetch(`${API_BASE}/network/toggle`, { method: "POST", body: JSON.stringify({ online: false }), headers: { "Content-Type": "application/json" } })}>
          <WifiOff className="h-4 w-4 mr-2" /> Go offline
        </Button>
        <Button onClick={() => fetch(`${API_BASE}/network/toggle`, { method: "POST", body: JSON.stringify({ online: true }), headers: { "Content-Type": "application/json" } })}>
          <Wifi className="h-4 w-4 mr-2" /> Reconnect
        </Button>
        <Button onClick={() => fetch(`${API_BASE}/sync/run-now`, { method: "POST" })}>
          <Zap className="h-4 w-4 mr-2" /> Trigger sync
        </Button>
      </div>
    </Card>
  );
}
```

---

## Acceptance criteria

- [ ] `npm install` runs without errors
- [ ] `npm run dev` starts on port 3000 and shows the home page
- [ ] Home page renders `NodeStatusCard` (calls `/node/state`), `AskMemoryBox`, `MemoryTimeline`
- [ ] `?judge=1` query param shows the `JudgeControlsPanel`
- [ ] Clicking "Go offline" hits `/network/toggle` and node badge flips to OFFLINE
- [ ] Typing a query in `AskMemoryBox` returns results from `/memory/search`
- [ ] Each result has a `MemoryCard` + `StorageStatusPanel` + score line — the killer evidence panel
- [ ] Memory cards show app chip, memory-type chip, privacy badge, version badge
- [ ] PRIVATE memory cards have amber privacy badge + "🔒 Edge-only" footer
- [ ] SYNCABLE memory cards have sky privacy badge + (if pending) "⚠ Pending cloud sync" footer
- [ ] `/sync/report` page renders the `SyncReportCard` with synced/dedup/conflict counts
- [ ] `/conflicts` page renders `ConflictList` with Accept Cloud buttons
- [ ] Clicking a memory card navigates to `/memory/[id]` with version history side-by-side
- [ ] All pages use the zinc-950 personal-memory palette
- [ ] TypeScript compiles with no errors (`npm run build`)
- [ ] All shadcn/ui components installed: `npx shadcn@latest add card badge dialog button tabs`

---

## Forbidden moves

- ❌ Do not touch any file in `backend/` — your contract is the REST API only
- ❌ Do not call Qdrant directly from the frontend — always through the backend API
- ❌ Do not implement actual network killing in the UI — the toggle just calls `/network/toggle`
- ❌ Do not implement CRDT, LWW, or any auto-resolution UI beyond "Accept Cloud" button (24h scope)
- ❌ Do not add SSR/SSG complexity — keep client components (`"use client"`)
- ❌ Do not add auth, multi-tenancy UI, or settings pages — none exist in the 24h scope
- ❌ Do not make the chatbot fancy — single text input, plain results. **The retrieval evidence is the product, not the chatbot.**

---

## Handoff contract

You expose:
- A working Next.js app on port 3000 that consumes the backend REST API

You consume:
- `GET /node/state` → `NodeState`
- `GET /memories?limit=N` → `Memory[]` (Task 02 may need to add — flag in integration)
- `POST /memory/search { query, top_k }` → `[{memory_id, dedup_key, score, payload, version}]`
- `POST /network/toggle { online }` → `{online}`
- `POST /sync/run-now` → triggers Task 03's loop immediately (Task 03 may need to add — flag in integration)
- `GET /sync/latest-result` → `SyncResult` (Task 03 may need to add)
- `GET /sync/conflicts` → `ConflictRecord[]`
- `POST /sync/conflicts/{id}/resolve { chosen_source }` → `{resolved: true}`
- `GET /memory/{id}?include_history=true` → `Memory` + `history: Memory[]`

---

## Demo-day alignment

The 24h demo beats that depend on YOU (your components are visible in every beat):

- **Beat 1:** Node A status card shows `ONLINE · 248 local · 1,284 cloud · 0 pending · 47 private`. Judge asks "What did I research about Qdrant Edge yesterday?" — types in `AskMemoryBox` — top-1 result is the prior research session, with amber PRIVATE badge... no wait, SYNCABLE sky badge, version "v2", and storage panel showing all 4 ✓.
- **Beat 2:** Click "Go offline" — badge flips to OFFLINE (amber). Search STILL works. Top-1 result is the same — but storage panel now shows `● EDGE ✓ LOCAL ✓ OFFLINE-CAPABLE ○ CLOUD SYNCED` (last one still shows the prior sync state).
- **Beat 3:** OpenChronicle captures new activity → writer produces new SYNCABLE Memory → card appears in timeline with amber "Pending cloud sync" footer. Reconnect → footer disappears, storage panel's "CLOUD SYNCED" flips to ✓.
- **Beat 4 (privacy):** The `private_count` in the node state NEVER changes before/after sync. Those 47 PRIVATE memories stayed local. The SYNCABLE ones drained to cloud.
- **Beat 5 (version):** Click the prior research memory → detail page shows v1 and v2 side-by-side. v1 was the morning research; v2 was the afternoon re-research. Cloud now has v2 (supersede-in-cloud). "Memory reached consensus."

---

## Done criteria for the PR

- [ ] All acceptance criteria pass
- [ ] `npm run build` is clean
- [ ] No files outside `frontend/` were touched
- [ ] PR description contains: "Dashboard is Dayflow-architecture + screenpipe-observatory-layout + supermemory-evidence-panel pattern, adapted to personal-memory palette. Every screen reinforces Qdrant Edge as in-process vector engine. The chatbot is small; the retrieval evidence is large — that's the differentiator."

---

# Dayflow Parity Features — Tier 1 Addendum

> **Scope expansion acknowledged.** The original spec above gives you the PS03-critical UI (timeline + chat + storage panel + privacy badge + version badge). This addendum adds **Tier 1 Dayflow-parity features** that lift the demo's visual bar without breaking the 24h timeline. Full Dayflow feature matrix (Tier 1 / Tier 2 / Tier 3 / Roadmap with effort estimates) is in `09-dayflow-parity.md`.

**Rule:** These are Tier 1 — must-have for parity, doable in 24h. If running late, cut in this order: QuickAddNoteModal → ProjectTagFilter → AppUsageSidebar → CalendarHeatmapStrip → DailySummaryCard → AppIcon → TimeRangeSelector → PauseCaptureButton. The last 3 are 30-minute jobs each, leave them.

## New home page layout (replaces the original)

The home page becomes a 2-column layout — sidebar on the left (320px), main content on the right. The sidebar holds Dayflow-style chrome; the main holds timeline + chat.

```tsx
// frontend/app/page.tsx — REPLACE the original with this
"use client";

import useSWR from "swr";
import { useState } from "react";
import { NodeStatusCard } from "@/components/node-status-card";
import { MemoryTimeline } from "@/components/memory-timeline";
import { AskMemoryBox } from "@/components/ask-memory-box";
import { JudgeControlsPanel } from "@/components/judge-controls-panel";
import { AppUsageSidebar } from "@/components/app-usage-sidebar";
import { CalendarHeatmapStrip } from "@/components/calendar-heatmap-strip";
import { DailySummaryCard } from "@/components/daily-summary-card";
import { ProjectTagFilter } from "@/components/project-tag-filter";
import { TimeRangeSelector } from "@/components/time-range-selector";
import { QuickAddNoteModal } from "@/components/quick-add-note-modal";
import { fetcher } from "@/lib/fetcher";

export default function HomePage() {
  const [timeRange, setTimeRange] = useState<"today"|"yesterday"|"week"|"month">("today");
  const [activeProjects, setActiveProjects] = useState<string[]>([]);
  const [showAddNote, setShowAddNote] = useState(false);
  const { data: state } = useSWR("/node/state", fetcher, { refreshInterval: 5000 });
  const isJudgeMode = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("judge");

  return (
    <div className="flex gap-6">
      {/* Sidebar — Dayflow-style chrome */}
      <aside className="w-80 space-y-4 shrink-0">
        <NodeStatusCard state={state} />
        <CalendarHeatmapStrip days={14} onPickDay={(date) => setTimeRange("today")} />
        <DailySummaryCard date={timeRange} />
        <AppUsageSidebar range={timeRange} />
        <ProjectTagFilter active={activeProjects} onChange={setActiveProjects} />
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </aside>

      {/* Main */}
      <main className="flex-1 space-y-6 min-w-0">
        {isJudgeMode && <JudgeControlsPanel onAddNote={() => setShowAddNote(true)} />}
        <AskMemoryBox />
        <MemoryTimeline range={timeRange} projects={activeProjects} />
      </main>
    </div>
  );
}
```

## Component 1 — `DailySummaryCard`

Auto-generated end-of-day digest. Backend endpoint `GET /daily-summary?date=YYYY-MM-DD` returns `{summary: string, top_apps: [...], focus_minutes: int, achievements: [...]}`. For 24h: simple templated summary from session_reducer output. If Ollama is available, optionally LLM-polish.

```tsx
// frontend/components/daily-summary-card.tsx
import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export function DailySummaryCard({ date }: { date: string }) {
  const dateStr = date === "today" ? new Date().toISOString().slice(0,10) : date;
  const { data } = useSWR(`/daily-summary?date=${dateStr}`, fetcher);

  return (
    <Card className="p-4 border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-indigo-400" />
        <div className="text-xs uppercase tracking-wide text-zinc-500">Today's summary</div>
      </div>
      {data ? (
        <>
          <p className="text-sm text-zinc-200 leading-relaxed">{data.summary}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="text-zinc-500">Focus time: <span className="text-emerald-300">{data.focus_minutes ?? 0}m</span></div>
            <div className="text-zinc-500">Apps: <span className="text-sky-300">{data.top_apps?.length ?? 0}</span></div>
          </div>
        </>
      ) : (
        <p className="text-sm text-zinc-500 animate-pulse">Generating summary…</p>
      )}
    </Card>
  );
}
```

## Component 2 — `AppUsageSidebar`

Top 5 apps by time spent. Each row: app icon, app name, time (formatted "2h 14m"), progress bar. Calls `GET /app-usage?range=today`.

```tsx
// frontend/components/app-usage-sidebar.tsx
import { Card } from "@/components/ui/card";
import { AppIcon } from "./app-icon";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

function fmt(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function AppUsageSidebar({ range }: { range: string }) {
  const { data } = useSWR(`/app-usage?range=${range}`, fetcher);
  const apps: any[] = data?.apps ?? [];
  const maxMins = Math.max(...apps.map(a => a.minutes ?? 0), 1);

  return (
    <Card className="p-4 border-zinc-800 bg-zinc-900/50">
      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-3">App usage · {range}</div>
      <div className="space-y-2">
        {apps.length === 0 && <p className="text-xs text-zinc-600">No data yet</p>}
        {apps.map(app => (
          <div key={app.app_name} className="flex items-center gap-2 text-xs">
            <AppIcon app={app.app_name} className="h-5 w-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex justify-between mb-1">
                <span className="text-zinc-300 truncate">{app.app_name}</span>
                <span className="text-zinc-500 ml-2">{fmt(app.minutes)}</span>
              </div>
              <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${(app.minutes / maxMins) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

## Component 3 — `CalendarHeatmapStrip`

Last 14 days, color intensity by memory count. Clicking a day sets the time range. Calls `GET /calendar-heatmap?days=14`.

```tsx
// frontend/components/calendar-heatmap-strip.tsx
import { Card } from "@/components/ui/card";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

function intensityClass(count: number) {
  if (count === 0) return "bg-zinc-800";
  if (count < 5) return "bg-indigo-900";
  if (count < 15) return "bg-indigo-700";
  if (count < 30) return "bg-indigo-500";
  return "bg-indigo-400";
}

export function CalendarHeatmapStrip({ days = 14, onPickDay }: { days?: number; onPickDay?: (date: string) => void }) {
  const { data } = useSWR(`/calendar-heatmap?days=${days}`, fetcher);
  const heat: any[] = data?.days ?? [];

  return (
    <Card className="p-3 border-zinc-800 bg-zinc-900/50">
      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Last {days} days</div>
      <div className="grid grid-cols-7 gap-1">
        {heat.map((d, i) => (
          <button
            key={i}
            onClick={() => onPickDay?.(d.date)}
            title={`${d.date} · ${d.count} memories`}
            className={`aspect-square rounded-sm ${intensityClass(d.count ?? 0)} hover:ring-2 hover:ring-indigo-400 transition-all`}
          />
        ))}
      </div>
      <div className="flex justify-between items-center mt-2 text-xs text-zinc-500">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-sm bg-zinc-800" />
          <div className="w-2 h-2 rounded-sm bg-indigo-900" />
          <div className="w-2 h-2 rounded-sm bg-indigo-700" />
          <div className="w-2 h-2 rounded-sm bg-indigo-500" />
          <div className="w-2 h-2 rounded-sm bg-indigo-400" />
        </div>
        <span>More</span>
      </div>
    </Card>
  );
}
```

## Component 4 — `ProjectTagFilter`

Chip row of distinct project tags. Multi-select filters timeline. Calls `GET /projects`.

```tsx
// frontend/components/project-tag-filter.tsx
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

export function ProjectTagFilter({ active, onChange }: { active: string[]; onChange: (s: string[]) => void }) {
  const { data } = useSWR<string[]>("/projects", fetcher);
  const projects: string[] = data ?? [];

  function toggle(p: string) {
    onChange(active.includes(p) ? active.filter(x => x !== p) : [...active, p]);
  }

  return (
    <Card className="p-3 border-zinc-800 bg-zinc-900/50">
      <div className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Projects</div>
      <div className="flex flex-wrap gap-1">
        {projects.length === 0 && <p className="text-xs text-zinc-600">No projects yet</p>}
        {projects.map(p => (
          <button key={p} onClick={() => toggle(p)}>
            <Badge variant={active.includes(p) ? "default" : "outline"}
                   className={active.includes(p) ? "bg-indigo-500 text-white" : "bg-zinc-800/50 text-zinc-300 border-zinc-700"}>
              {p}
            </Badge>
          </button>
        ))}
      </div>
    </Card>
  );
}
```

## Component 5 — `QuickAddNoteModal`

Manual entry button (in Judge Controls panel for demo) + modal. Lets judge or user manually add a memory (e.g. "Note to self: remember to follow up with Jane about Qdrant Edge"). Calls `POST /memories`.

```tsx
// frontend/components/quick-add-note-modal.tsx
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MemoryType } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export function QuickAddNoteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState("");
  const [mtype, setMtype] = useState<MemoryType>("topic");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    await fetch(`${API_BASE}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memory_type: mtype,
        summary: text.slice(0, 80),
        embedding_text: text,
        provenance: { app_name: "Manual", manual_entry: true },
      }),
    });
    setText("");
    setSaving(false);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Quick add note</DialogTitle>
        </DialogHeader>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Follow up with Jane about Qdrant Edge sync pattern"
          rows={4}
          className="w-full rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
        />
        <div className="flex gap-2 mt-2">
          {(["topic","project","tool","person"] as MemoryType[]).map(t => (
            <button key={t} onClick={() => setMtype(t)}
                    className={`px-3 py-1 rounded-md text-xs uppercase ${mtype === t ? "bg-indigo-500 text-white" : "bg-zinc-800 text-zinc-400"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !text.trim()}>
            {saving ? "Saving…" : "Save to Qdrant Edge"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

## Component 6 — `AppIcon` helper

Colored circle with app's first letter. Cheaper than bundling real app icons. Palette: deterministic color from app_name hash.

```tsx
// frontend/components/app-icon.tsx
const COLORS = [
  "bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-rose-500",
  "bg-amber-500", "bg-sky-500", "bg-indigo-500", "bg-fuchsia-500",
];

export function AppIcon({ app, className }: { app: string; className?: string }) {
  const idx = app.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length;
  return (
    <div className={`${COLORS[idx]} ${className ?? "h-6 w-6"} rounded-md flex items-center justify-center text-white text-xs font-bold`}>
      {app.charAt(0).toUpperCase()}
    </div>
  );
}
```

## Component 7 — `PauseCaptureButton` (extension to `JudgeControlsPanel`)

Adds a "Pause capture" button next to the existing network toggle. Calls `POST /capture/pause` and `POST /capture/resume`. Lets judges see that capture can be turned off (a Dayflow privacy feature).

```tsx
// Edit frontend/components/judge-controls-panel.tsx — add this button to the existing row
<Button onClick={async () => {
  const r = await fetch(`${API_BASE}/capture/pause`, { method: "POST" });
  const d = await r.json();
  alert(`Capture: ${d.capturing ? "ON" : "PAUSED"}`);
}}>
  <Pause className="h-4 w-4 mr-2" /> Pause capture
</Button>
<Button onClick={async () => {
  await fetch(`${API_BASE}/capture/resume`, { method: "POST" });
}}>
  <Play className="h-4 w-4 mr-2" /> Resume capture
</Button>
```

Also wire `onAddNote` to open the QuickAddNoteModal:

```tsx
// In JudgeControlsPanel, accept onAddNote prop and render a button:
<Button onClick={onAddNote}>
  <Plus className="h-4 w-4 mr-2" /> Quick add note
</Button>
```

## Component 8 — `TimeRangeSelector`

Segmented control: Today / Yesterday / 7 days / 30 days. Updates the timeline's filter.

```tsx
// frontend/components/time-range-selector.tsx
import { Card } from "@/components/ui/card";

const RANGES = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "week", label: "7 days" },
  { value: "month", label: "30 days" },
] as const;

export function TimeRangeSelector({ value, onChange }: { value: string; onChange: (v: any) => void }) {
  return (
    <Card className="p-1 border-zinc-800 bg-zinc-900/50">
      <div className="grid grid-cols-4 gap-1">
        {RANGES.map(r => (
          <button key={r.value}
                  onClick={() => onChange(r.value)}
                  className={`px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                    value === r.value ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}>
            {r.label}
          </button>
        ))}
      </div>
    </Card>
  );
}
```

## Updated acceptance criteria (additions)

- [ ] Home page renders the 2-column layout (sidebar + main)
- [ ] `DailySummaryCard` calls `/daily-summary` and renders summary text + focus_minutes + app count
- [ ] `AppUsageSidebar` calls `/app-usage` and renders top-5 apps with time + progress bars + AppIcon
- [ ] `CalendarHeatmapStrip` calls `/calendar-heatmap` and renders 14 squares with intensity colors; clicking a square updates the time range
- [ ] `ProjectTagFilter` calls `/projects` and renders chip row; multi-select filters the timeline
- [ ] `QuickAddNoteModal` opens from a "Quick add note" button in JudgeControlsPanel; submitting creates a memory via `/memories`
- [ ] `AppIcon` renders consistently across all components that use it (MemoryCard, AppUsageSidebar)
- [ ] `PauseCaptureButton` (in JudgeControlsPanel) calls `/capture/pause` and `/capture/resume`; visual state reflects capture status
- [ ] `TimeRangeSelector` segmented control renders and updates the timeline + sidebar queries

## Updated forbidden moves (additions)

- ❌ Do NOT implement Tier 2 features (focus session detector, weekly trends chart, productivity score) — see `09-dayflow-parity.md`
- ❌ Do NOT implement a full calendar month view (Tier 3) — the 14-day heatmap is the 24h scope
- ❌ Do NOT implement Markdown/PDF export (Tier 3)
- ❌ Do NOT bundle real macOS app icons — use the AppIcon helper (cheaper, faster, looks fine)
- ❌ Do NOT auto-generate the daily summary with an LLM by default — templated summary from session_reducer output is the 24h scope; LLM polish is a stretch goal only

## Updated done criteria for the PR

- [ ] All new components exist under `frontend/components/`
- [ ] Home page renders the 2-column layout
- [ ] All new acceptance criteria pass
- [ ] PR description contains: "Dayflow parity Tier 1 features added: daily summary card, app usage sidebar, calendar heatmap strip, project tag filter, quick-add note modal, app icon helper, pause capture, time range selector. Full feature matrix in 09-dayflow-parity.md."

