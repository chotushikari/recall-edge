"use client";

import { MotionButton } from "./MotionReveal";

const moments = [
  ["09:42", "Research", "Qdrant documentation", "research"],
  ["10:08", "VS Code", "Evidence retrieval path", "build"],
  ["10:31", "Terminal", "Verified the retrieval test", "verify"],
  ["10:47", "Browser", "GitHub issue context", "review"],
];

export function Hero() {
  return <section id="top" className="hero-shell">
    <div className="hero-noise" aria-hidden="true" />
    <div className="hero-grid">
      <div className="hero-head">
        <p className="hero-kicker"><i /> PRIVATE PREVIEW FOR WINDOWS</p>
        <h1>A memory layer for your computer.</h1>
        <p className="hero-copy">Recall organizes the activity you choose to capture into a local, evidence-linked history. Find the tab, file, conversation, or task without piecing the day together again.</p>
        <div className="hero-actions"><MotionButton className="pill-primary" href="#download">Download preview <span>&darr;</span></MotionButton><MotionButton className="hero-source" href="#architecture">How it works <span>&rarr;</span></MotionButton></div>
        <dl className="hero-facts"><div><dt>Local-first</dt><dd>SQLite + on-device retrieval</dd></div><div><dt>Evidence-linked</dt><dd>Every answer traces to source activity</dd></div></dl>
      </div>
      <div className="hero-window" aria-label="Recall timeline preview">
        <div className="hero-window-bar"><div className="brand-mini"><span>r</span> recall</div><b>Thursday, October 02</b><em><i /> capture on</em></div>
        <div className="hero-window-body"><aside><p>MEMORY</p><b>Today</b><span>Sessions</span><span>Search</span><span>Settings</span><small>Local-only</small></aside><div className="hero-timeline"><header><div><span>YOUR DAY</span><h2>From research to retrieval</h2></div><button>Filter <span>&#8964;</span></button></header><div className="time-grid">{moments.map(([time, app, title, kind]) => <article key={time}><time>{time}</time><i className={kind} /><div><span>{app}</span><b>{title}</b></div><em>{kind}</em></article>)}</div><div className="hero-answer"><span>ASK RECALL</span><b>What did I do after opening VS Code?</b><p>12 linked events &middot; Open evidence <strong>&rarr;</strong></p></div></div></div>
      </div>
    </div>
  </section>;
}
