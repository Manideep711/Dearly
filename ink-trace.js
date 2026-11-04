// Trace the centre of the actual ink pixels, so the nib follows the rendered font.
export function traceInk(ink,rect){
 const c=document.createElement('canvas');c.width=rect.w;c.height=rect.h;const ctx=c.getContext('2d');ctx.drawImage(ink,-rect.x,-rect.y);
 const rgba=ctx.getImageData(0,0,c.width,c.height).data,w=c.width,h=c.height;
 const pixels=new Uint8Array(w*h);for(let i=0;i<pixels.length;i++)pixels[i]=rgba[i*4+3]>75?1:0;
 for(let iteration=0;iteration<22;iteration++){
  let changed=false;
  for(let pass=0;pass<2;pass++){
   const remove=[];
   for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
    const i=y*w+x;if(!pixels[i])continue;
    const p=[pixels[i-w],pixels[i-w+1],pixels[i+1],pixels[i+w+1],pixels[i+w],pixels[i+w-1],pixels[i-1],pixels[i-w-1]];
    const n=p.reduce((a,b)=>a+b,0);if(n<2||n>6)continue;
    let transitions=0;for(let k=0;k<8;k++)if(!p[k]&&p[(k+1)%8])transitions++;
    if(transitions!==1)continue;
    if(pass===0?(p[0]*p[2]*p[4]||p[2]*p[4]*p[6]):(p[0]*p[2]*p[6]||p[0]*p[4]*p[6]))continue;
    remove.push(i);
   }
   for(const i of remove)pixels[i]=0;if(remove.length)changed=true;
  }if(!changed)break;
 }
 const remaining=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(pixels[y*w+x])remaining.push({x,y});
 const path=[];let current={x:0,y:h*.7};
 while(remaining.length&&path.length<1200){let best=0,d=Infinity;for(let i=0;i<remaining.length;i++){const p=remaining[i],n=(p.x-current.x)**2+(p.y-current.y)**2;if(n<d){d=n;best=i}}current=remaining.splice(best,1)[0];path.push({...current,lift:d>90})}
 return path;
}
