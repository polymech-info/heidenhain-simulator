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
  cycle: { id: string; name: string } | null = null;
  readonly q = new Map<number, number>();
  cc: { x: number; y: number } | null = null;
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
  const diaScale = unit === "INCH" ? 25.4 : 1;
  const dia = /#(\d+)\s+D=([0-9.]+)/g;
  for (const block of blocks) {
    for (const line of block.lines) {
      dia.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = dia.exec(line))) toolDiameter[Number(match[1])] = Number(match[2]) * diaScale;
    }
  }

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

/** XY arc about `center`, sweep in degrees. End point is exact. Z moves linearly. */
export function sampleArc(from: Vec3, center: { x: number; y: number }, sweepDeg: number, zTo: number): Vec3[] {
  const r = Math.hypot(from.x - center.x, from.y - center.y);
  if (r < 1e-6 || Math.abs(sweepDeg) < 1e-6) return [];
  const a0 = Math.atan2(from.y - center.y, from.x - center.x);
  const sweep = (sweepDeg * Math.PI) / 180;
  const steps = Math.min(2000, Math.max(1, Math.ceil(Math.abs(sweepDeg) / 5)));
  const out: Vec3[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + sweep * t;
    out.push({
      x: center.x + r * Math.cos(a),
      y: center.y + r * Math.sin(a),
      z: from.z + (zTo - from.z) * t,
    });
  }
  return out;
}
