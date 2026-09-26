import type { KlartextBlock } from "@/lang/types";
import type { Machine } from "@/machine/machine";

export type CycleQ = number | "MAX";

export type ActiveCycle = {
  id: string;
  name: string;
  /** Values captured on `CYCL DEF`. Numeric Qs also live in `machine.q`. */
  q: Map<number, CycleQ>;
};

export type CycleKind = "call" | "def";

export type CycleHandler = (machine: Machine, cycle: ActiveCycle) => void;

export type CycleSpec = {
  id: string;
  kind: CycleKind;
  run: CycleHandler;
};

const cycles = new Map<string, CycleSpec>();

/** Register one cycle. A later spec for the same id replaces the earlier one. */
export function registerCycle(spec: CycleSpec) {
  cycles.set(spec.id, spec);
}

export function cycleSpec(id: string): CycleSpec | undefined {
  return cycles.get(id);
}

/** Live Q value when one was assigned, otherwise the value captured on the cycle. */
export function cycleParam(machine: Machine, cycle: ActiveCycle, q: number): CycleQ | undefined {
  if (machine.q.has(q)) return machine.q.get(q);
  return cycle.q.get(q);
}

export function defineCycle(machine: Machine, block: KlartextBlock) {
  const id = block.args[0] ?? "?";
  const name = block.args.slice(1).join(" ");
  const q = new Map<number, CycleQ>();
  for (const word of block.words) {
    if (word.addr !== "Q") continue;
    if ("max" in word) {
      machine.q.delete(word.q);
      q.set(word.q, "MAX");
    } else {
      machine.q.set(word.q, word.n);
      q.set(word.q, word.n);
    }
  }
  // `CYCL DEF 32.0` / `32.1` continue a definition. They are not a new call cycle.
  if (id.includes(".")) return;
  const spec = cycles.get(id);
  if (spec?.kind === "def") {
    spec.run(machine, { id, name, q });
    return;
  }
  machine.cycle = { id, name, q };
}

/** Run the call-active cycle at the current position. `M99` and bare `CYCL CALL` use this. */
export function callCycle(machine: Machine) {
  const cycle = machine.cycle;
  if (!cycle) {
    machine.note("M99 with no active cycle");
    return;
  }
  const spec = cycles.get(cycle.id);
  if (!spec || spec.kind !== "call") {
    machine.note(`Cycle ${cycle.id} ${cycle.name} is not expanded`.replace(/\s+/g, " ").trim());
    return;
  }
  spec.run(machine, cycle);
}
