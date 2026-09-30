"use client";

import { useEffect, useState } from "react";

type Day = { date: string; count: number };
type Props = { api: string; onPickDay: (date: string) => void };

export function CalendarHeatmapStrip({ api, onPickDay }: Props) {
  const [days, setDays] = useState<Day[]>([]);
  useEffect(() => { fetch(`${api}/calendar-heatmap?days=14`).then((response) => response.json()).then((data) => setDays(data.days ?? [])).catch(() => setDays([])); }, [api]);
  const maximum = Math.max(...days.map((day) => day.count), 1);
  return <section className="panel heatmap"><p className="eyebrow">LAST 14 DAYS</p><div className="heatmap-days">{days.map((day) => <button aria-label={`${day.date}: ${day.count} memories`} key={day.date} onClick={() => onPickDay(day.date)} style={{ opacity: 0.18 + (day.count / maximum) * 0.82 }} title={`${day.date}: ${day.count} memories`} />)}</div></section>;
}
