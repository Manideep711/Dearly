// Material corrections for the pigeon, shared by the sending and the
// receiving scenes.
//
// Feet: the model's texture paints the legs a saturated, glossy crimson
// that reads as plastic up close. Real rock-pigeon feet are a softer
// coral-pink with matte, scaly skin. The legs share one texture atlas
// with the plumage, so they are found by colour, not by mesh: pixels
// that are strongly red (red well above green and blue) are toned toward
// a natural coral and made matte. Grey and iridescent plumage has no
// such red excess, so it is untouched.
export function applyPigeonLook(material) {
  if (!material || material.userData.pigeonLook) return material;
  material.userData.pigeonLook = true;
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        float pgRed = diffuseColor.r - max(diffuseColor.g, diffuseColor.b);
        float pgFoot = smoothstep(0.10, 0.28, pgRed);
        float pgLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        vec3 pgCoral = vec3(pgLum) * vec3(1.62, 0.98, 0.92) + vec3(0.035, 0.012, 0.01);
        diffuseColor.rgb = mix(diffuseColor.rgb, pgCoral, pgFoot * 0.6);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.82, pgFoot);`);
  };
  material.customProgramCacheKey = () => 'pigeon-look-v1';
  material.needsUpdate = true;
  return material;
}
