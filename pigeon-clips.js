import {Quaternion} from 'three';
// Seconds from the user's inspection of Take 001, not minute:second timecodes.
// Small boundary margins exclude the initial pose and unwanted death frames.
export const PIGEON_SEGMENTS = Object.freeze({
  walk: { start: .04, end: 3.20, loop: true },
  takeoffAndFlight: { start: 3.23, end: 13.50, loop: false },
  approachAndLand: { start: 19.02, end: 20.80, loop: false },
  peck: { start: 20.8, end: 23.5, loop: false },
  feed: { start: 21.68, end: 34, loop: false, provisional: true },
  reactLook: { start: 34.04, end: 40, loop: false },
  reactPreen: { start: 45, end: 51, loop: false },
  reactShuffle: { start: 62, end: 68.8, loop: false },
  idle: { start: 34.04, end: 68.90, loop: false, provisional: true },
  flight: { start: 80, end: 90, loop: false }
});

// Resample the exact endpoints so every isolated clip has a valid first pose.
// Loop suitability and cross-fades still need checking in the final delivery scene.
export function createPigeonClips(source) {
  return Object.fromEntries(Object.entries(PIGEON_SEGMENTS).map(([name, range]) => {
    if (range.end > source.duration) throw new Error(`Pigeon clip ${name} exceeds source duration`);
    const clip = source.clone();
    clip.name = name;
    clip.tracks = source.tracks.map(track => {
      const times = [range.start, ...Array.from(track.times).filter(t => t > range.start && t < range.end), range.end];
      const interpolant = track.createInterpolant();
      const values = [];
      for (const time of times) values.push(...interpolant.evaluate(time));
      return new track.constructor(track.name, times.map(t => t - range.start), values, track.getInterpolation());
    });
    clip.duration = range.end - range.start;
    if(name==='idle'){
      // Ease the final scratching pose into the first pose before wrapping.
      // Use spherical interpolation for joint rotations, never component lerps.
      const start=clip.duration-.65,end=clip.duration+.95;
      clip.tracks=clip.tracks.map(track=>{
        const sample=track.createInterpolant(),size=track.getValueSize();
        const first=Array.from(sample.evaluate(0));
        const times=Array.from(track.times).filter(t=>t<start),values=[];
        for(const t of times)values.push(...sample.evaluate(t));
        const a=new Quaternion(),b=new Quaternion();
        const steps=64;
        for(let i=0;i<=steps;i++){
          const t=start+(end-start)*i/steps,u=i/steps;
          const weight=u*u*u*(u*(u*6-15)+10);
          const current=Array.from(sample.evaluate(Math.min(t,clip.duration)));
          if(track.ValueTypeName==='quaternion'){
            for(let k=0;k<size;k+=4){a.fromArray(current,k);b.fromArray(first,k);a.slerp(b,weight).normalize().toArray(current,k)}
          }else for(let k=0;k<size;k++)current[k]+=(first[k]-current[k])*weight;
          times.push(t);values.push(...current);
        }
        return new track.constructor(track.name,times,values,track.getInterpolation());
      });
      clip.duration=end;
    }
    return [name, clip];
  }));
}

