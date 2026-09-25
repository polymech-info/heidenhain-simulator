import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { PALLET_LENGTH_MM, TURNTABLE_HEIGHT_MM } from "@/sim/machine";
import { addPallet, loadBottomY, measureTruth } from "@/objects/generate";
import type { LoadDefinition } from "@/objects/types";

function extOf(name: string): string {
  return (name.split(".").pop() ?? "").toLowerCase();
}

async function loadObject(url: string, ext: string): Promise<THREE.Object3D> {
  if (ext === "stl") {
    const geo = await new STLLoader().loadAsync(url);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#9ca3af", roughness: 0.55, metalness: 0.2 }));
  }
  if (ext === "obj") return new OBJLoader().loadAsync(url);
  if (ext === "gltf" || ext === "glb") {
    const gltf = await new GLTFLoader().loadAsync(url);
    return gltf.scene;
  }
  if (ext === "ply") {
    const geo = await new PLYLoader().loadAsync(url);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#9ca3af", roughness: 0.55, metalness: 0.2 }));
  }
  throw new Error(`Unsupported mesh: .${ext}`);
}

/** Sit an imported mesh on a euro pallet, scaled to roughly pallet length if huge/tiny. */
export async function createLoadFromFile(file: File): Promise<LoadDefinition> {
  const url = URL.createObjectURL(file);
  try {
    const object = await loadObject(url, extOf(file.name));
    const group = new THREE.Group();
    group.name = `file:${file.name}`;
    addPallet(group);

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxXZ = Math.max(size.x, size.z, 1);
    const scale = maxXZ > PALLET_LENGTH_MM * 1.4 || maxXZ < 50 ? PALLET_LENGTH_MM / maxXZ : 1;
    object.scale.multiplyScalar(scale);
    object.updateMatrixWorld(true);
    const fitted = new THREE.Box3().setFromObject(object);
    const center = new THREE.Vector3();
    fitted.getCenter(center);
    object.position.x -= center.x;
    object.position.z -= center.z;
    object.position.y += loadBottomY() - fitted.min.y;
    group.add(object);

    return {
      id: `file:${file.name}`,
      name: file.name,
      description: "Imported mesh on pallet",
      create: () => group,
      truth: measureTruth(group, TURNTABLE_HEIGHT_MM),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
