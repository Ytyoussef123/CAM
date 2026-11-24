/* Image analysis: each area at its own resolution ("zoom per area"), the position reference search, and measures. */
import type { Tool, Offset, GrayRect, TStats, PosResult, MeasResult } from './types';
import { BASE, MAXG, FULLMAX, canvas, type Drawable } from './util';
import { P } from './state';
import { refTool, shift, ctr, toolBox, mTol } from './tools';

export function blurWH(a: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(a.length), out = new Float32Array(a.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const xx = x + k; if (xx >= 0 && xx < w) { s += a[y * w + xx]; n++ } } tmp[y * w + x] = s / n }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0, n = 0; for (let k = -r; k <= r; k++) { const yy = y + k; if (yy >= 0 && yy < h) { s += tmp[yy * w + x]; n++ } } out[y * w + x] = s / n }
  return out;
}
/** Analysis grid of an area: whole image = 96 points; Auto gives the area's long side ~96 points, capped by the real pixels. */
export function grid(a: Tool): { gw: number; gh: number; k: number } {
  const F = P && P.ref ? P.ref.size : FULLMAX, w = a.x1 - a.x0, h = a.y1 - a.y0;
  const k0 = a.detail && a.detail !== 'auto' ? +a.detail : Math.max(1, 1 / Math.max(w, h));
  let gw = w * BASE * k0, gh = h * BASE * k0;
  const cap = Math.min(1, (w * F) / gw, (h * F) / gh, MAXG / Math.max(gw, gh));
  gw = Math.max(8, Math.round(gw * cap)); gh = Math.max(8, Math.round(gh * cap));
  return { gw, gh, k: k0 * cap };
}
export function refKey(): string { const r = refTool(); return r ? `${r.x0.toFixed(4)},${r.y0.toFixed(4)},${r.x1.toFixed(4)},${r.y1.toFixed(4)},${r.range}` : 'none' }
/** Key of the cut of an area: a learned picture is cut again when the area moves, turns or changes size. */
export const gKey = (a: Tool) => { const g = grid(a); return `${a.id}|${a.x0.toFixed(4)},${a.y0.toFixed(4)},${a.x1.toFixed(4)},${a.y1.toFixed(4)},${(a.ang || 0).toFixed(3)}|${g.gw}x${g.gh}|${refKey()}` };
const gC = canvas(8), gX = gC.getContext('2d', { willReadFrequently: true })!;
function toGray(px: Uint8ClampedArray, n: number) { const g = new Float32Array(n); for (let i = 0; i < n; i++) g[i] = .299 * px[i * 4] + .587 * px[i * 4 + 1] + .114 * px[i * 4 + 2]; return g }
/** Cuts the area (moved by the position offset, turned by its angle) and resamples it to its grid. */
export function areaGray(src: Drawable, size: number, a: Tool, o: Offset | null): Float32Array {
  const { gw, gh } = grid(a), b = shift(a, o), ang = a.ang || 0; gC.width = gw; gC.height = gh; gX.imageSmoothingEnabled = true; gX.imageSmoothingQuality = 'high';
  gX.fillStyle = '#000'; gX.fillRect(0, 0, gw, gh);
  if (!ang) gX.drawImage(src, b.x0 * size, b.y0 * size, (b.x1 - b.x0) * size, (b.y1 - b.y0) * size, 0, 0, gw, gh);
  else {
    const [cx, cy] = ctr(b), w = (b.x1 - b.x0) * size, h = (b.y1 - b.y0) * size, bb = toolBox(b);
    const sx = Math.max(0, Math.floor(bb.x0 * size) - 1), sy = Math.max(0, Math.floor(bb.y0 * size) - 1), ex = Math.min(size, Math.ceil(bb.x1 * size) + 1), ey = Math.min(size, Math.ceil(bb.y1 * size) + 1);
    gX.translate(gw / 2, gh / 2); gX.scale(gw / w, gh / h); gX.rotate(-ang); gX.translate(-cx * size, -cy * size);
    if (ex > sx && ey > sy) gX.drawImage(src, sx, sy, ex - sx, ey - sy, sx, sy, ex - sx, ey - sy);
    gX.setTransform(1, 0, 0, 1, 0, 0);
  }
  return blurWH(toGray(gX.getImageData(0, 0, gw, gh).data, gw * gh), gw, gh, 1);
}
const maskCache: Record<string, Uint8Array> = {};
/** Circle / ellipse: only the points inside count. */
export function maskOf(a: Tool, gw: number, gh: number): Uint8Array | null {
  if (a.shape !== 'ellipse') return null; const k = gw + 'x' + gh; if (maskCache[k]) return maskCache[k];
  const m = new Uint8Array(gw * gh); for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const u = (x + .5) / gw - .5, v = (y + .5) / gh - .5; m[y * gw + x] = u * u + v * v <= .25 ? 1 : 0 }
  return maskCache[k] = m;
}

/* ---------- position reference: find the reference pattern (normalized cross-correlation) ---------- */
function grayRect(src: Drawable, size: number, x0: number, y0: number, x1: number, y1: number, G: number): GrayRect {
  const w = Math.max(4, Math.round((x1 - x0) * G)), h = Math.max(4, Math.round((y1 - y0) * G));
  gC.width = w; gC.height = h; gX.imageSmoothingEnabled = true; gX.imageSmoothingQuality = 'high';
  gX.drawImage(src, x0 * size, y0 * size, (x1 - x0) * size, (y1 - y0) * size, 0, 0, w, h);
  return { g: toGray(gX.getImageData(0, 0, w, h).data, w * h), w, h, kx: w / (x1 - x0), ky: h / (y1 - y0) };
}
function tStats(t: GrayRect): TStats { let m = 0; for (const v of t.g) m += v; m /= t.g.length; const z = new Float32Array(t.g.length); let s = 0; for (let i = 0; i < z.length; i++) { z[i] = t.g[i] - m; s += z[i] * z[i] } return { z, norm: Math.sqrt(s) || 1 } }
function ncc(T: GrayRect, Ts: TStats, I: GrayRect) {
  let best = { s: -2, x: 0, y: 0 }; const tw = T.w, th = T.h, n = tw * th;
  for (let y = 0; y + th <= I.h; y++) for (let x = 0; x + tw <= I.w; x++) {
    let sum = 0, sq = 0, cr = 0;
    for (let j = 0; j < th; j++) { const ro = (y + j) * I.w + x, to = j * tw; for (let i = 0; i < tw; i++) { const v = I.g[ro + i]; sum += v; sq += v * v; cr += v * Ts.z[to + i] } }
    const vI = sq - sum * sum / n; if (vI <= 1e-6) continue;
    const s = cr / (Math.sqrt(vI) * Ts.norm); if (s > best.s) best = { s, x, y };
  }
  return best;
}
/** Where the part is: the offset of the position reference, and how well it matched (0–1). */
export function findPos(src: Drawable, size: number): PosResult {
  const r = refTool(); if (!r || !P.ref) return { dx: 0, dy: 0, score: 1, found: true, none: true };
  const ref = P.ref, w = r.x1 - r.x0, h = r.y1 - r.y0, R = (r.range || 20) / 100, key = refKey();
  const tc = ref.tm && ref.tm.key === key ? ref.tm : (ref.tm = { key });
  const G1 = Math.min(40 / Math.max(w, h), size);
  if (!tc.c) { const t = grayRect(ref.full, ref.size, r.x0, r.y0, r.x1, r.y1, G1); tc.c = { t, s: tStats(t) } }
  const sx0 = Math.max(0, r.x0 - R), sy0 = Math.max(0, r.y0 - R), sx1 = Math.min(1, r.x1 + R), sy1 = Math.min(1, r.y1 + R);
  const I = grayRect(src, size, sx0, sy0, sx1, sy1, G1), b = ncc(tc.c.t, tc.c.s, I);
  if (b.s <= -2) return { dx: 0, dy: 0, score: 0, found: false };
  let nx = sx0 + b.x / I.kx, ny = sy0 + b.y / I.ky, score = b.s;
  const G2 = Math.min(G1 * 4, ref.size, size);
  if (G2 > G1 * 1.5) { // refine at higher resolution around the coarse match
    if (!tc.f || tc.fG !== G2) { const t = grayRect(ref.full, ref.size, r.x0, r.y0, r.x1, r.y1, G2); tc.f = { t, s: tStats(t) }; tc.fG = G2 }
    const m = 2.5 / G1, fx0 = Math.max(0, nx - m), fy0 = Math.max(0, ny - m), fx1 = Math.min(1, nx + w + m), fy1 = Math.min(1, ny + h + m);
    const I2 = grayRect(src, size, fx0, fy0, fx1, fy1, G2), b2 = ncc(tc.f.t, tc.f.s, I2);
    if (b2.s > -2) { nx = fx0 + b2.x / I2.kx; ny = fy0 + b2.y / I2.ky; score = b2.s }
  }
  score = Math.max(0, score);
  return { dx: nx - r.x0, dy: ny - r.y0, score, found: Math.round(score * 100) >= (r.minScore || 60) };
}

/* ---------- measure: find two edges along a line and their distance ---------- */
export const fmtLen = (px: number | null | undefined) => px == null || !isFinite(px) ? '—' : P && P.scale ? (px * P.scale).toFixed(3) + ' mm' : px.toFixed(1) + ' px';
export const unit = () => P && P.scale ? 'mm' : 'px';
export function measureTool(src: Drawable, size: number, m: Tool, o: Offset | null): Omit<MeasResult, 'id' | 'name'> {
  const a = shift(m, o), x0 = a.x0 * size, y0 = a.y0 * size, x1 = a.x1 * size, y1 = a.y1 * size, L = Math.hypot(x1 - x0, y1 - y0);
  const none = { found: false, ok: false, value: null }; if (L < 6) return none;
  const ux = (x1 - x0) / L, uy = (y1 - y0) / L, nx = -uy, ny = ux, band = Math.max(1, (m.band || .02) * size / 2);
  const bx0 = Math.max(0, Math.floor(Math.min(x0, x1) - band - 2)), by0 = Math.max(0, Math.floor(Math.min(y0, y1) - band - 2));
  const bx1 = Math.min(size, Math.ceil(Math.max(x0, x1) + band + 2)), by1 = Math.min(size, Math.ceil(Math.max(y0, y1) + band + 2)), cw = bx1 - bx0, ch = by1 - by0;
  if (cw < 3 || ch < 3) return none;
  gC.width = cw; gC.height = ch; gX.drawImage(src, bx0, by0, cw, ch, 0, 0, cw, ch); const g = toGray(gX.getImageData(0, 0, cw, ch).data, cw * ch);
  const at = (X: number, Y: number) => {
    X -= bx0; Y -= by0; if (X < 0 || Y < 0 || X >= cw - 1 || Y >= ch - 1) return null; const xi = X | 0, yi = Y | 0, fx = X - xi, fy = Y - yi, i = yi * cw + xi;
    return g[i] * (1 - fx) * (1 - fy) + g[i + 1] * fx * (1 - fy) + g[i + cw] * (1 - fx) * fy + g[i + cw + 1] * fx * fy;
  };
  const N = Math.round(L), nb = Math.max(1, Math.round(band)), p = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) { let s = 0, c = 0; const cx = x0 + ux * i, cy = y0 + uy * i; for (let k = -nb; k <= nb; k++) { const v = at(cx + nx * k, cy + ny * k); if (v != null) { s += v; c++ } } p[i] = c ? s / c : (i ? p[i - 1] : 0) }
  const sm = new Float32Array(N + 1); for (let i = 0; i <= N; i++) { let s = 0, c = 0; for (let k = -2; k <= 2; k++) { const j = i + k; if (j >= 0 && j <= N) { s += p[j]; c++ } } sm[i] = s / c }
  const W = 3, d = new Float32Array(N + 1); for (let i = W; i <= N - W; i++) d[i] = sm[i + W] - sm[i - W];
  const thr = m.contrast || 25, peaks: { i: number; v: number }[] = [];
  for (let i = W + 1; i < N - W; i++) {
    const v = Math.abs(d[i]); if (v >= thr && v >= Math.abs(d[i - 1]) && v > Math.abs(d[i + 1])) {
      const l = Math.abs(d[i - 1]), r = Math.abs(d[i + 1]), den = l - 2 * v + r, off = den ? (l - r) / (2 * den) : 0; peaks.push({ i: i + Math.max(-.5, Math.min(.5, off)), v })
    }
  }
  if (peaks.length < 2) return { ...none, edges: peaks.length };
  let e1, e2;
  if (m.edges === 'strong') { const s = [...peaks].sort((A, B) => B.v - A.v).slice(0, 2).sort((A, B) => A.i - B.i); e1 = s[0]; e2 = s[1] }
  else { e1 = peaks[0]; e2 = peaks[peaks.length - 1] }
  const value = (e2.i - e1.i) * (P.ref ? P.ref.size / size : 1); // in reference pixels
  const pt = (t: number): [number, number] => [(x0 + ux * t) / size, (y0 + uy * t) / size];
  const ok = m.nom == null || Math.abs(value - m.nom) <= mTol(m);
  return { found: true, ok, value, e1: pt(e1.i), e2: pt(e2.i) };
}
