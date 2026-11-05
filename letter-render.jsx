import {useEffect,useMemo,useRef,useState} from 'react';
import {useLoader} from '@react-three/fiber';
import * as THREE from 'three';
import {createInkLayer,compositeInk} from './ink';
import {layoutLetter,PAGE} from './letter-layout';
import {paperSource} from './paper-picker';
export function useLetterTexture(letter,onLayout,live=false,inkRef=null){
 const paper=useLoader(THREE.TextureLoader,paperSource(letter));const[font,setFont]=useState(0);
 useEffect(()=>{let alive=true;Promise.all([document.fonts.load('72px "Mrs Saint Delafield"'),document.fonts.load('72px "Special Elite"')]).then(()=>{if(alive)setFont(1)});return()=>{alive=false}},[]);
 // Background processing is cached independently of typing.
 const paperBase=useMemo(()=>{
  const c=document.createElement('canvas');c.width=PAGE.width;c.height=PAGE.height;const x=c.getContext('2d');
  const image=paper.image,zoom=Math.max(1,Math.min(2.5,Number(letter.paperZoom)||1));
  const scale=Math.max(c.width/image.width,c.height/image.height)*zoom,w=image.width*scale,h=image.height*scale;
  const px=Math.max(0,Math.min(100,Number(letter.paperX??50)))/100,py=Math.max(0,Math.min(100,Number(letter.paperY??50)))/100;
  x.drawImage(image,(c.width-w)*px,(c.height-h)*py,w,h);
  x.fillStyle=`rgba(246,239,220,${Math.max(0,Math.min(.8,Number(letter.paperSoftness??.2)))})`;x.fillRect(0,0,c.width,c.height);return c;
 },[paper,letter.paperZoom,letter.paperX,letter.paperY,letter.paperSoftness]);
 // Builds are coalesced. The build itself is the proven one — a fresh
 // canvas, layout and ink pass, fresh texture — but running it on every
 // single keystroke (plus three drying-tick rebuilds after every pause)
 // is what made typing lag on phones. It now runs at most every 70ms,
 // always from the latest letter via refs: steady typing still gets a
 // build per keystroke, bursts and ticks batch into one. Nothing about
 // WHAT is drawn changes; only how often.
 const env=useRef({});env.current={paperBase,font,live,inkRef};
 const latest=useRef({letter});latest.current={letter};
 const lastBuild=useRef(null),pending=useRef(null);
 const build=()=>{
  const {paperBase,live,inkRef}=env.current,letter=latest.current.letter;
  const c=document.createElement('canvas');c.width=PAGE.width;c.height=PAGE.height;const x=c.getContext('2d');x.drawImage(paperBase,0,0);
  const layout=layoutLetter(x,letter),ink=createInkLayer(c.width,c.height,letter.ink||'#39352e',letter.face);
  // Live ink (desk only): each body word remembers the charge it was written
  // with and stays "wet" (darker, slightly bleeding) for its first seconds.
  let wordStyles=null;
  if(inkRef){
   wordStyles=new Map();const now=performance.now();
   if(inkRef.words.size>2000)inkRef.words.clear();
   for(const row of layout.bodyLines){
    const arr=row.text.split(/(\s+)/).filter(w=>w.trim()).map((w,i)=>{
     const key=row.start+'|'+i+'|'+w;let rec=inkRef.words.get(key);
     if(!rec){rec={level:inkRef.charge(),born:now};inkRef.words.set(key,rec)}
     const wet=now-rec.born<2800;return {a:(.55+.45*Math.pow(Math.max(0,Math.min(1,rec.level)),1.1))*(wet?1.05:.97),wet};
    });
    wordStyles.set(row,arr);
   }
  }
  for(const row of layout.lines)ink.write(row.text,row.baseline,row.size,row.kind==='body'&&wordStyles?wordStyles.get(row):null);
  const inkCanvas=ink.finish(live);
  if(Array.isArray(letter.signature)){
   const sx=inkCanvas.getContext('2d');sx.save();sx.translate(160,layout.signatureY);sx.scale(2,1.3);sx.strokeStyle=letter.ink||'#39352e';sx.lineWidth=1.8;sx.lineCap='round';sx.lineJoin='round';
   for(const stroke of letter.signature){if(!Array.isArray(stroke))continue;sx.beginPath();stroke.forEach((p,i)=>{if(Array.isArray(p)&&p.every(Number.isFinite))i?sx.lineTo(p[0],p[1]):sx.moveTo(p[0],p[1])});sx.stroke()}sx.restore();
  }
  compositeInk(x,inkCanvas);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;t.userData={lines:layout.lines.filter(r=>r.text.trim()),layout,paperBase,ink:inkCanvas};return t;
 };
 const[texture,setTexture]=useState(()=>{lastBuild.current=performance.now();return build()});
 useEffect(()=>{
  if(lastBuild.current===null){lastBuild.current=performance.now();return}
  const since=performance.now()-lastBuild.current;
  const run=()=>{pending.current=null;lastBuild.current=performance.now();setTexture(build())};
  if(since>=70)run();
  else if(!pending.current)pending.current=setTimeout(run,70-since);
 },[paperBase,letter,font,live,inkRef?inkRef.tick:0]);
 useEffect(()=>()=>{if(pending.current)clearTimeout(pending.current)},[]);
 useEffect(()=>{onLayout?.(texture.userData.lines,texture.userData.layout)},[texture,onLayout]);
 useEffect(()=>()=>texture.dispose(),[texture]);return texture;
}
