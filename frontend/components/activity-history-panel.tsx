"use client";

import { useEffect, useState } from "react";

import { AppIcon } from "./app-icon";

type Activity = { event_id: string; app_name: string; window_title: string; timestamp: string };
type CaptureState = { supported: boolean; capturing: boolean };

export function ActivityHistoryPanel({ api, range }: { api: string; range: string }) {
  const [events, setEvents] = useState<Activity[]>([]);
  const [capture, setCapture] = useState<CaptureState | null>(null);
  const refresh = () => {
    fetch(`${api}/activities/history?range=${range}&limit=6`).then((response) => response.json()).then(setEvents).catch(() => setEvents([]));
    fetch(`${api}/activities/capture/status`).then((response) => response.json()).then(setCapture).catch(() => setCapture(null));
  };
  useEffect(refresh, [api, range]);
  async function toggle() {
    const path = capture?.capturing ? "/activities/capture/stop" : "/activities/capture/start";
    setCapture(await fetch(`${api}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: path.endsWith("start") ? JSON.stringify({}) : undefined }).then((response) => response.json()));
    refresh();
  }
  return <section className="panel"><p className="eyebrow">LOCAL ACTIVITY LEDGER</p>{capture?.supported && <button onClick={toggle}>{capture.capturing ? "STOP ACTIVITY CAPTURE" : "START ACTIVITY CAPTURE"}</button>}{events.length ? events.map((event) => <div className="activity-row" key={event.event_id}><AppIcon name={event.app_name}/><div><b>{event.app_name}</b><span>{event.window_title || "Untitled window"}</span><small>{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small></div></div>) : <p className="empty">Start capture to record foreground app and browser-tab-title history.</p>}<small className="activity-note">One Recall process · local only · no screenshots · no keystrokes · no full browser URLs</small></section>;
}
