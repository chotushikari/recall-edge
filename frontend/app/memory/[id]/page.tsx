"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Memory = {
  memory_id: string;
  summary: string;
  embedding_text: string;
  timestamp: string;
  version: number;
  privacy?: "private" | "syncable";
  memory_type: string;
  local_only: boolean;
  supersedes?: string | null;
  superseded_by?: string | null;
  provenance?: { app_name?: string; project?: string; url?: string };
};
const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export default function MemoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [memory, setMemory] = useState<
    (Memory & { history?: Memory[] }) | null
  >(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setMemory(null);
    setFailed(false);
    fetch(`${api}/memory/${params.id}?include_history=true`)
      .then((response) => {
        if (!response.ok) throw new Error("not found");
        return response.json();
      })
      .then(setMemory)
      .catch(() => setFailed(true));
  }, [params.id]);

  if (failed) {
    return (
      <main className="detail-shell">
        <a className="detail-back" href="/">
          Back to memory
        </a>
        <section className="detail-empty-card memory-not-found">
          <span>?</span>
          <h2>Memory not available.</h2>
          <p>
            It may have been deleted from this device or the local runtime is
            offline.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="detail-shell">
      <a className="detail-back" href="/">
        Back to memory
      </a>
      <section className="detail-hero compact memory-detail-hero">
        <p className="section-kicker">EVIDENCE-LINKED MEMORY</p>
        <h1>{memory?.summary ?? "Loading memory..."}</h1>
        {memory && (
          <div className="memory-detail-chips">
            <span
              className={
                memory.privacy === "private"
                  ? "privacy-chip private"
                  : "privacy-chip"
              }
            >
              {memory.privacy === "private"
                ? "Private - edge only"
                : "Syncable memory"}
            </span>
            <span>v{memory.version}</span>
            <span>{memory.memory_type}</span>
            <span>{new Date(memory.timestamp).toLocaleString()}</span>
          </div>
        )}
      </section>
      {memory && (
        <>
          <section className="memory-evidence-card">
            <div className="detail-section-heading">
              <div>
                <p className="section-kicker">RETRIEVAL EVIDENCE</p>
                <h2>What Recall indexed</h2>
              </div>
              <span
                className={
                  memory.local_only ? "storage-badge" : "storage-badge synced"
                }
              >
                {memory.local_only ? "Local only" : "Cloud copy eligible"}
              </span>
            </div>
            <p>{memory.embedding_text}</p>
            <dl className="memory-provenance">
              <div>
                <dt>Source app</dt>
                <dd>{memory.provenance?.app_name ?? "Local Recall"}</dd>
              </div>
              <div>
                <dt>Project</dt>
                <dd>{memory.provenance?.project ?? "Not inferred"}</dd>
              </div>
              <div>
                <dt>URL</dt>
                <dd>{memory.provenance?.url ?? "Not captured"}</dd>
              </div>
            </dl>
          </section>
          <section className="version-history-card">
            <div className="detail-section-heading">
              <div>
                <p className="section-kicker">VERSION HISTORY</p>
                <h2>
                  {memory.history?.length ?? 1} preserved version
                  {(memory.history?.length ?? 1) === 1 ? "" : "s"}
                </h2>
              </div>
            </div>
            <div className="version-history-stream">
              {(memory.history?.length ? memory.history : [memory]).map(
                (version, index) => (
                  <article className="version-row" key={version.memory_id}>
                    <span className="version-marker">v{version.version}</span>
                    <div>
                      <b>{version.summary}</b>
                      <p>{new Date(version.timestamp).toLocaleString()}</p>
                    </div>
                    <small>
                      {index === 0 && !version.superseded_by
                        ? "Current searchable record"
                        : "Preserved version"}
                    </small>
                  </article>
                ),
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
