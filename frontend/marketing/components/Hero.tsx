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
    <div className="hero-head">
      <p className="hero-kicker"><i /> RECALL / PERSONAL COMPUTER MEMORY</p>
      <h1>The context behind your work, <em>kept.</em></h1>
      <p className="hero-copy">Recall is a local-first memory layer for your computer. It connects permitted activity into an evidence-backed timeline you can search, revisit, and control.</p>
      <div className="hero-actions"><MotionButton className="pill-primary" href="#download">Download for Windows <span>&darr;</span></MotionButton><MotionButton className="hero-source" href="https://github.com/chotushikari/recall-edge">View source <span>&nearr;</span></MotionButton></div>
    </div>
    <div className="hero-window" aria-label="Recall timeline preview">
      <div className="hero-window-bar"><div className="brand-mini"><span>r</span> recall</div><b>Thursday, October 02</b><em><i /> capture on</em></div>
      <div className="hero-window-body"><aside><p>MEMORY</p><b>Today</b><span>Sessions</span><span>Search</span><span>Settings</span><small>Local-only</small></aside><div className="hero-timeline"><header><div><span>YOUR DAY</span><h2>From research to retrieval</h2></div><button>Filter <span>&#8964;</span></button></header><div className="time-grid">{moments.map(([time, app, title, kind]) => <article key={time}><time>{time}</time><i className={kind} /><div><span>{app}</span><b>{title}</b></div><em>{kind}</em></article>)}</div><div className="hero-answer"><span>ASK RECALL</span><b>What did I do after opening VS Code?</b><p>12 linked events &middot; Open evidence <strong>&rarr;</strong></p></div></div></div>
    </div>
    <p className="hero-footnote">Open source &middot; local-first &middot; evidence-grounded</p>
  </section>;
}
