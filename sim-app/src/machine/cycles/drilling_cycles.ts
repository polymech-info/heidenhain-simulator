import { sampleArc, type Machine } from "@/machine/machine";
import { registerCycle, type ActiveCycle } from "@/machine/cycles/registry";
import {
  disengage,
  follow,
  goZ,
  helix,
  positionFeed,
  qAbs,
  qMissing,
  qNum,
  qRaw,
  retractFeed,
  runPeck,
  toolRadius,
  type Peck,
} from "@/machine/cycles/motion";

/**
 * Drilling cycles from the iTNC 530 cycle manual, chapter 3.
 * Dwells are not timed. Spindle orientation is not shown; boring still steps off the wall.
 *
 * 200 full-retract peck. 201 single ream. 202 bore plus a 0.2 mm disengage.
 * 203 peck, chip break, decrement. 204 back bore. 205 peck with an advanced stop.
 * 208 helical bore mill. 240 center by depth. 241 single plunge from an optional deepened start.
 */

function constantClear(clear: number) {
  return () => clear;
}

function frame(machine: Machine, cycle: ActiveCycle, required: number[]) {
  if (qMissing(machine, cycle, required)) return null;
  const surface = qNum(machine, cycle, 203) ?? 0;
  const depth = qNum(machine, cycle, 201) ?? 0;
  const setupClear = Math.abs(qNum(machine, cycle, 200) ?? 0);
  const secondClear = qAbs(machine, cycle, 204) ?? setupClear;
  const feed = qNum(machine, cycle, 206) ?? 0;
  return { surface, depth, setupClear, secondClear, feed };
}

function single(machine: Machine, cycle: ActiveCycle, retract: { rapid: boolean; feed: number }, extra?: Partial<Peck>) {
  const base = frame(machine, cycle, [200, 201, 203, 206]);
  if (!base) return;
  runPeck(machine, {
    id: cycle.id,
    ...base,
    peck: Math.abs(base.depth),
    minPeck: 0,
    decrement: 0,
    breaks: 0,
    chip: 0,
    chipRapid: false,
    chipFeed: base.feed,
    chipEvery: 0,
    retractRapid: retract.rapid,
    retractFeed: retract.feed,
    reentryRapid: true,
    reentry: constantClear(base.setupClear),
    deepened: 0,
    preRapid: false,
    preFeed: base.feed,
    ...extra,
  });
}

function expand200(machine: Machine, cycle: ActiveCycle) {
  const base = frame(machine, cycle, [200, 201, 202, 203, 206]);
  if (!base) return;
  const peck = qAbs(machine, cycle, 202) ?? 0;
  runPeck(machine, {
    id: "200",
    ...base,
    peck,
    minPeck: peck,
    decrement: 0,
    breaks: 0,
    chip: 0,
    chipRapid: true,
    chipFeed: base.feed,
    chipEvery: 0,
    retractRapid: true,
    retractFeed: base.feed,
    reentryRapid: true,
    reentry: constantClear(base.setupClear),
    deepened: 0,
    preRapid: false,
    preFeed: base.feed,
  });
}

function expand201(machine: Machine, cycle: ActiveCycle) {
  const feed = qNum(machine, cycle, 206) ?? 0;
  single(machine, cycle, retractFeed(machine, cycle, feed));
}

function expand202(machine: Machine, cycle: ActiveCycle) {
  const feed = qNum(machine, cycle, 206) ?? 0;
  const retract = retractFeed(machine, cycle, feed);
  const shift = disengage(qNum(machine, cycle, 214) ?? 0);
  const cx = machine.x;
  const cy = machine.y;
  single(machine, cycle, retract, {
    atBottom: (m) => {
      if (!shift) return;
      m.feed = retract.feed;
      m.x += shift.x * 0.2;
      m.y += shift.y * 0.2;
      m.moveTo(false);
    },
  });
  machine.x = cx;
  machine.y = cy;
  machine.moveTo(true);
}

function expand203(machine: Machine, cycle: ActiveCycle) {
  const base = frame(machine, cycle, [200, 201, 202, 203, 206]);
  if (!base) return;
  const retract = retractFeed(machine, cycle, base.feed);
  const breaksRaw = qRaw(machine, cycle, 213);
  const breaks = breaksRaw == null || breaksRaw === "MAX" ? 0 : Math.max(0, Math.round(breaksRaw));
  runPeck(machine, {
    id: "203",
    ...base,
    peck: qAbs(machine, cycle, 202) ?? 0,
    minPeck: qAbs(machine, cycle, 205) ?? qAbs(machine, cycle, 202) ?? 0,
    decrement: qAbs(machine, cycle, 212) ?? 0,
    breaks,
    chip: qAbs(machine, cycle, 256) ?? 0,
    chipRapid: retract.rapid,
    chipFeed: retract.feed,
    chipEvery: 0,
    retractRapid: retract.rapid,
    retractFeed: retract.feed,
    reentryRapid: true,
    reentry: constantClear(base.setupClear),
    deepened: 0,
    preRapid: false,
    preFeed: base.feed,
  });
}

function expand204(machine: Machine, cycle: ActiveCycle) {
  if (qMissing(machine, cycle, [200, 249, 250, 251, 252, 203, 214])) return;
  const surface = qNum(machine, cycle, 203) ?? 0;
  const depth = qNum(machine, cycle, 249) ?? 0;
  const setupClear = qAbs(machine, cycle, 200) ?? 0;
  const secondClear = qAbs(machine, cycle, 204) ?? setupClear;
  const thickness = qAbs(machine, cycle, 250) ?? 0;
  const off = qAbs(machine, cycle, 251) ?? 0;
  const edge = qAbs(machine, cycle, 252) ?? 0;
  const shift = disengage(qNum(machine, cycle, 214) ?? 0);
  const into = positionFeed(machine, cycle, 253, 0);
  const bore = qNum(machine, cycle, 254) ?? into.feed;
  if (depth === 0) {
    machine.note("Cycle 204 depth is zero");
    return;
  }
  if (!shift) {
    machine.note("Cycle 204 disengaging direction is not 1 to 4");
    return;
  }

  const dir = Math.sign(depth);
  const setup = surface + setupClear;
  const second = surface + secondClear;
  const underside = surface - dir * thickness;
  const tipThrough = underside - dir * setupClear - dir * edge;
  const tipBore = tipThrough + depth + dir * setupClear;
  const cx = machine.x;
  const cy = machine.y;

  goZ(machine, setup, true, into.feed);
  machine.feed = into.feed;
  machine.x = cx + shift.x * off;
  machine.y = cy + shift.y * off;
  machine.moveTo(into.rapid);
  goZ(machine, tipThrough, into.rapid, into.feed);
  machine.x = cx;
  machine.y = cy;
  machine.moveTo(false);
  goZ(machine, tipBore, false, bore);
  machine.x = cx + shift.x * off;
  machine.y = cy + shift.y * off;
  machine.moveTo(false);
  goZ(machine, setup, into.rapid, into.feed);
  if (secondClear > setupClear + 1e-9) goZ(machine, second, true, into.feed);
  machine.x = cx;
  machine.y = cy;
  machine.moveTo(true);
}

function expand205(machine: Machine, cycle: ActiveCycle) {
  const base = frame(machine, cycle, [200, 201, 202, 203, 206]);
  if (!base) return;
  const upper = qAbs(machine, cycle, 258) ?? base.setupClear;
  const lower = qAbs(machine, cycle, 259) ?? upper;
  const pre = positionFeed(machine, cycle, 253, base.feed);
  runPeck(machine, {
    id: "205",
    ...base,
    peck: qAbs(machine, cycle, 202) ?? 0,
    minPeck: qAbs(machine, cycle, 205) ?? qAbs(machine, cycle, 202) ?? 0,
    decrement: qAbs(machine, cycle, 212) ?? 0,
    breaks: 0,
    chip: qAbs(machine, cycle, 256) ?? 0,
    chipRapid: false,
    chipFeed: 3000,
    chipEvery: qAbs(machine, cycle, 257) ?? 0,
    retractRapid: true,
    retractFeed: base.feed,
    reentryRapid: true,
    reentry: (travelled, total) => (total > 1e-9 ? upper + (lower - upper) * (travelled / total) : upper),
    deepened: qAbs(machine, cycle, 379) ?? 0,
    preRapid: pre.rapid,
    preFeed: pre.feed,
  });
}

function expand208(machine: Machine, cycle: ActiveCycle) {
  if (qMissing(machine, cycle, [200, 201, 203, 206, 335])) return;
  const radius = toolRadius(machine);
  if (radius == null) {
    machine.note("Cycle 208 needs the tool diameter");
    return;
  }
  const surface = qNum(machine, cycle, 203) ?? 0;
  const depth = qNum(machine, cycle, 201) ?? 0;
  const setupClear = qAbs(machine, cycle, 200) ?? 0;
  const secondClear = qAbs(machine, cycle, 204) ?? setupClear;
  const feed = qNum(machine, cycle, 206) ?? 0;
  const step = qAbs(machine, cycle, 334) ?? 0;
  const nominal = qAbs(machine, cycle, 335) ?? 0;
  if (depth === 0) {
    machine.note("Cycle 208 depth is zero");
    return;
  }
  if (nominal < radius * 2 - 1e-3) {
    machine.note("Cycle 208 tool is larger than the bore");
    return;
  }
  if (Math.abs(nominal - radius * 2) <= 1e-3) {
    single(machine, cycle, { rapid: true, feed });
    return;
  }
  if (step < 1e-9) {
    machine.note("Cycle 208 plunging depth is zero");
    return;
  }

  const rough = qAbs(machine, cycle, 342) ?? 0;
  const pathR = nominal / 2 - radius;
  if (rough <= 0 && pathR > radius + 1e-6) {
    machine.noteOnce("208-core", "Cycle 208 leaves the bore core; the hole is larger than twice the tool");
  }
  const climb = (qNum(machine, cycle, 351) ?? 1) >= 0;
  const sign = climb ? 1 : -1;
  const dir = Math.sign(depth);
  const setup = surface - dir * setupClear;
  const second = surface - dir * secondClear;
  const bottom = surface + depth;
  const cx = machine.x;
  const cy = machine.y;

  machine.feed = feed;
  goZ(machine, setup, true, feed);
  const lead = sampleArc(
    { x: cx, y: cy, z: setup },
    { x: cx + (sign * pathR) / 2, y: cy, z: setup, plane: "XY" },
    sign * 180,
    setup,
  );
  follow(machine, lead, false);
  const a0 = sign > 0 ? 0 : Math.PI;
  const turns = Math.abs(bottom - setup) / step;
  helix(machine, cx, cy, pathR, a0, sign * turns * Math.PI * 2, setup, bottom);
  const a1 = a0 + sign * turns * Math.PI * 2;
  helix(machine, cx, cy, pathR, a1, sign * Math.PI * 2, bottom, bottom);
  const depart = sampleArc(
    { x: machine.x, y: machine.y, z: machine.z },
    { x: (machine.x + cx) / 2, y: (machine.y + cy) / 2, z: machine.z, plane: "XY" },
    sign * 180,
    bottom,
  );
  follow(machine, depart, false);
  machine.x = cx;
  machine.y = cy;
  machine.moveTo(false);
  goZ(machine, setup, true, feed);
  if (secondClear > setupClear + 1e-9) goZ(machine, second, true, feed);
}

function expand240(machine: Machine, cycle: ActiveCycle) {
  const mode = qNum(machine, cycle, 343) ?? 0;
  if (Math.round(mode) === 1) {
    machine.note("Cycle 240 centering by diameter needs the tool point angle");
    return;
  }
  single(machine, cycle, { rapid: true, feed: qNum(machine, cycle, 206) ?? 0 });
}

function expand241(machine: Machine, cycle: ActiveCycle) {
  const feed = qNum(machine, cycle, 206) ?? 0;
  const pre = positionFeed(machine, cycle, 253, feed);
  single(machine, cycle, retractFeed(machine, cycle, feed), {
    deepened: qAbs(machine, cycle, 379) ?? 0,
    preRapid: pre.rapid,
    preFeed: pre.feed,
  });
}

registerCycle({ id: "200", kind: "call", run: expand200 });
registerCycle({ id: "201", kind: "call", run: expand201 });
registerCycle({ id: "202", kind: "call", run: expand202 });
registerCycle({ id: "203", kind: "call", run: expand203 });
registerCycle({ id: "204", kind: "call", run: expand204 });
registerCycle({ id: "205", kind: "call", run: expand205 });
registerCycle({ id: "208", kind: "call", run: expand208 });
registerCycle({ id: "240", kind: "call", run: expand240 });
registerCycle({ id: "241", kind: "call", run: expand241 });
