// Keep cursive joins intact by varying whole words, then distress only the ink mask.
export function createInkLayer(width,height,color){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle=color;
 let seed=391;const random=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
 return {canvas,write(text,y,size,levels){ctx.font=`${size}px "Mrs Saint Delafield", cursive`;let cursor=160,wi=0;for(const word of text.split(/(\s+)/)){const advance=ctx.measureText(word).width;if(word.trim()){const lv=levels?levels[wi++]:null;ctx.save();ctx.translate(cursor,y+(random()-.5)*1.7);ctx.rotate((random()-.5)*.014);ctx.scale(1, .985+random()*.03);ctx.globalAlpha=Math.min(1,(.94+random()*.06)*(lv?lv.a:1));ctx.strokeStyle=color;ctx.lineWidth=.7;ctx.lineJoin="round";if(lv&&lv.wet){ctx.shadowColor=color;ctx.shadowBlur=4}if(!(lv&&lv.a<.5))ctx.strokeText(word,0,0);ctx.fillText(word,0,0);if(lv&&lv.wet)ctx.fillText(word,0,0);ctx.restore()}cursor+=advance}return cursor-160},finish(fast=false){
 if(fast)return canvas;
 const source=ctx.getImageData(0,0,width,height),out=ctx.createImageData(width,height),a=source.data,b=out.data;
 const alpha=(x,y)=>a[(Math.max(0,Math.min(height-1,y))*width+Math.max(0,Math.min(width-1,x)))*4+3];
 for(let y=2;y<height-2;y++)for(let x=2;x<width-2;x++){
  const i=(y*width+x)*4;
  if(!a[i+3]&&!a[i-1]&&!a[i+7]&&!a[i-width*4+3]&&!a[i+width*4+3])continue;
  // Subpixel capillary deformation: a continuous field, not disconnected jittered letters.
  const dx=.58*Math.sin(x*.19+y*.31)+.27*Math.sin(y*1.7+x*.93),dy=.42*Math.sin(x*.28-y*.17);
  const sx=x+dx,sy=y+dy,ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy;
  const coverage=(alpha(ix,iy)*(1-fx)+alpha(ix+1,iy)*fx)*(1-fy)+(alpha(ix,iy+1)*(1-fx)+alpha(ix+1,iy+1)*fx)*fy;
  if(!coverage)continue;
  const noise=(Math.sin(x*127.1+y*311.7)*43758.5453)%1;const grain=Math.abs(noise);
  const pressure=.79+.13*Math.sin(x*.047+y*.021)+.08*Math.sin(y*.11+x*.017);
  const dry=grain>.965?.38:grain>.88?.72:1;
  b[i]=a[i];b[i+1]=a[i+1];b[i+2]=a[i+2];
  // Sample the nearby pigment color at newly feathered edge pixels.
  if(!a[i+3]){b[i]=57;b[i+1]=53;b[i+2]=46}
  b[i+3]=coverage*pressure*dry;
 }
 ctx.putImageData(out,0,0);
 const finished=document.createElement('canvas');finished.width=width;finished.height=height;const f=finished.getContext('2d');
 // Low-opacity absorption halo plus a legible, porous ink core.
 f.filter='blur(1.05px)';f.globalAlpha=.24;f.drawImage(canvas,0,0);f.filter='none';f.globalAlpha=1;f.drawImage(canvas,0,0);
 return finished;
 }};
}
export function compositeInk(ctx,ink){ctx.save();ctx.globalCompositeOperation='multiply';ctx.drawImage(ink,0,0);ctx.restore()}
