"use client";

import { FormEvent, type ReactNode, useCallback, useEffect, useState } from "react";

type State = { node_id: string; status: string; local_memory_count: number; cloud_memory_count: number; pending_sync_count: number; private_count: number };
type Result = { memory_id: string; score: number; payload: { summary: string; privacy: string; memory_type: string; timestamp: string; provenance?: { app_name?: string }; local_only: boolean; version: number; supersedes?: string } };
type SyncResult = { synced: string[]; already_existed: string[]; superseded_in_cloud: string[] };
const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

function Badge({ children, kind }: { children: ReactNode; kind: string }) { return <span className={`badge ${kind}`}>{children}</span>; }

export default function Home() {
  const [state, setState] = useState<State | null>(null);
  const [timeline, setTimeline] = useState<Result["payload"][]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const refresh = useCallback(async () => {
    const [nextState, memories] = await Promise.all([fetch(`${api}/node/state`).then(r => r.json()), fetch(`${api}/memories?limit=30`).then(r => r.json())]);
    setState(nextState); setTimeline(memories);
  }, []);
  useEffect(() => { refresh(); const id = window.setInterval(refresh, 5000); return () => window.clearInterval(id); }, [refresh]);
  async function search(event: FormEvent) { event.preventDefault(); if (!query.trim()) return; setBusy(true); try { setResults(await fetch(`${api}/memory/search`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, top_k: 5 }) }).then(r => r.json())); } finally { setBusy(false); } }
  async function network(online: boolean) { await fetch(`${api}/network/toggle`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ online }) }); refresh(); }
  async function syncNow() {
    const response = await fetch(`${api}/sync/run-now`, { method: "POST" });
    if (!response.ok) {
      setSyncMessage("Sync could not reach Qdrant Cloud. Items remain safely queued.");
      return;
    }
    const result: SyncResult = await response.json();
    const completed = result.synced.length + result.already_existed.length + result.superseded_in_cloud.length;
    setSyncMessage(completed ? `Sync complete: ${result.synced.length} new, ${result.already_existed.length} already present, ${result.superseded_in_cloud.length} version updates.` : "No cloud sync completed yet. Check cloud configuration or reconnect.");
    refresh();
  }
  return <main><header><div><p className="eyebrow">RECALL EDGE / QDRANT LOCAL</p><h1>Your activity, searchable on your device.</h1><p className="sub">Evidence-first memory. Local semantic search stays active even when the cloud is unavailable.</p></div><div className="mark">R</div></header>
    <section className="status">{state ? <><div><span className={`dot ${state.status}`} /> <b>{state.status.toUpperCase()}</b><small>{state.node_id}</small></div><Metric label="LOCAL MEMORIES" value={state.local_memory_count}/><Metric label="CLOUD MEMORIES" value={state.cloud_memory_count}/><Metric label="PENDING SYNC" value={state.pending_sync_count}/><Metric label="PRIVATE / LOCAL ONLY" value={state.private_count}/></> : "Connecting to Recall Edge…"}</section>
    <div className="grid"><aside><p className="eyebrow">ACTIVITY TIMELINE</p><h2>Recent memory</h2>{timeline.length ? timeline.map((item, index) => <article className="memory" key={`${item.summary}-${index}`}><div className="row"><Badge kind="app">{item.provenance?.app_name ?? "Local"}</Badge><Badge kind={item.privacy}>{item.privacy === "private" ? "PRIVATE" : "SYNCABLE"}</Badge>{item.supersedes && <Badge kind="version">v{item.version} UPDATED</Badge>}</div><h3>{item.summary}</h3><p>{new Date(item.timestamp).toLocaleString()}</p>{item.privacy === "private" && <small>Locked to this device — excluded from sync.</small>}</article>) : <p className="empty">Seed the demo corpus to populate your timeline.</p>}</aside>
      <section className="search"><p className="eyebrow">ASK MEMORY</p><h2>What do you want to remember?</h2><form onSubmit={search}><input value={query} onChange={e => setQuery(e.target.value)} placeholder="What did I research about Qdrant Edge yesterday?" aria-label="Memory search"/><button disabled={busy}>{busy ? "SEARCHING" : "SEARCH LOCAL MEMORY"}</button></form><div className="controls"><button onClick={() => network(false)}>GO OFFLINE</button><button onClick={() => network(true)}>RECONNECT</button><button onClick={syncNow}>SYNC NOW</button></div>{syncMessage && <p className="sync-message" role="status">{syncMessage}</p>}{results.length > 0 && <div className="evidence"><p className="eyebrow">RETRIEVED EVIDENCE</p>{results.map(result => <article className="result" key={result.memory_id}><div className="row"><Badge kind="app">{result.payload.provenance?.app_name ?? "Local"}</Badge><Badge kind={result.payload.privacy}>{result.payload.privacy}</Badge><span>score {result.score.toFixed(3)}</span></div><h3>{result.payload.summary}</h3><div className="storage"><b>STORAGE</b><span>● EDGE</span><span>✓ LOCAL</span><span>✓ OFFLINE-CAPABLE</span><span className={result.payload.local_only ? "muted" : "cloud"}>{result.payload.local_only ? "○ CLOUD PENDING" : "✓ CLOUD SYNCED"}</span></div></article>)}</div>}</section></div></main>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="metric"><small>{label}</small><strong>{value}</strong></div>; }
