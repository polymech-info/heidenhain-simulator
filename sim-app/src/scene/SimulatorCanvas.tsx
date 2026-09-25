import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { GizmoHelper, GizmoViewcube, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { MachineStatic, SensorCarriage, TurntableRing } from "@/scene/MachineMesh";
import { EndStops, FilmBand, FilmGhost } from "@/scene/FilmWrap";
import { ScanRuntime, SensorFollow, type ScanUi } from "@/scene/ScanRuntime";
import { createLoad } from "@/objects/registry";
import type { LoadDefinition } from "@/objects/types";
import { Z_TRAVEL_MIN_MM } from "@/sim/machine";
import { SCENE_THEME } from "@/theme";

export type NavMode = "orbit" | "pan" | "zoom";

type Props = {
  loadId: string;
  customLoad: LoadDefinition | null;
  playing: boolean;
  pot01: number;
  startWraps: number;
  fullSim: boolean;
  act: number;
  actToken: number;
  noiseSigmaMm: number;
  dropout: number;
  ui: ScanUi;
  navMode: NavMode;
  resetToken: number;
  isDark: boolean;
  simSpeed: number;
  onUi: (ui: ScanUi) => void;
  onTruth: (truth: LoadDefinition["truth"]) => void;
};

const mouseButtons: Record<NavMode, { LEFT: THREE.MOUSE; MIDDLE: THREE.MOUSE; RIGHT: THREE.MOUSE }> = {
  orbit: { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN },
  pan: { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE },
  zoom: { LEFT: THREE.MOUSE.DOLLY, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN },
};

export function SimulatorCanvas({
  loadId,
  customLoad,
  playing,
  pot01,
  startWraps,
  fullSim,
  act,
  actToken,
  noiseSigmaMm,
  dropout,
  ui,
  navMode,
  resetToken,
  isDark,
  simSpeed,
  onUi,
  onTruth,
}: Props) {
  const theme = SCENE_THEME[isDark ? "dark" : "light"];
  const loadRef = useRef<THREE.Group | null>(null);
  const turntableRef = useRef<THREE.Group | null>(null);
  const sensorZRef = useRef(Z_TRAVEL_MIN_MM);

  const load = useMemo(() => customLoad ?? createLoad(loadId), [customLoad, loadId]);
  const loadObject = useMemo(() => load.create(), [load]);

  useEffect(() => {
    onTruth(load.truth);
  }, [load, onTruth]);

  return (
    <Suspense fallback={null}>
      <Canvas
        className="!block h-full w-full touch-none"
        shadows
        camera={{ position: [2200, 1600, 2100], fov: 42, near: 8, far: 40000 }}
        gl={{ antialias: true }}
      >
        <color attach="background" args={[theme.background]} />
        <ambientLight intensity={theme.ambient} />
        <directionalLight position={[1800, 3200, 1200]} intensity={theme.keyLight} castShadow />
        <directionalLight position={[-1600, 800, -1400]} intensity={theme.fillLight} />
        <fog attach="fog" args={[theme.fog, 8000, 28000]} />

        <MachineStatic colors={theme.machine} />
        <group ref={turntableRef}>
          <TurntableRing color={theme.machine.ring} />
          <group ref={loadRef} key={load.id}>
            <primitive object={loadObject} />
          </group>
          {!ui.ctrl.measuring ? (
            <FilmGhost
              wraps={ui.ctrl.wraps}
              z0={Z_TRAVEL_MIN_MM}
              heightMm={Math.max(ui.ctrl.heightMm > 80 ? ui.ctrl.heightMm : ui.ctrl.pitchMm * ui.ctrl.wraps, 1)}
              radiusMm={Math.max(ui.estimate.radiusMm, 520) + 40}
              color={isDark ? "#64748b" : "#475569"}
            />
          ) : null}
          {ui.ctrl.wrapping && ui.ctrl.kTable ? (
            <FilmBand
              zMm={ui.zMm}
              filmMm={ui.ctrl.filmMm}
              radiusMm={Math.max(ui.estimate.radiusMm, 520)}
              go={ui.ctrl.kUp}
            />
          ) : null}
        </group>

        <EndStops esBot={ui.ctrl.esBot} esTop={ui.ctrl.esTop} />

        <SensorFollow sensorZRef={sensorZRef}>
          <SensorCarriage color={theme.machine.sensor} />
        </SensorFollow>

        <ScanRuntime
          isDark={isDark}
          playing={playing}
          pot01={pot01}
          startWraps={startWraps}
          fullSim={fullSim}
          act={act}
          actToken={actToken}
          noiseSigmaMm={noiseSigmaMm}
          dropout={dropout}
          loadRef={loadRef}
          turntableRef={turntableRef}
          sensorZRef={sensorZRef}
          onUi={onUi}
          resetToken={resetToken}
          simSpeed={simSpeed}
        />

        <gridHelper key={isDark ? "grid-dark" : "grid-light"} args={[4000, 20, theme.gridCenter, theme.gridCell]} position={[0, 0, 0]} />

        <OrbitControls
          makeDefault
          target={[400, 400, 0]}
          enableRotate
          enablePan
          enableZoom
          mouseButtons={mouseButtons[navMode]}
        />
        <GizmoHelper key={isDark ? "gizmo-dark" : "gizmo-light"} alignment="top-right" margin={[80, 72]}>
          <GizmoViewcube
            color={theme.gizmo.color}
            hoverColor={theme.gizmo.hoverColor}
            textColor={theme.gizmo.textColor}
            strokeColor={theme.gizmo.strokeColor}
            font='600 22px "Segoe UI",system-ui,sans-serif'
          />
        </GizmoHelper>
      </Canvas>
    </Suspense>
  );
}
