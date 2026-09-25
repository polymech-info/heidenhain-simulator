/**
 * SIAT WS212A envelope — millimetres.
 * Source: tests/wrapper/siat_ws212_palette_wrapper_adjustable.scad
 * and WS212A overall-dimensions drawing.
 *
 * World convention in the estimator (Z-up, same as the SCAD):
 *   +X  turntable centre → mast
 *   +Y  lateral
 *   +Z  up
 * Three.js maps that to (X, Z, Y) → (x, y-up, z).
 */

export const MM = 1;

export const TURNTABLE_DIAMETER_MM = 1500;
export const TURNTABLE_RADIUS_MM = TURNTABLE_DIAMETER_MM / 2;
export const TURNTABLE_HEIGHT_MM = 73;
export const TURNTABLE_EDGE_MM = 18;

export const BASE_LENGTH_MM = 2409;
export const BASE_WIDTH_MM = 720;
export const BASE_HEIGHT_MM = 73;

export const MAST_BASE_LENGTH_MM = 565;
export const MAST_REAR_OVERHANG_MM = 50;
export const MAST_SIDE_OFFSET_MM = 35;
export const MAST_WIDTH_MM = 230;
export const MAST_DEPTH_MM = 260;
export const MAST_HEIGHT_MM = 2604;
export const MAST_WALL_MM = 18;

/** Front face of the mast pedestal, facing the turntable. */
export const MAST_FACE_X_MM =
  TURNTABLE_RADIUS_MM +
  (BASE_LENGTH_MM - TURNTABLE_DIAMETER_MM - MAST_BASE_LENGTH_MM - MAST_REAR_OVERHANG_MM);

export const MAST_X_MM = MAST_FACE_X_MM + MAST_WIDTH_MM / 2;

export const PALLET_LENGTH_MM = 1200;
export const PALLET_WIDTH_MM = 800;
export const PALLET_HEIGHT_MM = 145;

export const MAX_LOAD_HEIGHT_MM = 2100;

/** Stretch film (folie). Width is a setup value, not a pot — default 400 mm. */
export const FILM_WIDTH_MM = 400;
export const FILM_LAYERS_MIN = 1;

/** CNC rail sits on the mast face; sensor body hangs toward the turntable. */
export const RAIL_STAND_OFF_MM = 22;
export const SENSOR_BODY_X_MM = 72;
export const SENSOR_BODY_Y_MM = 36;
export const SENSOR_BODY_Z_MM = 42;

/** Laser origin: in front of the mast, on the machine axis, looking at −X. */
export const SENSOR_X_MM = MAST_FACE_X_MM - RAIL_STAND_OFF_MM - SENSOR_BODY_X_MM;
export const SENSOR_Y_MM = 0;
export const SENSOR_LOOK_X = -1;
export const SENSOR_LOOK_Y = 0;

export const Z_TRAVEL_MIN_MM = TURNTABLE_HEIGHT_MM + 8;
export const Z_TRAVEL_MAX_MM = Math.min(MAX_LOAD_HEIGHT_MM + TURNTABLE_HEIGHT_MM + 80, MAST_HEIGHT_MM - 120);

/** Floor: 5 s/rev table, 40 s full-height winder → 8 native wraps / height. */
export const TABLE_T_REV_S = 5;
export const WINDER_T_HEIGHT_S = 40;
export const DEFAULT_RPM = 60 / TABLE_T_REV_S;
export const DEFAULT_Z_SPEED_MM_S = (Z_TRAVEL_MAX_MM - Z_TRAVEL_MIN_MM) / WINDER_T_HEIGHT_S;
export const DEFAULT_SAMPLE_HZ = 50;
export const SIM_SPEED_STEPS = [0.5, 1, 1.5, 2, 3] as const;
export const DEFAULT_SIM_SPEED = 1;
