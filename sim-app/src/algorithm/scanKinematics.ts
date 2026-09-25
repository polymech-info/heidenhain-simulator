/**
 * Pose sources — firmware port target (C17 / C++17, ESP32).
 *
 * The estimator only wants (angle_rad, z_mm). How those are produced is
 * swappable. MVP: fixed turntable ω and winder vz, no encoder, no index.
 *
 * See apps/3d-wrapper/readme.md (MVP strategy).
 */

export type ScanPose = {
  angleRad: number;
  zMm: number;
};

/** Free-running table + Z slide. Rates are calibrated constants, not setpoints. */
export type ScanKinFixed = {
  omegaRadS: number;
  vzMmS: number;
  zMinMm: number;
  zMaxMm: number;
  /** 1 = reverse at travel ends (host demo). 0 = one sweep, clamp (machine MVP). */
  bounce: number;
  angleRad: number;
  zMm: number;
  zDir: number;
};

export function scan_kin_fixed_init(
  k: ScanKinFixed,
  omegaRadS: number,
  vzMmS: number,
  zMinMm: number,
  zMaxMm: number,
  bounce: number,
): void {
  k.omegaRadS = omegaRadS;
  k.vzMmS = vzMmS > 0 ? vzMmS : 0;
  k.zMinMm = zMinMm;
  k.zMaxMm = zMaxMm;
  k.bounce = bounce ? 1 : 0;
  k.angleRad = 0;
  k.zMm = zMinMm;
  k.zDir = 1;
}

export function scan_kin_fixed_reset(k: ScanKinFixed): void {
  k.angleRad = 0;
  k.zMm = k.zMinMm;
  k.zDir = 1;
}

export function scan_kin_fixed_set_rates(k: ScanKinFixed, omegaRadS: number, vzMmS: number): void {
  k.omegaRadS = omegaRadS;
  k.vzMmS = vzMmS > 0 ? vzMmS : 0;
}

/** Advance by dt seconds. Object-frame zero is t0 (no index → absolute φ unknown). */
export function scan_kin_fixed_step(k: ScanKinFixed, dtS: number, out: ScanPose): void {
  if (dtS < 0) dtS = 0;
  k.angleRad += k.omegaRadS * dtS;
  const twoPi = Math.PI * 2;
  if (k.angleRad >= twoPi || k.angleRad <= -twoPi) {
    k.angleRad -= twoPi * Math.floor(k.angleRad / twoPi);
  }

  let z = k.zMm + k.zDir * k.vzMmS * dtS;
  if (z > k.zMaxMm) {
    z = k.zMaxMm;
    if (k.bounce) k.zDir = -1;
  } else if (z < k.zMinMm) {
    z = k.zMinMm;
    if (k.bounce) k.zDir = 1;
  }
  k.zMm = z;

  out.angleRad = k.angleRad;
  out.zMm = k.zMm;
}

export function scan_omega_from_rpm(rpm: number): number {
  return (rpm * Math.PI * 2) / 60;
}

/**
 * Machine path: integrate only axes whose contactors are on.
 * End-stops are applied by scan_ctrl (outputs already interlocked).
 */
export function scan_kin_drive_step(
  k: ScanKinFixed,
  kTable: number,
  kUp: number,
  kDown: number,
  dtS: number,
  out: ScanPose,
): void {
  if (dtS < 0) dtS = 0;
  if (kTable) {
    k.angleRad += k.omegaRadS * dtS;
    const twoPi = Math.PI * 2;
    if (k.angleRad >= twoPi || k.angleRad <= -twoPi) {
      k.angleRad -= twoPi * Math.floor(k.angleRad / twoPi);
    }
  }
  if (kUp && !kDown) {
    k.zMm += k.vzMmS * dtS;
    if (k.zMm > k.zMaxMm) k.zMm = k.zMaxMm;
    k.zDir = 1;
  } else if (kDown && !kUp) {
    k.zMm -= k.vzMmS * dtS;
    if (k.zMm < k.zMinMm) k.zMm = k.zMinMm;
    k.zDir = -1;
  }
  out.angleRad = k.angleRad;
  out.zMm = k.zMm;
}
