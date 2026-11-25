// Studio, open-sky and HDRI-location environments, the daylight model, and depth props.
import * as THREE from 'three';
import { Backdrop, MAX_BACKDROP_DISTANCE, paperWidth } from './backdrop';
import { HdriLibrary, locationSpec, type HdriData } from './hdri';
import { kelvinToRGB, srgbToLinear } from './photo';
import type { LocationId, SimState, Weather } from './state';
import { loadFigure, type Poseable } from './subject';
import * as wood from './woodwork';

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

// ------------------------------------------------------------------ world

/**
 * Where the studio's room sits around the backdrop. The photo studio loft is
 * turned square to the set (−15° undoes its measured yaw) and moved so its
 * back wall stands just behind the paper stands. `back` and `cx` are its back
 * wall and centre line in that turned frame.
 */
const STUDIO_ROOM = { rot: -15, back: -3.03, cx: -0.05, behindPaper: 0.75 };

/** Layer seen only by the sun's shadow camera. */
const SHADE_LAYER = 5;

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
  readonly backdrop = new Backdrop();
  /** Holds the projected panorama surfaces of whichever place is showing (studio room or location). */
  private placeRoot = new THREE.Group();
  private plant = new THREE.Group();
  /** Outdoor depth props: a tree stump in front, a boulder behind. */
  private stump = new THREE.Group();
  private boulder = new THREE.Group();
  /** Living-room furniture around the sofa: armchair, tables, a potted tree. */
  private livingSet = new THREE.Group();
  /** Picnic tables at middle and far distances outdoors. */
  private picnicSet = new THREE.Group();
  /**
   * Stands in for a building between the sun and the subject ("Subject in
   * shade"). It lives on its own layer, which only the sun's shadow camera
   * sees: it casts the shadow but never shows up or takes part in focusing.
   */
  private shadeCaster: THREE.Mesh;
  private figure: Poseable | null = null;
  private lamps = new THREE.Group();
  private lampBulbs: THREE.MeshStandardMaterial[] = [];
  private place: THREE.Object3D | null = null;
  readonly hdri: HdriLibrary;
  private locInfo: LocationInfo | null = null;
  /** Asset groups already requested, so each is fetched only when first needed. */
  private requested = new Set<string>();
  private locSunDir: THREE.Vector3 | null = null;
  /** Location whose sharp detail layer is loaded (only one at a time). */
  private detailFor: LocationId | null = null;
  private bulbs: THREE.InstancedMesh;
  private bulbMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  private bulbsStudio: THREE.Matrix4[] = [];
  private bulbsOutdoor: THREE.Matrix4[] = [];
  private posts: THREE.Group;
  private cable: THREE.Line;
  private daylightCache: Daylight | null = null;

  constructor(
    private scene: THREE.Scene,
    private renderer: THREE.WebGLRenderer,
    private onAssetLoaded: () => void,
  ) {
    scene.add(this.studio, this.outdoor, this.location, this.placeRoot, this.props, this.hemi, this.sun, this.sun.target);
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

    // Studio: a seamless paper backdrop on stands, inside the projected studio room.
    this.studio.add(this.backdrop.group);

    // Outdoor ground and path.
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
    this.stump.position.set(-0.75, 0, 1.45);
    this.boulder.position.set(1.7, 0, -5.5);
    this.props.add(this.stump, this.boulder, this.livingSet, this.picnicSet);

    this.shadeCaster = new THREE.Mesh(new THREE.BoxGeometry(16, 40, 1), new THREE.MeshBasicMaterial());
    this.shadeCaster.castShadow = true;
    this.shadeCaster.layers.set(SHADE_LAYER);
    this.shadeCaster.visible = false;
    this.sun.shadow.camera.layers.enable(SHADE_LAYER);
    scene.add(this.shadeCaster);
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
    catenary(-1.3, 1.3, 2.3, 0.35, 0, 16, this.bulbsStudio);
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

  /** A wooden prop (see woodwork.ts), turned by `rot`. */
  private loadProp(make: () => THREE.Object3D, into: THREE.Group, rot: number) {
    const m = make();
    m.rotation.y = rot;
    into.add(m);
    return Promise.resolve();
  }

  /** Furniture for the living room, laid out at near, middle and far distances. */
  private loadLivingSet() {
    const at = (m: THREE.Object3D, x: number, z: number, rot: number) => {
      m.position.set(x, 0, z);
      m.rotation.y = rot;
      this.livingSet.add(m);
    };
    at(wood.armchair(), -2.15, -1.7, 0.7);
    at(wood.sideTable(), 1.75, -0.35, 0);
    at(wood.coffeeTable(), 1.55, 1.6, 0.3);
    at(wood.pottedTree(1.7), 2.2, -2.6, 0.4);
    return Promise.resolve();
  }

  /** A picnic table a few metres behind the subject and a bistro set far behind. */
  private loadPicnic() {
    const table = wood.picnicTable();
    table.position.set(-1.5, 0, -3.3);
    table.rotation.y = 0.35;
    const bistro = wood.bistroSet();
    bistro.position.set(1.7, 0, -7.5);
    bistro.rotation.y = -0.5;
    this.picnicSet.add(table, bistro);
    return Promise.resolve();
  }

  private loadPlant() {
    const plant = wood.pottedTree(1.25);
    plant.rotation.y = 0.6;
    this.plant.add(plant);
    return Promise.resolve();
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
        Promise.resolve(wood.streetLamp()).then((lamp) => {
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

  /** Show one place's projected surfaces (or none). */
  private showPlace(h: HdriData | null) {
    const g = h?.place.group ?? null;
    if (this.place !== g) {
      if (this.place) this.placeRoot.remove(this.place);
      this.place = g;
      if (g) this.placeRoot.add(g);
    }
    this.placeRoot.visible = !!g;
  }

  /** Load a place's sharp detail layer once it is on screen. */
  private wantDetail(id: LocationId) {
    this.need(`detail:${id}`, () =>
      this.hdri.loadDetail(id, this.renderer).then(() => {
        // Moved on while it downloaded: don't keep it.
        if (this.detailFor !== id) {
          this.hdri.dropDetail(id);
          this.requested.delete(`detail:${id}`);
        }
      }),
    );
    this.detailFor = id;
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
      if (h.sunDir && !s.env.inShade) e += h.sunE * Math.max(0, n.dot(h.sunDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rot)));
      return e;
    }
    const room = this.hdri.get('studio_loft');
    if (room) return (HdriLibrary.irradiance(room, n, 0) * s.env.ambient) / room.spec.lux;
    return s.env.ambient * (w + 0.35 * (1 - w));
  }

  /** Z position of the studio backdrop wall. */
  backdropZ(s: SimState): number {
    return -Math.min(s.subject.backgroundDistance, MAX_BACKDROP_DISTANCE);
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

    // Keep only the visible location's sharp layer in GPU memory.
    const want: LocationId | null = mode === 'location' ? s.env.location : mode === 'studio' ? 'studio_loft' : null;
    if (this.detailFor && this.detailFor !== want) {
      this.hdri.dropDetail(this.detailFor);
      this.requested.delete(`detail:${this.detailFor}`);
      this.detailFor = null;
    }
    if (want) this.need(`loc:${want}`, () => this.hdri.load(want));
    if (!want) this.showPlace(null);
    const outdoors = mode === 'location' && locationSpec(s.env.location).proxy.kind === 'open';
    if (s.subject.foregroundProp && !outdoors) this.need('plant', () => this.loadPlant());
    if (s.subject.foregroundProp && outdoors) this.need('stump', () => this.loadProp(wood.stump, this.stump, 0.9));
    const home = mode === 'location' && s.env.location === 'living_room';
    if (home) this.need('living', () => this.loadLivingSet());
    if (s.subject.picnic && outdoors) this.need('picnic', () => this.loadPicnic());
    if (s.subject.backgroundProp && outdoors) this.need('boulder', () => this.loadProp(wood.boulder, this.boulder, -0.5));
    this.shadeCaster.visible = false;
    if (s.subject.backgroundFigure) this.need('figure', () => this.loadBackgroundFigure());
    if (s.subject.bokehLights && mode !== 'studio') this.need('lamps', () => this.loadLamps());

    if (mode === 'studio') {
      this.daylightCache = null;
      // The paper runs out across the floor to just past the subject's feet.
      this.backdrop.update(bgZ, paperWidth(s), Math.min(0.9, bgZ + 3.6), s.env.backdrop);
      this.sun.visible = false;
      this.sun.castShadow = false;
      const room = this.hdri.get('studio_loft');
      this.showPlace(room ?? null);
      if (room) {
        // The room moves with the backdrop, so the subject can walk away from it.
        const r = STUDIO_ROOM;
        const roomLight = s.env.ambient / room.spec.lux;
        room.place.update(cont * roomLight, D(r.rot), new THREE.Vector3(-r.cx, 0, bgZ - r.behindPaper - r.back));
        this.wantDetail('studio_loft');
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
        this.scene.background = new THREE.Color(0.02, 0.02, 0.025);
        this.sun.visible = false;
        this.sun.castShadow = false;
        this.showPlace(null);
      } else {
        const rot = this.locationRotation(s, h);
        this.showPlace(h);
        this.wantDetail(s.env.location);
        h.place.update(cont, rot);
        this.scene.background = null;
        this.scene.environment = h.envMap;
        this.scene.environmentIntensity = cont;
        this.scene.environmentRotation.set(0, rot, 0);
        const hasSun = !!h.sunDir && h.sunE > 0;
        this.sun.visible = hasSun;
        this.sun.castShadow = hasSun;
        if (hasSun) {
          const dir = h.sunDir!.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rot);
          this.sun.color.copy(h.sunColor);
          this.sun.intensity = h.sunE * cont;
          this.sun.position.copy(dir).multiplyScalar(40).add(new THREE.Vector3(0, 1, -1));
          this.sun.target.position.set(0, 1, -1);
          this.sun.shadow.radius = Math.max(1, (0.012 * 0.5) / (14 / 2048));
          this.locSunDir = dir;
          // Open shade: a "building" 6 m toward the sun, tall and wide enough to
          // shade the subject and the ground around them at any sun height.
          if (s.env.inShade) {
            const flat = new THREE.Vector3(dir.x, 0, dir.z);
            if (flat.lengthSq() < 1e-6) flat.set(0, 0, -1);
            flat.normalize();
            this.shadeCaster.position.copy(flat).multiplyScalar(6).setY(20);
            this.shadeCaster.lookAt(0, 20, 0);
            this.shadeCaster.visible = true;
          }
        }
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
    this.plant.visible = s.subject.foregroundProp && !outdoors;
    this.stump.visible = s.subject.foregroundProp && outdoors;
    this.boulder.visible = s.subject.backgroundProp && outdoors;
    this.livingSet.visible = home;
    this.picnicSet.visible = s.subject.picnic && outdoors;
    if (this.figure) {
      this.figure.root.visible = s.subject.backgroundFigure;
      // x and z only: setPose has already set the height that puts the soles on the floor.
      const p = this.figure.root.position;
      if (open) p.set(1.2, p.y, -4.5);
      else p.set(0.85, p.y, Math.max(bgZ + 0.6, -2.6));
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
    return [this.studio, this.outdoor, this.placeRoot, this.props];
  }
}

