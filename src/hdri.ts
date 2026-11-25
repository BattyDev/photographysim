// HDRI locations: Poly Haven panoramas (CC0) calibrated to real illuminance.
// They light the scene; what you see around the subject is a wooden set
// (dollworld.ts) chosen by the location's `kind`.
//
// On load each panorama is analysed once:
//   • the sun (if any) is cut out of the image and returned as a direction,
//     colour and illuminance, so a real shadow-casting light can replace it,
//   • pixel values are scaled to luminance in cd/m² so the horizontal
//     illuminance matches the location's target lux,
//   • a coarse grid is kept so the light meter can integrate it for any normal.
import * as THREE from 'three';
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
  /** Height of the panorama's camera above the ground (m). */
  height: number;
  /** Which wooden set stands around the subject: the studio, the dollhouse room or the park. */
  kind: 'studio' | 'room' | 'open';
  /** Rough colour temperature of the light, for the white-balance hint. */
  kelvin: number;
  blurb: string;
}

export const LOCATIONS: LocationSpec[] = [
  // Indoor light: the wooden studio or the dollhouse room stands around the subject.
  { id: 'studio_loft', label: 'Studio, window-lit', file: 'photo_studio_loft_hall_2k.hdr', lux: 250, sun: false, height: 1.6, kind: 'studio', kelvin: 4800, blurb: 'Bright studio hall with big windows: soft, mixed ambient.' },
  { id: 'workshop', label: 'Room, window light', file: 'artist_workshop_2k.hdr', lux: 600, sun: false, height: 1.5, kind: 'room', kelvin: 5800, blurb: 'Interior lit by windows: classic soft, directional window light.' },
  // A lounge in a country house: overcast daylight through a wall of windows,
  // warm lamps in the room through the arch.
  { id: 'living_room', label: 'Living room', file: 'lythwood_lounge_2k.hdr', lux: 300, sun: false, height: 1.6, kind: 'room', kelvin: 5000, blurb: 'Soft overcast light through a wall of windows, with warm lamps behind. Sofa, armchair and side tables for a family at home.' },
  { id: 'meadow', label: 'Meadow, midday', file: 'meadow_2_2k.hdr', lux: 60000, sun: true, height: 1.6, kind: 'open', kelvin: 5600, blurb: 'Hard high sun and a blue sky: the toughest light for portraits.' },
  { id: 'sunset', label: 'Sunset', file: 'venice_sunset_2k.hdr', lux: 1500, sun: true, height: 1.6, kind: 'open', kelvin: 3200, blurb: 'Low warm sun: golden-hour colour and long shadows.' },
  { id: 'park_overcast', label: 'Park, overcast', file: 'tiergarten_2k.hdr', lux: 12000, sun: false, height: 1.6, kind: 'open', kelvin: 6500, blurb: 'Park under soft sky: gentle, even, flattering light.' },
  // Added from Poly Haven (CC0). Lux is the horizontal illuminance a meter would read there.
  { id: 'field_sunrise', label: 'Field, sunrise', file: 'bloem_field_sunrise_2k.hdr', lux: 900, sun: true, height: 1.6, kind: 'open', kelvin: 3300, blurb: 'The sun right on the horizon across an open field: the classic golden-hour backlight.' },
  { id: 'courtyard', label: 'Bright sun, open shade', file: 'urban_courtyard_2k.hdr', lux: 55000, sun: true, height: 1.6, kind: 'open', kelvin: 5600, blurb: 'Bright high sun. Turn on "Subject in shade" for open shade: soft light on the face, a sunny background.' },
  { id: 'quadrangle', label: 'Midday, thin cloud', file: 'quadrangle_sunny_2k.hdr', lux: 50000, sun: true, height: 1.6, kind: 'open', kelvin: 5500, blurb: 'High sun through thin cloud: hard shadows from above. Needs fill.' },
  { id: 'beach_overcast', label: 'Overcast, under a bridge', file: 'beach_cloudy_bridge_2k.hdr', lux: 2500, sun: false, height: 1.6, kind: 'open', kelvin: 6300, blurb: 'Overcast sky, with a bridge overhead blocking the top light: soft, directional light from the open sides.' },
  { id: 'forest', label: 'Under trees', file: 'forest_slope_2k.hdr', lux: 9000, sun: false, height: 1.6, kind: 'open', kelvin: 6000, blurb: 'Under tall pines: soft green-tinted light.' },
  { id: 'street_night', label: 'Street lamps, night', file: 'cobblestone_street_night_2k.hdr', lux: 15, sun: false, height: 1.6, kind: 'open', kelvin: 2400, blurb: 'Sodium street lamps: warm and dim. Turn on the street lamps for bokeh, and bring a strobe.' },
  { id: 'rooftop_night', label: 'City glow, night', file: 'rooftop_night_2k.hdr', lux: 12, sun: false, height: 1.7, kind: 'open', kelvin: 3400, blurb: 'Dim city glow: bring your own light, and let the lights become bokeh.' },
];

export const locationSpec = (id: LocationId) => LOCATIONS.find((l) => l.id === id)!;

export const HDRI_GRID = { w: 64, h: 32 };
const GW = HDRI_GRID.w;
const GH = HDRI_GRID.h;

export interface HdriData {
  spec: LocationSpec;
  /** Panorama with the sun removed, scaled to cd/m². */
  texture: THREE.DataTexture;
  envMap: THREE.Texture;
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

/**
 * GPU copy in 16-bit half floats. The analysis needs full floats, but many
 * phones (iPhones in particular) can't filter 32-bit float textures: sampling
 * returns black, so the environment light vanishes and subjects render dark.
 * Half floats filter everywhere WebGL2 runs. Values are clamped below the
 * half-float maximum (the sun has already been cut out).
 */
function toHalfFloat(src: THREE.DataTexture): THREE.DataTexture {
  const { width, height } = src.image as { width: number; height: number };
  const f = src.image.data as Float32Array;
  const h = new Uint16Array(f.length);
  for (let i = 0; i < f.length; i++) h[i] = THREE.DataUtils.toHalfFloat(Math.min(f[i], 65000));
  const tex = new THREE.DataTexture(h, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.flipY = src.flipY;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
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
    p = loadHDR(`hdri/${spec.file}`).then((src) => {
      const a = analyse(src, spec);
      const tex = toHalfFloat(src);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      tex.colorSpace = THREE.LinearSRGBColorSpace;
      const envMap = this.pmrem.fromEquirectangular(tex).texture;
      const { brightAz, ...rest } = a;
      const data: HdriData = { spec, texture: tex, envMap, sunAzimuth: brightAz, ...rest };
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
