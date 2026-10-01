"use client";
import { useEffect, useRef } from "react";
export function CustomCursor() {
  const dot = useRef<HTMLDivElement>(null); const halo = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches) return;
    let target = { x: innerWidth / 2, y: innerHeight / 2 }; let current = { ...target };
    const onMove = (event: PointerEvent) => { target = { x: event.clientX, y: event.clientY }; if (dot.current) dot.current.style.transform = `translate3d(${target.x}px,${target.y}px,0)`; };
    const onHover = () => document.documentElement.classList.add("cursor-hover"); const onLeave = () => document.documentElement.classList.remove("cursor-hover");
    const tick = () => { current.x += (target.x - current.x) * .17; current.y += (target.y - current.y) * .17; if (halo.current) halo.current.style.transform = `translate3d(${current.x}px,${current.y}px,0)`; requestAnimationFrame(tick); };
    addEventListener("pointermove", onMove); document.querySelectorAll("a,button").forEach((node) => { node.addEventListener("pointerenter", onHover); node.addEventListener("pointerleave", onLeave); });
    const frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); removeEventListener("pointermove", onMove); document.querySelectorAll("a,button").forEach((node) => { node.removeEventListener("pointerenter", onHover); node.removeEventListener("pointerleave", onLeave); }); };
  }, []);
  return <><div ref={halo} className="cursor-halo" /><div ref={dot} className="cursor-dot">✦</div></>;
}
