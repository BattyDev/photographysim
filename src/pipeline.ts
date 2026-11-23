// Render pipeline: HDR scene → thin-lens depth of field → white balance → tone map.
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Single-pass scatter-as-gather bokeh (after Dennis Gustafsson), driven by a
// physical circle of confusion computed from focal length, f-number and focus.
const FRAG = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 resolution;
uniform float cameraNear;
uniform float cameraFar;
uniform float focusDist;
uniform float focalLen;   // metres
uniform float fNumber;
uniform float sensorWidth; // metres
uniform float maxRadius;  // px
uniform float radScale;
uniform vec3 wbGains;
uniform float showZone;
uniform float showPlane;
uniform float zoneNear;
uniform float zoneFar;
varying vec2 vUv;

float sceneDist(vec2 uv) {
  float d = texture2D(tDepth, uv).x;
  if (d >= 1.0) return 1e6;
  return -perspectiveDepthToViewZ(d, cameraNear, cameraFar);
}

// Blur radius in pixels (unsigned).
float cocRadius(float z) {
  float A = focalLen / fNumber;
  float c = A * abs(z - focusDist) / z * focalLen / max(focusDist - focalLen, 1e-4);
  return min(0.5 * c / sensorWidth * resolution.x, maxRadius);
}

const float GOLDEN_ANGLE = 2.39996323;

void main() {
  vec2 px = 1.0 / resolution;
  float centerDepth = sceneDist(vUv);
  float centerSize = cocRadius(centerDepth);
  vec3 color = texture2D(tColor, vUv).rgb;
  if (maxRadius > 0.6) {
    float tot = 1.0;
    float radius = radScale;
    float ang = 0.0;
    for (int i = 0; i < 2048; i++) {
      if (radius >= maxRadius) break;
      vec2 tc = vUv + vec2(cos(ang), sin(ang)) * px * radius;
      tc = clamp(tc, px, 1.0 - px);
      vec3 sampleColor = texture2D(tColor, tc).rgb;
      float sampleDepth = sceneDist(tc);
      float sampleSize = cocRadius(sampleDepth);
      if (sampleDepth > centerDepth) sampleSize = clamp(sampleSize, 0.0, centerSize * 2.0);
      float m = smoothstep(radius - 0.5, radius + 0.5, sampleSize);
      color += mix(color / tot, sampleColor, m);
      tot += 1.0;
      radius += radScale / radius;
      ang += GOLDEN_ANGLE;
    }
    color /= tot;
  }

  color *= wbGains;

  if (showZone > 0.5 && centerDepth > zoneNear && centerDepth < zoneFar) {
    float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 14.0));
    color = mix(color, vec3(0.15, 0.9, 0.35) * max(dot(color, vec3(0.33)), 0.25) * 2.0, 0.28 + 0.12 * stripe);
  }
  if (showPlane > 0.5) {
    float dz = abs(centerDepth - focusDist);
    float fw = fwidth(centerDepth);
    float w = fw * 1.5 + 0.004;
    // Skip silhouette edges, where depth jumps between neighbouring pixels.
    float line = (1.0 - smoothstep(w * 0.5, w, dz)) * (1.0 - step(0.06, fw));
    color = mix(color, vec3(1.6, 0.25, 0.9), line * 0.9);
  }

  gl_FragColor = vec4(color, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export interface DofParams {
  focusDistance: number; // m
  focalLength: number; // mm
  fNumber: number;
  wbGains: [number, number, number];
  showZone: boolean;
  showPlane: boolean;
  zoneNear: number;
  zoneFar: number;
  /** Sample budget: higher = smoother bokeh. */
  samples: number;
}

export class Pipeline {
  readonly target: THREE.WebGLRenderTarget;
  private quad: FullScreenQuad;
  private mat: THREE.ShaderMaterial;
  private size = new THREE.Vector2();

  constructor(private renderer: THREE.WebGLRenderer) {
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: 4,
      depthTexture: new THREE.DepthTexture(1, 1, THREE.FloatType),
    });
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        resolution: { value: new THREE.Vector2(1, 1) },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 100 },
        focusDist: { value: 2.5 },
        focalLen: { value: 0.085 },
        fNumber: { value: 2.8 },
        sensorWidth: { value: 0.036 },
        maxRadius: { value: 0 },
        radScale: { value: 0.6 },
        wbGains: { value: new THREE.Vector3(1, 1, 1) },
        showZone: { value: 0 },
        showPlane: { value: 0 },
        zoneNear: { value: 0 },
        zoneFar: { value: 0 },
      },
    });
    this.mat.toneMapped = true;
    this.quad = new FullScreenQuad(this.mat);
  }

  setSize(w: number, h: number) {
    this.size.set(w, h);
    this.target.setSize(w, h);
    this.mat.uniforms.resolution.value.set(w, h);
  }

  /** Thin-lens blur radius (px) for an object at distance z. */
  cocRadius(z: number, p: DofParams, sensorWidth: number): number {
    const f = p.focalLength / 1000;
    const A = f / p.fNumber;
    const c = (A * Math.abs(z - p.focusDistance)) / z * (f / Math.max(p.focusDistance - f, 1e-4));
    return (0.5 * c) / sensorWidth * this.size.x;
  }

  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, p: DofParams) {
    const r = this.renderer;
    r.setRenderTarget(this.target);
    r.clear();
    r.render(scene, camera);
    r.setRenderTarget(null);

    const u = this.mat.uniforms;
    const sensor = camera.getFilmWidth() / 1000;
    // Largest blur anywhere in view: background at infinity or a close foreground.
    const far = this.cocRadius(1e5, p, sensor);
    const near = this.cocRadius(Math.max(camera.near * 4, 0.5), p, sensor);
    const cap = 40 * r.getPixelRatio();
    const maxR = Math.min(cap, Math.max(far, near));
    u.cameraNear.value = camera.near;
    u.cameraFar.value = camera.far;
    u.focusDist.value = p.focusDistance;
    u.focalLen.value = p.focalLength / 1000;
    u.fNumber.value = p.fNumber;
    u.sensorWidth.value = sensor;
    u.maxRadius.value = maxR < 0.6 ? 0 : maxR;
    // Spiral spacing so the sample count stays near the budget.
    u.radScale.value = Math.max(0.35, (maxR * maxR) / (2 * p.samples));
    u.wbGains.value.set(...p.wbGains);
    u.showZone.value = p.showZone ? 1 : 0;
    u.showPlane.value = p.showPlane ? 1 : 0;
    u.zoneNear.value = p.zoneNear;
    u.zoneFar.value = p.zoneFar;
    this.quad.render(r);
  }

  dispose() {
    this.target.dispose();
    this.quad.dispose();
    this.mat.dispose();
  }
}
