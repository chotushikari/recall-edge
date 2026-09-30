"use client";

import { useEffect, useState } from "react";

type Props = { api: string };

export function PauseCaptureButton({ api }: Props) {
  const [capturing, setCapturing] = useState(true);
  useEffect(() => { fetch(`${api}/capture/status`).then((response) => response.json()).then((data) => setCapturing(data.capturing)).catch(() => setCapturing(true)); }, [api]);
  async function toggle() { const response = await fetch(`${api}${capturing ? "/capture/pause" : "/capture/resume"}`, { method: "POST" }); const data = await response.json(); setCapturing(data.capturing); }
  return <button className={capturing ? "" : "paused"} onClick={toggle}>{capturing ? "PAUSE CAPTURE" : "RESUME CAPTURE"}</button>;
}
