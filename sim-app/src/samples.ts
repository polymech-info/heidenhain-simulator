import tree from "./generated/sample-index.json";

export type SampleNode = {
  name: string;
  path: string;
  kind: "dir" | "file";
};

export const SAMPLE_TREE = tree as Record<string, SampleNode[]>;

export function sampleUrl(file: string) {
  return new URL(`samples/${file}`, `${window.location.origin}/`).toString();
}

/** True when `file` is a `.h` path in the generated samples index. */
export function isSampleFile(file: string) {
  const slash = file.lastIndexOf("/");
  const parent = slash < 0 ? "" : file.slice(0, slash);
  return (SAMPLE_TREE[parent] ?? []).some((node) => node.kind === "file" && node.path === file);
}

export const DEFAULT_SAMPLE = SAMPLE_TREE[""]?.some((node) => node.path === "common/drill_7_20.h")
  ? "common/drill_7_20.h"
  : (SAMPLE_TREE[""]?.find((node) => node.kind === "file")?.path ?? SAMPLE_TREE.common?.find((node) => node.kind === "file")?.path ?? "");
