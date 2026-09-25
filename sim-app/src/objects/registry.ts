import { createCartonStack } from "@/objects/cartonStack";
import { createDrumPallet } from "@/objects/drumPallet";
import { createMixedOverhang } from "@/objects/mixedOverhang";
import type { LoadDefinition } from "@/objects/types";

export type LoadMeta = {
  id: string;
  name: string;
  description: string;
  factory: () => LoadDefinition;
};

export const LOAD_CATALOG: LoadMeta[] = [
  {
    id: "carton-stack",
    name: "Carton stack",
    description: "1200×800 pallet, 1120×720×1250 carton",
    factory: createCartonStack,
  },
  {
    id: "drum-pallet",
    name: "Drum pallet",
    description: "4× Ø580×890 drums on 1200×800",
    factory: createDrumPallet,
  },
  {
    id: "mixed-overhang",
    name: "Mixed overhang",
    description: "Offset tower + box past pallet edge",
    factory: createMixedOverhang,
  },
];

export const DEFAULT_LOAD_ID = "carton-stack";

export function createLoad(id: string): LoadDefinition {
  const meta = LOAD_CATALOG.find((m) => m.id === id) ?? LOAD_CATALOG[0];
  return meta.factory();
}
