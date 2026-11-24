export const PAGE={width:1536,height:2048,left:160,right:1376,bodyTop:365,bottom:1900};
export function faceFont(letter){return letter&&letter.face==='type'?'"Special Elite", monospace':'"Mrs Saint Delafield", cursive'}
const widthCache=new Map();
// Widths are only valid once the real face has loaded. Before that the
// canvas measures with a fallback (~1.5-1.8x wider than the script), and
// caching those widths made a freshly opened letter link wrap far
// narrower than the writer's desk for the whole visit. So: never cache a
// width measured before the face is ready, and drop everything whenever
// a font finishes loading (covers the Google Fonts stylesheet arriving late).
const readyFaces=new Set();
function faceReady(font){
 if(readyFaces.has(font))return true;
 const fonts=typeof document!=='undefined'&&document.fonts;
 if(!fonts||fonts.status!=='loaded'||!fonts.check(`72px ${font}`))return false;
 readyFaces.add(font);return true;
}
if(typeof document!=='undefined'&&document.fonts)document.fonts.addEventListener('loadingdone',()=>{widthCache.clear();readyFaces.clear()});
export function layoutLetter(ctx,letter){
 const size=Math.max(32,Math.min(88,Number(letter.fontSize)||72));
 const spacing=Math.max(1.28,Math.min(1.8,Number(letter.lineSpacing)||1.35));
 const lines=[],bodyLines=[];let y=PAGE.bodyTop,offset=0;
 // Measuring is the layout's hot cost (every growing prefix of every
 // line, per keystroke). Widths are deterministic per face+size+text,
 // and every line above the one being typed is identical between
 // keystrokes — so cache them. This changes no result, only the cost.
 const measure=(text,s)=>{const key=`${letter.face||'hand'}|${s}|${text}`;let w=widthCache.get(key);if(w===undefined){ctx.font=`${s}px ${faceFont(letter)}`;w=ctx.measureText(text).width;if(faceReady(faceFont(letter))){if(widthCache.size>4000)widthCache.clear();widthCache.set(key,w)}}return w};
 const add=(text,baseline,fontSize,kind,start)=>{const row={text,baseline,y:baseline-fontSize*.28,size:fontSize,width:measure(text,fontSize),kind,start};lines.push(row);return row};
 add(letter.to||'',230,72,'to',0);
 for(const paragraph of (letter.body||'').split('\n')){
  let text='',start=offset;
  for(const token of paragraph.match(/\S+\s*|\s+/g)||[]){
   if(text&&measure(text+token,size)>PAGE.right-PAGE.left){bodyLines.push(add(text,y,size,'body',start));y+=size*spacing;start=offset;text=''}
   for(const char of token){
    if(text&&measure(text+char,size)>PAGE.right-PAGE.left){bodyLines.push(add(text,y,size,'body',start));y+=size*spacing;start=offset;text=''}
    text+=char;offset++;
   }
  }
  bodyLines.push(add(text,y,size,'body',start));y+=size*spacing;offset++;
 }
 const signoffY=y+65;add(letter.from||'',signoffY,70,'from',0);
 const signatureY=signoffY+35;
 const usedBottom=signatureY+(letter.signature?.length?180:25);
 return {lines,bodyLines,size,spacing,signatureY,usedBottom,overflow:usedBottom>PAGE.bottom,fill:Math.min(100,Math.round((usedBottom-160)/(PAGE.bottom-160)*100))};
}
