import type { SampleTree } from "@/storage/tree";

export type Library = {
  /** Program opened when the address has no file. */
  home: string;
  tree: SampleTree;
  read(file: string): Promise<string>;
  /** Save a dropped program and return its library path. Web preset only. */
  importFile?(name: string, text: string): Promise<string>;
  reload(): Promise<SampleTree>;
};
