"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Range = "today" | "yesterday" | "week";
type NodeState = {
  status: string;
  node_id: string;
  local_memory_count: number;
  cloud_memory_count: number;
  pending_sync_count: number;
  private_count: number;
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
type DailySummary = {
  summary: string;
  top_apps: { name: string; minutes: number }[];
  focus_minutes: number;
};
type HeatmapDay = { date: string; count: number };

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
  const [showPrivacyControls, setShowPrivacyControls] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [notePrivacy, setNotePrivacy] = useState<"private" | "syncable">(
    "private",
  );
  const [retentionDays, setRetentionDays] = useState("30");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [dailySummary, setDailySummary] = useState<DailySummary | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapDay[]>([]);
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
        fetch(`${api}/daily-summary`),
        fetch(`${api}/calendar-heatmap?days=14`),
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
        nextDailySummary,
        nextHeatmap,
      ] = await Promise.all(responses.map((response) => response.json()));
      setNode(nextNode);
      setActivity(nextActivity);
      setVisual(nextVisual);
      setSessions(nextSessions);
      setEvents(nextEvents);
      setFrames(nextFrames);
      setDailySummary(nextDailySummary);
      setHeatmap(nextHeatmap.days ?? []);
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
        return (
          selectedFrames[(currentIndex + 1) % selectedFrames.length]?.id ?? null
        );
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
  async function pruneFrames() {
    const days = Number(retentionDays);
    if (
      !window.confirm(
        `Delete local screen frames older than ${days} days? This cannot be undone.`,
      )
    )
      return;
    setAction("prune");
    const response = await fetch(`${api}/evidence/retention/prune`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retention_days: days }),
    });
    const result = response.ok ? await response.json() : null;
    setNotice(
      response.ok
        ? `${result.frames_deleted} local screen frames deleted.`
        : "Frame retention could not be applied.",
    );
    await refresh();
    setAction(null);
  }
  async function wipeLocalEvidence() {
    if (
      !window.confirm(
        "Delete all Recall evidence stored on this device? Cloud copies, if any, are not affected.",
      )
    )
      return;
    if (
      !window.confirm(
        "This permanently removes local events, frames, sessions, and local semantic memories. Continue?",
      )
    )
      return;
    setAction("wipe");
    const response = await fetch(`${api}/evidence/all`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm_delete: true }),
    });
    setNotice(
      response.ok
        ? "All local Recall evidence was deleted."
        : "Local evidence could not be deleted.",
    );
    await refresh();
    setAction(null);
  }
  async function toggleSyncMode() {
    const nextOnline = node?.status?.toLowerCase() !== "online";
    setAction("network");
    const response = await fetch(`${api}/network/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ online: nextOnline }),
    });
    setNotice(
      response.ok
        ? nextOnline
          ? "Recall sync mode is online. Your computer network was not changed."
          : "Recall sync mode is offline. New eligible memories stay queued locally."
        : "Recall sync mode could not be changed.",
    );
    await refresh();
    setAction(null);
  }
  async function runSync() {
    if (
      !window.confirm(
        "Sync eligible, non-private memory records now? Raw events and screen frames remain local.",
      )
    )
      return;
    setAction("sync");
    const response = await fetch(`${api}/sync/run-now`, { method: "POST" });
    setNotice(
      response.ok
        ? "Sync attempt completed. Review the sync report for the evidence-level result."
        : "Recall could not complete this sync attempt. Your queued local memories remain intact.",
    );
    await refresh();
    setAction(null);
  }
  async function addMemoryNote(event: FormEvent) {
    event.preventDefault();
    const summary = noteText.trim();
    if (!summary) return;
    setAction("note");
    const response = await fetch(`${api}/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        memory_type: "user",
        summary,
        embedding_text: summary,
        privacy: notePrivacy,
        provenance: { app_name: "Recall", source: "manual_note" },
      }),
    });
    if (response.ok) {
      setNoteText("");
      setShowQuickAdd(false);
      await refresh();
      setNotice(
        notePrivacy === "private"
          ? "Private note saved locally. It was not added to the sync queue."
          : "Syncable note saved locally and added to the optional sync queue.",
      );
    } else {
      setNotice("Recall could not save that note locally.");
    }
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
          <button
            className={
              showPrivacyControls
                ? "nav-item active privacy-nav"
                : "nav-item privacy-nav"
            }
            onClick={() => setShowPrivacyControls((open) => !open)}
            aria-expanded={showPrivacyControls}
          >
            <span>⌁</span> Privacy
          </button>
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
              className="quick-add-button"
              onClick={() => setShowQuickAdd(true)}
            >
              + Note
            </button>
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
        {showQuickAdd && (
          <div className="quick-add-backdrop" role="presentation">
            <form
              className="quick-add-modal"
              onSubmit={addMemoryNote}
              aria-label="Add a manual memory note"
            >
              <div className="quick-add-heading">
                <div>
                  <p className="section-kicker">MANUAL MEMORY</p>
                  <h2>Save a thought to Recall.</h2>
                </div>
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => setShowQuickAdd(false)}
                  aria-label="Close manual memory note"
                >
                  x
                </button>
              </div>
              <textarea
                autoFocus
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="What should your computer remember?"
                maxLength={1_000}
              />
              <div className="note-privacy-row">
                <label>
                  <input
                    type="radio"
                    name="note-privacy"
                    value="private"
                    checked={notePrivacy === "private"}
                    onChange={() => setNotePrivacy("private")}
                  />
                  <span>
                    <b>Private</b>
                    <small>Stored only on this device</small>
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="note-privacy"
                    value="syncable"
                    checked={notePrivacy === "syncable"}
                    onChange={() => setNotePrivacy("syncable")}
                  />
                  <span>
                    <b>Syncable</b>
                    <small>Can enter the optional cloud queue</small>
                  </span>
                </label>
              </div>
              <div className="quick-add-actions">
                <button
                  type="button"
                  className="quick-add-cancel"
                  onClick={() => setShowQuickAdd(false)}
                >
                  Cancel
                </button>
                <button
                  className="quick-add-save"
                  disabled={action === "note" || !noteText.trim()}
                >
                  {action === "note" ? "Saving..." : "Save local memory"}
                </button>
              </div>
            </form>
          </div>
        )}
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
        <section className="edge-link" aria-label="Local and cloud sync status">
          <div className="edge-link-copy">
            <p className="section-kicker">MEMORY BOUNDARY</p>
            <h2>Local evidence first. Optional sync second.</h2>
            <p>
              Events and screen frames stay on this computer. Only eligible
              semantic memories can enter the optional sync queue.
            </p>
          </div>
          <div className="edge-metrics">
            <span>
              <b>{node?.private_count ?? 0}</b>
              <small>private - never queued</small>
            </span>
            <span>
              <b>{node?.pending_sync_count ?? 0}</b>
              <small>waiting locally</small>
            </span>
            <span>
              <b>{node?.cloud_memory_count ?? 0}</b>
              <small>cloud index records</small>
            </span>
          </div>
          <div className="edge-actions">
            <button
              className="sync-mode-button"
              onClick={toggleSyncMode}
              disabled={action === "network"}
            >
              {action === "network"
                ? "Changing mode..."
                : node?.status?.toLowerCase() === "online"
                  ? "Work offline"
                  : "Restore sync"}
            </button>
            <button
              className="sync-now-button"
              onClick={runSync}
              disabled={
                action === "sync" ||
                node?.status?.toLowerCase() !== "online" ||
                !node?.pending_sync_count
              }
            >
              {action === "sync" ? "Syncing..." : "Sync eligible memories"}
            </button>
            <a href="/sync/report">View sync report</a>
          </div>
        </section>
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {showPrivacyControls && (
          <section
            className="privacy-controls"
            aria-label="Local privacy controls"
          >
            <div>
              <p className="section-kicker">LOCAL PRIVACY CONTROLS</p>
              <h2>Your data, your retention window.</h2>
              <p>
                These actions affect only evidence stored on this device. Any
                optional cloud copy must be managed separately.
              </p>
            </div>
            <div className="retention-action">
              <label htmlFor="retention-days">Delete frames older than</label>
              <div>
                <select
                  id="retention-days"
                  value={retentionDays}
                  onChange={(event) => setRetentionDays(event.target.value)}
                >
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                </select>
                <button onClick={pruneFrames} disabled={action === "prune"}>
                  {action === "prune" ? "Pruning…" : "Apply"}
                </button>
              </div>
            </div>
            <button
              className="wipe-button"
              onClick={wipeLocalEvidence}
              disabled={action === "wipe"}
            >
              {action === "wipe" ? "Deleting…" : "Delete all local evidence"}
            </button>
          </section>
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
              <button
                key={result.memory_id}
                className="search-result"
                onClick={() =>
                  window.location.assign(`/memory/${result.memory_id}`)
                }
              >
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
            <button
              className="nav-chevron"
              onClick={() => moveRange(-1)}
              disabled={!canMoveBack}
              aria-label="Show an earlier period"
            >
              ‹
            </button>
            <button className="date-pill" onClick={() => setRange("today")}>
              <span className="calendar-glyph">▦</span>
              {rangeTitle}
            </button>
            <button
              className="nav-chevron"
              onClick={() => moveRange(1)}
              disabled={!canMoveForward}
              aria-label="Show a later period"
            >
              ›
            </button>
            <div className="view-switch" aria-label="Timeline scale">
              <button
                className={range === "week" ? "" : "selected"}
                onClick={() => setRange("today")}
              >
                Day
              </button>
              <button
                className={range === "week" ? "selected" : ""}
                onClick={() => setRange("week")}
              >
                Week
              </button>
            </div>
            {range !== "today" && (
              <button
                className="today-button"
                onClick={() => setRange("today")}
              >
                Today
              </button>
            )}
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
        <section className="memory-rhythm" aria-label="Recent activity rhythm">
          <div className="rhythm-days">
            {heatmap.map((item) => {
              const intensity = Math.min(item.count, 4);
              const label = new Date(
                `${item.date}T00:00:00`,
              ).toLocaleDateString([], { month: "short", day: "numeric" });
              return (
                <div
                  className="rhythm-day"
                  key={item.date}
                  title={`${label}: ${item.count} memories`}
                >
                  <i className={`heat-${intensity}`} />
                  <small>{label.slice(-2)}</small>
                </div>
              );
            })}
          </div>
          <div className="daily-digest">
            <span className="digest-mark">✦</span>
            <p>
              <b>Today’s local digest</b>
              {dailySummary?.summary ?? "Loading local activity summary…"}
            </p>
            {dailySummary?.top_apps.length ? (
              <small>
                {dailySummary.top_apps
                  .slice(0, 3)
                  .map((app) => `${app.name} ${app.minutes}m`)
                  .join(" · ")}
              </small>
            ) : (
              <small>Capture is off until you choose to start it.</small>
            )}
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
                      aria-label={
                        isPlayingFrames
                          ? "Pause evidence replay"
                          : "Play evidence replay"
                      }
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
                        setSelectedFrameId(
                          selectedFrames[Number(event.target.value)]?.id ??
                            null,
                        );
                      }}
                      aria-label="Scrub through permitted session frames"
                    />
                    <span>
                      {activeFrameIndex + 1} / {selectedFrames.length}
                    </span>
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
