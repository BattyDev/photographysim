// The subject: ready-made models instead of a procedural figure.
//   • mannequin — Grab3D rigged wooden mannequin (CC0), posed by rotating bones;
//                 also used for the family group (two adults, two children)
//   • headscan  — Lee Perry-Smith head scan (CC BY 3.0) on a stand
//   • bust      — Poly Haven marble bust (CC0) on a plinth
// Everything loads on first use.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGLTF, loadTexture, placedModel, prepareModel } from './assets';
import { loadPerson, type PersonId } from './person';
import type { GroupPoseId, PoseId, SubjectState } from './state';

const D = THREE.MathUtils.degToRad;

/** Rotations about the figure's own axes (deg), applied in order on top of the rest pose.
 * They are applied child-first (see Figure.setPose), so limb turns are relative to the body. */
type BoneTurn = [bone: string, axis: 'x' | 'y' | 'z', deg: number];

// The model faces +z, so its left is +x (camera right). Rest pose is an A-pose,
// arms ~60° down. +y turns rotate the face toward camera right; −x tips the chin up.
const ARMS_RELAXED: BoneTurn[] = [
  ['LeftArm', 'z', -24],
  ['RightArm', 'z', 24],
  ['LeftForeArm', 'x', -12],
  ['RightForeArm', 'x', -12],
];

const POSES: Record<PoseId, BoneTurn[]> = {
  standing: [...ARMS_RELAXED, ['LeftUpLeg', 'z', 1.5], ['RightUpLeg', 'z', -1.5]],
  // Body angled ~40° to camera left, face back toward the lens: short/broad light.
  turned: [
    ['Hips', 'y', -38],
    ['Spine01', 'y', 6],
    ['Spine', 'y', 8],
    ['neck', 'y', 8],
    ['Head', 'y', 10],
    ['Head', 'z', -4],
    ['LeftArm', 'z', -22],
    ['RightArm', 'z', 26],
    ['LeftForeArm', 'x', -18],
    ['RightForeArm', 'x', -10],
    ['RightUpLeg', 'x', -4],
    ['RightLeg', 'x', 8],
  ],
  // Full side view: split and rim light, the edge of the face against the background.
  profile: [
    ['Hips', 'y', -82],
    ['Spine', 'y', -4],
    ['Head', 'x', -4],
    ['LeftArm', 'z', -24],
    ['RightArm', 'z', 24],
    ['LeftForeArm', 'x', -10],
    ['RightForeArm', 'x', -14],
    ['LeftUpLeg', 'x', -3],
    ['LeftLeg', 'x', 6],
  ],
  // Back to camera, looking back over the shoulder: shows off rim/hair light.
  overshoulder: [
    ['Hips', 'y', 150],
    ['Spine01', 'y', -18],
    ['Spine', 'y', -22],
    ['neck', 'y', -34],
    ['Head', 'y', -44],
    ['Head', 'z', 6],
    ['LeftArm', 'z', -22],
    ['RightArm', 'z', 24],
    ['LeftForeArm', 'x', -10],
    ['RightForeArm', 'x', -10],
  ],
  // Face lifted into the light: catchlights, butterfly shadow, a lit neck.
  chinup: [
    ['neck', 'x', -8],
    ['Head', 'x', -18],
    ['Head', 'y', -12],
    ['Hips', 'y', -12],
    ['LeftArm', 'z', -22],
    ['RightArm', 'z', 22],
    ['LeftForeArm', 'x', -14],
    ['RightForeArm', 'x', -14],
  ],
  // Hand to chin: the hand and forearm catch light and throw shadow near the face.
  thinker: [
    ['Hips', 'y', -18],
    ['Head', 'x', 6],
    ['Head', 'y', 6],
    // Solved so the right wrist rests just under the chin with the forearm upright.
    ['RightArm', 'x', -70],
    ['RightArm', 'z', 60],
    ['RightForeArm', 'x', -106],
    ['RightForeArm', 'y', 140],
    ['LeftArm', 'z', -24],
    ['LeftForeArm', 'x', -12],
  ],
  hip: [
    ['Hips', 'y', -14],
    ['Hips', 'z', -3],
    ['Spine01', 'z', 3],
    ['Spine', 'y', 6],
    ['Head', 'y', 6],
    ['Head', 'z', 5],
    ['RightArm', 'z', 24],
    ['RightForeArm', 'x', -10],
    ['LeftArm', 'z', 8],
    ['LeftArm', 'y', 30],
    ['LeftForeArm', 'z', -82],
    ['LeftHand', 'z', 20],
    ['RightUpLeg', 'z', -4],
    ['RightUpLeg', 'x', -5],
    ['RightLeg', 'x', 10],
  ],
  crossed: [
    ['Head', 'x', 3],
    ['LeftArm', 'z', -24],
    ['LeftArm', 'x', -8],
    ['RightArm', 'z', 24],
    ['RightArm', 'x', -8],
    ['LeftForeArm', 'x', -78],
    ['LeftForeArm', 'y', -78],
    ['RightForeArm', 'x', -72],
    ['RightForeArm', 'y', 74],
    ['LeftUpLeg', 'z', 2],
    ['RightUpLeg', 'z', -2],
  ],
  seated: [
    ['LeftUpLeg', 'x', -84],
    ['RightUpLeg', 'x', -80],
    ['LeftUpLeg', 'y', 6],
    ['RightUpLeg', 'y', -8],
    ['LeftLeg', 'x', 82],
    ['RightLeg', 'x', 74],
    ['Spine01', 'x', 4],
    ['Head', 'x', -3],
    ['LeftArm', 'z', -18],
    ['LeftArm', 'x', -28],
    ['RightArm', 'z', 18],
    ['RightArm', 'x', -28],
    ['LeftForeArm', 'x', -42],
    ['LeftForeArm', 'y', -22],
    ['RightForeArm', 'x', -42],
    ['RightForeArm', 'y', 22],
  ],
};

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

/** Anything that takes the poses: the mannequin, or a person driven by it. */
export interface Poseable {
  readonly root: THREE.Object3D;
  setPose(id: PoseId, scale?: number, seatY?: number): void;
  hipPoint(out?: THREE.Vector3): THREE.Vector3;
  eyePosition(out: THREE.Vector3): THREE.Vector3;
}

/** One posable copy of the mannequin. */
export class Figure implements Poseable {
  readonly root = new THREE.Group();
  private bones = new Map<string, THREE.Bone>();
  private rest = new Map<THREE.Bone, THREE.Quaternion>();
  private hipsRest = new THREE.Vector3();
  /** Point between the eyes, in the Head bone's local frame. */
  private eyeLocal = new THREE.Vector3();
  private poseKey = '';

  constructor(scene: THREE.Object3D) {
    const model = SkeletonUtils.clone(scene);
    prepareModel(model);
    this.root.add(model);
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) {
        this.bones.set(o.name, o as THREE.Bone);
        this.rest.set(o as THREE.Bone, o.quaternion.clone());
      }
    });
    const hips = this.bones.get('Hips')!;
    this.hipsRest.copy(hips.position);
    // The head is faceless: put the "eyes" ~11 cm above the Head joint, at the face plane.
    const head = this.bones.get('Head')!;
    const eyeWorld = head.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.11, 0.1));
    head.worldToLocal(this.eyeLocal.copy(eyeWorld));
  }

  bone(name: string): THREE.Bone {
    const b = this.bones.get(name);
    if (!b) throw new Error(`no bone ${name}`);
    return b;
  }

  /** Back to the rest pose at `scale`, standing at the origin. */
  resetPose(scale = 1) {
    this.poseKey = '';
    for (const [b, q] of this.rest) b.quaternion.copy(q);
    this.bones.get('Hips')!.position.copy(this.hipsRest);
    this.root.position.set(0, 0, 0);
    this.root.scale.setScalar(scale);
    this.root.updateMatrixWorld(true);
  }

  /** Hip joint position in the figure's parent frame (for finding the seat under it). */
  hipPoint(out = new THREE.Vector3()): THREE.Vector3 {
    return this.bones.get('Hips')!.getWorldPosition(out);
  }

  /**
   * Pose the figure. `seatY` (world height of the seat surface) is needed for
   * the seated pose; otherwise the feet are planted on y = 0.
   */
  setPose(id: PoseId, scale = 1, seatY = 0.47) {
    const key = `${id}|${scale}|${seatY.toFixed(3)}`;
    if (key === this.poseKey) return;
    this.poseKey = key;
    for (const [b, q] of this.rest) b.quaternion.copy(q);
    const hips = this.bones.get('Hips')!;
    hips.position.copy(this.hipsRest);
    this.root.position.set(0, 0, 0);
    this.root.scale.setScalar(scale);
    this.root.updateMatrixWorld(true);

    // Rotations are about the figure's own axes, so a turned or rotated figure poses the same.
    const rootQinv = this.root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const pq = new THREE.Quaternion();
    const rq = new THREE.Quaternion();
    // Children first: a parent's turn then carries the already-posed limbs with it,
    // so arm and head turns stay relative to the body however far the hips twist.
    const depth = (name: string) => {
      let d = 0;
      for (let o = this.bones.get(name)?.parent; o; o = o.parent) d++;
      return d;
    };
    const turns = [...POSES[id]].sort((a, b) => depth(b[0]) - depth(a[0]));
    for (const [name, axis, deg] of turns) {
      const bone = this.bones.get(name);
      if (!bone) continue;
      bone.parent!.getWorldQuaternion(pq).premultiply(rootQinv);
      rq.setFromAxisAngle(AXES[axis], D(deg));
      // local' = parent⁻¹ · R · parent · local  → rotation R about a figure axis through the joint.
      bone.quaternion.premultiply(pq.clone().invert().multiply(rq).multiply(pq));
      bone.updateMatrixWorld(true);
    }
    if (id === 'seated') {
      // Drop the figure until the backs of the thighs sit on the seat.
      const hipY = hips.getWorldPosition(new THREE.Vector3()).y;
      this.root.position.y = seatY + 0.07 * scale - hipY;
      this.root.position.z = 0.02;
    } else {
      // Keep the lowest foot on the floor.
      const feet = ['LeftToeBase', 'RightToeBase'].map((n) => this.bones.get(n)!.getWorldPosition(new THREE.Vector3()).y);
      this.root.position.y = 0.026 * scale - Math.min(feet[0], feet[1]);
    }
    this.root.updateMatrixWorld(true);
  }

  eyePosition(out: THREE.Vector3): THREE.Vector3 {
    const head = this.bones.get('Head')!;
    head.updateWorldMatrix(true, false);
    return out.copy(this.eyeLocal).applyMatrix4(head.matrixWorld);
  }
}

export async function loadFigure(): Promise<Figure> {
  const gltf = await loadGLTF('models/mannequin.glb');
  return new Figure(gltf.scene);
}

/** The family, in GROUP_POSES member order: father, mother, older and younger child. */
const FAMILY: PersonId[] = ['male_adult_08', 'female_adult_07', 'male_child_01', 'female_child_01'];
/** The person for solo portraits. */
const SOLO: PersonId = 'female_adult_15';

// ------------------------------------------------------------------ group

interface MemberSpec {
  /** 1 = 1.80 m adult. */
  scale: number;
  x: number;
  z: number;
  yaw: number; // deg
  pose: PoseId;
}

/** Family of four: two adults behind/beside two children (0.72 ≈ 1.30 m, 0.58 ≈ 1.04 m). */
export const GROUP_POSES: Record<GroupPoseId, { label: string; members: MemberSpec[]; seated?: boolean }> = {
  standing: {
    label: 'Standing',
    members: [
      { scale: 1, x: -0.34, z: -0.24, yaw: 10, pose: 'standing' },
      { scale: 0.93, x: 0.33, z: -0.22, yaw: -12, pose: 'standing' },
      { scale: 0.72, x: -0.15, z: 0.26, yaw: 6, pose: 'standing' },
      { scale: 0.58, x: 0.25, z: 0.3, yaw: -8, pose: 'standing' },
    ],
  },
  casual: {
    label: 'Casual',
    members: [
      { scale: 1, x: -0.15, z: -0.2, yaw: 18, pose: 'crossed' },
      { scale: 0.93, x: 0.6, z: -0.18, yaw: -20, pose: 'hip' },
      { scale: 0.72, x: -0.77, z: 0.12, yaw: 22, pose: 'turned' },
      { scale: 0.58, x: 0.21, z: 0.32, yaw: -6, pose: 'chinup' },
    ],
  },
  seated: {
    label: 'Seated',
    seated: true,
    members: [
      { scale: 1, x: -0.42, z: -0.02, yaw: 4, pose: 'seated' },
      { scale: 0.93, x: 0.42, z: -0.02, yaw: -4, pose: 'seated' },
      // The children stand behind the seat, between and behind their parents.
      { scale: 0.72, x: -0.86, z: -0.66, yaw: 10, pose: 'standing' },
      { scale: 0.58, x: 0.86, z: -0.64, yaw: -10, pose: 'standing' },
    ],
  },
};

// ------------------------------------------------------------------ others

/** Lee Perry-Smith head scan on a slim stand, eyes at ~1.62 m. */
async function loadHeadScan(): Promise<{ group: THREE.Group; eye: THREE.Vector3 }> {
  const [gltf, map, normal, spec] = await Promise.all([
    loadGLTF('models/leeperrysmith/LeePerrySmith.glb'),
    loadTexture('models/leeperrysmith/Map-COL.jpg', true),
    loadTexture('models/leeperrysmith/Map-NOR.jpg', false),
    loadTexture('models/leeperrysmith/Map-SPEC.jpg', false),
  ]);
  const mesh = (gltf.scene.getObjectByProperty('isMesh', true) as THREE.Mesh).clone();
  mesh.material = new THREE.MeshPhysicalMaterial({
    map,
    normalMap: normal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.52,
    specularIntensityMap: spec,
    specularIntensity: 0.9,
    sheen: 0.25,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color('#ffd9c9'),
  });
  const k = 0.058; // scan units → metres (chin to crown ≈ 23 cm)
  mesh.scale.setScalar(k);
  const head = new THREE.Group();
  head.add(mesh);
  const box = new THREE.Box3().setFromObject(head);
  const eyeY = 1.62;
  // Eyes sit roughly 0.72 of the way up the scan (which includes the shoulders).
  head.position.y = eyeY - (box.min.y + (box.max.y - box.min.y) * 0.72);
  const group = new THREE.Group();
  group.add(head);
  const metal = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.4, metalness: 0.6 });
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 16), metal);
  const bottom = head.position.y + box.min.y + 0.02;
  stand.scale.y = bottom;
  stand.position.set(0, bottom / 2, -0.03);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.025, 32), metal);
  base.position.y = 0.0125;
  group.add(stand, base);
  prepareModel(group);
  return { group, eye: new THREE.Vector3(0, eyeY, box.max.z * 0.82) };
}

/** Marble bust on a plinth, eyes at ~1.6 m. */
async function loadBust(): Promise<{ group: THREE.Group; eye: THREE.Vector3 }> {
  const bust = await placedModel('models/polyhaven/marble_bust_01/marble_bust_01_1k.gltf', 0.6);
  const plinthH = 1.14;
  bust.position.y = plinthH;
  const group = new THREE.Group();
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, plinthH, 0.36),
    new THREE.MeshStandardMaterial({ color: '#d9d5cf', roughness: 0.8 }),
  );
  plinth.position.y = plinthH / 2;
  group.add(plinth, bust);
  prepareModel(group);
  const box = new THREE.Box3().setFromObject(bust);
  return { group, eye: new THREE.Vector3(0, box.min.y + (box.max.y - box.min.y) * 0.8, box.max.z - 0.07) };
}

type SeatId = 'box' | 'pair' | 'bench' | 'sofa';

/** Where the subject is: decides what they sit on. */
export type Setting = 'studio' | 'home' | 'outdoors';

/** Front edge of the living-room sofa's seat, relative to the hips of a seated figure. */
const SOFA_Z = -0.24;

// Apple boxes: the plywood boxes every portrait studio sits people on. A
// "full apple" is 20 × 12 × 8 in; stood on end it makes a 51 cm seat.
const APPLE = { w: 0.305, h: 0.508, d: 0.203 };

/** Birch plywood: pale with soft grain running along `along` the face, plies showing at the edges. */
function plywood(w: number, h: number, handle: boolean): THREE.CanvasTexture {
  const px = 220;
  const c = document.createElement('canvas');
  c.width = Math.round(w * px);
  c.height = Math.round(h * px);
  const g = c.getContext('2d')!;
  g.fillStyle = '#c9a77a';
  g.fillRect(0, 0, c.width, c.height);
  // Grain: long wavy streaks.
  for (let i = 0; i < 70; i++) {
    const y0 = Math.random() * c.height;
    const amp = 2 + Math.random() * 6;
    const f = 0.01 + Math.random() * 0.03;
    g.strokeStyle = `rgba(${Math.random() < 0.6 ? '120,82,45' : '235,210,170'},${0.08 + Math.random() * 0.12})`;
    g.lineWidth = 0.6 + Math.random() * 1.8;
    g.beginPath();
    for (let x = 0; x <= c.width; x += 4) g.lineTo(x, y0 + Math.sin(x * f + i) * amp);
    g.stroke();
  }
  // Handling marks and grime.
  for (let i = 0; i < 25; i++) {
    g.fillStyle = `rgba(70,50,30,${0.03 + Math.random() * 0.05})`;
    g.beginPath();
    g.ellipse(Math.random() * c.width, Math.random() * c.height, 4 + Math.random() * 14, 3 + Math.random() * 9, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  // The other panels' plies show along every edge.
  const e = Math.max(3, Math.round(0.018 * px));
  g.fillStyle = 'rgba(95,70,45,0.35)';
  g.fillRect(0, 0, c.width, e * 0.35);
  g.fillRect(0, c.height - e * 0.35, c.width, e * 0.35);
  g.fillRect(0, 0, e * 0.35, c.height);
  g.fillRect(c.width - e * 0.35, 0, e * 0.35, c.height);
  if (handle) {
    // Hand hole: a rounded slot, dark inside, with a lit lower lip.
    const hw = c.width * 0.42;
    const hh = Math.min(c.height * 0.16, 0.035 * px);
    const x = (c.width - hw) / 2;
    const y = c.height * 0.2;
    g.fillStyle = '#1a120b';
    g.beginPath();
    g.roundRect(x, y, hw, hh, hh / 2);
    g.fill();
    g.strokeStyle = 'rgba(230,200,150,0.6)';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x + hh / 2, y + hh);
    g.lineTo(x + hw - hh / 2, y + hh);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** One full apple box stood on end, its seat at y = 0.508. */
function appleBox(): THREE.Mesh {
  const { w, h, d } = APPLE;
  const mat = (tw: number, th: number, handle: boolean) =>
    new THREE.MeshStandardMaterial({ map: plywood(tw, th, handle), roughness: 0.78 });
  // Box faces: +x, −x, +y, −y, +z, −z. The hand holes are in the 12 × 20 sides.
  const side = mat(d, h, false);
  const front = mat(w, h, true);
  const top = mat(w, d, false);
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, top, top, front, front]);
  box.position.y = h / 2;
  box.castShadow = box.receiveShadow = true;
  return box;
}

const SEATS: Record<SeatId, (loaded: () => void) => THREE.Group> = {
  // One box under a single sitter, set back so the hips land on it.
  box: () => {
    const g = new THREE.Group();
    const b = appleBox();
    b.position.z = -0.06;
    b.rotation.y = 0.08;
    g.add(b);
    return g;
  },
  // One box under each seated adult of the family.
  pair: () => {
    const g = new THREE.Group();
    for (const m of GROUP_POSES.seated.members.filter((m) => m.pose === 'seated')) {
      const b = appleBox();
      b.position.set(m.x, b.position.y, m.z - 0.06);
      b.rotation.y = D(m.yaw);
      g.add(b);
    }
    return g;
  },
  // Outdoors the family sits on a real park bench (Poly Haven, CC0).
  bench: (loaded) => {
    const g = new THREE.Group();
    placedModel('models/polyhaven/painted_wooden_bench/painted_wooden_bench_1k.gltf').then((m) => {
      m.position.z = -0.12;
      g.add(m);
      loaded();
    });
    return g;
  },
  // At home the family sits on a three-seat sofa (Poly Haven, CC0).
  sofa: (loaded) => {
    const g = new THREE.Group();
    placedModel('models/polyhaven/sofa_03/sofa_03_1k.gltf').then((m) => {
      m.position.z = SOFA_Z;
      g.add(m);
      loaded();
    });
    return g;
  },
};

// ------------------------------------------------------------------ subject

export class Subject {
  /** Turned as a whole by the "Turn" control. */
  readonly group = new THREE.Group();
  private solo: Poseable | null = null;
  private members: { figure: Poseable; holder: THREE.Group }[] = [];
  private others: Partial<Record<'headscan' | 'bust', { group: THREE.Group; eye: THREE.Vector3 }>> = {};
  private seats: Partial<Record<SeatId, THREE.Group>> = {};
  private requested = new Set<string>();
  private state: SubjectState | null = null;
  private ray = new THREE.Raycaster();
  /** On the sofa the children sit too, at the ends. */
  private onSofa = false;

  constructor(private onLoaded: () => void) {}

  private need(key: string, load: () => Promise<void>) {
    if (this.requested.has(key)) return;
    this.requested.add(key);
    load().then(() => this.onLoaded());
  }

  get isGroup(): boolean {
    return this.state?.people === 'group';
  }

  /**
   * Bring the scene in line with the state. `setting` picks the seat: apple
   * boxes in the studio, a park bench outdoors, the sofa at home.
   */
  apply(s: SubjectState, setting: Setting = 'studio') {
    this.state = s;
    const group = s.people === 'group';
    const model = group ? 'mannequin' : s.model;
    const sits = group ? GROUP_POSES[s.groupPose].seated : model === 'mannequin' && s.pose === 'seated';
    const seatId: SeatId | null = !sits ? null : setting === 'home' ? 'sofa' : group ? (setting === 'outdoors' ? 'bench' : 'pair') : 'box';
    this.onSofa = seatId === 'sofa';

    // Fetch what this view needs.
    if (model === 'mannequin' && !group) {
      this.need('solo', () =>
        loadPerson(SOLO).then((f) => {
          this.solo = f;
          this.group.add(f.root);
        }),
      );
    }
    if (group) {
      this.need('group', async () => {
        const people = await Promise.all(FAMILY.map((id) => loadPerson(id)));
        for (const figure of people) {
          const holder = new THREE.Group();
          holder.add(figure.root);
          this.group.add(holder);
          this.members.push({ figure, holder });
        }
      });
    }
    if (model === 'headscan' || model === 'bust') {
      this.need(model, () =>
        (model === 'headscan' ? loadHeadScan() : loadBust()).then((o) => {
          this.others[model] = o;
          this.group.add(o.group);
        }),
      );
    }
    if (seatId && !this.seats[seatId]) {
      const g = SEATS[seatId](() => this.onLoaded());
      this.seats[seatId] = g;
      this.group.add(g);
    }

    // Visibility.
    if (this.solo) this.solo.root.visible = !group && model === 'mannequin';
    for (const m of this.members) m.holder.visible = group;
    for (const k of Object.keys(this.others) as ('headscan' | 'bust')[]) this.others[k]!.group.visible = !group && k === model;
    for (const k of Object.keys(this.seats) as SeatId[]) this.seats[k]!.visible = k === seatId;

    // Turn and pose.
    this.group.rotation.y = D(s.turn);
    this.group.updateMatrixWorld(true);
    const seat = seatId ? this.seats[seatId] : undefined;
    if (!group && this.solo) this.solo.setPose(s.pose, 1, this.seatHeight(seat, this.solo));
    if (group && this.members.length) {
      const spec = GROUP_POSES[s.groupPose];
      spec.members.forEach((m0, i) => {
        const ms = this.onSofa && m0.pose !== 'seated' ? { ...m0, pose: 'seated' as const, x: Math.sign(m0.x) * 0.8, z: -0.02, yaw: -Math.sign(m0.x) * 6 } : m0;
        const { figure, holder } = this.members[i];
        holder.position.set(ms.x, 0, ms.z);
        holder.rotation.y = D(ms.yaw);
        holder.updateMatrixWorld(true);
        // Seat height under where this member's hips will be.
        figure.setPose(ms.pose, ms.scale, ms.pose === 'seated' ? this.seatHeight(seat, figure) : 0.47);
      });
    }
  }

  /** Height of the seat surface under a figure's hips, by casting a ray down onto the seat. */
  private seatHeight(seat: THREE.Object3D | undefined, figure: Poseable): number {
    if (!seat) return 0.47;
    seat.updateMatrixWorld(true);
    const hip = figure.hipPoint();
    this.ray.set(new THREE.Vector3(hip.x, 3, hip.z), new THREE.Vector3(0, -1, 0));
    const hit = this.ray.intersectObject(seat, true)[0];
    return hit ? hit.point.y : 0.47;
  }

  /** Where the lights aim and the camera focuses: the eyes, or the middle of the group's faces. */
  eyePosition(target = new THREE.Vector3()): THREE.Vector3 {
    this.group.updateMatrixWorld(true);
    const s = this.state;
    if (!s) return target.set(0, 1.64, 0.05);
    if (s.people === 'group') {
      if (!this.members.length) return target.set(0, GROUP_POSES[s.groupPose].seated ? 1.15 : 1.35, 0.05);
      target.set(0, 0, 0);
      const e = new THREE.Vector3();
      for (const m of this.members) target.add(m.figure.eyePosition(e));
      return target.multiplyScalar(1 / this.members.length);
    }
    if (s.model === 'mannequin') {
      if (this.solo) return this.solo.eyePosition(target);
      return target.set(0, s.pose === 'seated' ? 1.2 : 1.64, 0.05);
    }
    const o = this.others[s.model];
    if (!o) return target.set(0, 1.62, 0.1);
    return target.copy(o.eye).applyMatrix4(this.group.matrixWorld);
  }
}
