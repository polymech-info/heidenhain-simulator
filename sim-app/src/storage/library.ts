import { DEFAULT_SAMPLE, SAMPLE_TREE, sampleUrl } from "@/samples";
import type { Library } from "@/storage/types";

export type { Library };

let pending: Promise<Library> | null = null;

function serverLibrary(): Library {
  return {
    home: DEFAULT_SAMPLE,
    tree: SAMPLE_TREE,
    async read(file) {
      const res = await fetch(sampleUrl(file), { cache: "no-store" });
      if (!res.ok) throw new Error(`Could not load ${file}`);
      return res.text();
    },
    async reload() {
      return SAMPLE_TREE;
    },
  };
}

/** Programs from the dev server's `/samples` tree. The web preset replaces this module. */
export function openLibrary() {
  if (!pending) pending = Promise.resolve(serverLibrary());
  return pending;
}
