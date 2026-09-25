import tree from "./generated/sample-index.json";

export type SampleNode = {
  name: string;
  path: string;
  kind: "dir" | "file";
};

export const SAMPLE_TREE = tree as Record<string, SampleNode[]>;

export function sampleUrl(file: string) {
  return new URL(`samples/${file}`, new URL(".", window.location.href)).toString();
}

export const DEFAULT_SAMPLE = SAMPLE_TREE[""]?.some((node) => node.path === "common/drill_7_20.h")
  ? "common/drill_7_20.h"
  : (SAMPLE_TREE[""]?.find((node) => node.kind === "file")?.path ?? SAMPLE_TREE.common?.find((node) => node.kind === "file")?.path ?? "");
