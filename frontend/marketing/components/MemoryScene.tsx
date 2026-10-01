"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import { useRef } from "react";
import type { Group } from "three";
function OrbitingMemory() {
  const group = useRef<Group>(null);
  useFrame((state) => { if (!group.current) return; group.current.rotation.x = state.pointer.y * .18; group.current.rotation.y += .003 + state.pointer.x * .002; });
  return <group ref={group}>
    <Float speed={1.7} rotationIntensity={1.3} floatIntensity={1.1}><mesh><icosahedronGeometry args={[1.25, 2]} /><meshStandardMaterial color="#8072e8" roughness={.18} metalness={.45} /></mesh></Float>
    {[0, 1, 2, 3, 4, 5].map((index) => { const angle = index / 6 * Math.PI * 2; return <Float key={index} speed={1 + index * .14} floatIntensity={.65}><mesh position={[Math.cos(angle) * 2.35, Math.sin(angle * 1.7) * .8, Math.sin(angle) * 1.2]} rotation={[.2 * index, angle, 0]}><boxGeometry args={[.82, .54, .07]} /><meshStandardMaterial color={index % 2 ? "#ff9877" : "#c6d1ff"} roughness={.25} metalness={.38} /></mesh></Float>; })}
  </group>;
}
export function MemoryScene() {
  return <div className="pointer-events-none absolute inset-0 -z-10 opacity-75"><Canvas camera={{ position: [0, 0, 6], fov: 46 }} dpr={[1, 1.5]}><ambientLight intensity={1.3} /><directionalLight position={[3, 4, 4]} intensity={2.4} color="#ffd3c5" /><pointLight position={[-3, -2, 3]} intensity={8} color="#8490ff" /><OrbitingMemory /><Sparkles count={80} scale={6} size={1.9} speed={.22} color="#fff0df" /></Canvas></div>;
}
