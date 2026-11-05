import React,{Suspense,useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useFrame,useLoader,useThree} from '@react-three/fiber';
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
//
// Choreography runs on wall-clock time, not accumulated frame dt: on a
// slow device the old dt-clamped maths fell behind the real-time phase
// timers, so the roll froze half-done and the departure hung mid-air.
// Every rig below derives its progress from performance.now() instead.

const REDUCED = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const T = s => REDUCED ? Math.min(s, 350) : s; // ms durations, compressed for reduced motion
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = v => { v = clamp01(v); return v * v * (3 - 2 * v); };

// Stage blocking (world units; camera at [0, .4, 10.4], fov 42).
const LETTER_FLAT = new THREE.Vector3(-1.55, -.3, 0);
const CAPSULE_POS = new THREE.Vector3(.55, -1.15, .3); // rests clear of the landing spot
const SCROLL_POS = new THREE.Vector3(-.8, -1.15, .3);  // rolled letter waits at the capsule's mouth
const BIRD_LAND = new THREE.Vector3(2.35, 0, -.35);
const CAP_OPEN = new THREE.Vector3(-.25, -.6, .15);    // cap rests on the desk, below the mouth
const CAP_SHUT = new THREE.Vector3(-.66, 0, 0);        // cap clicked onto the entry (left) end

function RollingLetter({texture, phase, sealing, sealT0, manualRoll, onRolled}) {
  const geo = useMemo(() => new THREE.PlaneGeometry(4.65, 6.06, 48, 120), []);
  const group = useRef();
  const rollT0 = useRef(0);
  const lastRoll = useRef(-1);
  const rolledCalled = useRef(false);
  useEffect(() => () => geo.dispose(), [geo]);
  useEffect(() => { if (phase === 'roll') { rollT0.current = performance.now(); rolledCalled.current = false; } }, [phase]);
  useFrame((_, dt) => {
    const g = group.current; if (!g) return;
    const inScene = !(phase === 'arrival' || phase === 'attach' || phase === 'depart' || phase === 'sent');
    g.visible = inScene;
    if (!inScene) return;
    // Roll progress: when the sender takes hold of it, their own scroll
    // winds the paper (the receiver's manual unroll, run backwards);
    // otherwise the wall clock runs it, as before.
    let roll = lastRoll.current < 0 ? 0 : lastRoll.current;
    if (phase === 'roll' && !rollT0.current) rollT0.current = performance.now();
    const manual = manualRoll.current.active;
    let rollTarget = 0;
    if (phase === 'roll' && manual) rollTarget = manualRoll.current.value;
    else if (phase === 'roll') rollTarget = clamp01((performance.now() - rollT0.current) / T(2100));
    else if (phase !== 'hold') rollTarget = 1;
    roll = THREE.MathUtils.damp(roll, rollTarget, 12, Math.min(dt, .05));
    if (Math.abs(roll - rollTarget) < .001) roll = rollTarget;
    manualRoll.current.visual = roll;
    if (phase === 'roll' && manual && rollTarget >= 1 && roll > .98 && !rolledCalled.current) { rolledCalled.current = true; onRolled(); }
    if (Math.abs(roll - lastRoll.current) > .0004) {
      lastRoll.current = roll;
      const u = 1 - roll; // reuse the receiver's unroll maths, reversed
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
    }
    // Blocking: flat on the left; once rolled, wait at the capsule mouth;
    // while sealing, slide into the tube and shrink away inside it.
    const rolled = roll > .98;
    let target = LETTER_FLAT, scale = 1;
    if (rolled && sealing) {
      const p = smooth((performance.now() - sealT0.current) / T(900));
      target = SCROLL_POS.clone().lerp(CAPSULE_POS, p);
      scale = THREE.MathUtils.lerp(.3, .1, p);
    } else if (rolled) { target = SCROLL_POS; scale = .3; }
    const k = 1 - Math.exp(-.016 * 3.2);
    g.position.lerp(target, k);
    g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, scale, k));
  });
  return <group ref={group} position={LETTER_FLAT.toArray()}><mesh geometry={geo}><meshStandardMaterial map={texture} side={THREE.DoubleSide} roughness={.96} bumpMap={texture} bumpScale={.008}/></mesh></group>;
}

function CapsuleRig({phase, sealing, sealT0, tied, attached, legTarget}) {
  const group = useRef(), cap = useRef();
  useFrame(() => {
    const g = group.current; if (!g) return;
    const show = (phase === 'capsule' || phase === 'arrival' || phase === 'attach') && !attached;
    g.visible = show;
    if (!show) return;
    if (tied && legTarget.current) {
      // Fly to the leg; the bone-attached capsule takes over on arrival.
      const target = legTarget.current.clone().add(new THREE.Vector3(-.02, .04, .05));
      g.position.lerp(target, 1 - Math.exp(-.016 * 6));
    } else {
      g.position.lerp(CAPSULE_POS, 1 - Math.exp(-.016 * 4));
    }
    if (cap.current) {
      // The cap waits on the desk, then clicks onto the entry end as the
      // second half of the sealing beat — it must visibly close.
      let target = CAP_OPEN;
      if (sealing) {
        const p = smooth(((performance.now() - sealT0.current) / T(1500) - .45) / .55);
        target = CAP_OPEN.clone().lerp(CAP_SHUT, p);
      } else if (phase !== 'capsule') target = CAP_SHUT;
      cap.current.position.lerp(target, 1 - Math.exp(-.016 * 9));
      if (cap.current.position.distanceTo(target) < .004) cap.current.position.copy(target);
    }
  });
  const brass = {color: '#b08d57', metalness: .65, roughness: .42};
  return <group ref={group} position={CAPSULE_POS.toArray()} visible={false}>
    <mesh rotation-z={Math.PI / 2}><cylinderGeometry args={[.145, .145, 1.05, 36]}/><meshStandardMaterial {...brass}/></mesh>
    <mesh position-x={.53} rotation-z={Math.PI / 2}><torusGeometry args={[.145, .018, 10, 36]}/><meshStandardMaterial {...brass}/></mesh>
    <mesh position-x={-.53} rotation-z={Math.PI / 2}><torusGeometry args={[.145, .018, 10, 36]}/><meshStandardMaterial {...brass}/></mesh>
    <group ref={cap} position={CAP_OPEN.toArray()}>
      <mesh rotation-z={Math.PI / 2}><cylinderGeometry args={[.16, .16, .22, 36]}/><meshStandardMaterial color="#bd9a63" metalness={.65} roughness={.48}/></mesh>
    </group>
  </group>;
}

// The capsule that rides the leg bone itself — built exactly like the
// receiver's (pigeon-delivery.jsx), in skeleton-local units, so once it
// is strapped on it can never detach, float, or lag behind the bird.
function buildLegCapsule(bird) {
  const leg = bird.getObjectByName('L_leg_077'); if (!leg) return null;
  // Slimmer and more polished than the first version (r .14 x 3.8 long,
  // dull brass) which read as a stubby pawn next to the desk capsule.
  // Same builder as the receiver's, so the capsule your reader finds is
  // the capsule you tied on.
  const length = leg.children[0].position.length(), r = length * .105;
  const attachment = new THREE.Group(); attachment.position.y = length * .55;
  const brass = new THREE.MeshStandardMaterial({color: '#c9a45c', metalness: .85, roughness: .32});
  const leather = new THREE.MeshStandardMaterial({color: '#765132', roughness: .9, side: THREE.DoubleSide});
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 5.2, 32), brass);
  tube.position.x = r * 1.9; attachment.add(tube);
  for (const y of [-2.35, 2.35]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, r * .1, 8, 32), brass);
    rim.rotation.x = Math.PI / 2; rim.position.set(r * 1.9, y * r, 0); attachment.add(rim);
  }
  for (const y of [-1.3, 1.3]) {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(r * 1.5, r * .17, 8, 40), leather);
    strap.rotation.x = Math.PI / 2; strap.scale.x = 1.4; strap.position.set(r * .95, y * r, 0); attachment.add(strap);
  }
  // The sender camera sits farther back than the receiver's; scale the
  // whole attachment up so the tied capsule actually reads on screen.
  attachment.scale.setScalar(1.75);
  attachment.visible = false;
  leg.add(attachment);
  return attachment;
}

function SenderBird({phase, attached, onLanded, legTarget}) {
  const gltf = useLoader(GLTFLoader, import.meta.env.BASE_URL + 'models/pigeon.glb');
  const root = useRef(), clock = useRef(0), state = useRef('');
  const {bird, mixer, clips, fit} = useMemo(() => {
    const bird = clone(gltf.scene);
    bird.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; if (o.name === 'poopMesh_Pigeon_mainMat_0') o.visible = false; const mats = Array.isArray(o.material) ? o.material : [o.material]; o.material = mats.map(m => { const c = m.clone(); if (c.name === 'Pigeon_mainMat') { c.transparent = false; c.alphaTest = .45; c.depthWrite = true; c.side = THREE.DoubleSide; } return c; }); if (!Array.isArray(gltf.scene.getObjectByName(o.name)?.material)) o.material = o.material[0]; } });
    bird.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(bird), size = b.getSize(new THREE.Vector3()), center = b.getCenter(new THREE.Vector3());
    return {bird, mixer: new THREE.AnimationMixer(bird), clips: createPigeonClips(gltf.animations[0]), fit: {scale: 3.35 / Math.max(size.x, size.y, size.z), center, min: b.min.y}};
  }, [gltf]);
  const leg = useMemo(() => bird.getObjectByName('L_leg_077'), [bird]);
  // Built in an effect after mount, mirroring pigeon-delivery.jsx exactly
  // (a useMemo-built attachment never appeared on the leg in production).
  const legCapsule = useRef(null);
  useEffect(() => {
    const attachment = buildLegCapsule(bird);
    legCapsule.current = attachment;
    return () => { if (attachment && leg) leg.remove(attachment); };
  }, [bird, leg]);
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
    const d = Math.min(dt, .1); // raw-ish dt: choreography keeps real-time pace
    mixer.update(d);
    if (legCapsule.current) legCapsule.current.visible = attached;
    if (leg) leg.getWorldPosition(legTarget.current);
    const r = root.current; if (!r) return;
    const show = phase === 'arrival' || phase === 'attach' || phase === 'depart';
    r.visible = show;
    if (!show) return;
    if (phase === 'arrival') {
      clock.current += d;
      const t = Math.min(clock.current / (T(1600) / 1000), 1);
      const e = 1 - Math.pow(1 - t, 2);
      r.position.set(-6.5 + (BIRD_LAND.x + 6.5) * e, 2.3 - 2.3 * e, -2.5 + (BIRD_LAND.z + 2.5) * e);
      if (t >= 1 && state.current === 'arrival') { state.current = 'landing'; play('approachAndLand', {fade: .18}); }
    } else if (phase === 'depart') {
      clock.current += d;
      const t = Math.min(clock.current / (T(3400) / 1000), 1);
      const e = t * t;
      r.position.set(BIRD_LAND.x + 6.6 * e, 4.6 * e, BIRD_LAND.z - 3.4 * e);
      r.rotation.y = THREE.MathUtils.lerp(r.rotation.y, .5, d * 2);
    } else {
      r.position.copy(BIRD_LAND);
    }
  });
  return <group ref={root} visible={false}><group scale={fit.scale} rotation-y={-.9} position={[-fit.center.x * fit.scale, -fit.min * fit.scale, -fit.center.z * fit.scale]}><primitive object={bird}/></group></group>;
}

// Per-phase framing: each beat of the sending gets its own shot — the
// letter centred while it is held and rolled, scroll and capsule
// together for the sealing, the landing spot for the messenger. The
// camera drifts between shots, and on portrait screens it pulls back
// until the shot fits the width (the first framing was landscape-only
// and pushed the landed pigeon clean off a phone screen).
const PHASE_CAM = {hold: [-1.55, 2.55, 8.6], roll: [-1.55, 2.55, 8.6], capsule: [-.35, 1.95, 7.2], arrival: [1.05, 2.3, 7.2], attach: [1.05, 2.3, 7.2], depart: [1.05, 2.3, 7.2], sent: [1.05, 2.3, 7.2]};
function PhaseCamera({phase}) {
  const camera = useThree(s => s.camera), size = useThree(s => s.size);
  useFrame((_, dt) => {
    const [tx, halfW, minZ] = PHASE_CAM[phase] || PHASE_CAM.hold;
    const aspect = size.width / Math.max(1, size.height);
    const tz = Math.max(minZ, halfW / (Math.tan(THREE.MathUtils.degToRad(21)) * aspect));
    const d = Math.min(dt, .05);
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, 3, d);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, tz, 3, d);
    camera.position.y = .4;
  });
  return null;
}

function SendScene({letter, phase, sealing, sealT0, tied, attached, onLanded, legTarget, manualRoll, onRolled}) {
  const tex = useLetterTexture(letter, undefined, true);
  const surface = useSurface();
  return <>
    <PhaseCamera phase={phase}/>
    <color attach="background" args={['#191a17']}/>
    <ambientLight intensity={1.15}/>
    <hemisphereLight args={['#e7e5de', '#4b3b30', 1.5]}/>
    <directionalLight position={[-3, 5, 7]} intensity={2.1} color="#ffecd0"/>
    <pointLight position={[5, -2, 4]} intensity={12} color="#b7c6ce"/>
    <mesh position={[0, 0, -.6]}><planeGeometry args={[200, 200]}/><meshStandardMaterial color="#36342f" roughness={1} bumpMap={surface} bumpScale={.035}/></mesh>
    <RollingLetter texture={tex} phase={phase} sealing={sealing} sealT0={sealT0} manualRoll={manualRoll} onRolled={onRolled}/>
    <CapsuleRig phase={phase} sealing={sealing} sealT0={sealT0} tied={tied} attached={attached} legTarget={legTarget}/>
    <SenderBird phase={phase} attached={attached} onLanded={onLanded} legTarget={legTarget}/>
  </>;
}

const CAPTIONS = {
  hold: ['Hold it a moment longer.', 'Scroll or drag — the paper winds up under your own hand.'],
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
  const [attached, setAttached] = useState(false);
  const [canSend, setCanSend] = useState(false);
  const [notice, setNotice] = useState('');
  const legTarget = useRef(new THREE.Vector3(2.35, .3, -.35));
  const sealT0 = useRef(0);
  const timers = useRef([]);
  const later = (fn, ms) => { const id = setTimeout(fn, T(ms)); timers.current.push(id); };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const manualRoll = useRef({active: false, value: 0, visual: 0});
  const [manualActive, setManualActive] = useState(false);
  useEffect(() => { if (phase === 'roll') later(() => { if (!manualRoll.current.active) setPhase('capsule'); }, 2400); }, [phase]);
  useEffect(() => { if (phase === 'depart') later(() => setPhase('sent'), 3600); }, [phase]);

  const seal = () => { sealT0.current = performance.now(); setSealing(true); later(() => setPhase('arrival'), 1700); };
  const tie = () => { setTied(true); later(() => { setAttached(true); setCanSend(true); }, 1150); };
  async function copyLink() {
    const url = makeUrl();
    try { await navigator.clipboard.writeText(url); setNotice('Link copied. The letter travels inside the link; it is not encrypted.'); }
    catch { setNotice(url); }
  }
  const step = STEP_OF[phase];
  // Manual scroll-to-roll: the receiver unrolls by hand, so the sender
  // rolls by hand — scrolling winds (or unwinds) the paper directly.
  // The button still runs the whole roll on its own.
  const touchY = useRef(null);
  const driveRoll = delta => {
    if (phase !== 'hold' && phase !== 'roll') return;
    if (!manualRoll.current.active) { manualRoll.current.active = true; manualRoll.current.value = manualRoll.current.visual || 0; setManualActive(true); }
    manualRoll.current.value = clamp01(manualRoll.current.value + delta);
    if (phase === 'hold') setPhase('roll');
  };
  const handleRolled = () => { manualRoll.current.active = false; setManualActive(false); setPhase('capsule'); };
  const finishRoll = () => { manualRoll.current.active = false; setManualActive(false); later(() => setPhase('capsule'), 700); };
  return <div className="experience send-experience"
    onWheel={e => driveRoll(e.deltaY / 600)}
    onTouchStart={e => { touchY.current = e.touches[0].clientY; }}
    onTouchMove={e => { if (touchY.current === null) return; driveRoll((touchY.current - e.touches[0].clientY) / 260); touchY.current = e.touches[0].clientY; }}
    onTouchEnd={() => { touchY.current = null; }}>
    <Canvas shadows dpr={[1, 2]} camera={{position: [0, .4, 10.4], fov: 42}} gl={{antialias: true}}>
      <Suspense fallback={null}><SendScene letter={letter} phase={phase} sealing={sealing} sealT0={sealT0} tied={tied} attached={attached} onLanded={() => setPhase('attach')} legTarget={legTarget} manualRoll={manualRoll} onRolled={handleRolled}/></Suspense>
    </Canvas>
    <div className="vignette"/>
    <header><span className="brand">dearly<span>LETTERS, FELT.</span></span><button onClick={onBack}>← Back to the desk</button></header>
    <div className="caption"><p>THE SENDING</p><h1>{CAPTIONS[phase][0]}</h1><span>{CAPTIONS[phase][1]}</span></div>
    <div className="bottom">
      <div className="progress">{['The rolling', 'The capsule', 'The messenger', 'The departure'].map((x, i) => <span key={x} className={step === i ? 'active' : ''}><b>0{i + 1}</b>{x}</span>)}</div>
      <div className="controls">
        {phase === 'hold' && <button className="primary" onClick={() => setPhase('roll')}>Roll up your letter <span>↗</span></button>}
        {phase === 'roll' && (manualActive ? <button className="primary" onClick={finishRoll}>Finish rolling <span>↗</span></button> : <button className="primary" disabled>Rolling…</button>)}
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
