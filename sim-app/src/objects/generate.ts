/**
 * Inline mesh generators for measured loads.
 * Presets in this folder call these; a later CAD model can replace the machine,
 * but loads stay file-backed factories so the palette stays swappable.
 */
import * as THREE from "three";
import { PALLET_HEIGHT_MM, PALLET_LENGTH_MM, PALLET_WIDTH_MM, TURNTABLE_HEIGHT_MM } from "@/sim/machine";
import type { LoadTruth } from "@/objects/types";

export function addPallet(
  parent: THREE.Group,
  length = PALLET_LENGTH_MM,
  width = PALLET_WIDTH_MM,
  height = PALLET_HEIGHT_MM,
  y0 = TURNTABLE_HEIGHT_MM,
): void {
  const slatH = height * 0.18;
  const blockH = height * 0.58;
  const slatW = width / 9;
  const mat = new THREE.MeshStandardMaterial({ color: "#8b5a2b", roughness: 0.85, metalness: 0.05 });

  for (let i = 0; i < 7; i += 1) {
    const z = -width / 2 + i * ((width - slatW) / 6);
    const board = new THREE.Mesh(new THREE.BoxGeometry(length, slatH, slatW), mat);
    board.position.set(0, y0 + blockH + slatH + slatH / 2, z + slatW / 2);
    board.castShadow = true;
    parent.add(board);
  }
  for (const x of [-length / 2 + 80, 0, length / 2 - 160]) {
    for (const z of [-width / 2 + 55, 0, width / 2 - 110]) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(160, blockH, 110), mat);
      block.position.set(x + 80, y0 + slatH + blockH / 2, z + 55);
      block.castShadow = true;
      parent.add(block);
    }
  }
  for (const z of [-width / 2 + 35, -55, width / 2 - 105]) {
    const runner = new THREE.Mesh(new THREE.BoxGeometry(length, slatH, 70), mat);
    runner.position.set(0, y0 + slatH / 2, z + 35);
    runner.castShadow = true;
    parent.add(runner);
  }
}

export function addBox(
  parent: THREE.Group,
  x: number,
  yBottom: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.08 }),
  );
  mesh.position.set(x, yBottom + sy / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function addCylinder(
  parent: THREE.Group,
  x: number,
  yBottom: number,
  z: number,
  radius: number,
  height: number,
  color: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 28),
    new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.25 }),
  );
  mesh.position.set(x, yBottom + height / 2, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Ground-truth from mesh bounds. Radius is max hypot(x,z) of AABB corners. */
export function measureTruth(root: THREE.Object3D, zRefMm: number): LoadTruth {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return { heightMm: 0, radiusMm: 0 };
  const min = box.min;
  const max = box.max;
  let radius = 0;
  for (const x of [min.x, max.x]) {
    for (const z of [min.z, max.z]) {
      const r = Math.hypot(x, z);
      if (r > radius) radius = r;
    }
  }
  const height = Math.max(0, max.y - zRefMm);
  return { heightMm: height, radiusMm: radius };
}

export function loadBottomY(): number {
  return TURNTABLE_HEIGHT_MM + PALLET_HEIGHT_MM + 10;
}
