import type { KlartextBlock } from "@/lang/types";
import { callCycle, defineCycle } from "@/machine/cycles/registry";
import { sampleArc, type Machine } from "@/machine/machine";
import { registerOpcode } from "@/machine/registry";

function applyFeed(machine: Machine, block: KlartextBlock): boolean {
  let rapid = false;
  let seen = false;
  for (const word of block.words) {
    if (word.addr !== "F") continue;
    seen = true;
    if (word.mode === "max") {
      rapid = true;
      continue;
    }
    rapid = false;
    if (word.mode === "mm") {
      machine.feed = word.n * machine.scale;
      continue;
    }
    const q = machine.q.get(word.q);
    if (q == null) machine.noteOnce(`Q${word.q}`, `Q${word.q} is unset; feed ignored`);
    else machine.feed = q * machine.scale;
  }
  return seen && rapid;
}

function applyRadius(machine: Machine, block: KlartextBlock) {
  for (const word of block.words) {
    if (word.addr === "R" && "comp" in word && word.comp !== "0") {
      machine.noteOnce("R", "Radius compensation is not applied");
    }
  }
}

function applyAxes(machine: Machine, block: KlartextBlock): boolean {
  let any = false;
  for (const word of block.words) {
    if (word.addr === "X") {
      machine.x = word.n * machine.scale;
      any = true;
    } else if (word.addr === "Y") {
      machine.y = word.n * machine.scale;
      any = true;
    } else if (word.addr === "Z") {
      machine.z = word.n * machine.scale;
      any = true;
    } else if (word.addr === "A" || word.addr === "B" || word.addr === "C" || word.addr === "U" || word.addr === "V" || word.addr === "W") {
      machine.noteOnce(word.addr, `${word.addr} axis is not simulated`);
    }
  }
  return any;
}

function applyMCode(machine: Machine, code: number) {
  switch (code) {
    case 3:
      machine.spindleOn = true;
      break;
    case 4:
      machine.spindleOn = true;
      machine.noteOnce("M4", "M4 runs the spindle; reverse is not shown");
      break;
    case 5:
      machine.spindleOn = false;
      break;
    case 8:
      machine.coolant = true;
      break;
    case 9:
      machine.coolant = false;
      break;
    case 30:
      machine.stop = true;
      break;
    case 99:
      callCycle(machine);
      break;
    case 140:
      break;
    default:
      machine.noteOnce(`M${code}`, `M${code} is not simulated`);
  }
}

function applyM(machine: Machine, block: KlartextBlock) {
  for (const word of block.words) {
    if (word.addr === "M") applyMCode(machine, word.n);
  }
}

function hasM140(block: KlartextBlock) {
  return block.head === "M140" || block.words.some((word) => word.addr === "M" && word.n === 140);
}

/**
 * Retract in the positive tool axis at the start of the block.
 * `MB+n` is an incremental lift. `MB MAX` goes to the tool's `ZMAX` clearance,
 * or to the top of the blank when the tool comment has no `ZMAX`.
 * With no feed on the block, the lift is rapid.
 */
function applyM140(machine: Machine, block: KlartextBlock, rapid: boolean) {
  const mb = block.words.find((word) => word.addr === "MB");
  if (!mb || mb.addr !== "MB") {
    machine.noteOnce("M140", "M140 without MB does not retract");
    return;
  }
  if (machine.toolAxis == null) {
    machine.noteOnce("M140-axis", "M140 needs a tool axis from TOOL CALL");
    return;
  }
  if (machine.toolAxis !== "Z") {
    machine.noteOnce("M140-axis", `M140 in the ${machine.toolAxis} axis is not simulated`);
    return;
  }
  const fed = block.words.some((word) => word.addr === "F");
  const liftRapid = !fed || rapid;

  if ("max" in mb) {
    let target = machine.tool != null ? machine.toolZMax.get(machine.tool) : undefined;
    if (target == null && machine.stockMin && machine.stockMax) {
      target = Math.max(machine.stockMin.z, machine.stockMax.z);
      machine.noteOnce("M140-blank", "M140 MB MAX retracted to the top of the blank");
    }
    if (target == null) {
      machine.noteOnce("M140-max", "M140 MB MAX has no retract height");
      return;
    }
    if (target <= machine.z + 1e-9) return;
    machine.z = target;
    machine.moveTo(liftRapid);
    return;
  }
  if (mb.n <= 0) {
    machine.noteOnce("M140-pos", "M140 only retracts in the positive tool axis");
    return;
  }
  machine.z += mb.n * machine.scale;
  machine.moveTo(liftRapid);
}

function dead(machine: Machine) {
  machine.dead();
}

registerOpcode(";", dead);
registerOpcode("*", dead);
registerOpcode("BEGIN PGM", dead);
registerOpcode("END PGM", dead);

registerOpcode("BLK FORM", (machine, block) => {
  const corner = block.args[0] ?? "";
  const plane = block.args.find((arg) => arg === "X" || arg === "Y" || arg === "Z");
  if (plane) machine.plane = plane;
  const which = corner.startsWith("0.1") ? "min" : corner.startsWith("0.2") ? "max" : null;
  if (!which) {
    machine.note("BLK FORM corner is not 0.1 or 0.2");
    return;
  }
  const slot = which === "min" ? (machine.stockMin ??= { x: 0, y: 0, z: 0 }) : (machine.stockMax ??= { x: 0, y: 0, z: 0 });
  for (const word of block.words) {
    if (word.addr === "X") slot.x = word.n * machine.scale;
    else if (word.addr === "Y") slot.y = word.n * machine.scale;
    else if (word.addr === "Z") slot.z = word.n * machine.scale;
  }
});

registerOpcode("TOOL CALL", (machine, block) => {
  const tool = Number(block.args[0]);
  if (Number.isFinite(tool)) machine.tool = tool;
  const axis = block.args.find((arg) => arg === "X" || arg === "Y" || arg === "Z");
  if (axis) machine.toolAxis = axis;
  for (const word of block.words) {
    if (word.addr === "S") machine.spindle = word.n;
  }
});

registerOpcode("L", (machine, block) => {
  const rapid = applyFeed(machine, block);
  applyRadius(machine, block);
  if (hasM140(block)) applyM140(machine, block, rapid);
  const moved = applyAxes(machine, block);
  if (moved) machine.moveTo(rapid);
  applyM(machine, block);
});

registerOpcode("CC", (machine, block) => {
  const programmed = { X: false, Y: false, Z: false };
  const next = { x: machine.x, y: machine.y, z: machine.z };
  for (const word of block.words) {
    if (word.addr !== "X" && word.addr !== "Y" && word.addr !== "Z") continue;
    next[word.addr.toLowerCase() as "x" | "y" | "z"] = word.n * machine.scale;
    programmed[word.addr] = true;
  }
  const count = Number(programmed.X) + Number(programmed.Y) + Number(programmed.Z);
  if (count === 0) {
    machine.note("CC with no center");
    return;
  }
  if (count === 1 && machine.cc) {
    machine.cc = {
      x: programmed.X ? next.x : machine.cc.x,
      y: programmed.Y ? next.y : machine.cc.y,
      z: programmed.Z ? next.z : machine.cc.z,
      plane: machine.cc.plane,
    };
    return;
  }
  const plane = programmed.Y && programmed.Z && !programmed.X ? "YZ" : programmed.X && programmed.Z && !programmed.Y ? "XZ" : "XY";
  machine.cc = { x: next.x, y: next.y, z: next.z, plane };
});

registerOpcode("CP", (machine, block) => {
  const rapid = applyFeed(machine, block);
  applyRadius(machine, block);
  if (hasM140(block)) applyM140(machine, block, rapid);
  if (!machine.cc) {
    machine.note("CP with no circle center");
    applyM(machine, block);
    return;
  }
  if (machine.plane !== "Z" && machine.cc.plane === "XY") {
    machine.noteOnce("plane", `Working plane ${machine.plane} arcs are not simulated`);
    applyM(machine, block);
    return;
  }
  let ipa: number | null = null;
  let dr: 1 | -1 | null = null;
  let along: number | null = null;
  const normal = machine.cc.plane === "XY" ? "Z" : machine.cc.plane === "YZ" ? "X" : "Y";
  for (const word of block.words) {
    if (word.addr === "IPA") ipa = word.n;
    else if (word.addr === "DR") dr = word.sign;
    else if (word.addr === normal) along = word.n * machine.scale;
    else if (word.addr === "X" || word.addr === "Y" || word.addr === "Z") machine.noteOnce("CPXY", "CP axis endpoints are not simulated");
  }
  if (ipa == null) {
    machine.note("CP with no IPA");
    applyM(machine, block);
    return;
  }
  const sweep = dr == null ? ipa : Math.abs(ipa) * dr;
  const pts = sampleArc({ x: machine.x, y: machine.y, z: machine.z }, machine.cc, sweep, along);
  if (pts.length === 0) machine.note("CP has no radius");
  for (const p of pts) machine.push(p, rapid);
  applyM(machine, block);
});

registerOpcode("CYCL DEF", (machine, block) => {
  defineCycle(machine, block);
});

registerOpcode("CYCL CALL", (machine, block) => {
  if (block.args.length > 0) {
    machine.note(`CYCL CALL ${block.args.join(" ")} is not expanded`);
    return;
  }
  callCycle(machine);
});

registerOpcode("FN 0", (machine, block) => {
  const word = block.words.find((item) => item.addr === "Q" && "n" in item);
  if (!word || word.addr !== "Q" || !("n" in word)) {
    machine.note("FN 0 assignment was not understood");
    return;
  }
  machine.q.set(word.q, word.n);
});

registerOpcode("M", (machine, block) => {
  if (hasM140(block)) applyM140(machine, block, true);
  const bare = /^M(\d+)$/.exec(block.head);
  if (bare && Number(bare[1]) !== 140) applyMCode(machine, Number(bare[1]));
  applyM(machine, block);
});
