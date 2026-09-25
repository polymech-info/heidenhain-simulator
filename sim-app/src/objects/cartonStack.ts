import * as THREE from "three";
import { TURNTABLE_HEIGHT_MM } from "@/sim/machine";
import { addBox, addPallet, loadBottomY, measureTruth } from "@/objects/generate";
import type { LoadDefinition } from "@/objects/types";

/** Euro pallet + single carton stack — SCAD default load (1120 × 720 × 1250). */
export function createCartonStack(): LoadDefinition {
  const group = new THREE.Group();
  group.name = "carton-stack";
  addPallet(group);
  addBox(group, 0, loadBottomY(), 0, 1120, 1250, 720, "#c4a36a");
  return {
    id: "carton-stack",
    name: "Carton stack",
    description: "1200×800 pallet, 1120×720×1250 carton",
    create: () => group,
    truth: measureTruth(group, TURNTABLE_HEIGHT_MM),
  };
}
