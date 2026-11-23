// Loading for the ready-made models and HDRIs in public/assets (see public/assets/CREDITS.md).
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';

/**
 * Where models and HDRIs are served from. Defaults to the site's own
 * /assets/ folder; set VITE_ASSET_BASE (e.g. a CDN or storage bucket URL
 * ending in '/') to host them elsewhere. Everything is fetched on demand.
 */
const ASSET_BASE: string = import.meta.env.VITE_ASSET_BASE || `${import.meta.env.BASE_URL}assets/`;
export const assetUrl = (path: string) => `${ASSET_BASE}${path}`;

const gltfLoader = new GLTFLoader();
const gltfCache = new Map<string, Promise<GLTF>>();
const texLoader = new THREE.TextureLoader();
const hdrLoader = new HDRLoader().setDataType(THREE.FloatType);

/** Loads (once) and returns a glTF; callers clone `scene` if they need more than one copy. */
export function loadGLTF(path: string): Promise<GLTF> {
  let p = gltfCache.get(path);
  if (!p) {
    p = gltfLoader.loadAsync(assetUrl(path));
    gltfCache.set(path, p);
  }
  return p;
}

export function loadTexture(path: string, srgb: boolean): Promise<THREE.Texture> {
  return texLoader.loadAsync(assetUrl(path)).then((t) => {
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

export function loadHDR(path: string): Promise<THREE.DataTexture> {
  return hdrLoader.loadAsync(assetUrl(path));
}

/** Shadows on, and no culling (skinned and re-posed meshes have stale bounds). */
export function prepareModel(root: THREE.Object3D, cast = true, receive = true) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = cast;
    m.receiveShadow = receive;
    m.frustumCulled = false;
  });
}

/** A cloned scene from a glTF, uniformly scaled so its height is `height` m, standing on y = 0. */
export async function placedModel(path: string, height?: number): Promise<THREE.Group> {
  const gltf = await loadGLTF(path);
  const inner = gltf.scene.clone(true);
  const g = new THREE.Group();
  g.add(inner);
  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const k = height ? height / size.y : 1;
  inner.scale.multiplyScalar(k);
  inner.position.set(-((box.min.x + box.max.x) / 2) * k, -box.min.y * k, -((box.min.z + box.max.z) / 2) * k);
  prepareModel(g);
  return g;
}
