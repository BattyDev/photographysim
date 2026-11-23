// Real-looking people: Microsoft Rocketbox avatars (MIT), rigged with a 3ds Max
// Biped skeleton. They take their poses from an invisible wooden mannequin:
// every pose is set on the mannequin as before, then each joint's turn is
// copied onto the matching Biped bone ("retargeting").
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGLTF, prepareModel } from './assets';
import type { PoseId } from './state';
import { Figure } from './subject';

/** The people on hand, by file name in models/rocketbox/. */
export type PersonId = 'female_adult_15' | 'male_adult_08' | 'female_adult_07' | 'female_child_01' | 'male_child_01';

/** Mannequin bone → Biped bone (without its "Bip01 " prefix), with the joints that give each bone's direction. */
const MAP: [mq: string, rb: string, tip?: [mq: string, rb: string]][] = [
  ['Hips', 'Pelvis'],
  ['Spine02', 'Spine'],
  ['Spine01', 'Spine1'],
  ['Spine', 'Spine2'],
  ['neck', 'Neck'],
  ['Head', 'Head'],
  ['LeftShoulder', 'L Clavicle', ['LeftArm', 'L UpperArm']],
  ['LeftArm', 'L UpperArm', ['LeftForeArm', 'L Forearm']],
  ['LeftForeArm', 'L Forearm', ['LeftHand', 'L Hand']],
  ['LeftHand', 'L Hand'],
  ['RightShoulder', 'R Clavicle', ['RightArm', 'R UpperArm']],
  ['RightArm', 'R UpperArm', ['RightForeArm', 'R Forearm']],
  ['RightForeArm', 'R Forearm', ['RightHand', 'R Hand']],
  ['RightHand', 'R Hand'],
  ['LeftUpLeg', 'L Thigh', ['LeftLeg', 'L Calf']],
  ['LeftLeg', 'L Calf', ['LeftFoot', 'L Foot']],
  ['LeftFoot', 'L Foot', ['LeftToeBase', 'L Toe0']],
  ['RightUpLeg', 'R Thigh', ['RightLeg', 'R Calf']],
  ['RightLeg', 'R Calf', ['RightFoot', 'R Foot']],
  ['RightFoot', 'R Foot', ['RightToeBase', 'R Toe0']],
];

/** A hand keeps the turn its forearm was given to line up with the mannequin. */
const ALIGN_LIKE: Record<string, string> = { LeftHand: 'LeftForeArm', RightHand: 'RightForeArm' };

interface Link {
  mq: THREE.Bone;
  rb: THREE.Bone;
  /** Rest orientations relative to the person's root. */
  mqRest: THREE.Quaternion;
  rbRest: THREE.Quaternion;
  /** Turns the Biped bone's rest direction onto the mannequin's. */
  align: THREE.Quaternion;
}

/** One posable person, with the same interface as the mannequin Figure. */
export class Person {
  readonly root = new THREE.Group();
  /** Holds the avatar; shifted so the feet stand on the floor. */
  private body = new THREE.Group();
  private driver: Figure;
  private driverScale: number;
  private bones = new Map<string, THREE.Bone>();
  private links: Link[] = [];
  private poseKey = '';

  constructor(avatar: THREE.Object3D, mannequin: THREE.Object3D) {
    const model = SkeletonUtils.clone(avatar);
    prepareModel(model);
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones.set(o.name.replace(/^Bip0\d[ _]?/, '').replace(/_/g, ' '), o as THREE.Bone);
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          const sm = mat as THREE.MeshStandardMaterial;
          // Hair cards and lashes: cut out by their alpha, seen from both sides.
          if (sm.name.endsWith('opacity')) {
            sm.alphaTest = 0.45;
            sm.transparent = false;
            sm.side = THREE.DoubleSide;
          }
        }
      }
    });
    this.body.add(model);
    this.root.add(this.body);

    this.driver = new Figure(mannequin);
    this.driver.root.visible = false;
    this.root.add(this.driver.root);
    this.root.updateMatrixWorld(true);

    // Size the mannequin to this person, by head height.
    const headY = (b: THREE.Object3D) => b.getWorldPosition(new THREE.Vector3()).y;
    this.driverScale = headY(this.bone('Head')) / headY(this.driver.bone('Head'));
    // Rest = the mannequin's rest pose at that size (no turns applied).
    this.driver.resetPose(this.driverScale);
    this.root.updateMatrixWorld(true);

    const rel = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());
    const pos = (o: THREE.Object3D) => o.getWorldPosition(new THREE.Vector3());
    const aligns = new Map<string, THREE.Quaternion>();
    for (const [mqName, rbName, tip] of MAP) {
      const mq = this.driver.bone(mqName);
      const rb = this.bone(rbName);
      let align = new THREE.Quaternion();
      if (tip) {
        const dMq = pos(this.driver.bone(tip[0])).sub(pos(mq)).normalize();
        const dRb = pos(this.bone(tip[1])).sub(pos(rb)).normalize();
        align.setFromUnitVectors(dRb, dMq);
      } else if (ALIGN_LIKE[mqName]) {
        align = aligns.get(ALIGN_LIKE[mqName])!.clone();
      }
      aligns.set(mqName, align);
      this.links.push({ mq, rb, mqRest: rel(mq), rbRest: rel(rb), align });
    }
    for (const l of this.links) l.rb.userData.rest = l.rb.quaternion.clone();
  }

  private bone(name: string): THREE.Bone {
    const b = this.bones.get(name);
    if (!b) throw new Error(`no bone ${name}`);
    return b;
  }

  hipPoint(out = new THREE.Vector3()): THREE.Vector3 {
    return this.bone('Pelvis').getWorldPosition(out);
  }

  eyePosition(out: THREE.Vector3): THREE.Vector3 {
    const l = this.bone('LEye').getWorldPosition(new THREE.Vector3());
    return this.bone('REye').getWorldPosition(out).add(l).multiplyScalar(0.5);
  }

  /** `scale` is ignored: a real person keeps their own size. */
  setPose(id: PoseId, _scale = 1, seatY = 0.47) {
    const key = `${id}|${seatY.toFixed(3)}`;
    if (key === this.poseKey) return;
    this.poseKey = key;
    this.body.position.set(0, 0, 0);
    this.root.updateMatrixWorld(true);
    this.driver.setPose(id, this.driverScale, seatY);
    this.root.updateMatrixWorld(true);

    // Turns are worked out relative to the person's root, so a turned person poses the same.
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    const rootQinv = rootQ.clone().invert();
    const q = new THREE.Quaternion();
    const pq = new THREE.Quaternion();
    for (const l of this.links) {
      // How far the mannequin bone turned from rest, applied to the lined-up Biped bone.
      const turned = l.mq.getWorldQuaternion(q).premultiply(rootQinv);
      const delta = turned.multiply(l.mqRest.clone().invert());
      const target = delta.multiply(l.align).multiply(l.rbRest).premultiply(rootQ);
      l.rb.parent!.getWorldQuaternion(pq);
      l.rb.quaternion.copy(pq.invert().multiply(target));
      l.rb.updateMatrixWorld(true);
    }
    // Hips where the mannequin's hips are.
    const pelvis = this.bone('Pelvis');
    const hips = this.driver.bone('Hips').getWorldPosition(new THREE.Vector3());
    pelvis.position.copy(pelvis.parent!.worldToLocal(hips));
    this.root.updateMatrixWorld(true);
    if (id !== 'seated') {
      // Lowest toe on the floor.
      const toes = ['L Toe0', 'R Toe0'].map((n) => this.root.worldToLocal(this.bone(n).getWorldPosition(new THREE.Vector3())).y);
      this.body.position.y = 0.012 - Math.min(toes[0], toes[1]);
      this.root.updateMatrixWorld(true);
    }
  }
}

/**
 * The family beagle (Rocketbox, MIT), standing. `place` sets where it stands
 * and which way its body points; its head then turns toward the camera.
 */
export class Dog {
  readonly root = new THREE.Group();
  private head: THREE.Bone;
  private neck: THREE.Bone;
  private restHead: THREE.Quaternion;
  private restNeck: THREE.Quaternion;

  constructor(scene: THREE.Object3D) {
    const model = SkeletonUtils.clone(scene);
    prepareModel(model);
    this.root.add(model);
    const bones = new Map<string, THREE.Bone>();
    model.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones.set(o.name.replace(/^beagle[ _]/, '').replace(/_/g, ' '), o as THREE.Bone);
    });
    this.head = bones.get('Head')!;
    this.neck = bones.get('Neck2')!;
    this.restHead = this.head.quaternion.clone();
    this.restNeck = this.neck.quaternion.clone();
  }

  /** Stand at (x, z) in the subject's frame, body turned `yaw` (deg), looking `look` (deg) further round. */
  place(x: number, z: number, yaw: number, look: number) {
    this.root.position.set(x, 0, z);
    this.root.rotation.y = THREE.MathUtils.degToRad(yaw);
    this.head.quaternion.copy(this.restHead);
    this.neck.quaternion.copy(this.restNeck);
    this.root.updateMatrixWorld(true);
    // Split the look between the neck and the head, each about the dog's own up axis.
    const up = new THREE.Vector3(0, 1, 0);
    for (const b of [this.neck, this.head]) {
      const pq = b.parent!.getWorldQuaternion(new THREE.Quaternion());
      const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
      const r = new THREE.Quaternion().setFromAxisAngle(up.clone().applyQuaternion(rootQ), THREE.MathUtils.degToRad(look / 2));
      b.quaternion.premultiply(pq.clone().invert().multiply(r).multiply(pq));
      b.updateMatrixWorld(true);
    }
  }
}

export async function loadDog(): Promise<Dog> {
  const gltf = await loadGLTF('models/rocketbox/dog_beagle_01.glb');
  return new Dog(gltf.scene);
}

export async function loadPerson(id: PersonId): Promise<Person> {
  const [avatar, mannequin] = await Promise.all([loadGLTF(`models/rocketbox/${id}.glb`), loadGLTF('models/mannequin.glb')]);
  return new Person(avatar.scene, mannequin.scene);
}
