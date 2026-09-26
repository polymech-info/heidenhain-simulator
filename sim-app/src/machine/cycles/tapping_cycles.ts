import type { Machine } from "@/machine/machine";
import { registerCycle, type ActiveCycle } from "@/machine/cycles/registry";
import { qAbs, qMissing, qNum, runPeck, type Peck } from "@/machine/cycles/motion";

/**
 * Tapping cycles from the iTNC 530 cycle manual, chapter 4.
 * The path is the tap's Z motion. Spindle reversal is not shown.
 * 206 uses the programmed feed. 207 and 209 feed at pitch times spindle speed.
 * 209 retracts faster by Q403. Dwells are not timed. The spindle stops after 207 and 209.
 */

function shot(machine: Machine, cycle: ActiveCycle, feed: number, retractFeed: number, extra?: Partial<Peck>) {
  if (qMissing(machine, cycle, [200, 201, 203])) return;
  const surface = qNum(machine, cycle, 203) ?? 0;
  const depth = qNum(machine, cycle, 201) ?? 0;
  const setupClear = Math.abs(qNum(machine, cycle, 200) ?? 0);
  const secondClear = qAbs(machine, cycle, 204) ?? setupClear;
  runPeck(machine, {
    id: cycle.id,
    surface,
    depth,
    setupClear,
    secondClear,
    feed,
    peck: Math.abs(depth),
    minPeck: 0,
    decrement: 0,
    breaks: 0,
    chip: 0,
    chipRapid: false,
    chipFeed: retractFeed,
    chipEvery: 0,
    retractRapid: false,
    retractFeed,
    reentryRapid: false,
    reentry: () => 0,
    deepened: 0,
    preRapid: false,
    preFeed: feed,
    ...extra,
  });
}

function rigidFeed(machine: Machine, cycle: ActiveCycle): number | null {
  const pitch = qNum(machine, cycle, 239);
  if (pitch == null) {
    machine.note(`Cycle ${cycle.id} is missing Q239`);
    return null;
  }
  if (pitch === 0) {
    machine.note(`Cycle ${cycle.id} pitch is zero`);
    return null;
  }
  if (machine.spindle == null || machine.spindle <= 0) {
    machine.note(`Cycle ${cycle.id} needs a spindle speed`);
    return null;
  }
  return Math.abs(pitch) * machine.spindle;
}

function expand206(machine: Machine, cycle: ActiveCycle) {
  if (qMissing(machine, cycle, [206])) return;
  const feed = qNum(machine, cycle, 206) ?? 0;
  shot(machine, cycle, feed, feed);
}

function expand207(machine: Machine, cycle: ActiveCycle) {
  const feed = rigidFeed(machine, cycle);
  if (feed == null) return;
  shot(machine, cycle, feed, feed);
  machine.spindleOn = false;
}

function expand209(machine: Machine, cycle: ActiveCycle) {
  const feed = rigidFeed(machine, cycle);
  if (feed == null) return;
  const pitch = Math.abs(qNum(machine, cycle, 239) ?? 0);
  const infeed = qAbs(machine, cycle, 257) ?? 0;
  const chipMul = qAbs(machine, cycle, 256) ?? 0;
  const factorRaw = qNum(machine, cycle, 403);
  const factor = factorRaw == null || factorRaw <= 0 ? 1 : factorRaw;
  const fast = feed * factor;
  const depth = Math.abs(qNum(machine, cycle, 201) ?? 0);
  shot(machine, cycle, feed, fast, {
    peck: infeed > 1e-9 ? infeed : depth,
    breaks: chipMul > 0 && infeed > 1e-9 ? 1e9 : 0,
    chip: pitch * chipMul,
  });
  machine.spindleOn = false;
}

registerCycle({ id: "206", kind: "call", run: expand206 });
registerCycle({ id: "207", kind: "call", run: expand207 });
registerCycle({ id: "209", kind: "call", run: expand209 });
