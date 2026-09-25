import { mkdirSync, readdirSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

export function writeSampleIndex() {
  const sampleDir = path.resolve(root, "../samples");
  const tree = {};

  const collect = (abs, rel) => {
    const nodes = [];
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const childAbs = path.join(abs, entry.name);
      if (entry.isDirectory()) {
        if (collect(childAbs, childRel)) nodes.push({ name: entry.name, path: childRel, kind: "dir" });
      } else if (entry.name.toLowerCase().endsWith(".h")) {
        nodes.push({ name: entry.name, path: childRel, kind: "file" });
      }
    }
    nodes.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
    if (nodes.length) tree[rel] = nodes;
    return nodes.some((node) => node.kind === "file") || nodes.some((node) => tree[node.path]);
  };

  collect(sampleDir, "");
  const outDir = path.resolve(root, "src/generated");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(path.join(outDir, "sample-index.json"), JSON.stringify(tree));
  return tree;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeSampleIndex();
}
