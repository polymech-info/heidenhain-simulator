/** Klartext program model. Semantics live in the opcode table, not here. */

export type Unit = "MM" | "INCH";

export type Axis = "X" | "Y" | "Z" | "A" | "B" | "C" | "U" | "V" | "W";

export type Word =
  | { addr: Axis; n: number }
  | { addr: "F"; mode: "max" }
  | { addr: "F"; mode: "mm"; n: number }
  | { addr: "F"; mode: "q"; q: number }
  | { addr: "S"; n: number }
  | { addr: "M"; n: number }
  | { addr: "Q"; q: number; n: number }
  | { addr: "IPA"; n: number }
  | { addr: "DR"; sign: 1 | -1 }
  | { addr: "R"; comp: "0" | "L" | "R" }
  | { addr: "R"; n: number }
  | { addr: "raw"; text: string };

export type KlartextBlock = {
  index: number;
  /** Block number from the file, when the line had one. */
  number: number | null;
  /** Source lines with the block number and continuation tilde removed. */
  lines: string[];
  /** Opcode head: `L`, `CYCL DEF`, `FN`, `M5`, … */
  head: string;
  /** Tokens before the first address word: tool id, cycle number, names. */
  args: string[];
  words: Word[];
};

export type KlartextProgram = {
  name: string | null;
  unit: Unit | null;
  blocks: KlartextBlock[];
};

export function blockLabel(block: KlartextBlock): string {
  if (block.args.length > 0 && (block.head === "FN" || block.head === "CYCL DEF" || block.head === "TCH PROBE")) {
    return `${block.head} ${block.args[0]}`;
  }
  return block.head || "(empty)";
}
