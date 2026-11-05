import React,{Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {useLetterTexture} from './letter-render';
import {layoutLetter,PAGE} from './letter-layout';

import './writing-desk.css';
import PaperPicker from './paper-picker';
const PW=4.65,PH=6.06;
function pixelPoint(x,y){return new THREE.Vector3((x/PAGE.width-.5)*PW,(.5-y/PAGE.height)*PH,.075)}
function useWood(){return useMemo(()=>{const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');x.fillStyle='#231e18';x.fillRect(0,0,1024,1024);let seed=12;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647};for(let i=0;i<5500;i++){const y=rand()*1024;x.strokeStyle=`rgba(${rand()>.5?'100,76,49':'8,5,3'},${rand()*.035})`;x.lineWidth=.3+rand()*2;x.beginPath();x.moveTo(0,y);for(let a=0;a<=1024;a+=30)x.lineTo(a,y+Math.sin(a*.013+y)*3+Math.sin(a*.004)*8);x.stroke()}for(let y=0;y<1024;y+=256){x.fillStyle='#080604';x.fillRect(0,y,1024,2)}const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.colorSpace=THREE.SRGBColorSpace;return t},[])}
function Feather({tip,dip}){
 const group=useRef();const geometry=useMemo(()=>{const p=[],uv=[],indices=[];const count=90;for(let i=0;i<=count;i++){const t=i/count,y=t*2.25,curve=.22*t*t,width=Math.sin(Math.PI*t)**.7*.29;for(const side of [-1,1]){p.push(curve+side*width*(side<0?.78:1),y,.045*Math.sin(t*Math.PI)+Math.abs(width)*.18);uv.push(side<0?0:1,t)}if(i<count){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g},[]);
 const texture=useMemo(()=>{const c=document.createElement('canvas');c.width=256;c.height=1024;const x=c.getContext('2d');x.fillStyle='#c6c0ab';x.fillRect(0,0,256,1024);for(let y=0;y<1024;y+=5){x.strokeStyle=y%15?'#8f8b7b66':'#ece8d2a0';x.beginPath();x.moveTo(0,y+55);x.lineTo(125,y);x.lineTo(256,y+38);x.stroke()}x.fillStyle='#ddd7bf';x.fillRect(123,0,3,1024);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t},[]);
 useEffect(()=>()=>{geometry.dispose();texture.dispose()},[geometry,texture]);
 useFrame((_,dt)=>{const goal=dip?new THREE.Vector3(3.1,.85,.48):tip.current;group.current.position.lerp(goal,1-Math.exp(-dt*(dip?8:35)));group.current.rotation.z=THREE.MathUtils.damp(group.current.rotation.z,dip?-.25:-.55,8,dt)});
 return <group ref={group} scale={.62} position={[1.7,-2,.1]} rotation={[.45,0,-.55]}><mesh geometry={geometry} position-y={.22} castShadow><meshStandardMaterial map={texture} bumpMap={texture} bumpScale={.012} roughness={.92} side={THREE.DoubleSide}/></mesh><mesh position={[.02,.82,.02]} rotation-z={-.05} castShadow><cylinderGeometry args={[.009,.016,1.7,8]}/><meshStandardMaterial color="#bfb69b" roughness={.6}/></mesh><mesh position-y={.055} rotation-z={Math.PI}><coneGeometry args={[.028,.18,8]}/><meshStandardMaterial color="#463d29" metalness={.55} roughness={.42}/></mesh></group>
}
function Bottle({onDip}){return <group position={[3.1,.85,.23]} rotation-x={Math.PI/2} onClick={e=>{e.stopPropagation();onDip()}}><mesh castShadow><cylinderGeometry args={[.23,.31,.43,32]}/><meshPhysicalMaterial color="#111b16" roughness={.19} metalness={.15} clearcoat={1} clearcoatRoughness={.12}/></mesh><mesh position-y={.26} castShadow><cylinderGeometry args={[.13,.14,.14,28]}/><meshStandardMaterial color="#252d21" roughness={.28}/></mesh><mesh position-y={.34} rotation-x={Math.PI/2}><ringGeometry args={[.09,.14,32]}/><meshStandardMaterial color="#9a885d" metalness={.7} roughness={.4} side={THREE.DoubleSide}/></mesh><mesh position-y={.325} rotation-x={-Math.PI/2}><circleGeometry args={[.09,32]}/><meshStandardMaterial color="#090e0b" roughness={.14}/></mesh><mesh position={[0,0,.291]}><planeGeometry args={[.32,.18]}/><meshStandardMaterial color="#ac9871" roughness={1}/></mesh></group>}
function DeskScene({letter,onMetrics,onBounds,onDip,dip,onFocus}){
 const tex=useLetterTexture(letter,onMetrics,true),wood=useWood(),tip=useRef(pixelPoint(160,365)),paper=useRef();
 const {camera,size}=useThree();
 const geometry=useMemo(()=>{const g=new THREE.PlaneGeometry(PW,PH,90,120),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),edge=Math.pow(Math.abs(x)/(PW/2),9);p.setZ(i,.012*Math.sin(y*2)+edge*.055);p.setX(i,x+edge*.009*Math.sin(y*37))}g.computeVertexNormals();return g},[]);
 // Fit the sheet by measuring its own projection: set a first-guess zoom,
 // rescale by the ratio of available to projected size, then re-centre the
 // camera on the projected centre. Self-correcting on any screen — the old
 // fixed constants left the sheet overflowing and off-centre on phones.
 useEffect(()=>{
  camera.position.set(0,0,12);
  camera.zoom=Math.min(size.width/(PW+.6),size.height/(PH+.6));camera.updateProjectionMatrix();
  let p0=new THREE.Vector3(-PW/2,PH/2,0).project(camera),p1=new THREE.Vector3(PW/2,-PH/2,0).project(camera);
  const wPx=Math.max(1,(p1.x-p0.x)*size.width/2),hPx=Math.max(1,(p0.y-p1.y)*size.height/2),k=Math.min((size.width-28)/wPx,(size.height-28)/hPx);
  camera.zoom*=k;camera.updateProjectionMatrix();
  p0=new THREE.Vector3(-PW/2,PH/2,0).project(camera);p1=new THREE.Vector3(PW/2,-PH/2,0).project(camera);
  camera.position.x+=((p0.x+p1.x)/2)*size.width/(2*camera.zoom);
  camera.position.y+=((p0.y+p1.y)/2)*size.height/(2*camera.zoom);
  camera.updateProjectionMatrix();
  p0=new THREE.Vector3(-PW/2,PH/2,0).project(camera);p1=new THREE.Vector3(PW/2,-PH/2,0).project(camera);
  onBounds({left:(p0.x+1)*size.width/2,top:(1-p0.y)*size.height/2,width:(p1.x-p0.x)*size.width/2,height:(p0.y-p1.y)*size.height/2});
 },[camera,size,onBounds]);
 useEffect(()=>{
  const rows=tex.userData.layout.bodyLines,row=rows.at(-1);
  if(row){const c=document.createElement('canvas').getContext('2d');c.font=`${row.size}px "Mrs Saint Delafield"`;tip.current.copy(pixelPoint(160+c.measureText(row.text).width,row.baseline))}
 },[tex]);
 useEffect(()=>()=>{geometry.dispose();wood.dispose()},[geometry,wood]);
 return <><color attach="background" args={['#211d17']}/><ambientLight intensity={1.05}/><hemisphereLight args={['#eee3cb','#35291b',1.2]}/><directionalLight position={[-3,4,7]} intensity={2.6} color="#fff0d2" castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={6} shadow-camera-bottom={-6} shadow-normalBias={.02}/><mesh position-z={-.15} receiveShadow><planeGeometry args={[25,25]}/><meshStandardMaterial map={wood} bumpMap={wood} bumpScale={.025} roughness={.8}/></mesh><mesh ref={paper} geometry={geometry} receiveShadow castShadow onClick={onFocus}><meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide}/></mesh><Bottle onDip={onDip}/><Feather tip={tip} dip={dip}/></>
}
export default function WritingDesk({letter,onChange,onPreview}){
 const input=useRef(),dipTimer=useRef(),pen=useRef(false),signatureDraft=useRef([]);
 const[bounds,setBounds]=useState(null),[metrics,setMetrics]=useState(null),[dip,setDip]=useState(false),[signing,setSigning]=useState(false),[plain,setPlain]=useState(false),[focused,setFocused]=useState(false),[signaturePreview,setSignaturePreview]=useState(null);
 const receiveMetrics=useCallback((_,m)=>setMetrics(m),[]),receiveBounds=useCallback(b=>setBounds(b),[]);
 const doDip=useCallback(()=>{setDip(true);clearTimeout(dipTimer.current);dipTimer.current=setTimeout(()=>{setDip(false);input.current?.focus({preventScroll:true})},950)},[]);
 useEffect(()=>()=>clearTimeout(dipTimer.current),[]);
 const scale=bounds?bounds.width/PAGE.width:1;
 function point(e){const r=e.currentTarget.getBoundingClientRect();return [(e.clientX-r.left)/r.width*480,(e.clientY-r.top)/r.height*130]}
 function start(e){pen.current=true;e.currentTarget.setPointerCapture(e.pointerId);signatureDraft.current=[...(letter.signature||[]),[point(e)]];setSignaturePreview(signatureDraft.current)}
 function move(e){if(!pen.current)return;const last=signatureDraft.current.at(-1),p=point(e);if(last.length>1200)return;const prev=last.at(-1);if(Math.hypot(p[0]-prev[0],p[1]-prev[1])<1.5)return;const strokes=signatureDraft.current.map(s=>[...s]);strokes.at(-1).push(p);signatureDraft.current=strokes;setSignaturePreview(strokes)}
 function fit(){const ctx=document.createElement('canvas').getContext('2d');let fontSize=Number(letter.fontSize)||72;while(fontSize>32&&layoutLetter(ctx,{...letter,fontSize}).overflow)fontSize-=2;onChange({...letter,fontSize})}
 return <main className="atelier"><nav><span className="brand">dearly<span>Writing room</span></span><span className="atelier-saved">Saved on this device</span></nav><div className="atelier-heading"><h1>Your letter</h1></div>
 <PaperPicker letter={letter} onChange={onChange}/><div className="atelier-stage"><Canvas orthographic shadows dpr={[1,1.5]} camera={{position:[0,0,12],zoom:90,near:.1,far:100}}><Suspense fallback={null}><DeskScene letter={letter} onMetrics={receiveMetrics} onBounds={receiveBounds} onDip={doDip} dip={dip} onFocus={()=>input.current?.focus()}/></Suspense></Canvas>
 {bounds&&metrics&&<div className="paper-fields" style={{left:bounds.left,top:bounds.top,width:bounds.width,height:bounds.height}}>
 <input aria-label="Recipient" placeholder="My dearest," value={letter.to} maxLength={60} style={{left:160*scale,top:(230-72)*scale,width:1216*scale,height:95*scale,fontSize:72*scale}} onChange={e=>onChange({...letter,to:e.target.value})}/>
 {!letter.body&&!focused&&<span className="atelier-placeholder" style={{left:160*scale,top:310*scale,fontSize:62*scale}}>What have you been meaning to say?</span>}
 <textarea ref={input} aria-label="Write your letter" spellCheck="false" value={letter.body} maxLength={1500} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)} style={{left:160*scale,top:(PAGE.bodyTop-metrics.size)*scale,width:1216*scale,height:Math.max(150,(Math.min(metrics.signatureY-120,1790)-PAGE.bodyTop+metrics.size)*scale),fontSize:metrics.size*scale,lineHeight:metrics.spacing}} onChange={e=>onChange({...letter,body:e.target.value})}/>
 <input aria-label="Sign off" placeholder="Yours, always" value={letter.from} maxLength={60} style={{left:160*scale,top:(metrics.lines.at(-1).baseline-70)*scale,width:1216*scale,height:90*scale,fontSize:70*scale}} onChange={e=>onChange({...letter,from:e.target.value})}/>
 </div>}
 </div><section className="atelier-controls"><div className="atelier-spacing"><label>Letter size <input type="range" aria-label="Letter size" min="32" max="88" step="2" value={letter.fontSize||72} onChange={e=>onChange({...letter,fontSize:Number(e.target.value)})}/></label><label>Line spacing <input type="range" aria-label="Line spacing" min="1.05" max="1.8" step=".05" value={letter.lineSpacing||1.35} onChange={e=>onChange({...letter,lineSpacing:Number(e.target.value)})}/></label><span>{metrics?.fill||0}% of the page</span></div>
 {metrics?.overflow&&<p role="status" className="atelier-overflow">Your words extend beyond this sheet. <button onClick={fit}>Fit to the page</button></p>}
 <div className="atelier-actions"><button onClick={doDip}>{dip?'Fresh ink…':'Dip the quill'}</button><button onClick={()=>setSigning(v=>!v)}>Sign by hand</button><button onClick={()=>setPlain(v=>!v)}>Edit text</button><button className="primary" disabled={!letter.body.trim()||metrics?.overflow} onClick={onPreview}>Hold your letter ↗</button></div><p className="atelier-hint">Click the paper to write. Your layout carries through to the finished letter.</p>
 </section>{plain&&<section className="atelier-editor"><label>Your words<textarea aria-label="Plain text editor" value={letter.body} maxLength={1500} onChange={e=>onChange({...letter,body:e.target.value})}/></label><button onClick={()=>setPlain(false)}>Return to the desk</button></section>}
 {signing&&<section className="signature-panel"><p>A signature only you could make.</p><svg className="signature-pad" aria-label="Draw your signature" role="img" viewBox="0 0 480 130" onPointerDown={start} onPointerMove={move} onPointerUp={()=>{pen.current=false;onChange({...letter,signature:signatureDraft.current});setSignaturePreview(null)}} onPointerCancel={()=>{pen.current=false;setSignaturePreview(null)}}>{(signaturePreview||letter.signature||[]).map((s,i)=><path key={i} d={s.map((p,j)=>`${j?'L':'M'}${p[0]} ${p[1]}`).join(' ')} stroke="#39352e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>)}</svg><button onClick={()=>onChange({...letter,signature:[]})}>Clear signature</button><button onClick={()=>setSigning(false)}>Keep signature</button></section>}
 </main>
}
