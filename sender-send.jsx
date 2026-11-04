import React,{Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useFrame,useLoader} from '@react-three/fiber';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three';
import {useLetterTexture} from './letter-render';
import {createPigeonClips} from './pigeon-clips';
import {useSurface} from './physical';
import './sender-send.css';

// Sender finish: the missing second half of Dearly.
// hold -> roll -> capsule -> arrival -> attach -> depart -> sent
// The letter texture, pigeon model and clip map are the same ones the
// receiver side uses, so a sent letter looks identical on both ends.

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const T = s => REDUCED ? Math.min(s, 350) : s; // ms durations, compressed for reduced motion

function RollingLetter({texture, phase, sealing}) {
  const geo = useMemo(() => new THREE.PlaneGeometry(4.65, 6.06, 64, 180), []);
  const group = useRef();
  const roll = useRef(0); // 0 = flat sheet, 1 = fully rolled
  useEffect(() => () => geo.dispose(), [geo]);
  useFrame((_, dt) => {
    const d = Math.min(dt, .05);
    // Roll up while in the roll phase; stay rolled afterwards.
    if (phase === 'roll') roll.current = Math.min(1, roll.current + d / (T(2200) / 1000));
    const u = 1 - roll.current; // reuse the receiver's unroll maths, reversed
    const length = u * 6.06, p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const dd = (1 - geo.attributes.uv.getY(i)) * 6.06;
      const rest = Math.max(0, dd - length);
      const py = rest > 0 ? 3.03 - length - .19 * Math.sin(rest / .19) : 3.03 - dd;
      const z = rest > 0 ? .19 * (1 - Math.cos(rest / .19)) : 0;
      p.setY(i, py);
      const x = p.getX(i);
      p.setZ(i, z + u * (.065 * Math.sin(x * 1.2) + .055 * x * x));
    }
    p.needsUpdate = true; geo.computeVertexNormals();
    // Stage blocking: flat at left on the desk; once rolled, glide to the
    // capsule, shrink to scroll size, and slide inside when sealing.
    const g = group.current; if (!g) return;
    const rolled = roll.current > .98;
    const target = !rolled
      ? {x: -1.55, y: .1, s: 1}
      : sealing
        ? {x: .02, y: -.93, s: .32}
        : {x: -.78, y: -.93, s: .32};
    const k = 1 - Math.exp(-d * 3.2);
    g.position.x = THREE.MathUtils.lerp(g.position.x, target.x, k);
    g.position.y = THREE.MathUtils.lerp(g.position.y, target.y, k);
    const s = THREE.MathUtils.lerp(g.scale.x, target.s, k);
    g.scale.setScalar(s);
    g.visible = !(phase === 'arrival' || phase === 'attach' || phase === 'depart' || phase === 'sent');
  });
  return <group ref={group} position={[-1.55, .1, 0]}><mesh geometry={geo} castShadow receiveShadow><meshStandardMaterial map={texture} side={THREE.DoubleSide} roughness={.96} bumpMap={texture} bumpScale={.008}/></mesh></group>;
}

function CapsuleRig({phase, sealing, tied, legTarget}) {
  const group = useRef(), cap = useRef();
  useFrame((_, dt) => {
    const g = group.current; if (!g) return;
    const d = Math.min(dt, .05), k = 1 - Math.exp(-d * 4);
    const show = phase === 'capsule' || phase === 'arrival' || phase === 'attach' || phase === 'depart';
    g.visible = show;
    if (!show) return;
    if ((tied || phase === 'depart') && legTarget.current) {
      // Ride on the leg: track the bone's world position every frame.
      g.position.lerp(legTarget.current.clone().add(new THREE.Vector3(-.02, -.1, .06)), 1 - Math.exp(-d * 7));
      const s = THREE.MathUtils.lerp(g.scale.x, .5, k); g.scale.setScalar(s);
      g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, .5, k);
    } else if (sealing || phase !== 'capsule') {
      g.position.lerp(new THREE.Vector3(.88, 0, 0), k);
    }
    if (cap.current) {
      const capX = sealing || phase !== 'capsule' ? .98 : 1.75;
      cap.current.position.x = THREE.MathUtils.lerp(cap.current.position.x, capX, 1 - Math.exp(-d * 5));
    }
  });
  const brass = {color: '#9c8057', metalness: .65, roughness: .45};
  return <group ref={group} position={[.88, 0, 0]} visible={false}>
    <mesh rotation-z={Math.PI / 2} castShadow><cylinderGeometry args={[.17, .17, 1.7, 40]}/><meshStandardMaterial {...brass}/></mesh>
    <mesh position-x={-.86} rotation-z={Math.PI / 2}><torusGeometry args={[.17, .02, 10, 40]}/><meshStandardMaterial {...brass}/></mesh>
    <group ref={cap} position-x={1.75}>
      <mesh rotation-z={Math.PI / 2} castShadow><cylinderGeometry args={[.185, .185, .24, 40]}/><meshStandardMaterial color="#a88b5d" metalness={.65} roughness={.5}/></mesh>
    </group>
  </group>;
}

function SenderBird({phase, onLanded, legTarget}) {
  const gltf = useLoader(GLTFLoader, import.meta.env.BASE_URL+'models/pigeon.glb');
  const root = useRef(), clock = useRef(0), state = useRef('');
  const {bird, mixer, clips, fit} = useMemo(() => {
    const bird = clone(gltf.scene);
    bird.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.name === 'poopMesh_Pigeon_mainMat_0') o.visible = false; const mats = Array.isArray(o.material) ? o.material : [o.material]; o.material = mats.map(m => { const c = m.clone(); if (c.name === 'Pigeon_mainMat') { c.transparent = false; c.alphaTest = .45; c.depthWrite = true; c.side = THREE.DoubleSide; } return c; }); if (!Array.isArray(gltf.scene.getObjectByName(o.name)?.material)) o.material = o.material[0]; } });
    bird.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(bird), size = b.getSize(new THREE.Vector3()), center = b.getCenter(new THREE.Vector3());
    return {bird, mixer: new THREE.AnimationMixer(bird), clips: createPigeonClips(gltf.animations[0]), fit: {scale: 2.5 / Math.max(size.x, size.y, size.z), center, min: b.min.y}};
  }, [gltf]);
  const leg = useMemo(() => bird.getObjectByName('L_leg_077'), [bird]);
  const previous = useRef(null);
  const play = (name, {loop = false, timeScale = 1, fade = .35} = {}) => {
    const action = mixer.clipAction(clips[name]);
    action.reset().setEffectiveWeight(1).setEffectiveTimeScale(timeScale);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop; action.fadeIn(fade); action.play();
    if (previous.current && previous.current !== action) previous.current.fadeOut(fade);
    previous.current = action;
    return action;
  };
  useEffect(() => {
    if (phase === 'arrival' && state.current !== 'arrival') {
      state.current = 'arrival'; clock.current = 0;
      play('flight', {loop: true});
    }
    if (phase === 'attach' && state.current !== 'attach' && state.current !== 'landed') {
      state.current = 'attach'; play('idle', {loop: true});
    }
    if (phase === 'depart' && state.current !== 'depart') {
      state.current = 'depart'; clock.current = 0;
      play('takeoffAndFlight', {timeScale: REDUCED ? 6 : 2.8});
    }
  }, [phase]);
  useEffect(() => {
    const done = e => {
      if (state.current === 'landing') { state.current = 'landed'; play('idle', {loop: true}); onLanded(); }
    };
    mixer.addEventListener('finished', done);
    return () => mixer.removeEventListener('finished', done);
  }, [mixer]);
  useEffect(() => () => { mixer.stopAllAction(); mixer.uncacheRoot(bird); }, [mixer, bird]);
  useFrame((_, dt) => {
    const d = Math.min(dt, .05);
    mixer.update(d);
    if (leg) leg.getWorldPosition(legTarget.current);
    const r = root.current; if (!r) return;
    const show = phase === 'arrival' || phase === 'attach' || phase === 'depart';
    r.visible = show;
    if (!show) return;
    if (phase === 'arrival') {
      clock.current += d;
      const t = Math.min(clock.current / (T(1600) / 1000), 1);
      const e = 1 - Math.pow(1 - t, 2);
      r.position.set(-6.5 + 8.4 * e, 2.3 - 2.3 * e, -2.5 + 2.1 * e);
      if (t >= 1 && state.current === 'arrival') { state.current = 'landing'; play('approachAndLand', {fade: .18}); }
    } else if (phase === 'depart') {
      clock.current += d;
      const t = Math.min(clock.current / (T(3400) / 1000), 1);
      const e = t * t;
      r.position.set(1.9 + 6.2 * e, 3.6 * e, -.4 - 3.2 * e);
      r.rotation.y = THREE.MathUtils.lerp(r.rotation.y, .5, d * 2);
    } else {
      r.position.set(1.9, 0, -.4);
    }
  });
  return <group ref={root} visible={false}><group scale={fit.scale} rotation-y={-.9} position={[-fit.center.x * fit.scale, -fit.min * fit.scale, -fit.center.z * fit.scale]}><primitive object={bird}/></group></group>;
}

function SendScene({letter, phase, sealing, tied, onLanded, legTarget}) {
  const tex = useLetterTexture(letter, undefined, true);
  const surface = useSurface();
  return <>
    <color attach="background" args={['#191a17']}/>
    <ambientLight intensity={1.1}/>
    <hemisphereLight args={['#e7e5de', '#4b3b30', .7]}/>
    <directionalLight position={[-3, 5, 7]} intensity={2.2} color="#ffecd0" castShadow shadow-mapSize={[2048, 2048]} shadow-normalBias={.018}/>
    <pointLight position={[5, -2, 4]} intensity={12} color="#b7c6ce"/>
    <mesh position={[0, 0, -.6]} receiveShadow><planeGeometry args={[200, 200]}/><meshStandardMaterial color="#36342f" roughness={1} bumpMap={surface} bumpScale={.035}/></mesh>
    <RollingLetter texture={tex} phase={phase} sealing={sealing}/>
    <CapsuleRig phase={phase} sealing={sealing} tied={tied} legTarget={legTarget}/>
    <SenderBird phase={phase} onLanded={onLanded} legTarget={legTarget}/>
  </>;
}

const CAPTIONS = {
  hold: ['Hold it a moment longer.', 'When you are ready, roll it up for the journey.'],
  roll: ['Roll it up, tight and true.', 'Every word you wrote, curled safe inside.'],
  capsule: ['Into the brass capsule.', 'The same capsule your reader will find on her leg.'],
  arrival: ['A little messenger. A long way home.', 'She has come for your words.'],
  attach: ['Tie it safe to her leg.', 'One click, and the letter is hers to carry.'],
  depart: ['And away she goes.', 'Somewhere out there, a letter is flying.'],
  sent: ['Your letter is on its way.', 'Share the link, and the pigeon does the rest.']
};
const STEP_OF = {hold: 0, roll: 0, capsule: 1, arrival: 2, attach: 2, depart: 3, sent: 3};

export default function SenderSend({letter, makeUrl, onBack, onPreview, onNewLetter}) {
  const [phase, setPhase] = useState('hold');
  const [sealing, setSealing] = useState(false);
  const [tied, setTied] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const [notice, setNotice] = useState('');
  const legTarget = useRef(new THREE.Vector3(1.9, .3, -.4));
  const timers = useRef([]);
  const later = (fn, ms) => { const id = setTimeout(fn, T(ms)); timers.current.push(id); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => { if (phase === 'roll') later(() => setPhase('capsule'), 2400); }, [phase]);
  useEffect(() => { if (phase === 'depart') later(() => setPhase('sent'), 3600); }, [phase]);

  const seal = () => { setSealing(true); later(() => setPhase('arrival'), 1500); };
  const tie = () => { setTied(true); later(() => setCanSend(true), 1200); };
  async function copyLink() {
    const url = makeUrl();
    try { await navigator.clipboard.writeText(url); setNotice('Link copied. The letter travels inside the link; it is not encrypted.'); }
    catch { setNotice(url); }
  }
  const step = STEP_OF[phase];
  return <div className="experience send-experience">
    <Canvas shadows dpr={[1, 2]} camera={{position: [0, .4, 10.4], fov: 42}} gl={{antialias: true}}>
      <Suspense fallback={null}><SendScene letter={letter} phase={phase} sealing={sealing} tied={tied} onLanded={() => setPhase('attach')} legTarget={legTarget}/></Suspense>
    </Canvas>
    <div className="vignette"/>
    <header><span className="brand">dearly<span>LETTERS, FELT.</span></span><button onClick={onBack}>← Back to the desk</button></header>
    <div className="caption"><p>THE SENDING</p><h1>{CAPTIONS[phase][0]}</h1><span>{CAPTIONS[phase][1]}</span></div>
    <div className="bottom">
      <div className="progress">{['The rolling', 'The capsule', 'The messenger', 'The departure'].map((x, i) => <span key={x} className={step === i ? 'active' : ''}><b>0{i + 1}</b>{x}</span>)}</div>
      <div className="controls">
        {phase === 'hold' && <button className="primary" onClick={() => setPhase('roll')}>Roll up your letter <span>↗</span></button>}
        {phase === 'roll' && <button className="primary" disabled>Rolling…</button>}
        {phase === 'capsule' && <button className="primary" disabled={sealing} onClick={seal}>{sealing ? 'Sealing…' : 'Slide it into the capsule'} <span>↗</span></button>}
        {phase === 'arrival' && <button className="primary" disabled>She is arriving…</button>}
        {phase === 'attach' && !canSend && <button className="primary" disabled={tied} onClick={tie}>{tied ? 'Tying…' : 'Tie it to her leg'} <span>↗</span></button>}
        {phase === 'attach' && canSend && <button className="primary" onClick={() => setPhase('depart')}>Send her off <span>↗</span></button>}
        {phase === 'depart' && <button className="primary" disabled>Away she goes…</button>}
        {phase === 'sent' && <>
          <button className="primary" onClick={copyLink}>Copy letter link <span>↗</span></button>
          <button onClick={onPreview}>See what they will see</button>
          <button onClick={onNewLetter}>Write another letter</button>
        </>}
      </div>
      {phase !== 'sent' && <button className="text-button" onClick={() => setPhase('sent')}>Skip to the letter link</button>}
    </div>
    {notice && <div role="status" className="notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}
  </div>;
}
