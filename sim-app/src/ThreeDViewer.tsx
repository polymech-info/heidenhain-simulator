import React, { Suspense, useEffect, useState, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Bounds, Center, useBounds, GizmoHelper, GizmoViewcube } from "@react-three/drei";
import {
  Loader2,
  Cuboid,
  Grid3x3,
  BoxSelect,
  MousePointer2,
  Move,
  ZoomIn,
  Maximize,
  Minimize,
  ListTree,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Lightbulb,
} from "lucide-react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";

export const SUPPORTED_EXTS = ["stl", "obj", "gltf", "glb", "ply"] as const;
export type SupportedExt = (typeof SUPPORTED_EXTS)[number];

export function extOf(fileName: string): string {
  return (fileName.split(".").pop() ?? "").toLowerCase();
}

export function isSupportedExt(ext: string): ext is SupportedExt {
  return (SUPPORTED_EXTS as readonly string[]).includes(ext);
}

function disposeModelResources(model: THREE.BufferGeometry | THREE.Object3D) {
  if (model instanceof THREE.BufferGeometry) {
    model.dispose();
    return;
  }

  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  model.traverse((child: THREE.Object3D) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry?.isBufferGeometry) geometries.add(mesh.geometry);
    const childMaterials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of childMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if ((value as THREE.Texture | undefined)?.isTexture) textures.add(value as THREE.Texture);
      }
    }
  });
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

function useModelGeometry(url: string, extension: string) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | THREE.Object3D | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const currentGeometryRef = useRef<THREE.BufferGeometry | THREE.Object3D | null>(null);

  useEffect(() => {
    const previous = currentGeometryRef.current;
    currentGeometryRef.current = geometry;
    if (previous && previous !== geometry) disposeModelResources(previous);
  }, [geometry]);

  useEffect(
    () => () => {
      if (currentGeometryRef.current) disposeModelResources(currentGeometryRef.current);
      currentGeometryRef.current = null;
    },
    [],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    setGeometry(null);

    const load = async () => {
      try {
        const ext = extension.toLowerCase();
        if (!isSupportedExt(ext)) {
          if (active) setError(`Unsupported 3D format: ${ext || "(none)"}. Use ${SUPPORTED_EXTS.join(", ")}.`);
          return;
        }

        const buf = await fetch(url, { signal: controller.signal }).then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        });
        const objectUrl = URL.createObjectURL(new Blob([buf], { type: "application/octet-stream" }));
        try {
          if (ext === "stl") {
            const geo = await new STLLoader().loadAsync(objectUrl);
            if (!active) {
              disposeModelResources(geo);
              return;
            }
            geo.computeVertexNormals();
            geo.computeBoundingBox();
            geo.computeBoundingSphere();
            if (active) setGeometry(geo);
          } else if (ext === "obj") {
            const obj = await new OBJLoader().loadAsync(objectUrl);
            if (!active) {
              disposeModelResources(obj);
              return;
            }
            obj.traverse((child: THREE.Object3D) => {
              const mesh = child as THREE.Mesh;
              if (mesh.isMesh && mesh.geometry) {
                mesh.geometry.computeVertexNormals();
                mesh.geometry.computeBoundingBox();
                mesh.geometry.computeBoundingSphere();
              }
            });
            if (active) setGeometry(obj);
          } else if (ext === "gltf" || ext === "glb") {
            const gltf = await new GLTFLoader().loadAsync(objectUrl);
            if (!active) {
              disposeModelResources(gltf.scene);
              return;
            }
            gltf.scene.traverse((child: THREE.Object3D) => {
              const mesh = child as THREE.Mesh;
              if (mesh.isMesh && mesh.geometry) {
                mesh.geometry.computeVertexNormals();
                mesh.geometry.computeBoundingBox();
                mesh.geometry.computeBoundingSphere();
              }
            });
            if (active) setGeometry(gltf.scene);
          } else {
            const geo = await new PLYLoader().loadAsync(objectUrl);
            if (!active) {
              disposeModelResources(geo);
              return;
            }
            geo.computeVertexNormals();
            geo.computeBoundingBox();
            geo.computeBoundingSphere();
            if (active) setGeometry(geo);
          }
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("3D Load Error:", err);
        if (active) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [url, extension]);

  return { geometry, error, isLoading };
}

const Headlight: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const lightRef = useRef<THREE.SpotLight>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (lightRef.current && enabled) {
      lightRef.current.position.copy(camera.position);
    }
  });

  if (!enabled) return null;

  return <spotLight ref={lightRef} intensity={2} angle={Math.PI / 4} penumbra={0.5} decay={1} distance={1000} castShadow />;
};

const ModelRenderer: React.FC<{
  geometry: THREE.BufferGeometry | THREE.Object3D | null;
  error: string | null;
  renderMode: "solid" | "wireframe" | "edges";
  hiddenNodes: Set<string>;
}> = ({ geometry, error, renderMode, hiddenNodes }) => {
  const bounds = useBounds();
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (geometry) {
      const timer = setTimeout(() => {
        bounds.refresh().clip().fit();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [geometry, bounds]);

  useEffect(() => {
    if (!geometry || !groupRef.current) return;

    const rootObj = geometry instanceof THREE.BufferGeometry ? groupRef.current : geometry;
    const spawnedEdges: THREE.LineSegments[] = [];

    rootObj.traverse((child: THREE.Object3D) => {
      if (hiddenNodes.has(child.uuid)) child.visible = false;
      else child.visible = true;

      const mesh = child as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          if ("wireframe" in material) material.wireframe = renderMode === "wireframe";
          material.needsUpdate = true;
        }

        if (renderMode === "edges") {
          const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, 30);
          const edgesMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 1 });
          const edgeLines = new THREE.LineSegments(edgesGeo, edgesMaterial);
          edgeLines.userData.isEdgeOverlay = true;
          spawnedEdges.push(edgeLines);
          edgeLines.position.copy(mesh.position);
          edgeLines.rotation.copy(mesh.rotation);
          edgeLines.scale.copy(mesh.scale);
          (mesh.parent ?? rootObj).add(edgeLines);
        }
      }
    });

    return () => {
      for (const edge of spawnedEdges) {
        edge.parent?.remove(edge);
        edge.geometry.dispose();
        const edgeMaterials = Array.isArray(edge.material) ? edge.material : [edge.material];
        edgeMaterials.forEach((material) => material.dispose());
      }
    };
  }, [geometry, renderMode, hiddenNodes]);

  if (error) {
    return (
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#ef4444" wireframe />
      </mesh>
    );
  }

  if (!geometry) return null;

  return (
    <group
      ref={groupRef}
      dispose={null}
      onDoubleClick={(e) => {
        e.stopPropagation();
        const target = e.object.userData.isEdgeOverlay && e.object.parent ? e.object.parent : e.object;
        bounds.refresh(target).clip().fit();
      }}
    >
      {geometry instanceof THREE.BufferGeometry ? (
        <mesh geometry={geometry}>
          <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.5} />
        </mesh>
      ) : (
        <primitive object={geometry} />
      )}
    </group>
  );
};

const ModelTreeNode: React.FC<{
  node: THREE.Object3D;
  depth: number;
  hiddenNodes: Set<string>;
  toggleNode: (uuid: string) => void;
}> = ({ node, depth, hiddenNodes, toggleNode }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const isHidden = hiddenNodes.has(node.uuid);
  const hasChildren = node.children?.length > 0 && !node.children.every((c) => c.userData.isEdgeOverlay);

  if (node.userData.isEdgeOverlay) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", fontSize: 12 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "4px 8px",
          paddingLeft: `${depth * 12 + 8}px`,
          borderBottom: "1px solid var(--border)",
          userSelect: "none",
        }}
      >
        <div
          onClick={() => setExpanded(!expanded)}
          style={{
            width: 16,
            height: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: hasChildren ? "pointer" : "default",
            opacity: hasChildren ? 1 : 0,
            marginRight: 4,
          }}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
        <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: isHidden ? 0.5 : 1 }}>
          {node.name || node.type}
        </div>
        <div onClick={() => toggleNode(node.uuid)} style={{ cursor: "pointer", padding: 2, opacity: isHidden ? 0.5 : 1 }}>
          {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
        </div>
      </div>
      {expanded && hasChildren
        ? node.children.map((child) => (
            <ModelTreeNode key={child.uuid} node={child} depth={depth + 1} hiddenNodes={hiddenNodes} toggleNode={toggleNode} />
          ))
        : null}
    </div>
  );
};

export type ThreeDViewerProps = {
  url: string;
  fileName?: string;
};

export function ThreeDViewer({ url, fileName = "3D Model" }: ThreeDViewerProps) {
  const [renderMode, setRenderMode] = useState<"solid" | "wireframe" | "edges">("edges");
  const [navMode, setNavMode] = useState<"orbit" | "pan" | "zoom">("orbit");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [extraLights, setExtraLights] = useState(true);
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const ext = extOf(fileName);
  const { geometry, error, isLoading } = useModelGeometry(url, ext);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    setHiddenNodes(new Set());
  }, [url]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch((err) => console.error(`Error entering fullscreen: ${err.message}`));
    } else {
      document.exitFullscreen();
    }
  };

  const toggleNode = (uuid: string) => {
    setHiddenNodes((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const toolBtn = (active: boolean): React.CSSProperties => ({
    padding: "4px 8px",
    borderRadius: 4,
    background: active ? "var(--muted)" : "transparent",
    border: "none",
    cursor: "pointer",
  });

  return (
    <div ref={containerRef} className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-transparent">
      <div
        style={{
          padding: "6px 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--border)",
          background: "var(--muted)",
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {fileName}
        </span>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, background: "var(--background)", padding: 2, borderRadius: 6 }}>
            <button onClick={() => setNavMode("orbit")} style={toolBtn(navMode === "orbit")} title="Orbit Camera">
              <MousePointer2 size={16} className={navMode === "orbit" ? "text-primary" : "text-muted-foreground"} />
            </button>
            <button onClick={() => setNavMode("pan")} style={toolBtn(navMode === "pan")} title="Pan Camera">
              <Move size={16} className={navMode === "pan" ? "text-primary" : "text-muted-foreground"} />
            </button>
            <button onClick={() => setNavMode("zoom")} style={toolBtn(navMode === "zoom")} title="Zoom Camera">
              <ZoomIn size={16} className={navMode === "zoom" ? "text-primary" : "text-muted-foreground"} />
            </button>
          </div>
          <div style={{ width: 1, height: 20, background: "var(--border)" }} />
          <div style={{ display: "flex", gap: 4, background: "var(--background)", padding: 2, borderRadius: 6 }}>
            <button onClick={() => setRenderMode("solid")} style={toolBtn(renderMode === "solid")} title="Solid Mesh">
              <Cuboid size={16} className={renderMode === "solid" ? "text-primary" : "text-muted-foreground"} />
            </button>
            <button onClick={() => setRenderMode("edges")} style={toolBtn(renderMode === "edges")} title="Faces with Edges">
              <BoxSelect size={16} className={renderMode === "edges" ? "text-primary" : "text-muted-foreground"} />
            </button>
            <button onClick={() => setRenderMode("wireframe")} style={toolBtn(renderMode === "wireframe")} title="Wireframe">
              <Grid3x3 size={16} className={renderMode === "wireframe" ? "text-primary" : "text-muted-foreground"} />
            </button>
          </div>
          <div style={{ width: 1, height: 20, background: "var(--border)" }} />
          <div style={{ display: "flex", gap: 4, background: "var(--background)", padding: 2, borderRadius: 6 }}>
            <button onClick={() => setExtraLights(!extraLights)} style={toolBtn(extraLights)} title="Toggle Headlight (Follows Camera)">
              <Lightbulb size={16} className={extraLights ? "text-primary" : "text-muted-foreground"} />
            </button>
          </div>
          <div style={{ width: 1, height: 20, background: "var(--border)" }} />
          <button
            onClick={toggleFullscreen}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              background: "var(--background)",
              border: "1px solid var(--border)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize size={16} className="text-muted-foreground" /> : <Maximize size={16} className="text-muted-foreground" />}
          </button>
          <button
            onClick={() => setShowSidebar((v) => !v)}
            style={{
              padding: "4px 8px",
              borderRadius: 6,
              background: showSidebar ? "var(--muted)" : "var(--background)",
              border: "1px solid var(--border)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: 4,
            }}
            title="Toggle Model Tree"
          >
            <ListTree size={16} className={showSidebar ? "text-primary" : "text-muted-foreground"} />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-h-0 min-w-0 flex-1">
          {isLoading ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                zIndex: 10,
                background: "rgba(0,0,0,0.05)",
              }}
            >
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="text-sm font-medium">Loading 3D Model...</span>
            </div>
          ) : null}
          {error && !isLoading ? (
            <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/70 dark:text-red-200">
                {error}
              </div>
            </div>
          ) : null}
          <Suspense
            fallback={
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Loader2 size={16} className="animate-spin" /> Loading Engine...
              </div>
            }
          >
            <Canvas className="!block h-full w-full touch-none" shadows camera={{ position: [5, 5, 5], fov: 50 }}>
              <ambientLight intensity={0.5} />
              <directionalLight position={[10, 10, 10]} intensity={1} castShadow />
              <directionalLight position={[-10, -10, -10]} intensity={0.3} />
              <Headlight enabled={extraLights} />
              <Bounds fit margin={1.5}>
                <Center>
                  <ModelRenderer geometry={geometry} error={error} renderMode={renderMode} hiddenNodes={hiddenNodes} />
                </Center>
              </Bounds>

              {navMode === "orbit" ? (
                <OrbitControls
                  makeDefault
                  enableRotate
                  enablePan
                  enableZoom
                  mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
                />
              ) : null}
              {navMode === "pan" ? (
                <OrbitControls
                  makeDefault
                  enableRotate
                  enablePan
                  enableZoom
                  mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
                />
              ) : null}
              {navMode === "zoom" ? (
                <OrbitControls
                  makeDefault
                  enableRotate
                  enablePan
                  enableZoom
                  mouseButtons={{ LEFT: THREE.MOUSE.DOLLY, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
                />
              ) : null}
              <GizmoHelper alignment="top-right" margin={[80, 72]}>
                <GizmoViewcube
                  color="#334155"
                  hoverColor="#475569"
                  textColor="#f8fafc"
                  strokeColor="#0f172a"
                  font='600 22px "Segoe UI",system-ui,sans-serif'
                />
              </GizmoHelper>
            </Canvas>
          </Suspense>
        </div>

        {showSidebar ? (
          <div
            style={{
              width: 340,
              borderLeft: "1px solid var(--border)",
              background: "var(--background)",
              display: "flex",
              flexDirection: "column",
              minWidth: 280,
            }}
          >
            <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", fontSize: 12, fontWeight: 600 }}>
              Model Browser
            </div>
            <div className="pm-scroll" style={{ overflowY: "auto", minHeight: 0 }}>
              {geometry ? (
                <ModelTreeNode
                  node={geometry instanceof THREE.BufferGeometry ? new THREE.Mesh(geometry) : geometry}
                  depth={0}
                  hiddenNodes={hiddenNodes}
                  toggleNode={toggleNode}
                />
              ) : (
                <div style={{ padding: 12, fontSize: 12, opacity: 0.75 }}>No model hierarchy available.</div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
