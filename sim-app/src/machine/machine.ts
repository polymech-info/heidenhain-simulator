import type { KlartextBlock } from "@/lang/types";

export type Vec3 = { x: number; y: number; z: number };

export type PathPoint = Vec3 & {
  block: number;
  rapid: boolean;
};

export type Snapshot = {
  x: number;
  y: number;
  z: number;
  feed: number | null;
  tool: number | null;
  spindle: number | null;
  spindleOn: boolean;
  coolant: boolean;
  cycle: string | null;
};

export type Note = { block: number; text: string };

export type Gap = { head: string; count: number; first: number };

export type BlockStatus = "run" | "gap" | "dead";

export type Trace = {
  programName: string | null;
  unit: "MM" | "INCH" | null;
  blocks: KlartextBlock[];
  points: PathPoint[];
  /** Playback clock. Rapid length is compressed so rapids play faster. */
  clock: number[];
  blockEnd: number[];
  status: BlockStatus[];
  snapshots: Snapshot[];
  notes: Note[];
  gaps: Gap[];
  stock: { min: Vec3; max: Vec3 } | null;
  /** Tool diameter in millimetres, from `; #n D=` comments. */
  toolDiameter: Record<number, number>;
};

const RAPID_DIV = 4;

export class Machine {
  readonly scale: number;
  x = 0;
  y = 0;
  z = 0;
  feed: number | null = null;
  tool: number | null = null;
  spindle: number | null = null;
  spindleOn = false;
  coolant = false;
  /** Call-active cycle. Dotted `CYCL DEF` lines (`32.0`, `32.1`) and def-only cycles do not replace it. */
  cycle: { id: string; name: string; q: Map<number, number | "MAX"> } | null = null;
  /** Preset number from `CYCL DEF 247`. The preset table is not in the program, so axes stay as written. */
  datum: number | null = null;
  /** Millimetres, from `; #n D=` comments. Filled before the program runs. */
  readonly toolDiameters = new Map<number, number>();
  /** Clearance height from `; #n ... ZMAX=`, in millimetres. `M140 MB MAX` retracts here. */
  readonly toolZMax = new Map<number, number>();
  /** Tool axis from `TOOL CALL n Z`. `M140` retracts along it. */
  toolAxis: "X" | "Y" | "Z" | null = null;
  readonly q = new Map<number, number>();
  cc: { x: number; y: number; z: number; plane: "XY" | "YZ" | "XZ" } | null = null;
  plane = "Z";
  stop = false;
  blockIndex = 0;
  readonly points: PathPoint[] = [{ x: 0, y: 0, z: 0, block: -1, rapid: true }];
  readonly blockEnd: number[] = [];
  readonly status: BlockStatus[] = [];
  readonly snapshots: Snapshot[] = [];
  readonly notes: Note[] = [];
  readonly gaps: Gap[] = [];
  stockMin: Vec3 | null = null;
  stockMax: Vec3 | null = null;
  private readonly gapAt = new Map<string, number>();
  private readonly once = new Set<string>();

  constructor(scale: number) {
    this.scale = scale;
  }

  note(text: string) {
    this.notes.push({ block: this.blockIndex, text });
  }

  noteOnce(key: string, text: string) {
    if (this.once.has(key)) return;
    this.once.add(key);
    this.note(text);
  }

  gap(head: string) {
    this.status[this.blockIndex] = "gap";
    const at = this.gapAt.get(head);
    if (at == null) {
      this.gapAt.set(head, this.gaps.length);
      this.gaps.push({ head, count: 1, first: this.blockIndex });
    } else {
      this.gaps[at].count += 1;
    }
  }

  dead() {
    this.status[this.blockIndex] = "dead";
  }

  snapshot(): Snapshot {
    const cycle = this.cycle ? `${this.cycle.id} ${this.cycle.name}`.trim() : null;
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      feed: this.feed,
      tool: this.tool,
      spindle: this.spindle,
      spindleOn: this.spindleOn,
      coolant: this.coolant,
      cycle,
    };
  }

  finish() {
    this.blockEnd[this.blockIndex] = this.points.length - 1;
    this.snapshots[this.blockIndex] = this.snapshot();
  }

  moveTo(rapid: boolean) {
    const prev = this.points[this.points.length - 1];
    const dx = this.x - prev.x;
    const dy = this.y - prev.y;
    const dz = this.z - prev.z;
    if (dx * dx + dy * dy + dz * dz < 1e-8) return;
    this.points.push({ x: this.x, y: this.y, z: this.z, block: this.blockIndex, rapid });
  }

  push(p: Vec3, rapid: boolean) {
    this.x = p.x;
    this.y = p.y;
    this.z = p.z;
    this.points.push({ x: p.x, y: p.y, z: p.z, block: this.blockIndex, rapid });
  }
}

const TOOL_DIAMETER = /#(\d+)\s+D=([0-9.]+)/g;
const TOOL_ZMAX = /#(\d+)\b[^\n]*ZMAX=([+-]?(?:\d+\.?\d*|\.\d+))/g;

/** Diameter and `ZMAX` clearance from `; #n` comments, in millimetres. */
export function collectToolNotes(blocks: { lines: string[] }[], scale: number): {
  diameters: Map<number, number>;
  zMax: Map<number, number>;
} {
  const diameters = new Map<number, number>();
  const zMax = new Map<number, number>();
  for (const block of blocks) {
    for (const line of block.lines) {
      TOOL_DIAMETER.lastIndex = 0;
      TOOL_ZMAX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = TOOL_DIAMETER.exec(line))) diameters.set(Number(match[1]), Number(match[2]) * scale);
      while ((match = TOOL_ZMAX.exec(line))) zMax.set(Number(match[1]), Number(match[2]) * scale);
    }
  }
  return { diameters, zMax };
}

export function buildTrace(programName: string | null, unit: Trace["unit"], blocks: KlartextBlock[], machine: Machine): Trace {
  for (let i = 0; i < blocks.length; i++) {
    if (!machine.status[i]) machine.status[i] = "dead";
    if (!machine.snapshots[i]) machine.snapshots[i] = machine.snapshot();
    if (machine.blockEnd[i] == null) machine.blockEnd[i] = machine.points.length - 1;
  }

  const clock = [0];
  for (let i = 1; i < machine.points.length; i++) {
    const a = machine.points[i - 1];
    const b = machine.points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    clock.push(clock[i - 1] + (b.rapid ? len / RAPID_DIV : len));
  }

  const stock =
    machine.stockMin && machine.stockMax ? { min: { ...machine.stockMin }, max: { ...machine.stockMax } } : null;

  const toolDiameter: Record<number, number> = {};
  for (const [tool, diameter] of machine.toolDiameters) toolDiameter[tool] = diameter;

  return {
    programName,
    unit,
    blocks,
    points: machine.points,
    clock,
    blockEnd: machine.blockEnd,
    status: machine.status,
    snapshots: machine.snapshots,
    notes: machine.notes,
    gaps: machine.gaps,
    stock,
    toolDiameter,
  };
}

export type ArcPlane = "XY" | "YZ" | "XZ";

export type CircleCenter = { x: number; y: number; z: number; plane: ArcPlane };

/** Arc in a principal plane. `sweepDeg` is positive about that plane's positive normal. The end point is exact. Motion along the normal is linear. */
export function sampleArc(from: Vec3, center: CircleCenter, sweepDeg: number, alongTo: number | null): Vec3[] {
  let vx = from.x - center.x;
  let vy = from.y - center.y;
  let vz = from.z - center.z;
  if (center.plane === "XY") vz = 0;
  else if (center.plane === "YZ") vx = 0;
  else vy = 0;
  const radius = Math.hypot(vx, vy, vz);
  if (radius < 1e-6 || Math.abs(sweepDeg) < 1e-6) return [];
  const sweep = (sweepDeg * Math.PI) / 180;
  const steps = Math.min(2000, Math.max(1, Math.ceil(Math.abs(sweepDeg) / 5)));
  const along0 = center.plane === "XY" ? from.z : center.plane === "YZ" ? from.x : from.y;
  const along1 = alongTo ?? along0;
  const out: Vec3[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const c = Math.cos(sweep * t);
    const s = Math.sin(sweep * t);
    const along = along0 + (along1 - along0) * t;
    if (center.plane === "XY") {
      out.push({ x: center.x + vx * c - vy * s, y: center.y + vx * s + vy * c, z: along });
    } else if (center.plane === "YZ") {
      out.push({ x: along, y: center.y + vy * c - vz * s, z: center.z + vy * s + vz * c });
    } else {
      out.push({ x: center.x + vx * c + vz * s, y: along, z: center.z - vx * s + vz * c });
    }
  }
  return out;
}
