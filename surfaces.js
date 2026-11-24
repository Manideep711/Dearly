// Shared, cached surface textures for the 3D rooms. Generated offline
// (tileable, frequency-shaped noise) and shipped as small JPEGs in
// public/textures, so nothing is synthesised on the main thread while
// the desk mounts. Shared across scenes, so they are never disposed.
import * as THREE from 'three';

const loader = new THREE.TextureLoader();
const cache = new Map();
function tex(name, {srgb = false, repeat = 1} = {}) {
  const key = `${name}|${repeat}`;
  if (!cache.has(key)) {
    const t = loader.load(`${import.meta.env.BASE_URL}textures/${name}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    cache.set(key, t);
  }
  return cache.get(key);
}

// Walnut planks: colour, roughness and a height map for bump.
export function walnutMaps(repeat = 2) {
  return {
    map: tex('walnut_color.jpg', {srgb: true, repeat}),
    roughnessMap: tex('walnut_rough.jpg', {repeat}),
    bumpMap: tex('walnut_bump.jpg', {repeat}),
  };
}

// Fine paper tooth and fibres, for the letter sheet's bumpMap.
export function paperGrain(repeat = 3) {
  return tex('paper_grain.jpg', {repeat});
}
