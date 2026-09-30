"use client";

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";

import { ActivityHistoryPanel } from "../components/activity-history-panel";
import { AppIcon } from "../components/app-icon";
import { AppUsageSidebar } from "../components/app-usage-sidebar";
import { CalendarHeatmapStrip } from "../components/calendar-heatmap-strip";
import { DailySummaryCard } from "../components/daily-summary-card";
import { PauseCaptureButton } from "../components/pause-capture-button";
import { ProjectTagFilter } from "../components/project-tag-filter";
import { QuickAddNote } from "../components/quick-add-note";
import { TimeRangeSelector } from "../components/time-range-selector";

type Range = "today" | "yesterday" | "week" | "month";
type State = { node_id: string; status: string; local_memory_count: number; cloud_memory_count: number; pending_sync_count: number; private_count: number };
type Memory = { memory_id: string; summary: string; privacy: string; timestamp: string; local_only: boolean; version: number; supersedes?: string; provenance?: { app_name?: string; project?: string } };
type Result = { memory_id: string; score: number; payload: Memory };
type SyncResult = { synced: string[]; already_existed: string[]; superseded_in_cloud: string[] };
const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

function rangeStart(range: Range) {
  const date = new Date();
  const offsets: Record<Range, number> = { today: 0, yesterday: 1, week: 6, month: 29 };
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - offsets[range]);
  return date;
}

export default function Home() {
  const [state, setState] = useState<State | null>(null);
  const [timeline, setTimeline] = useState<Memory[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [range, setRange] = useState<Range>("today");
  const [projects, setProjects] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const refresh = useCallback(async () => {
    const [nextState, memories] = await Promise.all([fetch(`${api}/node/state`).then((r) => r.json()), fetch(`${api}/memories?limit=500`).then((r) => r.json())]);
    setState(nextState);
    setTimeline(memories);
  }, []);
  useEffect(() => { refresh(); const id = window.setInterval(refresh, 5000); return () => window.clearInterval(id); }, [refresh]);
  const visible = useMemo(() => timeline.filter((memory) => new Date(memory.timestamp) >= rangeStart(range) && (!projects.length || projects.includes(memory.provenance?.project ?? ""))), [timeline, range, projects]);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    try { setResults(await fetch(`${api}/memory/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, top_k: 5 }) }).then((r) => r.json())); }
    finally { setBusy(false); }
  }
  async function network(online: boolean) { await fetch(`${api}/network/toggle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ online }) }); refresh(); }
  async function syncNow() {
    const response = await fetch(`${api}/sync/run-now`, { method: "POST" });
    if (!response.ok) { setSyncMessage("Sync could not reach Qdrant Cloud. Eligible memories remain queued."); return; }
    const result: SyncResult = await response.json();
    const total = result.synced.length + result.already_existed.length + result.superseded_in_cloud.length;
    setSyncMessage(total ? `Sync complete: ${result.synced.length} new, ${result.already_existed.length} already present, ${result.superseded_in_cloud.length} version updates.` : "No cloud sync completed yet. Check configuration or reconnect.");
    refresh();
  }

  return <main>
    <header><div><p className="eyebrow">RECALL EDGE / QDRANT LOCAL</p><h1>Your activity, searchable on your device.</h1><p className="sub">Evidence-first memory with local semantic search, deterministic privacy, and optional cloud sync.</p></div><div className="mark">R</div></header>
    <section className="status">{state ? <><div><span className={`dot ${state.status}`} /> <b>{state.status.toUpperCase()}</b><small>{state.node_id}</small></div><Metric label="LOCAL MEMORIES" value={state.local_memory_count}/><Metric label="CLOUD MEMORIES" value={state.cloud_memory_count}/><Metric label="PENDING SYNC" value={state.pending_sync_count}/><Metric label="PRIVATE / LOCAL ONLY" value={state.private_count}/></> : "Connecting..."}</section>
    <div className="workspace">
      <aside className="sidebar"><CalendarHeatmapStrip api={api} onPickDay={() => setRange("today")} /><DailySummaryCard api={api} date={new Date().toISOString().slice(0, 10)} /><AppUsageSidebar api={api} range={range} /><ActivityHistoryPanel api={api} range={range} /><ProjectTagFilter api={api} active={projects} onChange={setProjects} /><TimeRangeSelector value={range} onChange={setRange} /></aside>
      <section className="content"><div className="content-top"><div><p className="eyebrow">ACTIVITY TIMELINE</p><h2>Recent memory</h2></div><QuickAddNote api={api} onCreated={refresh} /></div>{visible.length ? visible.map((memory) => <article className="memory" key={memory.memory_id}><div className="row"><AppIcon name={memory.provenance?.app_name ?? "Local"} /><span>{memory.provenance?.app_name ?? "Local"}</span><Badge kind={memory.privacy}>{memory.privacy.toUpperCase()}</Badge>{memory.supersedes && <Badge kind="version">v{memory.version} UPDATED</Badge>}</div><h3>{memory.summary}</h3><p>{new Date(memory.timestamp).toLocaleString()}</p><small className={memory.local_only ? "muted" : "cloud"}>{memory.privacy === "private" ? "Locked to this device." : memory.local_only ? "Cloud sync queued." : "Cloud sync confirmed."}</small></article>) : <p className="empty">No memories in this range.</p>}</section>
      <section className="search"><p className="eyebrow">ASK MEMORY</p><h2>What do you want to remember?</h2><form onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="What did I research about Qdrant Edge yesterday?" /><button disabled={busy}>{busy ? "SEARCHING" : "SEARCH LOCAL MEMORY"}</button></form><div className="controls"><button onClick={() => network(false)}>GO OFFLINE</button><button onClick={() => network(true)}>RECONNECT</button><PauseCaptureButton api={api} /><button onClick={syncNow}>SYNC NOW</button></div>{syncMessage && <p className="sync-message">{syncMessage}</p>}{results.map((result) => <article className="result" key={result.memory_id}><div className="row"><AppIcon name={result.payload.provenance?.app_name ?? "Local"} /><Badge kind={result.payload.privacy}>{result.payload.privacy}</Badge><span>score {result.score.toFixed(3)}</span></div><h3>{result.payload.summary}</h3><div className="storage"><b>STORAGE</b><span>EDGE</span><span>LOCAL</span><span>OFFLINE-CAPABLE</span><span className={result.payload.local_only ? "muted" : "cloud"}>{result.payload.local_only ? "CLOUD PENDING" : "CLOUD SYNCED"}</span></div></article>)}</section>
    </div>
  </main>;
}

function Badge({ children, kind }: { children: ReactNode; kind: string }) { return <span className={`badge ${kind}`}>{children}</span>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><small>{label}</small><strong>{value}</strong></div>; }
