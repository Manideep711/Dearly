import React,{useEffect,useMemo} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {paperGrain} from './surfaces';
// Focus in paper coordinates keeps the selected writing sharp during camera travel.
export default function ReadingMaterial({texture,reading,lineIndex}){
 const material=useMemo(()=>new THREE.ShaderMaterial({side:THREE.DoubleSide,toneMapped:false,uniforms:{paper:{value:texture},grainTex:{value:paperGrain(3)},focusY:{value:.85},strength:{value:0},band:{value:.018}},vertexShader:`varying vec2 paperUv;varying vec3 vN;void main(){paperUv=uv;vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,fragmentShader:`
 uniform sampler2D paper;uniform sampler2D grainTex;uniform float focusY;uniform float strength;uniform float band;varying vec2 paperUv;varying vec3 vN;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 void main(){
 float distanceFromLine=abs(paperUv.y-focusY);
 float defocus=smoothstep(band,band*5.0,distanceFromLine)*strength;
 vec2 radius=vec2(1.0/1536.0,1.0/2048.0)*defocus*8.0;
 vec4 color=texture2D(paper,paperUv)*.2;
 for(int i=0;i<12;i++){float angle=float(i)*2.399963;float r=sqrt((float(i)+.5)/12.0);color+=texture2D(paper,clamp(paperUv+vec2(cos(angle),sin(angle))*radius*r,vec2(.001),vec2(.999)))*(.8/12.0);}
 // Fine stationary grain avoids flicker while retaining the close photographic surface.
 float grain=(hash(gl_FragCoord.xy)-.5)*.018*strength;
 color.rgb+=grain;color.rgb*=1.0-.035*defocus;
 // The sheet as a lit object, not a flat print: soft shading that follows
 // its real curvature (the roll reads round), a warm pool of light from
 // the candle side, and the desk's own paper fibres. Kept gentle so the
 // focused line stays exactly as legible as before.
 vec3 n=normalize(vN);if(!gl_FrontFacing)n=-n;
 float lam=.80+.26*max(dot(n,normalize(vec3(-.45,.55,.7))),0.0);
 float pool=1.0-.14*smoothstep(.2,1.05,distance(paperUv,vec2(.28,.82)));
 float fib=texture2D(grainTex,paperUv*vec2(3.0,4.0)).r;
 color.rgb*=lam*pool*(1.0+(fib-.5)*.08)*vec3(1.03,1.0,.95);
 gl_FragColor=color;
 #include <colorspace_fragment>
 }`}),[]);
 useFrame((_,dt)=>{const line=texture.userData.lines[lineIndex];material.uniforms.paper.value=texture;const k=window.matchMedia("(prefers-reduced-motion: reduce)").matches?1:1-Math.exp(-Math.min(dt,.05)*5);material.uniforms.strength.value=THREE.MathUtils.lerp(material.uniforms.strength.value,reading?1:0,k);if(line){material.uniforms.focusY.value=THREE.MathUtils.lerp(material.uniforms.focusY.value,1-line.y/2048,k);material.uniforms.band.value=Math.max(.018,(line.size||72)/2048*.60)}});
 useEffect(()=>()=>material.dispose(),[material]);return <primitive object={material} attach="material"/>;
}

