/**
 * DT35-style noise for the simulator only.
 * Do not port — the real sensor already has its own noise.
 */

export type RngState = { s: number };

export function rng_seed(state: RngState, seed: number): void {
  state.s = seed >>> 0;
  if (state.s === 0) state.s = 0x9e3779b9;
}

/** xorshift32 */
export function rng_u32(state: RngState): number {
  let x = state.s >>> 0;
  x ^= (x << 13) >>> 0;
  x ^= x >>> 17;
  x ^= (x << 5) >>> 0;
  state.s = x >>> 0;
  return state.s;
}

export function rng_f32(state: RngState): number {
  return rng_u32(state) / 4294967296;
}

const TWO_PI = Math.PI * 2;

export function rng_gauss(state: RngState): number {
  let u1 = rng_f32(state);
  const u2 = rng_f32(state);
  if (u1 < 1e-12) u1 = 1e-12;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(TWO_PI * u2);
}

export function sensor_quantize_mm(distanceMm: number, resolutionMm: number): number {
  if (resolutionMm <= 0) return distanceMm;
  return Math.round(distanceMm / resolutionMm) * resolutionMm;
}

export function sensor_apply_noise(
  distanceMm: number,
  valid: number,
  sigmaMm: number,
  dropoutProb: number,
  resolutionMm: number,
  minRangeMm: number,
  maxRangeMm: number,
  rng: RngState,
  out: { distanceMm: number; valid: number },
): void {
  if (!valid) {
    out.distanceMm = distanceMm;
    out.valid = 0;
    return;
  }
  if (dropoutProb > 0 && rng_f32(rng) < dropoutProb) {
    out.distanceMm = maxRangeMm;
    out.valid = 0;
    return;
  }
  let d = distanceMm;
  if (sigmaMm > 0) d += rng_gauss(rng) * sigmaMm;
  d = sensor_quantize_mm(d, resolutionMm);
  if (d < minRangeMm || d > maxRangeMm) {
    out.distanceMm = d;
    out.valid = 0;
    return;
  }
  out.distanceMm = d;
  out.valid = 1;
}
