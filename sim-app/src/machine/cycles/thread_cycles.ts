import { sampleArc, type Machine } from "@/machine/machine";
import { registerCycle, type ActiveCycle } from "@/machine/cycles/registry";
import {
  clearOf,
  follow,
  goZ,
  helix,
  positionFeed,
  qAbs,
  qMissing,
  qNum,
  runPeck,
  toolRadius,
} from "@/machine/cycles/motion";

/**
 * Thread milling cycles from the iTNC 530 cycle manual, chapter 4.
 * 262 mills a thread in a pilot hole. 263 adds a countersink. 264 peck-drills, then mills.
 * 265 mills one continuous helix into solid material. 267 mills an outside thread.
 * A right-hand climb cut on an inside thread runs from the bottom upward. 265 always runs toward the depth.
 * Dwells are not timed.
 */

type Job = {
  id: string;
  surface: number;
  depth: number;
  pitch: number;
  nominal: number;
  toolR: number;
  /** 0 = one revolution over the depth, 1 = a continuous helix, >1 = that many revolutions per pass. */
  perStep: number;
  climb: boolean;
  upward: boolean;
  internal: boolean;
  feedPos: number;
  posRapid: boolean;
  feedMill: number;
  setupClear: number;
  secondClear: number;
};

function approachInternal(machine: Machine, cx: number, cy: number, radius: number, z0: number, sign: number): number {
  const lead = sampleArc(
    { x: cx, y: cy, z: machine.z },
    { x: cx + (sign * radius) / 2, y: cy, z: machine.z, plane: "XY" },
    sign * 180,
    z0,
  );
  follow(machine, lead, false);
  return sign > 0 ? 0 : Math.PI;
}

function leaveInternal(machine: Machine, cx: number, cy: number, sign: number) {
  const back = sampleArc(
    { x: machine.x, y: machine.y, z: machine.z },
    { x: (machine.x + cx) / 2, y: (machine.y + cy) / 2, z: machine.z, plane: "XY" },
    sign * 180,
    machine.z,
  );
  follow(machine, back, false);
  machine.x = cx;
  machine.y = cy;
  machine.moveTo(false);
}

function cutThread(machine: Machine, job: Job) {
  if (job.depth === 0) return;
  if (job.pitch === 0) {
    machine.note(`Cycle ${job.id} pitch is zero`);
    return;
  }
  const sign = job.internal ? (job.climb ? 1 : -1) : job.climb ? -1 : 1;
  const radius = job.internal ? job.nominal / 2 - job.toolR : job.nominal / 2 + job.toolR;
  if (radius < 0.05) {
    machine.note(`Cycle ${job.id} tool does not fit the thread`);
    return;
  }

  const dir = Math.sign(job.depth);
  const setup = job.surface - dir * job.setupClear;
  const second = job.surface - dir * job.secondClear;
  const bottom = job.surface + job.depth;
  const zStart = job.upward ? bottom : job.surface;
  const zEnd = job.upward ? job.surface : bottom;
  const length = Math.abs(job.depth);
  const pitch = Math.abs(job.pitch);
  const pass = job.perStep > 1 ? job.perStep * pitch : length;
  const cx = machine.x;
  const cy = machine.y;

  machine.feed = job.feedPos;
  goZ(machine, setup, true, job.feedPos);

  let placed = false;
  let angle = 0;
  let done = 0;
  let guard = 0;
  while (done < length - 1e-6) {
    if (guard++ > 100000) {
      machine.note(`Cycle ${job.id} stopped: too many thread passes`);
      break;
    }
    const slice = Math.min(pass, length - done);
    const z0 = zStart + (zEnd - zStart) * (done / length);
    const z1 = zStart + (zEnd - zStart) * ((done + slice) / length);
    const milling = Math.sign(z1 - z0) || Math.sign(zEnd - zStart) || -dir;
    const zLead = clearOf(z0 - milling * pitch * 0.5, setup, dir);

    if (job.internal) {
      goZ(machine, zLead, job.posRapid, job.feedPos);
      angle = approachInternal(machine, cx, cy, radius, z0, sign);
    } else {
      if (!placed) {
        machine.x = cx + radius;
        machine.y = cy;
        machine.moveTo(false);
        placed = true;
        angle = 0;
      }
      goZ(machine, zLead, job.posRapid, job.feedPos);
      goZ(machine, z0, false, job.feedPos);
    }

    const turns = job.perStep === 0 ? 1 : slice / pitch;
    machine.feed = job.feedMill;
    const sweep = sign * turns * Math.PI * 2;
    helix(machine, cx, cy, radius, angle, sweep, z0, z1);
    angle += sweep;
    if (job.internal) leaveInternal(machine, cx, cy, sign);
    done += slice;
  }

  if (!job.internal) {
    goZ(machine, setup, true, job.feedPos);
    machine.x = cx;
    machine.y = cy;
    machine.moveTo(true);
  } else {
    goZ(machine, setup, true, job.feedPos);
  }
  if (job.secondClear > job.setupClear + 1e-9) goZ(machine, second, true, job.feedPos);
}

function ring(machine: Machine, cx: number, cy: number, radius: number, z: number, sign: number, feed: number) {
  if (radius < 0.05) return;
  machine.feed = feed;
  goZ(machine, z, false, feed);
  const angle = approachInternal(machine, cx, cy, radius, z, sign);
  helix(machine, cx, cy, radius, angle, sign * Math.PI * 2, z, z);
  leaveInternal(machine, cx, cy, sign);
}

type Common = {
  surface: number;
  pitch: number;
  nominal: number;
  toolR: number;
  setupClear: number;
  secondClear: number;
  feedPos: number;
  posRapid: boolean;
  feedMill: number;
  climb: boolean;
  perStep: number;
};

function common(machine: Machine, cycle: ActiveCycle): Common | null {
  if (qMissing(machine, cycle, [200, 203, 239, 335])) return null;
  const toolR = toolRadius(machine);
  if (toolR == null) {
    machine.noteOnce(`${cycle.id}-dia`, `Cycle ${cycle.id} needs the tool diameter`);
    return null;
  }
  const pitch = qNum(machine, cycle, 239) ?? 0;
  if (pitch === 0) {
    machine.note(`Cycle ${cycle.id} pitch is zero`);
    return null;
  }
  const setupClear = Math.abs(qNum(machine, cycle, 200) ?? 0);
  const pos = positionFeed(machine, cycle, 253, qNum(machine, cycle, 207) ?? 0);
  return {
    surface: qNum(machine, cycle, 203) ?? 0,
    pitch,
    nominal: qAbs(machine, cycle, 335) ?? 0,
    toolR,
    setupClear,
    secondClear: qAbs(machine, cycle, 204) ?? setupClear,
    feedPos: pos.feed,
    posRapid: pos.rapid,
    feedMill: qNum(machine, cycle, 207) ?? pos.feed,
    climb: (qNum(machine, cycle, 351) ?? 1) >= 0,
    perStep: Math.max(0, qNum(machine, cycle, 355) ?? 0),
  };
}

function jobFor(cycle: ActiveCycle, base: Common, depth: number, internal: boolean, upward: boolean): Job {
  return { id: cycle.id, ...base, depth, internal, upward };
}

/** Inside thread: climb and pitch of the same sign run upward. */
function sameHandUp(pitch: number, climb: boolean) {
  return Math.sign(pitch) === (climb ? 1 : -1);
}

function expand262(machine: Machine, cycle: ActiveCycle) {
  const base = common(machine, cycle);
  if (!base) return;
  const depth = qNum(machine, cycle, 201) ?? 0;
  if (depth === 0) {
    machine.note("Cycle 262 depth is zero");
    return;
  }
  cutThread(machine, jobFor(cycle, base, depth, true, sameHandUp(base.pitch, base.climb)));
}

function countersink(machine: Machine, base: Common, depth: number, radius: number, feed: number) {
  if (depth === 0) return;
  if (radius < 0.05) {
    machine.noteOnce("thread-fit", "Thread countersink tool does not fit");
    return;
  }
  const cx = machine.x;
  const cy = machine.y;
  const sign = base.climb ? 1 : -1;
  const dir = Math.sign(depth);
  const setup = base.surface - dir * base.setupClear;
  const z = base.surface + depth;
  goZ(machine, setup, true, base.feedPos);
  goZ(machine, clearOf(z - dir * base.setupClear, setup, dir), false, base.feedPos);
  ring(machine, cx, cy, radius, z, sign, feed);
}

function expand263(machine: Machine, cycle: ActiveCycle) {
  const base = common(machine, cycle);
  if (!base) return;
  const thread = qNum(machine, cycle, 201) ?? 0;
  const sink = qNum(machine, cycle, 356) ?? 0;
  const front = qNum(machine, cycle, 358) ?? 0;
  if (thread === 0 && sink === 0 && front === 0) {
    machine.note("Cycle 263 depth is zero");
    return;
  }
  const feed = qNum(machine, cycle, 254) ?? base.feedMill;
  const pathR = base.nominal / 2 - base.toolR;
  countersink(machine, base, sink, pathR, feed);
  countersink(machine, base, front, qAbs(machine, cycle, 359) ?? 0, feed);
  if (thread !== 0) cutThread(machine, jobFor(cycle, base, thread, true, sameHandUp(base.pitch, base.climb)));
}

function expand264(machine: Machine, cycle: ActiveCycle) {
  const base = common(machine, cycle);
  if (!base) return;
  const thread = qNum(machine, cycle, 201) ?? 0;
  const hole = qNum(machine, cycle, 356) ?? 0;
  const front = qNum(machine, cycle, 358) ?? 0;
  if (thread === 0 && hole === 0 && front === 0) {
    machine.note("Cycle 264 depth is zero");
    return;
  }
  if (hole !== 0) {
    const peck = qAbs(machine, cycle, 202) ?? Math.abs(hole);
    const feed = qNum(machine, cycle, 206) ?? base.feedMill;
    runPeck(machine, {
      id: "264",
      surface: base.surface,
      depth: hole,
      setupClear: base.setupClear,
      secondClear: base.secondClear,
      feed,
      peck,
      minPeck: peck,
      decrement: 0,
      breaks: 0,
      chip: qAbs(machine, cycle, 256) ?? 0,
      chipRapid: false,
      chipFeed: 3000,
      chipEvery: qAbs(machine, cycle, 257) ?? 0,
      retractRapid: true,
      retractFeed: feed,
      reentryRapid: true,
      reentry: () => qAbs(machine, cycle, 258) ?? base.setupClear,
      deepened: 0,
      preRapid: false,
      preFeed: feed,
    });
  }
  countersink(machine, base, front, qAbs(machine, cycle, 359) ?? 0, qNum(machine, cycle, 254) ?? base.feedMill);
  if (thread !== 0) cutThread(machine, jobFor(cycle, base, thread, true, sameHandUp(base.pitch, base.climb)));
}

function expand265(machine: Machine, cycle: ActiveCycle) {
  const base = common(machine, cycle);
  if (!base) return;
  const thread = qNum(machine, cycle, 201) ?? 0;
  const front = qNum(machine, cycle, 358) ?? 0;
  if (thread === 0 && front === 0) {
    machine.note("Cycle 265 depth is zero");
    return;
  }
  const after = Math.round(qNum(machine, cycle, 360) ?? 0) === 1;
  const feed = qNum(machine, cycle, 254) ?? base.feedMill;
  const chamfer = () => countersink(machine, base, front, qAbs(machine, cycle, 359) ?? 0, feed);
  const mill = () => {
    if (thread === 0) return;
    cutThread(machine, jobFor(cycle, { ...base, perStep: 1, climb: base.pitch > 0 }, thread, true, false));
  };
  if (after) {
    mill();
    chamfer();
  } else {
    chamfer();
    mill();
  }
}

function expand267(machine: Machine, cycle: ActiveCycle) {
  const base = common(machine, cycle);
  if (!base) return;
  const thread = qNum(machine, cycle, 201) ?? 0;
  const front = qNum(machine, cycle, 358) ?? 0;
  if (thread === 0 && front === 0) {
    machine.note("Cycle 267 depth is zero");
    return;
  }
  countersink(machine, base, front, qAbs(machine, cycle, 359) ?? 0, qNum(machine, cycle, 254) ?? base.feedMill);
  if (thread !== 0) cutThread(machine, jobFor(cycle, base, thread, false, sameHandUp(base.pitch, base.climb)));
}

registerCycle({ id: "262", kind: "call", run: expand262 });
registerCycle({ id: "263", kind: "call", run: expand263 });
registerCycle({ id: "264", kind: "call", run: expand264 });
registerCycle({ id: "265", kind: "call", run: expand265 });
registerCycle({ id: "267", kind: "call", run: expand267 });
