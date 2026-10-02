"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { motionTokens, springs } from "../lib/motion-tokens";

const moments = [
  { time: "09:42", app: "Research", title: "Qdrant documentation", kind: "research", source: "Browser tab · qdrant.tech/documentation", detail: "Opened while outlining the local vector retrieval path." },
  { time: "10:08", app: "VS Code", title: "Evidence retrieval path", kind: "build", source: "Window · recall-edge / retrieval.py", detail: "Implemented temporal expansion around a selected memory." },
  { time: "10:31", app: "Terminal", title: "Verified the retrieval test", kind: "verify", source: "Terminal · pytest retrieval", detail: "A matching evidence chain passed for the recorded session." },
  { time: "10:47", app: "Browser", title: "GitHub issue context", kind: "review", source: "Browser tab · github.com / recall-edge", detail: "Reviewed the implementation notes after the test completed." },
] as const;

export function MemoryConsole() {
  const [activeIndex, setActiveIndex] = useState(1);
  const reduce = useReducedMotion();
  const active = moments[activeIndex];

  return <div className="hero-window" aria-label="Interactive Recall timeline preview">
    <div className="hero-window-bar"><div className="brand-mini"><span>r</span> recall</div><b>Thursday, October 02</b><em><i /> capture on</em></div>
    <div className="hero-window-body"><aside><p>MEMORY</p><b>Today</b><span>Sessions</span><span>Search</span><span>Settings</span><small>Local-only</small></aside><div className="hero-timeline"><header><div><span>YOUR DAY</span><h2>From research to retrieval</h2></div><button type="button">Filter <span>&#8964;</span></button></header><div className="time-grid">{moments.map((moment, index) => <button type="button" key={moment.time} className={index === activeIndex ? "is-selected" : ""} aria-pressed={index === activeIndex} onMouseEnter={() => setActiveIndex(index)} onFocus={() => setActiveIndex(index)} onClick={() => setActiveIndex(index)}><time>{moment.time}</time><i className={moment.kind} /><div><span>{moment.app}</span><b>{moment.title}</b></div><em>{moment.kind}</em></button>)}</div><div className="hero-answer"><span>EVENT TRACE</span><AnimatePresence mode="wait"><motion.div key={active.time} initial={reduce ? false : { opacity: 0, y: motionTokens.distance.sm }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -motionTokens.distance.sm }} transition={springs.snappy}><b>{active.source}</b><p>{active.detail} <strong>&rarr;</strong></p></motion.div></AnimatePresence></div></div></div>
  </div>;
}
