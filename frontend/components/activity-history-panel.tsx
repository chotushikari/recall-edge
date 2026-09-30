"use client";

import { useEffect, useState } from "react";

import { AppIcon } from "./app-icon";

type Activity = { event_id: string; app_name: string; window_title: string; timestamp: string };

export function ActivityHistoryPanel({ api, range }: { api: string; range: string }) {
  const [events, setEvents] = useState<Activity[]>([]);
  useEffect(() => {
    fetch(`${api}/activities/history?range=${range}&limit=6`)
      .then((response) => response.json())
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [api, range]);
  return <section className="panel"><p className="eyebrow">LOCAL ACTIVITY LEDGER</p>{events.length ? events.map((event) => <div className="activity-row" key={event.event_id}><AppIcon name={event.app_name}/><div><b>{event.app_name}</b><span>{event.window_title || "Untitled window"}</span><small>{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div></div>) : <p className="empty">Start the Windows collector to record foreground app and window history.</p>}<small className="activity-note">Local only · no screenshots · no keystrokes · browser tabs need explicit consent</small></section>;
}
