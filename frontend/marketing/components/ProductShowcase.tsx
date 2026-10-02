"use client";

import { useState } from "react";

type ViewKey = "Timeline" | "Brief" | "Ask";

const views: Record<ViewKey, { eyebrow: string; title: string; body: string }> = {
  Timeline: {
    eyebrow: "RECONSTRUCT THE DAY",
    title: "A timeline with the context still attached.",
    body: "Move through the events around a moment: active apps, windows, tabs, files, and permitted screenshots.",
  },
  Brief: {
    eyebrow: "MAKE THE DAY LEGIBLE",
    title: "Turn a chain of events into a working brief.",
    body: "Recall clusters the evidence around work into sessions you can inspect, edit, retain, or remove.",
  },
  Ask: {
    eyebrow: "ASK WITH RECEIPTS",
    title: "Find the moment, then open its sources.",
    body: "Natural-language retrieval is grounded in local evidence and gives every answer a way back to the original activity.",
  },
};

const eventRows = [
  ["09:42", "Chrome", "Qdrant documentation", "research"],
  ["10:08", "VS Code", "recall-edge / retrieval.py", "coding"],
  ["10:31", "Terminal", "pytest evidence retrieval", "testing"],
  ["10:47", "Chrome", "GitHub issue review", "review"],
];

export function ProductShowcase() {
  const [active, setActive] = useState<ViewKey>("Timeline");
  const detail = views[active];

  return (
    <section id="product" className="product-showcase section-wrap" aria-labelledby="product-title">
      <div className="section-heading" data-reveal>
        <p className="eyebrow">MEMORY AT EVERY FIDELITY</p>
        <h2 id="product-title">See the thread. Then <em>follow it.</em></h2>
        <p>Recall is not a productivity score. It is an inspectable account of the context around your work.</p>
      </div>
      <div className="showcase-layout" data-reveal>
        <div className="showcase-copy">
          <div className="segmented-control" role="tablist" aria-label="Recall views">
            {(Object.keys(views) as ViewKey[]).map((view) => (
              <button key={view} role="tab" aria-selected={active === view} className={active === view ? "is-active" : ""} onClick={() => setActive(view)}>{view}</button>
            ))}
          </div>
          <p className="eyebrow">{detail.eyebrow}</p>
          <h3>{detail.title}</h3>
          <p>{detail.body}</p>
          <a href="#privacy" className="text-link">See privacy controls <span aria-hidden="true">&rarr;</span></a>
        </div>
        <div className={`recall-window view-${active.toLowerCase()}`} aria-label={`${active} product preview`}>
          <div className="window-top"><span className="traffic"><i /><i /><i /></span><span>Recall / Thursday</span><span className="capture-dot">capture on</span></div>
          {active === "Timeline" && <div className="timeline-preview">
            <div className="timeline-title"><div><b>Today, Oct 02</b><small>23 evidence items &middot; 3 connected sessions</small></div><span>Filter</span></div>
            <div className="timeline-track">{eventRows.map(([time, app, title, kind]) => <article key={time}><time>{time}</time><i className={`event-dot ${kind}`} /><div><span>{app}</span><b>{title}</b></div><em>{kind}</em></article>)}</div>
            <div className="evidence-drawer"><span>10:08 - 10:47</span><b>Retrieval implementation</b><p>VS Code, Terminal and Qdrant docs were connected by time, project and visual context.</p></div>
          </div>}
          {active === "Brief" && <div className="brief-preview"><p>THURSDAY BRIEF</p><h4>You built the evidence retrieval path.</h4><div className="brief-grid"><article><b>Primary thread</b><span>Recall Edge</span></article><article><b>Focus window</b><span>65 min</span></article><article><b>Sources</b><span>23 events</span></article></div><div className="brief-note"><i /> You moved from Qdrant research to implementing and verifying semantic retrieval.</div></div>}
          {active === "Ask" && <div className="ask-preview"><div className="ask-query">What did I do after opening VS Code?</div><article><span>ANSWER, GROUNDED IN 12 EVENTS</span><b>You implemented evidence retrieval, ran tests, then reviewed the issue context in Chrome.</b><p><i /> Editor &middot; 10:08 <i /> Terminal &middot; 10:31 <i /> Browser &middot; 10:47</p></article><button>Open evidence <span>&rarr;</span></button></div>}
        </div>
      </div>
    </section>
  );
}
