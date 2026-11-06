import React,{Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {PEN_GLB_B64} from './pen-model';
import {useLetterTexture} from './letter-render';
import {layoutLetter,PAGE,faceFont} from './letter-layout';
import TypewriterDesk from './typewriter';

import './writing-desk.css';
import PaperPicker from './paper-picker';
// Tiny synthesized foley: quill scratches and the dip's soft bloop. No assets,
// created lazily inside user gestures so autoplay rules are satisfied.
const sfx={ctx:null,noise:null,on:true,
 ensure(){if(typeof window==='undefined')return;if(!this.ctx){try{this.ctx=new (window.AudioContext||window.webkitAudioContext)();const b=this.ctx.createBuffer(1,Math.floor(this.ctx.sampleRate*.1),this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.noise=b}catch(e){this.ctx=null}}if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume()},
 scratch(){if(!this.on)return;this.ensure();if(!this.ctx)return;const t=this.ctx.currentTime,src=this.ctx.createBufferSource();src.buffer=this.noise;const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=950+Math.random()*750;f.Q.value=1.1;const g=this.ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.016+Math.random()*.008,t+.03);g.gain.exponentialRampToValueAtTime(.0008,t+.15+Math.random()*.06);src.connect(f);f.connect(g);g.connect(this.ctx.destination);src.start(t);src.stop(t+.24)},
 dip(){if(!this.on)return;this.ensure();if(!this.ctx)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='sine';o.frequency.setValueAtTime(175,t);o.frequency.exponentialRampToValueAtTime(62,t+.17);g.gain.setValueAtTime(.0008,t);g.gain.exponentialRampToValueAtTime(.055,t+.02);g.gain.exponentialRampToValueAtTime(.0008,t+.26);o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+.28)}
};
const PW=4.65,PH=6.06;
function pixelPoint(x,y){return new THREE.Vector3((x/PAGE.width-.5)*PW,(.5-y/PAGE.height)*PH,.075)}
export function quadTransform(w,h,pts){
 // Homography mapping the rect (0,0)-(w,h) onto screen corners TL,TR,BR,BL,
 // so the invisible input fields lie exactly on the perspective sheet.
 const A=[],b=[];
 const row=(x,y,X,Y)=>{A.push([x,y,1,0,0,0,-X*x,-X*y]);b.push(X);A.push([0,0,0,x,y,1,-Y*x,-Y*y]);b.push(Y)};
 row(0,0,...pts[0]);row(w,0,...pts[1]);row(w,h,...pts[2]);row(0,h,...pts[3]);
 for(let c=0;c<8;c++){let piv=c;for(let r=c+1;r<8;r++)if(Math.abs(A[r][c])>Math.abs(A[piv][c]))piv=r;if(piv!==c){const ta=A[c];A[c]=A[piv];A[piv]=ta;const tb=b[c];b[c]=b[piv];b[piv]=tb}const d=A[c][c]||1e-9;for(let r=0;r<8;r++){if(r===c)continue;const f=A[r][c]/d;if(!f)continue;for(let k=c;k<8;k++)A[r][k]-=f*A[c][k];b[r]-=f*b[c]}}
 const sv=A.map((r,i)=>b[i]/(r[i]||1e-9)),[a,bb,cc,d,e,f,g,hh]=sv;
 return `matrix3d(${a},${d},0,${g},${bb},${e},0,${hh},0,0,1,0,${cc},${f},0,1)`;
}
export function useWood(){return useMemo(()=>{const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');x.fillStyle='#231e18';x.fillRect(0,0,1024,1024);let seed=12;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647};for(let i=0;i<5500;i++){const y=rand()*1024;x.strokeStyle=`rgba(${rand()>.5?'100,76,49':'8,5,3'},${rand()*.035})`;x.lineWidth=.3+rand()*2;x.beginPath();x.moveTo(0,y);for(let a=0;a<=1024;a+=30)x.lineTo(a,y+Math.sin(a*.013+y)*3+Math.sin(a*.004)*8);x.stroke()}for(let y=0;y<1024;y+=256){x.fillStyle='#080604';x.fillRect(0,y,1024,2)}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.colorSpace=THREE.SRGBColorSpace;return t},[])}
const RESTV=new THREE.Vector3(1.65,-3.08,1.55);
// The desk scene needs an environment map or its metals lie: a
// metalness-.95 nib with nothing to reflect renders as a black blob
// (the sender and receiver scenes carry the same PMREM for this
// reason). Kept faint so the candlelit mood does not lift.
function DeskEnv(){const gl=useThree(s=>s.gl),scene=useThree(s=>s.scene);
 useEffect(()=>{const pmrem=new THREE.PMREMGenerator(gl);const tex=pmrem.fromScene(new RoomEnvironment(),.04).texture;scene.environment=tex;scene.environmentIntensity=.35;return()=>{scene.environment=null;scene.environmentIntensity=1;tex.dispose();pmrem.dispose()}},[gl,scene]);return null}
let penScenePromise=null;
function loadPenScene(){
 if(!penScenePromise){
  const bin=atob(PEN_GLB_B64);const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const url=URL.createObjectURL(new Blob([bytes],{type:'model/gltf-binary'}));
  penScenePromise=new GLTFLoader().loadAsync(url).then(g=>{
   g.scene.traverse(o=>{if(o.isMesh)o.castShadow=true});return g.scene});
 }
 return penScenePromise;
}
function Pen({tip,focused,pulse}){
 const group=useRef();
 // Karosio's antique dip pen, a real model in place of the procedural
 // ones that never read as a pen on a phone: slim dark wooden handle,
 // a proper pointed steel nib and a pale feather vane, baked with its
 // tip at the group origin and its shaft along +Y. It rides the caret
 // with a little bob on each keystroke; the writing pose is a held
 // pen's — nib on the point, shaft up toward the writer at a clear
 // slant, leaning right, away from the line just written.
 const [scene,setScene]=useState(null);
 useEffect(()=>{let live=true;loadPenScene().then(s=>{if(live)setScene(s)});return()=>{live=false}},[]);
 useFrame((_,dt)=>{const g=group.current;if(!g)return;
  const goal=focused?tip.current:RESTV;
  g.position.lerp(goal,1-Math.exp(-dt*(focused?26:5)));
  if(focused){const age=performance.now()-pulse.current;if(age<230){const b=Math.sin(age/230*Math.PI);g.position.y-=b*.04}}
  g.rotation.z=THREE.MathUtils.damp(g.rotation.z,focused?-.42:-1.52,8,dt);
  g.rotation.x=THREE.MathUtils.damp(g.rotation.x,focused?.55:.1,8,dt)});
 return <group ref={group} scale={.5} position={[1.65,-3.08,1.55]} rotation={[.1,0,-1.52]}>
  {scene&&<primitive object={scene}/>}
 </group>
}


export function Candle(){
 const flame=useRef(),glow=useRef(),light=useRef(),t=useRef(7);
 const glowTex=useMemo(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,2,64,64,64);g.addColorStop(0,'rgba(255,190,110,.85)');g.addColorStop(.4,'rgba(255,150,60,.28)');g.addColorStop(1,'rgba(255,140,50,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)},[]);
 useEffect(()=>()=>glowTex.dispose(),[glowTex]);
 useFrame((_,dt)=>{t.current+=dt;const n=Math.sin(t.current*2.9)*.5+Math.sin(t.current*5.3+1.3)*.3+Math.sin(t.current*9.7+.5)*.2;
  if(light.current)light.current.intensity=6+n*.7;
  if(flame.current){flame.current.scale.set(1-n*.04,1+n*.1,1);flame.current.rotation.z=n*.03}
  if(glow.current)glow.current.material.opacity=.13+n*.025;});
 return <group position={[-2.85,-3.15,.75]} scale={1.25}>
  <mesh position-y={.02} castShadow><cylinderGeometry args={[.3,.37,.05,24]}/><meshStandardMaterial color="#8a6f3e" metalness={.8} roughness={.38}/></mesh>
  <mesh position-y={.09} castShadow><cylinderGeometry args={[.06,.09,.1,16]}/><meshStandardMaterial color="#8a6f3e" metalness={.8} roughness={.38}/></mesh>
  <mesh position-y={.33} castShadow><cylinderGeometry args={[.15,.17,.4,20]}/><meshStandardMaterial color="#e9dfc6" roughness={.55}/></mesh>
  <mesh position-y={.532}><cylinderGeometry args={[.165,.165,.025,20]}/><meshStandardMaterial color="#f2e8d0" roughness={.5}/></mesh>
  <mesh position-y={.56}><cylinderGeometry args={[.014,.014,.06,8]}/><meshStandardMaterial color="#171310" roughness={.9}/></mesh>
  <group ref={flame} position-y={.68}>
   <mesh scale={[.62,1.6,.62]}><sphereGeometry args={[.09,12,16]}/><meshBasicMaterial color="#ff8f1f" transparent opacity={.55}/></mesh>
   <mesh position-y={-.015} scale={[.38,1,.38]}><sphereGeometry args={[.09,12,16]}/><meshBasicMaterial color="#ffc46b" transparent opacity={.85}/></mesh>
   <mesh position-y={-.03} scale={[.18,.5,.18]}><sphereGeometry args={[.09,12,16]}/><meshBasicMaterial color="#fff6d8"/></mesh>
  </group>
  <sprite ref={glow} position-y={.68} scale={[1.15,1.15,1]}><spriteMaterial map={glowTex} transparent opacity={.13} depthWrite={false}/></sprite>
  <pointLight ref={light} position={[0,.8,.3]} color="#ffab5e" intensity={6} distance={0} decay={1.2}/>
 </group>
}
function Lamp({angle,onAngle,head,onHead}){
 const drag=useRef(null),hd=useRef(null);
 const hr=THREE.MathUtils.degToRad(Math.max(-45,Math.min(45,head||0)));
 // An anglepoise, modelled on the real thing: heavy disc base, paired
 // arms, a coil spring, and a visible bolt through every joint — base,
 // elbow and head — because on a real lamp every bolted joint moves.
 // One input (the Lamp angle slider, or dragging the lamp itself)
 // drives a two-bone solve for the head, so all three joints hinge
 // together and the pool of light travels across the page.
 const a=THREE.MathUtils.degToRad(Math.max(-32,Math.min(40,angle||0)));
 const black='#1e1e20',steel='#83878c',dark='#3a3b3e';
 const B={x:0,y:.22},L1=1.02,L2=.92;
 const T={x:.92+a*.55,y:1.30-a*.30};
 const dx=T.x-B.x,dy=T.y-B.y,dd=Math.hypot(dx,dy),d=Math.min(L1+L2-.001,dd);
 const phi=Math.atan2(dy,dx),cosA=Math.max(-1,Math.min(1,(L1*L1+d*d-L2*L2)/(2*L1*d)));
 const th=phi+Math.acos(cosA);
 const E={x:B.x+L1*Math.cos(th),y:B.y+L1*Math.sin(th)},H={x:B.x+dx*(d/dd),y:B.y+dy*(d/dd)};
 const segP=(p,q)=>({pos:[(p.x+q.x)/2,(p.y+q.y)/2],rot:Math.atan2(q.y-p.y,q.x-p.x)-Math.PI/2,len:Math.hypot(q.x-p.x,q.y-p.y)});
 const s1=segP(B,E),s2=segP(E,H),sS=segP({x:B.x-.1,y:B.y+.03},{x:B.x+(E.x-B.x)*.55-.1,y:B.y+(E.y-B.y)*.55});
 const arm=(s,z)=><mesh position={[s.pos[0],s.pos[1],z]} rotation-z={s.rot} castShadow><cylinderGeometry args={[.027,.027,s.len,10]}/><meshStandardMaterial color={black} metalness={.35} roughness={.5}/></mesh>;
 const joint=(p,r)=><group position={[p.x,p.y,0]}><mesh rotation-x={Math.PI/2} castShadow><cylinderGeometry args={[r,r,.22,20]}/><meshStandardMaterial color={dark} metalness={.6} roughness={.4}/></mesh><mesh rotation-x={Math.PI/2} position-z={.125}><cylinderGeometry args={[r*.45,r*.45,.03,14]}/><meshStandardMaterial color={steel} metalness={.85} roughness={.3}/></mesh><mesh position-z={.143}><boxGeometry args={[r*.62,.014,.012]}/><meshStandardMaterial color={dark} metalness={.6} roughness={.4}/></mesh></group>;
 return <group position={[-2.9,-3.15,.75]} onPointerDown={e=>{e.stopPropagation();drag.current={x:e.clientX,y:e.clientY,a:angle||0};try{e.target.setPointerCapture(e.pointerId)}catch(err){}}} onPointerMove={e=>{if(drag.current&&onAngle)onAngle(Math.max(-32,Math.min(40,drag.current.a+(e.clientX-drag.current.x)*.25+(drag.current.y-e.clientY)*.15)))}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
  <mesh position-y={.045} castShadow receiveShadow><cylinderGeometry args={[.34,.4,.09,28]}/><meshStandardMaterial color={black} metalness={.35} roughness={.5}/></mesh>
  <mesh position-y={.12} castShadow><cylinderGeometry args={[.13,.17,.07,20]}/><meshStandardMaterial color={black} metalness={.35} roughness={.5}/></mesh>
  {[.075,-.075].map(z=><mesh key={z} position={[0,.14,z]} castShadow><boxGeometry args={[.07,.26,.03]}/><meshStandardMaterial color={black} metalness={.35} roughness={.5}/></mesh>)}
  {joint(B,.085)}
  {arm(s1,.075)}{arm(s1,-.075)}{arm(s2,.075)}{arm(s2,-.075)}
  <group position={[sS.pos[0],sS.pos[1],-.1]} rotation-z={sS.rot}><mesh><cylinderGeometry args={[.013,.013,sS.len,8]}/><meshStandardMaterial color={dark} metalness={.6} roughness={.45}/></mesh>{[-.38,-.27,-.16,-.05,.06,.17,.28,.39].map(f=><mesh key={f} position-y={f*sS.len} rotation-x={Math.PI/2}><torusGeometry args={[.033,.0105,8,18]}/><meshStandardMaterial color={steel} metalness={.8} roughness={.35}/></mesh>)}</group>
  {joint(E,.078)}
  {joint(H,.07)}
  <group position={[H.x,H.y,0]} rotation-z={-.62-a*.3+hr} onPointerDown={e=>{e.stopPropagation();hd.current={y:e.clientY,h:head||0};try{e.target.setPointerCapture(e.pointerId)}catch(err){}}} onPointerMove={e=>{if(hd.current&&onHead)onHead(Math.max(-45,Math.min(45,hd.current.h+(e.clientY-hd.current.y)*.3)))}} onPointerUp={()=>{hd.current=null}} onPointerCancel={()=>{hd.current=null}}>
   <mesh position-y={.31} castShadow><cylinderGeometry args={[.038,.038,.2,10]}/><meshStandardMaterial color={black} metalness={.35} roughness={.5}/></mesh>
   <mesh castShadow><cylinderGeometry args={[.085,.30,.44,24,1,true]}/><meshStandardMaterial color={black} metalness={.4} roughness={.45} side={THREE.DoubleSide}/></mesh>
   <mesh position-y={.25} castShadow><cylinderGeometry args={[.05,.085,.06,16]}/><meshStandardMaterial color={dark} metalness={.6} roughness={.4}/></mesh>
   <mesh position-y={-.3}><sphereGeometry args={[.09,12,10]}/><meshBasicMaterial color="#fff3cf"/></mesh>
   <pointLight position={[0,-.36,.02]} color="#ffdca8" intensity={22} distance={0} decay={2}/>
  </group>
 </group>
}
function DeskScene({letter,onMetrics,onBounds,onFocus,caret,focused,pulse,mode,lampAngle,onLampAngle,lampHead,onLampHead}){
 const tex=useLetterTexture(letter,onMetrics,true),wood=useWood(),tip=useRef(pixelPoint(160,365)),paper=useRef(),slope=useRef(),home=useRef({pos:new THREE.Vector3(0,-1.05,13),tgt:new THREE.Vector3(0,-.35,-.2)}),look=useRef(new THREE.Vector3(0,-.35,-.2)),lastKey=useRef(''),lastRep=useRef(new THREE.Vector3(0,-1.05,13));
 const {camera,size}=useThree();
 const geometry=useMemo(()=>{const g=new THREE.PlaneGeometry(PW,PH,90,120),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),edge=Math.pow(Math.abs(x)/(PW/2),9);p.setZ(i,.012*Math.sin(y*2)+edge*.055);p.setX(i,x+edge*.009*Math.sin(y*37))}g.computeVertexNormals();return g},[]);
 // Fit the sheet by measuring its own projection: set a first-guess zoom,
 // rescale by the ratio of available to projected size, then re-centre the
 // camera on the projected centre. Self-correcting on any screen — the old
 // fixed constants left the sheet overflowing and off-centre on phones.
 useEffect(()=>{
  // Perspective fit: frame the whole desk - sloped board, candle, bottle,
  // table front - by projecting sample points and dollying until they fit,
  // then report the sheet's four projected corners for the input overlay.
  const sl=slope.current;if(!sl)return;sl.updateMatrixWorld(true);
  const pts=[[-2.85,-1.9,.75],[2.8,-2.05,.75],[-2.9,-3.34,.75],[2.8,-3.34,.75]].map(q=>new THREE.Vector3(...q));
  for(const [a,b] of [[-1,1],[1,1],[-1,-1],[1,-1]])pts.push(sl.localToWorld(new THREE.Vector3(a*(PW+.55)/2,b*(PH+.55)/2,0)));
  // Fit BOTH the span and the centre. The old loop only scaled the span
  // to fit while the camera stared at a fixed point — but the desk's
  // projected centre sits well below that point, so on wide, short
  // screens the correctly-sized desk still slid off the bottom edge
  // (candle and lamp bases cropped, empty space at the top). Each pass
  // now also pans camera and target together until the projected
  // centre lands on the screen centre. Verified offline against the
  // real projection math at six viewport shapes.
  let dist=13;const v=new THREE.Vector3(),off=new THREE.Vector3(),bp=new THREE.Vector3(),bt=new THREE.Vector3(0,-.35,-.2);
  for(let it=0;it<4;it++){
   bp.set(0,-1.05,dist);camera.position.copy(bp).add(off);camera.lookAt(bt.clone().add(off));camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
   let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
   for(const q of pts){v.copy(q).project(camera);minx=Math.min(minx,v.x);maxx=Math.max(maxx,v.x);miny=Math.min(miny,v.y);maxy=Math.max(maxy,v.y)}
   const wPx=Math.max(1,(maxx-minx)*size.width/2),hPx=Math.max(1,(maxy-miny)*size.height/2),k=Math.min((size.width-24)/wPx,(size.height-24)/hPx);
   dist/=k;
   const D=camera.position.distanceTo(bt.clone().add(off)),visH=2*D*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),visW=visH*(size.width/size.height);
   off.add(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0).multiplyScalar((minx+maxx)/2*visW/2)).add(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1).multiplyScalar((miny+maxy)/2*visH/2));
  }
  bp.set(0,-1.05,dist);camera.position.copy(bp).add(off);camera.lookAt(bt.clone().add(off));camera.updateMatrixWorld(true);camera.updateProjectionMatrix();home.current.pos.copy(camera.position);home.current.tgt.copy(bt).add(off);
  const corners=[[-PW/2,PH/2],[PW/2,PH/2],[PW/2,-PH/2],[-PW/2,-PH/2]].map(([x,y])=>{const q=sl.localToWorld(new THREE.Vector3(x,y,0)).project(camera);return [(q.x+1)*size.width/2,(1-q.y)*size.height/2]});
  onBounds({corners});
 },[camera,size,onBounds]);
 useEffect(()=>{
  // The pen rides the caret, not the end of the letter: find the laid-out
  // line the caret sits in and measure the text up to it.
  const rows=tex.userData.layout.bodyLines;
  const row=rows.find(r=>caret>=r.start&&caret<=r.start+r.text.length)||rows.at(-1);
  if(!row){const l=pixelPoint(160,PAGE.bodyTop);tip.current.copy(slope.current?slope.current.localToWorld(l):l);return}
  const within=Math.max(0,Math.min(row.text.length,caret-row.start)),c=document.createElement('canvas').getContext('2d');
  c.font=`${row.size}px ${faceFont(letter)}`;const lp=pixelPoint(160+c.measureText(row.text.slice(0,within)).width,row.baseline);tip.current.copy(slope.current?slope.current.localToWorld(lp):lp);
 },[tex,caret]);
 // The camera holds the wide desk tableau for the whole session. It
 // used to glide in on the caret's line while writing and pull back out
 // for every dip — the constant zooming in and out irritated more than
 // it helped, so the follow shot is gone. The corner re-reporting below
 // stays: it keeps the invisible input fields glued to the paper while
 // the initial fit settles.
 useFrame((_,dt)=>{const h=home.current;const dp=h.pos,dl=h.tgt;
  const k=1-Math.exp(-dt*3);camera.position.lerp(dp,k);look.current.lerp(dl,k);camera.lookAt(look.current);
  const settled=camera.position.distanceTo(dp)<.03&&look.current.distanceTo(dl)<.03,key=dp.x.toFixed(1)+','+dp.y.toFixed(1)+','+dp.z.toFixed(1);
  // Re-glue the fields not only once the camera settles but all through the
  // glide - otherwise the recipient and sign-off lines visibly trail behind
  // the paper while it moves.
  if((settled&&key!==lastKey.current)||camera.position.distanceTo(lastRep.current)>.3){if(settled)lastKey.current=key;lastRep.current.copy(camera.position);const sl=slope.current;if(sl){sl.updateMatrixWorld(true);onBounds({corners:[[-PW/2,PH/2],[PW/2,PH/2],[PW/2,-PH/2],[-PW/2,-PH/2]].map(([x,y])=>{const q=sl.localToWorld(new THREE.Vector3(x,y,0)).project(camera);return [(q.x+1)*size.width/2,(1-q.y)*size.height/2]})})}}});
 useEffect(()=>()=>{geometry.dispose();wood.dispose()},[geometry,wood]);
 return <><color attach="background" args={[mode==='lamp'?'#e9dfc9':'#0d0b08']}/><DeskEnv/><ambientLight intensity={mode==='lamp'?.55:.28} color="#ffe7c4"/><hemisphereLight args={mode==='lamp'?['#fff6e8','#7a6a52',.95]:['#4a3a26','#0b0906',.75]}/><directionalLight position={[6,3,4]} intensity={mode==='lamp'?.12:.55} color="#7d90b8"/><directionalLight position={mode==='lamp'?[-4,3,5]:[-5,1.5,5]} intensity={mode==='lamp'?.55:1.15} color="#ffb066" castShadow shadow-mapSize={[512,512]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-normalBias={.03} shadow-bias={-.002}/><mesh rotation-x={-Math.PI/2} position={[0,-3.15,-3]} receiveShadow><planeGeometry args={[46,30]}/><meshStandardMaterial map={wood} bumpMap={wood} bumpScale={.025} roughness={.85}/></mesh><group ref={slope} position={[0,-.35,-.3]} rotation-x={-.5}><mesh position-z={-.075} receiveShadow castShadow><boxGeometry args={[PW+.55,PH+.55,.09]}/><meshStandardMaterial color="#241a12" roughness={.85}/></mesh><mesh position={[.03,-.04,-.02]} rotation-z={.006}><planeGeometry args={[PW+.07,PH+.07]}/><meshStandardMaterial color="#d9cfb6" roughness={1}/></mesh><mesh position={[-.05,-.11,-.04]} rotation-z={-.014}><planeGeometry args={[PW+.07,PH+.07]}/><meshStandardMaterial color="#c9bb9c" roughness={1}/></mesh><mesh ref={paper} geometry={geometry} receiveShadow castShadow onClick={onFocus}><meshStandardMaterial map={tex} roughness={.94} side={THREE.DoubleSide}/></mesh></group><pointLight position={[3.9,-2.1,1.9]} intensity={mode==='lamp'?.8:2.2} distance={3.2} decay={2} color="#ffb066"/>{mode==='lamp'?<Lamp angle={lampAngle} onAngle={onLampAngle} head={lampHead} onHead={onLampHead}/>:<Candle/>}<Pen tip={tip} focused={focused} pulse={pulse}/></>
}
// The choice of desk, shown high in both rooms so it is the first thing a
// writer meets - the old switch sat at the end of the actions row, below
// the stage, and on a phone it was effectively buried.
export function ModeSwitch({mode,onSwitchMode}){
 return <div className="atelier-mode" role="group" aria-label="Choose how to write"><button type="button" aria-pressed={mode==='hand'} onClick={()=>onSwitchMode('hand')}>Pen &amp; ink</button><button type="button" aria-pressed={mode==='type'} onClick={()=>onSwitchMode('type')}>Typewriter</button></div>
}
function QuillDesk({letter,onChange,onPreview,onSwitchMode}){
 const input=useRef(),pen=useRef(false),signatureDraft=useRef([]);
 const fieldInput=useRef(),stageRef=useRef();const[fieldFocus,setFieldFocus]=useState(null);
 const[bounds,setBounds]=useState(null),[metrics,setMetrics]=useState(null),[signing,setSigning]=useState(false),[plain,setPlain]=useState(false),[focused,setFocused]=useState(false),[signaturePreview,setSignaturePreview]=useState(null);
 const[caret,setCaret]=useState(0),[soundOn,setSoundOn]=useState(()=>{try{return localStorage.getItem('dearly-sound')!=='off'}catch(e){return true}}),[lightMode,setLightMode]=useState(()=>{try{return localStorage.getItem('dearly-light')==='lamp'?'lamp':'candle'}catch(e){return 'candle'}}),[lampAngle,setLampAngle]=useState(0),[lampHead,setLampHead]=useState(0);
 const prevBody=useRef(letter.body||''),pulse=useRef(0),lastScratch=useRef(0),soundOnRef=useRef(soundOn);
 function bodyChanged(e){const v=e.target.value,prev=prevBody.current;prevBody.current=v;setCaret(e.target.selectionStart??v.length);
  if(v.length>prev.length){pulse.current=performance.now();if(pulse.current-lastScratch.current>70){lastScratch.current=pulse.current;sfx.on=soundOnRef.current;sfx.scratch()}}
  onChange({...letter,body:v})}
 function toggleLight(){const v=lightMode==='lamp'?'candle':'lamp';setLightMode(v);try{localStorage.setItem('dearly-light',v)}catch(e){}}
 function toggleSound(){const v=!soundOn;setSoundOn(v);soundOnRef.current=v;sfx.on=v;try{localStorage.setItem('dearly-sound',v?'on':'off')}catch(e){}if(v){sfx.ensure();sfx.scratch()}}
 const receiveMetrics=useCallback((_,m)=>setMetrics(m),[]),receiveBounds=useCallback(b=>setBounds(b),[]);
 // The real editor is a tiny parked input (rendered below, fixed at the
 // corner of the screen, under the keyboard): a full-size overlay field
 // makes the phone draw its blue text-cursor handle in mid-air over the
 // paper. Taps on the paper are translated into a caret position here,
 // using the same laid-out lines the canvas draws.
 const measureCtx=useRef(null);
 function caretFromPoint(px,py){
  const rows=metrics?.bodyLines||[];if(!rows.length)return (letter.body||'').length;
  let row=rows[0],best=Infinity;for(const r of rows){const d=Math.abs((r.baseline-r.size*.35)-py);if(d<best){best=d;row=r}}
  if(!measureCtx.current)measureCtx.current=document.createElement('canvas').getContext('2d');
  const ctx=measureCtx.current;ctx.font=`${row.size}px ${faceFont(letter)}`;
  let acc=PAGE.left,col=0;for(const ch of row.text){const w=ctx.measureText(ch).width;if(acc+w/2>px)break;acc+=w;col++}
  return Math.min((letter.body||'').length,row.start+col);
 }
 function tapBody(e){
  // preventDefault first: the browser's own mousedown focus step runs
  // after this handler and would clear the focus set here (the dip's
  // timer-based refocus never faced it — which is why only the
  // paper-click path broke when the editor moved off the paper).
  e.preventDefault();
  const el=input.current;if(!el||!metrics)return;
  el.focus({preventScroll:true});
  const r=e.currentTarget.getBoundingClientRect();if(!r.width||!r.height)return;
  const fx=(e.clientX-r.left)/r.width,fy=(e.clientY-r.top)/r.height;
  const top=PAGE.bodyTop-metrics.size,bottom=Math.min(metrics.signatureY-120,1790)+metrics.size;
  const idx=caretFromPoint(PAGE.left+fx*(PAGE.right-PAGE.left),top+fy*(bottom-top));
  el.setSelectionRange(idx,idx);setCaret(idx);
 }
 // While writing, the stage is full-screen — but the phone keyboard
 // covers the bottom of the layout viewport, and the cameras frame for
 // the full height, so the desk sank behind the keyboard. Size the
 // stage to the VISUAL viewport (the part actually visible) instead:
 // the canvas then ends exactly at the keyboard's top edge and every
 // camera fit composes for the area the writer can really see.
 useEffect(()=>{
  const el=stageRef.current,vv=window.visualViewport;
  if(!el||!vv)return;
  if(!focused&&!fieldFocus){el.style.height='';el.style.top='';return}
  const apply=()=>{el.style.height=vv.height+'px';el.style.top=vv.offsetTop+'px'};
  apply();vv.addEventListener('resize',apply);vv.addEventListener('scroll',apply);
  return()=>{vv.removeEventListener('resize',apply);vv.removeEventListener('scroll',apply);el.style.height='';el.style.top=''};
 },[focused,fieldFocus]);
 function tapField(e,field){
  // The greeting and sign-off get the same treatment as the body: the
  // paper carries tap zones only, and one parked input does the typing
  // — a real input sitting on the paper draws the phone's blue cursor
  // handle and (via the theme's focus ring) a green box on the sheet.
  e.preventDefault();
  setFieldFocus(field);
  const el=fieldInput.current;if(!el)return;
  el.focus({preventScroll:true});
  setTimeout(()=>{try{const v=el.value.length;el.setSelectionRange(v,v)}catch(err){}},40);
 }
 const corners=bounds?bounds.corners:null;
 const scale=corners?Math.hypot(corners[1][0]-corners[0][0],corners[1][1]-corners[0][1])/PAGE.width:1;
 const fieldTransform=corners?quadTransform(PAGE.width*scale,PAGE.height*scale,corners):undefined;
 function point(e){const r=e.currentTarget.getBoundingClientRect();return [(e.clientX-r.left)/r.width*480,(e.clientY-r.top)/r.height*130]}
 function start(e){pen.current=true;e.currentTarget.setPointerCapture(e.pointerId);signatureDraft.current=[...(letter.signature||[]),[point(e)]];setSignaturePreview(signatureDraft.current)}
 function move(e){if(!pen.current)return;const last=signatureDraft.current.at(-1),p=point(e);if(last.length>1200)return;const prev=last.at(-1);if(Math.hypot(p[0]-prev[0],p[1]-prev[1])<1.5)return;const strokes=signatureDraft.current.map(s=>[...s]);strokes.at(-1).push(p);signatureDraft.current=strokes;setSignaturePreview(strokes)}
 function fit(){const ctx=document.createElement('canvas').getContext('2d');let fontSize=Number(letter.fontSize)||72;while(fontSize>32&&layoutLetter(ctx,{...letter,fontSize}).overflow)fontSize-=2;onChange({...letter,fontSize})}
 return <main className="atelier"><nav><span className="brand">dearly<span>Writing room</span></span><span className="atelier-saved">Saved on this device</span></nav><div className="atelier-heading"><h1>Your letter</h1></div>
 <ModeSwitch mode="hand" onSwitchMode={onSwitchMode}/><PaperPicker letter={letter} onChange={onChange}/><div ref={stageRef} className={(focused||fieldFocus)?'atelier-stage writing-live':'atelier-stage'} onClick={e=>{if(e.target.tagName==='CANVAS'){const el=input.current;if(el){if(document.activeElement!==el)el.focus({preventScroll:true});const v=el.value.length;el.setSelectionRange(v,v);setCaret(v)}}}}><Canvas shadows dpr={[1,1.25]} camera={{fov:33,position:[0,-1.05,13],near:.1,far:120}}><Suspense fallback={null}><DeskScene letter={letter} onMetrics={receiveMetrics} onBounds={receiveBounds} onFocus={()=>input.current?.focus()} caret={caret} focused={focused} pulse={pulse} mode={lightMode} lampAngle={lampAngle} onLampAngle={setLampAngle} lampHead={lampHead} onLampHead={setLampHead}/></Suspense></Canvas>
 {bounds&&metrics&&<div className="paper-fields" style={{left:0,top:0,width:PAGE.width*scale,height:PAGE.height*scale,transform:fieldTransform}}>
 <div aria-hidden="true" onPointerDown={e=>tapField(e,'to')} style={{position:'absolute',pointerEvents:'auto',cursor:'text',left:160*scale,top:(230-72)*scale,width:1216*scale,height:95*scale}}/>
 {!letter.to&&fieldFocus!=='to'&&<span className="atelier-placeholder" style={{left:160*scale,top:175*scale,fontSize:62*scale}}>My dearest,</span>}
 {!letter.body&&!focused&&<span className="atelier-placeholder" style={{left:160*scale,top:310*scale,fontSize:62*scale}}>What have you been meaning to say?</span>}
 <div aria-hidden="true" onPointerDown={tapBody} style={{position:'absolute',pointerEvents:'auto',cursor:'text',left:160*scale,top:(PAGE.bodyTop-metrics.size)*scale,width:1216*scale,height:Math.max(150,(Math.min(metrics.signatureY-120,1790)-PAGE.bodyTop+metrics.size)*scale)}}/>
 <div aria-hidden="true" onPointerDown={e=>tapField(e,'from')} style={{position:'absolute',pointerEvents:'auto',cursor:'text',left:160*scale,top:(metrics.lines.at(-1).baseline-70)*scale,width:1216*scale,height:90*scale}}/>
 {!letter.from&&fieldFocus!=='from'&&<span className="atelier-placeholder" style={{left:160*scale,top:(metrics.lines.at(-1).baseline-55)*scale,fontSize:60*scale}}>Yours, always</span>}
 </div>}
 <textarea ref={input} aria-label="Write your letter" spellCheck="false" value={letter.body} maxLength={1500} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onChange={bodyChanged} onSelect={e=>setCaret(e.target.selectionStart??0)} style={{position:'fixed',left:8,bottom:8,width:16,height:16,opacity:0,border:0,padding:0,resize:'none',fontSize:16,caretColor:'transparent'}}/>
 <input ref={fieldInput} aria-label={fieldFocus==='from'?'Sign off':'Recipient'} type="text" maxLength={60} value={fieldFocus?letter[fieldFocus]:(letter.to||'')} onChange={e=>{if(fieldFocus)onChange({...letter,[fieldFocus]:e.target.value})}} onBlur={()=>setFieldFocus(null)} style={{position:'fixed',left:8,bottom:28,width:16,height:16,opacity:0,border:0,padding:0,fontSize:16,caretColor:'transparent'}}/>
 {(focused||fieldFocus)&&<button type="button" onPointerDown={e=>e.preventDefault()} onPointerUp={()=>{input.current?.blur();fieldInput.current?.blur()}} style={{position:'absolute',left:10,top:10,zIndex:6,padding:'8px 14px',borderRadius:999,border:'1px solid rgba(230,205,160,.4)',background:'rgba(20,14,8,.72)',color:'#e9dcc0',fontSize:13,cursor:'pointer',backdropFilter:'blur(3px)'}}>Done</button>}
 
 </div><section className="atelier-controls">{lightMode==='lamp'&&<div className="atelier-spacing"><label>Lamp angle <input type="range" aria-label="Lamp angle" min="-32" max="40" step="1" value={lampAngle} onChange={e=>setLampAngle(Number(e.target.value))}/></label><label>Lamp head <input type="range" aria-label="Lamp head tilt" min="-45" max="45" step="1" value={lampHead} onChange={e=>setLampHead(Number(e.target.value))}/></label><span>tip: drag the lamp to swing it, drag the shade itself to tilt it</span></div>}<div className="atelier-spacing"><label>Letter size <input type="range" aria-label="Letter size" min="32" max="88" step="2" value={letter.fontSize||72} onChange={e=>onChange({...letter,fontSize:Number(e.target.value)})}/></label><label>Line spacing <input type="range" aria-label="Line spacing" min="1.28" max="1.8" step=".05" value={letter.lineSpacing||1.35} onChange={e=>onChange({...letter,lineSpacing:Number(e.target.value)})}/></label><span>{metrics?.fill||0}% of the page</span></div>
 {metrics?.overflow&&<p role="status" className="atelier-overflow">Your words extend beyond this sheet. <button onClick={fit}>Fit to the page</button></p>}
 <div className="atelier-actions"><button onClick={()=>setSigning(v=>!v)}>Sign by hand</button><button onClick={()=>setPlain(v=>!v)}>Edit text</button><button onClick={toggleSound} aria-pressed={soundOn}>{soundOn?'Sound on':'Sound off'}</button><button onClick={toggleLight} aria-pressed={lightMode==='lamp'}>{lightMode==='lamp'?'Lamplight':'Candlelight'}</button><button className="primary" disabled={!letter.body.trim()||metrics?.overflow} onClick={onPreview}>Hold your letter ↗</button></div><p className="atelier-hint">Click the paper to write. Your layout carries through to the finished letter.</p><p className="pen-credit">Pen based on <a href="https://sketchfab.com/3d-models/book-inkwell-and-fountain-pen-519506e44002488dbba8b78e7b9d3ac6" target="_blank" rel="noreferrer">“Book, inkwell and fountain pen”</a> by <a href="https://sketchfab.com/Karosio" target="_blank" rel="noreferrer">Karosio</a> · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noreferrer">CC BY-NC-SA 4.0</a></p>
 </section>{plain&&<section className="atelier-editor"><label>Your words<textarea aria-label="Plain text editor" value={letter.body} maxLength={1500} onChange={e=>{prevBody.current=e.target.value;onChange({...letter,body:e.target.value})}}/></label><button onClick={()=>setPlain(false)}>Return to the desk</button></section>}
 {signing&&<section className="signature-panel"><p>A signature only you could make.</p><svg className="signature-pad" aria-label="Draw your signature" role="img" viewBox="0 0 480 130" onPointerDown={start} onPointerMove={move} onPointerUp={()=>{pen.current=false;onChange({...letter,signature:signatureDraft.current});setSignaturePreview(null)}} onPointerCancel={()=>{pen.current=false;setSignaturePreview(null)}}>{(signaturePreview||letter.signature||[]).map((s,i)=><path key={i} d={s.map((p,j)=>`${j?'L':'M'}${p[0]} ${p[1]}`).join(' ')} stroke="#39352e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>)}</svg><button onClick={()=>onChange({...letter,signature:[]})}>Clear signature</button><button onClick={()=>setSigning(false)}>Keep signature</button></section>}
 </main>
}

// The writing room has two desks over one letter: the quill & ink desk and
// the typewriter. The chosen medium is a property of the letter itself
// (letter.face), so the roll, the pigeon and the reader all see the letter
// in the face it was written in.
export default function WritingRoom({letter,onChange,onPreview}){
 const[mode,setMode]=useState(()=>letter.face==='type'?'type':'hand');
 const switchMode=m=>{setMode(m);onChange({...letter,face:m})};
 return mode==='type'
  ?<TypewriterDesk letter={letter} onChange={onChange} onPreview={onPreview} onSwitchMode={switchMode}/>
  :<QuillDesk letter={letter} onChange={onChange} onPreview={onPreview} onSwitchMode={switchMode}/>;
}
