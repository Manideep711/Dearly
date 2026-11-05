import React,{Suspense,useMemo,useEffect,useRef,useState,useCallback} from 'react';
import {Canvas,useLoader,useFrame,useThree} from '@react-three/fiber';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import * as THREE from 'three';
import {createPigeonClips} from './pigeon-clips';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
// Staging helpers: a soft radial texture (contact shadow / light pool),
// a procedural room environment so brass and feathers have something
// real to reflect, and a graded backdrop instead of a flat void.
function radialTexture(stops){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,2,64,64,64);for(const[o,col]of stops)g.addColorStop(o,col);x.fillStyle=g;x.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t}
function StageEnv(){const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene);
 useEffect(()=>{const pmrem=new THREE.PMREMGenerator(gl);const tex=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environment=tex;scene.environmentIntensity=.35;return()=>{scene.environment=null;scene.environmentIntensity=1;tex.dispose();pmrem.dispose()}},[gl,scene]);return null}
function StageBackdrop(){const scene=useThree(s=>s.scene);
 const tex=useMemo(()=>{const c=document.createElement('canvas');c.width=4;c.height=512;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,0,512);g.addColorStop(0,'#46483c');g.addColorStop(.55,'#282a21');g.addColorStop(1,'#12140f');x.fillStyle=g;x.fillRect(0,0,4,512);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t},[]);
 useEffect(()=>{scene.background=tex;return()=>{scene.background=null;tex.dispose()}},[scene,tex]);return null}
function ContactShadow({phase}){const mat=useRef();const tex=useMemo(()=>radialTexture([[0,'rgba(0,0,0,.5)'],[.6,'rgba(0,0,0,.26)'],[1,'rgba(0,0,0,0)']]),[]);
 useEffect(()=>()=>tex.dispose(),[tex]);
 useFrame((_,dt)=>{if(mat.current)mat.current.opacity=THREE.MathUtils.damp(mat.current.opacity,phase==='arrival'?0:.55,5,dt)});
 return <mesh position={[0,.012,0]} rotation-x={-Math.PI/2} raycast={()=>null}><circleGeometry args={[.95,32]}/><meshBasicMaterial ref={mat} map={tex} transparent opacity={0} depthWrite={false}/></mesh>}
function Messenger({phase,onPhase,reaction,onReact,onReactionEnd,seeds,onBite,onFed,onCapsule,capsuleTarget,onHover}){
 const gltf=useLoader(GLTFLoader,import.meta.env.BASE_URL+'models/pigeon.glb');
 const feedingAction=useRef(),feedCycle=useRef(-1),emptyTime=useRef(0),feedingDone=useRef(false),lift=useRef(0);const capsuleRef=useRef();const root=useRef(),clock=useRef(0),previous=useRef(),bitten=useRef(false);
 const {bird,mixer,clips,fit}=useMemo(()=>{const bird=clone(gltf.scene);bird.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.name==='poopMesh_Pigeon_mainMat_0')o.visible=false;const mats=Array.isArray(o.material)?o.material:[o.material];o.material=mats.map(m=>{const c=m.clone();if(c.name==='Pigeon_mainMat'){c.transparent=false;c.alphaTest=.45;c.depthWrite=true;c.side=THREE.DoubleSide}return c});if(!Array.isArray(gltf.scene.getObjectByName(o.name)?.material))o.material=o.material[0]}});bird.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(bird),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3());return{bird,mixer:new THREE.AnimationMixer(bird),clips:createPigeonClips(gltf.animations[0]),fit:{scale:2.5/Math.max(size.x,size.y,size.z),center,min:b.min.y,size}}},[gltf]);
 const pileTex=useMemo(()=>radialTexture([[0,'rgba(0,0,0,.42)'],[1,'rgba(0,0,0,0)']]),[]);
 const livingPose=useMemo(()=>({
  head:bird.getObjectByName('head1_09'),chest:bird.getObjectByName('chest_059'),
  headBase:new THREE.Quaternion(),chestBase:new THREE.Vector3(),
  offset:new THREE.Quaternion(),angles:new THREE.Euler(),applied:false,weight:0,time:0
 }),[bird]);
 const activeSeed=seeds.find(seed=>seed.grains>0)?.id;
 const feedingSpot=useMemo(()=>{
  // Find the beak's lowest point in one peck, in the model's own coordinates.
  const probe=clone(gltf.scene),probeMixer=new THREE.AnimationMixer(probe);
  const action=probeMixer.clipAction(clips.peck);action.play();
  const beak=probe.getObjectByName('Upper_Beak_010');
  let lowest=Infinity,time=1,point=new THREE.Vector3();
  for(let t=.15;t<clips.peck.duration-.15;t+=.02){
   probeMixer.setTime(t);probe.updateMatrixWorld(true);
   const tip=beak.localToWorld(new THREE.Vector3(0,.65,0));
   if(tip.y<lowest){lowest=tip.y;time=t;point.copy(tip)}
  }
  // How far the feet themselves dip across the peck's scrub window, in
  // model units: the feeding lift is set to exactly this, so the feet
  // stay planted instead of sinking through the stage as she bends.
  const legEnds=[];probe.traverse(o=>{if(/_leg_\d+$/.test(o.name)){let e=o;while(e.children.length)e=e.children[0];legEnds.push(e)}});
  let dip=0;
  if(legEnds.length){const lower=Math.max(0,time-.42),pv=new THREE.Vector3();const lowestAt=t=>{probeMixer.setTime(t);probe.updateMatrixWorld(true);let m=Infinity;for(const e of legEnds){e.getWorldPosition(pv);if(pv.y<m)m=pv.y}return m};const base=lowestAt(lower);let m=base;for(let t=lower;t<=lower+.42;t+=.02)m=Math.min(m,lowestAt(t));dip=Math.max(0,base-m)}
  probeMixer.stopAllAction();probeMixer.uncacheRoot(probe);
  return {point,time,dip};
 },[gltf,clips]);
 // The capsule is NOT parented to the leg bone: the rig's animation
 // carries scale keys on the whole leg chain (hip, leg, knee), which
 // squash any child of the bone into a flared bell/pawn shape — that
 // deformation, not the capsule's own geometry, made it look wrong.
 // Instead an invisible anchor rides the bone, and the scene-level
 // capsule (rendered below) is placed on the anchor's true position
 // every frame: same spot, true shape.
 const anchorRef=useRef(),tmpV=useRef(new THREE.Vector3()),tmpA=useRef(new THREE.Vector3()),tmpB=useRef(new THREE.Vector3()),tmpS=useRef(new THREE.Vector3());
 const legR=useMemo(()=>{const leg=bird.getObjectByName('L_leg_077');return leg?leg.children[0].position.length()*.105:0},[bird]);
 useEffect(()=>{
  const leg=bird.getObjectByName('L_leg_077');if(!leg||!legR)return;
  const anchor=new THREE.Object3D();anchor.position.set(legR*1.9,legR*5.24,0);leg.add(anchor);
  anchorRef.current={anchor,leg,knee:leg.children[0]};
  return()=>{leg.remove(anchor);anchorRef.current=null};
 },[bird,legR]);
 const legEnds=useMemo(()=>{const out=[];bird.traverse(o=>{if(/_leg_\d+$/.test(o.name)){let e=o;while(e.children.length)e=e.children[0];out.push(e)}});return out},[bird]);
 useEffect(()=>{
  clock.current=0;bitten.current=false;feedCycle.current=-1;emptyTime.current=0;feedingDone.current=false;
  const interactive=phase==='waiting'||phase==='ready';
  const reacting=interactive&&reaction>0;
  const reactions=['reactLook'];
  const key=reacting?reactions[(reaction-1)%reactions.length]:phase==='arrival'?'flight':phase==='landing'?'approachAndLand':phase==='feeding'?'peck':phase==='ready'?'walk':'idle';
  const action=mixer.clipAction(clips[key]);
  action.reset().setEffectiveWeight(1).setEffectiveTimeScale(phase==='landing'?clips.approachAndLand.duration/.95:interactive&&!reacting?1.2:1);
  action.setLoop(interactive&&!reacting?THREE.LoopRepeat:THREE.LoopOnce,interactive&&!reacting?Infinity:1);action.clampWhenFinished=!(interactive&&!reacting);
  if(phase==='ready'&&!reacting){action.time=.15;action.paused=true}
  if(phase==='feeding'){action.time=Math.max(0,feedingSpot.time-.42);action.paused=true;feedingAction.current=action}
  action.play();
  if(previous.current&&previous.current!==action){previous.current.fadeOut(phase==='landing'?.18:phase==='feeding'?.65:.5);action.fadeIn(phase==='landing'?.18:phase==='feeding'?.65:.5)}
  previous.current=action;
  const done=e=>{
   if(e.action!==action)return;
   if(reacting)onReactionEnd();
   else if(phase==='landing')onPhase('waiting');
   
  };
  mixer.addEventListener('finished',done);
  return()=>mixer.removeEventListener('finished',done);
 },[phase,reaction,clips,mixer,onPhase,onReactionEnd,onFed]);
 useEffect(()=>()=>{mixer.stopAllAction();mixer.uncacheRoot(bird);bird.traverse(o=>{if(o.isMesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose())})},[mixer,bird]);
 useFrame((_,dt)=>{const d=Math.min(dt,.05);
  // Restore the sampled pose before adding this frame's gentle movement.
  // This avoids accumulating rotation when blending between skeletal actions.
  const pose=livingPose;
  if(pose.applied){pose.head?.quaternion.copy(pose.headBase);pose.chest?.scale.copy(pose.chestBase)}
  if(phase==='feeding'&&feedingAction.current){
   const t=clock.current,lower=Math.max(0,feedingSpot.time-.42);
   if(t<.65){feedingAction.current.time=lower;lift.current=THREE.MathUtils.damp(lift.current,0,10,d)}
   else{
    const cycle=(t-.65)/.9,index=Math.floor(cycle),fraction=cycle-index;
    feedingAction.current.time=lower+.42*(.5-.5*Math.cos(fraction*Math.PI*2));
    // Grounding, not hovering: the old constant .05 lift read as the
    // bird floating. Rise only as deep as the peck itself dips, in
    // sync with it, and settle back to the floor each cycle.
    lift.current=THREE.MathUtils.damp(lift.current,Math.min(.3,feedingSpot.dip*fit.scale)*(.5-.5*Math.cos(fraction*Math.PI*2)),14,d);
    if(fraction>=.5&&feedCycle.current!==index&&activeSeed!==undefined){feedCycle.current=index;onBite(activeSeed)}
    if(activeSeed===undefined){emptyTime.current+=d;if(emptyTime.current>.65&&!feedingDone.current){feedingDone.current=true;onFed()}}else emptyTime.current=0;
   }
  }
  if(phase!=='feeding')lift.current=THREE.MathUtils.damp(lift.current,0,8,d);
  mixer.update(d);
  if(anchorRef.current&&capsuleRef.current){const {anchor,leg,knee}=anchorRef.current;anchor.getWorldPosition(tmpV.current);capsuleRef.current.parent.worldToLocal(tmpV.current);capsuleRef.current.position.copy(tmpV.current);
   // Turn the capsule's strap side toward the shin, so the loops
   // visually wrap the leg wherever it currently points.
   leg.getWorldPosition(tmpA.current);knee.getWorldPosition(tmpB.current);capsuleRef.current.parent.worldToLocal(tmpA.current);capsuleRef.current.parent.worldToLocal(tmpB.current);
   const ab=tmpB.current.sub(tmpA.current),tt=THREE.MathUtils.clamp(tmpV.current.clone().sub(tmpA.current).dot(ab)/Math.max(1e-6,ab.lengthSq()),0,1),shin=tmpA.current.add(ab.multiplyScalar(tt)),dir=shin.sub(tmpV.current);dir.y=0;
   if(dir.lengthSq()>1e-8){dir.normalize();capsuleRef.current.rotation.set(0,Math.atan2(dir.z,-dir.x),0)} const ws=anchor.getWorldScale(tmpS.current);capsuleRef.current.scale.setScalar((ws.x+ws.y+ws.z)/3*1.25/fit.scale);}
  if(capsuleRef.current)capsuleRef.current.getWorldPosition(capsuleTarget.current);
  root.current.rotation.y=THREE.MathUtils.damp(root.current.rotation.y,phase==='ready'?.3:0,3,d);
  pose.time+=d;
  const resting=(phase==='waiting'||phase==='ready')&&reaction===0;
  pose.weight=THREE.MathUtils.damp(pose.weight,resting?1:0,6,d);
  if(pose.head&&pose.chest){
   pose.headBase.copy(pose.head.quaternion);pose.chestBase.copy(pose.chest.scale);
   const t=pose.time,w=pose.weight;
   pose.angles.set(w*(.022*Math.sin(t*1.7)+.012*Math.sin(t*.63)),w*(.055*Math.sin(t*.81)+.018*Math.sin(t*1.43)),w*.018*Math.sin(t*1.1));
   pose.offset.setFromEuler(pose.angles);pose.head.quaternion.multiply(pose.offset);
   const breath=w*.009*Math.sin(t*2.3);
   pose.chest.scale.set(pose.chestBase.x*(1+breath),pose.chestBase.y*(1+breath*.35),pose.chestBase.z*(1+breath));
   pose.applied=true;
  }
  clock.current+=d;if(phase==='arrival'){const t=Math.min(clock.current/1.35,1);root.current.position.set(-5+4.65*t,1.6-1.3*t,-2+1.85*t);if(t===1)onPhase('landing')}else if(phase==='landing'){const t=Math.min(clock.current/.95,1),remaining=Math.pow(1-t,2);root.current.position.set(-.35*remaining,.3*remaining,-.15*remaining)}else root.current.position.set(0,THREE.MathUtils.damp(root.current.position.y,lift.current,8,d),0)
  // Grounding clamp (2026-11-05): while she is on the ground (anything
  // but the arrival flight), no foot joint may end below the floor —
  // the clips' crouches and dips otherwise sink her legs into the
  // stage, worst at landing.
  if(phase!=='arrival'){let minY=Infinity;const wp=tmpV.current;for(const e of legEnds){e.getWorldPosition(wp);if(wp.y<minY)minY=wp.y}if(minY<.03)root.current.position.y+=.03-minY}
 });
 return <group ref={root}><group scale={fit.scale} rotation-y={-.35} position={[-fit.center.x*fit.scale,-fit.min*fit.scale,-fit.center.z*fit.scale]}><primitive object={bird} onPointerOver={e=>{e.stopPropagation();onHover('bird')}} onPointerOut={()=>onHover(null)} onClick={e=>{e.stopPropagation();onReact(e.clientX,e.clientY)}}/>
<group ref={capsuleRef} onClick={e=>{e.stopPropagation();if(phase==='ready')onCapsule();else onReact(e.clientX,e.clientY)}} onPointerOver={e=>{e.stopPropagation();onHover('capsule')}} onPointerOut={()=>onHover(null)}>
<mesh castShadow receiveShadow><cylinderGeometry args={[legR,legR,legR*5.2,28]}/><meshStandardMaterial color="#c9a45c" metalness={.85} roughness={.32}/></mesh>
{[-2.35,2.35].map(y=><mesh key={'r'+y} position={[0,y*legR,0]} rotation-x={Math.PI/2} castShadow><torusGeometry args={[legR*1.03,legR*.11,8,28]}/><meshStandardMaterial color="#c9a45c" metalness={.85} roughness={.32}/></mesh>)}
{[-1.3,1.3].map(y=><mesh key={'s'+y} position={[-legR*.95,y*legR,0]} rotation-x={Math.PI/2} scale-x={1.4} castShadow><torusGeometry args={[legR*1.5,legR*.17,8,36]}/><meshStandardMaterial color="#765132" roughness={.9} side={THREE.DoubleSide}/></mesh>)}
</group>{seeds.some(seed=>seed.grains>0)&&<mesh position={[feedingSpot.point.x,feedingSpot.point.y+.0015,feedingSpot.point.z]} rotation-x={-Math.PI/2} raycast={()=>null}><circleGeometry args={[.03/fit.scale*9,24]}/><meshBasicMaterial map={pileTex} transparent opacity={.5} depthWrite={false}/></mesh>}{seeds.filter(seed=>seed.grains>0).map((seed,i)=><Seed key={seed.id} id={seed.id} point={feedingSpot.point} index={i} size={.03/fit.scale} grainsLeft={seed.grains}/>)}</group></group>
}
function Seed({point,index,id,size,grainsLeft}){
 // One drop lands as a little spill of three grains, each its own size,
 // tilt and tone: a single smooth oval read as a plastic pellet.
 const mesh=useRef(),age=useRef(0);
 const v=useMemo(()=>{const h=n=>{const s=Math.sin(id*127.1+n*311.7)*43758.5453;return s-Math.floor(s)};
  const tones=['#e8c97a','#dcb968','#cfa856','#eee0ac','#c49a4e','#b98a44'];
  return{cx:(h(11)-.5)*size*8,cz:(h(12)-.5)*size*8,grains:[0,1,2].map(k=>({dx:(h(k*7+1)-.5)*size*7,dz:(h(k*7+2)-.5)*size*7,sx:.8+h(k*7+3)*.5,sz:1.15+h(k*7+4)*.6,rot:h(k*7+5)*Math.PI*2,tilt:(h(k*7+6)-.5)*.6,tone:tones[(id+k*2)%tones.length]}))}},[id,size]);
 useFrame((_,dt)=>{age.current+=dt;if(mesh.current)mesh.current.position.y=point.y+Math.max(0,1-age.current/.32)*size*7});
 return <group ref={mesh} position={[point.x+v.cx,point.y,point.z+v.cz]}>{v.grains.slice(0,grainsLeft).map((g,k)=><mesh key={k} position={[g.dx,0,g.dz]} rotation={[g.tilt,g.rot,g.tilt*.6]} scale={[size*g.sx,size*.5,size*g.sz]} castShadow><sphereGeometry args={[1,10,8]}/><meshStandardMaterial color={g.tone} roughness={.9}/></mesh>)}</group>
}
function DeliveryCamera({phase,zoom,capsuleTarget}){
 const target=useRef(new THREE.Vector3(0,.65,0));
 const size=useThree(s=>s.size);
 useFrame(({camera},dt)=>{
  // Portrait phones: the fixed landscape framing cropped the bird badly.
  // Dolly the whole shot out until it fits the narrower frame.
  const aspect=size.width/Math.max(1,size.height),fitK=aspect>=1?1:Math.min(2.3,1.02/aspect);
  const close=phase==='ready'?zoom:0;
  const position=new THREE.Vector3(2.6,1.65,3.6).multiplyScalar(fitK).lerp(capsuleTarget.current.clone().add(new THREE.Vector3(.65,.3,.9).multiplyScalar(fitK)),close);
  const aim=new THREE.Vector3(0,.65,0).lerp(capsuleTarget.current,close);
  const easing=1-Math.exp(-Math.min(dt,.05)*2.4);
  camera.position.lerp(position,easing);target.current.lerp(aim,easing);camera.lookAt(target.current);
 });return null;
}
function Capsule(){const cap=useRef();useFrame((_,dt)=>{cap.current.position.y=THREE.MathUtils.lerp(cap.current.position.y,.65,1-Math.exp(-dt*2))});return <group position={[0,.9,0]} rotation={[0,0,-.45]}><mesh><cylinderGeometry args={[.16,.16,.8,40]}/><meshStandardMaterial color="#9c8057" metalness={.65} roughness={.5}/></mesh><mesh ref={cap} position-y={.43}><cylinderGeometry args={[.175,.175,.12,40]}/><meshStandardMaterial color="#a88b5d" metalness={.65} roughness={.5}/></mesh><mesh position-y={.46}><cylinderGeometry args={[.105,.105,.65,40]}/><meshStandardMaterial color="#d3c5a3" roughness={1}/></mesh></group>}
export default function PigeonDelivery({onOpen,onWrite}){
 const[phase,setPhase]=useState('arrival'),[seeds,setSeeds]=useState([]),[reaction,setReaction]=useState(0);
 const[fullness,setFullness]=useState(0),[unlocked,setUnlocked]=useState(false),[zoom,setZoom]=useState(0),[hover,setHover]=useState(null),[pet,setPet]=useState(null);
 const energy=useRef(0),lastMeal=useRef(0),everEaten=useRef(0),isUnlocked=useRef(false),petTimer=useRef();
 const seedQueue=useRef([]),seedNumber=useRef(0),reactionCount=useRef(0),reacting=useRef(false);
 const capsuleTarget=useRef(new THREE.Vector3(0,.3,0)),container=useRef();
 const groundTex=useMemo(()=>{const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');x.fillStyle='#35362c';x.fillRect(0,0,256,256);for(let i=0;i<5200;i++){x.fillStyle=Math.random()<.5?'rgba(255,246,220,.05)':'rgba(0,0,0,.09)';x.fillRect(Math.random()*256,Math.random()*256,1.4,1.4)}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(6,6);t.colorSpace=THREE.SRGBColorSpace;return t},[]);
 const poolTex=useMemo(()=>radialTexture([[0,'rgba(255,224,168,.30)'],[.55,'rgba(255,224,168,.12)'],[1,'rgba(255,224,168,0)']]),[]);
 useEffect(()=>()=>{groundTex.dispose();poolTex.dispose()},[groundTex,poolTex]);
 const change=useCallback(p=>{reacting.current=false;setReaction(0);setPhase(p)},[]);
 const endReaction=useCallback(()=>{reacting.current=false;setReaction(0)},[]);
 const react=useCallback((x,y)=>{
  if(!['waiting','ready'].includes(phase))return;
  const rect=container.current.getBoundingClientRect();
  setPet({x:typeof x==='number'?x-rect.left:rect.width*.55,y:typeof y==='number'?y-rect.top:rect.height*.45,key:performance.now()});
  clearTimeout(petTimer.current);petTimer.current=setTimeout(()=>setPet(null),1200);
  if(!reacting.current){reacting.current=true;setReaction(++reactionCount.current)}
 },[phase]);
 useEffect(()=>()=>clearTimeout(petTimer.current),[]);
 useEffect(()=>{
  let previous=Date.now();
  const timer=setInterval(()=>{const now=Date.now(),dt=Math.min(5,(now-previous)/1000);previous=now;
   if(now-lastMeal.current>60000&&energy.current>0){energy.current=Math.max(0,energy.current-dt*.2);setFullness(energy.current)}
  },1000);return()=>clearInterval(timer);
 },[]);
 const dropSeed=useCallback(()=>{
  if(!['waiting','ready','feeding'].includes(phase)||energy.current+seedQueue.current.length*20>80.01)return;
  const next=[...seedQueue.current,{id:++seedNumber.current,grains:3}];seedQueue.current=next;setSeeds(next);setZoom(0);change('feeding');
 },[phase,change]);
 const bite=useCallback(id=>{
  const seed=seedQueue.current.find(s=>s.id===id);if(!seed)return;
  // One peck takes ONE grain, not the whole spill: the pile visibly
  // shrinks grain by grain, and only the last grain fills her up.
  if(seed.grains>1){const next=seedQueue.current.map(s=>s.id===id?{...s,grains:s.grains-1}:s);seedQueue.current=next;setSeeds(next);return}
  const next=seedQueue.current.filter(s=>s.id!==id);seedQueue.current=next;setSeeds(next);
  energy.current=Math.min(100,energy.current+20);lastMeal.current=Date.now();everEaten.current++;
  setFullness(energy.current);
  if(everEaten.current>=4){isUnlocked.current=true;setUnlocked(true)}
 },[]);
 const fed=useCallback(()=>change(isUnlocked.current?'ready':'waiting'),[change]);
 useEffect(()=>{
  if(phase!=='ready')return;const el=container.current;let touch=null;
  const move=delta=>setZoom(z=>THREE.MathUtils.clamp(z+delta,0,1));
  const wheel=e=>{e.preventDefault();move(e.deltaY*.002)};
  const start=e=>{touch=e.touches[0].clientY};
  const drag=e=>{if(touch===null)return;e.preventDefault();move((touch-e.touches[0].clientY)*.004);touch=e.touches[0].clientY};
  el.addEventListener('wheel',wheel,{passive:false});el.addEventListener('touchstart',start,{passive:true});el.addEventListener('touchmove',drag,{passive:false});
  return()=>{el.removeEventListener('wheel',wheel);el.removeEventListener('touchstart',start);el.removeEventListener('touchmove',drag)};
 },[phase]);
 const hungry=energy.current+seeds.length*20<=80.01;const hunger=Math.round(100-fullness);
 const captions={arrival:'A little messenger. A long way home.',landing:'Something precious has arrived.',waiting:'A little company. A little kindness.',feeding:'One small seed. A little kindness.',ready:'A little gift, just for you.'};
 return <div className={"pigeon-delivery "+(hover==='bird'?'pet-hover':hover==='capsule'?'capsule-hover':'')} ref={container}>
 <Canvas shadows camera={{position:[2.6,1.65,3.6],fov:40}} dpr={[1,1.5]} onCreated={({camera})=>camera.lookAt(0,.65,0)}>
 <DeliveryCamera phase={phase} zoom={zoom} capsuleTarget={capsuleTarget}/><StageEnv/><StageBackdrop/><hemisphereLight args={['#f1e9d7','#5c5847',.8]}/><directionalLight position={[2.5,5,3.5]} intensity={2.6} color="#ffe3b3" castShadow shadow-mapSize={[1024,1024]}/><directionalLight position={[-3.5,3.5,-3.5]} intensity={1.7} color="#b9c8d8"/>
 <mesh rotation-x={-Math.PI/2} receiveShadow onClick={e=>{e.stopPropagation();dropSeed()}}><planeGeometry args={[60,60]}/><meshStandardMaterial map={groundTex} roughness={1}/></mesh><mesh position={[0,.01,0]} rotation-x={-Math.PI/2} raycast={()=>null}><circleGeometry args={[3,40]}/><meshBasicMaterial map={poolTex} transparent depthWrite={false}/></mesh><ContactShadow phase={phase}/>
 <Suspense fallback={null}><Messenger phase={phase} onPhase={change} reaction={reaction} onReact={react} onReactionEnd={endReaction} seeds={seeds} onBite={bite} onFed={fed} onCapsule={onOpen} capsuleTarget={capsuleTarget} onHover={setHover}/></Suspense>
 </Canvas><div className="vignette"/><header><span className="brand">dearly<span>LETTERS, FELT.</span></span><button onClick={onWrite}>Write a letter</button></header>
 <div className="caption"><p>THE PIGEON POST</p><h1>{captions[phase]}</h1></div>
 <div className="bottom">
 {['waiting','feeding','ready'].includes(phase)&&<div className="pigeon-trust"><label htmlFor="pigeon-hunger">{fullness>=80?'Content':fullness>=40?'Feeling better':'A hungry little messenger'} <span>Hunger {hunger}%</span></label><progress id="pigeon-hunger" max="100" value={hunger}/><small>{hungry?'Drop a few seeds. Petting is always optional.':seeds.length?'Enough on the ground for a full meal.':'A full tummy. More seeds when it is hungry again.'}</small></div>}
 <div className="controls">
 {['waiting','ready'].includes(phase)&&<button className="capsule-keyboard" onClick={()=>react()} aria-label="Pet the pigeon">Pet the pigeon</button>}
 {['waiting','feeding','ready'].includes(phase)&&<button className="primary" onClick={dropSeed} disabled={!hungry}>{!hungry?'Enough seeds for now':phase==='feeding'?'Add a seed to its meal':'Drop a seed'}</button>}
 {phase==='ready'&&<><button onClick={()=>setZoom(z=>z<.8?1:0)}>{zoom<.8?'Look closer at its leg':'View the pigeon'}</button><button className="capsule-keyboard" onClick={onOpen} aria-label="Open the brass capsule on the pigeon leg">Open leg capsule</button></>}
 </div>
 {phase==='ready'?<p>Scroll to look closer. Click the brass capsule on its leg.</p>:['waiting','feeding'].includes(phase)&&<p>Tap the ground to feed it. Stroke the pigeon with a click.</p>}
 <div className="bird-credit">Pigeon by <a href="https://sketchfab.com/LostModels2025" target="_blank" rel="noreferrer">LostBoyz2078</a> · <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noreferrer">CC BY-NC 4.0</a> · materials adapted</div>
 </div>{pet&&<div key={pet.key} className="pet-stroke" style={{left:pet.x,top:pet.y}} aria-hidden="true"><svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M24 54c-5-8-13-15-13-20 0-4 4-5 7-1l5 6V13c0-5 6-5 6 0v17-21c0-5 6-5 6 0v21-17c0-5 6-5 6 0v19-12c0-5 6-5 6 0v20c0 7-3 11-5 14"/><path d="M6 16l-3-3M49 7l3-4M54 23h5"/></svg></div>}</div>
}

