/**
 * scanEstimate — firmware port target (C17 / C++17, ESP32).
 *
 * No DOM, no Three.js, no React, no heap on the sample path.
 * Host-only allocators live at the bottom (`scan_make_*`).
 *
 *   Math.sqrt(x*x+y*y) → sqrtf
 *   Math.atan2         → atan2f
 *   Math.cos / sin     → cosf / sinf
 *   Math.floor         → (int) when v >= 0; else floorf
 *   number             → float
 *   valid / hasHit     → uint8_t
 *
 * See apps/3d-wrapper/readme.md for the C17 surface and firmware loop.
 */

export const SCAN_POLAR_BINS = 72;
export const SCAN_Z_BINS = 48;

export type ScanVec2 = {
  x: number;
  y: number;
};

export type ScanGeom = {
  sensorXMm: number;
  sensorYMm: number;
  lookX: number;
  lookY: number;
  minRangeMm: number;
  maxRangeMm: number;
  zRefMm: number;
};

export type ScanEstimate = {
  heightMm: number;
  radiusMm: number;
  zMinMm: number;
  zMaxMm: number;
  rMinMm: number;
  rMaxMm: number;
  hitCount: number;
  sampleCount: number;
};

/** Expand-only envelope. Fixed bins — same layout as `scan_accum_t` on device. */
export type ScanAccum = {
  sampleCount: number;
  hitCount: number;
  hasHit: number;
  zMinMm: number;
  zMaxMm: number;
  rMinMm: number;
  rMaxMm: number;
  xMinMm: number;
  xMaxMm: number;
  yMinMm: number;
  yMaxMm: number;
  polar: Float32Array;
  xMin: Float32Array;
  xMax: Float32Array;
  yMin: Float32Array;
  yMax: Float32Array;
  occ: Uint8Array;
  z0: number;
  z1: number;
};

export type ScanSection = {
  left: Float32Array;
  right: Float32Array;
  occ: Uint8Array;
  z0: number;
  z1: number;
};

export function scan_hypot(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

export function scan_clamp_bin(bin: number, n: number): number {
  if (bin < 0) return 0;
  if (bin >= n) return n - 1;
  return bin;
}

/** Map v in [v0, v0+span] → [0, n). */
export function scan_bin_u(v: number, v0: number, span: number, n: number): number {
  if (n <= 0 || span <= 0) return 0;
  return scan_clamp_bin(Math.floor(((v - v0) / span) * n), n);
}

export function scan_phi_bin(phi: number, n: number): number {
  const twoPi = Math.PI * 2;
  let a = phi;
  while (a < 0) a += twoPi;
  while (a >= twoPi) a -= twoPi;
  return scan_bin_u(a, 0, twoPi, n);
}

export function scan_hit_xy(geom: ScanGeom, distanceMm: number, out: ScanVec2): void {
  out.x = geom.sensorXMm + geom.lookX * distanceMm;
  out.y = geom.sensorYMm + geom.lookY * distanceMm;
}

/** Inverse-rotate world XY by turntable angle (CCW about +Z) → object frame. */
export function scan_world_to_object(wx: number, wy: number, angleRad: number, out: ScanVec2): void {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  out.x = wx * c + wy * s;
  out.y = -wx * s + wy * c;
}

export function scan_range_ok(geom: ScanGeom, distanceMm: number): number {
  if (distanceMm >= geom.minRangeMm && distanceMm <= geom.maxRangeMm) return 1;
  return 0;
}

export function scan_accum_clear(acc: ScanAccum): void {
  acc.sampleCount = 0;
  acc.hitCount = 0;
  acc.hasHit = 0;
  acc.zMinMm = 0;
  acc.zMaxMm = 0;
  acc.rMinMm = 0;
  acc.rMaxMm = 0;
  acc.xMinMm = 0;
  acc.xMaxMm = 0;
  acc.yMinMm = 0;
  acc.yMaxMm = 0;
  for (let i = 0; i < SCAN_POLAR_BINS; i += 1) acc.polar[i] = 0;
  for (let i = 0; i < SCAN_Z_BINS; i += 1) {
    acc.xMin[i] = 0;
    acc.xMax[i] = 0;
    acc.yMin[i] = 0;
    acc.yMax[i] = 0;
    acc.occ[i] = 0;
  }
}

export function scan_accum_add(
  acc: ScanAccum,
  geom: ScanGeom,
  angleRad: number,
  zMm: number,
  distanceMm: number,
  valid: number,
): void {
  acc.sampleCount += 1;
  if (!valid || !scan_range_ok(geom, distanceMm)) return;

  const wx = geom.sensorXMm + geom.lookX * distanceMm;
  const wy = geom.sensorYMm + geom.lookY * distanceMm;
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const ox = wx * c + wy * s;
  const oy = -wx * s + wy * c;
  const r = scan_hypot(ox, oy);

  if (!acc.hasHit) {
    acc.hasHit = 1;
    acc.zMinMm = zMm;
    acc.zMaxMm = zMm;
    acc.rMinMm = r;
    acc.rMaxMm = r;
    acc.xMinMm = ox;
    acc.xMaxMm = ox;
    acc.yMinMm = oy;
    acc.yMaxMm = oy;
  } else {
    if (zMm < acc.zMinMm) acc.zMinMm = zMm;
    if (zMm > acc.zMaxMm) acc.zMaxMm = zMm;
    if (r < acc.rMinMm) acc.rMinMm = r;
    if (r > acc.rMaxMm) acc.rMaxMm = r;
    if (ox < acc.xMinMm) acc.xMinMm = ox;
    if (ox > acc.xMaxMm) acc.xMaxMm = ox;
    if (oy < acc.yMinMm) acc.yMinMm = oy;
    if (oy > acc.yMaxMm) acc.yMaxMm = oy;
  }
  acc.hitCount += 1;

  const pbin = scan_phi_bin(Math.atan2(oy, ox), SCAN_POLAR_BINS);
  if (r > acc.polar[pbin]) acc.polar[pbin] = r;

  if (zMm >= acc.z0 && zMm <= acc.z1) {
    const zbin = scan_bin_u(zMm, acc.z0, acc.z1 - acc.z0, SCAN_Z_BINS);
    if (!acc.occ[zbin]) {
      acc.xMin[zbin] = ox;
      acc.xMax[zbin] = ox;
      acc.yMin[zbin] = oy;
      acc.yMax[zbin] = oy;
      acc.occ[zbin] = 1;
    } else {
      if (ox < acc.xMin[zbin]) acc.xMin[zbin] = ox;
      if (ox > acc.xMax[zbin]) acc.xMax[zbin] = ox;
      if (oy < acc.yMin[zbin]) acc.yMin[zbin] = oy;
      if (oy > acc.yMax[zbin]) acc.yMax[zbin] = oy;
    }
  }
}

export function scan_accum_estimate(acc: ScanAccum, geom: ScanGeom, out: ScanEstimate): void {
  out.sampleCount = acc.sampleCount;
  out.hitCount = acc.hitCount;
  if (!acc.hasHit) {
    out.heightMm = 0;
    out.radiusMm = 0;
    out.zMinMm = 0;
    out.zMaxMm = 0;
    out.rMinMm = 0;
    out.rMaxMm = 0;
    return;
  }
  out.zMinMm = acc.zMinMm;
  out.zMaxMm = acc.zMaxMm;
  out.rMinMm = acc.rMinMm;
  out.rMaxMm = acc.rMaxMm;
  let h = acc.zMaxMm - geom.zRefMm;
  if (h < 0) h = 0;
  out.heightMm = h;
  const x0 = acc.xMinMm;
  const x1 = acc.xMaxMm;
  const y0 = acc.yMinMm;
  const y1 = acc.yMaxMm;
  let corner = scan_hypot(x0, y0);
  let cr = scan_hypot(x0, y1);
  if (cr > corner) corner = cr;
  cr = scan_hypot(x1, y0);
  if (cr > corner) corner = cr;
  cr = scan_hypot(x1, y1);
  if (cr > corner) corner = cr;
  out.radiusMm = corner;
}

/* -------- host allocators (do not port — static structs on device) -------- */

export function scan_empty_estimate(): ScanEstimate {
  return {
    heightMm: 0,
    radiusMm: 0,
    zMinMm: 0,
    zMaxMm: 0,
    rMinMm: 0,
    rMaxMm: 0,
    hitCount: 0,
    sampleCount: 0,
  };
}

export function scan_make_accum(z0: number, z1: number): ScanAccum {
  return {
    sampleCount: 0,
    hitCount: 0,
    hasHit: 0,
    zMinMm: 0,
    zMaxMm: 0,
    rMinMm: 0,
    rMaxMm: 0,
    xMinMm: 0,
    xMaxMm: 0,
    yMinMm: 0,
    yMaxMm: 0,
    polar: new Float32Array(SCAN_POLAR_BINS),
    xMin: new Float32Array(SCAN_Z_BINS),
    xMax: new Float32Array(SCAN_Z_BINS),
    yMin: new Float32Array(SCAN_Z_BINS),
    yMax: new Float32Array(SCAN_Z_BINS),
    occ: new Uint8Array(SCAN_Z_BINS),
    z0,
    z1,
  };
}

export function scan_make_section(z0: number, z1: number): ScanSection {
  return {
    left: new Float32Array(SCAN_Z_BINS),
    right: new Float32Array(SCAN_Z_BINS),
    occ: new Uint8Array(SCAN_Z_BINS),
    z0,
    z1,
  };
}
