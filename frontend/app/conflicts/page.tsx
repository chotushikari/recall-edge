"use client";

import { useEffect, useState } from "react";

type Conflict = {
  conflict_id: string;
  memory_dedup_key: string;
  edge_version: number;
  cloud_version: number;
  detected_at: string;
};
const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export default function ConflictsPage() {
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch(`${api}/sync/conflicts`)
      .then((response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then(setConflicts)
      .catch(() => setFailed(true));
  }, []);
  return (
    <main className="detail-shell">
      <a className="detail-back" href="/sync/report">
        Back to sync report
      </a>
      <section className="detail-hero compact">
        <p className="section-kicker">HUMAN REVIEW</p>
        <h1>Version conflicts</h1>
        <p>
          Recall preserves both records when cloud history is newer. Nothing is
          silently overwritten.
        </p>
      </section>
      {failed ? (
        <p className="notice detail-notice">
          Recall could not load the local conflict registry.
        </p>
      ) : conflicts.length ? (
        <section className="conflict-stack">
          {conflicts.map((conflict) => (
            <article className="conflict-card" key={conflict.conflict_id}>
              <span>Review required</span>
              <div>
                <h2>
                  Edge v{conflict.edge_version} / Cloud v
                  {conflict.cloud_version}
                </h2>
                <p>
                  Detected {new Date(conflict.detected_at).toLocaleString()}
                </p>
                <small>Memory key: {conflict.memory_dedup_key}</small>
              </div>
              <p className="conflict-safety">
                The cloud record is preserved. Resolution workflow is kept
                explicit to avoid overwriting personal history.
              </p>
            </article>
          ))}
        </section>
      ) : (
        <section className="detail-empty-card">
          <span>OK</span>
          <h2>No conflicts require review.</h2>
          <p>
            Both memory stores are currently free of reported version races.
          </p>
        </section>
      )}
    </main>
  );
}
