import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import {
  SCAN_POLAR_BINS,
  scan_empty_estimate,
  scan_hit_xy,
  scan_make_accum,
  scan_make_section,
  scan_world_to_object,
  type ScanEstimate,
  type ScanGeom,
  type ScanSection,
} from "@/algorithm/scanEstimate";
import { scan_estimator_accum } from "@/algorithm/scanEstimator";
import {
  SCAN_ACT_AUTO,
  SCAN_ACT_SCAN,
  SCAN_ACT_WRAP_DOWN,
  SCAN_ACT_WRAP_UP,
  SCAN_ACT_ZIGZAG,
  SCAN_CTRL_HEIGHT_MM,
  SCAN_STATE_STOPPED,
  scan_ctrl_act_name,
  scan_ctrl_init,
  scan_ctrl_is_measure,
  scan_ctrl_is_wrap,
  scan_ctrl_mode_name,
  scan_ctrl_state_name,
  scan_ctrl_pot_layers,
  scan_ctrl_climb_s,
  scan_ctrl_spiral_pitch_mm,
  scan_ctrl_slice_s,
  scan_ctrl_spiral_wraps,
  scan_ctrl_tick,
  type ScanCtrl,
  type ScanCtrlIn,
  type ScanCtrlOut,
} from "@/algorithm/scanControl";
import {
  scan_kin_drive_step,
  scan_kin_fixed_init,
  scan_kin_fixed_reset,
  scan_omega_from_rpm,
  type ScanKinFixed,
  type ScanPose,
} from "@/algorithm/scanKinematics";
import { sensor_apply_noise, type RngState } from "@/algorithm/sensorNoise";
import {
  DEFAULT_RPM,
  DEFAULT_SAMPLE_HZ,
  DEFAULT_Z_SPEED_MM_S,
  SENSOR_LOOK_X,
  SENSOR_LOOK_Y,
  SENSOR_X_MM,
  SENSOR_Y_MM,
  TURNTABLE_HEIGHT_MM,
  Z_TRAVEL_MAX_MM,
  Z_TRAVEL_MIN_MM,
} from "@/sim/machine";
import { DT35 } from "@/sim/sensor";
import { SCENE_THEME } from "@/theme";

export type ScanCtrlUi = {
  state: number;
  stateName: string;
  act: number;
  actName: string;
  mode: number;
  modeName: string;
  kTable: number;
  kUp: number;
  kDown: number;
  esTop: number;
  esBot: number;
  layers: number;
  startWraps: number;
  fullSim: number;
  measuring: number;
  wrapping: number;
  wraps: number;
  heightMm: number;
  filmMm: number;
  pitchMm: number;
  tOnS: number;
  tOffS: number;
  phaseS: number;
};

export type ScanUi = {
  angleRad: number;
  zMm: number;
  lastDistanceMm: number;
  lastValid: number;
  estimate: ScanEstimate;
  polar: Float32Array;
  sectionX: ScanSection;
  sectionY: ScanSection;
  ctrl: ScanCtrlUi;
};

const _hit = new THREE.Vector3();
const _noiseOut = { distanceMm: 0, valid: 0 };
const ES_SLACK_MM = 4;

function emptyCtrlUi(): ScanCtrlUi {
  return {
    state: SCAN_STATE_STOPPED,
    stateName: "STOPPED",
    act: 0,
    actName: "NONE",
    mode: 0,
    modeName: "IDLE",
    kTable: 0,
    kUp: 0,
    kDown: 0,
    esTop: 0,
    esBot: 1,
    layers: 1,
    startWraps: 5,
    fullSim: 1,
    measuring: 0,
    wrapping: 0,
    wraps: 16,
    heightMm: SCAN_CTRL_HEIGHT_MM,
    filmMm: 400,
    pitchMm: 400 / 3,
    tOnS: 0,
    tOffS: 0,
    phaseS: 0,
  };
}

export function emptyScanUi(): ScanUi {
  return {
    angleRad: 0,
    zMm: Z_TRAVEL_MIN_MM,
    lastDistanceMm: 0,
    lastValid: 0,
    estimate: scan_empty_estimate(),
    polar: new Float32Array(SCAN_POLAR_BINS),
    sectionX: scan_make_section(TURNTABLE_HEIGHT_MM, Z_TRAVEL_MAX_MM),
    sectionY: scan_make_section(TURNTABLE_HEIGHT_MM, Z_TRAVEL_MAX_MM),
    ctrl: emptyCtrlUi(),
  };
}

type Props = {
  playing: boolean;
  pot01: number;
  startWraps: number;
  fullSim: boolean;
  act: number;
  actToken: number;
  noiseSigmaMm: number;
  dropout: number;
  loadRef: RefObject<THREE.Group | null>;
  turntableRef: RefObject<THREE.Group | null>;
  sensorZRef: MutableRefObject<number>;
  onUi: (ui: ScanUi) => void;
  resetToken: number;
  isDark: boolean;
  simSpeed: number;
};

export function ScanRuntime({
  playing,
  pot01,
  startWraps,
  fullSim,
  act,
  actToken,
  noiseSigmaMm,
  dropout,
  loadRef,
  turntableRef,
  sensorZRef,
  onUi,
  resetToken,
  isDark,
  simSpeed,
}: Props) {
  const scanTheme = SCENE_THEME[isDark ? "dark" : "light"].scan;
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const origin = useMemo(() => new THREE.Vector3(SENSOR_X_MM, Z_TRAVEL_MIN_MM, 0), []);
  const dir = useMemo(() => new THREE.Vector3(SENSOR_LOOK_X, 0, SENSOR_LOOK_Y).normalize(), []);
  const accum = useMemo(() => scan_make_accum(TURNTABLE_HEIGHT_MM, Z_TRAVEL_MAX_MM), []);
  const estimator = useMemo(() => scan_estimator_accum(accum), [accum]);
  const estimate = useMemo(() => scan_empty_estimate(), []);
  const hitXY = useMemo(() => ({ x: 0, y: 0 }), []);
  const hitObj = useMemo(() => ({ x: 0, y: 0 }), []);
  const pose = useMemo<ScanPose>(() => ({ angleRad: 0, zMm: Z_TRAVEL_MIN_MM }), []);
  const kin = useMemo<ScanKinFixed>(() => {
    const k = {} as ScanKinFixed;
    scan_kin_fixed_init(k, scan_omega_from_rpm(DEFAULT_RPM), DEFAULT_Z_SPEED_MM_S, Z_TRAVEL_MIN_MM, Z_TRAVEL_MAX_MM, 0);
    return k;
  }, []);
  const ctrl = useMemo<ScanCtrl>(() => {
    const c = {} as ScanCtrl;
    scan_ctrl_init(c);
    return c;
  }, []);
  const cin = useMemo<ScanCtrlIn>(
    () => ({
      start: 0,
      act: 0,
      esTop: 0,
      esBot: 1,
      pot01: 0,
      startWraps: 5,
      fullSim: 1,
      heightMm: 0,
      zMm: Z_TRAVEL_MIN_MM,
      hit: 0,
      estop: 0,
    }),
    [],
  );
  const cout = useMemo<ScanCtrlOut>(() => ({ kTable: 0, kUp: 0, kDown: 0 }), []);
  const geom = useMemo<ScanGeom>(
    () => ({
      sensorXMm: SENSOR_X_MM,
      sensorYMm: SENSOR_Y_MM,
      lookX: SENSOR_LOOK_X,
      lookY: SENSOR_LOOK_Y,
      minRangeMm: DT35.minRangeMm,
      maxRangeMm: DT35.maxRangeMm90,
      zRefMm: TURNTABLE_HEIGHT_MM,
    }),
    [],
  );
  const rng = useRef<RngState>({ s: 0xdecafbad });
  const accRef = useRef(0);
  const uiAccRef = useRef(0);
  const lastDistRef = useRef(0);
  const lastValidRef = useRef(0);
  const actArmed = useRef(0);
  const lastActToken = useRef(actToken);
  const hitPts = useRef<THREE.Points>(null);
  const hitGroup = useRef<THREE.Group>(null);
  const filmLine = useRef<THREE.Line | null>(null);
  const scanLine = useRef<THREE.Line | null>(null);
  const HIT_CAP = 16384;
  const FILM_CAP = 8192;
  const SCAN_CAP = 8192;
  const hitPos = useMemo(() => new Float32Array(HIT_CAP * 3), []);
  const filmPos = useMemo(() => new Float32Array(FILM_CAP * 3), []);
  const scanPos = useMemo(() => new Float32Array(SCAN_CAP * 3), []);
  const hitCount = useRef(0);
  const filmCount = useRef(0);
  const scanCount = useRef(0);
  const filmR = useRef(560);

  const rayGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    return g;
  }, []);
  const ptsGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(hitPos, 3));
    g.setDrawRange(0, 0);
    return g;
  }, [hitPos]);
  const envGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array((SCAN_POLAR_BINS + 1) * 3), 3));
    return g;
  }, []);
  const filmGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(filmPos, 3));
    g.setDrawRange(0, 0);
    return g;
  }, [filmPos]);
  const scanGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(scanPos, 3));
    g.setDrawRange(0, 0);
    return g;
  }, [scanPos]);

  useEffect(() => {
    if (actToken !== lastActToken.current) {
      lastActToken.current = actToken;
      actArmed.current = 1;
    }
  }, [actToken]);

  useEffect(() => {
    estimator.clear();
    scan_ctrl_init(ctrl);
    scan_kin_fixed_reset(kin);
    sensorZRef.current = kin.zMm;
    accRef.current = 0;
    hitCount.current = 0;
    filmCount.current = 0;
    scanCount.current = 0;
    hitPos.fill(0);
    filmPos.fill(0);
    scanPos.fill(0);
    ptsGeom.setDrawRange(0, 0);
    filmGeom.setDrawRange(0, 0);
    scanGeom.setDrawRange(0, 0);
    actArmed.current = 0;
    cout.kTable = 0;
    cout.kUp = 0;
    cout.kDown = 0;
    if (turntableRef.current) turntableRef.current.rotation.y = 0;
    onUi(emptyScanUi());
  }, [resetToken, ctrl, cout, estimator, filmGeom, filmPos, hitPos, kin, onUi, ptsGeom, scanGeom, scanPos, sensorZRef, turntableRef]);

  useFrame((_, dt) => {
    const sdt = dt * (simSpeed > 0 ? simSpeed : 1);
    cin.pot01 = pot01;
    cin.startWraps = startWraps;
    cin.fullSim = fullSim ? 1 : 0;
    cin.esTop = kin.zMm >= Z_TRAVEL_MAX_MM - ES_SLACK_MM ? 1 : 0;
    cin.esBot = kin.zMm <= Z_TRAVEL_MIN_MM + ES_SLACK_MM ? 1 : 0;
    cin.start = 0;
    cin.act = 0;
    if (playing && actArmed.current) {
      cin.act = act;
      actArmed.current = 0;
      if (act === SCAN_ACT_SCAN || act === SCAN_ACT_AUTO) {
        estimator.clear();
        hitCount.current = 0;
        scanCount.current = 0;
        hitPos.fill(0);
        scanPos.fill(0);
        ptsGeom.setDrawRange(0, 0);
        scanGeom.setDrawRange(0, 0);
      }
      if (act === SCAN_ACT_AUTO || act === SCAN_ACT_WRAP_UP || act === SCAN_ACT_WRAP_DOWN || act === SCAN_ACT_ZIGZAG) {
        filmCount.current = 0;
        filmPos.fill(0);
        filmGeom.setDrawRange(0, 0);
      }
    }

    pose.angleRad = kin.angleRad;
    pose.zMm = kin.zMm;
    sensorZRef.current = pose.zMm;

    if (turntableRef.current) turntableRef.current.rotation.y = -pose.angleRad;
    if (hitGroup.current) hitGroup.current.rotation.y = -pose.angleRad;

    origin.set(SENSOR_X_MM, sensorZRef.current, 0);
    raycaster.set(origin, dir);
    raycaster.far = DT35.maxRangeMm90;

    const load = loadRef.current;
    let rawDist: number = DT35.maxRangeMm90;
    let rawValid = 0;
    if (load) {
      const hits = raycaster.intersectObject(load, true);
      if (hits.length > 0 && hits[0].distance >= DT35.minRangeMm) {
        rawDist = hits[0].distance;
        rawValid = 1;
        _hit.copy(hits[0].point);
      }
    }

    cin.zMm = pose.zMm;
    cin.hit = rawValid;
    if (playing) {
      estimator.estimate(geom, estimate);
      cin.heightMm = estimate.heightMm;
      scan_ctrl_tick(ctrl, cin, sdt, cout);
      scan_kin_drive_step(kin, cout.kTable, cout.kUp, cout.kDown, sdt, pose);
      sensorZRef.current = pose.zMm;
    }

    accRef.current += sdt;
    const period = 1 / DEFAULT_SAMPLE_HZ;
    const measuring = scan_ctrl_is_measure(ctrl.state);
    const wrapping = scan_ctrl_is_wrap(ctrl.state);
    const doScan = measuring;
    const doFilm = wrapping;
    while (accRef.current >= period) {
      accRef.current -= period;
      sensor_apply_noise(
        rawDist,
        rawValid,
        noiseSigmaMm,
        dropout,
        DT35.resolutionMm,
        DT35.minRangeMm,
        DT35.maxRangeMm90,
        rng.current,
        _noiseOut,
      );
      if (doScan) {
        estimator.add(geom, pose.angleRad, pose.zMm, _noiseOut.distanceMm, _noiseOut.valid);
      }
      lastDistRef.current = _noiseOut.distanceMm;
      lastValidRef.current = _noiseOut.valid;
      if (doScan && _noiseOut.valid && hitCount.current < HIT_CAP) {
        scan_hit_xy(geom, _noiseOut.distanceMm, hitXY);
        scan_world_to_object(hitXY.x, hitXY.y, pose.angleRad, hitObj);
        const i = hitCount.current * 3;
        hitPos[i] = hitObj.x;
        hitPos[i + 1] = pose.zMm;
        hitPos[i + 2] = hitObj.y;
        hitCount.current += 1;
        ptsGeom.setDrawRange(0, hitCount.current);
        const attr = hitPts.current?.geometry.getAttribute("position");
        if (attr) attr.needsUpdate = true;
        const r = Math.hypot(hitObj.x, hitObj.y);
        if (r > 80) filmR.current = r + 12;
        if (scanCount.current < SCAN_CAP) {
          const s = scanCount.current * 3;
          scanPos[s] = hitObj.x;
          scanPos[s + 1] = pose.zMm;
          scanPos[s + 2] = hitObj.y;
          scanCount.current += 1;
          scanGeom.setDrawRange(0, scanCount.current);
          const sattr = scanLine.current?.geometry.getAttribute("position");
          if (sattr) sattr.needsUpdate = true;
        }
      }
      if (doFilm && filmCount.current < FILM_CAP) {
        scan_world_to_object(filmR.current, 0, pose.angleRad, hitObj);
        const i = filmCount.current * 3;
        filmPos[i] = hitObj.x;
        filmPos[i + 1] = pose.zMm;
        filmPos[i + 2] = hitObj.y;
        filmCount.current += 1;
        filmGeom.setDrawRange(0, filmCount.current);
        const fattr = filmLine.current?.geometry.getAttribute("position");
        if (fattr) fattr.needsUpdate = true;
      }
    }

    const visDist = lastValidRef.current ? lastDistRef.current : Math.min(rawDist, 2200);
    const pos = rayGeom.getAttribute("position") as THREE.BufferAttribute;
    pos.setXYZ(0, SENSOR_X_MM, sensorZRef.current, 0);
    pos.setXYZ(1, SENSOR_X_MM + SENSOR_LOOK_X * visDist, sensorZRef.current, SENSOR_Y_MM + SENSOR_LOOK_Y * visDist);
    pos.needsUpdate = true;

    uiAccRef.current += dt;
    if (uiAccRef.current >= 0.1) {
      uiAccRef.current = 0;
      estimator.estimate(geom, estimate);
      const envPos = envGeom.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i <= SCAN_POLAR_BINS; i += 1) {
        const bin = i % SCAN_POLAR_BINS;
        const r = estimator.accum.polar[bin];
        const phi = (bin / SCAN_POLAR_BINS) * Math.PI * 2;
        envPos.setXYZ(i, Math.cos(phi) * r, TURNTABLE_HEIGHT_MM + 4, Math.sin(phi) * r);
      }
      envPos.needsUpdate = true;
      const preview = ctrl.state === SCAN_STATE_STOPPED;
      const layersUi = preview ? scan_ctrl_pot_layers(pot01) : ctrl.layers;
      const wrapsUi = preview ? scan_ctrl_spiral_wraps(SCAN_CTRL_HEIGHT_MM, ctrl.filmMm, layersUi) : ctrl.wraps;
      const sl = { tOnS: ctrl.tOnS, tOffS: ctrl.tOffS };
      if (preview) scan_ctrl_slice_s(wrapsUi, scan_ctrl_climb_s(SCAN_CTRL_HEIGHT_MM), sl, layersUi);
      onUi({
        angleRad: pose.angleRad,
        zMm: pose.zMm,
        lastDistanceMm: lastDistRef.current,
        lastValid: lastValidRef.current,
        estimate: { ...estimate },
        polar: estimator.accum.polar.slice(),
        sectionX: {
          left: estimator.accum.xMin.slice(),
          right: estimator.accum.xMax.slice(),
          occ: estimator.accum.occ.slice(),
          z0: estimator.accum.z0,
          z1: estimator.accum.z1,
        },
        sectionY: {
          left: estimator.accum.yMin.slice(),
          right: estimator.accum.yMax.slice(),
          occ: estimator.accum.occ.slice(),
          z0: estimator.accum.z0,
          z1: estimator.accum.z1,
        },
        ctrl: {
          state: ctrl.state,
          stateName: scan_ctrl_state_name(ctrl.state),
          act: ctrl.act,
          actName: scan_ctrl_act_name(ctrl.act),
          mode: ctrl.mode,
          modeName: scan_ctrl_mode_name(ctrl.mode),
          kTable: cout.kTable,
          kUp: cout.kUp,
          kDown: cout.kDown,
          esTop: cin.esTop,
          esBot: cin.esBot,
          layers: layersUi,
          startWraps: preview ? startWraps : ctrl.startWraps,
          fullSim: preview ? (fullSim ? 1 : 0) : ctrl.fullSim,
          measuring: scan_ctrl_is_measure(ctrl.state),
          wrapping: scan_ctrl_is_wrap(ctrl.state),
          wraps: wrapsUi,
          heightMm: preview ? SCAN_CTRL_HEIGHT_MM : ctrl.heightMm,
          filmMm: ctrl.filmMm,
          pitchMm: scan_ctrl_spiral_pitch_mm(ctrl.filmMm, layersUi),
          tOnS: sl.tOnS,
          tOffS: sl.tOffS,
          phaseS: ctrl.phaseS,
        },
      });
    }
  });

  const rayObj = useMemo(
    () => new THREE.Line(rayGeom, new THREE.LineBasicMaterial({ color: scanTheme.ray })),
    [rayGeom, scanTheme.ray],
  );
  const envObj = useMemo(
    () => new THREE.Line(envGeom, new THREE.LineBasicMaterial({ color: scanTheme.envelope })),
    [envGeom, scanTheme.envelope],
  );
  const filmObj = useMemo(
    () => new THREE.Line(filmGeom, new THREE.LineBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.88 })),
    [filmGeom],
  );
  const scanObj = useMemo(
    () =>
      new THREE.Line(
        scanGeom,
        new THREE.LineBasicMaterial({ color: scanTheme.hits, transparent: true, opacity: 0.95 }),
      ),
    [scanGeom, scanTheme.hits],
  );

  useEffect(() => {
    const rayMat = rayObj.material as THREE.LineBasicMaterial;
    const envMat = envObj.material as THREE.LineBasicMaterial;
    const scanMat = scanObj.material as THREE.LineBasicMaterial;
    rayMat.color.setHex(scanTheme.ray);
    envMat.color.setHex(scanTheme.envelope);
    scanMat.color.set(scanTheme.hits);
  }, [envObj, rayObj, scanObj, scanTheme.envelope, scanTheme.hits, scanTheme.ray]);

  useEffect(() => {
    filmLine.current = filmObj;
  }, [filmObj]);

  useEffect(() => {
    scanLine.current = scanObj;
  }, [scanObj]);

  return (
    <group>
      <primitive object={rayObj} />
      <group ref={hitGroup}>
        <points ref={hitPts} geometry={ptsGeom}>
          <pointsMaterial color={scanTheme.hits} size={8} sizeAttenuation />
        </points>
        <primitive object={scanObj} />
        <primitive object={filmObj} />
      </group>
      <primitive object={envObj} />
    </group>
  );
}

export function SensorFollow({
  sensorZRef,
  children,
}: {
  sensorZRef: MutableRefObject<number>;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.set(SENSOR_X_MM, sensorZRef.current, 0);
  });
  return <group ref={ref}>{children}</group>;
}
