import { useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { GizmoHelper, GizmoViewport, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Vec3 } from "@/machine/machine";
import type { Trace } from "@/machine/machine";
import { makeGrid, resetGrid, stampSegment, toolRadiusMm, type MeshPreset } from "@/scene/stockRemoval";
import { SCENE_THEME } from "@/theme";

export type NavMode = "orbit" | "pan" | "zoom";

export type ToolpathMode = "none" | "dots" | "trail" | "visible" | "feed" | "cutting";

export const TOOLPATH_MODES: { id: ToolpathMode; label: string }[] = [
  { id: "none", label: "None" },
  { id: "dots", label: "Dots" },
  { id: "trail", label: "Trail" },
  { id: "visible", label: "Visible" },
  { id: "feed", label: "Feed" },
  { id: "cutting", label: "Cutting" },
];

type Seek = { block: number; token: number; dist?: number };

type Props = {
  trace: Trace | null;
  playing: boolean;
  speed: number;
  seek: Seek | null;
  navMode: NavMode;
  pathMode: ToolpathMode;
  showMaterial: boolean;
  mesh: MeshPreset;
  isDark: boolean;
  onBlock: (index: number) => void;
  onPose: (pose: Vec3) => void;
  onProgress: (dist: number) => void;
  onDone: () => void;
};

const mouseButtons: Record<NavMode, { LEFT: THREE.MOUSE; MIDDLE: THREE.MOUSE; RIGHT: THREE.MOUSE }> = {
  orbit: { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN },
  pan: { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE },
  zoom: { LEFT: THREE.MOUSE.DOLLY, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN },
};

function bounds(trace: Trace): { center: Vec3; span: number } {
  const box = new THREE.Box3();
  if (trace.stock) {
    box.expandByPoint(new THREE.Vector3(trace.stock.min.x, trace.stock.min.y, trace.stock.min.z));
    box.expandByPoint(new THREE.Vector3(trace.stock.max.x, trace.stock.max.y, trace.stock.max.z));
  }
  for (const p of trace.points) box.expandByPoint(new THREE.Vector3(p.x, p.y, p.z));
  if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(), new THREE.Vector3(100, 100, 50));
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  return {
    center: { x: center.x, y: center.y, z: center.z },
    span: Math.max(size.x, size.y, size.z, 40),
  };
}

export function blockAt(trace: Trace, dist: number): number {
  const { points, clock } = trace;
  if (points.length === 0) return 0;
  const i = seekClock(clock, dist);
  const inside = i < points.length - 1 && dist > clock[i] + 1e-6;
  const block = points[inside ? i + 1 : i].block;
  return block < 0 ? 0 : block;
}

function poseAt(trace: Trace, dist: number): Vec3 {
  const { points, clock } = trace;
  if (points.length === 0) return { x: 0, y: 0, z: 0 };
  const i = seekClock(clock, dist);
  if (i >= points.length - 1) return points[points.length - 1];
  const span = clock[i + 1] - clock[i];
  const u = span > 1e-9 ? (dist - clock[i]) / span : 0;
  const a = points[i];
  const b = points[i + 1];
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u };
}

function seekClock(clock: number[], dist: number) {
  let lo = 0;
  let hi = clock.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (clock[mid] <= dist + 1e-9) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function Fit({ center, span }: { center: Vec3; span: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null;
  useEffect(() => {
    camera.up.set(0, 0, 1);
    camera.position.set(center.x + span * 0.95, center.y - span * 1.35, center.z + span * 0.85);
    camera.near = Math.max(0.05, span / 500);
    camera.far = Math.max(5000, span * 40);
    camera.lookAt(center.x, center.y, center.z);
    camera.updateProjectionMatrix();
    if (controls && "target" in controls) {
      controls.target.set(center.x, center.y, center.z);
      controls.update();
    }
  }, [camera, controls, center.x, center.y, center.z, span]);
  return null;
}

function StockBox({ trace, color, edge, solid }: { trace: Trace; color: string; edge: string; solid: boolean }) {
  const stock = trace.stock;
  const built = useMemo(() => {
    if (!stock) return null;
    const sx = Math.max(0.01, Math.abs(stock.max.x - stock.min.x));
    const sy = Math.max(0.01, Math.abs(stock.max.y - stock.min.y));
    const sz = Math.max(0.01, Math.abs(stock.max.z - stock.min.z));
    const geo = new THREE.BoxGeometry(sx, sy, sz);
    const edges = new THREE.EdgesGeometry(geo);
    const position: [number, number, number] = [
      (stock.min.x + stock.max.x) / 2,
      (stock.min.y + stock.max.y) / 2,
      (stock.min.z + stock.max.z) / 2,
    ];
    return { geo, edges, position };
  }, [stock]);

  useEffect(() => {
    return () => {
      built?.geo.dispose();
      built?.edges.dispose();
    };
  }, [built]);

  if (!built) return null;
  return (
    <group position={built.position}>
      {solid ? (
        <mesh geometry={built.geo}>
          <meshStandardMaterial color={color} transparent opacity={0.16} depthWrite={false} />
        </mesh>
      ) : null}
      <lineSegments geometry={built.edges}>
        <lineBasicMaterial color={edge} />
      </lineSegments>
    </group>
  );
}

function RemovalMesh({
  trace,
  dist,
  color,
  cut,
  mesh,
}: {
  trace: Trace;
  dist: MutableRefObject<number>;
  color: string;
  cut: string;
  mesh: MeshPreset;
}) {
  const committed = useRef(0);
  const lastDist = useRef(0);
  const uploads = useRef(0);
  const built = useMemo(() => {
    if (!trace.stock) return null;
    const grid = makeGrid(trace.stock, mesh);
    const pos = new Float32Array(grid.nx * grid.ny * 3);
    const col = new Float32Array(grid.nx * grid.ny * 3);
    const base = new THREE.Color(color);
    for (let j = 0; j < grid.ny; j++) {
      for (let i = 0; i < grid.nx; i++) {
        const k = j * grid.nx + i;
        pos[k * 3] = grid.x0 + i * grid.dx;
        pos[k * 3 + 1] = grid.y0 + j * grid.dy;
        pos[k * 3 + 2] = grid.zTop;
        col[k * 3] = base.r;
        col[k * 3 + 1] = base.g;
        col[k * 3 + 2] = base.b;
      }
    }
    const quads = (grid.nx - 1) * (grid.ny - 1);
    const index = new Uint32Array(quads * 6);
    let p = 0;
    for (let j = 0; j < grid.ny - 1; j++) {
      for (let i = 0; i < grid.nx - 1; i++) {
        const a = j * grid.nx + i;
        index[p++] = a;
        index[p++] = a + 1;
        index[p++] = a + grid.nx;
        index[p++] = a + 1;
        index[p++] = a + grid.nx + 1;
        index[p++] = a + grid.nx;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeVertexNormals();
    return { grid, geo, stock: base, cut: new THREE.Color(cut) };
  }, [trace, color, cut, mesh]);

  const liveGeo = useRef<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    committed.current = 0;
    lastDist.current = 0;
    const previous = liveGeo.current;
    liveGeo.current = built?.geo ?? null;
    if (previous && previous !== liveGeo.current) previous.dispose();
  }, [built]);

  useFrame(() => {
    if (!built) return;
    const { grid, geo, stock, cut: cutColor } = built;
    let dirty = false;
    if (dist.current + 1e-3 < lastDist.current) {
      resetGrid(grid);
      committed.current = 0;
      dirty = true;
    }
    const { points, clock } = trace;
    const i = seekClock(clock, dist.current);
    const STAMPS = 24;
    let stamped = 0;
    while (committed.current < i && stamped < STAMPS) {
      const a = points[committed.current];
      const b = points[committed.current + 1];
      stampSegment(grid, a, b, toolRadiusMm(trace, b.block), b.rapid);
      committed.current += 1;
      stamped += 1;
      dirty = true;
    }
    if (committed.current >= i && i < points.length - 1) {
      const span = clock[i + 1] - clock[i];
      const u = span > 1e-9 ? (dist.current - clock[i]) / span : 0;
      if (u > 1e-4) {
        const a = points[i];
        const b = points[i + 1];
        if (!b.rapid) {
          stampSegment(
            grid,
            a,
            { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u },
            toolRadiusMm(trace, b.block),
            false,
          );
          dirty = true;
        }
      }
    }
    lastDist.current = dist.current;
    if (!dirty) return;
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    const colAttr = geo.getAttribute("color") as THREE.BufferAttribute;
    const spanZ = Math.max(grid.zTop - grid.zBot, 1);
    for (let k = 0; k < grid.h.length; k++) {
      pos.setZ(k, grid.h[k]);
      const t = Math.min(1, (grid.zTop - grid.h[k]) / spanZ);
      colAttr.setXYZ(
        k,
        stock.r + (cutColor.r - stock.r) * t,
        stock.g + (cutColor.g - stock.g) * t,
        stock.b + (cutColor.b - stock.b) * t,
      );
    }
    pos.needsUpdate = true;
    colAttr.needsUpdate = true;
    uploads.current += 1;
    if (committed.current >= i && uploads.current % 6 === 1) geo.computeVertexNormals();
  });

  if (!built) return null;
  return (
    <mesh geometry={built.geo}>
      <meshStandardMaterial vertexColors roughness={0.84} metalness={0.02} flatShading />
    </mesh>
  );
}

function cutsStock(a: Vec3, b: Vec3, stock: Trace["stock"]): boolean {
  const zLo = Math.min(a.z, b.z);
  const zHi = Math.max(a.z, b.z);
  if (!stock) return zLo < -1e-3;
  const x0 = Math.min(stock.min.x, stock.max.x);
  const x1 = Math.max(stock.min.x, stock.max.x);
  const y0 = Math.min(stock.min.y, stock.max.y);
  const y1 = Math.max(stock.min.y, stock.max.y);
  const z0 = Math.min(stock.min.z, stock.max.z);
  const z1 = Math.max(stock.min.z, stock.max.z);
  const overlaps =
    Math.max(a.x, b.x) >= x0 &&
    Math.min(a.x, b.x) <= x1 &&
    Math.max(a.y, b.y) >= y0 &&
    Math.min(a.y, b.y) <= y1 &&
    zHi >= z0 &&
    zLo <= z1;
  return overlaps && zLo < z1 - 1e-3;
}

function keepSegment(mode: ToolpathMode, a: Vec3 & { rapid: boolean }, b: Vec3 & { rapid: boolean }, stock: Trace["stock"]) {
  if (mode === "feed") return !b.rapid;
  if (mode === "cutting") return !b.rapid && cutsStock(a, b, stock);
  return true;
}

function Toolpath({
  trace,
  mode,
  dist,
  feed,
  rapid,
  cut,
}: {
  trace: Trace;
  mode: ToolpathMode;
  dist: MutableRefObject<number>;
  feed: string;
  rapid: string;
  cut: string;
}) {
  const drawn = useMemo(() => {
    if (mode === "none" || trace.points.length < 2) return null;
    const cFeed = new THREE.Color(feed);
    const cRapid = new THREE.Color(rapid);
    const cCut = new THREE.Color(cut);
    if (mode === "dots") {
      const pos = new Float32Array(trace.points.length * 3);
      const col = new Float32Array(trace.points.length * 3);
      for (let i = 0; i < trace.points.length; i++) {
        const p = trace.points[i];
        pos[i * 3] = p.x;
        pos[i * 3 + 1] = p.y;
        pos[i * 3 + 2] = p.z;
        const prev = i > 0 ? trace.points[i - 1] : p;
        const color = p.rapid ? cRapid : cutsStock(prev, p, trace.stock) ? cCut : cFeed;
        col[i * 3] = color.r;
        col[i * 3 + 1] = color.g;
        col[i * 3 + 2] = color.b;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const mat = new THREE.PointsMaterial({ vertexColors: true, size: 3.5, sizeAttenuation: false });
      return { object: new THREE.Points(geo, mat) as THREE.Object3D, base: null as Float32Array | null };
    }

    let count = 0;
    for (let i = 1; i < trace.points.length; i++) {
      const a = trace.points[i - 1];
      const b = trace.points[i];
      if (mode === "trail" || mode === "visible" || keepSegment(mode, a, b, trace.stock)) count += 1;
    }
    if (count === 0) return null;
    const pos = new Float32Array(count * 6);
    const col = new Float32Array(count * 6);
    let w = 0;
    for (let i = 1; i < trace.points.length; i++) {
      const a = trace.points[i - 1];
      const b = trace.points[i];
      if (mode !== "trail" && mode !== "visible" && !keepSegment(mode, a, b, trace.stock)) continue;
      pos[w] = a.x;
      pos[w + 1] = a.y;
      pos[w + 2] = a.z;
      pos[w + 3] = b.x;
      pos[w + 4] = b.y;
      pos[w + 5] = b.z;
      const cutting = mode !== "feed" && !b.rapid && cutsStock(a, b, trace.stock);
      const color = mode === "cutting" || cutting ? cCut : b.rapid ? cRapid : cFeed;
      col[w] = color.r;
      col[w + 1] = color.g;
      col[w + 2] = color.b;
      col[w + 3] = color.r;
      col[w + 4] = color.g;
      col[w + 5] = color.b;
      w += 6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.LineBasicMaterial({ vertexColors: true });
    const line = new THREE.LineSegments(geo, mat);
    const base = mode === "trail" ? new Float32Array(pos) : null;
    if (mode === "trail") geo.setDrawRange(0, 0);
    return { object: line as THREE.Object3D, base };
  }, [trace, mode, feed, rapid, cut]);

  useEffect(() => {
    return () => {
      const object = drawn?.object;
      if (!object) return;
      const mesh = object as THREE.Points | THREE.LineSegments;
      mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
    };
  }, [drawn]);

  const restored = useRef(-1);
  useFrame(() => {
    if (mode !== "trail" || !drawn?.base) return;
    const line = drawn.object as THREE.LineSegments;
    const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;
    const base = drawn.base;
    if (restored.current >= 0) {
      const o = restored.current * 3;
      arr[o] = base[o];
      arr[o + 1] = base[o + 1];
      arr[o + 2] = base[o + 2];
    }
    const { points, clock } = trace;
    const i = seekClock(clock, dist.current);
    let count = i * 2;
    restored.current = -1;
    if (i < points.length - 1) {
      const span = clock[i + 1] - clock[i];
      const u = span > 1e-9 ? (dist.current - clock[i]) / span : 0;
      if (u > 1e-4) {
        const a = points[i];
        const b = points[i + 1];
        const vertex = i * 2 + 1;
        pos.setXYZ(vertex, a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u);
        restored.current = vertex;
        count = (i + 1) * 2;
      }
    }
    line.geometry.setDrawRange(0, count);
    pos.needsUpdate = true;
  });

  if (!drawn) return null;
  return <primitive object={drawn.object} />;
}

function fitCutter(mesh: THREE.Mesh | null, radius: number) {
  if (!mesh || radius <= 0) return;
  const stick = Math.max(radius * 4, 20);
  mesh.scale.set(radius, stick, radius);
  mesh.position.z = stick / 2;
}

function Playback({
  trace,
  playing,
  speed,
  seek,
  dist,
  toolColor,
  onBlock,
  onPose,
  onProgress,
  onDone,
}: {
  trace: Trace;
  playing: boolean;
  speed: number;
  seek: Seek | null;
  dist: MutableRefObject<number>;
  toolColor: string;
  onBlock: (index: number) => void;
  onPose: (pose: Vec3) => void;
  onProgress: (dist: number) => void;
  onDone: () => void;
}) {
  const tool = useRef<THREE.Group>(null);
  const cutter = useRef<THREE.Mesh>(null);
  const ended = useRef(false);
  const lastBlock = useRef(-1);
  const lastHud = useRef(0);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const onBlockRef = useRef(onBlock);
  const onPoseRef = useRef(onPose);
  const onProgressRef = useRef(onProgress);
  const onDoneRef = useRef(onDone);
  playingRef.current = playing;
  speedRef.current = speed;
  onBlockRef.current = onBlock;
  onPoseRef.current = onPose;
  onProgressRef.current = onProgress;
  onDoneRef.current = onDone;

  useEffect(() => {
    dist.current = 0;
    ended.current = false;
    lastBlock.current = -1;
  }, [trace]);

  useLayoutEffect(() => {
    fitCutter(cutter.current, toolRadiusMm(trace, blockAt(trace, dist.current)));
  }, [trace, seek, dist]);

  useEffect(() => {
    if (!seek) return;
    if (seek.dist != null) dist.current = seek.dist;
    else {
      const end = trace.blockEnd[seek.block] ?? 0;
      dist.current = trace.clock[end] ?? 0;
    }
    ended.current = false;
  }, [seek, trace]);

  useEffect(() => {
    const total = trace.clock[trace.clock.length - 1] ?? 0;
    if (playing && dist.current >= total - 1e-6) {
      dist.current = 0;
      ended.current = false;
    }
  }, [playing, trace]);

  useFrame((_, dt) => {
    const total = trace.clock[trace.clock.length - 1] ?? 0;
    if (playingRef.current && total > 0) {
      dist.current += 30 * speedRef.current * dt;
      if (dist.current >= total) {
        dist.current = total;
        if (!ended.current) {
          ended.current = true;
          onDoneRef.current();
        }
      }
    }
    const pose = poseAt(trace, dist.current);
    tool.current?.position.set(pose.x, pose.y, pose.z);
    const block = blockAt(trace, dist.current);
    fitCutter(cutter.current, toolRadiusMm(trace, block));
    const now = performance.now();
    if (block !== lastBlock.current || now - lastHud.current > 80) {
      lastHud.current = now;
      if (block !== lastBlock.current) {
        lastBlock.current = block;
        onBlockRef.current(block);
      }
      onPoseRef.current(pose);
      onProgressRef.current(dist.current);
    }
  });

  return (
    <group ref={tool}>
      <mesh ref={cutter} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1, 1, 1, 32]} />
        <meshStandardMaterial color={toolColor} />
      </mesh>
    </group>
  );
}

function Scene({
  trace,
  playing,
  speed,
  seek,
  navMode,
  pathMode,
  showMaterial,
  mesh,
  isDark,
  onBlock,
  onPose,
  onProgress,
  onDone,
}: Props) {
  const theme = SCENE_THEME[isDark ? "dark" : "light"];
  const dist = useRef(0);
  const fitted = useMemo(() => (trace ? bounds(trace) : { center: { x: 0, y: 0, z: 0 }, span: 120 }), [trace]);
  const grid = Math.max(100, Math.ceil((fitted.span * 1.6) / 10) * 10);

  return (
    <>
      <color attach="background" args={[theme.background]} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[fitted.span, -fitted.span * 0.4, fitted.span * 1.4]} intensity={1.15} />
      <gridHelper
        args={[grid, 10, theme.gridCenter, theme.gridCell]}
        rotation={[-Math.PI / 2, 0, 0]}
      />
      <axesHelper args={[Math.max(20, fitted.span * 0.18)]} />
      {trace ? <StockBox trace={trace} color={theme.stock} edge={theme.stockEdge} solid={!showMaterial} /> : null}
      {trace && showMaterial ? (
        <RemovalMesh trace={trace} dist={dist} mesh={mesh} color={theme.stock} cut={theme.cut} />
      ) : null}
      {trace ? (
        <Playback
          trace={trace}
          playing={playing}
          speed={speed}
          seek={seek}
          dist={dist}
          toolColor={theme.tool}
          onBlock={onBlock}
          onPose={onPose}
          onProgress={onProgress}
          onDone={onDone}
        />
      ) : null}
      {trace ? (
        <Toolpath trace={trace} mode={pathMode} dist={dist} feed={theme.feed} rapid={theme.rapid} cut={theme.cut} />
      ) : null}
      <OrbitControls makeDefault mouseButtons={mouseButtons[navMode]} />
      <Fit center={fitted.center} span={fitted.span} />
      <GizmoHelper alignment="bottom-right" margin={[64, 64]}>
        <GizmoViewport
          axisColors={["#ef4444", "#22c55e", "#38bdf8"]}
          labelColor={theme.gizmo.textColor}
        />
      </GizmoHelper>
    </>
  );
}

function Fps({ label }: { label: MutableRefObject<HTMLSpanElement | null> }) {
  const frames = useRef(0);
  const acc = useRef(0);
  useFrame((_, dt) => {
    frames.current += 1;
    acc.current += dt;
    if (acc.current < 0.3 || !label.current) return;
    label.current.textContent = `${Math.round(frames.current / acc.current)} fps`;
    frames.current = 0;
    acc.current = 0;
  });
  return null;
}

export function PathView(props: Props) {
  const fps = useRef<HTMLSpanElement>(null);
  return (
    <div className="relative h-full min-h-0 w-full">
      <Canvas
        className="!block h-full w-full touch-none"
        camera={{ position: [140, -180, 110], up: [0, 0, 1], fov: 42, near: 0.2, far: 20000 }}
        gl={{ antialias: true }}
      >
        <Scene {...props} />
        <Fps label={fps} />
      </Canvas>
      <span ref={fps} className="sim-fps" />
    </div>
  );
}
