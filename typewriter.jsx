import React,{Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {useLetterTexture} from './letter-render';
import {PAGE,faceFont} from './letter-layout';
import {useWood,Candle,ModeSwitch} from './writing-desk';
import PaperPicker from './paper-picker';
import './writing-desk.css';

// The second desk in the writing room: a sage-enamel typewriter. Same
// letter, same paper, same finishing journey - the medium is the letter's
// own `face`, so what is typed here arrives typewritten.

// Synthesized typewriter foley: a clack per keystroke, a bell when the
// carriage returns. No assets; created lazily inside user gestures.
const sfx={ctx:null,noise:null,on:true,
 ensure(){if(typeof window==='undefined')return;if(!this.ctx){try{this.ctx=new (window.AudioContext||window.webkitAudioContext)();const b=this.ctx.createBuffer(1,Math.floor(this.ctx.sampleRate*.08),this.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;this.noise=b}catch(e){this.ctx=null}}if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume()},
 clack(){if(!this.on)return;this.ensure();if(!this.ctx)return;const t=this.ctx.currentTime,src=this.ctx.createBufferSource();src.buffer=this.noise;const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=1500+Math.random()*900;f.Q.value=.9;const g=this.ctx.createGain();g.gain.setValueAtTime(.14,t);g.gain.exponentialRampToValueAtTime(.001,t+.07);src.connect(f);f.connect(g);g.connect(this.ctx.destination);src.start(t);src.stop(t+.09);
  const o=this.ctx.createOscillator(),og=this.ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(190,t);o.frequency.exponentialRampToValueAtTime(70,t+.06);og.gain.setValueAtTime(.07,t);og.gain.exponentialRampToValueAtTime(.001,t+.08);o.connect(og);og.connect(this.ctx.destination);o.start(t);o.stop(t+.09)},
 ding(){if(!this.on)return;this.ensure();if(!this.ctx)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='sine';o.frequency.value=1568;g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.0008,t+.5);o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+.55)}
};
const PW=4.65,PH=6.06,ENAMEL='#5f7a68';
function Machine({carriage,paperGroup,typebar}){
 const keys=useMemo(()=>{const out=[];for(let r=0;r<4;r++)for(let k=0;k<10;k++)out.push(<mesh key={r+'-'+k} position={[-2.28+k*.5+r*.22,1.8+r*.14,1.28-r*.31]} rotation-x={1.07}><cylinderGeometry args={[.108,.108,.055,14]}/><meshStandardMaterial color="#141519" roughness={.4} metalness={.3}/></mesh>);return out},[]);
 return <group position={[0,-2.62,.7]}>
  <mesh position-y={.75} castShadow receiveShadow><boxGeometry args={[6,1.5,3.4]}/><meshStandardMaterial color={ENAMEL} metalness={.25} roughness={.45}/></mesh>
  <mesh position={[0,1.72,.95]} rotation-x={-.5} castShadow><boxGeometry args={[5.7,.16,1.9]}/><meshStandardMaterial color={ENAMEL} metalness={.25} roughness={.45}/></mesh>
  {keys}
  <mesh position={[0,.98,1.86]}><boxGeometry args={[2.3,.09,.3]}/><meshStandardMaterial color="#141519" roughness={.5}/></mesh>
  <mesh position={[0,1.78,-1.2]} castShadow><boxGeometry args={[6,.55,1.2]}/><meshStandardMaterial color={ENAMEL} metalness={.25} roughness={.45}/></mesh>
  <mesh position={[-1.05,1.98,-.35]} rotation-x={1.2}><cylinderGeometry args={[.16,.16,.05,18]}/><meshStandardMaterial color="#1c1d20" roughness={.45} metalness={.4}/></mesh>
  <mesh position={[1.05,1.98,-.35]} rotation-x={1.2}><cylinderGeometry args={[.16,.16,.05,18]}/><meshStandardMaterial color="#1c1d20" roughness={.45} metalness={.4}/></mesh>
  <mesh position={[0,2.14,-.55]}><boxGeometry args={[1.6,.15,.03]}/><meshStandardMaterial color="#101013" roughness={.6}/></mesh>
  <group ref={typebar} position={[0,1.35,.55]} rotation-x={.5}><mesh position-y={.72}><boxGeometry args={[.07,1.55,.03]}/><meshStandardMaterial color="#8f8a7c" metalness={.7} roughness={.35}/></mesh></group>
  <group ref={carriage} position={[0,2.28,-.95]}>
   <mesh rotation-z={Math.PI/2} castShadow><cylinderGeometry args={[.17,.17,5.9,20]}/><meshStandardMaterial color="#0e0e10" roughness={.85}/></mesh>
   <mesh position-x={-3.06} rotation-z={Math.PI/2}><cylinderGeometry args={[.23,.23,.2,16]}/><meshStandardMaterial color="#1c1d20" roughness={.4} metalness={.4}/></mesh>
   <mesh position-x={3.06} rotation-z={Math.PI/2}><cylinderGeometry args={[.23,.23,.2,16]}/><meshStandardMaterial color="#1c1d20" roughness={.4} metalness={.4}/></mesh>
   <mesh position={[0,-.22,.12]}><boxGeometry args={[5.9,.07,.34]}/><meshStandardMaterial color="#1c1d20" roughness={.5} metalness={.3}/></mesh>
   <group ref={paperGroup} rotation-x={-.14}></group>
  </group>
 </group>
}
function TypeScene({letter,onMetrics,caret,pulse,soundRef}){
 const tex=useLetterTexture(letter,onMetrics,true,null),wood=useWood();
 const {camera,size}=useThree();
 const carriage=useRef(),paperGroup=useRef(),paperMesh=useRef(),typebar=useRef(),targets=useRef({x:0,y:-1.65,row:-1});
 // The paper itself lives inside the carriage group; build it once the
 // group exists and keep its texture current.
 useEffect(()=>{
  if(!paperGroup.current||paperMesh.current)return;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(PW,PH),new THREE.MeshStandardMaterial({roughness:.94,side:THREE.DoubleSide}));
  m.castShadow=true;m.receiveShadow=true;paperGroup.current.add(m);paperMesh.current=m;
  return()=>{paperGroup.current&&paperGroup.current.remove(m);m.geometry.dispose();m.material.dispose();paperMesh.current=null};
 },[]);
 useEffect(()=>{if(paperMesh.current)paperMesh.current.material.map=tex},[tex]);
 useEffect(()=>{
  // Fit machine + the visible sheet zone by projecting sample points.
  const pts=[[-3.2,-2.62,2.6],[3.2,-2.62,2.6],[-3.2,.6,-1.6],[3.2,.6,-1.6],[-2.4,1.7,-1.2],[2.4,1.7,-1.2]].map(q=>new THREE.Vector3(...q));
  let dist=11;const v=new THREE.Vector3();
  for(let it=0;it<3;it++){
   camera.position.set(0,.25,dist);camera.lookAt(0,-.25,0);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
   let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
   for(const q of pts){v.copy(q).project(camera);minx=Math.min(minx,v.x);maxx=Math.max(maxx,v.x);miny=Math.min(miny,v.y);maxy=Math.max(maxy,v.y)}
   const wPx=Math.max(1,(maxx-minx)*size.width/2),hPx=Math.max(1,(maxy-miny)*size.height/2),k=Math.min((size.width-24)/wPx,(size.height-24)/hPx);
   dist/=k;
  }
  camera.position.set(0,.25,dist);camera.lookAt(0,-.25,0);camera.updateMatrixWorld(true);camera.updateProjectionMatrix();
 },[camera,size]);
 useEffect(()=>{
  // The carriage carries the strike point to the centre of the machine;
  // the paper steps up a line at a time so the current line rides the
  // platen. A fresh line also rings the bell.
  const rows=tex.userData.layout.bodyLines;
  const idx=rows.findIndex(r=>caret>=r.start&&caret<=r.start+r.text.length);
  const row=idx>=0?rows[idx]:rows.at(-1);if(!row)return;
  const c=document.createElement('canvas').getContext('2d');
  c.font=`${row.size}px ${faceFont(letter)}`;
  const within=Math.max(0,Math.min(row.text.length,caret-row.start));
  const px=160+c.measureText(row.text.slice(0,within)).width;
  const ly=(.5-row.baseline/PAGE.height)*PH;
  const prev=targets.current;
  if(prev.row>=0&&idx>prev.row&&soundRef.current){sfx.on=true;sfx.ding()}
  // The strike line rides at .30, not at the platen's centre: the roller
  // (radius .17) hides whatever sits within its silhouette, so a baseline
  // at .12 left the line being typed half-sunk behind it. At .30 the
  // current line's ink clears the roller and reads in full.
  targets.current={x:-((px/PAGE.width-.5)*PW),y:.30-ly,row:idx};
  if(prev.row<0){if(carriage.current)carriage.current.position.x=targets.current.x;if(paperGroup.current)paperGroup.current.position.y=targets.current.y}
 },[tex,caret,letter,soundRef]);
 useFrame((_,dt)=>{
  const t=targets.current;
  if(carriage.current)carriage.current.position.x=THREE.MathUtils.damp(carriage.current.position.x,t.x,14,dt);
  if(paperGroup.current)paperGroup.current.position.y=THREE.MathUtils.damp(paperGroup.current.position.y,t.y,7,dt);
  if(typebar.current){const age=performance.now()-pulse.current;typebar.current.rotation.x=age<160?.5-Math.sin(age/160*Math.PI)*.78:.5}
 });
 return <><color attach="background" args={['#171310']}/><ambientLight intensity={.5} color="#ffe7c4"/><hemisphereLight args={['#5d4a30','#14100b',.95]}/><directionalLight position={[-5,1.5,5]} intensity={1.35} color="#ffb066" castShadow shadow-mapSize={[512,512]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-normalBias={.03} shadow-bias={-.002}/><mesh rotation-x={-Math.PI/2} position={[0,-2.62,-3]} receiveShadow><planeGeometry args={[46,30]}/><meshStandardMaterial map={wood} bumpMap={wood} bumpScale={.025} roughness={.85}/></mesh><group position={[-.3,.53,.2]}><Candle/></group><Machine carriage={carriage} paperGroup={paperGroup} typebar={typebar}/></>
}
export default function TypewriterDesk({letter,onChange,onPreview,onSwitchMode}){
 const input=useRef(),pulse=useRef(0),lastClack=useRef(0);
 const[metrics,setMetrics]=useState(null),[caret,setCaret]=useState(0),[focused,setFocused]=useState(false),[soundOn,setSoundOn]=useState(()=>{try{return localStorage.getItem('dearly-sound')!=='off'}catch(e){return true}});
 const soundRef=useRef(soundOn);soundRef.current=soundOn;
 const receiveMetrics=useCallback((_,m)=>setMetrics(m),[]);
 function bodyChanged(e){const v=e.target.value;setCaret(e.target.selectionStart??v.length);pulse.current=performance.now();
  if(pulse.current-lastClack.current>35){lastClack.current=pulse.current;sfx.on=soundRef.current;sfx.clack()}
  onChange({...letter,body:v})}
 function toggleSound(){const v=!soundOn;setSoundOn(v);soundRef.current=v;sfx.on=v;try{localStorage.setItem('dearly-sound',v?'on':'off')}catch(e){}if(v){sfx.ensure();sfx.clack()}}
 return <main className="atelier"><nav><span className="brand">dearly<span>Writing room</span></span><span className="atelier-saved">Saved on this device</span></nav><div className="atelier-heading"><h1>Your letter</h1></div>
 <ModeSwitch mode="type" onSwitchMode={onSwitchMode}/><PaperPicker letter={letter} onChange={onChange}/><div className="atelier-stage" onClick={()=>input.current?.focus()}><Canvas shadows dpr={[1,1.25]} camera={{fov:35,position:[0,.25,11],near:.1,far:120}}><Suspense fallback={null}><TypeScene letter={letter} onMetrics={receiveMetrics} caret={caret} pulse={pulse} soundRef={soundRef}/></Suspense></Canvas>
 <textarea ref={input} aria-label="Write your letter" spellCheck="false" value={letter.body} maxLength={1500} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} onChange={bodyChanged} onSelect={e=>setCaret(e.target.selectionStart??0)} style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0,resize:'none',border:0,padding:0,cursor:'text',fontSize:16}}/>
 </div><section className="atelier-controls"><div className="atelier-spacing"><label>Letter size <input type="range" aria-label="Letter size" min="32" max="88" step="2" value={letter.fontSize||72} onChange={e=>onChange({...letter,fontSize:Number(e.target.value)})}/></label><label>Line spacing <input type="range" aria-label="Line spacing" min="1.28" max="1.8" step=".05" value={letter.lineSpacing||1.35} onChange={e=>onChange({...letter,lineSpacing:Number(e.target.value)})}/></label><span>{metrics?.fill||0}% of the page</span></div>
 <div className="atelier-spacing" style={{marginTop:6}}><label>To <input type="text" aria-label="Recipient" placeholder="My dearest," value={letter.to} maxLength={60} onChange={e=>onChange({...letter,to:e.target.value})} style={{width:180}}/></label><label>From <input type="text" aria-label="Sign off" placeholder="Yours, always" value={letter.from} maxLength={60} onChange={e=>onChange({...letter,from:e.target.value})} style={{width:180}}/></label></div>
 {metrics?.overflow&&<p role="status" className="atelier-overflow">Your words extend beyond this sheet.</p>}
 <div className="atelier-actions"><button onClick={toggleSound} aria-pressed={soundOn}>{soundOn?'Sound on':'Sound off'}</button><button className="primary" disabled={!letter.body.trim()||metrics?.overflow} onClick={onPreview}>Hold your letter ↗</button></div><p className="atelier-hint">Click the machine and type. The carriage carries each line; a fresh line rings the bell. When you hold this letter, it rolls and flies exactly as a handwritten one does.</p>
 </section></main>
}
