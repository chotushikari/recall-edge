"use client";

import { motion, useReducedMotion } from "motion/react";
import { motionTokens, springs } from "../lib/motion-tokens";

export function MotionReveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.div
    className={className}
    initial={{ opacity: 1, y: 0 }}
    whileInView={reduce ? { opacity: 1 } : { opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={springs.gentle}
  >{children}</motion.div>;
}

export function MotionButton({ children, className, href }: { children: React.ReactNode; className: string; href: string }) {
  const reduce = useReducedMotion();
  return <motion.a href={href} className={className} whileHover={reduce ? {} : { scale: motionTokens.scale.pop }} whileTap={reduce ? {} : { scale: motionTokens.scale.press }} transition={springs.snappy}>{children}</motion.a>;
}
