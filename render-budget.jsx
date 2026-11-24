// Keeping the 3D rooms smooth on ordinary hardware.
//
// Measured on an Intel UHD laptop GPU, the writing desk was fill-rate
// bound: ~16 fps at full resolution, ~33 fps at 0.6x, ~24 fps without
// shadows. Two cheap fixes that do not change how a still frame looks:
//
// <AdaptiveResolution>  watches real frame times and nudges the canvas
//   pixel ratio between `min` and `max` so the scene holds ~50+ fps.
//   Strong GPUs stay at full sharpness; weak ones trade a little.
//
// <LazyShadows>  stops re-rendering the shadow map every frame. Shadows
//   only change when something moves, so the map is refreshed for a
//   short burst after any object's world matrix changes (pen, lamp,
//   bird), and otherwise reused. Light intensity changes (the candle's
//   flicker) never need a new shadow map.
import {useEffect, useRef} from 'react';
import {useFrame, useThree} from '@react-three/fiber';

export function AdaptiveResolution({min = .7, max = 1.25}) {
  const setDpr = useThree(s => s.setDpr);
  const state = useRef({dpr: Math.min(max, window.devicePixelRatio || 1), acc: 0, n: 0, cool: 0});
  useEffect(() => { setDpr(state.current.dpr); }, [setDpr]);
  useFrame((_, dt) => {
    const s = state.current;
    if (dt > .25) return;                    // tab switch / hitch: ignore
    s.acc += dt; s.n++;
    if (s.cool > 0) { s.cool -= dt; return; }
    if (s.acc < .75) return;                 // decide on ~0.75 s windows
    const ms = s.acc / s.n * 1000;
    s.acc = 0; s.n = 0;
    let next = s.dpr;
    if (ms > 24) next = Math.max(min, s.dpr * .85);       // under ~42 fps: drop
    else if (ms < 15) next = Math.min(max, s.dpr * 1.08); // over ~66 fps: recover
    if (Math.abs(next - s.dpr) > .01) { s.dpr = next; setDpr(next); s.cool = .5; }
  });
  return null;
}

export function LazyShadows({burst = 12}) {
  const gl = useThree(s => s.gl), scene = useThree(s => s.scene);
  const last = useRef(new Map()), left = useRef(burst);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => { gl.shadowMap.autoUpdate = true; };
  }, [gl]);
  useFrame(() => {
    // Any shadow caster whose world matrix moved since last frame wakes
    // the shadow map for a short burst (covers easing tails).
    let moved = false;
    scene.traverseVisible(o => {
      if (!o.castShadow) return;
      // Skinned meshes (the pigeon) animate through their bones, not
      // their own matrix, so a visible one keeps shadows live.
      if (o.isSkinnedMesh) { moved = true; return; }
      const e = o.matrixWorld.elements, prev = last.current.get(o);
      const sig = e[12] + e[13] * 3.1 + e[14] * 7.7 + e[0] * 1.3 + e[5] * 2.9 + e[1] * 5.3;
      if (prev === undefined || Math.abs(prev - sig) > 1e-5) moved = true;
      last.current.set(o, sig);
    });
    if (moved) left.current = burst;
    if (left.current > 0) { left.current--; gl.shadowMap.needsUpdate = true; }
  });
  return null;
}
