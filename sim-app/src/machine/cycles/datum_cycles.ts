/**
 * Datum cycles. They take effect on `CYCL DEF` and must not replace the call-active cycle.
 *
 * 247 selects a preset number (`Q339`). These programs do not include the preset table,
 * so the number is recorded and the written coordinates are left unchanged.
 */
import type { Machine } from "@/machine/machine";
import { cycleParam, registerCycle, type ActiveCycle } from "@/machine/cycles/registry";

function define247(machine: Machine, cycle: ActiveCycle) {
  const raw = cycleParam(machine, cycle, 339);
  if (typeof raw !== "number") {
    machine.note("Cycle 247 is missing Q339");
    return;
  }
  machine.datum = raw;
}

registerCycle({ id: "247", kind: "def", run: define247 });
