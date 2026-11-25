// The wooden sets around the mannequins, built like one handmade toy: an
// open-front dollhouse living room, a plain photo studio and a model-railway
// park. Same woods and paints as the furniture (woodwork.ts).
// Metres, y up, floor top at y = 0; the subject stands at the origin facing +z
// and the camera is on the +z side. The furniture the app places itself (sofa,
// armchair, tables, picnic set, lamps, stump, boulder) is not built here.
import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { block, post, group, paint, woodMaterial, PAINT, type Finish, type Wood } from './woodwork';

const Y = new THREE.Vector3(0, 1, 0);

/** Small seeded random, so every load lays the set out the same way. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function baseMaterial(f: Finish): THREE.MeshStandardMaterial {
  return f.startsWith('#') ? paint(f) : woodMaterial(f as Wood);
}

/** Material for a large surface: the grain repeats about every `tile` m both ways, instead of stretching. */
const surfaceCache = new Map<string, THREE.MeshStandardMaterial>();
function surface(f: Finish, w: number, d: number, tile = 2): THREE.MeshStandardMaterial {
  const key = `${f}|${Math.round(w / tile)}|${Math.round(d / tile)}`;
  let m = surfaceCache.get(key);
  if (!m) {
    const base = baseMaterial(f);
    m = base.clone();
    m.map = base.map!.clone();
    m.map.repeat.set(Math.max(1, Math.round(w / tile)), Math.max(1, Math.round(d / tile)));
    surfaceCache.set(key, m);
  }
  return m;
}

/** A big block (floor, wall, slab) with the grain tiled across it. */
function slab(f: Finish, w: number, h: number, d: number, x: number, y: number, z: number, r = 0.01): THREE.Mesh {
  const m = block(f, w, h, d, x, y, z, r);
  const dims = [w, h, d].sort((a, b) => b - a);
  m.material = surface(f, dims[0], dims[1]);
  return m;
}

/** A round rod of radius r from point a to point b. */
function rod(f: Finish, r: number, a: THREE.Vector3, b: THREE.Vector3, seg = 10): THREE.Mesh {
  const d = b.clone().sub(a);
  const m = post(f, r, r, d.length(), 0, 0, 0, seg);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(Y, d.normalize());
  return m;
}

/** Many copies of one shape in one draw call. */
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[]): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, mats.length);
  mats.forEach((x, i) => m.setMatrixAt(i, x));
  m.computeBoundingSphere();
  return m;
}

function placed(x: number, y: number, z: number, sx: number, sy = sx, sz = sx, ry = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, ry), new THREE.Vector3(sx, sy, sz));
}

function named(name: string, ...parts: THREE.Object3D[]): THREE.Group {
  const g = group(...parts);
  g.name = name;
  return g;
}

// ------------------------------------------------------------------ walls

interface Opening {
  /** Start and end along the wall. */
  a: number;
  b: number;
  /** Bottom and top. */
  y0: number;
  y1: number;
}

/**
 * A straight wall from `from` to `to` along x (`along` = 'x', standing at
 * z = `at`) or along z (standing at x = `at`), with rectangular openings.
 * Built from solid pieces around the holes, so light and the view pass through.
 */
function wall(f: Finish, along: 'x' | 'z', from: number, to: number, at: number, height: number, thick: number, openings: Opening[] = []): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  const piece = (a: number, b: number, y0: number, y1: number) => {
    if (b - a < 0.001 || y1 - y0 < 0.001) return;
    const mid = (a + b) / 2;
    const ym = (y0 + y1) / 2;
    out.push(along === 'x' ? slab(f, b - a, y1 - y0, thick, mid, ym, at, 0.004) : slab(f, thick, y1 - y0, b - a, at, ym, mid, 0.004));
  };
  let cursor = from;
  for (const o of [...openings].sort((p, q) => p.a - q.a)) {
    piece(cursor, o.a, 0, height);
    piece(o.a, o.b, 0, o.y0);
    piece(o.a, o.b, o.y1, height);
    cursor = o.b;
  }
  piece(cursor, to, 0, height);
  return out;
}

/** Walnut frame round a window opening, with a cross mullion. */
function windowFrame(along: 'x' | 'z', o: Opening, at: number, thick: number, cross = true): THREE.Mesh[] {
  const bar = 0.06;
  const depth = thick + 0.04;
  const w = o.b - o.a;
  const h = o.y1 - o.y0;
  const c = (o.a + o.b) / 2;
  const ym = (o.y0 + o.y1) / 2;
  const box = (len: number, hh: number, pos: number, y: number) =>
    along === 'x' ? block('walnut', len, hh, depth, pos, y, at, 0.008) : block('walnut', depth, hh, len, at, y, pos, 0.008);
  const parts = [
    box(bar, h, o.a + bar / 2, ym),
    box(bar, h, o.b - bar / 2, ym),
    box(w, bar, c, o.y0 + bar / 2),
    box(w, bar, c, o.y1 - bar / 2),
  ];
  if (cross) parts.push(box(0.04, h - 2 * bar, c, ym), box(w - 2 * bar, 0.04, c, ym));
  return parts;
}

/** Walnut frame round a door opening (two jambs and a head). */
function doorFrame(along: 'x' | 'z', o: Opening, at: number, thick: number): THREE.Mesh[] {
  return windowFrame(along, o, at, thick, false).filter((_, i) => i !== 2);
}

/** A flat painted view outside a window: sky above a hedge. */
function outsideView(along: 'x' | 'z', a: number, b: number, at: number): THREE.Mesh[] {
  const len = b - a;
  const c = (a + b) / 2;
  const card = (f: Finish, hh: number, y: number, off: number, t: number) =>
    along === 'x' ? slab(f, len, hh, t, c, y, at + off, 0.02) : slab(f, t, hh, len, at + off, y, c, 0.02);
  const sign = at < 0 ? -1 : 1;
  return [card(PAINT.blue, 4.6, 2.3, 0, 0.05), card(PAINT.sage, 1.1, 0.55, -sign * 0.6, 0.5)];
}

// ------------------------------------------------------------- living room

/** Open-front dollhouse room around the sofa: cream walls, walnut plank floor. */
export function buildLivingRoom(): THREE.Group {
  const H = 2.7;
  const T = 0.12;
  const X0 = -3.6;
  const X1 = 3.6;
  const ZB = -3.4;
  const ZF = 3.0;

  // Floor: matte walnut boards running side to side (along the grain) on an 8 cm slab.
  const planks: THREE.Mesh[] = [];
  const n = 14;
  const pw = (ZF - ZB) / n;
  const boards = surface('walnut', X1 - X0, pw, 1.8).clone();
  boards.roughness = 0.75;
  for (let i = 0; i < n; i++) {
    const m = block('walnut', X1 - X0, 0.08, pw - 0.008, 0, -0.04, ZB + pw * (i + 0.5), 0.005);
    m.material = boards;
    planks.push(m);
  }
  const floor = named('floor', ...planks);

  // Walls with real openings: two back windows, a door on the left, a window on the right.
  const backWins: Opening[] = [
    { a: -2.0, b: -0.8, y0: 0.7, y1: 2.3 },
    { a: 0.8, b: 2.0, y0: 0.7, y1: 2.3 },
  ];
  const door: Opening = { a: -1, b: 0, y0: 0, y1: 2.1 };
  const rightWin: Opening = { a: -1.6, b: -0.4, y0: 0.7, y1: 2.3 };
  const back = ZB - T / 2;
  const left = X0 - T / 2;
  const right = X1 + T / 2;
  const walls = named(
    'walls',
    ...wall(PAINT.cream, 'x', X0 - T, X1 + T, back, H, T, backWins),
    ...wall(PAINT.cream, 'z', ZB, ZF, left, H, T, [door]),
    ...wall(PAINT.cream, 'z', ZB, ZF, right, H, T, [rightWin]),
    ...backWins.flatMap((o) => windowFrame('x', o, back, T)),
    ...windowFrame('z', rightWin, right, T),
    ...doorFrame('z', door, left, T),
    // Walnut skirting boards.
    block('walnut', X1 - X0, 0.1, 0.02, 0, 0.05, ZB + 0.01, 0.004),
    block('walnut', 0.02, 0.1, -1 - ZB, X0 + 0.01, 0.05, (ZB - 1) / 2, 0.004),
    block('walnut', 0.02, 0.1, ZF, X0 + 0.01, 0.05, ZF / 2, 0.004),
    block('walnut', 0.02, 0.1, ZF - ZB, X1 - 0.01, 0.05, (ZB + ZF) / 2, 0.004),
    // The garden outside the windows and the door.
    ...outsideView('x', X0, X1, ZB - 1.4),
    ...outsideView('z', -2.2, 0.2, X1 + 1.2),
    ...outsideView('z', -1.6, 0.6, X0 - 1.2),
  );

  // Ceiling: a separate lid, hidden by default so the room stays open like a dollhouse.
  const ceiling = named('ceiling', slab(PAINT.cream, X1 - X0 + 2 * T, 0.08, ZF - ZB + T, 0, H + 0.04, (ZB + ZF - T) / 2));
  ceiling.visible = false;

  const decor = named('decor', ...bookshelf(-2.6, ZB), ...pictures(ZB), ...clock(2.85, 2.05, ZB), ...floorLamp(-3.15, 0.95), rug(1.55, 1.6, 0.3));
  const g = new THREE.Group();
  g.name = 'living room';
  g.add(floor, walls, ceiling, decor);
  return g;
}

/** Walnut bookshelf against the back wall, with chunky painted books. */
function bookshelf(x: number, wallZ: number): THREE.Mesh[] {
  const W = 1.1;
  const D = 0.32;
  const H = 1.8;
  const z = wallZ + D / 2 + 0.005;
  const t = 0.03;
  const parts: THREE.Mesh[] = [
    block('walnut', t, H, D, x - W / 2 + t / 2, H / 2, z, 0.006),
    block('walnut', t, H, D, x + W / 2 - t / 2, H / 2, z, 0.006),
    block('walnut', W, t, D, x, H - t / 2, z, 0.006),
    block('walnut', W - 2 * t, H - t, 0.01, x, (H - t) / 2, wallZ + 0.01, 0.003),
  ];
  const shelves = [0.06, 0.5, 0.94, 1.38];
  for (const y of shelves) parts.push(block('walnut', W - 2 * t, t, D - 0.01, x, y - t / 2, z, 0.004));
  const r = rng(5);
  const colours = [PAINT.terracotta, PAINT.blue, PAINT.sage, PAINT.cream, PAINT.charcoal];
  for (const y of shelves) {
    let bx = x - W / 2 + t + 0.03;
    while (true) {
      const bw = 0.12 + r() * 0.12;
      if (bx + bw > x + W / 2 - t - 0.12) break;
      const bh = 0.26 + r() * 0.1;
      parts.push(block(colours[Math.floor(r() * colours.length)], bw - 0.01, bh, D - 0.08, bx + bw / 2, y + bh / 2, z + 0.01, 0.012));
      bx += bw + 0.01;
    }
  }
  return parts;
}

/** Two framed pictures between the back windows. */
function pictures(wallZ: number): THREE.Mesh[] {
  const frame = (w: number, h: number, x: number, y: number, inner: Finish) => [
    block('walnut', w, h, 0.03, x, y, wallZ + 0.015, 0.006),
    block(inner, w - 0.08, h - 0.08, 0.01, x, y, wallZ + 0.03, 0.003),
  ];
  return [...frame(0.36, 0.46, -0.3, 1.62, PAINT.terracotta), ...frame(0.46, 0.34, 0.32, 1.52, PAINT.sage)];
}

/** Round wall clock: walnut rim, cream face, charcoal hands. */
function clock(x: number, y: number, wallZ: number): THREE.Mesh[] {
  const rim = post('walnut', 0.17, 0.17, 0.04, x, y, wallZ + 0.02, 28).rotateX(Math.PI / 2);
  const face = post(PAINT.cream, 0.14, 0.14, 0.01, x, y, wallZ + 0.045, 28).rotateX(Math.PI / 2);
  const hour = block(PAINT.charcoal, 0.018, 0.08, 0.006, x + 0.02, y + 0.03, wallZ + 0.054, 0.002).rotateZ(-0.7);
  const minute = block(PAINT.charcoal, 0.012, 0.11, 0.006, x - 0.02, y + 0.05, wallZ + 0.056, 0.002).rotateZ(0.35);
  return [rim, face, hour, minute];
}

/** Floor lamp (no light of its own): walnut base and pole, cream shade. */
function floorLamp(x: number, z: number): THREE.Mesh[] {
  return [
    post('walnut', 0.15, 0.17, 0.03, x, 0.015, z, 24),
    post('walnut', 0.015, 0.015, 1.45, x, 0.755, z, 10),
    post(PAINT.cream, 0.13, 0.22, 0.28, x, 1.56, z, 24),
  ];
}

/** Thin flat rug under the coffee table. */
function rug(x: number, z: number, rot: number): THREE.Mesh {
  const m = slab(PAINT.terracotta, 2.0, 0.006, 1.4, x, 0.003, z, 0.003);
  m.rotation.y = rot;
  return m;
}

// ------------------------------------------------------------------ studio

/** A large plain photo studio: charcoal floor and walls round the backdrop. */
export function buildStudioRoom(): THREE.Group {
  const H = 4.5;
  const T = 0.15;
  const E = 6;
  const floor = named('floor', slab(PAINT.charcoal, 2 * E, 0.08, 2 * E, 0, -0.04, 0, 0.01));
  const win: Opening = { a: -3, b: -1, y0: 0.8, y1: 3.8 };
  const walls = named(
    'walls',
    ...wall(PAINT.charcoal, 'x', -E - T, E + T, -E - T / 2, H, T),
    ...wall(PAINT.charcoal, 'z', -E, E, -E - T / 2, H, T, [win]),
    ...wall(PAINT.charcoal, 'z', -E, E, E + T / 2, H, T),
    ...windowFrame('z', win, -E - T / 2, T, false),
    ...outsideView('z', -3.4, -0.6, -E - 1.2),
  );
  const ceiling = named('ceiling', slab(PAINT.charcoal, 2 * E + 2 * T, 0.1, 2 * E + T, 0, H + 0.05, -T / 2));
  ceiling.visible = false;

  // Walnut blinds across the window, tilted half open.
  const blinds: THREE.Mesh[] = [];
  for (let y = 0.95; y < 3.7; y += 0.16) blinds.push(block('walnut', 0.012, 0.09, 1.88, -E + 0.05, y, -2, 0.003).rotateZ(0.5));

  const decor = named('decor', ...blinds, ...lightStand(-4.6, -4.4, 0.6), ...lightStand(4.6, -4.2, -0.6), ...stool(4.4, 1.6), ...rollRack(-5.2, 2.2));
  const g = new THREE.Group();
  g.name = 'studio';
  g.add(floor, walls, ceiling, decor);
  return g;
}

/** Spare light stand, unlit: walnut tripod and pole, a maple box head turned toward the set. */
function lightStand(x: number, z: number, turn: number): THREE.Mesh[] {
  const aim = Math.atan2(-x, -z);
  const hub = new THREE.Vector3(x, 0.75, z);
  const parts: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const a = turn + (i * Math.PI * 2) / 3;
    parts.push(rod('walnut', 0.014, new THREE.Vector3(x + Math.sin(a) * 0.5, 0.012, z + Math.cos(a) * 0.5), hub));
  }
  parts.push(rod('walnut', 0.02, hub, new THREE.Vector3(x, 2.15, z)));
  const head = block('maple', 0.26, 0.22, 0.36, x, 2.25, z, 0.03);
  head.rotation.order = 'YXZ';
  head.rotation.set(0.15, aim, 0);
  parts.push(head, post(PAINT.charcoal, 0.1, 0.1, 0.02, 0, 0, 0.19, 20).rotateX(Math.PI / 2));
  // The lens disc sits on the head's front face.
  head.add(parts.pop()!);
  return parts;
}

/** Three-legged stool with a sage seat. */
function stool(x: number, z: number): THREE.Mesh[] {
  const parts: THREE.Mesh[] = [post(PAINT.sage, 0.2, 0.2, 0.04, x, 0.66, z, 24)];
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    parts.push(rod('walnut', 0.018, new THREE.Vector3(x + Math.sin(a) * 0.22, 0.01, z + Math.cos(a) * 0.22), new THREE.Vector3(x + Math.sin(a) * 0.12, 0.64, z + Math.cos(a) * 0.12)));
  }
  return parts;
}

/** Rolling rack of spare backdrop rolls along the left wall. */
function rollRack(x: number, z: number): THREE.Mesh[] {
  const L = 2.6;
  const parts: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const zz = z + (s * (L + 0.1)) / 2;
    parts.push(block('walnut', 0.06, 2.0, 0.06, x, 1.04, zz, 0.01), block('walnut', 0.5, 0.05, 0.06, x, 0.065, zz, 0.01));
    for (const sx of [-1, 1]) parts.push(post(PAINT.charcoal, 0.035, 0.035, 0.03, x + sx * 0.2, 0.035, zz, 14).rotateZ(Math.PI / 2));
  }
  const rolls: Finish[] = ['maple', PAINT.sage, PAINT.blue, PAINT.terracotta];
  rolls.forEach((f, i) => parts.push(post(f, 0.075, 0.075, L, x + (i % 2 ? 0.09 : -0.09), 0.85 + i * 0.3, z, 20).rotateX(Math.PI / 2)));
  return parts;
}

// -------------------------------------------------------------------- park

/** Spots the app fills with its own props, kept free of trees: [x, z, radius]. */
const PARK_KEEP: [number, number, number][] = [
  [-4.2, -11, 1.4],
  [4.8, -15, 1.4],
  [-1.5, -22, 1.4],
  [1.7, -7.5, 1.6],
  [-1.5, -3.3, 2],
  [1.7, -5.5, 1.6],
  [-5, -7, 1],
  [0.5, -7.25, 1],
  [6, -7.5, 1],
];

/** Model-railway diorama: grass disc, gravel path, lollipop trees, a picket fence and toy houses. */
export function buildPark(): THREE.Group {
  const R = 45;
  const ground = new THREE.Mesh(new THREE.CircleGeometry(R, 72).rotateX(-Math.PI / 2), surface(PAINT.grass, 2 * R, 2 * R, 3));
  ground.receiveShadow = true;
  const pathMat = surface(PAINT.gravel, 1.5, 48, 1.5).clone();
  pathMat.polygonOffset = true;
  pathMat.polygonOffsetFactor = -2;
  pathMat.polygonOffsetUnits = -2;
  const path = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 48).rotateX(-Math.PI / 2), pathMat);
  // Just above the grass and below a standing figure's soles (2 mm up).
  path.position.set(0.3, 0.0012, -16);
  path.receiveShadow = true;

  // Low rounded mounds round the edge, so the horizon is soft.
  const r = rng(23);
  const mounds: THREE.Matrix4[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + r() * 0.2;
    const d = 40 + r() * 5;
    const sy = 1.4 + r() * 2;
    mounds.push(placed(Math.sin(a) * d, -sy * 0.25, Math.cos(a) * d, 7 + r() * 4, sy, 4 + r() * 3, a));
  }
  const ground3 = named('ground', ground, path, instanced(new THREE.SphereGeometry(1, 16, 10), surface(PAINT.grass, 10, 10, 3), mounds));

  const decor = named('decor', ...trees(), ...fence(), ...houses());
  const g = new THREE.Group();
  g.name = 'park';
  g.add(ground3, decor);
  return g;
}

/** Carved toy trees in clusters behind the set and out to the sides, never on the path. */
function trees(): THREE.Object3D[] {
  const r = rng(41);
  type Tree = { x: number; z: number; h: number; cr: number; cone: boolean };
  const out: Tree[] = [];
  const centres = [
    [-9, -12],
    [-14, -20],
    [-5, -26],
    [7, -11],
    [12, -21],
    [5, -24],
    [-17, -4],
    [17, -3],
    [-20, 6],
    [21, 8],
  ];
  for (let tries = 0; tries < 900 && out.length < 44; tries++) {
    const [cx, cz] = centres[tries % centres.length];
    const x = cx + (r() - 0.5) * 9;
    const z = cz + (r() - 0.5) * 9;
    const h = 3 + r() * 5;
    const cone = r() < 0.35;
    const cr = cone ? h * 0.22 : h * 0.27;
    const ok =
      Math.hypot(x, z) < 38 &&
      z > -28 &&
      Math.abs(x - 0.3) > 1.6 + cr &&
      (z < -9 || Math.abs(x) > 7 + cr) &&
      Math.abs(z + 12) > 0.8 &&
      PARK_KEEP.every(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) > kr + cr) &&
      out.every((t) => Math.hypot(x - t.x, z - t.z) > (t.cr + cr) * 0.75);
    if (ok) out.push({ x, z, h, cr, cone });
  }
  // Each tree's parts go into shared instanced meshes, each copy turned and
  // tinted a little differently so no two crowns look stamped out.
  const trunks: THREE.Matrix4[] = [];
  const lumps: [THREE.Matrix4[], THREE.Matrix4[]] = [[], []];
  const tiers: THREE.Matrix4[] = [];
  out.forEach((t, i) => {
    const spin = r() * Math.PI * 2;
    const w = 0.05 + t.h * 0.018;
    if (t.cone) {
      // Carved fir: three stacked tiers, each overlapping the one below; the trunk runs up inside them.
      const base = t.h * 0.22;
      const tierH = (t.h - base) * 0.5;
      for (let k = 0; k < 3; k++) {
        const s = t.cr * (1 - k * 0.27);
        tiers.push(placed(t.x, base + k * tierH * 0.5, t.z, s, tierH * (1 - k * 0.12), s, spin + k * 1.3));
      }
      trunks.push(placed(t.x, 0, t.z, w, t.h * 0.7, w, spin));
    } else {
      // Rounded tree: one big lump on top and two smaller ones tucked into its sides; the trunk ends inside it.
      const cy = t.h - t.cr;
      const set = lumps[i % 2];
      set.push(placed(t.x, cy, t.z, t.cr, t.cr * 0.95, t.cr, spin));
      for (const side of [-1, 1]) {
        const a = spin + side * 1.4;
        const s = t.cr * (0.62 + r() * 0.1);
        set.push(placed(t.x + Math.sin(a) * t.cr * 0.62, cy - t.cr * 0.3, t.z + Math.cos(a) * t.cr * 0.62, s, s * 0.9, s, r() * 6));
      }
      trunks.push(placed(t.x, 0, t.z, w, cy, w, spin));
    }
  });
  return [
    tinted(instanced(trunkGeometry(), trunkWood(), trunks), r, 0.08),
    tinted(instanced(lumpGeometry(3), leafPaint(PAINT.sage), lumps[0]), r, 0.1),
    tinted(instanced(lumpGeometry(9), leafPaint(PAINT.grass), lumps[1]), r, 0.1),
    tinted(instanced(tierGeometry(), leafPaint(PAINT.sage), tiers), r, 0.1),
  ];
}

/** Smooth bumpy noise on the unit sphere, about ±1. */
function bumps(p: THREE.Vector3, seed: number): number {
  return (
    Math.sin(p.x * 2.3 + seed) * Math.sin(p.y * 2.9 + seed * 1.7) * Math.sin(p.z * 2.1 + seed * 0.6) +
    0.5 * Math.sin(p.x * 5.1 + p.z * 3.7 + seed * 2.3) * Math.sin(p.y * 4.3 - seed)
  );
}

/**
 * Whittle a shape: weld its vertices so it shades smoothly, push them in and
 * out by `amount` of bumpy noise (all three axes, or only sideways), and give
 * it seamless UVs so the grain wraps it without a visible join.
 */
function carve(geo: THREE.BufferGeometry, amount: number, seed: number, sideways = false): THREE.BufferGeometry {
  geo.deleteAttribute('uv');
  geo.deleteAttribute('normal');
  const g = mergeVertices(geo);
  const pos = g.attributes.position;
  const p = new THREE.Vector3();
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const k = 1 + amount * bumps(p.clone().normalize(), seed);
    if (sideways) pos.setXYZ(i, p.x * k, p.y, p.z * k);
    else pos.setXYZ(i, p.x * k, p.y * k, p.z * k);
    // Planar projection on a slant: no seam anywhere, gentle stretch on the far sides.
    uv[i * 2] = (p.x + p.z) * 0.35 + 0.5;
    uv[i * 2 + 1] = p.y * 0.5 + 0.5;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

/** A lumpy carved ball of radius ~1 for leaf crowns. */
function lumpGeometry(seed: number): THREE.BufferGeometry {
  return carve(new THREE.IcosahedronGeometry(1, 3), 0.09, seed);
}

/**
 * One fir tier, base at y = 0 and tip at y = 1: a lathe profile with a
 * rounded rim and slightly hollow flanks, like a carved toy tree.
 */
function tierGeometry(): THREE.BufferGeometry {
  const profile = [
    [0, 0],
    [0.7, 0.01],
    [0.96, 0.05],
    [1, 0.1],
    [0.82, 0.24],
    [0.55, 0.5],
    [0.28, 0.76],
    [0.08, 0.95],
    [0, 1],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return carve(new THREE.LatheGeometry(profile, 16), 0.06, 5, true);
}

/** Tapered trunk from y = 0 to y = 1, flared at the root. */
function trunkGeometry(): THREE.BufferGeometry {
  const profile = [
    [0, 0],
    [1.6, 0],
    [1.15, 0.06],
    [1, 0.2],
    [0.75, 1],
    [0, 1],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  return carve(new THREE.LatheGeometry(profile, 10), 0.05, 2, true);
}

/** Walnut with its grain running up the trunk. */
function trunkWood(): THREE.MeshStandardMaterial {
  const m = woodMaterial('walnut').clone();
  m.map = m.map!.clone();
  m.map.rotation = Math.PI / 2;
  m.map.repeat.set(2, 1);
  return m;
}

/** Leaf paint with the maple grain showing through at a carved-toy scale. */
function leafPaint(color: string): THREE.MeshStandardMaterial {
  const m = paint(color).clone();
  m.map = m.map!.clone();
  m.map.repeat.set(2, 2);
  m.roughness = 0.75;
  return m;
}

/** Vary each copy's shade by up to ±`spread`, so neighbours read as separate pieces. */
function tinted(m: THREE.InstancedMesh, r: () => number, spread: number): THREE.InstancedMesh {
  const c = new THREE.Color();
  for (let i = 0; i < m.count; i++) m.setColorAt(i, c.setScalar(1 + (r() * 2 - 1) * spread));
  return m;
}

/** Low cream picket fence across the park, with a gap for the path. */
function fence(): THREE.Object3D[] {
  const z = -12;
  const pickets: THREE.Matrix4[] = [];
  for (let x = -18; x <= 18; x += 0.18) if (Math.abs(x - 0.3) > 1.2) pickets.push(placed(x, 0.42, z, 1));
  const geo = new THREE.BoxGeometry(0.08, 0.84, 0.025);
  const rails: THREE.Mesh[] = [];
  for (const [a, b] of [
    [-18.1, -0.9],
    [1.5, 18.1],
  ])
    for (const y of [0.25, 0.62]) rails.push(block(PAINT.cream, b - a, 0.06, 0.03, (a + b) / 2, y, z - 0.03, 0.006));
  return [instanced(geo, paint(PAINT.cream), pickets), ...rails];
}

/** Five or six toy houses far behind: painted bodies, walnut gabled roofs, dark windows. */
function houses(): THREE.Object3D[] {
  const r = rng(77);
  const bodies: Finish[] = [PAINT.cream, PAINT.sage, PAINT.blue, PAINT.terracotta];
  const out: THREE.Object3D[] = [];
  [-17, -10, -3.5, 4, 11, 17.5].forEach((x, i) => {
    const w = 4 + r() * 2;
    const h = 3 + r() * 1.2;
    const d = 4;
    const z = -34 - r() * 4;
    const pitch = 0.6;
    const f = bodies[i % bodies.length];
    const house = new THREE.Group();
    house.position.set(x, 0, z);
    house.rotation.y = (r() - 0.5) * 0.3;
    // Gable: a triangular prism the same colour as the body.
    const rise = (d / 2) * Math.tan(pitch);
    const tri = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rise)]);
    const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: w, bevelEnabled: false }), paint(f, w));
    gable.rotation.y = Math.PI / 2;
    gable.position.set(-w / 2, h, 0);
    const slopeLen = d / 2 / Math.cos(pitch) + 0.3;
    const roof = [-1, 1].map((s) => {
      const m = block('walnut', w + 0.4, 0.14, slopeLen, 0, h + rise / 2 + 0.05, (s * d) / 4 + s * 0.06, 0.03);
      m.rotation.x = -s * pitch;
      return m;
    });
    const front = d / 2 + 0.02;
    house.add(
      slab(f, w, h, d, 0, h / 2, 0, 0.05),
      gable,
      ...roof,
      block(PAINT.charcoal, 0.8, 1.4, 0.05, -w / 4, 0.7, front, 0.02),
      block(PAINT.charcoal, 0.8, 0.8, 0.05, w / 5, h * 0.55, front, 0.02),
      block(PAINT.charcoal, 0.8, 0.8, 0.05, -w / 4, h * 0.8, front, 0.02),
    );
    out.push(group(house));
  });
  return out;
}
