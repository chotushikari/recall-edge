"use client";

import { useEffect, useState } from "react";
import { AppIcon } from "./app-icon";

type AppUsage = { app_name: string; minutes: number; bundle_id?: string | null };
type Props = { api: string; range: string };

export function AppUsageSidebar({ api, range }: Props) {
  const [apps, setApps] = useState<AppUsage[]>([]);
  useEffect(() => { fetch(`${api}/app-usage?range=${range}`).then((response) => response.json()).then((data) => setApps(data.apps ?? [])).catch(() => setApps([])); }, [api, range]);
  const maximum = Math.max(...apps.map((app) => app.minutes), 1);
  return <section className="panel"><p className="eyebrow">APP ACTIVITY</p>{apps.length ? apps.map((app) => <div className="usage-row" key={`${app.app_name}-${app.bundle_id ?? "local"}`}><AppIcon name={app.app_name} /><div><div className="usage-label"><span>{app.app_name}</span><small>~{app.minutes}m</small></div><div className="progress"><i style={{ width: `${(app.minutes / maximum) * 100}%` }} /></div></div></div>) : <p className="empty">No activity in this range.</p>}</section>;
}
