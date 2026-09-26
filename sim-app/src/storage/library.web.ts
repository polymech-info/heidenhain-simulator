import { SEEDS } from "@/generated/web-seeds";
import { listTree, openOpfsRoot, readFile, seedMissing, writeFile } from "@/storage/opfs";
import { defaultSample, importPath, treeFromPaths, type SampleTree } from "@/storage/tree";
import type { Library } from "@/storage/types";

export type { Library };

let pending: Promise<Library> | null = null;

function memoryLibrary(files: Record<string, string>): Library {
  const store = new Map(Object.entries(files));
  const snapshot = () => treeFromPaths([...store.keys()]);
  const tree = snapshot();
  return {
    home: defaultSample(tree),
    tree,
    async read(file) {
      const text = store.get(file);
      if (text == null) throw new Error(`Could not load ${file}`);
      return text;
    },
    async importFile(name, text) {
      const path = importPath(name);
      store.set(path, text);
      return path;
    },
    async reload() {
      return snapshot();
    },
  };
}

function opfsLibrary(dir: FileSystemDirectoryHandle, tree: SampleTree): Library {
  return {
    home: defaultSample(tree),
    tree,
    read: (file) => readFile(dir, file),
    async importFile(name, text) {
      const path = importPath(name);
      await writeFile(dir, path, text);
      return path;
    },
    reload: () => listTree(dir),
  };
}

async function openOnce(): Promise<Library> {
  try {
    const dir = await openOpfsRoot();
    await seedMissing(dir, SEEDS);
    return opfsLibrary(dir, await listTree(dir));
  } catch {
    return memoryLibrary(SEEDS);
  }
}

/** OPFS library. Missing seed programs are written once; later visits keep local edits. */
export function openLibrary() {
  if (!pending) pending = openOnce();
  return pending;
}
