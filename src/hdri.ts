// HDRI locations: Poly Haven panoramas (CC0) calibrated to real illuminance.
//
// On load each panorama is analysed once:
//   • the sun (if any) is cut out of the image and returned as a direction,
//     colour and illuminance, so a real shadow-casting light can replace it,
//   • pixel values are scaled to luminance in cd/m² so the horizontal
//     illuminance matches the location's target lux,
//   • a coarse grid is kept so the light meter can integrate it for any normal.
import * as THREE from 'three';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';
import { loadHDR } from './assets';
import type { LocationId } from './state';

export interface LocationSpec {
  id: LocationId;
  label: string;
  file: string;
  /** Target illuminance on a horizontal surface, sun included (lux). */
  lux: number;
  /** Cut out the sun and replace it with a directional light. */
  sun: boolean;
  /** Height of the panorama's camera above the ground (m), for the grounded projection. */
  height: number;
  radius: number;
  /** Rough colour temperature of the light, for the white-balance hint. */
  kelvin: number;
  blurb: string;
}

export const LOCATIONS: LocationSpec[] = [
  { id: 'studio_loft', label: 'Photo studio loft', file: 'photo_studio_loft_hall_2k.hdr', lux: 250, sun: false, height: 1.6, radius: 18, kelvin: 4800, blurb: 'Bright studio hall with big windows: soft, mixed ambient.' },
  { id: 'workshop', label: 'Artist workshop', file: 'artist_workshop_2k.hdr', lux: 600, sun: false, height: 1.5, radius: 12, kelvin: 5800, blurb: 'Interior lit by windows: classic soft, directional window light.' },
  { id: 'meadow', label: 'Meadow, midday', file: 'meadow_2_2k.hdr', lux: 60000, sun: true, height: 1.6, radius: 80, kelvin: 5600, blurb: 'Hard high sun and a blue sky: the toughest light for portraits.' },
  { id: 'sunset', label: 'Venice, sunset', file: 'venice_sunset_2k.hdr', lux: 1500, sun: true, height: 1.6, radius: 60, kelvin: 3200, blurb: 'Low warm sun skimming the water: golden-hour colour and long shadows.' },
  { id: 'park_overcast', label: 'Tiergarten park', file: 'tiergarten_2k.hdr', lux: 12000, sun: false, height: 1.6, radius: 60, kelvin: 6500, blurb: 'Park under soft sky: gentle, even, flattering light.' },
  { id: 'rooftop_night', label: 'City rooftop, night', file: 'rooftop_night_2k.hdr', lux: 12, sun: false, height: 1.7, radius: 40, kelvin: 3400, blurb: 'Dim city glow: bring your own light, and let the lights become bokeh.' },
];

export const locationSpec = (id: LocationId) => LOCATIONS.find((l) => l.id === id)!;

const GW = 64;
const GH = 32;

export interface HdriData {
  spec: LocationSpec;
  /** Panorama with the sun removed, scaled to cd/m². */
  texture: THREE.DataTexture;
  envMap: THREE.Texture;
  skybox: GroundedSkybox;
  /** Sun direction in panorama space (unit), or null. */
  sunDir: THREE.Vector3 | null;
  /** Sun illuminance on a surface facing it (lux) and its linear colour (luminance 1). */
  sunE: number;
  sunColor: THREE.Color;
  /** Azimuth of the sun, or of the brightest side when there is none (deg, 0 = +z, + = +x). */
  sunAzimuth: number;
  /** Coarse grid: per cell direction and luminance·dω. */
  grid: { dir: THREE.Vector3; e: number }[];
}

function dirOf(u: number, v: number, out = new THREE.Vector3()): THREE.Vector3 {
  // three.js equirect convention: u = atan(z, x)/2π + 0.5, v = asin(y)/π + 0.5.
  const phi = (u - 0.5) * 2 * Math.PI;
  const lat = (v - 0.5) * Math.PI;
  return out.set(Math.cos(lat) * Math.cos(phi), Math.sin(lat), Math.cos(lat) * Math.sin(phi));
}

function analyse(tex: THREE.DataTexture, spec: LocationSpec) {
  const { width: W, height: H } = tex.image as { width: number; height: number };
  const data = tex.image.data as Float32Array;
  const flip = tex.flipY;
  const lum = new Float32Array(W * H);
  const dw = new Float32Array(H);
  const vOf = (row: number) => (flip ? 1 - (row + 0.5) / H : (row + 0.5) / H);
  for (let r = 0; r < H; r++) dw[r] = ((2 * Math.PI) / W) * (Math.PI / H) * Math.cos((vOf(r) - 0.5) * Math.PI);
  let peak = 0;
  let peakIdx = 0;
  for (let i = 0; i < W * H; i++) {
    const l = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
    lum[i] = l;
    if (l > peak) {
      peak = l;
      peakIdx = i;
    }
  }
  const d = new THREE.Vector3();
  let sunDir: THREE.Vector3 | null = null;
  let sunE = 0;
  const sunColor = new THREE.Color(1, 1, 1);
  if (spec.sun) {
    const pr = Math.floor(peakIdx / W);
    sunDir = dirOf((peakIdx % W + 0.5) / W, vOf(pr));
    const capCos = Math.cos(THREE.MathUtils.degToRad(6));
    // Ring just outside the disc gives the sky value to patch the hole with.
    let ringSum = 0;
    let ringN = 0;
    const inSun: number[] = [];
    for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
        const i = r * W + c;
        const cos = dirOf((c + 0.5) / W, vOf(r), d).dot(sunDir);
        if (cos > capCos && lum[i] > 0.01 * peak) inSun.push(i);
        else if (cos > Math.cos(THREE.MathUtils.degToRad(9)) && cos <= capCos) {
          ringSum += lum[i];
          ringN++;
        }
      }
    }
    const fill = ringN ? ringSum / ringN : 0;
    let cr = 0;
    let cg = 0;
    let cb = 0;
    for (const i of inSun) {
      const w = dw[Math.floor(i / W)];
      const k = lum[i] > 0 ? Math.max(0, lum[i] - fill) / lum[i] : 0;
      cr += data[i * 4] * k * w;
      cg += data[i * 4 + 1] * k * w;
      cb += data[i * 4 + 2] * k * w;
      const s = lum[i] > 0 ? Math.min(1, fill / lum[i]) : 0;
      data[i * 4] *= s;
      data[i * 4 + 1] *= s;
      data[i * 4 + 2] *= s;
      lum[i] *= s;
    }
    sunE = 0.2126 * cr + 0.7152 * cg + 0.0722 * cb;
    if (sunE > 0) sunColor.setRGB(cr / sunE, cg / sunE, cb / sunE, THREE.LinearSRGBColorSpace);
  }
  // Horizontal illuminance of what is left, then the scale to real units.
  let skyEh = 0;
  for (let r = 0; r < H; r++) {
    const y = Math.sin((vOf(r) - 0.5) * Math.PI);
    if (y <= 0) continue;
    let rowSum = 0;
    for (let c = 0; c < W; c++) rowSum += lum[r * W + c];
    skyEh += rowSum * y * dw[r];
  }
  const totalEh = skyEh + sunE * Math.max(0, sunDir?.y ?? 0);
  const k = spec.lux / Math.max(totalEh, 1e-9);
  for (let i = 0; i < W * H * 4; i++) if ((i & 3) !== 3) data[i] *= k;
  sunE *= k;
  // Coarse grid for metering.
  const grid: { dir: THREE.Vector3; e: number }[] = [];
  const bw = W / GW;
  const bh = H / GH;
  for (let gr = 0; gr < GH; gr++) {
    for (let gc = 0; gc < GW; gc++) {
      let e = 0;
      for (let r = gr * bh; r < (gr + 1) * bh; r++) for (let c = gc * bw; c < (gc + 1) * bw; c++) e += lum[r * W + c] * dw[r];
      const rMid = (gr + 0.5) * bh - 0.5;
      grid.push({ dir: dirOf((gc + 0.5) / GW, vOf(rMid)), e: e * k });
    }
  }
  tex.needsUpdate = true;
  // Without a sun, the brightest side (e.g. the window wall) stands in for it.
  let brightAz = 0;
  if (sunDir) brightAz = THREE.MathUtils.radToDeg(Math.atan2(sunDir.x, sunDir.z));
  else {
    let best = -1;
    for (let a = -180; a < 180; a += 5) {
      const r = THREE.MathUtils.degToRad(a);
      const n = new THREE.Vector3(Math.sin(r), 0, Math.cos(r));
      let e = 0;
      for (const g of grid) e += g.e * Math.max(0, g.dir.dot(n));
      if (e > best) {
        best = e;
        brightAz = a;
      }
    }
  }
  return { sunDir, sunE, sunColor, grid, brightAz };
}

export class HdriLibrary {
  private cache = new Map<LocationId, Promise<HdriData>>();
  private ready = new Map<LocationId, HdriData>();
  private pmrem: THREE.PMREMGenerator;

  constructor(renderer: THREE.WebGLRenderer) {
    this.pmrem = new THREE.PMREMGenerator(renderer);
  }

  get(id: LocationId): HdriData | undefined {
    return this.ready.get(id);
  }

  load(id: LocationId): Promise<HdriData> {
    let p = this.cache.get(id);
    if (p) return p;
    const spec = locationSpec(id);
    p = loadHDR(`hdri/${spec.file}`).then((tex) => {
      const a = analyse(tex, spec);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.LinearSRGBColorSpace;
      const envMap = this.pmrem.fromEquirectangular(tex).texture;
      const skybox = new GroundedSkybox(tex, spec.height, spec.radius);
      skybox.position.y = spec.height - 0.01;
      // Write depth so the ground near the subject is blurred by its real distance.
      skybox.material.depthWrite = true;
      skybox.renderOrder = -10;
      const { brightAz, ...rest } = a;
      const data: HdriData = { spec, texture: tex, envMap, skybox, sunAzimuth: brightAz, ...rest };
      this.ready.set(id, data);
      return data;
    });
    this.cache.set(id, p);
    return p;
  }

  /**
   * Illuminance (lux) from the panorama (sun excluded) on a surface with the
   * given world normal, with the panorama rotated by `rotY` radians.
   */
  static irradiance(h: HdriData, normal: THREE.Vector3, rotY: number): number {
    const n = normal.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -rotY);
    let e = 0;
    for (const g of h.grid) {
      const c = g.dir.dot(n);
      if (c > 0) e += g.e * c;
    }
    return e;
  }
}
