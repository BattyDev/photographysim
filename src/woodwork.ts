// Simple wooden furniture and props, built from boxes and cylinders, in the
// same two woods as the mannequin: pale maple (its body) and dark walnut (its
// joints). Like a carved toy set, so the whole scene reads as one model.
// Every piece stands on y = 0, centred on x and z, with its front toward +z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type Wood = 'maple' | 'walnut';
/** A wood, or a paint colour as '#rrggbb' (matte paint over faint grain). */
export type Finish = Wood | `#${string}`;

/**
 * Paint colours for furniture: chosen to stand apart from the pale maple
 * mannequins, so a sitter never blends into the seat under them.
 */
export const PAINT = {
  cream: '#e8dcc4',
  sage: '#9aa58a',
  blue: '#8fa3b0',
  terracotta: '#b8765a',
  charcoal: '#3a3a3a',
  grass: '#8a9a5b',
  gravel: '#b5aa96',
  stone: '#8d8a83',
} as const;

const TONES: Record<Wood, { base: string; light: string; dark: string; rough: number }> = {
  maple: { base: '#d9c9ac', light: '242,232,212', dark: '168,138,98', rough: 0.55 },
  walnut: { base: '#5a3a26', light: '128,92,64', dark: '40,24,14', rough: 0.5 },
};

/** Small seeded random, so the grain is the same on every load. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

const grainCache = new Map<Wood, THREE.CanvasTexture>();

/** Fine, straight grain running along u, tileable along u. */
function grain(wood: Wood): THREE.CanvasTexture {
  let tex = grainCache.get(wood);
  if (tex) return tex;
  const t = TONES[wood];
  const r = rng(wood === 'maple' ? 7 : 11);
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = t.base;
  g.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < 90; i++) {
    const y0 = r() * c.height;
    const amp = 0.5 + r() * 2.5;
    const cycles = 1 + Math.floor(r() * 3);
    g.strokeStyle = `rgba(${r() < 0.6 ? t.dark : t.light},${0.06 + r() * 0.12})`;
    g.lineWidth = 0.5 + r() * 2;
    g.beginPath();
    for (let x = 0; x <= c.width; x += 4) g.lineTo(x, y0 + Math.sin((x / c.width) * Math.PI * 2 * cycles + i) * amp);
    g.stroke();
  }
  tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  grainCache.set(wood, tex);
  return tex;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();

/** A wood material whose grain repeats about every 60 cm along a part `length` m long. */
export function woodMaterial(wood: Wood, length = 0.6): THREE.MeshStandardMaterial {
  const reps = Math.max(1, Math.round(length / 0.6));
  const key = `${wood}|${reps}`;
  let m = matCache.get(key);
  if (!m) {
    const map = grain(wood).clone();
    map.repeat.set(reps, 1);
    m = new THREE.MeshStandardMaterial({ map, roughness: TONES[wood].rough, name: `wood_${wood}` });
    matCache.set(key, m);
  }
  return m;
}

const paintCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Matte paint over wood, for walls, floors and ground: the colour tints a
 * faint maple grain, so painted parts still read as part of the same toy set.
 */
export function paint(color: string, length = 0.6): THREE.MeshStandardMaterial {
  const reps = Math.max(1, Math.round(length / 0.6));
  const key = `${color}|${reps}`;
  let m = paintCache.get(key);
  if (!m) {
    const map = grain('maple').clone();
    map.repeat.set(reps, 1);
    m = new THREE.MeshStandardMaterial({ color, map, roughness: 0.8, name: `paint_${color}` });
    // The grain texture is cream; lift the tint so the colour lands where it was asked for.
    m.color.multiplyScalar(1.18);
    paintCache.set(key, m);
  }
  return m;
}

function shade<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) c.castShadow = c.receiveShadow = true;
  });
  return o;
}

/** A block with softly rounded edges, its centre at (x, y, z). */
function finish(f: Finish, length: number): THREE.MeshStandardMaterial {
  return f.startsWith('#') ? paint(f, length) : woodMaterial(f as Wood, length);
}

export function block(wood: Finish, w: number, h: number, d: number, x: number, y: number, z: number, r = 0.012): THREE.Mesh {
  const rr = Math.min(r, w / 2.2, h / 2.2, d / 2.2);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, rr), finish(wood, Math.max(w, h, d)));
  m.position.set(x, y, z);
  return m;
}

/** A turned post or disc, its centre at (x, y, z). */
export function post(wood: Finish, rTop: number, rBottom: number, h: number, x: number, y: number, z: number, seg = 20): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg), finish(wood, h));
  m.position.set(x, y, z);
  return m;
}

export function group(...parts: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.add(...parts);
  return shade(g);
}

/** Four legs at the corners of a w × d footprint, inset by `inset`. */
export function legs(wood: Finish, w: number, d: number, h: number, size: number, inset = 0.04): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) out.push(block(wood, size, h, size, sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset), 0.006));
  return out;
}

// ------------------------------------------------------------------ seats

/** Park bench: sage-painted slats on walnut legs, seat at 0.45 m. */
export function bench(): THREE.Group {
  const L = 1.6;
  const parts: THREE.Object3D[] = [];
  for (const sx of [-1, 1]) {
    const x = sx * (L / 2 - 0.12);
    parts.push(block('walnut', 0.06, 0.42, 0.06, x, 0.21, 0.14, 0.008));
    parts.push(block('walnut', 0.06, 0.86, 0.06, x, 0.43, -0.17, 0.008));
    parts.push(block('walnut', 0.06, 0.05, 0.42, x, 0.4, 0, 0.008));
  }
  for (let i = 0; i < 4; i++) parts.push(block(PAINT.sage, L, 0.035, 0.09, 0, 0.432, 0.15 - i * 0.1));
  for (let i = 0; i < 2; i++) parts.push(block(PAINT.sage, L, 0.09, 0.03, 0, 0.62 + i * 0.14, -0.19).rotateX(-0.12));
  return group(...parts);
}

/** Four-seat sofa (room for the whole family): walnut frame and arms, dusty-blue cushions, seat at 0.45 m. */
export function sofa(): THREE.Group {
  const L = 2.6;
  const D = 0.9;
  const parts: THREE.Object3D[] = [
    block('walnut', L, 0.28, D, 0, 0.2, 0, 0.03),
    block('walnut', L, 0.5, 0.18, 0, 0.55, -D / 2 + 0.09, 0.04),
  ];
  for (const sx of [-1, 1]) parts.push(block('walnut', 0.16, 0.36, D, sx * (L / 2 - 0.08), 0.5, 0, 0.05));
  const inner = L - 0.32;
  for (let i = 0; i < 4; i++) {
    const x = -inner / 2 + inner / 8 + (i * inner) / 4;
    parts.push(block(PAINT.blue, inner / 4 - 0.01, 0.11, D - 0.22, x, 0.395, 0.08, 0.04));
    parts.push(block(PAINT.blue, inner / 4 - 0.01, 0.4, 0.14, x, 0.64, -D / 2 + 0.25, 0.05).rotateX(-0.12));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(post('walnut', 0.025, 0.02, 0.06, sx * (L / 2 - 0.1), 0.03, sz * (D / 2 - 0.1)));
  return group(...parts);
}

/** A single armchair to match the sofa. */
export function armchair(): THREE.Group {
  const W = 0.86;
  const D = 0.82;
  const parts: THREE.Object3D[] = [block('walnut', W, 0.26, D, 0, 0.19, 0, 0.03), block('walnut', W, 0.5, 0.16, 0, 0.54, -D / 2 + 0.08, 0.04)];
  for (const sx of [-1, 1]) parts.push(block('walnut', 0.14, 0.32, D, sx * (W / 2 - 0.07), 0.48, 0, 0.05));
  parts.push(block(PAINT.blue, W - 0.3, 0.11, D - 0.2, 0, 0.375, 0.07, 0.04));
  parts.push(block(PAINT.blue, W - 0.3, 0.38, 0.13, 0, 0.61, -D / 2 + 0.23, 0.05).rotateX(-0.12));
  return group(...parts);
}

// ------------------------------------------------------------------ tables

/** Round coffee table: walnut throughout. */
export function coffeeTable(): THREE.Group {
  const parts: THREE.Object3D[] = [post('walnut', 0.45, 0.45, 0.04, 0, 0.4, 0, 40)];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    parts.push(post('walnut', 0.022, 0.016, 0.38, Math.cos(a) * 0.3, 0.19, Math.sin(a) * 0.3));
  }
  return group(...parts);
}

/** Small square side table. */
export function sideTable(): THREE.Group {
  return group(block('walnut', 0.5, 0.035, 0.5, 0, 0.56, 0), block(PAINT.terracotta, 0.42, 0.025, 0.42, 0, 0.18, 0), ...legs('walnut', 0.46, 0.46, 0.55, 0.04));
}

/** Picnic table with its benches fixed on, all walnut. */
export function picnicTable(): THREE.Group {
  const L = 1.8;
  const parts: THREE.Object3D[] = [];
  for (let i = 0; i < 4; i++) parts.push(block('walnut', L, 0.04, 0.17, 0, 0.74, -0.27 + i * 0.18));
  for (const sz of [-1, 1]) for (let i = 0; i < 2; i++) parts.push(block('walnut', L, 0.04, 0.13, 0, 0.44, sz * (0.62 + i * 0.14 - 0.07)));
  for (const sx of [-1, 1]) {
    const x = sx * (L / 2 - 0.2);
    for (const sz of [-1, 1]) parts.push(block('walnut', 0.06, 0.82, 0.07, x, 0.37, sz * 0.24, 0.006).rotateX(sz * 0.42));
    parts.push(block('walnut', 0.06, 0.06, 1.55, x, 0.4, 0, 0.006));
    parts.push(block('walnut', 0.06, 0.06, 0.7, x, 0.7, 0, 0.006));
  }
  return group(...parts);
}

/** A slatted chair for the bistro set. */
function bistroChair(): THREE.Group {
  return group(
    ...legs('walnut', 0.42, 0.42, 0.45, 0.035),
    block(PAINT.sage, 0.44, 0.035, 0.44, 0, 0.46, 0),
    block('walnut', 0.035, 0.45, 0.035, -0.19, 0.69, -0.19, 0.006),
    block('walnut', 0.035, 0.45, 0.035, 0.19, 0.69, -0.19, 0.006),
    block(PAINT.sage, 0.42, 0.12, 0.025, 0, 0.82, -0.2),
  );
}

/** Round café table with two chairs. */
export function bistroSet(): THREE.Group {
  const table = group(post('walnut', 0.36, 0.36, 0.035, 0, 0.73, 0, 32), post('walnut', 0.03, 0.03, 0.7, 0, 0.36, 0), post('walnut', 0.2, 0.22, 0.03, 0, 0.015, 0, 24));
  const a = bistroChair();
  a.position.set(-0.6, 0, 0.1);
  a.rotation.y = Math.PI / 2 - 0.3;
  const b = bistroChair();
  b.position.set(0.55, 0, -0.2);
  b.rotation.y = -Math.PI / 2 - 0.2;
  return group(table, a, b);
}

// ------------------------------------------------------------------ props

/** Potted tree, carved: terracotta pot, walnut trunk, sage balls for leaves. */
export function pottedTree(height = 1.7): THREE.Group {
  const k = height / 1.7;
  const r = rng(5);
  const parts: THREE.Object3D[] = [post(PAINT.terracotta, 0.2, 0.15, 0.34, 0, 0.17, 0, 28), post(PAINT.terracotta, 0.21, 0.21, 0.03, 0, 0.34, 0, 28)];
  parts.push(post('walnut', 0.025, 0.035, 0.9, 0, 0.75, 0));
  const leaf = paint(PAINT.sage);
  for (let i = 0; i < 9; i++) {
    const a = r() * Math.PI * 2;
    const d = 0.1 + r() * 0.18;
    const s = 0.13 + r() * 0.08;
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 2), leaf);
    m.position.set(Math.cos(a) * d, 1.15 + r() * 0.42, Math.sin(a) * d);
    parts.push(m);
  }
  const g = group(...parts);
  g.scale.setScalar(k);
  return g;
}

/** Tree stump: a walnut cylinder with a cut top and a few roots. */
export function stump(): THREE.Group {
  const parts: THREE.Object3D[] = [post('walnut', 0.24, 0.28, 0.42, 0, 0.21, 0, 24), post(PAINT.terracotta, 0.235, 0.235, 0.012, 0, 0.426, 0, 24)];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const root = block('walnut', 0.24, 0.07, 0.1, Math.cos(a) * 0.26, 0.035, Math.sin(a) * 0.26, 0.03);
    root.rotation.y = -a;
    parts.push(root);
  }
  return group(...parts);
}

/** A faceted boulder painted stone grey, about 1.1 m tall. */
export function boulder(): THREE.Group {
  const geo = new THREE.DodecahedronGeometry(0.75, 0);
  const pos = geo.attributes.position;
  const r = rng(3);
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (1.1 + r() * 0.1), pos.getY(i) * 0.8, pos.getZ(i) * (0.95 + r() * 0.1));
  geo.computeVertexNormals();
  const stone = paint(PAINT.stone).clone();
  stone.flatShading = true;
  const m = new THREE.Mesh(geo, stone);
  m.position.y = 0.5;
  return group(m);
}

/** Street lamp: charcoal post and lantern, a glowing bulb (material "bulb"). */
export function streetLamp(): THREE.Group {
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 12), new THREE.MeshStandardMaterial({ color: '#fff4dc', roughness: 0.3, name: 'bulb' }));
  bulb.position.y = 3.3;
  return group(
    post(PAINT.charcoal, 0.14, 0.16, 0.2, 0, 0.1, 0),
    post(PAINT.charcoal, 0.05, 0.06, 3.1, 0, 1.75, 0),
    block(PAINT.charcoal, 0.3, 0.04, 0.3, 0, 3.2, 0),
    block(PAINT.charcoal, 0.36, 0.06, 0.36, 0, 3.47, 0),
    post(PAINT.charcoal, 0.0, 0.2, 0.14, 0, 3.57, 0, 4).rotateY(Math.PI / 4),
    bulb,
  );
}
