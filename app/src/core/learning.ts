/* ---------- learning by examples ----------
   Each area remembers its taught OK and NG pictures. A new picture is compared with every example:
   the closest OK example gives the score, so a picture identical to a taught OK example scores 100
   (differences below the camera noise count as identical). When NG examples exist, a picture closer
   to an NG example than to any OK example is pulled down: identical to a taught NG example scores 0. */
import type { Tool, Sample, Frame, InspectResult, MeasResult, Margin, AuditFlag, AreaResult } from './types';
import { FLOOR, DEF_THR, BAND } from './util';
import { P, U, learning, setLearning, render } from './state';
import { checks, measures, refTool, limOf, match, devAt, mTol, worstOf } from './tools';
import { grid, gKey, refKey, areaGray, maskOf, blurWH, findPos, measureTool } from './analysis';

export function refGray(a: Tool): Float32Array { const ref = P.ref!, k = gKey(a); return ref.cache[k] || (ref.cache[k] = areaGray(ref.full, ref.size, a, null)) }
export const sGray = (s: Sample, a: Tool): Float32Array | undefined => s.cache[gKey(a)];
/** Learned pictures are cut again when tools move, turn or change size. */
async function ensureGrays() {
  const rk = refKey();
  for (const s of P.samples) {
    const miss = checks().filter(a => s.labels[a.id] && !s.cache[gKey(a)]); if (!miss.length) continue; // only the areas this picture teaches
    let bmp: ImageBitmap | null = null; try { bmp = await createImageBitmap(s.blob) } catch (e) { continue }
    if (!s.off || s.off.key !== rk) { const f = findPos(bmp, bmp.width); s.off = { key: rk, dx: f.found ? f.dx : 0, dy: f.found ? f.dy : 0 } }
    for (const a of miss) s.cache[gKey(a)] = areaGray(bmp, bmp.width, a, s.off);
    bmp.close();
  }
}
// sensitivity of an area: differences under "noise" (in noise units) count as the same picture; "scale" sets how fast the score drops
const SENS = { low: { noise: 1.5, scale: 1.5 }, normal: { noise: 1, scale: 1 }, high: { noise: .25, scale: .6 } };
const sensOf = (a: Tool) => SENS[a.sens || 'normal'] || SENS.normal;
export const noiseOf = (a: Tool) => sensOf(a).noise;
const eff = (d: number, nz: number) => Math.max(0, d - nz);
function devMap(g: Float32Array, e: Float32Array, sd: Float32Array, gw: number, gh: number) { const n = gw * gh, d = new Float32Array(n); for (let i = 0; i < n; i++) d[i] = Math.abs(g[i] - e[i]) / sd[i]; return blurWH(d, gw, gh, 1) }
function devMax(m: Float32Array, mk: Uint8Array | null) { let mx = 0; for (let i = 0; i < m.length; i++) if ((!mk || mk[i]) && m[i] > mx) mx = m[i]; return mx }
function relScore(dOk: number, dNg: number | null, s: number) { let sc = match(dOk, s); if (dNg != null) sc = Math.min(sc, dOk + dNg > 0 ? 100 * dNg / (dOk + dNg) : 50); return sc }
/** A new picture against the learned examples of the area. */
function scoreArea(a: Tool, g: Float32Array) {
  const M = a._m!, { gw, gh } = grid(a), mk = maskOf(a, gw, gh), nz = noiseOf(a);
  let bi = -1, bd = Infinity, bm = null as Float32Array | null;
  M.ok.forEach((e, i) => { const m = devMap(g, e, M.sd, gw, gh), d = devMax(m, mk); if (d < bd) { bd = d; bi = i; bm = m } });
  let dNg = null as number | null, ni = -1; M.ng.forEach((e, i) => { const d = eff(devMax(devMap(g, e, M.sd, gw, gh), mk), nz); if (dNg == null || d < dNg) { dNg = d; ni = i } });
  const dOk = eff(bd, nz), byNg = dNg != null && dNg < dOk; // closer to a taught NG picture than to any OK one
  return { score: Math.round(relScore(dOk, dNg, a.thr!)), dev: byNg ? dNg! : dOk, map: bm, near: byNg ? M.ngSrc[ni] : M.okSrc[bi], nearNg: byNg };
}
export function learnArea(a: Tool) {
  const { gw, gh } = grid(a), n = gw * gh, mk = maskOf(a, gw, gh), nz = noiseOf(a);
  const ok = [refGray(a)], okSrc: (number | 'ref')[] = ['ref'], ng: Float32Array[] = [], ngSrc: number[] = [];
  for (const s of P.samples) { const g = sGray(s, a); if (!g) continue; if (s.labels[a.id] === 'ok') { ok.push(g); okSrc.push(s.id) } else if (s.labels[a.id] === 'ng') { ng.push(g); ngSrc.push(s.id) } }
  // normal variation per point, from the OK examples: a median-based spread, so one odd (or wrongly taught) example
  // cannot make a defect look "normal"; never below FLOOR
  const sd = new Float32Array(n).fill(FLOOR);
  if (ok.length > 1) {
    const k = ok.length, h = k >> 1, buf = new Float32Array(k), dev = new Float32Array(k), med = (b: Float32Array) => { b.sort(); return k % 2 ? b[h] : (b[h - 1] + b[h]) / 2 };
    for (let i = 0; i < n; i++) { for (let j = 0; j < k; j++) buf[j] = ok[j][i]; const m = med(buf); for (let j = 0; j < k; j++) dev[j] = Math.abs(ok[j][i] - m); sd[i] = Math.max(1.4826 * med(dev), FLOOR) }
  }
  // distance between every pair of examples (each pair once)
  const all = ok.concat(ng), N = all.length, nO = ok.length, Dm = Array.from({ length: N }, () => new Float32Array(N));
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { const d = eff(devMax(devMap(all[i], all[j], sd, gw, gh), mk), nz); Dm[i][j] = Dm[j][i] = d }
  const minOver = (i: number, from: number, to: number) => { let m: number | null = null; for (let j = from; j < to; j++) if (j !== i && (m == null || Dm[i][j] < m)) m = Dm[i][j]; return m };
  const looOk = nO > 1 ? ok.map((_, k) => minOver(k, 0, nO)!) : [];   // each OK example against the other OK examples
  const ngToOk = ng.map((_, k) => minOver(nO + k, 0, nO)!);           // each NG example against the OK examples
  const maxOk = looOk.length ? Math.max(...looOk) : null, minNg = ngToOk.length ? Math.min(...ngToOk) : null;
  // the scale is the distance that scores 50: placed between the OK and the NG examples
  let s: number;
  if (minNg != null && maxOk != null) s = minNg > maxOk ? Math.min(Math.max((maxOk + minNg) / 2, maxOk + 2), minNg * .9) : minNg * .95;
  else if (minNg != null) s = Math.min(DEF_THR, minNg * .6);
  else if (maxOk != null) s = Math.max(maxOk * 1.25, maxOk + 2, DEF_THR); // teaching OK examples never makes the area stricter
  else s = DEF_THR;
  a.thr = a.auto = Math.max(1, Math.round(s * sensOf(a).scale * 10) / 10);
  if (a._legacyThr != null) { a.limit = Math.round(Math.max(0, Math.min(100, match(eff(a._legacyThr, nz), a.thr)))); delete a._legacyThr }
  if (a.limit == null) a.limit = 50;
  a._m = { ok, ng, sd, okSrc, ngSrc }; a._k = gKey(a);
  // how the examples score when each one is judged without itself (how well the area tells OK from NG)
  const okSc = looOk.map((d, k) => relScore(d, ng.length ? minOver(k, nO, N) : null, a.thr!));
  const ngSc = ng.map((_, k) => relScore(ngToOk[k], ng.length > 1 ? minOver(nO + k, nO, N) : null, a.thr!));
  const okLow = okSc.length ? Math.min(...okSc) : null, ngHigh = ngSc.length ? Math.max(...ngSc) : null;
  a.stats = { nOk: nO, nNg: ng.length, okLow, ngHigh, overlap: okLow != null && ngHigh != null && okLow <= ngHigh };
  a._loo = { ok: okSrc.map((id, k): [number | 'ref', number | null] => [id, okSc.length ? okSc[k] : null]), ng: ngSrc.map((id, k): [number, number] => [id, ngSc[k]]) };
}
/** Safety margin: how far the taught examples (each judged without itself) are from the limit. */
export function marginOf(a: Tool): Margin | null {
  const st = a.stats; if (!st) return null; const L = limOf(a), ms: number[] = [];
  if (st.okLow != null) ms.push(st.okLow - L); if (st.ngHigh != null) ms.push(L - st.ngHigh);
  if (!ms.length) return { v: null, cls: 'none' };
  const v = Math.round(Math.min(...ms));
  return {
    v, cls: v >= 20 ? 'good' : v >= BAND ? 'fair' : 'risk', okOnly: st.ngHigh == null, ngOnly: st.okLow == null,
    mid: st.okLow != null && st.ngHigh != null && st.okLow > st.ngHigh ? Math.round((st.okLow + st.ngHigh) / 2) : null,
  };
}
export const marginTxt = (m: Margin | null) => !m || m.v == null ? 'margin: teach a few examples to know it' :
  `${m.cls === 'good' ? 'good' : m.cls === 'fair' ? 'small' : 'risky'} margin: ${m.v} points` + (m.okOnly ? ' (OK side only — no NG example taught)' : m.ngOnly ? ' (NG side only)' : '');
/** Learned pictures that disagree with their label when judged by the others: possible teaching mistakes. */
export function audit(): Record<string, AuditFlag[]> {
  const out: Record<string, AuditFlag[]> = {}, add = (id: number | 'ref', t: AuditFlag) => (out[id] = out[id] || []).push(t);
  for (const a of checks()) {
    const L = limOf(a), lo = a._loo; if (!lo || !a._m) continue;
    if (a._m.ok.length >= 3) for (const [id, sc] of lo.ok) if (sc != null && Math.round(sc) < L) add(id, { area: a.name, lab: 'OK', score: Math.round(sc) });
    if (a._m.ok.length >= 2) for (const [id, sc] of lo.ng) if (sc != null && Math.round(sc) >= L) add(id, { area: a.name, lab: 'NG', score: Math.round(sc) });
  }
  return out;
}
export const measMarg = (m: Tool, r: MeasResult) => m.nom != null && !!r.found && Math.abs(Math.abs(r.value! - m.nom) - mTol(m)) < .2 * mTol(m);
/** Learns every area again (async because learned pictures may need to be decoded again). */
export function learnAll(): Promise<void> {
  if (!P || !P.ref) return Promise.resolve();
  const run = (async () => { await ensureGrays(); if (!P || !P.ref) return; checks().forEach(learnArea); if (U.last) U.last.r = inspect(U.last.frame) })();
  setLearning(run); run.then(() => { if (learning === run) setLearning(null); render() }); render(); return run;
}
/** Judges one picture with every tool. */
export function inspect(f: Frame): InspectResult {
  const pos = findPos(f.full, f.size), o = pos.found ? pos : { dx: 0, dy: 0 };
  const res: AreaResult[] = checks().map(a => {
    if (!a._m || a._k !== gKey(a)) learnArea(a);
    const g = areaGray(f.full, f.size, a, o), r = scoreArea(a, g), lim = limOf(a), { gw, gh } = grid(a);
    return {
      id: a.id, name: a.name, dev: r.dev, score: r.score, limit: lim, ng: r.score < lim, marg: Math.abs(r.score - lim) < BAND, dlim: devAt(lim, a.thr!) + noiseOf(a),
      map: r.map, gw, gh, gray: g, key: a._k!, near: r.near, nearNg: r.nearNg,
    };
  });
  const meas = measures().map(m => { const r: MeasResult = { id: m.id, name: m.name, ...measureTool(f.full, f.size, m, o) }; r.marg = measMarg(m, r); return r });
  const rt = refTool(); if (rt && !pos.none) pos.marg = Math.abs(Math.round(pos.score * 100) - (rt.minScore || 60)) < BAND;
  return {
    res, meas, pos, off: o, worst: worstOf(res), ng: !pos.found || res.some(r => r.ng) || meas.some(r => !r.ok),
    marg: !!pos.marg || res.some(r => r.marg) || meas.some(r => r.marg!),
  };
}
/** Applies changed limits to a result without measuring again. */
export function rejudge(R: InspectResult | null) {
  if (!R || !P) return;
  const rt = refTool(); if (rt && R.pos && !R.pos.none) { const v = Math.round(R.pos.score * 100), L = rt.minScore || 60; R.pos.found = v >= L; R.pos.marg = Math.abs(v - L) < BAND }
  for (const x of R.res) { const a = P.areas.find(t => t.id === x.id); if (!a) continue; x.limit = limOf(a); x.ng = x.score < x.limit; x.marg = Math.abs(x.score - x.limit) < BAND; x.dlim = devAt(x.limit, a.thr!) + noiseOf(a) }
  for (const m of R.meas) { const a = P.areas.find(t => t.id === m.id); if (a) { m.ok = !!m.found && (a.nom == null || Math.abs(m.value! - a.nom) <= mTol(a)); m.marg = measMarg(a, m) } }
  R.worst = worstOf(R.res); R.ng = !R.pos.found || R.res.some(x => x.ng) || R.meas.some(m => !m.ok); R.marg = !!R.pos.marg || R.res.some(x => x.marg) || R.meas.some(m => m.marg!);
}
