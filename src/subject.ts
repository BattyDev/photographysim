// The subject: ready-made models instead of a procedural figure.
//   • mannequin — Grab3D rigged wooden mannequin (CC0), posed by rotating bones;
//                 also used for the family group (two adults, two children)
//   • headscan  — Lee Perry-Smith head scan (CC BY 3.0) on a stand
//   • bust      — Poly Haven marble bust (CC0) on a plinth
// Everything loads on first use.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGLTF, loadTexture, placedModel, prepareModel } from './assets';
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
    ['RightForeArm', 'x', -100],
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
    ['LeftArm', 'z', -20],
    ['LeftArm', 'x', -22],
    ['RightArm', 'z', 20],
    ['RightArm', 'x', -22],
    ['LeftForeArm', 'x', -95],
    ['LeftForeArm', 'y', -62],
    ['RightForeArm', 'x', -88],
    ['RightForeArm', 'y', 58],
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

/** One posable copy of the mannequin. */
export class Figure {
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
      { scale: 0.72, x: -1.05, z: 0.12, yaw: 18, pose: 'standing' },
      { scale: 0.58, x: 1.0, z: 0.18, yaw: -16, pose: 'standing' },
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

type SeatId = 'chair' | 'sofa' | 'log';

/** Kenney's flat colours are toy-bright (a pink sofa, a salmon log): swap them for real-world ones. */
function recolour(root: THREE.Object3D, colours: Record<string, number>) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = ([] as THREE.Material[]).concat(mesh.material).map((m) => {
      const c = colours[m.name] ?? colours['*'];
      if (c === undefined) return m;
      const copy = (m as THREE.MeshStandardMaterial).clone();
      copy.color.setHex(c);
      copy.roughness = 0.85;
      return copy;
    }) as THREE.Material | THREE.Material[];
    if (Array.isArray(mesh.material) && mesh.material.length === 1) mesh.material = mesh.material[0];
  });
  return root;
}

const SEATS: Record<SeatId, () => Promise<THREE.Group>> = {
  // Kenney chair, ~0.92 m tall; pushed back so the seat sits under the hips.
  chair: () =>
    placedModel('models/kenney/chair.glb', 0.92).then((g) => {
      g.position.z = -0.06;
      return g;
    }),
  // Kenney lounge sofa, ~2 m wide.
  sofa: () =>
    placedModel('models/kenney/loungeSofa.glb', 0.95).then((g) => {
      g.position.z = -0.22;
      return recolour(g, { carpet: 0x4f5a66, wood: 0x6b4a32 }) as THREE.Group;
    }),
  // Kenney log, stretched along its length into a bench for two.
  log: () =>
    placedModel('models/kenney/log_large.glb', 0.44).then((g) => {
      g.scale.x *= 1.7;
      g.position.z = -0.12;
      return recolour(g, { woodBark: 0x5b4130, woodInner: 0xc9a77f }) as THREE.Group;
    }),
};

// ------------------------------------------------------------------ subject

export class Subject {
  /** Turned as a whole by the "Turn" control. */
  readonly group = new THREE.Group();
  private solo: Figure | null = null;
  private members: { figure: Figure; holder: THREE.Group }[] = [];
  private others: Partial<Record<'headscan' | 'bust', { group: THREE.Group; eye: THREE.Vector3 }>> = {};
  private seats: Partial<Record<SeatId, THREE.Group>> = {};
  private requested = new Set<string>();
  private state: SubjectState | null = null;
  private ray = new THREE.Raycaster();

  constructor(private onLoaded: () => void) {}

  private need(key: string, load: () => Promise<void>) {
    if (this.requested.has(key)) return;
    this.requested.add(key);
    load().then(() => this.onLoaded());
  }

  get isGroup(): boolean {
    return this.state?.people === 'group';
  }

  /** Bring the scene in line with the state; `indoor` picks a sofa rather than a log for seated groups. */
  apply(s: SubjectState, indoor: boolean) {
    this.state = s;
    const group = s.people === 'group';
    const model = group ? 'mannequin' : s.model;
    const seatId: SeatId | null = group ? (GROUP_POSES[s.groupPose].seated ? (indoor ? 'sofa' : 'log') : null) : model === 'mannequin' && s.pose === 'seated' ? 'chair' : null;

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
        const gltf = await loadGLTF('models/mannequin.glb');
        for (let i = 0; i < 4; i++) {
          const figure = new Figure(gltf.scene);
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
    if (seatId) {
      this.need(seatId, () =>
        SEATS[seatId]().then((g) => {
          this.seats[seatId] = g;
          this.group.add(g);
        }),
      );
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
      spec.members.forEach((ms, i) => {
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
  private seatHeight(seat: THREE.Object3D | undefined, figure: Figure): number {
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
