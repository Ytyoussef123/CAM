/* The two charts: the RUN histogram of one tool, and the scores of a tested folder (one thin bar per score point). */
import type { Tool } from '../core/types';
import { U } from '../core/state';
import { limOf, mTol } from '../core/tools';
import { fmtLen } from '../core/analysis';
import { FT, toolLim } from '../core/folderTest';

export function cssv(n: string) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888' }
interface HistSpec { lo: number; hi: number; lim?: number; band?: [number, number] | null; ok: (v: number | null) => boolean; fmt: (v: number) => string }
/** Range, OK test and limit lines of the selected tool's histogram. */
export function histSpec(a: Tool): HistSpec {
  if (a.type === 'measure') {
    const vals = (U.hist[a.id] || []).filter((v): v is number => v != null); let lo: number, hi: number, band: [number, number] | null = null;
    if (a.nom != null) { const t = mTol(a); lo = a.nom - 3 * t; hi = a.nom + 3 * t; band = [a.nom - t, a.nom + t] }
    else if (vals.length) { lo = Math.min(...vals); hi = Math.max(...vals); const p = (hi - lo) * .15 || 1; lo -= p; hi += p }
    else { lo = 0; hi = 1 }
    return { lo, hi, band, ok: v => v != null && (a.nom == null || Math.abs(v - a.nom) <= mTol(a)), fmt: v => fmtLen(v) };
  }
  const lim = a.type === 'ref' ? (a.minScore || 60) : limOf(a);
  return { lo: 0, hi: 100, lim, ok: v => v != null && Math.round(v) >= lim, fmt: v => String(Math.round(v)) };
}
/** The numbers under the histogram. */
export function histStatsTxt(a: Tool) {
  const vals = U.hist[a.id] || [], sp = histSpec(a), nums = vals.filter((v): v is number => v != null), ok = vals.filter(sp.ok).length, miss = vals.length - nums.length;
  if (!vals.length) return 'No trigger yet for this tool.';
  const close = sp.lim != null && nums.length ? Math.round(Math.min(...nums.map(v => Math.abs(v - sp.lim!)))) : null;
  return `${vals.length} trigger${vals.length > 1 ? 's' : ''} · OK ${ok} · NG ${vals.length - ok}` +
    (nums.length ? ` · max ${sp.fmt(Math.max(...nums))} · min ${sp.fmt(Math.min(...nums))} · avg ${sp.fmt(nums.reduce((s, v) => s + v, 0) / nums.length)}` : '') + (miss ? ` · no edges ${miss}` : '') +
    (close != null ? ` · closest to the limit: ${close} point${close === 1 ? '' : 's'}` : '') +
    (nums.length && sp.band ? ` · closest to a tolerance edge: ${fmtLen(Math.min(...nums.map(v => Math.min(Math.abs(v - sp.band![0]), Math.abs(v - sp.band![1])))))}` : '');
}
function setup(c: HTMLCanvasElement, H: number) {
  const W = c.clientWidth; if (!W) return null;
  const dpr = window.devicePixelRatio || 1;
  if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
  const x = c.getContext('2d')!; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H); return { x, W };
}
function axes(x: CanvasRenderingContext2D, X: (v: number) => number, pl: number, pt: number, pw: number, ph: number, mu: string, ticks: number[], measure: boolean, mx: number) {
  x.strokeStyle = mu; x.lineWidth = 1; x.beginPath(); x.moveTo(pl, pt + ph + .5); x.lineTo(pl + pw, pt + ph + .5); x.stroke();
  x.fillStyle = mu; x.font = '11px "IBM Plex Mono",ui-monospace,monospace'; x.textBaseline = 'top';
  ticks.forEach((v, i) => { const t = measure ? fmtLen(v).replace(/ (mm|px)$/, '') : String(Math.round(v)); x.textAlign = i === 0 ? 'left' : i === 2 ? 'right' : 'center'; x.fillText(t, X(v), pt + ph + 5) });
  x.textAlign = 'right'; x.fillText(String(mx), pl - 5, pt); x.fillText('0', pl - 5, pt + ph - 11);
}
/** RUN histogram: green part = OK results, red part = NG results; the line is the limit (dashed: tolerance). */
export function drawHist(c: HTMLCanvasElement, a: Tool | null) {
  const s = setup(c, 130); if (!s || !a) return; const { x, W } = s, H = 130;
  const vals = U.hist[a.id] || [], sp = histSpec(a), okC = cssv('--ok'), ngC = cssv('--ng'), fg = cssv('--fg'), mu = cssv('--muted');
  const sc = a.type !== 'measure', x0 = sc ? -.5 : sp.lo, x1 = sc ? 100.5 : sp.hi; // scores: one bar per point, 0 … 100
  const pl = 30, pr = 12, pt = 10, pb = 22, pw = W - pl - pr, ph = H - pt - pb, X = (v: number) => pl + (v - x0) / (x1 - x0) * pw, LX = sc && sp.lim != null ? X(sp.lim - .5) : null;
  // zones: red = NG, green = OK
  const zone = (v0: number, v1: number, col: string) => { const a0 = Math.max(x0, v0), a1 = Math.min(x1, v1); if (a1 > a0) { x.fillStyle = col; x.fillRect(X(a0), pt, X(a1) - X(a0), ph) } };
  x.globalAlpha = .16;
  if (sp.band) { zone(x0, sp.band[0], ngC); zone(sp.band[0], sp.band[1], okC); zone(sp.band[1], x1, ngC) }
  else if (sp.lim != null) { zone(x0, sp.lim - .5, ngC); zone(sp.lim - .5, x1, okC) }
  else zone(x0, x1, okC);
  x.globalAlpha = 1;
  const NB = sc ? 101 : 100, n = new Array(NB).fill(0), nok = new Array(NB).fill(0);
  for (const v of vals) { if (v == null) continue; const i = Math.min(NB - 1, Math.max(0, sc ? Math.round(v) : Math.floor((v - sp.lo) / (sp.hi - sp.lo) * NB))); n[i]++; if (sp.ok(v)) nok[i]++ }
  const mx = Math.max(1, ...n), bw = pw / NB, w = bw >= 3 ? bw - 1 : bw; // thin bars, one per value band
  for (let i = 0; i < NB; i++) {
    if (!n[i]) continue; const h = Math.max(2, n[i] / mx * ph), ho = nok[i] ? Math.max(2, nok[i] / mx * ph) : 0, bx = pl + i * bw;
    x.fillStyle = ngC; x.fillRect(bx, pt + ph - h, w, h - ho); x.fillStyle = okC; x.fillRect(bx, pt + ph - ho, w, ho);
  }
  // limit: solid line; tolerance: dashed lines
  x.strokeStyle = fg; x.lineWidth = 2;
  if (LX != null) { x.beginPath(); x.moveTo(LX, pt - 4); x.lineTo(LX, pt + ph); x.stroke() }
  if (sp.band) { x.setLineDash([4, 3]); for (const v of sp.band) { x.beginPath(); x.moveTo(X(v), pt - 4); x.lineTo(X(v), pt + ph); x.stroke() } x.setLineDash([]) }
  axes(x, X, pl, pt, pw, ph, mu, a.type === 'measure' ? [sp.lo, (sp.lo + sp.hi) / 2, sp.hi] : [0, sp.lim!, 100], a.type === 'measure', mx);
}
/** Scores of the tested pictures for one tool: green = good folders, red = defect folders, grey = no label. */
export function drawFolderChart(c: HTMLCanvasElement, a: Tool | null) {
  const s = setup(c, 140); if (!s || !a) return; const { x, W } = s, H = 140;
  const pts = FT.items.filter(i => !i.err && !i.known).map(i => { const t = i.tools.find(t => t.id === a.id); return t && t.v != null ? { v: t.v, e: i.expect } : null }).filter((p): p is { v: number; e: 'ok' | 'ng' | null } => !!p);
  let lo = 0, hi = 100, lim: number | null = null, band: [number, number] | null = null;
  if (a.type === 'measure') {
    const vs = pts.map(p => p.v);
    if (a.nom != null) { const t = mTol(a); lo = Math.min(a.nom - 3 * t, ...vs); hi = Math.max(a.nom + 3 * t, ...vs); band = [a.nom - t, a.nom + t] }
    else if (vs.length) { lo = Math.min(...vs); hi = Math.max(...vs); const p = (hi - lo) * .1 || 1; lo -= p; hi += p }
  }
  else lim = toolLim(a);
  const okC = cssv('--ok'), ngC = cssv('--ng'), fg = cssv('--fg'), mu = cssv('--muted');
  const sc = a.type !== 'measure', x0 = sc ? -.5 : lo, x1 = sc ? 100.5 : hi; // scores: one bar per point, 0 … 100
  const pl = 30, pr = 12, pt = 10, pb = 22, pw = W - pl - pr, ph = H - pt - pb, X = (v: number) => pl + (v - x0) / (x1 - x0 || 1) * pw;
  const NB = sc ? 101 : 100, b = { ok: new Array(NB).fill(0), ng: new Array(NB).fill(0), un: new Array(NB).fill(0) };
  for (const p of pts) { const i = Math.min(NB - 1, Math.max(0, sc ? Math.round(p.v) : Math.floor((p.v - lo) / (hi - lo || 1) * NB))); b[p.e === 'ok' ? 'ok' : p.e === 'ng' ? 'ng' : 'un'][i]++ }
  const tot = b.ok.map((v, i) => v + b.ng[i] + b.un[i]), mx = Math.max(1, ...tot), bw = pw / NB, w = bw >= 3 ? bw - 1 : bw;
  for (let i = 0; i < NB; i++) {
    if (!tot[i]) continue; let y = pt + ph; // stacked: good folders, defect folders, no label
    for (const [k, col] of [['ok', okC], ['ng', ngC], ['un', mu]] as const) { const n = b[k][i]; if (!n) continue; const h = Math.max(2, n / mx * ph); x.fillStyle = col; x.fillRect(pl + i * bw, y - h, w, h); y -= h }
  }
  x.strokeStyle = fg; x.lineWidth = 2;
  if (lim != null) { const lx = X(lim - .5); x.beginPath(); x.moveTo(lx, pt - 4); x.lineTo(lx, pt + ph); x.stroke() }
  if (band) { x.setLineDash([4, 3]); for (const v of band) { x.beginPath(); x.moveTo(X(v), pt - 4); x.lineTo(X(v), pt + ph); x.stroke() } x.setLineDash([]) }
  axes(x, X, pl, pt, pw, ph, mu, a.type === 'measure' ? [lo, (lo + hi) / 2, hi] : [0, lim!, 100], a.type === 'measure', mx);
}
