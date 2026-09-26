import type { Machine, Vec3 } from "@/machine/machine";
import { cycleParam, type ActiveCycle, type CycleQ } from "@/machine/cycles/registry";

export function qRaw(machine: Machine, cycle: ActiveCycle, q: number): CycleQ | undefined {
  return cycleParam(machine, cycle, q);
}

/** Programmed length in millimetres. `MAX` and a missing word are null. */
export function qNum(machine: Machine, cycle: ActiveCycle, q: number): number | null {
  const value = qRaw(machine, cycle, q);
  if (value == null || value === "MAX") return null;
  return value * machine.scale;
}

export function qAbs(machine: Machine, cycle: ActiveCycle, q: number): number | null {
  const n = qNum(machine, cycle, q);
  return n == null ? null : Math.abs(n);
}

export function qMissing(machine: Machine, cycle: ActiveCycle, qs: number[]): boolean {
  const missing = qs.filter((q) => qNum(machine, cycle, q) == null);
  if (missing.length === 0) return false;
  machine.note(`Cycle ${cycle.id} is missing ${missing.map((q) => `Q${q}`).join(" ")}`);
  return true;
}

export function toolRadius(machine: Machine): number | null {
  if (machine.tool == null) return null;
  const diameter = machine.toolDiameters.get(machine.tool);
  if (diameter == null || diameter <= 0) return null;
  return diameter / 2;
}

/** Q208: `MAX` is rapid, `0` or a missing word uses `fallback`, anything else is that feed. */
export function retractFeed(machine: Machine, cycle: ActiveCycle, fallback: number): { rapid: boolean; feed: number } {
  const value = qRaw(machine, cycle, 208);
  if (value === "MAX") return { rapid: true, feed: fallback };
  if (value == null || value === 0) return { rapid: false, feed: fallback };
  return { rapid: false, feed: value * machine.scale };
}

/** A positioning feed. `MAX` is rapid. `0` or missing uses `fallback` as a feed. */
export function positionFeed(machine: Machine, cycle: ActiveCycle, q: number, fallback: number): { rapid: boolean; feed: number } {
  const value = qRaw(machine, cycle, q);
  if (value === "MAX") return { rapid: true, feed: fallback };
  if (value == null || value === 0) return { rapid: false, feed: fallback };
  return { rapid: false, feed: value * machine.scale };
}

export function goZ(machine: Machine, z: number, rapid: boolean, feed: number) {
  machine.feed = feed;
  machine.z = z;
  machine.moveTo(rapid);
}

/** Keep a retract on the clearance side of the set-up plane. `dir` is the sign of the depth. */
export function clearOf(z: number, setup: number, dir: number): number {
  if (dir < 0 && z > setup) return setup;
  if (dir > 0 && z < setup) return setup;
  return z;
}

/** Q214: 1 −X, 2 −Y, 3 +X, 4 +Y. `0` is no shift. */
export function disengage(q214: number): { x: number; y: number } | null {
  switch (Math.round(q214)) {
    case 1:
      return { x: -1, y: 0 };
    case 2:
      return { x: 0, y: -1 };
    case 3:
      return { x: 1, y: 0 };
    case 4:
      return { x: 0, y: 1 };
    default:
      return null;
  }
}

export function follow(machine: Machine, pts: Vec3[], rapid: boolean) {
  for (const p of pts) {
    machine.x = p.x;
    machine.y = p.y;
    machine.z = p.z;
    machine.moveTo(rapid);
  }
}

/** Helix about Z. `a0` and `sweep` are radians, positive CCW from +X. */
export function helix(
  machine: Machine,
  cx: number,
  cy: number,
  radius: number,
  a0: number,
  sweep: number,
  z0: number,
  z1: number,
) {
  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / ((5 * Math.PI) / 180)));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + sweep * t;
    machine.x = cx + radius * Math.cos(a);
    machine.y = cy + radius * Math.sin(a);
    machine.z = z0 + (z1 - z0) * t;
    machine.moveTo(false);
  }
}

export type Peck = {
  id: string;
  surface: number;
  /** Signed hole depth. Zero does not run. */
  depth: number;
  setupClear: number;
  secondClear: number;
  feed: number;
  peck: number;
  minPeck: number;
  decrement: number;
  /** Chip breaks before a full retract. Ignored when `chipEvery` is set. */
  breaks: number;
  /** Pull back this far for a chip break. */
  chip: number;
  chipRapid: boolean;
  chipFeed: number;
  /** If positive, break chips every this far inside one peck, then full-retract at the end of the peck. */
  chipEvery: number;
  retractRapid: boolean;
  retractFeed: number;
  reentryRapid: boolean;
  /** Clearance above the current depth when returning after a full retract. */
  reentry: (travelled: number, total: number) => number;
  /** Distance from the surface to where drilling actually starts. */
  deepened: number;
  preRapid: boolean;
  preFeed: number;
  /** Called at the hole bottom, before the final retract. */
  atBottom?: (machine: Machine) => void;
};

/**
 * Peck from the set-up clearance to `depth`.
 * Each peck feeds in, then either pulls back for a chip break or retracts to the set-up clearance
 * and returns to the re-entry clearance above the hole. The last move leaves the tool at the
 * set-up clearance, then at the 2nd set-up clearance when that is higher.
 */
export function runPeck(machine: Machine, p: Peck) {
  if (p.depth === 0) {
    machine.note(`Cycle ${p.id} depth is zero`);
    return;
  }
  if (p.peck < 1e-9) {
    machine.note(`Cycle ${p.id} plunging depth is zero`);
    return;
  }

  const dir = Math.sign(p.depth);
  const bottom = p.surface + p.depth;
  const setup = p.surface - dir * p.setupClear;
  const second = p.surface - dir * p.secondClear;
  const total = Math.abs(p.depth);
  let hole = p.surface + dir * Math.min(Math.max(p.deepened, 0), total);
  let peck = p.peck;
  let chipBreaks = 0;
  let guard = 0;

  goZ(machine, setup, true, p.feed);
  if (p.deepened > 1e-9) {
    goZ(machine, clearOf(hole - dir * p.setupClear, setup, dir), p.preRapid, p.preFeed);
  }

  while (Math.abs(bottom - hole) > 1e-6) {
    if (guard++ > 100000) {
      machine.note(`Cycle ${p.id} stopped: too many pecks`);
      break;
    }
    const step = Math.min(peck, Math.abs(bottom - hole));
    if (step < 1e-9) {
      machine.note(`Cycle ${p.id} plunging depth is zero`);
      break;
    }

    let left = step;
    let hitBottom = false;
    while (left > 1e-9) {
      const chunk = p.chipEvery > 1e-9 ? Math.min(p.chipEvery, left) : left;
      left -= chunk;
      hole += dir * chunk;
      goZ(machine, hole, false, p.feed);
      if (Math.abs(bottom - hole) <= 1e-6) {
        hitBottom = true;
        break;
      }
      if (left > 1e-9 && p.chipEvery > 1e-9) {
        goZ(machine, clearOf(hole - dir * p.chip, setup, dir), false, p.chipFeed);
      }
    }
    if (hitBottom) break;

    if (p.chipEvery <= 1e-9 && chipBreaks < p.breaks) {
      goZ(machine, clearOf(hole - dir * p.chip, setup, dir), p.chipRapid, p.chipFeed);
      chipBreaks += 1;
    } else {
      goZ(machine, setup, p.retractRapid, p.retractFeed);
      const clear = p.reentry(Math.abs(hole - p.surface), total);
      goZ(machine, clearOf(hole - dir * clear, setup, dir), p.reentryRapid, p.feed);
      chipBreaks = 0;
    }
    if (p.decrement > 0) peck = Math.max(p.minPeck, peck - p.decrement);
  }

  p.atBottom?.(machine);
  goZ(machine, setup, p.retractRapid, p.retractFeed);
  if (p.secondClear > p.setupClear + 1e-9) goZ(machine, second, true, p.retractFeed);
}
