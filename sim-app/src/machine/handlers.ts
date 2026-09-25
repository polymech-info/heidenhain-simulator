import type { KlartextBlock, Word } from "@/lang/types";
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
      if (!machine.cycle) machine.note("M99 with no active cycle");
      else machine.note(`Cycle ${machine.cycle.id} ${machine.cycle.name} is not expanded`.replace(/\s+/g, " ").trim());
      break;
    case 140:
      machine.noteOnce("M140", "M140 retract is not simulated");
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

function qWords(words: Word[]) {
  return words.filter((word) => word.addr === "Q");
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
  for (const word of block.words) {
    if (word.addr === "S") machine.spindle = word.n;
  }
});

registerOpcode("L", (machine, block) => {
  const rapid = applyFeed(machine, block);
  applyRadius(machine, block);
  const moved = applyAxes(machine, block);
  if (moved) machine.moveTo(rapid);
  applyM(machine, block);
});

registerOpcode("CC", (machine, block) => {
  let x = machine.cc?.x ?? machine.x;
  let y = machine.cc?.y ?? machine.y;
  for (const word of block.words) {
    if (word.addr === "X") x = word.n * machine.scale;
    else if (word.addr === "Y") y = word.n * machine.scale;
  }
  machine.cc = { x, y };
});

registerOpcode("CP", (machine, block) => {
  const rapid = applyFeed(machine, block);
  applyRadius(machine, block);
  if (machine.plane !== "Z") {
    machine.noteOnce("plane", `Working plane ${machine.plane} arcs are not simulated`);
    applyM(machine, block);
    return;
  }
  if (!machine.cc) {
    machine.note("CP with no circle center");
    applyM(machine, block);
    return;
  }
  let ipa: number | null = null;
  let dr: 1 | -1 | null = null;
  let zTo: number | null = null;
  for (const word of block.words) {
    if (word.addr === "IPA") ipa = word.n;
    else if (word.addr === "DR") dr = word.sign;
    else if (word.addr === "Z") zTo = word.n * machine.scale;
    else if (word.addr === "X" || word.addr === "Y") machine.noteOnce("CPXY", "CP axis endpoints are not simulated");
  }
  if (ipa == null) {
    machine.note("CP with no IPA");
    applyM(machine, block);
    return;
  }
  const sweep = dr == null ? ipa : Math.abs(ipa) * dr;
  const from = { x: machine.x, y: machine.y, z: machine.z };
  const pts = sampleArc(from, machine.cc, sweep, zTo ?? machine.z);
  if (pts.length === 0) machine.note("CP has no radius");
  for (const p of pts) machine.push(p, rapid);
  applyM(machine, block);
});

registerOpcode("CYCL DEF", (machine, block) => {
  const id = block.args[0] ?? "?";
  const name = block.args.slice(1).join(" ");
  machine.cycle = { id, name };
  for (const word of qWords(block.words)) {
    if (word.addr === "Q") machine.q.set(word.q, word.n);
  }
});

registerOpcode("CYCL CALL", (machine) => {
  if (!machine.cycle) machine.note("CYCL CALL with no active cycle");
  else machine.note(`Cycle ${machine.cycle.id} ${machine.cycle.name} is not expanded`.replace(/\s+/g, " ").trim());
});

registerOpcode("FN 0", (machine, block) => {
  const word = block.words.find((item) => item.addr === "Q");
  if (!word || word.addr !== "Q") {
    machine.note("FN 0 assignment was not understood");
    return;
  }
  machine.q.set(word.q, word.n);
});

registerOpcode("M", (machine, block) => {
  const bare = /^M(\d+)$/.exec(block.head);
  if (bare) applyMCode(machine, Number(bare[1]));
  applyM(machine, block);
});
