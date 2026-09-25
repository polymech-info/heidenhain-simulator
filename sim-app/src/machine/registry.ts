import type { KlartextBlock } from "@/lang/types";
import type { Machine } from "@/machine/machine";

export type OpcodeHandler = (machine: Machine, block: KlartextBlock) => void;

const opcodes = new Map<string, OpcodeHandler>();

/** Register or replace a handler. Keys are matched case-insensitively. */
export function registerOpcode(head: string, handler: OpcodeHandler) {
  opcodes.set(head.toUpperCase(), handler);
}

/**
 * `CYCL DEF 200` wins over `CYCL DEF`. `FN 0` wins over `FN`.
 * A bare `M5` falls through to `M`.
 */
export function lookupOpcode(block: KlartextBlock): OpcodeHandler | undefined {
  if (block.args.length > 0) {
    const specific = opcodes.get(`${block.head} ${block.args[0]}`.toUpperCase());
    if (specific) return specific;
  }
  const head = opcodes.get(block.head.toUpperCase());
  if (head) return head;
  if (/^M\d+$/.test(block.head)) return opcodes.get("M");
  return undefined;
}
