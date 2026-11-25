// The subject: ready-made models instead of a procedural figure.
//   • mannequin — Grab3D rigged wooden mannequin (CC0), posed by rotating bones;
//                 also used for the family group (two adults, two children)
//   • headscan  — Lee Perry-Smith head scan (CC BY 3.0) on a stand
//   • bust      — Poly Haven marble bust (CC0) on a plinth
// Everything loads on first use.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGLTF, loadTexture, placedModel, prepareModel } from './assets';
import { bench, sofa } from './woodwork';
import { isSeated, type GroupPoseId, type PoseId, type SubjectState } from './state';

const D = THREE.MathUtils.degToRad;

/** Rotations about the figure's own axes (deg), applied in order on top of the rest pose.
 * They are applied child-first (see Figure.setPose), so limb turns are relative to the body. */
type BoneTurn = [bone: string, axis: 'x' | 'y' | 'z', deg: number];

// The model faces +z, so its left is +x (camera right). Rest pose is an A-pose,
// arms ~60° down. +y turns rotate the face toward camera right; −x tips the chin up;
// +z tilts the head toward camera left. UpLeg −x swings a thigh forward, Leg +x bends the knee.

/**
 * Weight on one leg (contrapposto), the way people really stand: the hips drop
 * on the free side, the shoulders tilt back the other way, the free knee bends
 * and its foot turns out. `side` is the person's own left or right; `k` scales it.
 * List it before any Hips 'y' turn so the tilt is in the body's own frame.
 */
function weightOn(side: 'left' | 'right', k = 1): BoneTurn[] {
  const s = side === 'right' ? 1 : -1;
  const [free, stand] = side === 'right' ? ['Left', 'Right'] : ['Right', 'Left'];
  return [
    ['Hips', 'z', -5 * s * k],
    ['Spine02', 'z', 6 * s * k],
    ['Spine', 'z', 2 * s * k],
    [`${free}UpLeg`, 'z', 10 * s * k],
    [`${free}UpLeg`, 'x', -8 * k],
    [`${free}UpLeg`, 'y', 14 * s * k],
    [`${free}Leg`, 'x', 16 * k],
    [`${free}Foot`, 'x', 6 * k],
    [`${stand}UpLeg`, 'z', 8 * s * k],
    [`${stand}UpLeg`, 'y', -6 * s * k],
  ];
}

/** Arms hanging loose, elbows softly bent, not quite mirror images. */
const ARMS_LOOSE: BoneTurn[] = [
  ['LeftArm', 'z', -32],
  ['LeftArm', 'x', 2],
  ['LeftForeArm', 'x', -22],
  ['LeftForeArm', 'y', -4],
  ['RightArm', 'z', 30],
  ['RightArm', 'x', -4],
  ['RightForeArm', 'x', -30],
  ['RightForeArm', 'y', 8],
];

const POSES: Record<PoseId, BoneTurn[]> = {
  // Relaxed: weight on one leg, a slight angle and head tilt.
  standing: [
    ...weightOn('right'),
    ['Hips', 'y', -8],
    ['neck', 'x', 2],
    ['Head', 'z', -4],
    ['Head', 'y', 6],
    ...ARMS_LOOSE,
  ],
  // Body angled ~40° to camera left, face back toward the lens: short/broad light.
  turned: [
    ...weightOn('right', 0.9),
    ['Hips', 'y', -38],
    ['Spine01', 'y', 6],
    ['Spine', 'y', 8],
    ['neck', 'y', 8],
    ['Head', 'y', 10],
    ['Head', 'z', -5],
    ['LeftArm', 'z', -30],
    ['LeftArm', 'x', 4],
    ['LeftForeArm', 'x', -24],
    ['RightArm', 'z', 28],
    ['RightArm', 'x', -6],
    ['RightForeArm', 'x', -28],
    ['RightForeArm', 'y', 10],
  ],
  // Full side view: split and rim light, the edge of the face against the background.
  profile: [
    ...weightOn('right', 0.7),
    ['Hips', 'y', -82],
    ['Spine', 'y', -4],
    ['Head', 'x', -4],
    ['Head', 'z', -3],
    ['LeftArm', 'z', -30],
    ['LeftArm', 'x', -4],
    ['LeftForeArm', 'x', -26],
    ['RightArm', 'z', 26],
    ['RightArm', 'x', 4],
    ['RightForeArm', 'x', -18],
  ],
  // Back to camera, looking back over the shoulder: shows off rim/hair light.
  overshoulder: [
    ...weightOn('left', 0.8),
    ['Hips', 'y', 150],
    ['Spine01', 'y', -18],
    ['Spine', 'y', -22],
    ['neck', 'y', -34],
    ['Head', 'y', -44],
    ['Head', 'z', 6],
    ...ARMS_LOOSE,
    // A touch wider on the near arm, so its hand clears the hip.
    ['LeftArm', 'z', 5],
  ],
  // Face lifted into the light: catchlights, butterfly shadow, a lit neck.
  chinup: [
    ...weightOn('right', 0.7),
    ['Hips', 'y', -12],
    ['neck', 'x', -8],
    ['Head', 'x', -18],
    ['Head', 'y', -12],
    ['Head', 'z', 4],
    ...ARMS_LOOSE,
  ],
  // Hand to chin: the hand and forearm catch light and throw shadow near the face.
  thinker: [
    ...weightOn('right', 0.6),
    ['Hips', 'y', -18],
    ['Head', 'x', 10],
    ['Head', 'y', 6],
    ['Head', 'z', -3],
    // Solved so the right wrist rests just under the chin with the forearm upright.
    ['RightArm', 'x', -78],
    ['RightArm', 'z', 60],
    ['RightForeArm', 'x', -92],
    ['RightForeArm', 'y', 140],
    ['LeftArm', 'z', -32],
    ['LeftForeArm', 'x', -22],
  ],
  hip: [
    ...weightOn('left', 1.2),
    ['Hips', 'y', -14],
    ['Spine', 'y', 6],
    ['Head', 'y', 6],
    ['Head', 'z', 5],
    ['RightArm', 'z', 30],
    ['RightArm', 'x', -4],
    ['RightForeArm', 'x', -26],
    ['RightForeArm', 'y', 8],
    ['LeftArm', 'z', 24],
    ['LeftArm', 'y', 38],
    ['LeftForeArm', 'z', -88],
    ['LeftHand', 'z', 30],
  ],
  crossed: [
    ...weightOn('left', 0.7),
    ['Hips', 'y', 6],
    ['Head', 'x', 3],
    ['Head', 'z', 3],
    ['Head', 'y', -4],
    ['LeftArm', 'z', -24],
    ['LeftArm', 'x', -8],
    ['RightArm', 'z', 24],
    ['RightArm', 'x', -8],
    ['LeftForeArm', 'x', -84],
    ['LeftForeArm', 'y', -78],
    ['RightForeArm', 'x', -66],
    ['RightForeArm', 'y', 74],
  ],
  // Hands loosely clasped in front at the waist.
  clasped: [
    ...weightOn('right', 0.7),
    ['Hips', 'y', -10],
    ['Head', 'z', -5],
    ['Head', 'y', 4],
    ['Head', 'x', 3],
    ['LeftArm', 'z', -30],
    ['LeftArm', 'x', -8],
    ['LeftForeArm', 'x', -26],
    ['LeftForeArm', 'y', -42],
    ['RightArm', 'z', 30],
    ['RightArm', 'x', -8],
    ['RightForeArm', 'x', -26],
    ['RightForeArm', 'y', 42],
  ],
  // Hands in the front pockets, thumbs out.
  pockets: [
    ...weightOn('right', 0.8),
    ['Hips', 'y', -8],
    ['Head', 'z', -3],
    ['Head', 'y', 6],
    ['Head', 'x', -2],
    ['LeftArm', 'z', -20],
    ['LeftArm', 'x', 10],
    ['LeftForeArm', 'x', -32],
    ['LeftForeArm', 'y', -34],
    ['LeftHand', 'z', -20],
    ['RightArm', 'z', 20],
    ['RightArm', 'x', 10],
    ['RightForeArm', 'x', -32],
    ['RightForeArm', 'y', 34],
    ['RightHand', 'z', 20],
  ],
  // Hand behind the head, elbow out: opens up the body and lifts the arm into the light.
  hair: [
    ...weightOn('right', 0.8),
    ['Hips', 'y', -12],
    ['Head', 'z', 8],
    ['Head', 'y', 6],
    ['Head', 'x', 2],
    ['LeftArm', 'z', -30],
    ['LeftArm', 'x', -2],
    ['LeftForeArm', 'x', -24],
    ['LeftForeArm', 'y', -6],
    ['RightForeArm', 'z', -128],
    ['RightArm', 'z', -84],
    ['RightArm', 'x', -32],
    ['RightHand', 'x', 30],
  ],
  // Candid: body angled one way, face turned off to the other side, eyes off the lens.
  lookaway: [
    ...weightOn('left', 0.9),
    ['Hips', 'y', -22],
    ['Spine', 'y', -6],
    ['neck', 'y', 24],
    ['neck', 'x', 4],
    ['Head', 'y', 34],
    ['Head', 'x', 8],
    ['Head', 'z', -6],
    ['LeftArm', 'z', -30],
    ['LeftArm', 'x', -4],
    ['LeftForeArm', 'x', -26],
    ['LeftForeArm', 'y', -6],
    ['RightArm', 'z', 30],
    ['RightArm', 'x', 4],
    ['RightForeArm', 'x', -18],
    ['RightForeArm', 'y', 6],
  ],
  // Mid-stride toward the camera, arms swinging against the legs.
  walking: [
    ['Hips', 'y', -12],
    ['Spine', 'y', 8],
    ['Head', 'y', 6],
    ['Head', 'z', -2],
    ['neck', 'x', -2],
    ['LeftUpLeg', 'x', -17],
    ['LeftLeg', 'x', 8],
    ['LeftFoot', 'x', -8],
    ['RightUpLeg', 'x', 11],
    ['RightLeg', 'x', 20],
    ['RightFoot', 'x', 12],
    ['LeftUpLeg', 'z', 2],
    ['RightUpLeg', 'z', -1],
    ['LeftArm', 'z', -30],
    ['LeftArm', 'x', 12],
    ['LeftForeArm', 'x', -14],
    ['RightArm', 'z', 30],
    ['RightArm', 'x', -14],
    ['RightForeArm', 'x', -34],
    ['RightForeArm', 'y', 10],
  ],
  seated: [
    ['LeftUpLeg', 'x', -84],
    ['RightUpLeg', 'x', -80],
    // Knees together, so a skirt drapes over them instead of stretching flat.
    ['LeftUpLeg', 'y', -3],
    ['RightUpLeg', 'y', 3],
    ['LeftUpLeg', 'z', -3],
    ['RightUpLeg', 'z', 3],
    ['LeftLeg', 'x', 82],
    ['RightLeg', 'x', 74],
    ['Spine01', 'x', 4],
    ['Spine', 'y', 4],
    ['Head', 'x', -3],
    ['Head', 'z', -4],
    ['LeftArm', 'z', -22],
    ['LeftArm', 'x', -14],
    ['RightArm', 'z', 22],
    ['RightArm', 'x', -18],
    ['LeftForeArm', 'x', -58],
    ['LeftForeArm', 'y', -22],
    ['RightForeArm', 'x', -54],
    ['RightForeArm', 'y', 22],
  ],
  // Seated, leaning forward with the forearms on the thighs, looking up at the lens.
  leaning: [
    ['LeftUpLeg', 'x', -80],
    ['RightUpLeg', 'x', -84],
    // Knees together, so a skirt drapes over them instead of stretching flat.
    ['LeftUpLeg', 'y', -2],
    ['RightUpLeg', 'y', 2],
    ['LeftUpLeg', 'z', -3],
    ['RightUpLeg', 'z', 3],
    ['LeftLeg', 'x', 70],
    ['RightLeg', 'x', 84],
    ['Spine02', 'x', 20],
    ['Spine01', 'x', 14],
    ['Spine', 'x', 8],
    ['neck', 'x', -14],
    ['Head', 'x', -20],
    ['Head', 'z', -4],
    ['LeftArm', 'z', -26],
    ['LeftArm', 'x', -40],
    ['RightArm', 'z', 26],
    ['RightArm', 'x', -40],
    ['LeftForeArm', 'x', -70],
    ['LeftForeArm', 'y', -45],
    ['RightForeArm', 'x', -70],
    ['RightForeArm', 'y', 45],
  ],
};

// Dev only: lets poses be tried live from the console (window.__poses).
if (import.meta.env.DEV) (window as unknown as { __poses: typeof POSES }).__poses = POSES;

const AXES = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

/** Anything that takes the poses (the mannequin). */
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
  private skin!: THREE.SkinnedMesh;
  /** Vertex indices, by the bone that mostly moves them: what rests on a seat, and each lower leg and foot. */
  private seatVerts: number[] = [];
  private footVerts: Record<'Left' | 'Right', number[]> = { Left: [], Right: [] };

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
      if ((o as THREE.SkinnedMesh).isSkinnedMesh && !this.skin) this.skin = o as THREE.SkinnedMesh;
    });
    // Sort the vertices by their main bone, to find contact with the floor and seats.
    const g = this.skin.geometry;
    const si = g.attributes.skinIndex;
    const sw = g.attributes.skinWeight;
    const names = this.skin.skeleton.bones.map((b) => b.name);
    for (let i = 0; i < si.count; i++) {
      let best = 0;
      for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
      const n = names[si.getComponent(i, best)];
      if (n === 'Hips' || n.endsWith('UpLeg')) this.seatVerts.push(i);
      for (const side of ['Left', 'Right'] as const) if (n === `${side}Leg` || n === `${side}Foot` || n === `${side}ToeBase`) this.footVerts[side].push(i);
    }
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
    this.root.updateMatrixWorld(true);
    if (isSeated(id)) {
      // Rest the underside of the seat and thighs (near the hips) on the seat, not in it.
      const hp = hips.getWorldPosition(new THREE.Vector3());
      const near = (v: THREE.Vector3) => Math.hypot(v.x - hp.x, v.z - hp.z) < 0.2 * scale;
      this.root.position.y += seatY + 0.004 - this.lowest(this.seatVerts, near);
      // Children perch nearer the front, so their short thighs carry the knees past the cushion edge.
      this.root.position.z = scale < 0.85 ? 0.08 : 0.02;
      this.root.updateMatrixWorld(true);
      for (const side of ['Left', 'Right'] as const) this.reachFloor(side, scale >= 0.85);
    } else {
      // Stand on the lowest point of the soles.
      this.root.position.y += 0.002 - this.lowest([...this.footVerts.Left, ...this.footVerts.Right]);
      this.root.updateMatrixWorld(true);
    }
  }

  /** Lowest world height among these vertices (optionally only those passing `keep`), as posed now. */
  private lowest(verts: number[], keep?: (v: THREE.Vector3) => boolean): number {
    const v = new THREE.Vector3();
    let min = Infinity;
    for (const i of verts) {
      this.skin.getVertexPosition(i, v).applyMatrix4(this.skin.matrixWorld);
      if ((!keep || keep(v)) && v.y < min) min = v.y;
    }
    return min;
  }

  /**
   * Seated: open or close the knee so the foot rests on the floor instead of
   * going through it. Adults' feet are brought down to touch; a child's may
   * dangle if they don't reach.
   */
  private reachFloor(side: 'Left' | 'Right', touch: boolean) {
    const leg = this.bones.get(`${side}Leg`)!;
    const base = leg.quaternion.clone();
    const rootQinv = this.root.getWorldQuaternion(new THREE.Quaternion()).invert();
    const pq = leg.parent!.getWorldQuaternion(new THREE.Quaternion()).premultiply(rootQinv);
    const pqInv = pq.clone().invert();
    const rq = new THREE.Quaternion();
    const tryAngle = (deg: number) => {
      rq.setFromAxisAngle(AXES.x, D(deg));
      leg.quaternion.copy(base).premultiply(pqInv.clone().multiply(rq).multiply(pq));
      leg.updateMatrixWorld(true);
      return this.lowest(this.footVerts[side]);
    };
    if (!touch) {
      // A child's legs stick out over the seat edge when they don't reach the floor.
      const out = tryAngle(-30);
      if (out >= 0.002) return;
    }
    const now = tryAngle(0);
    if (now >= 0.002 && (!touch || now <= 0.03)) return;
    // Smallest change that lands the foot between 2 mm and 2 cm above the floor;
    // failing that, the clear position closest to the floor.
    let best: { deg: number; y: number } | null = null;
    let fallback: { deg: number; y: number } | null = null;
    for (let step = 2; step <= 80; step += 2)
      for (const deg of [-step, step]) {
        if (deg > 40) continue;
        const y = tryAngle(deg);
        if (y >= 0.002 && y <= 0.02 && !best) best = { deg, y };
        if (y >= 0.002 && (!fallback || y < fallback.y)) fallback = { deg, y };
      }
    const pick = best ?? (touch || now < 0.002 ? fallback : null);
    tryAngle(pick ? pick.deg : 0);
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
      { scale: 1, x: -0.34, z: -0.24, yaw: 10, pose: 'pockets' },
      { scale: 0.93, x: 0.33, z: -0.22, yaw: -12, pose: 'standing' },
      { scale: 0.72, x: -0.15, z: 0.26, yaw: 6, pose: 'pockets' },
      { scale: 0.58, x: 0.25, z: 0.3, yaw: -8, pose: 'clasped' },
    ],
  },
  casual: {
    label: 'Casual',
    members: [
      { scale: 1, x: -0.15, z: -0.2, yaw: 18, pose: 'crossed' },
      { scale: 0.93, x: 0.6, z: -0.18, yaw: -20, pose: 'hip' },
      { scale: 0.72, x: -0.77, z: 0.12, yaw: 22, pose: 'lookaway' },
      { scale: 0.58, x: 0.21, z: 0.32, yaw: -6, pose: 'walking' },
    ],
  },
  seated: {
    label: 'Seated',
    seated: true,
    members: [
      { scale: 1, x: -0.42, z: -0.02, yaw: 4, pose: 'leaning' },
      { scale: 0.93, x: 0.42, z: -0.02, yaw: -4, pose: 'seated' },
      // The children stand at the ends of the seat, a step forward and turned
      // in, each beside a parent: their heads and the seated parents' make one
      // gentle line across the frame. (On the sofa they sit at the ends instead.)
      { scale: 0.72, x: -0.98, z: 0.12, yaw: 16, pose: 'clasped' },
      { scale: 0.58, x: 0.96, z: 0.14, yaw: -16, pose: 'standing' },
    ],
  },
};

// Dev only: lets the group layouts be tried live from the console (window.__group).
if (import.meta.env.DEV) (window as unknown as { __group: typeof GROUP_POSES }).__group = GROUP_POSES;

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
    // Stained darker than raw plywood so the pale mannequins stand out against it.
    new THREE.MeshStandardMaterial({ map: plywood(tw, th, handle), color: '#b98b5c', roughness: 0.78 });
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
    for (const m of GROUP_POSES.seated.members.filter((m) => isSeated(m.pose))) {
      const b = appleBox();
      b.position.set(m.x, b.position.y, m.z - 0.06);
      b.rotation.y = D(m.yaw);
      g.add(b);
    }
    return g;
  },
  // Outdoors the family sits on a wooden park bench (woodwork.ts).
  bench: (loaded) => {
    const g = new THREE.Group();
    const m = bench();
    m.position.z = -0.12;
    g.add(m);
    queueMicrotask(loaded);
    return g;
  },
  // At home the family sits on a wooden three-seat sofa.
  sofa: (loaded) => {
    const g = new THREE.Group();
    const m = sofa();
    m.position.z = SOFA_Z;
    g.add(m);
    queueMicrotask(loaded);
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
    const sits = group ? GROUP_POSES[s.groupPose].seated : model === 'mannequin' && isSeated(s.pose);
    const seatId: SeatId | null = !sits ? null : setting === 'home' ? 'sofa' : group ? (setting === 'outdoors' ? 'bench' : 'pair') : 'box';
    this.onSofa = seatId === 'sofa';

    // Fetch what this view needs.
    if (model === 'mannequin' && !group) {
      this.need('solo', () =>
        loadFigure().then((f) => {
          this.solo = f;
          this.group.add(f.root);
        }),
      );
    }
    if (group) {
      this.need('group', async () => {
        // Father, mother, older and younger child: the same mannequin at four sizes.
        const people = await Promise.all([0, 1, 2, 3].map(() => loadFigure()));
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
        const ms = this.onSofa && !isSeated(m0.pose) ? { ...m0, pose: 'seated' as const, x: Math.sign(m0.x) * 0.92, z: -0.02, yaw: -Math.sign(m0.x) * 6 } : m0;
        const { figure, holder } = this.members[i];
        holder.position.set(ms.x, 0, ms.z);
        holder.rotation.y = D(ms.yaw);
        holder.updateMatrixWorld(true);
        // Seat height under where this member's hips will be.
        figure.setPose(ms.pose, ms.scale, isSeated(ms.pose) ? this.seatHeight(seat, figure) : 0.47);
      });
    }
  }

  /** Height of the seat surface under a figure's hips, by casting a ray down onto the seat. */
  private seatHeight(seat: THREE.Object3D | undefined, figure: Poseable): number {
    if (!seat) return 0.47;
    seat.updateMatrixWorld(true);
    const hip = figure.hipPoint();
    // Probe a small patch under the hips, so a gap between cushions or slats isn't taken for the seat.
    let top = -Infinity;
    for (const [dx, dz] of [[0, 0], [-0.09, 0], [0.09, 0], [0, 0.08], [-0.09, 0.08], [0.09, 0.08]]) {
      this.ray.set(new THREE.Vector3(hip.x + dx, 3, hip.z + dz), new THREE.Vector3(0, -1, 0));
      const hit = this.ray.intersectObject(seat, true)[0];
      if (hit) top = Math.max(top, hit.point.y);
    }
    return top > -Infinity ? top : 0.47;
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
      return target.set(0, isSeated(s.pose) ? 1.2 : 1.64, 0.05);
    }
    const o = this.others[s.model];
    if (!o) return target.set(0, 1.62, 0.1);
    return target.copy(o.eye).applyMatrix4(this.group.matrixWorld);
  }
}
