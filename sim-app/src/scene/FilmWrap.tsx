import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { MAST_FACE_X_MM, RAIL_STAND_OFF_MM, Z_TRAVEL_MAX_MM, Z_TRAVEL_MIN_MM } from "@/sim/machine";

const GHOST_STEPS = 512;

export function FilmGhost({
  wraps,
  z0,
  heightMm,
  radiusMm,
  color,
}: {
  wraps: number;
  z0: number;
  heightMm: number;
  radiusMm: number;
  color: string;
}) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((GHOST_STEPS + 1) * 3), 3));
    return g;
  }, []);

  useLayoutEffect(() => {
    const pos = geom.getAttribute("position") as THREE.BufferAttribute;
    const r = Math.max(radiusMm, 200);
    const h = Math.max(heightMm, 1);
    const w = Math.max(wraps, 1);
    for (let i = 0; i <= GHOST_STEPS; i += 1) {
      const t = i / GHOST_STEPS;
      const a = t * w * Math.PI * 2;
      pos.setXYZ(i, Math.cos(a) * r, z0 + t * h, Math.sin(a) * r);
    }
    pos.needsUpdate = true;
    geom.computeBoundingSphere();
  }, [geom, heightMm, radiusMm, wraps, z0]);

  return (
    <line geometry={geom}>
      <lineBasicMaterial color={color} transparent opacity={0.35} />
    </line>
  );
}

export function FilmBand({
  zMm,
  filmMm,
  radiusMm,
  go,
}: {
  zMm: number;
  filmMm: number;
  radiusMm: number;
  go: number;
}) {
  const r = Math.max(radiusMm, 200);
  const h = Math.max(filmMm, 40);
  return (
    <mesh position={[0, zMm, 0]}>
      <cylinderGeometry args={[r + 8, r + 8, h, 48, 1, true]} />
      <meshStandardMaterial
        color={go ? "#38bdf8" : "#f59e0b"}
        transparent
        opacity={go ? 0.16 : 0.28}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

export function EndStops({ esBot, esTop }: { esBot: number; esTop: number }) {
  const x = MAST_FACE_X_MM - RAIL_STAND_OFF_MM - 16;
  return (
    <group>
      <mesh position={[x, Z_TRAVEL_MIN_MM, 0]}>
        <boxGeometry args={[14, 18, 36]} />
        <meshStandardMaterial
          color={esBot ? "#22c55e" : "#334155"}
          emissive={esBot ? "#16a34a" : "#000000"}
          emissiveIntensity={esBot ? 0.8 : 0}
        />
      </mesh>
      <mesh position={[x, Z_TRAVEL_MAX_MM, 0]}>
        <boxGeometry args={[14, 18, 36]} />
        <meshStandardMaterial
          color={esTop ? "#22c55e" : "#334155"}
          emissive={esTop ? "#16a34a" : "#000000"}
          emissiveIntensity={esTop ? 0.8 : 0}
        />
      </mesh>
    </group>
  );
}
