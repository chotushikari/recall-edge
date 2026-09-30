"use client";

import { useEffect, useState } from "react";

type Summary = { summary: string; top_apps: { name: string; minutes: number }[]; focus_minutes: number };
type Props = { api: string; date: string };

export function DailySummaryCard({ api, date }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => { fetch(`${api}/daily-summary?date=${date}`).then((response) => response.json()).then(setSummary).catch(() => setSummary(null)); }, [api, date]);
  return <section className="panel"><p className="eyebrow">DAILY DIGEST</p><p className="summary-copy">{summary?.summary ?? "Loading daily activity..."}</p><small>{summary?.top_apps.length ?? 0} active apps · {summary?.focus_minutes ?? 0} focused minutes</small></section>;
}
