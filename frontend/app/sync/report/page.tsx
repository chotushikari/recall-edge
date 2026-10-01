"use client";

import { useCallback, useEffect, useState } from "react";

type SyncResult = {
  attempted?: boolean;
  batch_id?: string;
  synced?: string[];
  already_existed?: string[];
  superseded_in_cloud?: string[];
  conflicts?: string[];
};
type NodeState = {
  status: string;
  local_memory_count: number;
  cloud_memory_count: number;
  pending_sync_count: number;
  private_count: number;
};

const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export default function SyncReportPage() {
  const [result, setResult] = useState<SyncResult | null>(null);
  const [node, setNode] = useState<NodeState | null>(null);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [reportResponse, nodeResponse] = await Promise.all([
        fetch(`${api}/sync/latest-result`),
        fetch(`${api}/node/state`),
      ]);
      if (!reportResponse.ok || !nodeResponse.ok) throw new Error("offline");
      setResult(await reportResponse.json());
      setNode(await nodeResponse.json());
      setNotice("");
    } catch {
      setNotice("Recall could not reach the local runtime.");
    }
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const rows = [
    ["New cloud writes", result?.synced?.length ?? 0],
    ["Already present", result?.already_existed?.length ?? 0],
    ["Version updates", result?.superseded_in_cloud?.length ?? 0],
    ["Needs review", result?.conflicts?.length ?? 0],
  ];
  async function syncNow() {
    if (
      !window.confirm(
        "Sync eligible, non-private memory records now? Raw events and screen frames remain local.",
      )
    )
      return;
    setRunning(true);
    const response = await fetch(`${api}/sync/run-now`, { method: "POST" });
    const nextNotice = response.ok
      ? "Sync attempt completed. The report below reflects this process."
      : "The sync attempt could not complete. Queued local memories remain intact.";
    await refresh();
    setNotice(nextNotice);
    setRunning(false);
  }

  const online = node?.status?.toLowerCase() === "online";
  return (
    <main className="detail-shell">
      <a className="detail-back" href="/">
        Back to memory
      </a>
      <section className="detail-hero">
        <p className="section-kicker">OPTIONAL EDGE TO CLOUD</p>
        <h1>Sync report</h1>
        <p>
          Recall queues eligible semantic memories locally. Raw activity and
          screenshots stay on this computer.
        </p>
      </section>
      {notice && <p className="notice detail-notice">{notice}</p>}
      <section className="sync-status-card">
        <div>
          <span className={online ? "sync-state online" : "sync-state"}>
            <i /> {online ? "Sync mode online" : "Sync mode offline"}
          </span>
          <h2>{node?.pending_sync_count ?? 0} memories waiting locally</h2>
          <p>
            {online
              ? "You control when the queue is sent. Private memories are never placed in it."
              : "The queue is safely paused until sync mode is restored from the Memory view."}
          </p>
        </div>
        <button
          className="detail-primary-button"
          onClick={syncNow}
          disabled={running || !online || !node?.pending_sync_count}
        >
          {running ? "Syncing..." : "Sync eligible memories"}
        </button>
      </section>
      <section className="sync-boundary-grid" aria-label="Sync boundary counts">
        <div>
          <b>{node?.local_memory_count ?? 0}</b>
          <small>local semantic memories</small>
        </div>
        <div>
          <b>{node?.private_count ?? 0}</b>
          <small>private - never queued</small>
        </div>
        <div>
          <b>{node?.cloud_memory_count ?? 0}</b>
          <small>cloud index records</small>
        </div>
      </section>
      <section className="sync-result-card">
        <div className="detail-section-heading">
          <div>
            <p className="section-kicker">LAST PROCESS-LOCAL RESULT</p>
            <h2>
              {result?.attempted
                ? "Completed sync attempt"
                : "No sync attempt in this process"}
            </h2>
          </div>
          <button className="detail-refresh" onClick={refresh}>
            Refresh
          </button>
        </div>
        {result?.attempted ? (
          <div className="sync-result-grid">
            {rows.map(([label, value]) => (
              <div key={String(label)}>
                <b>{value}</b>
                <small>{label}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="detail-empty">
            Run a sync when you are ready, or keep working offline. This page
            never treats a queued record as a cloud write.
          </p>
        )}
        <a className="conflict-link" href="/conflicts">
          Review sync conflicts
        </a>
      </section>
    </main>
  );
}
