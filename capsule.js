// Shared loader for the pigeon message capsule model ("Geocaching
// Capsules" by 3DHaupt, CC BY 4.0 — decimated, split into body/cap and
// restyled in brass; see capsule-model.js). The GLB lives in
// public/models and is fetched (and browser-cached) on first use. Each consumer
// gets its own clone; geometry and materials are shared.
import {useEffect, useState} from 'react';
import {loadModel} from './model-loader';

let cached = null;
function loadCapsuleParts() {
  if (!cached) {
    cached = (async () => {
      const scene = await loadModel('capsule.glb');
      return {body: scene.getObjectByName('CapsuleBody'), cap: scene.getObjectByName('CapsuleCap')};
    })();
  }
  return cached;
}

export function useCapsuleParts() {
  const [parts, setParts] = useState(null);
  useEffect(() => {
    let live = true;
    loadCapsuleParts().then(p => { if (live) setParts({body: p.body.clone(), cap: p.cap.clone()}); });
    return () => { live = false; };
  }, []);
  return parts;
}
