import * as THREE from "three";
import { TURNTABLE_HEIGHT_MM } from "@/sim/machine";
import { addCylinder, addPallet, loadBottomY, measureTruth } from "@/objects/generate";
import type { LoadDefinition } from "@/objects/types";

/** Four 200 L drums on a euro pallet — circular silhouette, lower than the carton. */
export function createDrumPallet(): LoadDefinition {
  const group = new THREE.Group();
  group.name = "drum-pallet";
  addPallet(group);
  const y = loadBottomY();
  const r = 290;
  const h = 890;
  const xs = [-300, 300];
  const zs = [-200, 200];
  const colors = ["#3f6b8a", "#355a75", "#4a7a96", "#2f5470"];
  let i = 0;
  for (const x of xs) {
    for (const z of zs) {
      addCylinder(group, x, y, z, r, h, colors[i]);
      i += 1;
    }
  }
  return {
    id: "drum-pallet",
    name: "Drum pallet",
    description: "4× Ø580×890 drums on 1200×800",
    create: () => group,
    truth: measureTruth(group, TURNTABLE_HEIGHT_MM),
  };
}
