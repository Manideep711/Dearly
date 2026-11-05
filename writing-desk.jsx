import React,{Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {useLetterTexture} from './letter-render';
import {layoutLetter,PAGE} from './letter-layout';

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
function quadTransform(w,h,pts){
 // Homography mapping the rect (0,0)-(w,h) onto screen corners TL,TR,BR,BL,
 // so the invisible input fields lie exactly on the perspective sheet.
 const A=[],b=[];
 const row=(x,y,X,Y)=>{A.push([x,y,1,0,0,0,-X*x,-X*y]);b.push(X);A.push([0,0,0,x,y,1,-Y*x,-Y*y]);b.push(Y)};
 row(0,0,...pts[0]);row(w,0,...pts[1]);row(w,h,...pts[2]);row(0,h,...pts[3]);
 for(let c=0;c<8;c++){let piv=c;for(let r=c+1;r<8;r++)if(Math.abs(A[r][c])>Math.abs(A[piv][c]))piv=r;if(piv!==c){const ta=A[c];A[c]=A[piv];A[piv]=ta;const tb=b[c];b[c]=b[piv];b[piv]=tb}const d=A[c][c]||1e-9;for(let r=0;r<8;r++){if(r===c)continue;const f=A[r][c]/d;if(!f)continue;for(let k=c;k<8;k++)A[r][k]-=f*A[c][k];b[r]-=f*b[c]}}
 const sv=A.map((r,i)=>b[i]/(r[i]||1e-9)),[a,bb,cc,d,e,f,g,hh]=sv;
 return `matrix3d(${a},${d},0,${g},${bb},${e},0,${hh},0,0,1,0,${cc},${f},0,1)`;
}
function useWood(){return useMemo(()=>{const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');x.fillStyle='#231e18';x.fillRect(0,0,1024,1024);let seed=12;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647};for(let i=0;i<5500;i++){const y=rand()*1024;x.strokeStyle=`rgba(${rand()>.5?'100,76,49':'8,5,3'},${rand()*.035})`;x.lineWidth=.3+rand()*2;x.beginPath();x.moveTo(0,y);for(let a=0;a<=1024;a+=30)x.lineTo(a,y+Math.sin(a*.013+y)*3+Math.sin(a*.004)*8);x.stroke()}for(let y=0;y<1024;y+=256){x.fillStyle='#080604';x.fillRect(0,y,1024,2)}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.colorSpace=THREE.SRGBColorSpace;return t},[])}
const DIPV=new THREE.Vector3(2.8,-2.18,.95),RESTV=new THREE.Vector3(1.65,-2.98,1.55),dipGoal=new THREE.Vector3();
function Feather({tip,dip,focused,pulse}){
 const group=useRef(),dipT0=useRef(0);const geometry=useMemo(()=>{const p=[],uv=[],indices=[];const count=90;for(let i=0;i<=count;i++){const t=i/count,y=t*2.25,curve=.22*t*t,width=Math.sin(Math.PI*t)**.7*.29;for(const side of [-1,1]){p.push(curve+side*width*(side<0?.78:1),y,.045*Math.sin(t*Math.PI)+Math.abs(width)*.18);uv.push(side<0?0:1,t)}if(i<count){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g},[]);
 const texture=useMemo(()=>{const c=document.createElement('canvas');c.width=256;c.height=1024;const x=c.getContext('2d');x.fillStyle='#c6c0ab';x.fillRect(0,0,256,1024);for(let y=0;y<1024;y+=5){x.strokeStyle=y%15?'#8f8b7b66':'#ece8d2a0';x.beginPath();x.moveTo(0,y+55);x.lineTo(125,y);x.lineTo(256,y+38);x.stroke()}x.fillStyle='#ddd7bf';x.fillRect(123,0,3,1024);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t},[]);
 useEffect(()=>()=>{geometry.dispose();texture.dispose()},[geometry,texture]);
 useFrame((_,dt)=>{const g=group.current;if(!g)return;
  if(dip&&!dipT0.current)dipT0.current=performance.now();if(!dip)dipT0.current=0;
  let goal=focused?tip.current:RESTV;
  if(dip){const e=(performance.now()-dipT0.current)/1000;dipGoal.copy(DIPV);if(e>1.1&&e<3.1)dipGoal.y-=Math.abs(Math.sin((e-1.1)*Math.PI))*.06;goal=e<3.1?dipGoal:(focused?tip.current:RESTV)}
  g.position.lerp(goal,1-Math.exp(-dt*(dip?6.5:focused?26:5)));if(focused&&!dip){const age=performance.now()-pulse.current;if(age<230){const b=Math.sin(age/230*Math.PI);g.position.y-=b*.04}}g.rotation.z=THREE.MathUtils.damp(g.rotation.z,dip?-.25:focused?-.7:-1.45,8,dt);g.rotation.x=THREE.MathUtils.damp(g.rotation.x,dip?.5:focused?1.22:.15,8,dt)});
 return <group ref={group} scale={.44} position={[1.65,-2.98,1.55]} rotation={[.15,0,-1.45]}><mesh geometry={geometry} position-y={.22} castShadow><meshStandardMaterial map={texture} bumpMap={texture} bumpScale={.012} roughness={.92} side={THREE.DoubleSide}/></mesh><mesh position={[.02,.82,.02]} rotation-z={-.05} castShadow><cylinderGeometry args={[.009,.016,1.7,8]}/><meshStandardMaterial color="#bfb69b" roughness={.6}/></mesh><mesh position-y={.055} rotation-z={Math.PI}><coneGeometry args={[.028,.18,8]}/><meshStandardMaterial color="#463d29" metalness={.55} roughness={.42}/></mesh></group>
}
function Bottle({onDip}){
 const profile=useMemo(()=>[[.001,0],[.3,0],[.37,.05],[.395,.15],[.37,.28],[.28,.37],[.185,.44],[.16,.5],[.16,.57],[.185,.575]].map(([x,y])=>new THREE.Vector2(x,y)),[]);
 return <group position={[2.8,-3.15,.75]} scale={1.5} onClick={e=>{e.stopPropagation();onDip()}}>
  <mesh castShadow><latheGeometry args={[profile,36]}/><meshPhysicalMaterial color="#d9c39a" roughness={.45} metalness={0} clearcoat={.4} clearcoatRoughness={.3}/></mesh>
  <mesh position-y={.575} rotation-x={Math.PI/2}><torusGeometry args={[.172,.022,10,36]}/><meshStandardMaterial color="#9a885d" metalness={.75} roughness={.38}/></mesh>
  <mesh position-y={.545} rotation-x={-Math.PI/2}><circleGeometry args={[.125,28]}/><meshStandardMaterial color="#05070a" roughness={.12}/></mesh>
 </group>
}
function Candle(){
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
function Lamp({angle,onAngle}){
 const drag=useRef(null);
 // A classic green-enamel desk lamp standing where the candle stands. Its
 // head leans in over the page's left edge and carries the bulb light with
 // it, so the Lamp angle slider visibly swings the pool of light across
 // the letter.
 const a=THREE.MathUtils.degToRad(angle||0),enamel='#42604c',brass='#9a885d';
 return <group position={[-2.9,-3.15,.75]} onPointerDown={e=>{e.stopPropagation();drag.current={x:e.clientX,a:angle||0};try{e.target.setPointerCapture(e.pointerId)}catch(err){}}} onPointerMove={e=>{if(drag.current&&onAngle)onAngle(Math.max(-32,Math.min(40,drag.current.a+(e.clientX-drag.current.x)*.25)))}} onPointerUp={()=>{drag.current=null}} onPointerCancel={()=>{drag.current=null}}>
  <mesh position-y={.035} castShadow><cylinderGeometry args={[.3,.38,.07,24]}/><meshStandardMaterial color={enamel} metalness={.35} roughness={.5}/></mesh>
  <mesh position-y={.1} castShadow><sphereGeometry args={[.13,16,12]}/><meshStandardMaterial color={brass} metalness={.75} roughness={.35}/></mesh>
  <mesh position-y={.55} castShadow><cylinderGeometry args={[.065,.065,1.05,12]}/><meshStandardMaterial color={enamel} metalness={.35} roughness={.5}/></mesh>
  <group position-y={1.12} rotation-z={a}>
   <mesh castShadow><sphereGeometry args={[.09,14,12]}/><meshStandardMaterial color={brass} metalness={.75} roughness={.35}/></mesh>
   <mesh position={[.25,.17,0]} rotation-z={-.97} castShadow><cylinderGeometry args={[.055,.055,.61,10]}/><meshStandardMaterial color={enamel} metalness={.35} roughness={.5}/></mesh>
   <mesh position={[.5,.34,0]} castShadow><sphereGeometry args={[.075,14,12]}/><meshStandardMaterial color={brass} metalness={.75} roughness={.35}/></mesh>
   <mesh position={[.64,.41,0]} rotation-z={-1.11} castShadow><cylinderGeometry args={[.045,.045,.32,10]}/><meshStandardMaterial color={enamel} metalness={.35} roughness={.5}/></mesh>
   <group position={[.78,.48,0]} rotation-z={-.75}>
    <mesh castShadow><cylinderGeometry args={[.085,.31,.48,24,1,true]}/><meshStandardMaterial color={enamel} metalness={.4} roughness={.45} side={THREE.DoubleSide}/></mesh>
    <mesh position-y={.26} castShadow><cylinderGeometry args={[.05,.085,.06,16]}/><meshStandardMaterial color={brass} metalness={.75} roughness={.35}/></mesh>
    <mesh position-y={-.1}><sphereGeometry args={[.075,12,10]}/><meshBasicMaterial color="#fff3cf"/></mesh>
    <pointLight position={[0,-.24,.02]} color="#ffdca8" intensity={22} distance={0} decay={2}/>
   </group>
  </group>
 </group>
}
function DeskScene({letter,onMetrics,onBounds,onDip,dip,onFocus,inkRef,caret,focused,pulse,follow,mode,lampAngle,onLampAngle}){
 const tex=useLetterTexture(letter,onMetrics,true,inkRef),wood=useWood(),tip=useRef(pixelPoint(160,365)),paper=useRef(),slope=useRef(),home=useRef({pos:new THREE.Vector3(0,-1.05,13),tgt:new THREE.Vector3(0,-.35,-.2)}),look=useRef(new THREE.Vector3(0,-.35,-.2)),lastKey=useRef(''),lastRep=useRef(new THREE.Vector3(0,-1.05,13));
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
  const pts=[[-2.85,-1.9,.75],[2.8,-2.05,.75]].map(q=>new THREE.Vector3(...q));
  for(const [a,b] of [[-1,1],[1,1],[-1,-1],[1,-1]])pts.push(sl.localToWorld(new THREE.Vector3(a*(PW+.55)/2,b*(PH+.55)/2,0)));
  let dist=13;const v=new THREE.Vector3();
  for(let it=0;it<3;it++){
   camera.position.set(0,-1.05,dist);camera.lookAt(0,-.35,-.2);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
   let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
   for(const q of pts){v.copy(q).project(camera);minx=Math.min(minx,v.x);maxx=Math.max(maxx,v.x);miny=Math.min(miny,v.y);maxy=Math.max(maxy,v.y)}
   const wPx=Math.max(1,(maxx-minx)*size.width/2),hPx=Math.max(1,(maxy-miny)*size.height/2),k=Math.min((size.width-24)/wPx,(size.height-24)/hPx);
   dist/=k;
  }
  camera.position.set(0,-1.05,dist);camera.lookAt(0,-.35,-.2);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();home.current.pos.set(0,-1.05,dist);
  const corners=[[-PW/2,PH/2],[PW/2,PH/2],[PW/2,-PH/2],[-PW/2,-PH/2]].map(([x,y])=>{const q=sl.localToWorld(new THREE.Vector3(x,y,0)).project(camera);return [(q.x+1)*size.width/2,(1-q.y)*size.height/2]});
  onBounds({corners});
 },[camera,size,onBounds]);
 useEffect(()=>{
  // The quill rides the caret, not the end of the letter: find the laid-out
  // line the caret sits in and measure the text up to it.
  const rows=tex.userData.layout.bodyLines;
  const row=rows.find(r=>caret>=r.start&&caret<=r.start+r.text.length)||rows.at(-1);
  if(!row){const l=pixelPoint(160,PAGE.bodyTop);tip.current.copy(slope.current?slope.current.localToWorld(l):l);return}
  const within=Math.max(0,Math.min(row.text.length,caret-row.start)),c=document.createElement('canvas').getContext('2d');
  c.font=`${row.size}px "Mrs Saint Delafield"`;const lp=pixelPoint(160+c.measureText(row.text.slice(0,within)).width,row.baseline);tip.current.copy(slope.current?slope.current.localToWorld(lp):lp);
 },[tex,caret]);
 // The camera lives here now: it eases between the wide desk tableau (home)
 // and, while you write, a close tracking shot of the line under the caret -
 // gliding down as the letter grows. Dipping pulls back home so the quill's
 // flight to the inkwell plays out in full view. When a pose settles, the
 // sheet's projected corners are re-reported so the invisible input fields
 // stay glued to the paper whichever shot we are in.
 useFrame((_,dt)=>{const h=home.current;let dp=h.pos,dl=h.tgt;
  if(follow&&focused&&!dip){const dir=h.pos.clone().sub(h.tgt).normalize(),distF=Math.min(5.8,h.pos.distanceTo(h.tgt)*.55),lk=tip.current.clone();lk.x=THREE.MathUtils.clamp(lk.x-.45,-.95,.95);lk.y-=.28;lk.z+=.15;dp=lk.clone().add(dir.multiplyScalar(distF));dl=lk}
  const k=1-Math.exp(-dt*3);camera.position.lerp(dp,k);look.current.lerp(dl,k);camera.lookAt(look.current);
  const settled=camera.position.distanceTo(dp)<.03&&look.current.distanceTo(dl)<.03,key=dp.x.toFixed(1)+','+dp.y.toFixed(1)+','+dp.z.toFixed(1);
  // Re-glue the fields not only once the camera settles but all through the
  // glide - otherwise the recipient and sign-off lines visibly trail behind
  // the paper while it moves.
  if((settled&&key!==lastKey.current)||camera.position.distanceTo(lastRep.current)>.3){if(settled)lastKey.current=key;lastRep.current.copy(camera.position);const sl=slope.current;if(sl){sl.updateMatrixWorld(true);onBounds({corners:[[-PW/2,PH/2],[PW/2,PH/2],[PW/2,-PH/2],[-PW/2,-PH/2]].map(([x,y])=>{const q=sl.localToWorld(new THREE.Vector3(x,y,0)).project(camera);return [(q.x+1)*size.width/2,(1-q.y)*size.height/2]})})}}});
 useEffect(()=>()=>{geometry.dispose();wood.dispose()},[geometry,wood]);
 return <><color attach="background" args={[mode==='lamp'?'#e9dfc9':'#0d0b08']}/><ambientLight intensity={mode==='lamp'?.55:.28} color="#ffe7c4"/><hemisphereLight args={mode==='lamp'?['#fff6e8','#7a6a52',.95]:['#4a3a26','#0b0906',.75]}/><directionalLight position={[6,3,4]} intensity={mode==='lamp'?.12:.55} color="#7d90b8"/><directionalLight position={mode==='lamp'?[-4,3,5]:[-5,1.5,5]} intensity={mode==='lamp'?.55:1.15} color="#ffb066" castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-normalBias={.03} shadow-bias={-.002}/><mesh rotation-x={-Math.PI/2} position={[0,-3.15,-3]} receiveShadow><planeGeometry args={[46,30]}/><meshStandardMaterial map={wood} bumpMap={wood} bumpScale={.025} roughness={.85}/></mesh><group ref={slope} position={[0,-.35,-.3]} rotation-x={-.5}><mesh position-z={-.075} receiveShadow castShadow><boxGeometry args={[PW+.55,PH+.55,.09]}/><meshStandardMaterial color="#241a12" roughness={.85}/></mesh><mesh position={[.03,-.04,-.02]} rotation-z={.006}><planeGeometry args={[PW+.07,PH+.07]}/><meshStandardMaterial color="#d9cfb6" roughness={1}/></mesh><mesh position={[-.05,-.11,-.04]} rotation-z={-.014}><planeGeometry args={[PW+.07,PH+.07]}/><meshStandardMaterial color="#c9bb9c" roughness={1}/></mesh><mesh ref={paper} geometry={geometry} receiveShadow castShadow onClick={onFocus}><meshStandardMaterial map={tex} roughness={.94} side={THREE.DoubleSide}/></mesh></group><pointLight position={[3.9,-2.1,1.9]} intensity={mode==='lamp'?.8:2.2} distance={3.2} decay={2} color="#ffb066"/><Bottle onDip={onDip}/>{mode==='lamp'?<Lamp angle={lampAngle} onAngle={onLampAngle}/>:<Candle/>}<Feather tip={tip} dip={dip} focused={focused} pulse={pulse}/></>
}
export default function WritingDesk({letter,onChange,onPreview}){
 const input=useRef(),dipTimer=useRef(),pen=useRef(false),signatureDraft=useRef([]);
 const[bounds,setBounds]=useState(null),[metrics,setMetrics]=useState(null),[dip,setDip]=useState(false),[signing,setSigning]=useState(false),[plain,setPlain]=useState(false),[focused,setFocused]=useState(false),[signaturePreview,setSignaturePreview]=useState(null);
 const[charge,setCharge]=useState(1),[caret,setCaret]=useState(0),[inkTick,setInkTick]=useState(0),[soundOn,setSoundOn]=useState(()=>{try{return localStorage.getItem('dearly-sound')!=='off'}catch(e){return true}}),[followOn,setFollowOn]=useState(()=>{try{return localStorage.getItem('dearly-follow')!=='off'}catch(e){return true}}),[lightMode,setLightMode]=useState(()=>{try{return localStorage.getItem('dearly-light')==='lamp'?'lamp':'candle'}catch(e){return 'candle'}}),[lampAngle,setLampAngle]=useState(0),[holdView,setHoldView]=useState(false);
 const sinceDip=useRef(0),prevBody=useRef(letter.body||''),pulse=useRef(0),lastScratch=useRef(0),dryTimers=useRef([]),chargeRef=useRef(1),soundOnRef=useRef(soundOn);
 const inkRef=useRef({words:new Map(),tick:0,charge:()=>chargeRef.current});inkRef.current.tick=inkTick;
 const applyCharge=v=>{chargeRef.current=v;setCharge(v)};
 function bodyChanged(e){const v=e.target.value,prev=prevBody.current;prevBody.current=v;setCaret(e.target.selectionStart??v.length);
  if(v.length>prev.length){sinceDip.current+=v.length-prev.length;applyCharge(Math.max(0,1-sinceDip.current/520));pulse.current=performance.now();if(pulse.current-lastScratch.current>70){lastScratch.current=pulse.current;sfx.on=soundOnRef.current;sfx.scratch()}
   dryTimers.current.forEach(clearTimeout);dryTimers.current=[950,1900,2900].map(ms=>setTimeout(()=>setInkTick(t=>t+1),ms));}
  onChange({...letter,body:v})}
 function toggleLight(){const v=lightMode==='lamp'?'candle':'lamp';setLightMode(v);try{localStorage.setItem('dearly-light',v)}catch(e){}}
 function toggleFollow(){const v=!followOn;setFollowOn(v);try{localStorage.setItem('dearly-follow',v?'on':'off')}catch(e){}}
 function toggleSound(){const v=!soundOn;setSoundOn(v);soundOnRef.current=v;sfx.on=v;try{localStorage.setItem('dearly-sound',v?'on':'off')}catch(e){}if(v){sfx.ensure();sfx.scratch()}}
 const receiveMetrics=useCallback((_,m)=>setMetrics(m),[]),receiveBounds=useCallback(b=>setBounds(b),[]);
 const doDip=useCallback(()=>{sfx.on=soundOnRef.current;sfx.dip();setDip(true);clearTimeout(dipTimer.current);dipTimer.current=setTimeout(()=>{setDip(false);sinceDip.current=0;applyCharge(1);setInkTick(t=>t+1);input.current?.focus({preventScroll:true})},4000)},[]);
 useEffect(()=>()=>clearTimeout(dipTimer.current),[]);
 const corners=bounds?bounds.corners:null;
 const scale=corners?Math.hypot(corners[1][0]-corners[0][0],corners[1][1]-corners[0][1])/PAGE.width:1;
 const fieldTransform=corners?quadTransform(PAGE.width*scale,PAGE.height*scale,corners):undefined;
 function point(e){const r=e.currentTarget.getBoundingClientRect();return [(e.clientX-r.left)/r.width*480,(e.clientY-r.top)/r.height*130]}
 function start(e){pen.current=true;e.currentTarget.setPointerCapture(e.pointerId);signatureDraft.current=[...(letter.signature||[]),[point(e)]];setSignaturePreview(signatureDraft.current)}
 function move(e){if(!pen.current)return;const last=signatureDraft.current.at(-1),p=point(e);if(last.length>1200)return;const prev=last.at(-1);if(Math.hypot(p[0]-prev[0],p[1]-prev[1])<1.5)return;const strokes=signatureDraft.current.map(s=>[...s]);strokes.at(-1).push(p);signatureDraft.current=strokes;setSignaturePreview(strokes)}
 function fit(){const ctx=document.createElement('canvas').getContext('2d');let fontSize=Number(letter.fontSize)||72;while(fontSize>32&&layoutLetter(ctx,{...letter,fontSize}).overflow)fontSize-=2;onChange({...letter,fontSize})}
 return <main className="atelier"><nav><span className="brand">dearly<span>Writing room</span></span><span className="atelier-saved">Saved on this device</span></nav><div className="atelier-heading"><h1>Your letter</h1></div>
 <PaperPicker letter={letter} onChange={onChange}/><div className="atelier-stage"><Canvas shadows dpr={[1,1.5]} camera={{fov:33,position:[0,-1.05,13],near:.1,far:120}}><Suspense fallback={null}><DeskScene letter={letter} onMetrics={receiveMetrics} onBounds={receiveBounds} onDip={doDip} dip={dip} onFocus={()=>input.current?.focus()} inkRef={inkRef.current} caret={caret} focused={focused} pulse={pulse} follow={followOn&&!holdView} mode={lightMode} lampAngle={lampAngle} onLampAngle={setLampAngle}/></Suspense></Canvas>
 {bounds&&metrics&&<div className="paper-fields" style={{left:0,top:0,width:PAGE.width*scale,height:PAGE.height*scale,transform:fieldTransform}}>
 <input aria-label="Recipient" placeholder="My dearest," value={letter.to} maxLength={60} style={{left:160*scale,top:(230-72)*scale,width:1216*scale,height:95*scale,fontSize:72*scale}} onChange={e=>onChange({...letter,to:e.target.value})}/>
 {!letter.body&&!focused&&<span className="atelier-placeholder" style={{left:160*scale,top:310*scale,fontSize:62*scale}}>What have you been meaning to say?</span>}
 <textarea ref={input} aria-label="Write your letter" spellCheck="false" value={letter.body} maxLength={1500} onFocus={()=>setFocused(true)} onBlur={()=>{setFocused(false);setHoldView(false)}} style={{left:160*scale,top:(PAGE.bodyTop-metrics.size)*scale,width:1216*scale,height:Math.max(150,(Math.min(metrics.signatureY-120,1790)-PAGE.bodyTop+metrics.size)*scale),fontSize:metrics.size*scale,lineHeight:metrics.spacing}} onChange={bodyChanged} onSelect={e=>setCaret(e.target.selectionStart??0)}/>
 <input aria-label="Sign off" placeholder="Yours, always" value={letter.from} maxLength={60} style={{left:160*scale,top:(metrics.lines.at(-1).baseline-70)*scale,width:1216*scale,height:90*scale,fontSize:70*scale}} onChange={e=>onChange({...letter,from:e.target.value})}/>
 </div>}
 {focused&&followOn&&<button type="button" onPointerDown={e=>e.preventDefault()} onPointerUp={()=>setHoldView(h=>!h)} style={{position:'absolute',right:10,bottom:10,zIndex:6,padding:'8px 14px',borderRadius:999,border:'1px solid rgba(230,205,160,.4)',background:'rgba(20,14,8,.72)',color:'#e9dcc0',fontSize:13,cursor:'pointer',backdropFilter:'blur(3px)'}}>{holdView?'Follow my line':'See whole desk'}</button>}
 </div><section className="atelier-controls">{lightMode==='lamp'&&<div className="atelier-spacing"><label>Lamp angle <input type="range" aria-label="Lamp angle" min="-32" max="40" step="1" value={lampAngle} onChange={e=>setLampAngle(Number(e.target.value))}/></label><span>tip: you can also drag the lamp head itself</span></div>}<div className="atelier-spacing"><label>Letter size <input type="range" aria-label="Letter size" min="32" max="88" step="2" value={letter.fontSize||72} onChange={e=>onChange({...letter,fontSize:Number(e.target.value)})}/></label><label>Line spacing <input type="range" aria-label="Line spacing" min="1.28" max="1.8" step=".05" value={letter.lineSpacing||1.35} onChange={e=>onChange({...letter,lineSpacing:Number(e.target.value)})}/></label><span>{metrics?.fill||0}% of the page</span><span className="ink-meter" aria-hidden="true"><i style={{width:Math.round(charge*100)+'%'}}/></span><span>Ink {Math.round(charge*100)}%</span></div>
 {metrics?.overflow&&<p role="status" className="atelier-overflow">Your words extend beyond this sheet. <button onClick={fit}>Fit to the page</button></p>}
 {charge<.3&&!!letter.body.trim()&&<p className="atelier-inkhint">Your ink is running dry — dip the quill to write dark again.</p>}<div className="atelier-actions"><button onClick={doDip} className={charge<.3&&!dip?'dip-pulse':''}>{dip?'Dipping…':'Dip the quill'}</button><button onClick={()=>setSigning(v=>!v)}>Sign by hand</button><button onClick={()=>setPlain(v=>!v)}>Edit text</button><button onClick={toggleSound} aria-pressed={soundOn}>{soundOn?'Sound on':'Sound off'}</button><button onClick={toggleFollow} aria-pressed={followOn}>{followOn?'Follow on':'Follow off'}</button><button onClick={toggleLight} aria-pressed={lightMode==='lamp'}>{lightMode==='lamp'?'Lamplight':'Candlelight'}</button><button className="primary" disabled={!letter.body.trim()||metrics?.overflow} onClick={onPreview}>Hold your letter ↗</button></div><p className="atelier-hint">Click the paper to write. Your layout carries through to the finished letter.</p>
 </section>{plain&&<section className="atelier-editor"><label>Your words<textarea aria-label="Plain text editor" value={letter.body} maxLength={1500} onChange={e=>{prevBody.current=e.target.value;onChange({...letter,body:e.target.value})}}/></label><button onClick={()=>setPlain(false)}>Return to the desk</button></section>}
 {signing&&<section className="signature-panel"><p>A signature only you could make.</p><svg className="signature-pad" aria-label="Draw your signature" role="img" viewBox="0 0 480 130" onPointerDown={start} onPointerMove={move} onPointerUp={()=>{pen.current=false;onChange({...letter,signature:signatureDraft.current});setSignaturePreview(null)}} onPointerCancel={()=>{pen.current=false;setSignaturePreview(null)}}>{(signaturePreview||letter.signature||[]).map((s,i)=><path key={i} d={s.map((p,j)=>`${j?'L':'M'}${p[0]} ${p[1]}`).join(' ')} stroke="#39352e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>)}</svg><button onClick={()=>onChange({...letter,signature:[]})}>Clear signature</button><button onClick={()=>setSigning(false)}>Keep signature</button></section>}
 </main>
}
