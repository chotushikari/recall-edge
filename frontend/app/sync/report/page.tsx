"use client";

import { useEffect, useState } from "react";

type SyncResult = { attempted?: boolean; batch_id?: string; synced?: string[]; already_existed?: string[]; superseded_in_cloud?: string[]; conflicts?: string[] };
const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export default function SyncReportPage() {
  const [result, setResult] = useState<SyncResult | null>(null);
  useEffect(() => { fetch(`${api}/sync/latest-result`).then((response) => response.json()).then(setResult).catch(() => setResult({ attempted: false })); }, []);
  const rows = [["New cloud writes", result?.synced?.length ?? 0], ["Already present", result?.already_existed?.length ?? 0], ["Version updates", result?.superseded_in_cloud?.length ?? 0], ["Conflicts", result?.conflicts?.length ?? 0]];
  return <main className="detail-page"><a href="/">← Dashboard</a><p className="eyebrow">QDRANT EDGE → CLOUD</p><h1>Sync report</h1>{result?.attempted === false ? <p className="empty">No sync has been attempted in this process yet.</p> : <section className="report-grid">{rows.map(([label, value]) => <div className="report-metric" key={String(label)}><small>{label}</small><strong>{value}</strong></div>)}</section>}</main>;
}
