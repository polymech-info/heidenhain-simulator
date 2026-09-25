/**
 * Estimator slot — firmware port target (C17 / C++17, ESP32).
 *
 * Kinematics produce (angle, z). An estimator consumes samples and reports
 * height / radius. Swap the function table; do not fork the sample loop.
 *
 * v1  scan_estimator_accum  — polar + per-Z AABB (this repo)
 * v2  (later) occupancy / full geom — same add/estimate, richer ctx
 */

import {
  scan_accum_add,
  scan_accum_clear,
  scan_accum_estimate,
  type ScanAccum,
  type ScanEstimate,
  type ScanGeom,
} from "@/algorithm/scanEstimate";

export type ScanEstimator = {
  clear: () => void;
  add: (geom: ScanGeom, angleRad: number, zMm: number, distanceMm: number, valid: number) => void;
  estimate: (geom: ScanGeom, out: ScanEstimate) => void;
  accum: ScanAccum;
};

export function scan_estimator_accum(acc: ScanAccum): ScanEstimator {
  return {
    accum: acc,
    clear: () => {
      scan_accum_clear(acc);
    },
    add: (geom, angleRad, zMm, distanceMm, valid) => {
      scan_accum_add(acc, geom, angleRad, zMm, distanceMm, valid);
    },
    estimate: (geom, out) => {
      scan_accum_estimate(acc, geom, out);
    },
  };
}
