/**
 * Wrapper I/O + UP_DOWN_SCAN_GO — firmware port target (C17 / C++17, ESP32).
 *
 * Floor timings: 5 s/rev table, 40 s full-rail winder.
 * Climb stops at measured load height (t_climb = H × 40 / rail), then
 * start/end wraps (same N, table only). Pitch ≤ film / layers; stop-and-go
 * when that needs more table revs than a continuous climb. No encoder.
 *
 * See apps/3d-wrapper/readme.md (Control design).
 */

export const SCAN_CTRL_MODE_IDLE = 0;
export const SCAN_CTRL_MODE_HOMING = 1;
export const SCAN_CTRL_MODE_START_WRAPS = 2;
export const SCAN_CTRL_MODE_SCAN_UP_GO = 3;
export const SCAN_CTRL_MODE_SCAN_UP_STOP = 4;
export const SCAN_CTRL_MODE_END_WRAPS = 5;
export const SCAN_CTRL_MODE_SCAN_DOWN = 6;
export const SCAN_CTRL_MODE_DONE = 7;
export const SCAN_CTRL_MODE_FAULT = 8;
export const SCAN_CTRL_MODE_MEASURE_UP = 9;
export const SCAN_CTRL_MODE_MEASURE_DOWN = 10;

/** Operator-facing job state. Internal `mode` is the coil / slice step. */
export const SCAN_STATE_STOPPED = 0;
export const SCAN_STATE_SCAN_UP = 1;
export const SCAN_STATE_SCAN_DOWN = 2;
export const SCAN_STATE_WRAPPING_UP = 3;
export const SCAN_STATE_WRAPPING_DOWN = 4;
export const SCAN_STATE_FINISHED = 5;
export const SCAN_STATE_ERROR = 6;

/**
 * Chainable actions. AUTO / ZIGZAG expand into primitives.
 * BAND = table-only hoops at the current Z (start / end wraps).
 */
export const SCAN_ACT_NONE = 0;
export const SCAN_ACT_STOP = 1;
export const SCAN_ACT_SCAN = 2;
export const SCAN_ACT_BAND = 3;
export const SCAN_ACT_WRAP_UP = 4;
export const SCAN_ACT_WRAP_DOWN = 5;
export const SCAN_ACT_ZIGZAG = 6;
export const SCAN_ACT_AUTO = 7;
export const SCAN_ACT_HOME = 8;

export const SCAN_ACT_Q_CAP = 8;
export const SCAN_CTRL_MODE_WRAP_DOWN_GO = 11;
export const SCAN_CTRL_MODE_WRAP_DOWN_STOP = 12;

/** Measured on the machine. */
export const SCAN_CTRL_T_REV_S = 5;
export const SCAN_CTRL_T_HEIGHT_S = 40;
export const SCAN_CTRL_WRAPS_NATIVE = SCAN_CTRL_T_HEIGHT_S / SCAN_CTRL_T_REV_S;
export const SCAN_CTRL_FILM_MM = 400;
export const SCAN_CTRL_LAYERS_MIN = 1;
export const SCAN_CTRL_LAYERS_MAX = 10;
/** 1 = continuous climb (no stop-and-go). */
/** Planning height until the laser has a measured top (max load). */
export const SCAN_CTRL_HEIGHT_MM = 2100;
/** Winder travel used by the 40 s calibration. Keep in sync with machine Z window. */
export const SCAN_CTRL_RAIL_MM = 2172;
export const SCAN_CTRL_WINDER_TMO_S = SCAN_CTRL_T_HEIGHT_S + 20;
export const SCAN_CTRL_START_WRAPS_MIN = 0;
export const SCAN_CTRL_START_WRAPS_DEFAULT = 5;
export const SCAN_CTRL_START_WRAPS_MAX = 10;
/** Turntable deck — same as estimator z_ref. */
export const SCAN_CTRL_Z_REF_MM = 73;
/** Euro pallet on the deck. Hits at or below this are not the load top. */
export const SCAN_CTRL_PALLET_MM = 145;
export const SCAN_CTRL_LOAD0_MM = SCAN_CTRL_Z_REF_MM + SCAN_CTRL_PALLET_MM + 40;
/** Stop a bit above last laser hit so the film covers the top. */
export const SCAN_CTRL_TOP_SLACK_MM = 40;
/** Miss time above the latched top before we treat it as the load end. */
export const SCAN_CTRL_TOP_MISS_S = 0.25;
/** Measure climb past first infinite (miss) — fraction of load height. */
export const SCAN_CTRL_OVER_INF = 0.1;

export type ScanCtrlIn = {
  start: number;
  act: number;
  esTop: number;
  esBot: number;
  pot01: number;
  startWraps: number;
  fullSim: number;
  heightMm: number;
  zMm: number;
  hit: number;
  estop: number;
};

export type ScanCtrlOut = {
  kTable: number;
  kUp: number;
  kDown: number;
};

export type ScanCtrl = {
  state: number;
  mode: number;
  act: number;
  startPrev: number;
  actPrev: number;
  filmMm: number;
  heightMm: number;
  layers: number;
  startWraps: number;
  fullSim: number;
  wraps: number;
  tClimbS: number;
  tOnS: number;
  tOffS: number;
  phaseS: number;
  winderS: number;
  zTopMm: number;
  missS: number;
  fault: number;
  q: number[];
  qn: number;
  qi: number;
};

export function scan_ctrl_ceil_pos(v: number): number {
  const i = Math.floor(v);
  if (v > i) return i + 1;
  return i;
}

/** Helix pitch so each height is covered by `layers` widths of film. */
export function scan_ctrl_spiral_pitch_mm(filmMm: number, layers: number): number {
  if (filmMm <= 0 || layers <= 0) return 0;
  return filmMm / layers;
}

/** Winder-on time to climb `heightMm` at the calibrated rail speed. */
export function scan_ctrl_climb_s(heightMm: number): number {
  let h = heightMm;
  if (h < 80) h = 80;
  if (h > SCAN_CTRL_RAIL_MM) h = SCAN_CTRL_RAIL_MM;
  return (h * SCAN_CTRL_T_HEIGHT_S) / SCAN_CTRL_RAIL_MM;
}

/**
 * Table revs needed over `heightMm` for `layers` of `filmMm` (spiral).
 * Never below continuous at this height — we cannot climb faster than vz.
 */
export function scan_ctrl_spiral_wraps(heightMm: number, filmMm: number, layers: number): number {
  const tClimb = scan_ctrl_climb_s(heightMm);
  let wMin = scan_ctrl_ceil_pos(tClimb / SCAN_CTRL_T_REV_S);
  if (wMin < 1) wMin = 1;
  if (layers <= 1) return wMin;
  const pitch = scan_ctrl_spiral_pitch_mm(filmMm, layers);
  if (pitch <= 0 || heightMm <= 0) return wMin;
  let w = scan_ctrl_ceil_pos(heightMm / pitch);
  if (w < wMin) w = wMin;
  return w;
}

export function scan_ctrl_clamp_start_wraps(n: number): number {
  let w = Math.round(n);
  if (w < SCAN_CTRL_START_WRAPS_MIN) w = SCAN_CTRL_START_WRAPS_MIN;
  if (w > SCAN_CTRL_START_WRAPS_MAX) w = SCAN_CTRL_START_WRAPS_MAX;
  return w;
}

/** Pot = desired layers (1…10). 1 = continuous. */
export function scan_ctrl_pot_layers(pot01: number): number {
  let u = pot01;
  if (u < 0) u = 0;
  if (u > 1) u = 1;
  return SCAN_CTRL_LAYERS_MIN + Math.round((SCAN_CTRL_LAYERS_MAX - SCAN_CTRL_LAYERS_MIN) * u);
}

/** t_on / t_off per slice. layers<=1 → continuous (t_off = 0). */
export function scan_ctrl_slice_s(
  wraps: number,
  tClimbS: number,
  out: { tOnS: number; tOffS: number },
  layers?: number,
): void {
  let climb = tClimbS;
  if (climb < 0) climb = 0;
  if (layers !== undefined && layers <= 1) {
    out.tOnS = climb > 0 ? climb : SCAN_CTRL_T_REV_S;
    out.tOffS = 0;
    return;
  }
  let w = wraps;
  if (w < 1) w = 1;
  out.tOnS = climb / w;
  out.tOffS = SCAN_CTRL_T_REV_S - out.tOnS;
  if (out.tOffS < 0) {
    out.tOnS = SCAN_CTRL_T_REV_S;
    out.tOffS = 0;
  }
}

export function scan_ctrl_init(c: ScanCtrl): void {
  c.state = SCAN_STATE_STOPPED;
  c.mode = SCAN_CTRL_MODE_IDLE;
  c.act = SCAN_ACT_NONE;
  c.startPrev = 0;
  c.actPrev = 0;
  c.filmMm = SCAN_CTRL_FILM_MM;
  c.heightMm = SCAN_CTRL_HEIGHT_MM;
  c.layers = SCAN_CTRL_LAYERS_MIN;
  c.startWraps = SCAN_CTRL_START_WRAPS_DEFAULT;
  c.fullSim = 1;
  c.wraps = scan_ctrl_spiral_wraps(c.heightMm, c.filmMm, c.layers);
  c.tClimbS = scan_ctrl_climb_s(c.heightMm);
  const sl = { tOnS: 0, tOffS: 0 };
  scan_ctrl_slice_s(c.wraps, c.tClimbS, sl, c.layers);
  c.tOnS = sl.tOnS;
  c.tOffS = sl.tOffS;
  c.phaseS = 0;
  c.winderS = 0;
  c.zTopMm = 0;
  c.missS = 0;
  c.fault = 0;
  c.q = [0, 0, 0, 0, 0, 0, 0, 0];
  c.qn = 0;
  c.qi = 0;
}

export function scan_ctrl_is_measure(state: number): number {
  if (state === SCAN_STATE_SCAN_UP || state === SCAN_STATE_SCAN_DOWN) return 1;
  return 0;
}

export function scan_ctrl_is_wrap(state: number): number {
  if (state === SCAN_STATE_WRAPPING_UP || state === SCAN_STATE_WRAPPING_DOWN) return 1;
  return 0;
}

export function scan_ctrl_is_idle(state: number): number {
  if (state === SCAN_STATE_STOPPED || state === SCAN_STATE_FINISHED || state === SCAN_STATE_ERROR) return 1;
  return 0;
}

function scan_ctrl_recompute_slices(c: ScanCtrl): void {
  c.wraps = scan_ctrl_spiral_wraps(c.heightMm, c.filmMm, c.layers);
  c.tClimbS = scan_ctrl_climb_s(c.heightMm);
  const sl = { tOnS: 0, tOffS: 0 };
  scan_ctrl_slice_s(c.wraps, c.tClimbS, sl, c.layers);
  c.tOnS = sl.tOnS;
  c.tOffS = sl.tOffS;
}

function scan_ctrl_q_clear(c: ScanCtrl): void {
  c.qn = 0;
  c.qi = 0;
  c.act = SCAN_ACT_NONE;
  let i = 0;
  while (i < SCAN_ACT_Q_CAP) {
    c.q[i] = 0;
    i += 1;
  }
}

function scan_ctrl_q_push(c: ScanCtrl, act: number): void {
  if (c.qn >= SCAN_ACT_Q_CAP) return;
  if (act === SCAN_ACT_NONE || act === SCAN_ACT_STOP) return;
  c.q[c.qn] = act;
  c.qn += 1;
}

function scan_ctrl_q_expand(c: ScanCtrl, act: number): void {
  if (act === SCAN_ACT_AUTO) {
    scan_ctrl_q_push(c, SCAN_ACT_SCAN);
    if (c.startWraps > 0) scan_ctrl_q_push(c, SCAN_ACT_BAND);
    scan_ctrl_q_push(c, SCAN_ACT_WRAP_UP);
    if (c.startWraps > 0) scan_ctrl_q_push(c, SCAN_ACT_BAND);
    return;
  }
  if (act === SCAN_ACT_ZIGZAG) {
    scan_ctrl_q_push(c, SCAN_ACT_WRAP_UP);
    scan_ctrl_q_push(c, SCAN_ACT_WRAP_DOWN);
    return;
  }
  scan_ctrl_q_push(c, act);
}

function scan_ctrl_act_needs_bot(act: number): number {
  if (act === SCAN_ACT_SCAN || act === SCAN_ACT_WRAP_UP) return 1;
  return 0;
}

function scan_ctrl_begin_climb(c: ScanCtrl): void {
  scan_ctrl_enter(c, SCAN_CTRL_MODE_SCAN_UP_GO);
  c.winderS = 0;
}

function scan_ctrl_begin_wrap_down(c: ScanCtrl, i: ScanCtrlIn): void {
  c.state = SCAN_STATE_WRAPPING_DOWN;
  c.act = SCAN_ACT_WRAP_DOWN;
  let h = i.zMm - SCAN_CTRL_Z_REF_MM;
  if (h < 80) h = 80;
  c.tClimbS = scan_ctrl_climb_s(h);
  c.winderS = 0;
  scan_ctrl_enter(c, SCAN_CTRL_MODE_WRAP_DOWN_GO);
}

function scan_ctrl_fail(c: ScanCtrl, code: number): void {
  scan_ctrl_q_clear(c);
  c.state = SCAN_STATE_ERROR;
  c.mode = SCAN_CTRL_MODE_FAULT;
  c.fault = code;
}

function scan_ctrl_finish(c: ScanCtrl): void {
  scan_ctrl_q_clear(c);
  c.state = SCAN_STATE_FINISHED;
  scan_ctrl_enter(c, SCAN_CTRL_MODE_DONE);
}

function scan_ctrl_stop(c: ScanCtrl): void {
  scan_ctrl_q_clear(c);
  c.state = SCAN_STATE_STOPPED;
  c.mode = SCAN_CTRL_MODE_IDLE;
  c.phaseS = 0;
  c.winderS = 0;
  c.fault = 0;
}

function scan_ctrl_start_act(c: ScanCtrl, act: number, i: ScanCtrlIn): void {
  c.act = act;
  if (act === SCAN_ACT_SCAN) {
    c.state = SCAN_STATE_SCAN_UP;
    scan_ctrl_enter(c, SCAN_CTRL_MODE_MEASURE_UP);
    return;
  }
  if (act === SCAN_ACT_BAND) {
    if (c.state !== SCAN_STATE_WRAPPING_DOWN) c.state = SCAN_STATE_WRAPPING_UP;
    scan_ctrl_enter(c, SCAN_CTRL_MODE_START_WRAPS);
    return;
  }
  if (act === SCAN_ACT_WRAP_UP) {
    c.state = SCAN_STATE_WRAPPING_UP;
    scan_ctrl_begin_climb(c);
    return;
  }
  if (act === SCAN_ACT_WRAP_DOWN) {
    scan_ctrl_begin_wrap_down(c, i);
    return;
  }
  if (act === SCAN_ACT_HOME) {
    scan_ctrl_enter(c, SCAN_CTRL_MODE_HOMING);
    return;
  }
  scan_ctrl_finish(c);
}

function scan_ctrl_done_act(c: ScanCtrl, i: ScanCtrlIn): void {
  c.qi += 1;
  if (c.qi >= c.qn) {
    scan_ctrl_finish(c);
    return;
  }
  scan_ctrl_start_act(c, c.q[c.qi], i);
}

function scan_ctrl_begin_job(c: ScanCtrl, i: ScanCtrlIn, act: number): void {
  c.fault = 0;
  scan_ctrl_latch_pot(c, i, act);
  scan_ctrl_q_clear(c);
  scan_ctrl_q_expand(c, act);
  if (c.qn <= 0) {
    scan_ctrl_finish(c);
    return;
  }
  const first = c.q[0];
  if (!i.esBot && scan_ctrl_act_needs_bot(first)) {
    scan_ctrl_enter(c, SCAN_CTRL_MODE_HOMING);
    return;
  }
  scan_ctrl_start_act(c, first, i);
}

function scan_ctrl_seen_load(c: ScanCtrl): number {
  if (c.zTopMm > SCAN_CTRL_LOAD0_MM) return 1;
  return 0;
}

function scan_ctrl_apply_top(c: ScanCtrl): void {
  if (!scan_ctrl_seen_load(c)) return;
  let h = c.zTopMm - SCAN_CTRL_Z_REF_MM;
  if (h < 80) h = 80;
  c.heightMm = h;
  scan_ctrl_recompute_slices(c);
}

function scan_ctrl_note_beam(c: ScanCtrl, i: ScanCtrlIn, dtS: number, climbing: number): void {
  if (i.hit) {
    if (i.zMm > SCAN_CTRL_LOAD0_MM && i.zMm > c.zTopMm) c.zTopMm = i.zMm;
    c.missS = 0;
    return;
  }
  if (!climbing || !scan_ctrl_seen_load(c)) {
    c.missS = 0;
    return;
  }
  if (i.zMm >= c.zTopMm + SCAN_CTRL_TOP_SLACK_MM) c.missS += dtS;
  else c.missS = 0;
}

function scan_ctrl_over_inf_mm(c: ScanCtrl): number {
  let h = c.zTopMm - SCAN_CTRL_Z_REF_MM;
  if (h < 80) h = 80;
  return h * SCAN_CTRL_OVER_INF;
}

/** First infinite above the load, plus 10% of load height. Pallet misses ignored. */
function scan_ctrl_past_infinite(c: ScanCtrl, i: ScanCtrlIn): number {
  if (i.esTop) return 1;
  if (!scan_ctrl_seen_load(c)) return 0;
  if (i.zMm >= c.zTopMm + scan_ctrl_over_inf_mm(c)) return 1;
  return 0;
}

function scan_ctrl_at_load_top(c: ScanCtrl, i: ScanCtrlIn): number {
  if (i.esTop) return 1;
  if (scan_ctrl_seen_load(c) && i.zMm >= c.zTopMm + SCAN_CTRL_TOP_SLACK_MM) return 1;
  if (c.missS >= SCAN_CTRL_TOP_MISS_S) return 1;
  if (c.winderS >= c.tClimbS && scan_ctrl_seen_load(c)) return 1;
  return 0;
}

function scan_ctrl_at_load_bot(c: ScanCtrl, i: ScanCtrlIn): number {
  if (i.esBot) return 1;
  if (c.winderS >= c.tClimbS) return 1;
  return 0;
}

function scan_ctrl_latch_pot(c: ScanCtrl, i: ScanCtrlIn, act: number): void {
  c.layers = scan_ctrl_pot_layers(i.pot01);
  c.startWraps = scan_ctrl_clamp_start_wraps(i.startWraps);
  c.fullSim = i.fullSim ? 1 : 0;
  if (act === SCAN_ACT_SCAN || act === SCAN_ACT_AUTO) {
    c.zTopMm = 0;
    c.missS = 0;
  }
  scan_ctrl_recompute_slices(c);
}

function scan_ctrl_clear_out(o: ScanCtrlOut): void {
  o.kTable = 0;
  o.kUp = 0;
  o.kDown = 0;
}

function scan_ctrl_apply_stops(i: ScanCtrlIn, o: ScanCtrlOut): void {
  if (i.esTop) o.kUp = 0;
  if (i.esBot) o.kDown = 0;
  if (o.kUp && o.kDown) {
    o.kUp = 0;
    o.kDown = 0;
  }
}

function scan_ctrl_enter(c: ScanCtrl, mode: number): void {
  c.mode = mode;
  c.phaseS = 0;
  if (
    mode === SCAN_CTRL_MODE_HOMING ||
    mode === SCAN_CTRL_MODE_SCAN_DOWN ||
    mode === SCAN_CTRL_MODE_MEASURE_UP ||
    mode === SCAN_CTRL_MODE_MEASURE_DOWN
  ) {
    c.winderS = 0;
  }
}

export function scan_ctrl_tick(c: ScanCtrl, i: ScanCtrlIn, dtS: number, o: ScanCtrlOut): void {
  if (dtS < 0) dtS = 0;
  const startEdge = i.start && !c.startPrev ? 1 : 0;
  c.startPrev = i.start ? 1 : 0;
  let act = i.act;
  if (!act && startEdge) act = SCAN_ACT_AUTO;
  const actEdge = act && act !== c.actPrev ? 1 : 0;
  c.actPrev = act;

  scan_ctrl_clear_out(o);

  if (i.estop) {
    scan_ctrl_fail(c, 1);
    return;
  }

  if (i.esTop && i.esBot) {
    scan_ctrl_fail(c, 2);
    return;
  }

  if (actEdge && act === SCAN_ACT_STOP) {
    scan_ctrl_stop(c);
    return;
  }

  if (actEdge && scan_ctrl_is_idle(c.state)) {
    scan_ctrl_begin_job(c, i, act);
  }

  switch (c.mode) {
    case SCAN_CTRL_MODE_IDLE:
      break;

    case SCAN_CTRL_MODE_HOMING:
      o.kDown = 1;
      c.winderS += dtS;
      if (i.esBot) {
        if (c.act === SCAN_ACT_HOME) scan_ctrl_done_act(c, i);
        else if (c.qn > 0) scan_ctrl_start_act(c, c.q[c.qi], i);
        else scan_ctrl_finish(c);
      } else if (c.winderS > SCAN_CTRL_WINDER_TMO_S) scan_ctrl_fail(c, 3);
      break;

    case SCAN_CTRL_MODE_START_WRAPS:
    case SCAN_CTRL_MODE_END_WRAPS:
      o.kTable = 1;
      c.phaseS += dtS;
      if (c.phaseS >= c.startWraps * SCAN_CTRL_T_REV_S) scan_ctrl_done_act(c, i);
      break;

    case SCAN_CTRL_MODE_MEASURE_UP:
      o.kTable = 1;
      o.kUp = 1;
      c.winderS += dtS;
      scan_ctrl_note_beam(c, i, dtS, 1);
      if (scan_ctrl_past_infinite(c, i)) {
        scan_ctrl_apply_top(c);
        c.state = SCAN_STATE_SCAN_DOWN;
        scan_ctrl_enter(c, SCAN_CTRL_MODE_MEASURE_DOWN);
      } else if (c.winderS > SCAN_CTRL_WINDER_TMO_S) scan_ctrl_fail(c, 6);
      break;

    case SCAN_CTRL_MODE_MEASURE_DOWN:
      o.kTable = 1;
      o.kDown = 1;
      c.winderS += dtS;
      scan_ctrl_note_beam(c, i, dtS, 0);
      if (i.esBot) {
        if (i.heightMm > 80 && i.heightMm > c.heightMm) c.heightMm = i.heightMm;
        scan_ctrl_apply_top(c);
        scan_ctrl_done_act(c, i);
      } else if (c.winderS > SCAN_CTRL_WINDER_TMO_S) scan_ctrl_fail(c, 7);
      break;

    case SCAN_CTRL_MODE_SCAN_UP_GO:
      o.kTable = 1;
      o.kUp = 1;
      c.phaseS += dtS;
      c.winderS += dtS;
      scan_ctrl_note_beam(c, i, dtS, 1);
      if (scan_ctrl_at_load_top(c, i)) scan_ctrl_done_act(c, i);
      else if (c.winderS > SCAN_CTRL_WINDER_TMO_S) scan_ctrl_fail(c, 4);
      else if (c.tOffS > 0 && c.phaseS >= c.tOnS) {
        scan_ctrl_enter(c, SCAN_CTRL_MODE_SCAN_UP_STOP);
      }
      break;

    case SCAN_CTRL_MODE_SCAN_UP_STOP:
      o.kTable = 1;
      c.phaseS += dtS;
      scan_ctrl_note_beam(c, i, dtS, 0);
      if (scan_ctrl_at_load_top(c, i)) scan_ctrl_done_act(c, i);
      else if (c.phaseS >= c.tOffS) scan_ctrl_enter(c, SCAN_CTRL_MODE_SCAN_UP_GO);
      break;

    case SCAN_CTRL_MODE_WRAP_DOWN_GO:
      o.kTable = 1;
      o.kDown = 1;
      c.phaseS += dtS;
      c.winderS += dtS;
      if (scan_ctrl_at_load_bot(c, i)) scan_ctrl_done_act(c, i);
      else if (c.winderS > SCAN_CTRL_WINDER_TMO_S) scan_ctrl_fail(c, 5);
      else if (c.tOffS > 0 && c.phaseS >= c.tOnS) {
        scan_ctrl_enter(c, SCAN_CTRL_MODE_WRAP_DOWN_STOP);
      }
      break;

    case SCAN_CTRL_MODE_WRAP_DOWN_STOP:
      o.kTable = 1;
      c.phaseS += dtS;
      if (scan_ctrl_at_load_bot(c, i)) scan_ctrl_done_act(c, i);
      else if (c.phaseS >= c.tOffS) scan_ctrl_enter(c, SCAN_CTRL_MODE_WRAP_DOWN_GO);
      break;

    case SCAN_CTRL_MODE_SCAN_DOWN:
      o.kDown = 1;
      c.winderS += dtS;
      if (i.esBot) scan_ctrl_done_act(c, i);
      else if (c.winderS > SCAN_CTRL_WINDER_TMO_S) scan_ctrl_fail(c, 5);
      break;

    case SCAN_CTRL_MODE_DONE:
    case SCAN_CTRL_MODE_FAULT:
      break;

    default:
      break;
  }

  scan_ctrl_apply_stops(i, o);
}

export function scan_ctrl_act_name(act: number): string {
  switch (act) {
    case SCAN_ACT_NONE:
      return "NONE";
    case SCAN_ACT_STOP:
      return "STOP";
    case SCAN_ACT_SCAN:
      return "SCAN";
    case SCAN_ACT_BAND:
      return "BAND";
    case SCAN_ACT_WRAP_UP:
      return "WRAP_UP";
    case SCAN_ACT_WRAP_DOWN:
      return "WRAP_DOWN";
    case SCAN_ACT_ZIGZAG:
      return "ZIGZAG";
    case SCAN_ACT_AUTO:
      return "AUTO";
    case SCAN_ACT_HOME:
      return "HOME";
    default:
      return "?";
  }
}

export function scan_ctrl_state_name(state: number): string {
  switch (state) {
    case SCAN_STATE_STOPPED:
      return "STOPPED";
    case SCAN_STATE_SCAN_UP:
      return "SCAN_UP";
    case SCAN_STATE_SCAN_DOWN:
      return "SCAN_DOWN";
    case SCAN_STATE_WRAPPING_UP:
      return "WRAPPING_UP";
    case SCAN_STATE_WRAPPING_DOWN:
      return "WRAPPING_DOWN";
    case SCAN_STATE_FINISHED:
      return "FINISHED";
    case SCAN_STATE_ERROR:
      return "ERROR";
    default:
      return "?";
  }
}

export function scan_ctrl_mode_name(mode: number): string {
  switch (mode) {
    case SCAN_CTRL_MODE_IDLE:
      return "IDLE";
    case SCAN_CTRL_MODE_HOMING:
      return "HOMING";
    case SCAN_CTRL_MODE_START_WRAPS:
      return "BAND";
    case SCAN_CTRL_MODE_SCAN_UP_GO:
      return "SCAN_UP_GO";
    case SCAN_CTRL_MODE_SCAN_UP_STOP:
      return "SCAN_UP_STOP";
    case SCAN_CTRL_MODE_END_WRAPS:
      return "BAND";
    case SCAN_CTRL_MODE_SCAN_DOWN:
      return "SCAN_DOWN";
    case SCAN_CTRL_MODE_WRAP_DOWN_GO:
      return "WRAP_DOWN_GO";
    case SCAN_CTRL_MODE_WRAP_DOWN_STOP:
      return "WRAP_DOWN_STOP";
    case SCAN_CTRL_MODE_DONE:
      return "DONE";
    case SCAN_CTRL_MODE_FAULT:
      return "FAULT";
    case SCAN_CTRL_MODE_MEASURE_UP:
      return "MEASURE_UP";
    case SCAN_CTRL_MODE_MEASURE_DOWN:
      return "MEASURE_DOWN";
    default:
      return "?";
  }
}
