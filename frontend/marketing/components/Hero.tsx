"use client";

import { MotionButton } from "./MotionReveal";
import { MemoryConsole } from "./MemoryConsole";

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
      <MemoryConsole />
    </div>
  </section>;
}
