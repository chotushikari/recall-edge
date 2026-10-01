"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Range = "today" | "yesterday" | "week";
type NodeState = {
  status: string;
  node_id: string;
  local_memory_count: number;
};
type CaptureState = { supported: boolean; capturing: boolean };
type Session = {
  id: string;
  start_time: string;
  end_time: string;
  primary_app: string;
  applications: string[];
  event_ids: string[];
  summary: string;
};
type EvidenceEvent = {
  id: string;
  timestamp_start: string;
  application: string;
  window_title?: string;
  url?: string | null;
};
type Frame = {
  id: string;
  timestamp: string;
  application?: string;
  window_title?: string;
  image_url: string;
};
type SearchResult = {
  memory_id: string;
  payload: {
    summary: string;
    timestamp: string;
    provenance?: { app_name?: string };
  };
};

const api = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

function rangeStart(range: Range) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  if (range === "yesterday") date.setDate(date.getDate() - 1);
  if (range === "week") date.setDate(date.getDate() - 6);
  return date.toISOString();
}
function time(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
function day(value: string) {
  return new Date(value).toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
function appTone(app: string) {
  const name = app.toLowerCase();
  if (
    name.includes("chrome") ||
    name.includes("edge") ||
    name.includes("firefox")
  )
    return "browser";
  if (
    name.includes("code") ||
    name.includes("terminal") ||
    name.includes("powershell")
  )
    return "coding";
  if (
    name.includes("slack") ||
    name.includes("teams") ||
    name.includes("discord")
  )
    return "message";
  return "neutral";
}

export default function Home() {
  const [range, setRange] = useState<Range>("today");
  const [node, setNode] = useState<NodeState | null>(null);
  const [activity, setActivity] = useState<CaptureState | null>(null);
  const [visual, setVisual] = useState<CaptureState | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [events, setEvents] = useState<EvidenceEvent[]>([]);
  const [frames, setFrames] = useState<Frame[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [isPlayingFrames, setIsPlayingFrames] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const start = rangeStart(range);
      const responses = await Promise.all([
        fetch(`${api}/node/state`),
        fetch(`${api}/activities/capture/status`),
        fetch(`${api}/visual-capture/status`),
        fetch(`${api}/sessions?start=${encodeURIComponent(start)}&limit=100`),
        fetch(
          `${api}/evidence/events?start=${encodeURIComponent(start)}&limit=500`,
        ),
        fetch(
          `${api}/evidence/frames?start=${encodeURIComponent(start)}&limit=100`,
        ),
      ]);
      if (responses.some((response) => !response.ok))
        throw new Error("A local endpoint was unavailable");
      const [
        nextNode,
        nextActivity,
        nextVisual,
        nextSessions,
        nextEvents,
        nextFrames,
      ] = await Promise.all(responses.map((response) => response.json()));
      setNode(nextNode);
      setActivity(nextActivity);
      setVisual(nextVisual);
      setSessions(nextSessions);
      setEvents(nextEvents);
      setFrames(nextFrames);
      setSelectedId((current) =>
        nextSessions.some((session: Session) => session.id === current)
          ? current
          : (nextSessions[0]?.id ?? null),
      );
      setNotice("");
    } catch {
      setNotice(
        "Recall could not reach the local runtime. Start Recall Desktop, then refresh this view.",
      );
    } finally {
      setLoading(false);
    }
  }, [range]);
  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 15_000);
    return () => window.clearInterval(interval);
  }, [refresh]);
  const selected =
    sessions.find((session) => session.id === selectedId) ??
    sessions[0] ??
    null;
  const selectedEvents = useMemo(
    () =>
      selected
        ? events
            .filter((event) => selected.event_ids.includes(event.id))
            .sort((a, b) => a.timestamp_start.localeCompare(b.timestamp_start))
        : [],
    [events, selected],
  );
  const selectedFrames = useMemo(
    () =>
      selected
        ? frames
            .filter(
              (frame) =>
                frame.timestamp >= selected.start_time &&
                frame.timestamp <= selected.end_time,
            )
            .slice(0, 6)
        : [],
    [frames, selected],
  );
  const activeFrame =
    selectedFrames.find((frame) => frame.id === selectedFrameId) ??
    selectedFrames[0] ??
    null;
  const activeFrameIndex = Math.max(
    0,
    selectedFrames.findIndex((frame) => frame.id === activeFrame?.id),
  );

  useEffect(() => {
    setSelectedFrameId(null);
    setIsPlayingFrames(false);
  }, [selected?.id]);

  useEffect(() => {
    if (!isPlayingFrames || selectedFrames.length < 2) return;
    const timer = window.setInterval(() => {
      setSelectedFrameId((current) => {
        const currentIndex = selectedFrames.findIndex(
          (frame) => frame.id === current,
        );
        return selectedFrames[(currentIndex + 1) % selectedFrames.length]?.id ?? null;
      });
    }, 900);
    return () => window.clearInterval(timer);
  }, [isPlayingFrames, selectedFrames]);
  const rangeTitle =
    range === "week"
      ? "Last 7 days"
      : range === "yesterday"
        ? "Yesterday"
        : "Today";
  const rangeOrder: Range[] = ["week", "yesterday", "today"];
  const rangeIndex = rangeOrder.indexOf(range);
  const canMoveBack = rangeIndex > 0;
  const canMoveForward = rangeIndex < rangeOrder.length - 1;
  function moveRange(direction: -1 | 1) {
    const nextRange = rangeOrder[rangeIndex + direction];
    if (nextRange) setRange(nextRange);
  }
  async function rebuildSessions() {
    setAction("rebuild");
    const response = await fetch(
      `${api}/sessions/rebuild?start=${encodeURIComponent(rangeStart(range))}`,
      { method: "POST" },
    );
    setNotice(
      response.ok
        ? "Timeline rebuilt from local evidence."
        : "The timeline could not be rebuilt.",
    );
    await refresh();
    setAction(null);
  }
  async function toggleActivity() {
    setAction("activity");
    const endpoint = activity?.capturing
      ? "/activities/capture/stop"
      : "/activities/capture/start";
    const response = await fetch(`${api}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: endpoint.endsWith("start") ? "{}" : undefined,
    });
    setNotice(
      response.ok
        ? endpoint.endsWith("start")
          ? "Activity capture is running locally."
          : "Activity capture stopped."
        : "Activity capture could not be changed.",
    );
    await refresh();
    setAction(null);
  }
  async function toggleVisual() {
    if (
      !visual?.capturing &&
      !window.confirm(
        "Start local visual capture? Screenshots stay on this device and can be stopped or deleted anytime.",
      )
    )
      return;
    setAction("visual");
    const endpoint = visual?.capturing
      ? "/visual-capture/stop"
      : "/visual-capture/start";
    const response = await fetch(`${api}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: endpoint.endsWith("start")
        ? JSON.stringify({ confirm_visual_capture: true })
        : undefined,
    });
    setNotice(
      response.ok
        ? endpoint.endsWith("start")
          ? "Visual capture is running locally."
          : "Visual capture stopped."
        : "Visual capture could not be changed.",
    );
    await refresh();
    setAction(null);
  }
  async function search(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setAction("search");
    const response = await fetch(`${api}/memory/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, top_k: 5 }),
    });
    setResults(response.ok ? await response.json() : []);
    setAction(null);
  }
  return (
    <main className="workspace-shell">
      <aside className="app-sidebar" aria-label="Recall navigation">
        <div className="sidebar-brand">
          <span className="brand-orb">r</span>
          <span>recall</span>
        </div>
        <nav className="sidebar-nav" aria-label="Memory views">
          <span className="nav-item active">
            <span>◈</span> Memory
          </span>
          <span className="nav-item">
            <span>◌</span> Discover <small>soon</small>
          </span>
          <span className="nav-item">
            <span>⌁</span> Settings <small>soon</small>
          </span>
        </nav>
        <div className="sidebar-foot">
          <span className="secure-dot" /> Local-only by default
        </div>
      </aside>
      <section className="memory-workspace">
        <header className="workspace-topbar">
          <div className="crumb">
            <span>Memory</span>
            <i>/</i>
            <strong>{rangeTitle}</strong>
          </div>
          <div className="topbar-actions">
            <span
              className={
                node?.status?.toLowerCase() === "online"
                  ? "runtime-status online"
                  : "runtime-status"
              }
            >
              <i />
              {node?.status ?? "Connecting"}
            </span>
            <button
              className="icon-button"
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh local evidence"
            >
              ↻
            </button>
          </div>
        </header>
        <section className="memory-hero">
          <div>
            <p className="section-kicker">YOUR PRIVATE COMPUTER MEMORY</p>
            <h1>
              Remember the work
              <br />
              <em>behind the work.</em>
            </h1>
            <p>
              Browse your permitted activity as a visual, inspectable story.
              Every item stays connected to the evidence that created it.
            </p>
          </div>
          <div className="node-summary">
            <div>
              <span className="pulse-dot" />
              <p>LOCAL MEMORY ENGINE</p>
            </div>
            <strong>{node?.local_memory_count ?? 0}</strong>
            <small>indexed memories · offline capable</small>
          </div>
        </section>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        <form className="memory-search" onSubmit={search}>
          <span>⌕</span>
          <input
            aria-label="Ask local memory"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ask your computer about something you saw or did…"
          />
          <kbd>↵</kbd>
          <button disabled={action === "search"}>
            {action === "search" ? "Searching…" : "Ask memory"}
          </button>
        </form>
        {results.length > 0 && (
          <section className="search-drawer" aria-live="polite">
            <p className="section-kicker">RETRIEVED LOCALLY · QDRANT EDGE</p>
            {results.map((result) => (
              <button key={result.memory_id} className="search-result">
                <span
                  className={`app-chip ${appTone(result.payload.provenance?.app_name ?? "")}`}
                >
                  {result.payload.provenance?.app_name ?? "Local"}
                </span>
                <b>{result.payload.summary}</b>
                <time>{time(result.payload.timestamp)}</time>
              </button>
            ))}
          </section>
        )}
        <section className="overview-strip">
          <div className="timeline-navigation" aria-label="Time window">
            <button className="nav-chevron" onClick={() => moveRange(-1)} disabled={!canMoveBack} aria-label="Show an earlier period">‹</button>
            <button className="date-pill" onClick={() => setRange("today")}><span className="calendar-glyph">▦</span>{rangeTitle}</button>
            <button className="nav-chevron" onClick={() => moveRange(1)} disabled={!canMoveForward} aria-label="Show a later period">›</button>
            <div className="view-switch" aria-label="Timeline scale">
              <button className={range === "week" ? "" : "selected"} onClick={() => setRange("today")}>Day</button>
              <button className={range === "week" ? "selected" : ""} onClick={() => setRange("week")}>Week</button>
            </div>
            {range !== "today" && <button className="today-button" onClick={() => setRange("today")}>Today</button>}
          </div>
          <div className="capture-summary">
            <CaptureToggle
              label="Context"
              caption="App + window"
              active={Boolean(activity?.capturing)}
              busy={action === "activity"}
              supported={Boolean(activity?.supported)}
              action={toggleActivity}
            />
            <CaptureToggle
              label="Visual"
              caption="Explicit frames"
              active={Boolean(visual?.capturing)}
              busy={action === "visual"}
              supported={Boolean(visual?.supported)}
              action={toggleVisual}
            />
          </div>
        </section>
        <section className="content-grid">
          <section className="timeline-area">
            <div className="area-heading">
              <div>
                <p className="section-kicker">ACTIVITY TIMELINE</p>
                <h2>
                  {sessions.length ? day(sessions[0].start_time) : rangeTitle}
                </h2>
              </div>
              <button
                className="rebuild-button"
                onClick={rebuildSessions}
                disabled={action === "rebuild"}
              >
                {action === "rebuild" ? "Rebuilding…" : "Rebuild from evidence"}
              </button>
            </div>
            <div className="timeline-stats">
              <span>
                <b>{sessions.length}</b> sessions
              </span>
              <span>
                <b>{events.length}</b> evidence events
              </span>
              <span>
                <b>{frames.length}</b> permitted frames
              </span>
            </div>
            <div className="timeline-stream">
              {sessions.map((session, index) => (
                <button
                  className={
                    selected?.id === session.id
                      ? "memory-card selected"
                      : "memory-card"
                  }
                  onClick={() => setSelectedId(session.id)}
                  key={session.id}
                  style={{ animationDelay: `${Math.min(index * 45, 360)}ms` }}
                >
                  <time>
                    <b>{time(session.start_time)}</b>
                    <span>{time(session.end_time)}</span>
                  </time>
                  <span className="timeline-stem">
                    <i />
                  </span>
                  <span className="memory-card-copy">
                    <span className="chip-row">
                      {session.applications.slice(0, 3).map((app) => (
                        <span className={`app-chip ${appTone(app)}`} key={app}>
                          {app}
                        </span>
                      ))}
                    </span>
                    <strong>{session.summary}</strong>
                    <small>
                      {session.event_ids.length} evidence events ·{" "}
                      {session.primary_app}
                    </small>
                  </span>
                  <span className="card-arrow">↗</span>
                </button>
              ))}
              {!loading && !sessions.length && (
                <div className="timeline-empty">
                  <div className="empty-orbit">◌</div>
                  <b>Your timeline will begin here.</b>
                  <p>
                    Turn on context capture, use your computer normally, then
                    rebuild the story from your local evidence.
                  </p>
                </div>
              )}
              {loading && !sessions.length && (
                <div className="timeline-loading">
                  <i />
                  <i />
                  <i />
                </div>
              )}
            </div>
          </section>
          <aside className="inspector-area">
            <div className="inspector-header">
              <div>
                <p className="section-kicker">EVIDENCE PREVIEW</p>
                <h2>
                  {selected ? time(selected.start_time) : "No session selected"}
                </h2>
              </div>
              {selected && (
                <span className="event-count">
                  {selectedEvents.length} events
                </span>
              )}
            </div>
            {selected ? (
              <>
                <p className="selected-summary">{selected.summary}</p>
                <div className="preview-stage">
                  {activeFrame ? (
                    <img
                      className="active-frame"
                      src={`${api}${activeFrame.image_url}`}
                      alt={`Recorded screen at ${time(activeFrame.timestamp)}`}
                    />
                  ) : (
                    <div className="no-frame">
                      <span>◫</span>
                      <b>No visual frame in this session</b>
                      <p>
                        Visual capture is optional and stays off until you
                        explicitly enable it.
                      </p>
                    </div>
                  )}
                  <div className="preview-gradient" />
                  {activeFrame && (
                    <span className="frame-stamp">
                      {time(activeFrame.timestamp)} ·{" "}
                      {activeFrame.application ?? "Screen"}
                    </span>
                  )}
                </div>
                {selectedFrames.length > 1 && activeFrame && (
                  <div className="frame-controls">
                    <button
                      className="frame-play"
                      onClick={() => setIsPlayingFrames((playing) => !playing)}
                      aria-label={isPlayingFrames ? "Pause evidence replay" : "Play evidence replay"}
                      aria-pressed={isPlayingFrames}
                    >
                      {isPlayingFrames ? "Ⅱ" : "▶"}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max={selectedFrames.length - 1}
                      value={activeFrameIndex}
                      onChange={(event) => {
                        setIsPlayingFrames(false);
                        setSelectedFrameId(selectedFrames[Number(event.target.value)]?.id ?? null);
                      }}
                      aria-label="Scrub through permitted session frames"
                    />
                    <span>{activeFrameIndex + 1} / {selectedFrames.length}</span>
                  </div>
                )}
                {selectedFrames.length > 1 && (
                  <div className="frame-strip">
                    {selectedFrames.slice(0, 5).map((frame) => (
                      <button
                        key={frame.id}
                        className={
                          activeFrame?.id === frame.id
                            ? "frame-thumb selected"
                            : "frame-thumb"
                        }
                        onClick={() => setSelectedFrameId(frame.id)}
                        aria-pressed={activeFrame?.id === frame.id}
                        aria-label={`Show recorded screen at ${time(frame.timestamp)}`}
                      >
                        <img
                          src={`${api}${frame.image_url}`}
                          alt={`Recorded screen at ${time(frame.timestamp)}`}
                        />
                        <span>{time(frame.timestamp)}</span>
                      </button>
                    ))}
                  </div>
                )}
                <section className="evidence-list-section">
                  <div className="mini-heading">
                    <span>Supporting evidence</span>
                    <small>grounded records</small>
                  </div>
                  <div className="evidence-list">
                    {selectedEvents.map((event) => (
                      <div className="evidence-row" key={event.id}>
                        <time>{time(event.timestamp_start)}</time>
                        <span
                          className={`evidence-app ${appTone(event.application)}`}
                        >
                          {event.application.slice(0, 1)}
                        </span>
                        <div>
                          <b>{event.application}</b>
                          <p>{event.window_title || "Untitled window"}</p>
                          {event.url && <small>{event.url}</small>}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <div className="inspector-empty">
                <span>⌁</span>
                <p>
                  Select a memory from the timeline to inspect its source
                  evidence.
                </p>
              </div>
            )}
          </aside>
        </section>
      </section>
    </main>
  );
}

function CaptureToggle({
  label,
  caption,
  active,
  busy,
  supported,
  action,
}: {
  label: string;
  caption: string;
  active: boolean;
  busy: boolean;
  supported: boolean;
  action: () => void;
}) {
  return (
    <div className="capture-toggle">
      <button
        className={active ? "capture-switch active" : "capture-switch"}
        onClick={action}
        disabled={busy || !supported}
        aria-pressed={active}
      >
        <i />
      </button>
      <div>
        <b>{label}</b>
        <small>{active ? "Recording locally" : caption}</small>
      </div>
    </div>
  );
}
