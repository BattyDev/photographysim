// A seamless paper backdrop as it stands in a real studio: a roll of paper on a
// crossbar between two stands, hanging straight down and sweeping out across
// the floor so there is no corner line behind the subject.
import * as THREE from 'three';

/** Standard roll widths: 107" for one person, 140" for groups. */
export const PAPER_SOLO = 2.72;
export const PAPER_WIDE = 3.55;
/** Height of the crossbar (m). */
const TOP = 2.78;
const ROLL_R = 0.07;
/** Radius of the sweep where the paper meets the floor. */
const SWEEP_R = 0.75;

/** Faint fibre and mottling, multiplied by the paper colour. */
function paperTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f4f4f4';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    const r = 30 + Math.random() * 90;
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, r);
    const a = 0.01 + Math.random() * 0.012;
    grad.addColorStop(0, Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.save();
    g.translate(Math.random() * size, Math.random() * size);
    g.fillStyle = grad;
    g.fillRect(-r, -r, r * 2, r * 2);
    g.restore();
  }
  for (let i = 0; i < size * size * 0.25; i++) {
    const v = 236 + ((Math.random() * 24) | 0);
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(Math.random() * size, Math.random() * size, 1, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** A thin cylinder from a to b. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  m.castShadow = m.receiveShadow = true;
  return m;
}

/**
 * Paper profile: down from the roll, round the sweep, out along the floor.
 * x across the roll, z forward from the hanging plane.
 */
function paperGeometry(width: number, floorLen: number): THREE.BufferGeometry {
  const prof: [number, number][] = []; // [y, z]
  const yTop = TOP - ROLL_R * 0.3;
  const vSteps = 16;
  for (let i = 0; i <= vSteps; i++) prof.push([yTop - (i / vSteps) * (yTop - SWEEP_R), 0]);
  const arc = 18;
  for (let i = 1; i <= arc; i++) {
    const a = (i / arc) * (Math.PI / 2);
    prof.push([SWEEP_R - Math.sin(a) * SWEEP_R + 0.003 * Math.sin(a), SWEEP_R - Math.cos(a) * SWEEP_R]);
  }
  const fSteps = Math.max(2, Math.ceil(floorLen / 0.25));
  for (let i = 1; i <= fSteps; i++) prof.push([0.003, SWEEP_R + (i / fSteps) * floorLen]);

  // Arc length for v, so the texture doesn't stretch round the sweep.
  const len = [0];
  for (let i = 1; i < prof.length; i++) len.push(len[i - 1] + Math.hypot(prof[i][0] - prof[i - 1][0], prof[i][1] - prof[i - 1][1]));
  const cols = 40;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let p = 0; p < prof.length; p++) {
    const [y, z] = prof[p];
    // Hanging paper is never perfectly flat: soft vertical waves, strongest near the top.
    const hang = y > SWEEP_R ? (y - SWEEP_R) / (yTop - SWEEP_R) : 0;
    for (let c = 0; c <= cols; c++) {
      const x = (c / cols - 0.5) * width;
      const wave = hang * (0.007 * Math.sin(x * 4.3 + 0.6) + 0.004 * Math.sin(x * 9.1 + 2.1));
      // The edges curl back a little.
      const edge = Math.pow(Math.abs(c / cols - 0.5) * 2, 6) * 0.025 * (0.3 + hang);
      pos.push(x, y, z + wave - edge);
      uv.push(x / 1.6, len[p] / 1.6);
    }
  }
  for (let p = 0; p < prof.length - 1; p++) {
    for (let c = 0; c < cols; c++) {
      const a = p * (cols + 1) + c;
      const b = a + cols + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export class Backdrop {
  readonly group = new THREE.Group();
  readonly paperMat = new THREE.MeshStandardMaterial({ roughness: 0.92, side: THREE.DoubleSide });
  private rollMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
  private metal = new THREE.MeshStandardMaterial({ color: '#8e9094', metalness: 0.85, roughness: 0.32 });
  private rubber = new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: 0.8 });
  private paper: THREE.Mesh;
  private rig = new THREE.Group();
  private shape = '';

  constructor() {
    this.paperMat.map = paperTexture();
    this.paper = new THREE.Mesh(new THREE.BufferGeometry(), this.paperMat);
    this.paper.castShadow = this.paper.receiveShadow = true;
    this.paper.name = 'backdrop';
    this.group.add(this.paper, this.rig);
  }

  /**
   * @param z      where the paper hangs
   * @param width  roll width
   * @param floorEnd  z where the paper ends on the floor
   */
  update(z: number, width: number, floorEnd: number, colour: string) {
    this.group.position.z = z;
    this.paperMat.color.set(colour);
    this.rollMat.color.set(colour).multiplyScalar(0.82);
    const floorLen = Math.max(0.2, floorEnd - z - SWEEP_R);
    const key = `${width}|${floorLen.toFixed(2)}`;
    if (key === this.shape) return;
    if (width.toFixed(2) !== this.shape.split('|')[0]) this.buildRig(width);
    this.shape = key;
    this.paper.geometry.dispose();
    this.paper.geometry = paperGeometry(width, floorLen);
  }

  /** Roll, crossbar and two three-legged stands. */
  private buildRig(width: number) {
    for (const c of this.rig.children) (c as THREE.Mesh).geometry?.dispose();
    this.rig.clear();
    const add = (m: THREE.Mesh) => {
      m.castShadow = m.receiveShadow = true;
      this.rig.add(m);
      return m;
    };
    const rz = -ROLL_R;
    const roll = add(new THREE.Mesh(new THREE.CylinderGeometry(ROLL_R, ROLL_R, width, 40), this.rollMat));
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, TOP, rz);
    const core = add(new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, width + 0.02, 20), new THREE.MeshStandardMaterial({ color: '#8a6d4c', roughness: 0.9 })));
    core.rotation.z = Math.PI / 2;
    core.position.copy(roll.position);
    const sx = width / 2 + 0.16;
    this.rig.add(rod(new THREE.Vector3(-sx - 0.04, TOP, rz), new THREE.Vector3(sx + 0.04, TOP, rz), 0.014, this.metal));
    for (const side of [-1, 1]) {
      const x = side * sx;
      // Two-section pole with a clamp where they meet, and a cup holding the crossbar.
      this.rig.add(rod(new THREE.Vector3(x, 0.42, rz), new THREE.Vector3(x, 1.55, rz), 0.019, this.metal));
      this.rig.add(rod(new THREE.Vector3(x, 1.5, rz), new THREE.Vector3(x, TOP + 0.05, rz), 0.014, this.metal));
      this.rig.add(rod(new THREE.Vector3(x, 1.5, rz), new THREE.Vector3(x, 1.58, rz), 0.026, this.rubber));
      this.rig.add(rod(new THREE.Vector3(x, TOP - 0.03, rz), new THREE.Vector3(x, TOP + 0.04, rz), 0.024, this.rubber));
      this.rig.add(rod(new THREE.Vector3(x, 0.5, rz), new THREE.Vector3(x, 0.6, rz), 0.03, this.rubber));
      // Tripod: two legs splayed outward (front and back) and one straight in,
      // tucked behind the hanging paper, so none crosses the sweep.
      for (const off of [Math.PI / 3, -Math.PI / 3, Math.PI]) {
        const th = (side * Math.PI) / 2 + off;
        const foot = new THREE.Vector3(x + Math.sin(th) * 0.48, 0.012, rz + Math.cos(th) * 0.48);
        this.rig.add(rod(new THREE.Vector3(x, 0.55, rz), foot, 0.011, this.metal));
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.024, 12), this.rubber);
        pad.position.copy(foot).setY(0.012);
        add(pad);
      }
    }
  }
}

/** Roll width for the current shoot: the wide roll for a group. */
export function paperWidth(s: { subject: { people: string } }): number {
  return s.subject.people === 'group' ? PAPER_WIDE : PAPER_SOLO;
}

/** Furthest the subject can stand from the paper inside the studio room (m). */
export const MAX_BACKDROP_DISTANCE = 4.5;
