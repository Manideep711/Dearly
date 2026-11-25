// One loader for every static GLB in public/models. Models used to be
// base64-inlined into the JS bundle (~1.6 MB of text the browser had to
// download, parse and decode before the first paint). As real files they
// load in parallel, stay out of the bundle and are cached by the browser.
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';

const cache = new Map();
export function loadModel(name) {
  if (!cache.has(name)) {
    const url = `${import.meta.env.BASE_URL}models/${name}`;
    cache.set(name, new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(url).then(g => {
      g.scene.traverse(o => { if (o.isMesh) o.castShadow = true; });
      return g.scene;
    }));
  }
  return cache.get(name);
}
