import * as THREE from 'three';
// The writer's signet: a wax seal pressed onto the rolled scroll, the
// classic way — it holds the letter shut, rides inside the capsule,
// and the reader breaks it to unroll. One drawing routine serves
// everywhere (the stamp panel preview and the seal disc's texture on
// both ends), so what the sender presses is what the receiver breaks.
export const WAX_COLORS = {
  oxblood: {label: 'Oxblood', base: '#711627', dark: '#460c19', light: '#a23347'},
  navy:    {label: 'Navy',    base: '#22385c', dark: '#122138', light: '#40608f'},
  forest:  {label: 'Forest',  base: '#2c4a3a', dark: '#182b20', light: '#4a7a5f'},
  gold:    {label: 'Gold',    base: '#ab8a3e', dark: '#755a1e', light: '#e3c169'},
  black:   {label: 'Black',   base: '#28231f', dark: '#100e0c', light: '#554c41'},
  ivory:   {label: 'Ivory',   base: '#e2d5b8', dark: '#bfa87f', light: '#faf2dd'},
};
export const WAX_DIES = [
  {id: 'monogram', label: 'Monogram'},
  {id: 'quill',    label: 'Quill & leaf'},
  {id: 'crown',    label: 'Crown'},
  {id: 'hearts',   label: 'Hearts'},
  {id: 'airmail',  label: 'Air mail'},
  {id: 'notary',   label: 'Notary'},
];
// Deterministic wobble: the same seal must draw identically on every
// texture rebuild and on both ends of the journey, so the edge is
// seeded from the seal's own identity, never from Math.random.
function seedOf(seal) {
  const s = `${seal.die}|${seal.initials || ''}|${seal.color}|${Math.round((seal.at ?? seal.x ?? 0) * 100)}|${Math.round(seal.y || 0)}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822519); h = Math.imul(h ^ (h >>> 13), 3266489917); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}
function blobPath(ctx, r, rand) {
  const n = 28, pts = [];
  const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
  const am = [.05 + rand() * .03, .032 + rand() * .02, .016 + rand() * .012];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const w = 1 + am[0] * Math.sin(a * 3 + ph[0]) + am[1] * Math.sin(a * 5 + ph[1]) + am[2] * Math.sin(a * 9 + ph[2]);
    pts.push([Math.cos(a) * r * w, Math.sin(a) * r * w]);
  }
  ctx.beginPath();
  ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  ctx.closePath();
}
function heart(ctx, cx, cy, s) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * .85);
  ctx.bezierCurveTo(cx - s * 1.25, cy + s * .1, cx - s * .72, cy - s * .85, cx, cy - s * .28);
  ctx.bezierCurveTo(cx + s * .72, cy - s * .85, cx + s * 1.25, cy + s * .1, cx, cy + s * .85);
  ctx.closePath(); ctx.fill();
}
function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.fill();
}
function arcText(ctx, text, radius, centerAngle, size, flip) {
  ctx.save();
  ctx.font = `600 ${size}px "Cormorant Garamond", serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const widths = [...text].map(ch => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let a = centerAngle + (flip ? 1 : -1) * (total / radius) / 2;
  [...text].forEach((ch, i) => {
    const step = (widths[i] / radius) * (flip ? -1 : 1);
    a += step / 2;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(0, -radius);
    if (flip) ctx.rotate(Math.PI);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += step / 2;
  });
  ctx.restore();
}
// The die's design, drawn twice by the caller (light pass offset, then
// dark pass) so the impression reads as embossed relief.
function design(ctx, seal, r) {
  const ini = (seal.initials || '').trim();
  const ring = (rr, w) => { ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.lineWidth = w; ctx.stroke(); };
  const text = (t, y, size) => { ctx.font = `600 ${size}px "Cormorant Garamond", serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, 0, y); };
  switch (seal.die) {
    case 'quill': {
      ctx.beginPath();
      ctx.moveTo(0, r * .58);
      ctx.quadraticCurveTo(r * .52, r * .08, r * .1, -r * .52);
      ctx.quadraticCurveTo(-r * .3, r * .02, 0, r * .58);
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(-r * .02, r * .62); ctx.lineTo(r * .12, -r * .44); ctx.lineWidth = r * .032; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-r * .3, r * .34, r * .07, r * .16, .6, 0, Math.PI * 2); ctx.fill();
      if (ini) text(ini, r * .68, r * .22);
      ring(r * .8, r * .03);
      break;
    }
    case 'crown': {
      ctx.beginPath();
      ctx.moveTo(-r * .44, r * .16); ctx.lineTo(-r * .44, -r * .24); ctx.lineTo(-r * .18, r * .0); ctx.lineTo(0, -r * .32); ctx.lineTo(r * .18, r * .0); ctx.lineTo(r * .44, -r * .24); ctx.lineTo(r * .44, r * .16); ctx.closePath(); ctx.fill();
      ctx.fillRect(-r * .44, r * .26, r * .88, r * .1);
      for (const px of [-r * .44, 0, r * .44]) { ctx.beginPath(); ctx.arc(px, -r * .34, r * .045, 0, Math.PI * 2); ctx.fill(); }
      if (ini) text(ini, r * .58, r * .24);
      ring(r * .8, r * .03);
      break;
    }
    case 'hearts': {
      heart(ctx, -r * .06, -r * .12, r * .42);
      heart(ctx, r * .36, r * .3, r * .2);
      if (ini) text(ini, r * .62, r * .22);
      ring(r * .8, r * .03);
      break;
    }
    case 'airmail': {
      arcText(ctx, 'AIR MAIL', r * .58, 0, r * .19, false);
      arcText(ctx, 'PAR AVION', r * .58, Math.PI, r * .19, true);
      ctx.beginPath();
      ctx.moveTo(-r * .34, r * .06); ctx.lineTo(r * .36, -r * .16); ctx.lineTo(r * .04, r * .34); ctx.lineTo(r * .0, r * .06); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * .0, r * .06); ctx.lineTo(-r * .34, r * .06); ctx.lineWidth = r * .03; ctx.stroke();
      ring(r * .8, r * .035);
      break;
    }
    case 'notary': {
      ring(r * .8, r * .03); ring(r * .68, r * .018);
      star(ctx, 0, -r * .08, r * .36);
      if (ini) text(ini, r * .5, r * .24);
      break;
    }
    default: { // monogram
      ring(r * .8, r * .035); ring(r * .7, r * .014);
      if (ini) text(ini, r * .03, r * (ini.length > 2 ? .6 : .78));
      else {
        ctx.save(); ctx.rotate(Math.PI / 4); ctx.fillRect(-r * .13, -r * .13, r * .26, r * .26); ctx.restore();
        ctx.beginPath(); ctx.arc(0, 0, r * .05, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
}
export function drawWaxSeal(ctx, seal, cx, cy, r) {
  if (!seal || !(r > 0)) return;
  const col = WAX_COLORS[seal.color] || WAX_COLORS.oxblood;
  const rand = seedOf(seal);
  ctx.save();
  ctx.translate(cx, cy);
  // Contact shadow first, so the wax sits on the paper, not in it.
  ctx.save(); ctx.translate(r * .035, r * .055); blobPath(ctx, r, rand); ctx.fillStyle = 'rgba(28,18,8,.38)'; ctx.fill(); ctx.restore();
  blobPath(ctx, r, seedOf(seal));
  const g = ctx.createRadialGradient(-r * .38, -r * .42, r * .08, 0, 0, r * 1.18);
  g.addColorStop(0, col.light); g.addColorStop(.52, col.base); g.addColorStop(1, col.dark);
  ctx.fillStyle = g; ctx.fill();
  // A darker tide line where the wax pooled against the die's rim.
  ctx.save(); blobPath(ctx, r, seedOf(seal)); ctx.clip();
  ctx.beginPath(); ctx.arc(0, 0, r * .82, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(0,0,0,.16)'; ctx.lineWidth = r * .07; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, r * .8, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = r * .02; ctx.stroke();
  // Embossed design: light pass low and right, dark pass on top.
  ctx.save(); ctx.translate(r * .016, r * .018); ctx.fillStyle = col.light; ctx.strokeStyle = col.light; ctx.globalAlpha = .55; design(ctx, seal, r); ctx.restore();
  ctx.save(); ctx.fillStyle = col.dark; ctx.strokeStyle = col.dark; ctx.globalAlpha = .82; design(ctx, seal, r); ctx.restore();
  // Specular sweep — the gloss that sells it as wax (or metal).
  ctx.rotate(-.5);
  const sg = ctx.createLinearGradient(0, -r, 0, r * .2);
  sg.addColorStop(0, 'rgba(255,255,255,.34)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.ellipse(0, -r * .52, r * .62, r * .3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// A scroll seal as stored on the letter: {die, initials, color, at, r}
// — `at` is the position along the scroll's length (-1..1) and `r` the
// seal's radius in world units. Seals stamped by the earlier design
// (page coordinates on the flat sheet) are normalised to a centred
// scroll seal so an old draft still sends and arrives sealed.
export function scrollSealOf(seal) {
  if (!seal) return null;
  const at = THREE.MathUtils.clamp(typeof seal.at === 'number' ? seal.at : 0, -1, 1);
  const r = typeof seal.r === 'number' && seal.r > 0 && seal.r < 1 ? THREE.MathUtils.clamp(seal.r, .12, .26) : .19;
  return {die: seal.die || 'monogram', initials: seal.initials || '', color: seal.color || 'oxblood', at, r};
}
// The seal as a texture for the 3D discs on the scroll (sender and
// receiver share it, so the seal looks identical on both ends).
export function makeWaxSealTexture(seal) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  drawWaxSeal(x, seal, 128, 128, 116);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
