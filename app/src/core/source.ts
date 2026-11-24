/* Image sources: the phone camera (peer link), the demo camera (simulated parts) and image files. */
import type { Cam, Frame } from './types';
import { D, FULLMAX, canvas, sizeOf, store, stored, type Drawable } from './util';
import { P, U, DOM, render, flashMsg } from './state';
import { L, connectPhone } from './link';

/* ---------- camera zoom: which square of the camera image is used (saved in the program) ---------- */
export function camCrop(sw: number, sh: number, cam: Cam | null): [number, number, number] {
  const s0 = Math.min(sw, sh), z = Math.max(1, (cam && cam.zoom) || 1), s = s0 / z;
  const cx = sw / 2 + ((cam && cam.ox) || 0) * (s0 - s) / 2, cy = sh / 2 + ((cam && cam.oy) || 0) * (s0 - s) / 2;
  return [cx - s / 2, cy - s / 2, s];
}
const curCam = (): Cam => P ? P.cam : { zoom: 1, ox: 0, oy: 0 };
/** Full-resolution square picture after the camera zoom. */
export function makeFrame(src: Drawable, max = FULLMAX): Frame {
  const [sw, sh] = sizeOf(src), [x, y, s] = camCrop(sw, sh, curCam()), n = Math.max(16, Math.round(Math.min(s, max)));
  const c = canvas(n); c.getContext('2d')!.drawImage(src, x, y, s, s, 0, 0, n, n); return { full: c, size: n };
}
export function drawSrc(x: CanvasRenderingContext2D, src: Drawable) { const [sw, sh] = sizeOf(src), [sx, sy, s] = camCrop(sw, sh, curCam()); x.drawImage(src, sx, sy, s, s, 0, 0, D, D) }

export type SourceKind = 'phone' | 'demo' | 'file';
const KINDS: SourceKind[] = ['phone', 'demo', 'file'];
export const SRC: {
  kind: SourceKind; demo: HTMLCanvasElement | null; demoT: ReturnType<typeof setInterval> | undefined; demoSeed: number;
  params?: { seed: number; defect: string | null; mx: number; my: number };
} = { kind: KINDS.includes(stored('vs1-src') as SourceKind) ? stored('vs1-src') as SourceKind : 'demo', demo: null, demoT: undefined, demoSeed: 1 };

/* ---------- demo camera: a simulated flange, slightly shifted, about 1 in 3 with a defect ---------- */
function rng(a: number) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function grey(v: number) { v = Math.max(0, Math.min(255, Math.round(v))); return `rgb(${v},${v},${v + 4})` }
export function samplePart(seed: number, defect: string | null, S = 1280, mx = 0, my = 0): HTMLCanvasElement {
  const r = rng(seed), c = canvas(S), x = c.getContext('2d')!;
  x.fillStyle = '#3a4146'; x.fillRect(0, 0, S, S);
  const k = S / 320; x.strokeStyle = 'rgba(255,255,255,.04)'; x.lineWidth = k;
  for (let i = 0; i < S; i += 12 * k) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke() }
  const cx = S / 2 + (r() - .5) * 1.6 * k + mx * k, cy = S / 2 + (r() - .5) * 1.6 * k + my * k, rot = (r() - .5) * .012, b = (r() - .5) * 14;
  const g = x.createRadialGradient(cx - 30 * k, cy - 30 * k, 10 * k, cx, cy, 120 * k); g.addColorStop(0, grey(205 + b)); g.addColorStop(1, grey(150 + b));
  x.beginPath(); x.arc(cx, cy, 110 * k, 0, Math.PI * 2); x.fillStyle = g; x.fill();
  x.beginPath(); x.arc(cx, cy, 62 * k, 0, Math.PI * 2); x.strokeStyle = grey(118 + b); x.lineWidth = 3 * k; x.stroke();
  x.beginPath(); x.arc(cx, cy, 38 * k, 0, Math.PI * 2); x.fillStyle = '#171b1e'; x.fill();
  for (let h = 0; h < 4; h++) {
    if (defect === 'missing' && h === 1) continue;
    const a = rot + h * Math.PI / 2 + Math.PI / 4;
    x.beginPath(); x.arc(cx + 86 * k * Math.cos(a), cy + 86 * k * Math.sin(a), 11 * k, 0, Math.PI * 2); x.fillStyle = '#171b1e'; x.fill();
  }
  if (defect === 'scratch') { x.lineCap = 'round'; x.strokeStyle = 'rgba(45,40,38,.9)'; x.lineWidth = 3 * k; x.beginPath(); x.moveTo(cx - 34 * k, cy + 66 * k); x.lineTo(cx + 38 * k, cy + 84 * k); x.stroke() }
  if (defect === 'chip') { const a = rot + 2.1; x.beginPath(); x.moveTo(cx + 114 * k * Math.cos(a - .12), cy + 114 * k * Math.sin(a - .12)); x.lineTo(cx + 100 * k * Math.cos(a), cy + 100 * k * Math.sin(a)); x.lineTo(cx + 114 * k * Math.cos(a + .12), cy + 114 * k * Math.sin(a + .12)); x.closePath(); x.fillStyle = '#3a4146'; x.fill() }
  if (defect === 'stain') { const sx = cx + 42 * k, sy = cy - 58 * k, sg = x.createRadialGradient(sx, sy, 1, sx, sy, 12 * k); sg.addColorStop(0, 'rgba(80,48,18,.9)'); sg.addColorStop(1, 'rgba(92,58,24,0)'); x.fillStyle = sg; x.beginPath(); x.arc(sx, sy, 12 * k, 0, Math.PI * 2); x.fill() }
  const id = x.getImageData(0, 0, S, S), d = id.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * 10; d[i] += n; d[i + 1] += n; d[i + 2] += n }
  x.putImageData(id, 0, 0); return c;
}
export function demoNext() {
  const r = Math.random(), d = r < .65 ? null : ['missing', 'scratch', 'chip', 'stain'][Math.floor(Math.random() * 4)];
  const p = { seed: ++SRC.demoSeed * 7919, defect: d, mx: (Math.random() - .5) * 16, my: (Math.random() - .5) * 16 };
  SRC.params = p; SRC.demo = samplePart(p.seed, p.defect, 1280, p.mx, p.my);
}
export function startDemo() { clearInterval(SRC.demoT); demoNext(); SRC.demoT = setInterval(demoNext, 2500) }
export function setSrc(k: SourceKind) {
  SRC.kind = k; store('vs1-src', k); clearInterval(SRC.demoT);
  if (k === 'demo') { demoNext(); SRC.demoT = setInterval(demoNext, 2500) }
  if (k === 'phone' && !L.conn) { const c = stored('vs1-pair'); if (c) { U.pairIn = c; connectPhone() } }
  render();
}
/** What the live view shows (null: no live image). */
export function liveSrc(): Drawable | null {
  if (SRC.kind === 'demo') return SRC.demo;
  if (SRC.kind === 'phone' && L.video && L.video.videoWidth && L.camOn) return L.video;
  return null;
}
/** One full-resolution picture from the source, with the program's camera zoom. */
export function grab(): Promise<Frame | null> {
  if (SRC.kind === 'demo') return Promise.resolve(makeFrame(SRC.demo!));
  if (SRC.kind === 'file') return new Promise(ok => {
    const f = DOM.fileIn!; f.value = '';
    f.onchange = async () => { const file = f.files && f.files[0]; if (!file) return ok(null); try { ok(makeFrame(await createImageBitmap(file))) } catch (e) { ok(null) } };
    f.click();
  });
  if (!(L.conn && L.conn.open && L.camOn)) { flashMsg('No live image: connect the phone (Image source) and start its camera.'); return Promise.resolve(null) }
  const conn = L.conn;
  return new Promise(ok => { // the phone sends its full camera frame; fall back to the video frame
    const id = Math.random().toString(36).slice(2);
    const t = setTimeout(() => { delete L.wait[id]; ok(L.video && L.video.videoWidth ? makeFrame(L.video) : null) }, 4000);
    L.wait[id] = img => { clearTimeout(t); if (!img) { ok(null); return } const im = new Image(); im.onload = () => ok(makeFrame(im)); im.onerror = () => ok(null); im.src = img };
    conn.send({ type: 'snap', id });
  });
}
