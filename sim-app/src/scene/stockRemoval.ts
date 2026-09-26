import type { Trace, Vec3 } from "@/machine/machine";

export type HeightGrid = {
  nx: number;
  ny: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  zTop: number;
  zBot: number;
  h: Float32Array;
};

const FALLBACK_DIAMETER_MM = 6;

/** Cells along the long side of the blank. The old mesh was 110, capped at 160. */
export const MESH_PRESETS = {
  coarse: { along: 140, cap: 200 },
  medium: { along: 180, cap: 240 },
  fine: { along: 240, cap: 320 },
} as const;

export type MeshPreset = keyof typeof MESH_PRESETS;

export function toolRadiusMm(trace: Trace, block: number): number {
  const tool = block >= 0 ? trace.snapshots[block]?.tool : null;
  const diameter = tool != null ? trace.toolDiameter[tool] : undefined;
  return (diameter ?? FALLBACK_DIAMETER_MM) / 2;
}

export function makeGrid(stock: { min: Vec3; max: Vec3 }, preset: MeshPreset = "medium"): HeightGrid {
  const x0 = Math.min(stock.min.x, stock.max.x);
  const x1 = Math.max(stock.min.x, stock.max.x);
  const y0 = Math.min(stock.min.y, stock.max.y);
  const y1 = Math.max(stock.min.y, stock.max.y);
  const zBot = Math.min(stock.min.z, stock.max.z);
  const zTop = Math.max(stock.min.z, stock.max.z);
  const sx = Math.max(x1 - x0, 1);
  const sy = Math.max(y1 - y0, 1);
  const { along, cap } = MESH_PRESETS[preset];
  const cell = Math.max(sx, sy) / along;
  const nx = Math.min(cap, Math.max(12, Math.round(sx / cell) + 1));
  const ny = Math.min(cap, Math.max(12, Math.round(sy / cell) + 1));
  const h = new Float32Array(nx * ny);
  h.fill(zTop);
  return { nx, ny, x0, y0, dx: sx / (nx - 1), dy: sy / (ny - 1), zTop, zBot, h };
}

export function resetGrid(grid: HeightGrid) {
  grid.h.fill(grid.zTop);
}

/** Lower the blank under a flat end mill swept from `a` to `b`. Rapids do not cut. */
export function stampSegment(grid: HeightGrid, a: Vec3, b: Vec3, radius: number, rapid: boolean) {
  if (rapid || radius <= 0) return;
  const r2 = radius * radius;
  const i0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - radius - grid.x0) / grid.dx));
  const i1 = Math.min(grid.nx - 1, Math.ceil((Math.max(a.x, b.x) + radius - grid.x0) / grid.dx));
  const j0 = Math.max(0, Math.floor((Math.min(a.y, b.y) - radius - grid.y0) / grid.dy));
  const j1 = Math.min(grid.ny - 1, Math.ceil((Math.max(a.y, b.y) + radius - grid.y0) / grid.dy));
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;

  for (let j = j0; j <= j1; j++) {
    const y = grid.y0 + j * grid.dy;
    for (let i = i0; i <= i1; i++) {
      const x = grid.x0 + i * grid.dx;
      let t = 0;
      if (len2 > 1e-12) t = ((x - a.x) * abx + (y - a.y) * aby) / len2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
      const px = a.x + abx * t;
      const py = a.y + aby * t;
      const ddx = x - px;
      const ddy = y - py;
      if (ddx * ddx + ddy * ddy > r2) continue;
      // A vertical move has no point along its length in XY. The face cuts to the lower end.
      const zCut = len2 <= 1e-12 ? Math.min(a.z, b.z) : a.z + (b.z - a.z) * t;
      const z = Math.max(grid.zBot, zCut);
      const k = j * grid.nx + i;
      if (z < grid.h[k]) grid.h[k] = z;
    }
  }
}
