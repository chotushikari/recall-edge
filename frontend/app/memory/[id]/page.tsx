"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Memory = { memory_id: string; summary: string; timestamp: string; version: number; privacy: string; supersedes?: string; superseded_by?: string };
const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export default function MemoryDetailPage() {
  const params = useParams<{ id: string }>();
  const [memory, setMemory] = useState<(Memory & { history?: Memory[] }) | null>(null);
  useEffect(() => { fetch(`${api}/memory/${params.id}?include_history=true`).then((response) => response.json()).then(setMemory).catch(() => setMemory(null)); }, [params.id]);
  return <main className="detail-page"><a href="/">← Dashboard</a><p className="eyebrow">VERSIONED MEMORY</p><h1>{memory?.summary ?? "Loading memory..."}</h1><section className="history">{memory?.history?.map((version) => <article className="history-card" key={version.memory_id}><span>v{version.version}</span><h2>{version.summary}</h2><p>{new Date(version.timestamp).toLocaleString()}</p><small>{version.superseded_by ? "Superseded by a newer version" : "Current searchable version"}</small></article>)}</section></main>;
}
