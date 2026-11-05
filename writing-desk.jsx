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
 scratch(){if(!this.on)return;this.ensure();if(!this.ctx)return;const t=this.ctx.currentTime,src=this.ctx.createBufferSource();src.buffer=this.noise;const f=this.ctx.createBiquadFilter();f.type='bandpass';f.frequency.value=1700+Math.random()*1500;f.Q.value=1.1;const g=this.ctx.createGain();g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.04+Math.random()*.025,t+.012);g.gain.exponentialRampToValueAtTime(.0008,t+.07+Math.random()*.05);src.connect(f);f.connect(g);g.connect(this.ctx.destination);src.start(t);src.stop(t+.15)},
 dip(){if(!this.on)return;this.ensure();if(!this.ctx)return;const t=this.ctx.currentTime,o=this.ctx.createOscillator(),g=this.ctx.createGain();o.type='sine';o.frequency.setValueAtTime(215,t);o.frequency.exponentialRampToValueAtTime(62,t+.17);g.gain.setValueAtTime(.0008,t);g.gain.exponentialRampToValueAtTime(.1,t+.02);g.gain.exponentialRampToValueAtTime(.0008,t+.26);o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+.28)}
};
const PW=4.65,PH=6.06;
function pixelPoint(x,y){return new THREE.Vector3((x/PAGE.width-.5)*PW,(.5-y/PAGE.height)*PH,.075)}
function useWood(){return useMemo(()=>{const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');x.fillStyle='#231e18';x.fillRect(0,0,1024,1024);let seed=12;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647};for(let i=0;i<5500;i++){const y=rand()*1024;x.strokeStyle=`rgba(${rand()>.5?'100,76,49':'8,5,3'},${rand()*.035})`;x.lineWidth=.3+rand()*2;x.beginPath();x.moveTo(0,y);for(let a=0;a<=1024;a+=30)x.lineTo(a,y+Math.sin(a*.013+y)*3+Math.sin(a*.004)*8);x.stroke()}for(let y=0;y<1024;y+=256){x.fillStyle='#080604';x.fillRect(0,y,1024,2)}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.colorSpace=THREE.SRGBColorSpace;return t},[])}
const DIPV=new THREE.Vector3(3.1,.85,.48),RESTV=new THREE.Vector3(3.42,.42,.5);
function Feather({tip,dip,focused,pulse}){
 const group=useRef();const geometry=useMemo(()=>{const p=[],uv=[],indices=[];const count=90;for(let i=0;i<=count;i++){const t=i/count,y=t*2.25,curve=.22*t*t,width=Math.sin(Math.PI*t)**.7*.29;for(const side of [-1,1]){p.push(curve+side*width*(side<0?.78:1),y,.045*Math.sin(t*Math.PI)+Math.abs(width)*.18);uv.push(side<0?0:1,t)}if(i<count){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g},[]);
 const texture=useMemo(()=>{const c=document.createElement('canvas');c.width=256;c.height=1024;const x=c.getContext('2d');x.fillStyle='#c6c0ab';x.fillRect(0,0,256,1024);for(let y=0;y<1024;y+=5){x.strokeStyle=y%15?'#8f8b7b66':'#ece8d2a0';x.beginPath();x.moveTo(0,y+55);x.lineTo(125,y);x.lineTo(256,y+38);x.stroke()}x.fillStyle='#ddd7bf';x.fillRect(123,0,3,1024);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t},[]);
 useEffect(()=>()=>{geometry.dispose();texture.dispose()},[geometry,texture]);
 useFrame((_,dt)=>{const g=group.current;if(!g)return;const goal=dip?DIPV:focused?tip.current:RESTV;g.position.lerp(goal,1-Math.exp(-dt*(dip?8:focused?26:5)));if(focused&&!dip){const age=performance.now()-pulse.current;if(age<230){const b=Math.sin(age/230*Math.PI);g.position.y-=b*.05;g.position.z+=b*.012}}g.rotation.z=THREE.MathUtils.damp(g.rotation.z,dip?-.25:focused?-.98:-.18,8,dt)});
 return <group ref={group} scale={.44} position={[3.42,.42,.5]} rotation={[.45,0,-.55]}><mesh geometry={geometry} position-y={.22} castShadow><meshStandardMaterial map={texture} bumpMap={texture} bumpScale={.012} roughness={.92} side={THREE.DoubleSide}/></mesh><mesh position={[.02,.82,.02]} rotation-z={-.05} castShadow><cylinderGeometry args={[.009,.016,1.7,8]}/><meshStandardMaterial color="#bfb69b" roughness={.6}/></mesh><mesh position-y={.055} rotation-z={Math.PI}><coneGeometry args={[.028,.18,8]}/><meshStandardMaterial color="#463d29" metalness={.55} roughness={.42}/></mesh></group>
}
function Bottle({onDip}){return <group position={[3.1,.85,.23]} rotation-x={Math.PI/2} onClick={e=>{e.stopPropagation();onDip()}}><mesh castShadow><cylinderGeometry args={[.23,.31,.43,32]}/><meshPhysicalMaterial color="#111b16" roughness={.19} metalness={.15} clearcoat={1} clearcoatRoughness={.12}/></mesh><mesh position-y={.26} castShadow><cylinderGeometry args={[.13,.14,.14,28]}/><meshStandardMaterial color="#252d21" roughness={.28}/></mesh><mesh position-y={.34} rotation-x={Math.PI/2}><ringGeometry args={[.09,.14,32]}/><meshStandardMaterial color="#9a885d" metalness={.7} roughness={.4} side={THREE.DoubleSide}/></mesh><mesh position-y={.325} rotation-x={-Math.PI/2}><circleGeometry args={[.09,32]}/><meshStandardMaterial color="#090e0b" roughness={.14}/></mesh><mesh position={[0,0,.291]}><planeGeometry args={[.32,.18]}/><meshStandardMaterial color="#ac9871" roughness={1}/></mesh></group>}
function Candle(){
 const flame=useRef(),glow=useRef(),light=useRef(),t=useRef(7);
 const glowTex=useMemo(()=>{const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');const g=x.createRadialGradient(64,64,2,64,64,64);g.addColorStop(0,'rgba(255,190,110,.85)');g.addColorStop(.4,'rgba(255,150,60,.28)');g.addColorStop(1,'rgba(255,140,50,0)');x.fillStyle=g;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)},[]);
 useEffect(()=>()=>glowTex.dispose(),[glowTex]);
 useFrame((_,dt)=>{t.current+=dt;const n=Math.sin(t.current*11.3)*.5+Math.sin(t.current*23.7+1.7)*.3+Math.sin(t.current*5.1+.6)*.2;
  if(light.current){light.current.intensity=13+n*2.8;light.current.position.x=n*.02}
  if(flame.current){flame.current.scale.set(1+n*.07,1+n*.15,1);flame.current.rotation.z=n*.07}
  if(glow.current)glow.current.material.opacity=.15+n*.035;});
 return <group position={[-2.8,2.14,.18]}>
  <mesh position-y={.02} castShadow><cylinderGeometry args={[.3,.37,.05,24]}/><meshStandardMaterial color="#8a6f3e" metalness={.8} roughness={.38}/></mesh>
  <mesh position-y={.09} castShadow><cylinderGeometry args={[.06,.09,.1,16]}/><meshStandardMaterial color="#8a6f3e" metalness={.8} roughness={.38}/></mesh>
  <mesh position-y={.33} castShadow><cylinderGeometry args={[.15,.17,.4,20]}/><meshStandardMaterial color="#e9dfc6" roughness={.55}/></mesh>
  <mesh position-y={.545}><cylinderGeometry args={[.014,.014,.06,8]}/><meshStandardMaterial color="#171310" roughness={.9}/></mesh>
  <group ref={flame} position-y={.66}>
   <mesh scale={[1,1.9,1]}><sphereGeometry args={[.07,12,16]}/><meshBasicMaterial color="#ff9a2e" transparent opacity={.8}/></mesh>
   <mesh position-y={-.01} scale={[.5,.85,.5]}><sphereGeometry args={[.07,12,16]}/><meshBasicMaterial color="#ffe6b0"/></mesh>
  </group>
  <sprite ref={glow} position-y={.66} scale={[1.6,1.6,1]}><spriteMaterial map={glowTex} transparent opacity={.15} depthWrite={false}/></sprite>
  <pointLight ref={light} position={[0,.72,.14]} color="#ff9a44" intensity={13} distance={0} decay={2} castShadow shadow-mapSize={[1024,1024]} shadow-bias={-.004}/>
 </group>
}
function DeskScene({letter,onMetrics,onBounds,onDip,dip,onFocus,inkRef,caret,focused,pulse}){
 const tex=useLetterTexture(letter,onMetrics,true,inkRef),wood=useWood(),tip=useRef(pixelPoint(160,365)),paper=useRef();
 const {camera,size}=useThree();
 const geometry=useMemo(()=>{const g=new THREE.PlaneGeometry(PW,PH,90,120),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),edge=Math.pow(Math.abs(x)/(PW/2),9);p.setZ(i,.012*Math.sin(y*2)+edge*.055);p.setX(i,x+edge*.009*Math.sin(y*37))}g.computeVertexNormals();return g},[]);
 // Fit the sheet by measuring its own projection: set a first-guess zoom,
 // rescale by the ratio of available to projected size, then re-centre the
 // camera on the projected centre. Self-correcting on any screen — the old
 // fixed constants left the sheet overflowing and off-centre on phones.
 useEffect(()=>{
  // Frame the whole vignette — sheet, ink bottle (right), candle (left) —
  // not just the sheet, so the props stay in the scene on portrait phones.
  const FX0=-3.2,FX1=3.45,FY0=-3.12,FY1=3.22;
  camera.position.set(0,0,12);
  camera.zoom=Math.min(size.width/(FX1-FX0+.4),size.height/(FY1-FY0+.4));camera.updateProjectionMatrix();
  let p0=new THREE.Vector3(FX0,FY1,0).project(camera),p1=new THREE.Vector3(FX1,FY0,0).project(camera);
  const wPx=Math.max(1,(p1.x-p0.x)*size.width/2),hPx=Math.max(1,(p0.y-p1.y)*size.height/2),k=Math.min((size.width-28)/wPx,(size.height-28)/hPx);
  camera.zoom*=k;camera.updateProjectionMatrix();
  p0=new THREE.Vector3(FX0,FY1,0).project(camera);p1=new THREE.Vector3(FX1,FY0,0).project(camera);
  camera.position.x+=((p0.x+p1.x)/2)*size.width/(2*camera.zoom);
  camera.position.y+=((p0.y+p1.y)/2)*size.height/(2*camera.zoom);
  camera.updateProjectionMatrix();
  const s0=new THREE.Vector3(-PW/2,PH/2,0).project(camera),s1=new THREE.Vector3(PW/2,-PH/2,0).project(camera);
  onBounds({left:(s0.x+1)*size.width/2,top:(1-s0.y)*size.height/2,width:(s1.x-s0.x)*size.width/2,height:(s0.y-s1.y)*size.height/2});
 },[camera,size,onBounds]);
 useEffect(()=>{
  // The quill rides the caret, not the end of the letter: find the laid-out
  // line the caret sits in and measure the text up to it.
  const rows=tex.userData.layout.bodyLines;
  const row=rows.find(r=>caret>=r.start&&caret<=r.start+r.text.length)||rows.at(-1);
  if(!row){tip.current.copy(pixelPoint(160,PAGE.bodyTop));return}
  const within=Math.max(0,Math.min(row.text.length,caret-row.start)),c=document.createElement('canvas').getContext('2d');
  c.font=`${row.size}px "Mrs Saint Delafield"`;tip.current.copy(pixelPoint(160+c.measureText(row.text.slice(0,within)).width,row.baseline));
 },[tex,caret]);
 useEffect(()=>()=>{geometry.dispose();wood.dispose()},[geometry,wood]);
 return <><color attach="background" args={['#0d0b08']}/><ambientLight intensity={.16} color="#ffe7c4"/><hemisphereLight args={['#4a3a26','#0b0906',.5]}/><directionalLight position={[4,3,6]} intensity={.35} color="#93a7cc"/><mesh position-z={-.15} receiveShadow><planeGeometry args={[25,25]}/><meshStandardMaterial map={wood} bumpMap={wood} bumpScale={.025} roughness={.8}/></mesh><mesh position={[.03,-.04,-.02]} rotation-z={.006}><planeGeometry args={[PW+.07,PH+.07]}/><meshStandardMaterial color="#d9cfb6" roughness={1}/></mesh><mesh position={[-.025,-.075,-.04]} rotation-z={-.009}><planeGeometry args={[PW+.07,PH+.07]}/><meshStandardMaterial color="#c9bb9c" roughness={1}/></mesh><mesh ref={paper} geometry={geometry} receiveShadow castShadow onClick={onFocus}><meshStandardMaterial map={tex} roughness={.94} side={THREE.DoubleSide}/></mesh><Bottle onDip={onDip}/><Candle/><Feather tip={tip} dip={dip} focused={focused} pulse={pulse}/></>
}
export default function WritingDesk({letter,onChange,onPreview}){
 const input=useRef(),dipTimer=useRef(),pen=useRef(false),signatureDraft=useRef([]);
 const[bounds,setBounds]=useState(null),[metrics,setMetrics]=useState(null),[dip,setDip]=useState(false),[signing,setSigning]=useState(false),[plain,setPlain]=useState(false),[focused,setFocused]=useState(false),[signaturePreview,setSignaturePreview]=useState(null);
 const[charge,setCharge]=useState(1),[caret,setCaret]=useState(0),[inkTick,setInkTick]=useState(0),[soundOn,setSoundOn]=useState(()=>{try{return localStorage.getItem('dearly-sound')!=='off'}catch(e){return true}});
 const sinceDip=useRef(0),prevBody=useRef(letter.body||''),pulse=useRef(0),lastScratch=useRef(0),dryTimers=useRef([]),chargeRef=useRef(1),soundOnRef=useRef(soundOn);
 const inkRef=useRef({words:new Map(),tick:0,charge:()=>chargeRef.current});inkRef.current.tick=inkTick;
 const applyCharge=v=>{chargeRef.current=v;setCharge(v)};
 function bodyChanged(e){const v=e.target.value,prev=prevBody.current;prevBody.current=v;setCaret(e.target.selectionStart??v.length);
  if(v.length>prev.length){sinceDip.current+=v.length-prev.length;applyCharge(Math.max(0,1-sinceDip.current/240));pulse.current=performance.now();if(pulse.current-lastScratch.current>45){lastScratch.current=pulse.current;sfx.on=soundOnRef.current;sfx.scratch()}
   dryTimers.current.forEach(clearTimeout);dryTimers.current=[950,1900,2900].map(ms=>setTimeout(()=>setInkTick(t=>t+1),ms));}
  onChange({...letter,body:v})}
 function toggleSound(){const v=!soundOn;setSoundOn(v);soundOnRef.current=v;sfx.on=v;try{localStorage.setItem('dearly-sound',v?'on':'off')}catch(e){}if(v){sfx.ensure();sfx.scratch()}}
 const receiveMetrics=useCallback((_,m)=>setMetrics(m),[]),receiveBounds=useCallback(b=>setBounds(b),[]);
 const doDip=useCallback(()=>{sfx.on=soundOnRef.current;sfx.dip();setDip(true);clearTimeout(dipTimer.current);dipTimer.current=setTimeout(()=>{setDip(false);sinceDip.current=0;applyCharge(1);setInkTick(t=>t+1);input.current?.focus({preventScroll:true})},950)},[]);
 useEffect(()=>()=>clearTimeout(dipTimer.current),[]);
 const scale=bounds?bounds.width/PAGE.width:1;
 function point(e){const r=e.currentTarget.getBoundingClientRect();return [(e.clientX-r.left)/r.width*480,(e.clientY-r.top)/r.height*130]}
 function start(e){pen.current=true;e.currentTarget.setPointerCapture(e.pointerId);signatureDraft.current=[...(letter.signature||[]),[point(e)]];setSignaturePreview(signatureDraft.current)}
 function move(e){if(!pen.current)return;const last=signatureDraft.current.at(-1),p=point(e);if(last.length>1200)return;const prev=last.at(-1);if(Math.hypot(p[0]-prev[0],p[1]-prev[1])<1.5)return;const strokes=signatureDraft.current.map(s=>[...s]);strokes.at(-1).push(p);signatureDraft.current=strokes;setSignaturePreview(strokes)}
 function fit(){const ctx=document.createElement('canvas').getContext('2d');let fontSize=Number(letter.fontSize)||72;while(fontSize>32&&layoutLetter(ctx,{...letter,fontSize}).overflow)fontSize-=2;onChange({...letter,fontSize})}
 return <main className="atelier"><nav><span className="brand">dearly<span>Writing room</span></span><span className="atelier-saved">Saved on this device</span></nav><div className="atelier-heading"><h1>Your letter</h1></div>
 <PaperPicker letter={letter} onChange={onChange}/><div className="atelier-stage"><Canvas orthographic shadows dpr={[1,1.5]} camera={{position:[0,0,12],zoom:90,near:.1,far:100}}><Suspense fallback={null}><DeskScene letter={letter} onMetrics={receiveMetrics} onBounds={receiveBounds} onDip={doDip} dip={dip} onFocus={()=>input.current?.focus()} inkRef={inkRef.current} caret={caret} focused={focused} pulse={pulse}/></Suspense></Canvas>
 {bounds&&metrics&&<div className="paper-fields" style={{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height}}>
 <input aria-label="Recipient" placeholder="My dearest," value={letter.to} maxLength={60} style={{left:160*scale,top:(230-72)*scale,width:1216*scale,height:95*scale,fontSize:72*scale}} onChange={e=>onChange({...letter,to:e.target.value})}/>
 {!letter.body&&!focused&&<span className="atelier-placeholder" style={{left:160*scale,top:310*scale,fontSize:62*scale}}>What have you been meaning to say?</span>}
 <textarea ref={input} aria-label="Write your letter" spellCheck="false" value={letter.body} maxLength={1500} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} style={{left:160*scale,top:(PAGE.bodyTop-metrics.size)*scale,width:1216*scale,height:Math.max(150,(Math.min(metrics.signatureY-120,1790)-PAGE.bodyTop+metrics.size)*scale),fontSize:metrics.size*scale,lineHeight:metrics.spacing}} onChange={bodyChanged} onSelect={e=>setCaret(e.target.selectionStart??0)}/>
 <input aria-label="Sign off" placeholder="Yours, always" value={letter.from} maxLength={60} style={{left:160*scale,top:(metrics.lines.at(-1).baseline-70)*scale,width:1216*scale,height:90*scale,fontSize:70*scale}} onChange={e=>onChange({...letter,from:e.target.value})}/>
 </div>}
 </div><section className="atelier-controls"><div className="atelier-spacing"><label>Letter size <input type="range" aria-label="Letter size" min="32" max="88" step="2" value={letter.fontSize||72} onChange={e=>onChange({...letter,fontSize:Number(e.target.value)})}/></label><label>Line spacing <input type="range" aria-label="Line spacing" min="1.28" max="1.8" step=".05" value={letter.lineSpacing||1.35} onChange={e=>onChange({...letter,lineSpacing:Number(e.target.value)})}/></label><span>{metrics?.fill||0}% of the page</span><span className="ink-meter" aria-hidden="true"><i style={{width:Math.round(charge*100)+'%'}}/></span><span>Ink {Math.round(charge*100)}%</span></div>
 {metrics?.overflow&&<p role="status" className="atelier-overflow">Your words extend beyond this sheet. <button onClick={fit}>Fit to the page</button></p>}
 {charge<.3&&!!letter.body.trim()&&<p className="atelier-inkhint">Your ink is running dry — dip the quill to write dark again.</p>}<div className="atelier-actions"><button onClick={doDip} className={charge<.3&&!dip?'dip-pulse':''}>{dip?'Fresh ink…':'Dip the quill'}</button><button onClick={()=>setSigning(v=>!v)}>Sign by hand</button><button onClick={()=>setPlain(v=>!v)}>Edit text</button><button onClick={toggleSound} aria-pressed={soundOn}>{soundOn?'Sound on':'Sound off'}</button><button className="primary" disabled={!letter.body.trim()||metrics?.overflow} onClick={onPreview}>Hold your letter ↗</button></div><p className="atelier-hint">Click the paper to write. Your layout carries through to the finished letter.</p>
 </section>{plain&&<section className="atelier-editor"><label>Your words<textarea aria-label="Plain text editor" value={letter.body} maxLength={1500} onChange={e=>{prevBody.current=e.target.value;onChange({...letter,body:e.target.value})}}/></label><button onClick={()=>setPlain(false)}>Return to the desk</button></section>}
 {signing&&<section className="signature-panel"><p>A signature only you could make.</p><svg className="signature-pad" aria-label="Draw your signature" role="img" viewBox="0 0 480 130" onPointerDown={start} onPointerMove={move} onPointerUp={()=>{pen.current=false;onChange({...letter,signature:signatureDraft.current});setSignaturePreview(null)}} onPointerCancel={()=>{pen.current=false;setSignaturePreview(null)}}>{(signaturePreview||letter.signature||[]).map((s,i)=><path key={i} d={s.map((p,j)=>`${j?'L':'M'}${p[0]} ${p[1]}`).join(' ')} stroke="#39352e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>)}</svg><button onClick={()=>onChange({...letter,signature:[]})}>Clear signature</button><button onClick={()=>setSigning(false)}>Keep signature</button></section>}
 </main>
}
