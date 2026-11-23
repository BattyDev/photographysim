// Top-down lighting diagram. Lights can be dragged around the subject.
import * as THREE from 'three';
import { lightPosition, activeLights } from './lights';
import { MODIFIERS, type LightId, type SimState } from './state';
import { depthOfField } from './photo';

export interface DiagramInputs {
  state: SimState;
  eye: THREE.Vector3;
  camera: THREE.PerspectiveCamera;
  sunDir: THREE.Vector3 | null;
}

export class Diagram {
  readonly canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private scale = 40; // px per metre
  private center = new THREE.Vector2();
  private inputs: DiagramInputs | null = null;
  private dragging: LightId | null = null;
  private hover: LightId | null = null;

  constructor(
    private onDrag: (id: LightId, azimuth: number, horizontalDistance: number) => void,
    private onSelect: (id: LightId) => void,
  ) {
    this.canvas.className = 'diagram';
    this.ctx = this.canvas.getContext('2d')!;
    this.canvas.addEventListener('pointerdown', (e) => this.down(e));
    this.canvas.addEventListener('pointermove', (e) => this.move(e));
    window.addEventListener('pointerup', () => (this.dragging = null));
  }

  private toScreen(x: number, z: number): [number, number] {
    const w = this.canvas.width;
    const h = this.canvas.height;
    return [w / 2 + (x - this.center.x) * this.scale, h / 2 + (z - this.center.y) * this.scale];
  }

  private toWorld(px: number, py: number): [number, number] {
    const w = this.canvas.width;
    const h = this.canvas.height;
    return [(px - w / 2) / this.scale + this.center.x, (py - h / 2) / this.scale + this.center.y];
  }

  private local(e: PointerEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    const k = this.canvas.width / r.width;
    return [(e.clientX - r.left) * k, (e.clientY - r.top) * k];
  }

  private hit(px: number, py: number): LightId | null {
    if (!this.inputs) return null;
    const { state, eye } = this.inputs;
    let best: LightId | null = null;
    let bestD = 18 * (window.devicePixelRatio || 1);
    for (const l of state.lights) {
      if (!l.enabled) continue;
      const p = lightPosition(l, eye);
      const [sx, sy] = this.toScreen(p.x, p.z);
      const d = Math.hypot(sx - px, sy - py);
      if (d < bestD) {
        bestD = d;
        best = l.id;
      }
    }
    return best;
  }

  private down(e: PointerEvent) {
    const [px, py] = this.local(e);
    const id = this.hit(px, py);
    if (id) {
      this.dragging = id;
      this.onSelect(id);
      this.canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }

  private move(e: PointerEvent) {
    const [px, py] = this.local(e);
    if (this.dragging && this.inputs) {
      const [x, z] = this.toWorld(px, py);
      const { eye } = this.inputs;
      const dx = x - eye.x;
      const dz = z - eye.z;
      const az = THREE.MathUtils.radToDeg(Math.atan2(dx, dz));
      this.onDrag(this.dragging, Math.round(az), Math.max(0.3, Math.hypot(dx, dz)));
      return;
    }
    const h = this.hit(px, py);
    if (h !== this.hover) {
      this.hover = h;
      this.canvas.style.cursor = h ? 'grab' : 'default';
      if (this.inputs) this.draw(this.inputs);
    }
  }

  draw(inp: DiagramInputs) {
    this.inputs = inp;
    const dpr = window.devicePixelRatio || 1;
    const cssW = this.canvas.clientWidth || 240;
    const cssH = this.canvas.clientHeight || 240;
    if (this.canvas.width !== Math.round(cssW * dpr)) {
      this.canvas.width = Math.round(cssW * dpr);
      this.canvas.height = Math.round(cssH * dpr);
    }
    const g = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const { state, eye, camera } = inp;
    const studio = state.env.mode === 'studio';

    // Fit subject, lights and camera.
    const pts: [number, number][] = [[eye.x, eye.z], [camera.position.x, camera.position.z]];
    for (const l of state.lights) if (l.enabled) {
      const p = lightPosition(l, eye);
      pts.push([p.x, p.z]);
    }
    if (studio) pts.push([0, -state.subject.backgroundDistance]);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of pts) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    // Keep the view still while a light is being dragged.
    if (!this.dragging) {
      const pad = 0.8;
      this.center.set((minX + maxX) / 2, (minZ + maxZ) / 2);
      this.scale = Math.min(W / (maxX - minX + pad * 2), H / (maxZ - minZ + pad * 2));
    }

    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(14,15,18,0.82)';
    g.fillRect(0, 0, W, H);

    // Grid (1 m).
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 1;
    const [wx0, wz0] = this.toWorld(0, 0);
    const [wx1, wz1] = this.toWorld(W, H);
    for (let x = Math.ceil(wx0); x <= wx1; x++) {
      const [sx] = this.toScreen(x, 0);
      g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx, H); g.stroke();
    }
    for (let z = Math.ceil(wz0); z <= wz1; z++) {
      const [, sy] = this.toScreen(0, z);
      g.beginPath(); g.moveTo(0, sy); g.lineTo(W, sy); g.stroke();
    }

    // Backdrop.
    if (studio) {
      const [, by] = this.toScreen(0, -state.subject.backgroundDistance);
      const [bx0] = this.toScreen(-4.5, 0);
      const [bx1] = this.toScreen(4.5, 0);
      g.strokeStyle = state.env.backdrop;
      g.lineWidth = 5 * dpr;
      g.beginPath(); g.moveTo(bx0, by); g.lineTo(bx1, by); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,0.25)';
      g.lineWidth = 1;
      g.stroke();
    }

    // Camera frustum, DoF band and focus plane.
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    const flat = new THREE.Vector2(camDir.x, camDir.z).normalize();
    const side = new THREE.Vector2(-flat.y, flat.x);
    const hfov = Math.atan(camera.getFilmWidth() / 2 / camera.getFocalLength());
    const cam = new THREE.Vector2(camera.position.x, camera.position.z);
    const at = (dist: number, s: number) => cam.clone().addScaledVector(flat, dist).addScaledVector(side, s * dist * Math.tan(hfov));
    const cs = state.camera;
    const dof = depthOfField(cs.focalLength, cs.aperture, cs.focusDistance);
    const far = Math.min(dof.far, 60);
    const band = [at(dof.near, -1), at(dof.near, 1), at(far, 1), at(far, -1)];
    g.fillStyle = 'rgba(80,220,120,0.13)';
    g.beginPath();
    band.forEach((p, i) => {
      const [sx, sy] = this.toScreen(p.x, p.y);
      if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy);
    });
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 1;
    for (const s of [-1, 1]) {
      const a = this.toScreen(cam.x, cam.y);
      const b = at(60, s);
      const bb = this.toScreen(b.x, b.y);
      g.beginPath(); g.moveTo(...a); g.lineTo(...bb); g.stroke();
    }
    const f0 = at(cs.focusDistance, -1);
    const f1 = at(cs.focusDistance, 1);
    g.strokeStyle = 'rgba(232,90,210,0.95)';
    g.lineWidth = 2 * dpr;
    g.setLineDash([4 * dpr, 3 * dpr]);
    g.beginPath(); g.moveTo(...this.toScreen(f0.x, f0.y)); g.lineTo(...this.toScreen(f1.x, f1.y)); g.stroke();
    g.setLineDash([]);

    // Camera body.
    {
      const [sx, sy] = this.toScreen(cam.x, cam.y);
      g.save();
      g.translate(sx, sy);
      g.rotate(Math.atan2(flat.y, flat.x) + Math.PI / 2);
      g.fillStyle = '#e8e8ea';
      g.fillRect(-9 * dpr, 0, 18 * dpr, 11 * dpr);
      g.fillRect(-4 * dpr, -6 * dpr, 8 * dpr, 6 * dpr);
      g.restore();
    }

    // Sun direction.
    if (inp.sunDir && inp.sunDir.y > -0.05 && !studio) {
      const d = new THREE.Vector2(inp.sunDir.x, inp.sunDir.z).normalize();
      const [ex, ey] = this.toScreen(eye.x, eye.z);
      const r = Math.min(W, H) * 0.42;
      const sx = ex + d.x * r;
      const sy = ey + d.y * r;
      g.strokeStyle = 'rgba(255,200,80,0.6)';
      g.lineWidth = 1.5 * dpr;
      g.setLineDash([2 * dpr, 4 * dpr]);
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
      g.setLineDash([]);
      g.fillStyle = '#ffc850';
      g.beginPath(); g.arc(sx, sy, 7 * dpr, 0, Math.PI * 2); g.fill();
    }

    // Subject.
    {
      const [sx, sy] = this.toScreen(eye.x, eye.z);
      const yaw = THREE.MathUtils.degToRad(state.subject.turn);
      g.fillStyle = '#d8b08c';
      g.beginPath(); g.ellipse(sx, sy, 9 * dpr, 7 * dpr, -yaw, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#d8b08c';
      g.lineWidth = 2 * dpr;
      g.beginPath();
      g.moveTo(sx, sy);
      g.lineTo(sx + Math.sin(yaw) * 14 * dpr, sy + Math.cos(yaw) * 14 * dpr);
      g.stroke();
    }

    // Lights.
    const firing = new Set(activeLights(state).map((l) => l.id));
    for (const l of state.lights) {
      if (!l.enabled) continue;
      const p = lightPosition(l, eye);
      const [sx, sy] = this.toScreen(p.x, p.z);
      const toSubj = new THREE.Vector2(eye.x - p.x, eye.z - p.z).normalize();
      const spec = MODIFIERS[l.modifier];
      const w = Math.max(spec.aspect >= 1 ? l.size : l.size * spec.aspect, 0.06) * this.scale;
      const on = firing.has(l.id);
      g.globalAlpha = on ? 1 : 0.35;
      // Beam wedge.
      const beam = THREE.MathUtils.degToRad(Math.min(spec.beam, 70));
      const ang = Math.atan2(toSubj.y, toSubj.x);
      const grad = g.createRadialGradient(sx, sy, 0, sx, sy, l.distance * this.scale * 1.2);
      grad.addColorStop(0, l.color + '55');
      grad.addColorStop(1, l.color + '00');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(sx, sy);
      g.arc(sx, sy, l.distance * this.scale * 1.2, ang - beam, ang + beam);
      g.closePath();
      g.fill();
      // Modifier face.
      g.save();
      g.translate(sx, sy);
      g.rotate(ang + Math.PI / 2);
      g.fillStyle = l.color;
      g.fillRect(-w / 2, -2 * dpr, w, 4 * dpr);
      g.restore();
      g.fillStyle = l.color;
      g.beginPath(); g.arc(sx, sy, (state.selectedLight === l.id ? 7 : 5) * dpr, 0, Math.PI * 2); g.fill();
      if (state.selectedLight === l.id || this.hover === l.id) {
        g.strokeStyle = '#fff';
        g.lineWidth = 1.5 * dpr;
        g.stroke();
      }
      g.font = `${10 * dpr}px system-ui, sans-serif`;
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillText(l.name.split(' ')[0], sx + 9 * dpr, sy - 7 * dpr);
      g.globalAlpha = 1;
    }

    g.font = `${10 * dpr}px system-ui, sans-serif`;
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillText('Top view · drag lights', 8 * dpr, H - 8 * dpr);
  }
}
