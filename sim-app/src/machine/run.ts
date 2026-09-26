import type { KlartextProgram } from "@/lang/types";
import { blockLabel } from "@/lang/types";
import { buildTrace, collectToolNotes, Machine, type Trace } from "@/machine/machine";
import { lookupOpcode } from "@/machine/registry";

import "@/machine/handlers";
import "@/machine/specs/register";

export function runProgram(program: KlartextProgram): Trace {
  const scale = program.unit === "INCH" ? 25.4 : 1;
  const machine = new Machine(scale);
  const tools = collectToolNotes(program.blocks, scale);
  for (const [tool, diameter] of tools.diameters) machine.toolDiameters.set(tool, diameter);
  for (const [tool, z] of tools.zMax) machine.toolZMax.set(tool, z);

  for (const block of program.blocks) {
    machine.blockIndex = block.index;
    machine.status[block.index] = "run";
    const handler = lookupOpcode(block);
    if (!handler) machine.gap(blockLabel(block));
    else handler(machine, block);
    machine.finish();
    if (machine.stop) break;
  }

  return buildTrace(program.name, program.unit, program.blocks, machine);
}
