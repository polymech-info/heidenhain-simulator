export type SampleNode = {
  name: string;
  path: string;
  kind: "dir" | "file";
};

export type SampleTree = Record<string, SampleNode[]>;

export function hasFile(tree: SampleTree, file: string) {
  const slash = file.lastIndexOf("/");
  const parent = slash < 0 ? "" : file.slice(0, slash);
  return (tree[parent] ?? []).some((node) => node.kind === "file" && node.path === file);
}

/** Prefer the seeded drill program, then the first program path. */
export function defaultSample(tree: SampleTree, preferred = "common/drill_7_20.h") {
  if (hasFile(tree, preferred)) return preferred;
  const files = Object.values(tree).flatMap((nodes) => nodes.filter((node) => node.kind === "file").map((node) => node.path));
  files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
  return files[0] ?? "";
}

export function importPath(name: string) {
  const base = name.split(/[/\\]/).pop()?.trim() || "program.h";
  const cleaned = base.replace(/[^\p{L}\p{N}.\-+() _]+/gu, "_").replace(/^\.+/g, "");
  const file = cleaned.toLowerCase().endsWith(".h") ? cleaned : `${cleaned || "program"}.h`;
  return `imports/${file}`;
}

export function treeFromPaths(paths: string[]): SampleTree {
  const groups = new Map<string, SampleNode[]>();
  const ensure = (dir: string) => {
    let nodes = groups.get(dir);
    if (!nodes) {
      nodes = [];
      groups.set(dir, nodes);
    }
    return nodes;
  };
  ensure("");
  const dirs = new Set<string>();
  for (const file of paths) {
    const parts = file.split("/").filter((part) => part && part !== "." && part !== "..");
    const name = parts.pop();
    if (!name || !name.toLowerCase().endsWith(".h")) continue;
    let parent = "";
    for (const part of parts) {
      const path = parent ? `${parent}/${part}` : part;
      if (!dirs.has(path)) {
        dirs.add(path);
        ensure(parent).push({ name: part, path, kind: "dir" });
        ensure(path);
      }
      parent = path;
    }
    ensure(parent).push({ name, path: parts.length ? `${parent}/${name}` : name, kind: "file" });
  }
  const tree: SampleTree = {};
  for (const [dir, nodes] of groups) {
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
    tree[dir] = nodes;
  }
  return tree;
}
