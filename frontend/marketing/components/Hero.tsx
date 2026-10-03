"use client";

import { MotionButton } from "./MotionReveal";
import { MemoryConsole } from "./MemoryConsole";

export function Hero() {
  return <section id="top" className="hero-shell">
    <div className="hero-noise" aria-hidden="true" />
    <div className="hero-grid">
      <div className="hero-head">
        <p className="hero-kicker"><i /> WINDOWS 10 / 11 · LOCAL-FIRST PREVIEW</p>
        <h1>Your computer,<br />with a <em>memory.</em></h1>
        <p className="hero-copy">Recall turns the activity you explicitly allow into a private, evidence-linked timeline—so you can find the tab, file, conversation, or task without rebuilding the day from memory.</p>
        <div className="hero-actions"><MotionButton className="pill-primary" href="#product">See the demo <span>&rarr;</span></MotionButton><MotionButton className="hero-source" href="#download">Download preview <span>&darr;</span></MotionButton></div>
        <p className="hero-note">No account. No always-on cloud. Capture stays under your control.</p>
      </div>
      <MemoryConsole />
    </div>
  </section>;
}
