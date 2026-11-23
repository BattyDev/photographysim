// Studio, open-sky and HDRI-location environments, the daylight model, and depth props.
import * as THREE from 'three';
import { placedModel } from './assets';
import { HdriLibrary, type HdriData } from './hdri';
import { kelvinToRGB, srgbToLinear } from './photo';
import type { SimState, Weather } from './state';
import { loadFigure, type Figure } from './subject';

/** Exposure context shared by everything that emits or reflects light. */
export interface Exposure {
  /** Scene-luminance → pixel scale. */
  X: number;
  /** Shutter time applied to continuous light (s). */
  t: number;
  /** Fraction of strobe light recorded (drops above sync speed). */
  strobe: number;
}

export interface Daylight {
  /** Unit vector pointing toward the sun. */
  sunDir: THREE.Vector3;
  elevation: number; // deg
  sunE: number; // lux on a surface facing the sun
  skyE: number; // lux on a horizontal surface from the sky
  groundE: number; // lux reflected up by the ground
  sunK: number;
  skyK: number;
  /** Angular size used for shadow softness (rad). */
  sunSoftness: number;
}

const lerp = THREE.MathUtils.lerp;
const smooth = THREE.MathUtils.smoothstep;
const D = THREE.MathUtils.degToRad;

/** Linear RGB of a colour temperature, normalised to luminance 1. */
export function kelvinLinear(k: number, out = new THREE.Color()): THREE.Color {
  const [r, g, b] = kelvinToRGB(k).map(srgbToLinear);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return out.setRGB(r / lum, g / lum, b / lum, THREE.LinearSRGBColorSpace);
}

export function sunElevation(time: number): number {
  // Sunrise ~6:00, sunset ~18:00, 62° at solar noon.
  return 62 * Math.sin((Math.PI * (time - 6)) / 12);
}

export function daylight(env: SimState['env']): Daylight {
  const el = sunElevation(env.time);
  const az = D(env.sunAzimuth);
  const elr = D(el);
  const sunDir = new THREE.Vector3(Math.sin(az) * Math.cos(elr), Math.sin(elr), Math.cos(az) * Math.cos(elr));
  const s = Math.max(Math.sin(elr), 0.002);
  let sunE = el > 0 ? 120000 * Math.pow(s, 0.6) * Math.exp(-0.1 / s) : 0;
  sunE *= smooth(el, -0.5, 1.5);
  // Twilight: ~400 lux at sunset, ~30 at −4°, ~8 at the end of civil twilight (−6°).
  let skyE = el > 0 ? 400 + 25000 * Math.pow(s, 0.8) : Math.max(0.08, 400 * Math.pow(10, el / 3.6));
  const sunK = el <= 0 ? 2000 : el < 6 ? lerp(2300, 3300, el / 6) : el < 20 ? lerp(3300, 4600, (el - 6) / 14) : el < 45 ? lerp(4600, 5500, (el - 20) / 25) : 5600;
  let skyK = el > 8 ? 11000 : el > -1 ? 8000 : 14000;
  let sunSoftness = 0.012;
  const w: Weather = env.weather;
  if (w === 'hazy') {
    sunE *= 0.5;
    skyE *= 1.35;
    sunSoftness = 0.09;
    skyK = 8000;
  } else if (w === 'overcast') {
    skyE = 0.22 * (sunE + skyE) + 0.4 * skyE;
    sunE = 0;
    skyK = 6800;
  } else if (w === 'shade') {
    sunE = 0;
    skyE *= 0.6;
    skyK = Math.max(skyK, 12000);
  }
  const groundE = 0.18 * (sunE * Math.max(0, Math.sin(elr)) + skyE);
  return { sunDir, elevation: el, sunE, skyE, groundE, sunK, skyK, sunSoftness };
}

// ------------------------------------------------------------------ sky

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position, 1.0)).xyz, 1.0);
  gl_Position = p.xyww;
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 glow;
uniform vec3 ground;
uniform vec3 sunDir;
uniform vec3 sunDisc;
uniform float glowPower;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -1.0, 1.0);
  vec3 sky = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.55));
  float sd = max(dot(d, sunDir), 0.0);
  float nearHorizon = 1.0 - smoothstep(0.0, 0.5, h);
  sky += glow * pow(sd, glowPower) * (0.35 + 0.65 * nearHorizon);
  sky += sunDisc * smoothstep(0.99996, 0.99999, sd);
  vec3 col = h < 0.0 ? mix(horizon * 0.6, ground, smoothstep(0.0, -0.08, h)) : sky;
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------- helpers

function noiseTexture(base: string, spread: number, size = 256, blades = false): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const col = new THREE.Color(base);
  for (let i = 0; i < size * size * 0.35; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const k = 1 + (Math.random() - 0.5) * spread;
    g.fillStyle = `rgb(${(col.r * 255 * k) | 0},${(col.g * 255 * k) | 0},${(col.b * 255 * k) | 0})`;
    if (blades) g.fillRect(x, y, 1, 2 + Math.random() * 3);
    else g.fillRect(x, y, 1.5, 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Seamless cyclorama: floor sweeping up into a back wall. */
function cycloramaGeometry(width = 9, depth = 9, height = 4.5, radius = 1.4): THREE.BufferGeometry {
  const profile: [number, number][] = [];
  profile.push([depth, 0]);
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    profile.push([radius - Math.sin(a) * radius, radius - Math.cos(a) * radius]);
  }
  profile.push([-0.0001, height]);
  // profile: [z, y] with z relative to the wall plane (wall at z=0, floor extends +z)
  const cols = 2;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let p = 0; p < profile.length; p++) {
    for (let c = 0; c <= cols; c++) {
      const x = (c / cols - 0.5) * width;
      positions.push(x, profile[p][1], profile[p][0] - radius + radius);
    }
  }
  for (let p = 0; p < profile.length - 1; p++) {
    for (let c = 0; c < cols; c++) {
      const a = p * (cols + 1) + c;
      const b = a + cols + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ------------------------------------------------------------------ world

/** Kenney Nature Kit trees used to dress the open-sky scene: [file, min scale, max scale]. */
const TREES: [string, number, number][] = [
  ['tree_oak', 4.5, 7],
  ['tree_default', 3.5, 5.5],
  ['tree_detailed', 4.5, 7],
  ['tree_fat', 4.5, 6.5],
  ['tree_tall', 4, 6],
];

export interface LocationInfo {
  sunElevation: number | null;
  sunKelvin: number;
  lux: number;
}

export class World {
  readonly studio = new THREE.Group();
  readonly outdoor = new THREE.Group();
  readonly location = new THREE.Group();
  readonly props = new THREE.Group();
  readonly sun = new THREE.DirectionalLight('#ffffff', 0);
  readonly hemi = new THREE.HemisphereLight('#ffffff', '#ffffff', 1);
  readonly sky: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  readonly backdropMat = new THREE.MeshStandardMaterial({ color: '#7a7a7a', roughness: 0.95 });
  private cyc: THREE.Mesh;
  private plant = new THREE.Group();
  private figure: Figure | null = null;
  private lamps = new THREE.Group();
  private lampBulbs: THREE.MeshStandardMaterial[] = [];
  private shadowCatcher: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;
  private skybox: THREE.Object3D | null = null;
  readonly hdri: HdriLibrary;
  private locInfo: LocationInfo | null = null;
  /** Asset groups already requested, so each is fetched only when first needed. */
  private requested = new Set<string>();
  private locSunDir: THREE.Vector3 | null = null;
  private bulbs: THREE.InstancedMesh;
  private bulbMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  private bulbsStudio: THREE.Matrix4[] = [];
  private bulbsOutdoor: THREE.Matrix4[] = [];
  private posts: THREE.Group;
  private cable: THREE.Line;
  private daylightCache: Daylight | null = null;

  constructor(
    private scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    private onAssetLoaded: () => void,
  ) {
    scene.add(this.studio, this.outdoor, this.location, this.props, this.hemi, this.sun, this.sun.target);
    this.hdri = new HdriLibrary(renderer);

    // Sky dome (follows the camera, always behind everything).
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(1, 48, 24),
      new THREE.ShaderMaterial({
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          zenith: { value: new THREE.Color() },
          horizon: { value: new THREE.Color() },
          glow: { value: new THREE.Color() },
          ground: { value: new THREE.Color() },
          sunDir: { value: new THREE.Vector3(0, 1, 0) },
          sunDisc: { value: new THREE.Color() },
          glowPower: { value: 6 },
        },
      }),
    );
    this.sky.scale.setScalar(500);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.outdoor.add(this.sky);

    // Studio cyclorama.
    this.cyc = new THREE.Mesh(cycloramaGeometry(), this.backdropMat);
    this.cyc.receiveShadow = true;
    this.studio.add(this.cyc);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: '#2a2826', roughness: 0.9 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.002;
    floor.receiveShadow = true;
    this.studio.add(floor);

    // Outdoor ground, path, hedge, trees.
    const grassTex = noiseTexture('#3d5a2a', 0.6, 256, true);
    grassTex.repeat.set(160, 160);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.95 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.outdoor.add(ground);
    const pathTex = noiseTexture('#9c9284', 0.35, 256);
    pathTex.repeat.set(2, 40);
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 90),
      new THREE.MeshStandardMaterial({ map: pathTex, roughness: 0.95 }),
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0.3, 0.004, -40);
    path.receiveShadow = true;
    this.outdoor.add(path);
    // Ground shadows for HDRI locations (the panorama's floor can't receive them).
    this.shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.5 }));
    this.shadowCatcher.rotation.x = -Math.PI / 2;
    this.shadowCatcher.position.y = 0.002;
    this.shadowCatcher.receiveShadow = true;
    this.location.add(this.shadowCatcher);

    // Sun.
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -7;
    sc.right = sc.top = 7;
    sc.near = 1;
    sc.far = 80;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;

    // Props (loaded the first time they are switched on).
    this.plant.position.set(-0.62, 0, 1.25);
    this.props.add(this.plant);
    this.lamps.visible = false;
    this.props.add(this.lamps);

    // String lights for bokeh.
    const bulbGeo = new THREE.SphereGeometry(0.022, 10, 8);
    this.bulbs = new THREE.InstancedMesh(bulbGeo, this.bulbMat, 40);
    this.bulbs.frustumCulled = false;
    this.props.add(this.bulbs);
    const catenary = (x0: number, x1: number, y: number, sag: number, z: number, n: number, out: THREE.Matrix4[]) => {
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const x = lerp(x0, x1, u);
        const yy = y - sag * 4 * u * (1 - u) - 0.03;
        out.push(new THREE.Matrix4().makeTranslation(x, yy, z + Math.sin(i * 1.7) * 0.15));
      }
    };
    catenary(-3, 3, 2.4, 0.5, 0, 20, this.bulbsStudio);
    catenary(-5, 0.5, 2.6, 0.55, -7, 20, this.bulbsOutdoor);
    catenary(0.5, 6, 2.6, 0.5, -7.5, 20, this.bulbsOutdoor);
    this.posts = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: '#3b3127', roughness: 0.8 });
    for (const [x, z] of [[-5, -7], [0.5, -7.25], [6, -7.5]] as const) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.7, 10), postMat);
      post.position.set(x, 1.35, z);
      post.castShadow = true;
      this.posts.add(post);
    }
    this.props.add(this.posts);
    this.cable = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#111111' }));
    this.props.add(this.cable);
  }

  get daylightInfo(): Daylight | null {
    return this.daylightCache;
  }

  /** Sun and light level for the HDRI location, once it has loaded. */
  get locationInfo(): LocationInfo | null {
    return this.locInfo;
  }

  /** Direction toward the sun in the current scene, for the diagram. */
  sunDirection(): THREE.Vector3 | null {
    return this.daylightCache?.sunDir ?? this.locSunDir;
  }

  /** Run `load` the first time `key` is needed. */
  private need(key: string, load: () => Promise<unknown>) {
    if (this.requested.has(key)) return;
    this.requested.add(key);
    load().then(() => this.onAssetLoaded());
  }

  private loadPlant() {
    return placedModel('models/polyhaven/potted_plant_02/potted_plant_02_1k.gltf', 1.25).then((plant) => {
      plant.rotation.y = 0.6;
      this.plant.add(plant);
    });
  }

  private loadBackgroundFigure() {
    return loadFigure().then((f) => {
      f.setPose('crossed');
      f.root.rotation.y = THREE.MathUtils.degToRad(-25);
      this.figure = f;
      this.props.add(f.root);
    });
  }

  private loadLamps() {
    const spots = [[-4.2, -11, 0.4], [4.8, -15, -0.3], [-1.5, -22, 0.2]] as const;
    return Promise.all(
      spots.map(([x, z, ry]) =>
        placedModel('models/polyhaven/street_lamp_01/street_lamp_01_1k.gltf').then((lamp) => {
          lamp.position.set(x, 0, z);
          lamp.rotation.y = ry;
          lamp.traverse((o) => {
            const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
            if (m && /bulb|glass/.test(m.name) && !this.lampBulbs.includes(m)) {
              m.emissive.set('#ffffff');
              m.emissiveMap = m.map;
              this.lampBulbs.push(m);
            }
          });
          this.lamps.add(lamp);
        }),
      ),
    );
  }

  private async dressOutdoor() {
    let seed = 42;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const trees = await Promise.all(TREES.map(([f]) => placedModel(`models/kenney/${f}.glb`)));
    const bushes = await Promise.all(['plant_bushLarge', 'plant_bushDetailed'].map((f) => placedModel(`models/kenney/${f}.glb`)));
    const place = (src: THREE.Group, x: number, z: number, scale: number) => {
      const o = src.clone(true);
      o.scale.setScalar(scale);
      o.position.set(x, 0, z);
      o.rotation.y = rand() * Math.PI * 2;
      this.outdoor.add(o);
    };
    // Hedge rows either side of the path.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) place(bushes[i % 2], side * (2.4 + i * 1.0 + rand() * 0.2), -9 + (rand() - 0.5) * 0.4, 3.2 + rand() * 0.8);
    }
    for (let i = 0; i < 46; i++) {
      const z = -11 - rand() * 70;
      let x = (rand() - 0.5) * (30 + -z * 1.4);
      if (Math.abs(x) < 2.5) x += Math.sign(x || 1) * 3;
      const k = Math.floor(rand() * TREES.length);
      place(trees[k], x, z, THREE.MathUtils.lerp(TREES[k][1], TREES[k][2], rand()));
    }
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      const k = Math.floor(rand() * TREES.length);
      place(trees[k], side * (9 + rand() * 18), 2 - rand() * 12, THREE.MathUtils.lerp(TREES[k][1], TREES[k][2], rand()));
    }
  }

  /** Panorama rotation (rad) that puts the location's sun at the chosen azimuth. */
  private locationRotation(s: SimState, h: HdriData): number {
    return THREE.MathUtils.degToRad(s.env.sunAzimuth - h.sunAzimuth);
  }

  /** Ambient (non-strobe) illuminance in lux on a surface at the face with normal n. */
  ambientIlluminance(s: SimState, n: THREE.Vector3): number {
    const w = 0.5 + 0.5 * n.y; // hemisphere weighting for the meter dome
    if (s.env.mode === 'outdoor') {
      const dl = daylight(s.env);
      return dl.sunE * Math.max(0, n.dot(dl.sunDir)) + dl.skyE * w + dl.groundE * (1 - w);
    }
    if (s.env.mode === 'location') {
      const h = this.hdri.get(s.env.location);
      if (!h) return 1000;
      const rot = this.locationRotation(s, h);
      let e = HdriLibrary.irradiance(h, n, rot);
      if (h.sunDir) e += h.sunE * Math.max(0, n.dot(h.sunDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rot)));
      return e;
    }
    const room = this.hdri.get('studio_loft');
    if (room) return (HdriLibrary.irradiance(room, n, 0) * s.env.ambient) / room.spec.lux;
    return s.env.ambient * (w + 0.35 * (1 - w));
  }

  /** Z position of the studio backdrop wall. */
  backdropZ(s: SimState): number {
    return -s.subject.backgroundDistance;
  }

  update(s: SimState, ex: Exposure, camera: THREE.Camera) {
    const mode = s.env.mode;
    const outdoor = mode === 'outdoor';
    this.studio.visible = mode === 'studio';
    this.outdoor.visible = outdoor;
    this.location.visible = mode === 'location';
    const cont = ex.X * ex.t;
    const bgZ = this.backdropZ(s);
    this.scene.environment = null;
    this.locInfo = null;
    this.locSunDir = null;

    if (mode === 'studio') this.need('studio_loft', () => this.hdri.load('studio_loft'));
    if (outdoor) this.need('outdoor', () => this.dressOutdoor());
    if (s.subject.foregroundProp) this.need('plant', () => this.loadPlant());
    if (s.subject.backgroundFigure) this.need('figure', () => this.loadBackgroundFigure());
    if (s.subject.bokehLights && mode !== 'studio') this.need('lamps', () => this.loadLamps());

    if (mode === 'studio') {
      this.daylightCache = null;
      this.cyc.position.z = bgZ;
      this.backdropMat.color.set(s.env.backdrop);
      this.sun.visible = false;
      this.sun.castShadow = false;
      const room = this.hdri.get('studio_loft');
      if (room) {
        this.scene.environment = room.envMap;
        this.scene.environmentIntensity = (s.env.ambient / room.spec.lux) * cont;
        this.scene.environmentRotation.set(0, 0, 0);
        this.hemi.intensity = 0;
      } else {
        this.hemi.intensity = 1;
        const amb = kelvinLinear(4500).multiplyScalar(s.env.ambient * cont);
        this.hemi.color.copy(amb);
        this.hemi.groundColor.copy(amb).multiplyScalar(0.35);
      }
      this.scene.background = new THREE.Color(0.0008 * Math.min(1, s.env.ambient * cont * 50), 0.0008, 0.0008);
      this.scene.fog = null;
    } else if (mode === 'location') {
      this.daylightCache = null;
      this.scene.fog = null;
      this.hemi.intensity = 0;
      const h = this.hdri.get(s.env.location);
      if (!h) {
        this.need(`loc:${s.env.location}`, () => this.hdri.load(s.env.location));
        this.scene.background = new THREE.Color(0.02, 0.02, 0.025);
        this.sun.visible = false;
        this.sun.castShadow = false;
        if (this.skybox) this.skybox.visible = false;
      } else {
        const rot = this.locationRotation(s, h);
        if (this.skybox !== h.skybox) {
          if (this.skybox) this.location.remove(this.skybox);
          this.skybox = h.skybox;
          this.location.add(h.skybox);
        }
        h.skybox.visible = true;
        h.skybox.rotation.y = rot;
        h.skybox.material.color.setScalar(cont);
        this.scene.background = null;
        this.scene.environment = h.envMap;
        this.scene.environmentIntensity = cont;
        this.scene.environmentRotation.set(0, rot, 0);
        const hasSun = !!h.sunDir && h.sunE > 0;
        this.sun.visible = hasSun;
        this.sun.castShadow = hasSun;
        let sunGround = 0;
        if (hasSun) {
          const dir = h.sunDir!.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
          this.sun.color.copy(h.sunColor);
          this.sun.intensity = h.sunE * cont;
          this.sun.position.copy(dir).multiplyScalar(40).add(new THREE.Vector3(0, 1, -1));
          this.sun.target.position.set(0, 1, -1);
          this.sun.shadow.radius = Math.max(1, (0.012 * 0.5) / (14 / 2048));
          sunGround = h.sunE * Math.max(0, dir.y);
          this.locSunDir = dir;
        }
        const skyGround = HdriLibrary.irradiance(h, new THREE.Vector3(0, 1, 0), rot);
        // Fraction of the ground's light a shadow removes (sun shadows), or a soft default for strobes.
        this.shadowCatcher.material.opacity = hasSun ? (0.85 * sunGround) / (sunGround + skyGround) : 0.45;
        const el = h.sunDir ? THREE.MathUtils.radToDeg(Math.asin(h.sunDir.y)) : null;
        this.locInfo = { sunElevation: el, sunKelvin: h.spec.kelvin, lux: h.spec.lux };
      }
    } else {
      this.hemi.intensity = 1;
      const dl = daylight(s.env);
      this.daylightCache = dl;
      this.scene.background = null;
      this.sun.visible = dl.sunE > 0;
      this.sun.castShadow = dl.sunE > 0;
      kelvinLinear(dl.sunK, this.sun.color);
      this.sun.intensity = dl.sunE * cont;
      this.sun.position.copy(dl.sunDir).multiplyScalar(40).add(new THREE.Vector3(0, 1, -1));
      this.sun.target.position.set(0, 1, -1);
      // Sun penumbra ~0.5 m behind the occluder, in shadow-map texels (14 m / 2048).
      this.sun.shadow.radius = Math.max(1, (dl.sunSoftness * 0.5) / (14 / 2048));
      const skyCol = kelvinLinear(dl.skyK);
      this.hemi.color.copy(skyCol).multiplyScalar(dl.skyE * cont);
      this.hemi.groundColor.setRGB(0.55, 0.62, 0.42).multiplyScalar(dl.groundE * cont);

      // Sky appearance, normalised so a uniform sky of luminance L gives E = πL.
      const L = (dl.skyE / Math.PI) * cont;
      const u = this.sky.material.uniforms;
      const el = dl.elevation;
      const day = smooth(el, -2, 12);
      const golden = smooth(el, 22, 2) * smooth(el, -5, 1);
      const zen = new THREE.Color(0.1, 0.18, 0.55).lerp(new THREE.Color(0.32, 0.52, 1.0), day);
      const hor = new THREE.Color(0.5, 0.46, 0.66).lerp(new THREE.Color(1.15, 1.2, 1.3), day);
      hor.lerp(new THREE.Color(1.4, 0.95, 0.7), golden * 0.6);
      if (el < -6) {
        const n = smooth(el, -6, -14);
        zen.lerp(new THREE.Color(0.05, 0.07, 0.16), n);
        hor.lerp(new THREE.Color(0.14, 0.12, 0.16), n);
      }
      let glowAmt = (0.5 + golden * 2.5) * smooth(el, -9, -2);
      if (s.env.weather === 'overcast') {
        zen.setRGB(1.05, 1.07, 1.1);
        hor.setRGB(0.85, 0.87, 0.9);
        glowAmt = 0.05;
      } else if (s.env.weather === 'hazy') {
        zen.lerp(new THREE.Color(0.8, 0.85, 0.95), 0.5);
        hor.lerp(new THREE.Color(1.2, 1.15, 1.1), 0.5);
      }
      u.zenith.value.copy(zen).multiplyScalar(L);
      u.horizon.value.copy(hor).multiplyScalar(L);
      u.glow.value.copy(kelvinLinear(Math.min(dl.sunK, 4000))).multiplyScalar(L * glowAmt);
      u.ground.value.setRGB(0.1, 0.12, 0.08).multiplyScalar(L);
      u.sunDir.value.copy(dl.sunDir);
      const discVisible = s.env.weather === 'overcast' ? 0 : smooth(el, -1, 0.5);
      u.sunDisc.value.copy(kelvinLinear(dl.sunK)).multiplyScalar(dl.sunE * cont * 30 * discVisible);
      u.glowPower.value = s.env.weather === 'hazy' ? 3 : 6;
      this.sky.position.copy(camera.position);

      if (s.env.haze || s.env.weather === 'hazy') {
        const fogCol = hor.clone().multiplyScalar(L * 0.9);
        this.scene.fog = new THREE.FogExp2(fogCol, s.env.weather === 'hazy' ? 0.03 : 0.018);
      } else {
        this.scene.fog = null;
      }
    }
    this.sky.material.fog = false;

    // Props.
    const open = mode !== 'studio';
    this.plant.visible = s.subject.foregroundProp;
    if (this.figure) {
      this.figure.root.visible = s.subject.backgroundFigure;
      if (open) this.figure.root.position.set(1.2, 0, -4.5);
      else this.figure.root.position.set(0.85, 0, Math.max(bgZ + 0.6, -2.6));
    }
    this.lamps.visible = s.subject.bokehLights && open;
    // Street-lamp globes: ~8,000 cd/m².
    for (const m of this.lampBulbs) {
      kelvinLinear(2700, m.emissive);
      m.emissiveIntensity = 8000 * cont;
    }

    const bulbs = open ? this.bulbsOutdoor : this.bulbsStudio;
    this.bulbs.visible = s.subject.bokehLights;
    this.posts.visible = s.subject.bokehLights && open;
    this.cable.visible = s.subject.bokehLights;
    this.bulbs.count = bulbs.length;
    const zOff = open ? 0 : bgZ + 0.35;
    const m = new THREE.Matrix4();
    const pts: THREE.Vector3[] = [];
    bulbs.forEach((mat, i) => {
      m.copy(mat);
      m.elements[14] += zOff;
      this.bulbs.setMatrixAt(i, m);
      pts.push(new THREE.Vector3().setFromMatrixPosition(m).add(new THREE.Vector3(0, 0.03, 0)));
    });
    this.bulbs.instanceMatrix.needsUpdate = true;
    this.cable.geometry.setFromPoints(pts);
    // Small incandescent bulbs: ~15,000 cd/m².
    kelvinLinear(2600, this.bulbMat.color).multiplyScalar(15000 * cont);
  }

  /** Meshes that can be double-clicked to set focus. */
  focusTargets(): THREE.Object3D[] {
    return [this.studio, this.outdoor, this.location, this.props];
  }
}

