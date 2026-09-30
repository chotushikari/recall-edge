"use client";

import { useEffect, useState } from "react";

type Conflict = { conflict_id: string; memory_dedup_key: string; edge_version: number; cloud_version: number; detected_at: string };
const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export default function ConflictsPage() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  useEffect(() => { fetch(`${api}/sync/conflicts`).then((response) => response.json()).then(setConflicts).catch(() => setConflicts([])); }, []);
  return <main className="detail-page"><a href="/">← Dashboard</a><p className="eyebrow">HUMAN REVIEW</p><h1>Cloud conflicts</h1>{conflicts.length ? <div className="conflict-list">{conflicts.map((conflict) => <article className="history-card" key={conflict.conflict_id}><span>Review required</span><h2>Edge v{conflict.edge_version} · Cloud v{conflict.cloud_version}</h2><p>Detected {new Date(conflict.detected_at).toLocaleString()}</p><small>The cloud record is preserved; this conflict is not auto-resolved.</small></article>)}</div> : <p className="empty">No conflicts require review.</p>}</main>;
}
