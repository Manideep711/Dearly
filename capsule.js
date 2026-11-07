// Shared loader for the pigeon message capsule model ("Geocaching
// Capsules" by 3DHaupt, CC BY 4.0 — decimated, split into body/cap and
// restyled in brass; see capsule-model.js). The GLB is base64-inlined
// because the GitHub connector cannot push binaries. Each consumer
// gets its own clone; geometry and materials are shared.
import {useEffect, useState} from 'react';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {CAPSULE_GLB_B64} from './capsule-model';

let cached = null;
function loadCapsuleParts() {
  if (!cached) {
    cached = (async () => {
      const bin = atob(CAPSULE_GLB_B64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], {type: 'model/gltf-binary'}));
      try {
        const gltf = await new GLTFLoader().loadAsync(url);
        const body = gltf.scene.getObjectByName('CapsuleBody');
        const cap = gltf.scene.getObjectByName('CapsuleCap');
        body.traverse(o => { if (o.isMesh) o.castShadow = true; });
        cap.traverse(o => { if (o.isMesh) o.castShadow = true; });
        return {body, cap};
      } finally { URL.revokeObjectURL(url); }
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
