import * as THREE from "three";
import { TURNTABLE_HEIGHT_MM } from "@/sim/machine";
import { addBox, addPallet, loadBottomY, measureTruth } from "@/objects/generate";
import type { LoadDefinition } from "@/objects/types";

/** Irregular stack with an overhang past the pallet — tests polar boundary, not just AABB. */
export function createMixedOverhang(): LoadDefinition {
  const group = new THREE.Group();
  group.name = "mixed-overhang";
  addPallet(group);
  const y = loadBottomY();
  addBox(group, -180, y, -40, 720, 420, 640, "#b08968");
  addBox(group, 220, y, 80, 480, 280, 520, "#d4b896");
  addBox(group, 380, y + 280, 40, 360, 340, 300, "#9a7b4f");
  addBox(group, -80, y + 420, -80, 400, 1600, 400, "#6e8b74");
  addBox(group, 80, y + 80, 520, 540, 220, 280, "#c47c5a");
  return {
    id: "mixed-overhang",
    name: "Mixed overhang",
    description: "Offset tower + box past pallet edge",
    create: () => group,
    truth: measureTruth(group, TURNTABLE_HEIGHT_MM),
  };
}
