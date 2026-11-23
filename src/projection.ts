// HDRI locations as real, relightable surfaces.
//
// A panorama is a photo of light arriving at one point. Wrapping it on a far
// dome looks right from that point, but nothing in it reacts: a flash can't
// brighten the floor, the subject's shadow can't fall on it, and every pixel
// sits at the same depth, so depth of field blurs it all equally.
//
// Here the panorama is projected from its capture point onto proxy geometry at
// the real distances — a ground disc and far dome outdoors, a box room indoors.
// Lit surfaces turn the photo back into reflectance by dividing out the light
// they received when it was taken (albedo = π·L / E). Rendered under the same
// location light they reproduce the photo; add a strobe and they brighten by
// exactly what it adds, and they catch every light's shadows. Anything brighter
// than a white surface could be (windows, lamps) keeps the excess as emission.
//
// A sharp 8k (or 4k) photo of the same panorama can be layered on top: its
// detail — the ratio of the sharp sample to a 4× blurrier one — multiplies the
// 2k HDR, so the light stays physically scaled and the texture gets sharp.
import * as THREE from 'three';
import { softOnBeforeCompile } from './softlight';

export type ProxyShape =
  | { kind: 'open'; radius: number }
  | {
      kind: 'room';
      /** Room bounds in panorama space (m), with the capture point at x = z = 0. */
      x: [number, number];
      z: [number, number];
      /** Ceiling height (m). */
      ceiling: number;
      /** Turn of the room's walls relative to the panorama axes (deg). */
      yaw: number;
    };

const PROJ_PARS = /* glsl */ `
uniform sampler2D projPano;
uniform sampler2D projDetail;
uniform float projHasDetail;
uniform vec3 projOrigin;
uniform float projK;
uniform float projEmit;
varying vec3 vProjPos;
vec3 projSample() {
  vec3 d = normalize( vProjPos - projOrigin );
  float u = atan( d.z, d.x ) * RECIPROCAL_PI2 + 0.5;
  float v = asin( clamp( d.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
  vec2 uv = vec2( u, v );
  // Take gradients from whichever copy of u has no wrap seam, so mip
  // selection doesn't draw a line where the panorama's edges meet.
  vec2 alt = vec2( fract( u + 0.5 ), v );
  vec2 dx = dFdx( uv ), dy = dFdy( uv );
  vec2 ax = dFdx( alt ), ay = dFdy( alt );
  if ( dot( ax, ax ) + dot( ay, ay ) < dot( dx, dx ) + dot( dy, dy ) ) { dx = ax; dy = ay; }
  vec3 base = textureGrad( projPano, uv, dx, dy ).rgb;
  if ( projHasDetail > 0.5 ) {
    vec3 hi = textureGrad( projDetail, uv, dx, dy ).rgb;
    vec3 lo = textureGrad( projDetail, uv, dx * 4.0, dy * 4.0 ).rgb;
    vec3 ratio = clamp( hi / max( lo, vec3( 0.002 ) ), 0.2, 5.0 );
    // Clipped highlights in the 8-bit photo carry no detail: leave the HDR alone there.
    float w = 1.0 - smoothstep( 0.75, 0.97, max( max( lo.r, lo.g ), lo.b ) );
    base *= mix( vec3( 1.0 ), ratio, w );
  }
  return base;
}
`;

export interface ProjectedUniforms {
  projPano: { value: THREE.Texture };
  projDetail: { value: THREE.Texture | null };
  projHasDetail: { value: number };
  projOrigin: { value: THREE.Vector3 };
  projK: { value: number };
  projEmit: { value: number };
}

function addVarying(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vProjPos;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvProjPos = transformed;');
}

/**
 * Lit surface: reflectance from the photo, then the full standard shader (with
 * the soft-light patches), so studio lights and the sun light it for real.
 */
function litMaterial(u: ProjectedUniforms): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  m.userData.soft = true; // patched here, so patchSoftLighting leaves it alone
  m.onBeforeCompile = (shader) => {
    softOnBeforeCompile(shader);
    Object.assign(shader.uniforms, u);
    addVarying(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PROJ_PARS}`)
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `vec3 projL = projSample();
	vec3 projAlb = min( projL * projK, vec3( 0.9 ) );
	vec3 projExcess = max( projL - projAlb / projK, vec3( 0.0 ) );
	vec4 diffuseColor = vec4( diffuse * projAlb, opacity );`,
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += projExcess * projEmit;')
      // The photo already holds the surface's real sheen; a second, synthetic
      // specular adds a milky veil at grazing angles.
      .replace('vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;', 'vec3 totalSpecular = vec3( 0.0 );');
  };
  m.customProgramCacheKey = () => 'proj-lit';
  return m;
}

/** Unlit far surface (sky, distant scenery): the photo as it is, scaled by exposure. */
function unlitMaterial(u: ProjectedUniforms): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ side: THREE.BackSide });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    addVarying(shader);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${PROJ_PARS}`)
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'vec4 diffuseColor = vec4( diffuse * projSample() * projEmit, opacity );');
  };
  m.customProgramCacheKey = () => 'proj-unlit';
  return m;
}

/** Reflectance-free illuminance on a surface in panorama space: sky (sun removed) plus the sun. */
export type Irradiance = (normal: THREE.Vector3) => number;

interface Surface {
  mesh: THREE.Mesh;
  uniforms: ProjectedUniforms;
}

/** The proxy geometry for one location. Rotate `group` to turn the place around the subject. */
export class ProjectedLocation {
  readonly group = new THREE.Group();
  private surfaces: Surface[] = [];

  constructor(pano: THREE.Texture, height: number, shape: ProxyShape, irradiance: Irradiance) {
    const origin = new THREE.Vector3(0, height, 0);
    const make = (geo: THREE.BufferGeometry, normal: THREE.Vector3 | null, name: string) => {
      const uniforms: ProjectedUniforms = {
        projPano: { value: pano },
        projDetail: { value: null },
        projHasDetail: { value: 0 },
        projOrigin: { value: origin },
        // π / E turns radiance into reflectance; E floors at a tiny value for dark corners.
        projK: { value: normal ? Math.PI / Math.max(irradiance(normal), 1e-4) : 1 },
        projEmit: { value: 1 },
      };
      const mesh = new THREE.Mesh(geo, normal ? litMaterial(uniforms) : unlitMaterial(uniforms));
      mesh.name = name;
      mesh.receiveShadow = !!normal;
      mesh.frustumCulled = false;
      if (!normal) mesh.renderOrder = -10;
      this.group.add(mesh);
      this.surfaces.push({ mesh, uniforms });
    };

    if (shape.kind === 'open') {
      // Ground out to where it meets a dome centred on the capture point.
      const r = shape.radius;
      const groundR = Math.sqrt(r * r - height * height);
      const ground = new THREE.CircleGeometry(groundR, 96).rotateX(-Math.PI / 2);
      make(ground, new THREE.Vector3(0, 1, 0), 'ground');
      const dome = new THREE.SphereGeometry(r, 96, 48).translate(0, height, 0);
      make(dome, null, 'dome');
    } else {
      const [x0, x1] = shape.x;
      const [z0, z1] = shape.z;
      const w = x1 - x0;
      const d = z1 - z0;
      const cx = (x0 + x1) / 2;
      const cz = (z0 + z1) / 2;
      const H = shape.ceiling;
      const yaw = THREE.MathUtils.degToRad(shape.yaw);
      const turn = new THREE.Matrix4().makeRotationY(yaw);
      const plane = (pw: number, ph: number, m: THREE.Matrix4, n: THREE.Vector3, name: string) => {
        const g = new THREE.PlaneGeometry(pw, ph, Math.ceil(pw * 2), Math.ceil(ph * 2)).applyMatrix4(m).applyMatrix4(turn);
        make(g, n.applyMatrix4(turn).normalize(), name);
      };
      const M = () => new THREE.Matrix4();
      // Floor and ceiling face into the room.
      plane(w, d, M().makeTranslation(cx, 0, cz).multiply(M().makeRotationX(-Math.PI / 2)), new THREE.Vector3(0, 1, 0), 'floor');
      plane(w, d, M().makeTranslation(cx, H, cz).multiply(M().makeRotationX(Math.PI / 2)), new THREE.Vector3(0, -1, 0), 'ceiling');
      // Walls: PlaneGeometry faces +z, so rotate each to face the room's centre.
      plane(w, H, M().makeTranslation(cx, H / 2, z0), new THREE.Vector3(0, 0, 1), 'wall-z0');
      plane(w, H, M().makeTranslation(cx, H / 2, z1).multiply(M().makeRotationY(Math.PI)), new THREE.Vector3(0, 0, -1), 'wall-z1');
      plane(d, H, M().makeTranslation(x0, H / 2, cz).multiply(M().makeRotationY(Math.PI / 2)), new THREE.Vector3(1, 0, 0), 'wall-x0');
      plane(d, H, M().makeTranslation(x1, H / 2, cz).multiply(M().makeRotationY(-Math.PI / 2)), new THREE.Vector3(-1, 0, 0), 'wall-x1');
    }
  }

  /** Scale for exposure (cont = X·t) and turn the place by `rot` radians. */
  update(cont: number, rot: number) {
    this.group.rotation.y = rot;
    for (const s of this.surfaces) s.uniforms.projEmit.value = cont;
  }

  /** Layer a sharp photo of the same panorama over the HDR, or drop it (and free its GPU memory). */
  setDetail(tex: THREE.Texture | null) {
    const old = this.surfaces[0]?.uniforms.projDetail.value;
    if (old && old !== tex) old.dispose();
    for (const s of this.surfaces) {
      s.uniforms.projDetail.value = tex;
      s.uniforms.projHasDetail.value = tex ? 1 : 0;
    }
  }

  /** Meshes for double-click focusing. */
  get meshes(): THREE.Mesh[] {
    return this.surfaces.map((s) => s.mesh);
  }
}
