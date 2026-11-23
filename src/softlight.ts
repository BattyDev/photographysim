// Area-light approximation for three.js punctual lights.
//
// A real softbox is big: the light-to-shadow transition (terminator) on a face
// wraps further around the form, and specular highlights spread out. three.js
// lights are points, so we patch the standard shader:
//   • diffuse uses the sphere-light "smooth horizon" integral with
//     sin(angular radius) of the source,
//   • the GGX lobe is widened by the source's angular size,
//   • self-shadowing near the terminator is relaxed so the wrap is visible,
//   • PCF shadows use 16 taps and a penumbra that grows with the distance
//     between the subject (main occluder) and the receiver — approximate
//     contact hardening, so a nose shadow stays crisp while the body's shadow
//     on the backdrop goes soft.
import * as THREE from 'three';

export const softUniforms = {
  spotWrap: { value: [0, 0, 0, 0] as number[] },
  /** Per spot: (source diameter m, light→subject distance m, shadow texels per unit tangent). */
  spotSoft: { value: [0, 1, 2, 3].map(() => new THREE.Vector3(0, 1, 512)) },
  dirWrap: { value: 0 },
};

const HEADER = /* glsl */ `
uniform float spotWrap[ 4 ];
uniform float dirWrap;
uniform vec3 spotSoft[ 4 ];
float gWrap = 0.0;
float softRadius( vec3 p, float dr ) {
  float penumbra = p.x * max( dr - p.y, 0.0 ) / max( p.y, 0.05 ) + p.x * 0.012;
  return clamp( penumbra * p.z / max( dr, 0.05 ), 1.0, 48.0 );
}
float softSelfShadow( float w, float nl, float sh ) {
  // Only back-facing points ignore the shadow map (that's self-shadowing);
  // front-facing points keep cast shadows such as the nose shadow.
  return w > 0.001 ? max( sh, 1.0 - smoothstep( -0.06, 0.06, nl ) ) : sh;
}
`;

function patchPhysical(src: string): string {
  const a = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
  const b = 'vec3 irradiance = dotNL * directLight.color;';
  const c = 'vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );';
  const d = 'reflectedLight.directDiffuse += irradiance * diffuseBRDF * ( 1.0 - F );';
  for (const k of [a, b, c, d]) if (!src.includes(k)) throw new Error(`softlight: shader chunk changed (${k})`);
  return src
    .replace(
      a,
      `float rawNL = dot( geometryNormal, directLight.direction );
	float dotNL = saturate( rawNL );
	float wrapNL = gWrap > 0.001 ? ( rawNL >= gWrap ? rawNL : ( rawNL <= -gWrap ? 0.0 : ( rawNL + gWrap ) * ( rawNL + gWrap ) / ( 4.0 * gWrap ) ) ) : dotNL;`,
    )
    .replace(b, `${b}\n\tvec3 wrapIrradiance = wrapNL * directLight.color;`)
    .replace(
      c,
      `PhysicalMaterial wideMat = material;
	float a0 = pow2( material.roughness );
	wideMat.roughness = sqrt( saturate( a0 + gWrap * 0.5 ) );
	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, wideMat );`,
    )
    .replace(d, 'reflectedLight.directDiffuse += wrapIrradiance * diffuseBRDF * ( 1.0 - F );');
}

function patchBegin(src: string): string {
  const spotStart = src.indexOf('#if ( NUM_SPOT_LIGHTS > 0 )');
  const spotEnd = src.indexOf('#endif', src.indexOf('#pragma unroll_loop_end', spotStart));
  const dirStart = src.indexOf('#if ( NUM_DIR_LIGHTS > 0 )');
  const dirEnd = src.indexOf('#endif', src.indexOf('#pragma unroll_loop_end', dirStart));
  if (spotStart < 0 || dirStart < 0 || spotEnd < 0 || dirEnd < 0) throw new Error('softlight: lights_fragment_begin changed');
  let spot = src.slice(spotStart, spotEnd);
  spot = spot
    .replace('? getShadow( spotShadowMap[ i ]', '? softSelfShadow( spotWrap[ i ], dot( geometryNormal, directLight.direction ), getShadow( spotShadowMap[ i ]')
    .replace('vSpotLightCoord[ i ] ) : 1.0;', 'vSpotLightCoord[ i ] ) ) : 1.0;')
    .replace('spotLightShadow.shadowRadius', 'softRadius( spotSoft[ i ], length( spotLight.position - geometryPosition ) )')
    .replace('RE_Direct( directLight,', 'gWrap = spotWrap[ i ];\n\t\tRE_Direct( directLight,');
  let dir = src.slice(dirStart, dirEnd);
  dir = dir
    .replace('? getShadow( directionalShadowMap[ i ]', '? softSelfShadow( dirWrap, dot( geometryNormal, directLight.direction ), getShadow( directionalShadowMap[ i ]')
    .replace('vDirectionalShadowCoord[ i ] ) : 1.0;', 'vDirectionalShadowCoord[ i ] ) ) : 1.0;')
    .replace('RE_Direct( directLight,', 'gWrap = dirWrap;\n\t\tRE_Direct( directLight,');
  // Reset after each block so point/sun lights stay hard.
  spot += '\tgWrap = 0.0;\n';
  dir += '\tgWrap = 0.0;\n';
  return src.slice(0, spotStart) + spot + src.slice(spotEnd, dirStart) + dir + src.slice(dirEnd);
}

/** 16-tap Vogel-disk PCF instead of 5 taps, so wide penumbrae stay smooth. */
function patchShadowPars(src: string): string {
  const re = /shadow = \(\s*texture\( shadowMap, vec3\( shadowCoord\.xy \+ vogelDiskSample\( 0, 5, phi \)[\s\S]*?\) \* 0\.2;/;
  if (!re.test(src)) throw new Error('softlight: shadowmap_pars_fragment changed');
  return src.replace(
    re,
    `float acc = 0.0;
				for ( int k = 0; k < 16; k ++ ) {
					acc += texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( k, 16, phi ) * radius, shadowCoord.z ) );
				}
				shadow = acc / 16.0;`,
  );
}

const SHADOW_PARS = patchShadowPars(THREE.ShaderChunk.shadowmap_pars_fragment);
const PHYSICAL = HEADER + patchPhysical(THREE.ShaderChunk.lights_physical_pars_fragment);
const BEGIN = patchBegin(THREE.ShaderChunk.lights_fragment_begin);

function onBeforeCompile(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.spotWrap = softUniforms.spotWrap;
  shader.uniforms.dirWrap = softUniforms.dirWrap;
  shader.uniforms.spotSoft = softUniforms.spotSoft;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <shadowmap_pars_fragment>', SHADOW_PARS)
    .replace('#include <lights_physical_pars_fragment>', PHYSICAL)
    .replace('#include <lights_fragment_begin>', BEGIN);
}

/** Patch every standard/physical material under `root` (idempotent). */
export function patchSoftLighting(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!(m as THREE.MeshStandardMaterial).isMeshStandardMaterial || m.userData.soft) continue;
      m.userData.soft = true;
      m.onBeforeCompile = onBeforeCompile;
      m.needsUpdate = true;
    }
  });
}

/**
 * Upload per-light wrap values in the same order three.js packs spot lights:
 * visible lights in scene order, shadow casters first.
 */
export interface SpotSoftness {
  light: THREE.SpotLight;
  /** sin(angular radius) as seen from the subject. */
  wrap: number;
  /** Equivalent source diameter (m). */
  size: number;
  /** Light → subject distance (m). */
  subjectDistance: number;
}

export function setSpotSoftness(spots: SpotSoftness[], sunWrap: number) {
  const visible = spots.filter((s) => s.light.visible);
  const ordered = [...visible.filter((s) => s.light.castShadow), ...visible.filter((s) => !s.light.castShadow)];
  for (let i = 0; i < 4; i++) {
    const o = ordered[i];
    softUniforms.spotWrap.value[i] = o?.wrap ?? 0;
    if (!o) continue;
    const sh = o.light.shadow;
    const fovHalf = o.light.angle * sh.focus;
    const texelsPerUnit = sh.mapSize.x / (2 * Math.tan(fovHalf));
    softUniforms.spotSoft.value[i].set(o.size, o.subjectDistance, texelsPerUnit);
  }
  softUniforms.dirWrap.value = sunWrap;
}
