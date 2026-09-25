import type { SceneTheme } from "@/theme";
import {
  BASE_HEIGHT_MM,
  BASE_LENGTH_MM,
  BASE_WIDTH_MM,
  MAST_BASE_LENGTH_MM,
  MAST_DEPTH_MM,
  MAST_FACE_X_MM,
  MAST_HEIGHT_MM,
  MAST_SIDE_OFFSET_MM,
  MAST_WIDTH_MM,
  RAIL_STAND_OFF_MM,
  SENSOR_BODY_X_MM,
  SENSOR_BODY_Y_MM,
  SENSOR_BODY_Z_MM,
  TURNTABLE_DIAMETER_MM,
  TURNTABLE_EDGE_MM,
  TURNTABLE_HEIGHT_MM,
  TURNTABLE_RADIUS_MM,
  Z_TRAVEL_MAX_MM,
  Z_TRAVEL_MIN_MM,
} from "@/sim/machine";

function box(sx: number, sy: number, sz: number, color: string, x: number, y: number, z: number) {
  return (
    <mesh position={[x, y, z] as [number, number, number]} castShadow receiveShadow>
      <boxGeometry args={[sx, sy, sz]} />
      <meshStandardMaterial color={color} roughness={0.65} metalness={0.15} />
    </mesh>
  );
}

export function MachineStatic({ colors }: { colors: SceneTheme["machine"] }) {
  const ttR = TURNTABLE_RADIUS_MM;
  const footY = Math.max(MAST_DEPTH_MM + 110, BASE_WIDTH_MM);
  const railH = Z_TRAVEL_MAX_MM - Z_TRAVEL_MIN_MM + 80;
  const railY = Z_TRAVEL_MIN_MM + railH / 2 - 40;

  return (
    <group>
      {box(BASE_LENGTH_MM, BASE_HEIGHT_MM, BASE_WIDTH_MM, colors.base, -ttR + BASE_LENGTH_MM / 2, BASE_HEIGHT_MM / 2, 0)}
      <mesh position={[0, (TURNTABLE_HEIGHT_MM - TURNTABLE_EDGE_MM) / 2, 0]} receiveShadow>
        <cylinderGeometry args={[ttR, ttR, TURNTABLE_HEIGHT_MM - TURNTABLE_EDGE_MM, 64]} />
        <meshStandardMaterial color={colors.turntable} roughness={0.55} metalness={0.2} />
      </mesh>
      {box(MAST_BASE_LENGTH_MM, 35, footY - MAST_SIDE_OFFSET_MM, colors.mastFoot, MAST_FACE_X_MM + MAST_BASE_LENGTH_MM / 2, BASE_HEIGHT_MM + 17.5, MAST_SIDE_OFFSET_MM / 2)}
      {box(MAST_WIDTH_MM, MAST_HEIGHT_MM - BASE_HEIGHT_MM - 70, MAST_DEPTH_MM, colors.mast, MAST_FACE_X_MM + MAST_WIDTH_MM / 2, BASE_HEIGHT_MM + 35 + (MAST_HEIGHT_MM - BASE_HEIGHT_MM - 70) / 2, 0)}
      {box(MAST_WIDTH_MM + 20, 35, MAST_DEPTH_MM + 20, colors.mastCap, MAST_FACE_X_MM + MAST_WIDTH_MM / 2 - 10, MAST_HEIGHT_MM - 17.5, 0)}
      {box(18, railH, MAST_DEPTH_MM + 24, colors.rail, MAST_FACE_X_MM - RAIL_STAND_OFF_MM, railY, 0)}
      {box(170, 420, 260, colors.control, MAST_FACE_X_MM + MAST_WIDTH_MM + 110, BASE_HEIGHT_MM + 1280 + 210, 0)}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]} receiveShadow>
        <circleGeometry args={[TURNTABLE_DIAMETER_MM, 72]} />
        <meshStandardMaterial color={colors.floor} roughness={1} metalness={0} transparent opacity={colors.floorOpacity} />
      </mesh>
    </group>
  );
}

export function TurntableRing({ color }: { color: string }) {
  return (
    <mesh position={[0, TURNTABLE_HEIGHT_MM - TURNTABLE_EDGE_MM / 2, 0]}>
      <cylinderGeometry args={[TURNTABLE_RADIUS_MM, TURNTABLE_RADIUS_MM, TURNTABLE_EDGE_MM, 64]} />
      <meshStandardMaterial color={color} roughness={0.4} metalness={0.25} />
    </mesh>
  );
}

export function SensorCarriage({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[SENSOR_BODY_X_MM / 2, 0, 0]} castShadow>
        <boxGeometry args={[SENSOR_BODY_X_MM, SENSOR_BODY_Z_MM, SENSOR_BODY_Y_MM]} />
        <meshStandardMaterial color={color} roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[-2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[6, 6, 8, 16]} />
        <meshStandardMaterial color="#dc2626" emissive="#7f1d1d" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}
