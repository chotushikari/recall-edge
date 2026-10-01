"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sparkles } from "@react-three/drei";
import { useRef } from "react";
import type { Group } from "three";

function EvidenceOrbit() {
  const group = useRef<Group>(null);
  useFrame((state) => {
    if (!group.current) return;
    group.current.rotation.y += 0.002;
    group.current.rotation.x = state.pointer.y * 0.08;
  });
  return <group ref={group}>
    {[0, 1, 2, 3, 4].map((index) => {
      const angle = index / 5 * Math.PI * 2;
      return <Float key={index} speed={.7 + index * .11} floatIntensity={.5} rotationIntensity={.25}>
        <mesh position={[Math.cos(angle) * 2.5, Math.sin(angle * 2) * .8, Math.sin(angle) * .8]} rotation={[.2, angle, 0]}>
          <boxGeometry args={[.72, .48, .05]} /><meshStandardMaterial color={index % 2 ? "#8f7bff" : "#ff9e7b"} transparent opacity={.62} roughness={.2} metalness={.55} />
        </mesh>
      </Float>;
    })}
  </group>;
}

export function ImmersiveProductScene() {
  return <div className="immersive-product-scene" aria-hidden><Canvas dpr={[1, 1.3]} camera={{ position: [0, 0, 6], fov: 48 }}><ambientLight intensity={1.5} /><pointLight position={[2, 3, 4]} intensity={9} color="#7c72ff" /><pointLight position={[-3, -2, 2]} intensity={5} color="#ff8d6b" /><EvidenceOrbit /><Sparkles count={55} scale={5.4} size={1.3} speed={.14} color="#d5d2ff" /></Canvas></div>;
}
