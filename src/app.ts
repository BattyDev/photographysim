import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Diagram } from './diagram';
import { StudioLight, activeLights, apparentWrap, equivalentRadius, illuminanceAt, lightPosition } from './lights';
import { patchSoftLighting, setSpotSoftness } from './softlight';
import {
  APERTURES,
  AUTO_SHUTTER,
  ISOS,
  METER_C,
  POWER_STOPS,
  SHUTTERS,
  SYNC_SPEED,
  depthOfField,
  formatAperture,
  formatDistance,
  formatPower,
  formatShutter,
  meteredAperture,
  FOCAL_LENGTHS,
  nearest,
  parseShutter,
  stopsToRatio,
  whiteBalanceGains,
} from './photo';
import { Pipeline } from './pipeline';
import {
  BACKDROPS,
  FRAMINGS,
  LIGHTING_PRESETS,
  MODIFIERS,
  POSE_OPTIONS,
  SCENARIO_PRESETS,
  SHOOT_PRESETS,
  TIME_PRESETS,
  defaultState,
  fitLightsToGroup,
  groupView,
  type CameraView,
  type LightId,
  type LightState,
  type ModifierId,
  type People,
  type Preset,
  type SimState,
} from './state';
import { LOCATIONS, locationSpec } from './hdri';
import { MAX_BACKDROP_DISTANCE } from './backdrop';
import { GROUP_POSES, Subject } from './subject';
import { Panel, type Pages } from './ui';
import { Tour } from './tour';
import { TUTORIAL } from './tutorial';
import { ShortcutPanel } from './shortcuts';
import { World, daylight, sunElevation, type Exposure } from './world';

const D = THREE.MathUtils.degToRad;
const R = THREE.MathUtils.radToDeg;

interface Metering {
  exposure: Exposure;
  /** Exposure (lux·s) at the face, as an incident meter pointed at the camera would see it. */
  H: number;
  perLight: Partial<Record<LightId, number>>;
  ambientH: number;
  backgroundH: number | null;
}

/** Rail icons: 24px line drawings in the current text colour. */
const svg = (d: string) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  shoot: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>'),
  lights: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>'),
  camera: svg('<path d="M4 8h3l1.6-2.5h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/>'),
  subject: svg('<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5c.6-4 3.4-6.5 7-6.5s6.4 2.5 7 6.5"/>'),
  scene: svg('<path d="M3 19l6-8 4 5 3-3.5 5 6.5z"/><circle cx="16.5" cy="6.5" r="2"/>'),
  view: svg('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
};

/** Short light names that fit the four tabs. */
const TAB_NAMES: Record<LightId, string> = { key: 'Key', fill: 'Fill', rim: 'Rim', bg: 'Back' };

/** Camera white balance presets, warm to cool. */
const WB_PRESETS = [
  { label: 'Tungsten', k: 3200 },
  { label: 'Fluoro', k: 4000 },
  { label: 'Daylight', k: 5600 },
  { label: 'Cloudy', k: 6500 },
  { label: 'Shade', k: 7500 },
];

export class App {
  state: SimState = defaultState();
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private overlay = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private orbit: OrbitControls;
  private gizmo: TransformControls;
  private gizmoProxy = new THREE.Object3D();
  private pipeline: Pipeline;
  private world: World;
  private subject = new Subject(() => this.update());
  private lights: StudioLight[];
  private diagram: Diagram;
  private panel: Panel;
  private eye = new THREE.Vector3(0, 1.6, 0);
  private dirty = true;
  private lastInteraction = 0;
  private settled = false;
  private metering: Metering | null = null;
  private presetNote = '';
  /** The focus shoot last loaded, so Solo ⇄ Group can re-run it. */
  private currentShoot: Preset | null = null;
  private viewport: HTMLElement;
  private nav!: Pages;
  private tour!: Tour;
  private keys = new ShortcutPanel();
  /** Last framing and camera height picked, highlighted until the user orbits away. */
  private framing: string | null = null;
  private angle: string | null = null;
  private toast: HTMLElement;

  constructor(root: HTMLElement) {
    root.innerHTML = '';
    this.viewport = document.createElement('div');
    this.viewport.className = 'viewport';
    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    root.append(this.viewport, sidebar);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.viewport.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 800);
    this.camera.filmGauge = 36;
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.12;
    this.orbit.minDistance = 0.5;
    this.orbit.maxDistance = 14;
    this.orbit.maxPolarAngle = D(100);
    this.orbit.addEventListener('change', () => this.interact());
    this.orbit.addEventListener('start', () => {
      if (this.framing === null && this.angle === null) return;
      this.framing = this.angle = null;
      this.panel.refresh();
    });

    this.pipeline = new Pipeline(this.renderer);
    this.world = new World(this.scene, this.renderer, () => this.update());
    this.scene.add(this.subject.group);
    this.lights = (['key', 'fill', 'rim', 'bg'] as LightId[]).map((id) => {
      const l = new StudioLight(id);
      this.scene.add(l.root);
      return l;
    });

    this.gizmo = new TransformControls(this.camera, this.renderer.domElement);
    this.gizmo.setSize(0.8);
    this.overlay.add(this.gizmoProxy, this.gizmo.getHelper());
    this.gizmo.addEventListener('dragging-changed', (e) => {
      this.orbit.enabled = !e.value;
    });
    this.gizmo.addEventListener('objectChange', () => this.onGizmoMove());
    this.gizmo.addEventListener('change', () => this.interact());

    this.diagram = new Diagram(
      (id, az, horiz) => {
        const l = this.light(id);
        l.azimuth = az;
        l.distance = Math.min(8, horiz / Math.max(Math.cos(D(l.elevation)), 0.15));
        this.state.selectedLight = id;
        this.update();
      },
      (id) => {
        this.state.selectedLight = id;
        this.update();
      },
    );
    this.viewport.appendChild(this.diagram.canvas);

    this.toast = document.createElement('div');
    this.toast.className = 'toast';
    this.viewport.appendChild(this.toast);
    const help = document.createElement('div');
    help.className = 'viewport-help';
    help.textContent = 'Drag to orbit · scroll to zoom · click a light to move it · double-click to focus';
    this.viewport.appendChild(help);

    this.panel = new Panel(() => this.update());
    this.buildSidebar(sidebar);

    this.setupPicking();
    window.addEventListener('keydown', (e) => this.onKey(e));
    new ResizeObserver(() => this.resize()).observe(this.viewport);
    this.resize();
    // Start on the outdoor solo shoot: only its panorama and one person download up front.
    this.applyPreset(SHOOT_PRESETS[0]);
    this.loop();
  }

  // ----------------------------------------------------------- state sync

  private light(id: LightId): LightState {
    return this.state.lights.find((l) => l.id === id)!;
  }

  private get sel(): LightState {
    return this.light(this.state.selectedLight);
  }

  private interact() {
    this.dirty = true;
    this.settled = false;
    this.lastInteraction = performance.now();
  }

  /** Push the whole state into the scene and refresh the UI. */
  update() {
    const s = this.state;
    const loc = s.env.mode === 'location' ? s.env.location : null;
    this.subject.apply(s.subject, !loc ? 'studio' : locationSpec(loc).proxy.kind === 'open' ? 'outdoors' : loc === 'living_room' ? 'home' : 'studio');
    this.subject.eyePosition(this.eye);

    this.camera.setFocalLength(s.camera.focalLength);
    this.camera.updateProjectionMatrix();
    this.updateFocus();

    this.metering = this.meter();
    const ex = this.metering.exposure;
    this.world.update(s, ex, this.camera);
    const firing = new Set(activeLights(s).map((l) => l.id));
    for (const sl of this.lights) {
      const ls = this.light(sl.id);
      sl.root.visible = ls.enabled;
      sl.update(ls, s, this.eye, ex, firing.has(ls.id));
    }
    setSpotSoftness(
      this.lights.map((sl) => {
        const ls = this.light(sl.id);
        return { light: sl.spot, wrap: apparentWrap(ls), size: equivalentRadius(ls) * 2, subjectDistance: ls.distance };
      }),
      s.env.mode === 'outdoor' && s.env.weather === 'hazy' ? 0.18 : 0.006,
    );
    patchSoftLighting(this.scene);
    this.syncGizmo();
    this.panel.refresh();
    this.diagram.canvas.style.display = s.view.showDiagram ? '' : 'none';
    this.interact();
  }

  private updateFocus() {
    const c = this.state.camera;
    if (!c.trackFocus) return;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    c.focusDistance = Math.max(0.3, this.eye.clone().sub(this.camera.position).dot(dir));
  }

  private meter(): Metering {
    const s = this.state;
    const n = this.camera.position.clone().sub(this.eye).normalize();
    const firing = activeLights(s);
    const perLight: Partial<Record<LightId, number>> = {};
    let strobeH = 0;
    let contE = 0;
    for (const l of firing) {
      const e = illuminanceAt(l, s, this.eye, this.eye, n);
      if (l.kind === 'strobe') strobeH += e;
      else contE += e;
    }
    const ambE = this.world.ambientIlluminance(s, n);

    const cam = s.camera;
    let ex: Exposure;
    if (cam.exposureMode === 'manual') {
      const t = cam.shutter;
      const strobe = Math.min(1, t / SYNC_SPEED);
      ex = { X: (Math.PI * cam.iso) / (METER_C * cam.aperture * cam.aperture), t, strobe };
    } else {
      const H = strobeH + (contE + ambE) * AUTO_SHUTTER;
      ex = { X: (Math.PI * Math.pow(2, cam.exposureComp)) / Math.max(H, 1e-5), t: AUTO_SHUTTER, strobe: 1 };
    }
    for (const l of firing) {
      const e = illuminanceAt(l, s, this.eye, this.eye, n);
      perLight[l.id] = l.kind === 'strobe' ? e * ex.strobe : e * ex.t;
    }
    const H = strobeH * ex.strobe + (contE + ambE) * ex.t;

    let backgroundH: number | null = null;
    if (s.env.mode === 'studio') {
      const p = new THREE.Vector3(0, 1.3, -s.subject.backgroundDistance + 0.01);
      const bn = new THREE.Vector3(0, 0, 1);
      let bh = s.env.ambient * 0.8 * ex.t;
      for (const l of firing) {
        const e = illuminanceAt(l, s, this.eye, p, bn);
        bh += l.kind === 'strobe' ? e * ex.strobe : e * ex.t;
      }
      backgroundH = bh;
    }
    return { exposure: ex, H, perLight, ambientH: ambE * ex.t, backgroundH };
  }

  // -------------------------------------------------------------- camera

  private applyView(v: CameraView) {
    this.framing = this.angle = null;
    const az = D(v.azimuth);
    this.orbit.target.set(0, v.targetHeight, 0);
    this.camera.position.set(Math.sin(az) * v.distance, v.height, Math.cos(az) * v.distance);
    this.orbit.update();
    this.updateFocus();
  }

  /** Keep the current angle but move to a framing distance. */
  private frame(v: CameraView) {
    const t = new THREE.Vector3(0, v.targetHeight, 0);
    const dir = this.camera.position.clone().sub(this.orbit.target);
    dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    // Scale distance with focal length so framing holds at any lens.
    const dist = v.distance * (this.state.camera.focalLength / 85);
    this.orbit.target.copy(t);
    this.camera.position.copy(t).addScaledVector(dir, dist).setY(v.height);
    this.orbit.update();
  }

  private cameraHeight(kind: 'eye' | 'high' | 'low') {
    const t = this.orbit.target;
    const offset = this.camera.position.clone().sub(t);
    const horiz = Math.hypot(offset.x, offset.z);
    const dist = offset.length();
    const ang = kind === 'eye' ? 3 : kind === 'high' ? 28 : -18;
    const y = this.eye.y + Math.tan(D(ang)) * horiz - (kind === 'eye' ? 0 : 0);
    const newOff = new THREE.Vector3(offset.x, 0, offset.z).setLength(dist * Math.cos(D(ang)));
    this.camera.position.set(t.x + newOff.x, Math.max(0.25, y), t.z + newOff.z);
    this.orbit.update();
  }

  // ------------------------------------------------------------- picking

  private setupPicking() {
    const el = this.renderer.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let downAt: [number, number] | null = null;
    const toNdc = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
    };
    el.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]));
    el.addEventListener('pointerup', (e) => {
      if (!downAt || this.gizmo.dragging) return;
      const moved = Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]);
      downAt = null;
      if (moved > 5) return;
      if ((this.gizmo as unknown as { axis: string | null }).axis) return;
      toNdc(e);
      const pickables = this.lights.filter((l) => this.light(l.id).enabled).flatMap((l) => l.pickables);
      const hit = ray.intersectObjects(pickables, false)[0];
      if (hit) {
        this.state.selectedLight = hit.object.userData.lightId as LightId;
        this.gizmoActive = true;
        this.nav.show('lights');
        this.toastMsg(`${this.sel.name} light selected — drag the arrows to move it`);
      } else {
        this.gizmoActive = false;
      }
      this.update();
    });
    el.addEventListener('dblclick', (e) => {
      toNdc(e);
      const hit = ray.intersectObjects([this.subject.group, ...this.world.focusTargets()], true).find((h) => h.object.visible);
      if (!hit) return;
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.state.camera.trackFocus = false;
      this.state.camera.focusDistance = Math.max(0.3, hit.point.clone().sub(this.camera.position).dot(dir));
      this.toastMsg(`Focused at ${formatDistance(this.state.camera.focusDistance)}`);
      this.update();
    });
  }

  private gizmoActive = false;

  private syncGizmo() {
    const ls = this.sel;
    if (this.gizmoActive && ls.enabled && this.state.view.showGear) {
      lightPosition(ls, this.eye, this.gizmoProxy.position);
      if (this.gizmo.object !== this.gizmoProxy) this.gizmo.attach(this.gizmoProxy);
    } else if (this.gizmo.object) {
      this.gizmo.detach();
    }
  }

  private onGizmoMove() {
    const ls = this.sel;
    const rel = this.gizmoProxy.position.clone().sub(this.eye);
    const d = Math.max(0.3, rel.length());
    ls.distance = Math.min(8, d);
    ls.elevation = Math.round(R(Math.asin(THREE.MathUtils.clamp(rel.y / d, -1, 1))));
    ls.azimuth = Math.round(R(Math.atan2(rel.x, rel.z)));
    this.update();
  }

  private toastTimer = 0;
  private toastMsg(msg: string) {
    this.toast.textContent = msg;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('show'), 2200);
  }

  // ------------------------------------------------------------- render

  private resize() {
    const w = Math.max(1, this.viewport.clientWidth);
    const h = Math.max(1, this.viewport.clientHeight);
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    const pr = this.renderer.getPixelRatio();
    this.pipeline.setSize(Math.round(w * pr), Math.round(h * pr));
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.interact();
  }

  private loop = () => {
    requestAnimationFrame(this.loop);
    if (this.orbit.update()) this.interact();
    const now = performance.now();
    const idle = now - this.lastInteraction > 180;
    if (this.dirty || (idle && !this.settled)) {
      if (this.state.camera.trackFocus) this.updateFocus();
      this.world.update(this.state, this.metering!.exposure, this.camera);
      this.renderFrame(idle ? 700 : 110, true);
      this.diagram.draw({
        state: this.state,
        eye: this.eye,
        camera: this.camera,
        sunDir: this.world.sunDirection(),
      });
      this.dirty = false;
      if (idle) this.settled = true;
    }
  };

  private renderFrame(samples: number, withOverlay: boolean) {
    const c = this.state.camera;
    const dof = depthOfField(c.focalLength, c.aperture, c.focusDistance);
    this.pipeline.render(this.scene, this.camera, {
      focusDistance: c.focusDistance,
      focalLength: c.focalLength,
      fNumber: c.aperture,
      wbGains: whiteBalanceGains(c.whiteBalance),
      showZone: c.showFocusZone,
      showPlane: c.showFocusPlane,
      zoneNear: dof.near,
      zoneFar: dof.far,
      samples,
    });
    if (withOverlay && this.gizmo.object) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.overlay, this.camera);
      this.renderer.autoClear = true;
    }
  }

  private savePhoto() {
    this.renderFrame(1200, false);
    this.renderer.domElement.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `photographysim-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
    this.interact();
  }

  // ----------------------------------------------------------- keyboard

  /** Click a visible button by its text, so a shortcut runs exactly what the button does. */
  private press(page: string, text: string) {
    this.nav.show(page);
    const b = [...document.querySelectorAll<HTMLButtonElement>('.page:not([hidden]) button')].find((x) => x.textContent?.trim() === text);
    b?.click();
  }

  private onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t?.closest?.('select, textarea, [contenteditable], input:not([type=range]):not([type=checkbox])')) return;
    const k = e.key;
    const arrow = k.startsWith('Arrow');
    if (arrow && t instanceof HTMLInputElement && t.type === 'range') return;
    if (this.tour.isOpen && (arrow || k === 'Escape')) return;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 's') {
      e.preventDefault();
      this.savePhoto();
      this.toastMsg('Saving photo…');
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const s = this.state;
    const l = this.sel;
    const name = `${TAB_NAMES[l.id]} light`;
    const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;
    const side = (a: number) => (Math.abs(a) < 1 ? 'in front' : `${Math.abs(Math.round(a))}° ${a < 0 ? 'cam-left' : 'cam-right'}`);
    const step = (list: number[], v: number, d: number) => {
      let i = 0;
      list.forEach((x, j) => {
        if (Math.abs(x - v) < Math.abs(list[i] - v)) i = j;
      });
      return list[THREE.MathUtils.clamp(i + d, 0, list.length - 1)];
    };
    let msg = '';
    switch (k.length === 1 ? k.toLowerCase() : k) {
      case '?':
      case '/':
        this.keys.toggle();
        break;
      case 'Escape':
        if (this.keys.isOpen) this.keys.close();
        else if (this.gizmoActive) this.gizmoActive = false;
        else return;
        break;
      case 't':
        this.keys.close();
        this.tour.start();
        break;
      case 'p':
        this.savePhoto();
        msg = 'Saving photo…';
        break;
      case '1': case '2': case '3': case '4': case '5': case '6':
        this.nav.show(['shoot', 'lights', 'camera', 'subject', 'scene', 'view'][+k - 1]);
        break;
      case 'k': case 'f': case 'r': case 'b': {
        const id = ({ k: 'key', f: 'fill', r: 'rim', b: 'bg' } as const)[k.toLowerCase() as 'k' | 'f' | 'r' | 'b'];
        s.selectedLight = id;
        this.nav.show('lights');
        msg = `${TAB_NAMES[id]} light selected${this.light(id).enabled ? '' : ' (off: press O)'}`;
        break;
      }
      case 'o':
        l.enabled = !l.enabled;
        msg = `${name} ${l.enabled ? 'on' : 'off'}`;
        break;
      case 's': {
        const v = !l.solo;
        for (const x of s.lights) x.solo = false;
        l.solo = v;
        if (v) l.enabled = true;
        msg = v ? `Solo: ${name} only` : 'Solo off: all lights';
        break;
      }
      case 'ArrowLeft': case 'ArrowRight':
        l.azimuth = wrap(l.azimuth + (k === 'ArrowLeft' ? -5 : 5));
        msg = `${name}: ${side(l.azimuth)}`;
        break;
      case 'ArrowUp': case 'ArrowDown':
        if (e.shiftKey) {
          l.distance = THREE.MathUtils.clamp(l.distance * Math.pow(2, (k === 'ArrowUp' ? -1 : 1) / 6), 0.4, 6);
          msg = `${name}: ${l.distance.toFixed(2)} m away`;
        } else {
          l.elevation = THREE.MathUtils.clamp(l.elevation + (k === 'ArrowUp' ? 5 : -5), -60, 85);
          msg = `${name}: ${Math.round(Math.abs(l.elevation))}° ${l.elevation < 0 ? 'below' : 'above'} the eyes`;
        }
        break;
      case '+': case '=': case '-': case '_':
        l.power = step(POWER_STOPS, l.power, k === '+' || k === '=' ? 1 : -1);
        msg = `${name}: ${formatPower(l.power)}`;
        break;
      case '[': case ']':
        s.camera.aperture = step(APERTURES, s.camera.aperture, k === '[' ? -1 : 1);
        msg = `Aperture ${formatAperture(s.camera.aperture)}`;
        break;
      case ',': case '.': {
        const f = s.camera.focalLength;
        const next = k === '.' ? FOCAL_LENGTHS.find((x) => x > f + 0.5) : [...FOCAL_LENGTHS].reverse().find((x) => x < f - 0.5);
        if (next) s.camera.focalLength = next;
        msg = `Lens ${Math.round(s.camera.focalLength)} mm`;
        break;
      }
      case 'c': {
        const i = FRAMINGS.findIndex((f) => f.label === this.framing);
        const f = FRAMINGS[(i + 1) % FRAMINGS.length];
        this.press('camera', f.label);
        msg = f.label;
        break;
      }
      case 'a':
        s.camera.trackFocus = !s.camera.trackFocus;
        msg = `Eye autofocus ${s.camera.trackFocus ? 'on' : 'off'}`;
        break;
      case 'e': {
        const to = s.camera.exposureMode === 'auto' ? 'Manual' : 'Auto';
        this.press('camera', to);
        msg = `Exposure: ${to}`;
        break;
      }
      case 'z':
        s.camera.showFocusZone = !s.camera.showFocusZone;
        msg = `In-focus zone ${s.camera.showFocusZone ? 'shown' : 'hidden'}`;
        break;
      case 'g':
        s.view.showGear = !s.view.showGear;
        msg = `Stands ${s.view.showGear ? 'shown' : 'hidden'}`;
        break;
      case 'd':
        s.view.showDiagram = !s.view.showDiagram;
        break;
      default:
        return;
    }
    e.preventDefault();
    this.update();
    if (msg) this.toastMsg(msg);
  }

  // ------------------------------------------------------------ presets

  private applyPreset(p: Preset) {
    const shoot = SHOOT_PRESETS.includes(p);
    this.currentShoot = shoot ? p : null;
    let view = p.apply(this.state);
    // Other presets are written for one person: give a group room.
    if (!shoot && this.state.subject.people === 'group') {
      fitLightsToGroup(this.state);
      if (view) view = groupView(this.state);
    }
    this.gizmoActive = false;
    this.presetNote = `<strong>${p.label}.</strong> ${p.blurb}`;
    if (view) this.applyView(view);
    this.update();
  }

  /** Swap between one person and the family, keeping the current shoot. */
  private setPeople(v: People) {
    const s = this.state;
    if (s.subject.people === v) return;
    s.subject.people = v;
    const shoot = this.currentShoot;
    if (shoot) {
      const next = shoot.id.startsWith('outdoor') ? SHOOT_PRESETS.find((p) => p.id === (v === 'group' ? 'outdoor-family' : 'outdoor-solo'))! : shoot;
      this.applyPreset(next);
      return;
    }
    if (v === 'group') {
      fitLightsToGroup(s);
      this.applyView(groupView(s));
    } else this.applyView(FRAMINGS[1].view);
    this.update();
  }

  // ------------------------------------------------------------ sidebar

  private buildSidebar(root: HTMLElement) {
    const P = this.panel;
    const s = () => this.state;

    const header = P.el('header', 'sidebar-header');
    header.innerHTML = `<div><h1>Lighting Simulator</h1><p>Light, lens and location — see how they interact.</p></div>`;
    const actions = P.el('div', 'header-actions');
    const help = P.el('button', 'ghost tutorial-btn');
    help.title = 'Tutorial: a guided tour of every control';
    help.innerHTML = '<span class="q" aria-hidden="true">?</span><span class="txt">Tutorial</span>';
    // Pulse until it has been opened once.
    if (Tour.unseen) help.classList.add('pulse');
    help.addEventListener('click', () => {
      help.classList.remove('pulse');
      this.tour.start();
    });
    const keysBtn = P.el('button', 'ghost keys-btn');
    keysBtn.title = 'Keyboard shortcuts (?)';
    keysBtn.setAttribute('aria-label', 'Keyboard shortcuts');
    keysBtn.innerHTML = svg('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M8 14h8"/>');
    keysBtn.addEventListener('click', () => this.keys.toggle());
    const save = P.el('button', 'primary', 'Save photo');
    save.addEventListener('click', () => this.savePhoto());
    actions.append(help, keysBtn, save);
    header.appendChild(actions);
    root.appendChild(header);

    const body = P.el('div', 'sidebar-body');
    root.appendChild(body);
    this.nav = P.pages(body);
    this.tour = new Tour(TUTORIAL, (id) => this.nav.show(id));
    const page = (id: keyof typeof ICONS, title: string, subtitle: string) => this.nav.add(id, title, subtitle, ICONS[id]);

    // Quick starts
    {
      const sec = page('shoot', 'Shoots', 'Ready-made shoots, poses and classic lighting setups.');
      const g0 = P.group(sec, 'Shoots');
      P.buttons(
        g0,
        SHOOT_PRESETS.map((p) => ({ label: p.label, title: p.blurb, onClick: () => this.applyPreset(p), active: () => this.currentShoot === p })),
        'cols-3',
      );
      P.segmented(g0, {
        label: 'People',
        options: [
          { value: 'solo', label: 'Solo', title: 'One person' },
          { value: 'group', label: 'Group', title: 'A family of four' },
        ],
        get: () => s().subject.people,
        set: (v) => this.setPeople(v),
      });
      const soloPoses = P.group(g0, 'Pose');
      P.buttons(
        soloPoses,
        POSE_OPTIONS.map((o) => ({
          label: o.label,
          title: o.title,
          onClick: () => {
            s().subject.pose = o.value;
            s().subject.model = 'mannequin';
          },
          active: () => s().subject.model === 'mannequin' && s().subject.pose === o.value,
        })),
        'cols-3 small',
      );
      P.showIf(soloPoses, () => s().subject.people === 'solo');
      const groupPose = P.segmented(g0, {
        label: 'Group pose',
        options: (Object.keys(GROUP_POSES) as (keyof typeof GROUP_POSES)[]).map((k) => ({ value: k, label: GROUP_POSES[k].label })),
        get: () => s().subject.groupPose,
        set: (v) => {
          s().subject.groupPose = v;
          this.applyView(groupView(s()));
        },
      });
      P.showIf(groupPose, () => s().subject.people === 'group');
      const g1 = P.group(sec, 'Lighting setups');
      P.buttons(g1, LIGHTING_PRESETS.map((p) => ({ label: p.label, title: p.blurb, onClick: () => this.applyPreset(p) })));
      const g2 = P.group(sec, 'Scenarios');
      P.buttons(g2, SCENARIO_PRESETS.map((p) => ({ label: p.label, title: p.blurb, onClick: () => this.applyPreset(p) })));
      const note = P.el('div', 'preset-note');
      sec.appendChild(note);
      P.track(() => {
        note.innerHTML = this.presetNote || 'Pick a shoot or a setup to load it, then tweak anything in the other pages.';
      });
    }

    // Lights
    {
      const sec = page('lights', 'Lights', 'Up to four lights: place them, shape them, colour them.');
      const tabs = P.el('div', 'light-tabs');
      sec.appendChild(tabs);
      const tabEls = this.state.lights.map((l) => {
        const t = P.el('button', 'light-tab');
        t.innerHTML = `<span class="dot" style="background:${l.color}"></span><span class="name">${TAB_NAMES[l.id]}</span><span class="state"></span>`;
        t.title = l.name;
        t.addEventListener('click', () => {
          this.state.selectedLight = l.id;
          this.update();
        });
        tabs.appendChild(t);
        return t;
      });
      P.track(() => {
        tabEls.forEach((t, i) => {
          const l = s().lights[i];
          t.classList.toggle('active', s().selectedLight === l.id);
          t.classList.toggle('off', !l.enabled);
          (t.querySelector('.state') as HTMLElement).textContent = !l.enabled ? 'off' : l.solo ? 'solo' : formatPower(l.power).replace(' +0.3', ' +⅓').replace(' +0.7', ' +⅔');
        });
      });

      const onRow = P.el('div', 'row-2');
      sec.appendChild(onRow);
      P.toggle(onRow, { label: 'On', get: () => this.sel.enabled, set: (v) => (this.sel.enabled = v) });
      P.toggle(onRow, {
        label: 'Solo',
        get: () => this.sel.solo,
        set: (v) => {
          for (const l of s().lights) l.solo = false;
          this.sel.solo = v;
          if (v) this.sel.enabled = true;
        },
      });

      const body = P.el('div');
      sec.appendChild(body);
      P.showIf(body, () => this.sel.enabled);

      P.segmented(body, {
        options: [
          { value: 'strobe', label: 'Strobe', title: 'Flash: exposure set by aperture & ISO, not shutter speed' },
          { value: 'continuous', label: 'Continuous', title: 'Always-on light: shutter speed matters' },
        ],
        get: () => this.sel.kind,
        set: (v) => (this.sel.kind = v),
        small: true,
      });
      P.slider(body, {
        label: 'Power',
        steps: POWER_STOPS,
        get: () => this.sel.power,
        set: (v) => (this.sel.power = v),
        format: formatPower,
        ticks: [[-7, '1/128'], [-5, '1/32'], [-3, '1/8'], [-1, '1/2'], [0, '1/1']],
        parse: (t) => {
          const m = t.match(/1\s*\/\s*(\d+)/);
          return m ? -Math.log2(parseFloat(m[1])) : null;
        },
      });
      P.readout(body, 'This light alone', () => {
        const m = this.metering;
        const h = m?.perLight[this.sel.id];
        if (!m || h === undefined || h <= 0) return '<span class="muted">no light on the face side</span>';
        const iso = s().camera.exposureMode === 'manual' ? s().camera.iso : 100;
        return `${formatAperture(meteredAperture(h, iso))} <span class="muted">@ ISO ${iso}</span>`;
      });

      P.select(body, {
        label: 'Modifier',
        options: (Object.keys(MODIFIERS) as ModifierId[]).map((k) => ({ value: k, label: MODIFIERS[k].label })),
        get: () => this.sel.modifier,
        set: (v) => {
          this.sel.modifier = v;
          this.sel.size = MODIFIERS[v].size;
          if (v === 'window') this.sel.kind = 'continuous';
        },
      });
      const sizeRow = P.el('div');
      body.appendChild(sizeRow);
      let sizeSlider: HTMLElement | null = null;
      let sizeFor = '';
      P.track(() => {
        // Rebuild the size slider when its range changes with the modifier.
        if (sizeFor === this.sel.modifier && sizeSlider) return;
        sizeFor = this.sel.modifier;
        sizeRow.innerHTML = '';
        const spec = MODIFIERS[this.sel.modifier];
        sizeSlider = P.slider(sizeRow, {
          label: 'Size',
          min: spec.minSize,
          max: spec.maxSize,
          step: 0.01,
          get: () => this.sel.size,
          set: (v) => (this.sel.size = v),
          format: (v) => formatDistance(v),
        });
      });
      P.hint(body, () => `${MODIFIERS[this.sel.modifier].hint} Apparent size: ${(R(2 * Math.atan(this.sel.size / 2 / this.sel.distance))).toFixed(0)}°.`);

      const pos = P.group(body, 'Position');
      P.slider(pos, {
        label: 'Around subject',
        min: -180,
        max: 180,
        step: 1,
        get: () => this.sel.azimuth,
        set: (v) => (this.sel.azimuth = v),
        format: (v) => (Math.abs(v) < 1 ? 'front' : Math.abs(v) > 179 ? 'behind' : `${Math.abs(Math.round(v))}° ${v < 0 ? 'cam-left' : 'cam-right'}`),
        ticks: [[-180, 'behind'], [-90, 'left'], [0, 'front'], [90, 'right'], [180, 'behind']],
        parse: (t) => {
          const n = parseFloat(t);
          return isFinite(n) ? (/l/i.test(t) ? -Math.abs(n) : n) : null;
        },
      });
      P.slider(pos, {
        label: 'Height',
        min: -60,
        max: 85,
        step: 1,
        get: () => this.sel.elevation,
        set: (v) => (this.sel.elevation = v),
        format: (v) => `${Math.round(v)}° ${v >= 0 ? 'above' : 'below'} eyes`,
        ticks: [[-45, '−45°'], [0, 'eye level'], [45, '45°'], [85, 'overhead']],
      });
      P.slider(pos, {
        label: 'Distance',
        min: 0.4,
        max: 6,
        step: 0.05,
        log: true,
        get: () => this.sel.distance,
        set: (v) => (this.sel.distance = v),
        format: (v) => `${v.toFixed(2)} m`,
        ticks: [[0.5, '0.5 m'], [1, '1 m'], [2, '2 m'], [4, '4 m']],
        hint: 'Inverse square law: each mark is double the distance, which is ¼ the light (−2 stops).',
      });
      P.segmented(pos, {
        label: 'Aim at',
        options: [
          { value: 'face', label: 'Face' },
          { value: 'background', label: 'Background' },
        ],
        get: () => this.sel.aim,
        set: (v) => (this.sel.aim = v),
        small: true,
      });

      const col = P.group(body, 'Colour');
      P.slider(col, {
        label: 'Colour temperature',
        min: 2000,
        max: 10000,
        step: 100,
        get: () => this.sel.kelvin,
        set: (v) => (this.sel.kelvin = v),
        format: (v) => `${Math.round(v)} K`,
        kelvin: true,
        ticks: [[3200, '3200 tungsten'], [5600, '5600 flash'], [8000, '8000']],
      });
      P.color(col, {
        label: 'Gel',
        swatches: ['#ffffff', '#ffb070', '#9cc3ff', '#ff5a5a', '#5a7dff', '#ff6ad5', '#7dff8a'],
        get: () => this.sel.gel,
        set: (v) => (this.sel.gel = v),
      });
      P.toggle(body, { label: 'Casts shadows', get: () => this.sel.shadows, set: (v) => (this.sel.shadows = v) });

      const ratios = P.group(sec, 'Ratios at the face', 'readouts');
      P.readout(ratios, 'Key : Fill', () => {
        const m = this.metering;
        const k = m?.perLight.key ?? 0;
        const f = m?.perLight.fill ?? 0;
        if (k <= 0) return '<span class="muted">key off</span>';
        if (f <= 0) return '<span class="muted">no fill</span>';
        const stops = Math.log2((k + f) / f);
        return `${stopsToRatio(stops)} <span class="muted">(${stops.toFixed(1)} stops)</span>`;
      }, 'hero');
      const bgRead = P.readout(ratios, 'Background vs face', () => {
        const m = this.metering;
        if (!m || m.backgroundH === null) return '';
        const ev = Math.log2(Math.max(m.backgroundH, 1e-6) / Math.max(m.H, 1e-6));
        return `${ev >= 0 ? '+' : ''}${ev.toFixed(1)} EV`;
      });
      P.showIf(bgRead, () => s().env.mode === 'studio');
    }

    // Camera
    {
      const sec = page('camera', 'Camera', 'Lens, focus, exposure and white balance.');
      const fr = P.group(sec, 'Framing');
      P.buttons(
        fr,
        FRAMINGS.map((f) => ({
          label: f.label,
          onClick: () => {
            this.frame(f.view);
            this.framing = f.label;
          },
          active: () => this.framing === f.label,
        })),
        'cols-3',
      );
      const heights = [
        { id: 'eye', label: 'Eye level', title: 'Camera level with the eyes: neutral' },
        { id: 'high', label: 'High angle', title: 'Looking down: slims the jaw, shows the top light' },
        { id: 'low', label: 'Low angle', title: 'Looking up: makes the subject loom larger' },
      ] as const;
      const ang = P.group(sec, 'Camera height');
      P.buttons(
        ang,
        heights.map((h) => ({
          label: h.label,
          title: h.title,
          onClick: () => {
            this.cameraHeight(h.id);
            this.angle = h.id;
          },
          active: () => this.angle === h.id,
        })),
        'cols-3',
      );
      const lens = P.group(sec, 'Lens');
      P.slider(lens, {
        label: 'Focal length',
        min: 14,
        max: 200,
        step: 1,
        get: () => s().camera.focalLength,
        set: (v) => (s().camera.focalLength = v),
        format: (v) => `${Math.round(v)} mm`,
        ticks: [[24, '24'], [50, '50'], [85, '85'], [135, '135'], [200, '200 mm']],
        hint: 'Longer lenses compress the background and flatter faces.',
      });
      P.slider(lens, {
        label: 'Aperture',
        steps: APERTURES,
        get: () => s().camera.aperture,
        set: (v) => (s().camera.aperture = v),
        format: formatAperture,
        ticks: [1.4, 2.8, 5.6, 11, 22],
        parse: (t) => parseFloat(t.replace(/^f\s*\/?/i, '')),
        hint: 'Lower f-number = wider opening = shallower depth of field.',
      });
      const focus = P.group(sec, 'Focus');
      P.slider(focus, {
        label: 'Focus distance',
        min: 0.4,
        max: 20,
        step: 0.01,
        log: true,
        ticks: [[0.5, '0.5 m'], [1, '1 m'], [2, '2 m'], [5, '5 m'], [10, '10 m'], [20, '20 m']],
        get: () => s().camera.focusDistance,
        set: (v) => {
          s().camera.focusDistance = v;
          s().camera.trackFocus = false;
        },
        format: (v) => `${v.toFixed(2)} m`,
      });
      P.toggle(focus, {
        label: 'Autofocus on the eyes',
        get: () => s().camera.trackFocus,
        set: (v) => (s().camera.trackFocus = v),
        hint: 'Or double-click anything in the view to focus there.',
      });
      const dofBox = P.group(focus, '', 'readouts');
      P.readout(dofBox, 'Depth of field', () => {
        const c = s().camera;
        const d = depthOfField(c.focalLength, c.aperture, c.focusDistance);
        const total = d.far - d.near;
        return `${formatDistance(d.near)} – ${formatDistance(d.far)} <span class="muted">(${isFinite(total) ? formatDistance(total) : '∞'})</span>`;
      });
      const vis = P.el('div', 'row-2');
      focus.appendChild(vis);
      P.toggle(vis, { label: 'In-focus zone', get: () => s().camera.showFocusZone, set: (v) => (s().camera.showFocusZone = v) });
      P.toggle(vis, { label: 'Focus plane', get: () => s().camera.showFocusPlane, set: (v) => (s().camera.showFocusPlane = v) });

      const exg = P.group(sec, 'Exposure');
      P.segmented(exg, {
        options: [
          { value: 'auto', label: 'Auto', title: 'Brightness held steady: aperture only changes depth of field' },
          { value: 'manual', label: 'Manual', title: 'Full exposure triangle: aperture, shutter, ISO' },
        ],
        get: () => s().camera.exposureMode,
        set: (v) => {
          const c = s().camera;
          if (v === 'manual' && c.exposureMode === 'auto' && this.metering) {
            // Start manual from the settings auto was effectively using.
            c.shutter = AUTO_SHUTTER;
            const iso = ((METER_C * c.aperture * c.aperture) / Math.max(this.metering.H, 1e-6)) * Math.pow(2, c.exposureComp);
            c.iso = nearest(ISOS, THREE.MathUtils.clamp(iso, ISOS[0], ISOS[ISOS.length - 1]));
          }
          c.exposureMode = v;
        },
        small: true,
      });
      const auto = P.el('div');
      exg.appendChild(auto);
      P.showIf(auto, () => s().camera.exposureMode === 'auto');
      P.slider(auto, {
        label: 'Exposure compensation',
        min: -3,
        max: 3,
        step: 1 / 3,
        get: () => s().camera.exposureComp,
        set: (v) => (s().camera.exposureComp = v),
        format: (v) => `${v >= 0 ? '+' : ''}${v.toFixed(1)} EV`,
        ticks: [[-3, '−3'], [-2, '−2'], [-1, '−1'], [0, '0'], [1, '+1'], [2, '+2'], [3, '+3']],
        hint: 'Auto keeps the face correctly exposed so you can play with aperture freely.',
      });
      const manual = P.el('div');
      exg.appendChild(manual);
      P.showIf(manual, () => s().camera.exposureMode === 'manual');
      P.slider(manual, {
        label: 'Shutter speed',
        steps: [...SHUTTERS].reverse(),
        get: () => s().camera.shutter,
        set: (v) => (s().camera.shutter = v),
        format: formatShutter,
        ticks: [[1, '1s'], [1 / 30, '1/30'], [1 / 250, '1/250'], [1 / 8000, '1/8000']],
        parse: parseShutter,
        hint: 'Controls ambient & continuous light only. Strobes fire faster than any shutter — above 1/250 they get cut off.',
      });
      P.slider(manual, {
        label: 'ISO',
        steps: ISOS,
        get: () => s().camera.iso,
        set: (v) => (s().camera.iso = v),
        format: (v) => String(v),
        ticks: [100, 400, 1600, 6400],
      });
      const meterBox = P.group(exg, '', 'readouts');
      P.readout(meterBox, 'Meter at face', () => {
        const m = this.metering;
        const c = s().camera;
        if (!m) return '';
        if (c.exposureMode === 'auto') {
          return `${formatAperture(meteredAperture(m.H, 100))} <span class="muted">@ ISO 100, ${formatShutter(AUTO_SHUTTER)}</span>`;
        }
        const need = meteredAperture(m.H, c.iso);
        const ev = 2 * Math.log2(need / c.aperture);
        const tag = Math.abs(ev) < 0.17 ? '<span class="good">spot on</span>' : `<span class="${ev > 0 ? 'warn' : 'cool'}">${ev > 0 ? '+' : ''}${ev.toFixed(1)} EV ${ev > 0 ? 'over' : 'under'}</span>`;
        return `${formatAperture(need)} ${tag}`;
      });
      const mix = P.readout(meterBox, 'Ambient share', () => {
        const m = this.metering;
        if (!m || m.H <= 0) return '';
        return `${Math.round((m.ambientH / m.H) * 100)}% <span class="muted">of the face exposure</span>`;
      });
      P.showIf(mix, () => s().env.mode !== 'studio' || s().env.ambient > 30);

      const wb = P.group(sec, 'White balance');
      P.slider(wb, {
        label: 'Camera white balance',
        min: 2500,
        max: 10000,
        step: 100,
        get: () => s().camera.whiteBalance,
        set: (v) => (s().camera.whiteBalance = v),
        format: (v) => `${Math.round(v)} K`,
        kelvin: true,
        ticks: [3200, 5600, 7500],
      });
      P.buttons(
        wb,
        WB_PRESETS.map((w) => ({
          label: w.label,
          title: `${w.k} K`,
          onClick: () => (s().camera.whiteBalance = w.k),
          active: () => s().camera.whiteBalance === w.k,
        })),
        'cols-5 small',
      );
    }

    // Subject & scene
    {
      const sec = page('subject', 'Subject', 'Who you are photographing and what is around them.');
      const modelPick = P.segmented(sec, {
        label: 'Subject',
        options: [
          { value: 'mannequin', label: 'Person', title: 'A real-looking person who takes every pose' },
          { value: 'headscan', label: 'Head scan', title: 'A real scanned face, for studying light patterns' },
          { value: 'bust', label: 'Marble bust', title: 'Classic sculpture on a plinth' },
        ],
        get: () => s().subject.model,
        set: (v) => (s().subject.model = v),
      });
      P.showIf(modelPick, () => s().subject.people === 'solo');
      const dog = P.toggle(sec, { label: 'Dog', get: () => s().subject.dog, set: (v) => (s().subject.dog = v), hint: 'The family beagle, at their feet.' });
      P.showIf(dog, () => s().subject.people === 'group' || s().subject.model === 'mannequin');
      P.slider(sec, {
        label: 'Turn',
        min: -90,
        max: 90,
        step: 1,
        get: () => s().subject.turn,
        set: (v) => (s().subject.turn = v),
        format: (v) => (Math.abs(v) < 1 ? 'facing camera' : `${Math.abs(Math.round(v))}° ${v < 0 ? 'to cam-left' : 'to cam-right'}`),
        ticks: [[-90, 'left'], [0, 'camera'], [90, 'right']],
        hint: 'Turn the face away from the key for short lighting, toward it for broad.',
      });
      const bgd = P.slider(sec, {
        label: 'Subject to backdrop',
        min: 0.8,
        max: MAX_BACKDROP_DISTANCE,
        step: 0.05,
        get: () => Math.min(s().subject.backgroundDistance, MAX_BACKDROP_DISTANCE),
        set: (v) => (s().subject.backgroundDistance = v),
        format: (v) => `${v.toFixed(2)} m`,
        ticks: [[1, '1 m'], [2, '2 m'], [3, '3 m'], [4, '4 m']],
        hint: 'Move the subject away from the backdrop to darken it and blur it more.',
      });
      P.showIf(bgd, () => s().env.mode === 'studio');
      const props = P.group(sec, 'Depth props');
      const outdoors = () => s().env.mode === 'location' && locationSpec(s().env.location).proxy.kind === 'open';
      P.toggle(props, {
        label: 'Something in front',
        get: () => s().subject.foregroundProp,
        set: (v) => (s().subject.foregroundProp = v),
        hint: 'A potted plant indoors, a tree stump outdoors, close to the camera.',
      });
      const boulder = P.toggle(props, { label: 'Boulder behind', get: () => s().subject.backgroundProp, set: (v) => (s().subject.backgroundProp = v) });
      P.showIf(boulder, outdoors);
      const picnic = P.toggle(props, { label: 'Picnic tables', get: () => s().subject.picnic, set: (v) => (s().subject.picnic = v), hint: 'One a few metres behind, one far back: watch them blur as you open the aperture.' });
      P.showIf(picnic, outdoors);
      P.toggle(props, { label: 'Second person behind', get: () => s().subject.backgroundFigure, set: (v) => (s().subject.backgroundFigure = v) });
      P.toggle(props, { label: 'String lights (bokeh)', get: () => s().subject.bokehLights, set: (v) => (s().subject.bokehLights = v) });
    }

    // Environment
    {
      const sec = page('scene', 'Scene', 'A real studio, or a real place.');
      // Open sky (simulated sun and sky) is hidden until it has realistic
      // surroundings; its controls below stay wired up for when it returns.
      P.segmented(sec, {
        options: [
          { value: 'studio', label: 'Studio', title: 'Seamless paper on stands in a real photo studio' },
          { value: 'location', label: 'Location', title: 'Real places captured as HDRI panoramas' },
        ],
        get: () => s().env.mode,
        set: (v) => (s().env.mode = v),
      });
      const studio = P.el('div');
      sec.appendChild(studio);
      P.showIf(studio, () => s().env.mode === 'studio');
      P.color(studio, {
        label: 'Backdrop',
        swatches: BACKDROPS.map((b) => b.color),
        get: () => s().env.backdrop,
        set: (v) => (s().env.backdrop = v),
      });
      P.slider(studio, {
        label: 'Room light',
        min: 0,
        max: 400,
        step: 1,
        get: () => s().env.ambient,
        set: (v) => (s().env.ambient = v),
        format: (v) => `${Math.round(v)} lux`,
        ticks: [[0, 'dark'], [100, '100'], [200, '200'], [400, '400 lux']],
        hint: 'The studio room’s own light (windows, modelling lamps). Keep it low so your strobes do the work; turn it up to see the room.',
      });

      const out = P.el('div');
      sec.appendChild(out);
      P.showIf(out, () => s().env.mode === 'outdoor');
      P.buttons(out, TIME_PRESETS.map((t) => ({
        label: t.label,
        onClick: () => (s().env.time = t.time),
        active: () => Math.abs(s().env.time - t.time) < 0.05,
      })), 'cols-3 small');
      P.slider(out, {
        label: 'Time of day',
        min: 5,
        max: 22,
        step: 0.05,
        get: () => s().env.time,
        set: (v) => (s().env.time = v),
        format: (v) => {
          const h = Math.floor(v);
          const m = Math.round((v - h) * 60);
          const hh = ((h + 11) % 12) + 1;
          return `${hh}:${String(m === 60 ? 0 : m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
        },
        ticks: [[6, '6am'], [9, '9am'], [12, 'noon'], [15, '3pm'], [18, '6pm'], [21, '9pm']],
      });
      P.slider(out, {
        label: 'Sun direction',
        min: -180,
        max: 180,
        step: 1,
        get: () => s().env.sunAzimuth,
        set: (v) => (s().env.sunAzimuth = v),
        format: (v) => (Math.abs(v) < 1 ? 'behind camera' : Math.abs(v) > 179 ? 'behind subject' : `${Math.abs(Math.round(v))}° ${v < 0 ? 'cam-left' : 'cam-right'}`),
        ticks: [[-180, 'backlit'], [-90, 'left'], [0, 'front'], [90, 'right'], [180, 'backlit']],
        hint: '0° = sun behind you (flat light). 180° = backlight.',
      });
      P.segmented(out, {
        label: 'Sky',
        options: [
          { value: 'clear', label: 'Clear' },
          { value: 'hazy', label: 'Hazy' },
          { value: 'overcast', label: 'Overcast' },
          { value: 'shade', label: 'Open shade' },
        ],
        get: () => s().env.weather,
        set: (v) => (s().env.weather = v),
        small: true,
      });
      P.toggle(out, { label: 'Atmospheric haze', get: () => s().env.haze, set: (v) => (s().env.haze = v) });

      const loc = P.el('div');
      sec.appendChild(loc);
      P.showIf(loc, () => s().env.mode === 'location');
      P.select(loc, {
        label: 'Location',
        options: LOCATIONS.map((l) => ({ value: l.id, label: l.label })),
        get: () => s().env.location,
        set: (v) => (s().env.location = v),
      });
      P.hint(loc, () => locationSpec(s().env.location).blurb);
      P.slider(loc, {
        label: 'Sun direction',
        min: -180,
        max: 180,
        step: 1,
        get: () => s().env.sunAzimuth,
        set: (v) => (s().env.sunAzimuth = v),
        format: (v) => (Math.abs(v) < 1 ? 'behind camera' : Math.abs(v) > 179 ? 'behind subject' : `${Math.abs(Math.round(v))}° ${v < 0 ? 'cam-left' : 'cam-right'}`),
        ticks: [[-180, 'backlit'], [-90, 'left'], [0, 'front'], [90, 'right'], [180, 'backlit']],
        hint: 'Spins the whole place around the subject. Where there is no sun, it turns the brightest side.',
      });
      const shade = P.toggle(loc, {
        label: 'Subject in shade',
        get: () => s().env.inShade,
        set: (v) => (s().env.inShade = v),
        hint: 'A building blocks the sun from the subject and the ground around them: open shade. The background stays sunny.',
      });
      P.showIf(shade, () => locationSpec(s().env.location).sun);
      const locInfo = P.group(loc, '', 'readouts');
      P.readout(locInfo, 'Sun', () => {
        const li = this.world.locationInfo;
        if (!li) return '<span class="muted">loading…</span>';
        if (li.sunElevation === null) return '<span class="muted">no direct sun</span>';
        return `${li.sunElevation.toFixed(0)}° high`;
      });
      P.readout(locInfo, 'Light level', () => {
        const lux = locationSpec(s().env.location).lux;
        return lux >= 1000 ? `${(lux / 1000).toFixed(lux > 10000 ? 0 : 1)}k lux` : `${lux.toFixed(lux < 10 ? 1 : 0)} lux`;
      });
      P.readout(locInfo, 'Colour', () => `~${locationSpec(s().env.location).kelvin} K`);
      const sunInfo = P.group(out, '', 'readouts');
      P.readout(sunInfo, 'Sun', () => {
        const el = sunElevation(s().env.time);
        const dl = daylight(s().env);
        if (el < -0.5) return `${el.toFixed(0)}° <span class="muted">below horizon</span>`;
        return `${el.toFixed(0)}° high · ${Math.round(dl.sunK)} K`;
      });
      P.readout(sunInfo, 'Light level', () => {
        const dl = daylight(s().env);
        const lux = dl.sunE * Math.max(0, Math.sin(D(dl.elevation))) + dl.skyE;
        return lux >= 1000 ? `${(lux / 1000).toFixed(lux > 10000 ? 0 : 1)}k lux` : `${lux.toFixed(lux < 10 ? 1 : 0)} lux`;
      });
    }

    // View
    {
      const sec = page('view', 'View', 'Overlays, reset and credits.');
      P.toggle(sec, { label: 'Show stands & modifiers', get: () => s().view.showGear, set: (v) => (s().view.showGear = v) });
      P.toggle(sec, { label: 'Show top-view diagram', get: () => s().view.showDiagram, set: (v) => (s().view.showDiagram = v) });
      P.buttons(sec, [{ label: 'Reset everything', onClick: () => this.applyPreset(SCENARIO_PRESETS[0]) }]);
      const credits = P.el('div', 'hint credits');
      credits.innerHTML =
        'Models &amp; HDRIs: Poly Haven, Grab3D (CC0). ' +
        'People: <a href="https://github.com/microsoft/Microsoft-Rocketbox" target="_blank" rel="noopener">Microsoft Rocketbox</a> (MIT). ' +
        '<em>Infinite, 3D Head Scan</em> by Lee Perry-Smith, ' +
        '<a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>, ' +
        'based on a work at www.triplegangers.com.';
      sec.appendChild(credits);
    }
  }
}
