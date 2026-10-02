"use client";
import { Draggable } from "gsap/Draggable";
import { gsap } from "gsap";
import { useLayoutEffect, useRef } from "react";
import { MemoryScene } from "./MemoryScene";
const fragments = [
  { className: "top-28 left-[7%]", icon: "⌘", title: "your day", body: "keeps its context" },
  { className: "top-40 right-[8%]", icon: "^ ω ^", title: "little memory", body: "drag me" },
  { className: "bottom-32 left-[8%]", icon: "⌂", title: "projects", body: "open the thread" },
  { className: "bottom-24 right-[8%]", icon: "◌", title: "local-first", body: "stays yours" },
];
export function Hero() {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!root.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(Draggable);
    const context = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".float-fragment").forEach((element, index) => {
        gsap.to(element, { y: index % 2 ? -16 : 16, rotation: index % 2 ? 2 : -2, duration: 3.4 + index * .4, ease: "sine.inOut", repeat: -1, yoyo: true });
        Draggable.create(element, { type: "x,y", bounds: root.current });
      });
      gsap.from(".hero-reveal", { y: 28, opacity: 0, stagger: .12, duration: .9, ease: "power3.out" });
    }, root);
    return () => context.revert();
  }, []);
  return <section ref={root} id="top" className="relative isolate flex min-h-[900px] items-center overflow-hidden bg-[#f5f0e9] px-5 pb-16 pt-36 text-center md:px-8">
    <MemoryScene /><div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_50%_43%,rgba(255,255,255,.98),rgba(255,249,241,.35)_29%,transparent_60%)]" />
    {fragments.map((fragment) => <div className={`float-fragment absolute hidden max-w-[154px] cursor-grab select-none rounded-2xl border border-slate-900/10 bg-[#fffdf8]/88 p-3 text-left shadow-[0_18px_35px_rgba(60,43,36,.12)] backdrop-blur md:grid ${fragment.className}`} key={fragment.title}><span className="text-xl">{fragment.icon}</span><b>{fragment.title}</b><small>{fragment.body}</small></div>)}
    <div className="mx-auto max-w-5xl"><p className="hero-reveal mx-auto flex w-fit items-center gap-2 rounded-full border border-slate-900/10 bg-white/70 px-3 py-2 text-[.61rem] font-extrabold tracking-[.15em] text-slate-500"><i className="size-2 rounded-full bg-[#ef7652]" /> A MEMORY LAYER FOR YOUR COMPUTER</p><h1 className="hero-reveal mt-7 font-serif text-[clamp(4.7rem,12vw,10.7rem)] leading-[.75] tracking-[-.105em] text-slate-950">Go from a thought<br />to the <em className="font-serif text-[#ef7652]">thread</em> that matters.</h1><p className="hero-reveal mx-auto mt-9 max-w-xl text-[.98rem] leading-7 text-slate-600">Recall preserves the context you choose — then helps you return to it. Research, tabs, code, and the moments that connect them, all grounded in local evidence.</p><div className="hero-reveal mt-9 flex flex-col justify-center gap-3 sm:flex-row"><a className="pill-primary" href="#download">download for Windows <span>↓</span></a><a className="pill-secondary" href="#trust">see how privacy works <span>↗</span></a></div><p className="hero-reveal mt-6 text-[.62rem] font-bold text-slate-400">Windows preview · local-first · source available</p></div>
    <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap text-[.56rem] font-extrabold tracking-[.14em] text-slate-400"><span>OBSERVE</span><i className="size-1 rounded-full bg-[#ef7652]" /><span>REMEMBER</span><i className="size-1 rounded-full bg-[#ef7652]" /><span>RETRIEVE</span></div>
  </section>;
}
