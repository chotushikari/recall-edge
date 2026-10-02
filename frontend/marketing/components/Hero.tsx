"use client";

import { Draggable } from "gsap/Draggable";
import { gsap } from "gsap";
import { useLayoutEffect, useRef } from "react";
import { MemoryScene } from "./MemoryScene";

const fragments = [
  { className: "fragment-a", mark: "⌘", title: "context", body: "stays connected" },
  { className: "fragment-b", mark: "◌", title: "local-first", body: "kept with you" },
  { className: "fragment-c", mark: "↗", title: "open the source", body: "not a guess" },
];

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    if (!root.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(Draggable);
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".hero-fragment").forEach((element, index) => {
        gsap.to(element, { y: index % 2 ? -12 : 12, rotation: index % 2 ? -1.8 : 1.8, duration: 3.6 + index * 0.35, ease: "sine.inOut", repeat: -1, yoyo: true });
        Draggable.create(element, { type: "x,y", bounds: root.current, inertia: false });
      });
      gsap.from(".hero-reveal", { y: 22, opacity: 0, stagger: 0.11, duration: 0.82, ease: "power3.out" });
    }, root);
    return () => context.revert();
  }, []);

  return <section ref={root} id="top" className="hero-shell">
    <MemoryScene />
    <div className="hero-sun" aria-hidden="true" />
    {fragments.map((fragment) => <div className={`hero-fragment ${fragment.className}`} key={fragment.title}><span>{fragment.mark}</span><b>{fragment.title}</b><small>{fragment.body}</small></div>)}
    <div className="hero-head">
      <p className="hero-reveal eyebrow hero-eyebrow"><i /> A MEMORY LAYER FOR YOUR COMPUTER</p>
      <h1 className="hero-reveal">Your computer can keep the <em>thread.</em></h1>
      <p className="hero-reveal hero-copy">Recall turns the context you choose to keep into an evidence-linked memory of what you did, saw, and worked on.</p>
      <div className="hero-reveal hero-actions"><a className="pill-primary" href="#download">Get the Windows preview <span>&darr;</span></a><a className="pill-secondary" href="#product">Explore the memory layer <span>&rarr;</span></a></div>
      <p className="hero-reveal hero-note">Open source &middot; local-first &middot; evidence-grounded</p>
    </div>
    <div className="hero-window hero-reveal" aria-label="Recall timeline preview">
      <div className="hero-window-bar"><span><i /><i /><i /></span><b>Recall timeline</b><em>today</em></div>
      <div className="hero-window-body"><div className="hero-window-title"><span>Thursday, Oct 02</span><b>From research to retrieval</b></div><div className="hero-events"><p><time>09:42</time><i className="coral" /><span>Chrome</span><b>Qdrant documentation</b></p><p><time>10:08</time><i className="violet" /><span>VS Code</span><b>Evidence retrieval path</b></p><p><time>10:31</time><i className="blue" /><span>Terminal</span><b>Verified with pytest</b></p></div><article><span>ASK RECALL</span><b>What did I do after opening VS Code?</b><small>12 connected events &rarr;</small></article></div>
    </div>
  </section>;
}
