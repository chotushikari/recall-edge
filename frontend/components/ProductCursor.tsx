"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState } from "react";

export function ProductCursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springX = useSpring(x, { stiffness: 250, damping: 25, mass: 0.25 });
  const springY = useSpring(y, { stiffness: 250, damping: 25, mass: 0.25 });
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches) return;
    const move = (event: PointerEvent) => { x.set(event.clientX); y.set(event.clientY); };
    const enter = () => setActive(true);
    const leave = () => setActive(false);
    addEventListener("pointermove", move);
    const interactive = document.querySelectorAll("a,button,input,textarea");
    interactive.forEach((element) => { element.addEventListener("pointerenter", enter); element.addEventListener("pointerleave", leave); });
    return () => { removeEventListener("pointermove", move); interactive.forEach((element) => { element.removeEventListener("pointerenter", enter); element.removeEventListener("pointerleave", leave); }); };
  }, [x, y]);

  return <motion.div aria-hidden className={active ? "product-cursor active" : "product-cursor"} style={{ x: springX, y: springY }} animate={{ scale: active ? 1.9 : 1 }}><span>✦</span></motion.div>;
}
