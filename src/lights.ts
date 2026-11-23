// Studio lights: a shadow-casting spotlight dressed with a visible modifier and stand.
import * as THREE from 'three';
import { MODIFIERS, type LightState, type ModifierSpec, type SimState } from './state';
import { kelvinLinear, type Exposure } from './world';

const D = THREE.MathUtils.degToRad;

/** On-axis output at full power for a 90 cm softbox. Strobe in cd·s, continuous in cd. */
const STROBE_FULL = 640; // ≈ f/16 at 1 m, ISO 100
const CONTINUOUS_FULL = 4000; // ≈ 4000 lux at 1 m

export function lightOutput(ls: LightState): number {
  const spec = MODIFIERS[ls.modifier];
  const base = ls.kind === 'strobe' ? STROBE_FULL : CONTINUOUS_FULL;
  return base * spec.efficiency * Math.pow(2, ls.power);
}

export function lightPosition(ls: LightState, eye: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
  const az = D(ls.azimuth);
  const el = D(ls.elevation);
  out.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(ls.distance).add(eye);
  out.y = Math.max(out.y, 0.15);
  return out;
}

export function lightTarget(ls: LightState, s: SimState, eye: THREE.Vector3, pos: THREE.Vector3, out = new THREE.Vector3()) {
  if (ls.aim === 'background') {
    const z = s.env.mode === 'studio' ? -s.subject.backgroundDistance : eye.z - 4;
    return out.set(pos.x * 0.3, 1.1, z);
  }
  return out.copy(eye);
}

/** Which lights actually fire, honouring solo. */
export function activeLights(s: SimState): LightState[] {
  const solo = s.lights.some((l) => l.solo && l.enabled);
  return s.lights.filter((l) => l.enabled && (!solo || l.solo));
}

/** sin(angular radius) of the source as seen from the face — drives wrap softness. */
/** Radius (m) of a round source with roughly the same softening power. */
export function equivalentRadius(ls: LightState): number {
  const spec = MODIFIERS[ls.modifier];
  const [w, h] = spec.aspect >= 1 ? [ls.size, ls.size / spec.aspect] : [ls.size * spec.aspect, ls.size];
  return spec.shape === 'rect' || spec.shape === 'window' ? Math.sqrt((w * h) / Math.PI) * 1.15 : ls.size / 2;
}

export function apparentWrap(ls: LightState): number {
  return Math.sin(Math.atan(equivalentRadius(ls) / Math.max(ls.distance, 0.2)));
}

export function beamAngle(spec: ModifierSpec): number {
  return D(Math.min(spec.beam, 78));
}

/**
 * Illuminance a light delivers at `point` on a surface facing `normal`
 * (lux for continuous, lux·s for strobe). Ignores shadowing.
 */
export function illuminanceAt(ls: LightState, s: SimState, eye: THREE.Vector3, point: THREE.Vector3, normal: THREE.Vector3): number {
  const pos = lightPosition(ls, eye);
  const target = lightTarget(ls, s, eye, pos);
  const toLight = pos.clone().sub(point);
  const d2 = Math.max(toLight.lengthSq(), 0.01);
  toLight.normalize();
  const cosN = Math.max(0, normal.dot(toLight));
  const spec = MODIFIERS[ls.modifier];
  const angle = beamAngle(spec);
  const axis = target.clone().sub(pos).normalize();
  const cosAxis = axis.dot(toLight.clone().negate());
  const att = THREE.MathUtils.smoothstep(cosAxis, Math.cos(angle), Math.cos(angle * (1 - spec.feather)));
  return (lightOutput(ls) * att * cosN) / d2;
}

// ---------------------------------------------------------------- visuals

const gearMat = new THREE.MeshStandardMaterial({ color: '#1b1b1d', roughness: 0.55, metalness: 0.3 });
const silverMat = new THREE.MeshStandardMaterial({ color: '#b9bcc2', roughness: 0.3, metalness: 0.9, side: THREE.DoubleSide });
const fabricMat = new THREE.MeshStandardMaterial({ color: '#151516', roughness: 0.9, side: THREE.DoubleSide });
const frameMat = new THREE.MeshStandardMaterial({ color: '#e8e4dc', roughness: 0.6 });

function faceSize(spec: ModifierSpec, size: number): [number, number] {
  return spec.aspect >= 1 ? [size, size / spec.aspect] : [size * spec.aspect, size];
}

/** Builds the modifier so that it faces +z (Object3D.lookAt convention). */
function buildModifier(spec: ModifierSpec, size: number, face: THREE.Material): { group: THREE.Group; area: number } {
  const g = new THREE.Group();
  let area = Math.PI * (size / 2) ** 2;
  const body = () => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.2), gearMat);
    return b;
  };
  switch (spec.shape) {
    case 'rect': {
      const [w, h] = faceSize(spec, size);
      area = w * h;
      const depth = Math.max(0.25, Math.min(w, h) * 0.6);
      const shellGeo = new THREE.CylinderGeometry(Math.SQRT1_2, 0.12, 1, 4, 1, true);
      shellGeo.rotateY(Math.PI / 4);
      shellGeo.rotateX(Math.PI / 2);
      const pivot = new THREE.Mesh(shellGeo, fabricMat);
      pivot.scale.set(w, h, depth);
      pivot.position.z = -depth / 2;
      g.add(pivot);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), face);
      g.add(f);
      const b = body();
      b.position.z = -depth - 0.1;
      g.add(b);
      break;
    }
    case 'octa': {
      area = 0.828 * size * size;
      const depth = size * 0.45;
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(size / 2, 0.1, depth, 8, 1, true), fabricMat);
      shell.rotation.x = Math.PI / 2;
      shell.position.z = -depth / 2;
      g.add(shell);
      const f = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 8), face);
      g.add(f);
      const b = body();
      b.position.z = -depth - 0.1;
      g.add(b);
      break;
    }
    case 'umbrella': {
      const depth = size * 0.3;
      const shell = new THREE.Mesh(new THREE.ConeGeometry(size / 2, depth, 16, 1, true), face);
      shell.rotation.x = -Math.PI / 2;
      shell.position.z = -depth / 2;
      g.add(shell);
      const back = new THREE.Mesh(new THREE.ConeGeometry(size / 2 + 0.005, depth, 16, 1, true), fabricMat);
      back.rotation.x = -Math.PI / 2;
      back.position.z = -depth / 2 - 0.006;
      g.add(back);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, size * 0.7, 6), silverMat);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = -depth / 2 + size * 0.2;
      g.add(shaft);
      const b = body();
      b.position.z = -0.12;
      g.add(b);
      break;
    }
    case 'dish': {
      const depth = size * 0.28;
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(size / 2, size * 0.12, depth, 32, 1, true), silverMat);
      shell.rotation.x = Math.PI / 2;
      shell.position.z = -depth / 2;
      g.add(shell);
      const f = new THREE.Mesh(new THREE.RingGeometry(size * 0.12, size / 2, 32), face);
      f.position.z = -depth * 0.6;
      g.add(f);
      const deflector = new THREE.Mesh(new THREE.CircleGeometry(size * 0.11, 24), silverMat);
      deflector.position.z = -depth * 0.25;
      g.add(deflector);
      const b = body();
      b.position.z = -depth - 0.1;
      g.add(b);
      break;
    }
    case 'cone': {
      const long = spec.beam < 10; // snoot
      const depth = long ? 0.28 : size * 0.7;
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(size / 2, long ? size / 2 : size * 0.3, depth, 24, 1, true), silverMat);
      shell.rotation.x = Math.PI / 2;
      shell.position.z = -depth / 2;
      g.add(shell);
      const f = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 24), face);
      f.position.z = -0.005;
      g.add(f);
      const b = body();
      b.position.z = -depth - 0.1;
      g.add(b);
      break;
    }
    case 'window': {
      const [w, h] = faceSize(spec, size);
      area = w * h;
      const f = new THREE.Mesh(new THREE.PlaneGeometry(w, h), face);
      g.add(f);
      const t = 0.05;
      const bars: [number, number, number, number][] = [
        [0, h / 2, w + t, t],
        [0, -h / 2, w + t, t],
        [-w / 2, 0, t, h + t],
        [w / 2, 0, t, h + t],
        [0, 0, t * 0.6, h],
        [0, 0, w, t * 0.6],
      ];
      for (const [x, y, bw, bh] of bars) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.08), frameMat);
        bar.position.set(x, y, 0.01);
        g.add(bar);
      }
      // Wall around the window.
      const wallMat = new THREE.MeshStandardMaterial({ color: '#cfc8bd', roughness: 0.9, side: THREE.DoubleSide });
      const W = 5;
      const H = 3.2;
      const wall = new THREE.Shape();
      wall.moveTo(-W / 2, -H / 2 - 0.3);
      wall.lineTo(W / 2, -H / 2 - 0.3);
      wall.lineTo(W / 2, H / 2 + 0.6);
      wall.lineTo(-W / 2, H / 2 + 0.6);
      const hole = new THREE.Path();
      hole.moveTo(-w / 2, -h / 2);
      hole.lineTo(-w / 2, h / 2);
      hole.lineTo(w / 2, h / 2);
      hole.lineTo(w / 2, -h / 2);
      wall.holes.push(hole);
      const wallMesh = new THREE.Mesh(new THREE.ShapeGeometry(wall), wallMat);
      wallMesh.position.z = -0.02;
      wallMesh.receiveShadow = true;
      g.add(wallMesh);
      g.userData.isWindow = true;
      break;
    }
    default: {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(size / 2, 20, 14), face);
      bulb.position.z = size / 2;
      g.add(bulb);
      const b = body();
      b.position.z = -0.1;
      g.add(b);
      area = Math.PI * (size / 2) ** 2 * 2;
    }
  }
  return { group: g, area };
}

export class StudioLight {
  readonly root = new THREE.Group();
  readonly spot: THREE.SpotLight;
  readonly head = new THREE.Group();
  readonly pickables: THREE.Object3D[] = [];
  private stand = new THREE.Group();
  private faceMat = new THREE.MeshStandardMaterial({ color: '#f4f4f4', roughness: 1, side: THREE.DoubleSide, emissive: '#ffffff' });
  private modifierKey = '';
  private modifier: THREE.Group | null = null;
  private standPole: THREE.Mesh;
  private boom: THREE.Mesh;
  private legs: THREE.Mesh[] = [];

  constructor(readonly id: LightState['id']) {
    this.spot = new THREE.SpotLight('#ffffff', 0, 0, Math.PI / 4, 0.5, 2);
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.camera.near = 0.15;
    this.spot.shadow.camera.far = 20;
    this.spot.shadow.bias = -0.0004;
    this.spot.shadow.normalBias = 0.006;
    this.root.add(this.spot, this.spot.target, this.head, this.stand);

    this.standPole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 1, 8), gearMat);
    this.boom = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 8), gearMat);
    this.stand.add(this.standPole, this.boom);
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.55, 6), gearMat);
      this.legs.push(leg);
      this.stand.add(leg);
    }
  }

  private ensureModifier(ls: LightState) {
    const key = `${ls.modifier}:${ls.size.toFixed(3)}`;
    if (key === this.modifierKey) return;
    this.modifierKey = key;
    if (this.modifier) {
      this.head.remove(this.modifier);
      this.modifier.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.geometry.dispose();
      });
    }
    const spec = MODIFIERS[ls.modifier];
    const { group, area } = buildModifier(spec, ls.size, this.faceMat);
    group.userData.area = area;
    this.modifier = group;
    this.pickables.length = 0;
    group.traverse((o) => {
      o.userData.lightId = this.id;
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = false;
        this.pickables.push(o);
      }
    });
    this.head.add(group);
  }

  update(ls: LightState, s: SimState, eye: THREE.Vector3, ex: Exposure, firing: boolean) {
    const spec = MODIFIERS[ls.modifier];
    this.ensureModifier(ls);
    const pos = lightPosition(ls, eye);
    const target = lightTarget(ls, s, eye, pos);
    const dir = target.clone().sub(pos).normalize();

    this.head.position.copy(pos);
    this.head.lookAt(target);
    // Spotlight sits just in front of the modifier face.
    this.spot.position.copy(pos).addScaledVector(dir, 0.03);
    this.spot.target.position.copy(target);
    this.spot.angle = Math.min(beamAngle(spec), D(80));
    this.spot.penumbra = spec.feather;

    const scale = ls.kind === 'strobe' ? ex.X * ex.strobe : ex.X * ex.t;
    const color = kelvinLinear(ls.kelvin).multiply(new THREE.Color(ls.gel));
    const I = lightOutput(ls) * scale;
    this.spot.color.copy(color);
    this.spot.intensity = firing ? I : 0;
    this.spot.visible = firing;

    // Shadows: softness grows with the source's apparent size (size / distance).
    const castShadow = firing && ls.shadows;
    this.spot.castShadow = castShadow;
    if (castShadow) {
      // Frame the shadow camera on the set rather than the whole beam, for resolution.
      // The penumbra itself is computed per pixel in softlight.ts.
      const fovHalf = Math.min(this.spot.angle, Math.atan(2.2 / ls.distance));
      this.spot.shadow.focus = fovHalf / this.spot.angle;
    }

    // Modifier face brightness: luminance ≈ intensity / area.
    const area = (this.modifier?.userData.area as number) || 0.1;
    const lum = firing ? (lightOutput(ls) * scale) / area : 0;
    this.faceMat.emissive.copy(color);
    this.faceMat.emissiveIntensity = lum;

    this.updateStand(pos, eye, s.view.showGear, ls);
    this.head.visible = s.view.showGear || this.modifier?.userData.isWindow === true;
  }

  private updateStand(pos: THREE.Vector3, eye: THREE.Vector3, show: boolean, ls: LightState) {
    const isWindow = ls.modifier === 'window';
    this.stand.visible = show && !isWindow;
    if (!this.stand.visible) return;
    // Lights high above or in front of the subject hang from a boom.
    const horiz = new THREE.Vector2(pos.x - eye.x, pos.z - eye.z);
    const hd = horiz.length();
    const needsBoom = ls.elevation > 32 || hd < 0.7;
    const boomLen = needsBoom ? 0.9 : 0;
    const dirH = hd > 1e-3 ? horiz.clone().divideScalar(hd) : new THREE.Vector2(0, 1);
    const base = new THREE.Vector2(eye.x, eye.z).addScaledVector(dirH, hd + boomLen);
    const poleTop = needsBoom ? pos.y + 0.05 : pos.y - 0.08;
    this.standPole.scale.set(1, Math.max(poleTop, 0.2), 1);
    this.standPole.position.set(base.x, poleTop / 2, base.y);
    if (needsBoom) {
      const a = new THREE.Vector3(base.x, poleTop, base.y);
      const b = new THREE.Vector3(pos.x, poleTop, pos.z);
      const len = a.distanceTo(b) + 0.4;
      this.boom.visible = true;
      this.boom.scale.set(1, len, 1);
      this.boom.position.copy(a).lerp(b, 0.5);
      this.boom.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    } else {
      this.boom.visible = false;
    }
    this.legs.forEach((leg, i) => {
      const a = (i / 3) * Math.PI * 2;
      leg.position.set(base.x + Math.cos(a) * 0.22, 0.14, base.y + Math.sin(a) * 0.22);
      leg.rotation.set(0, 0, 0);
      leg.lookAt(base.x, 0.42, base.y);
      leg.rotateX(Math.PI / 2);
    });
  }
}
