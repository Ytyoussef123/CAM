/* PROGRAM step 4 · Learn: folders of OK and NG pictures, each one triggered like a part, judged, then learned. */
import type { Label, Program } from './types';
import { FLOOR, sleep, pause, toBlob, thumbOf, shortPath, plural } from './util';
import { P, U, learning, render, flashMsg } from './state';
import { checks, refTool } from './tools';
import { grid, areaGray, maskOf, findPos, refKey } from './analysis';
import { learnAll, inspect, refGray, sGray, noiseOf } from './learning';
import { makeFrame } from './source';
import { save } from './storage';
import { stopRun, flash } from './actions';
import { ask } from './dialog';
import { resetView } from './view';
import { FT, ftCollect, ftLabel, type PathFile } from './folderTest';
import { REP } from './repeat';

export const LB_KEEP = 50; // at most this many OK (and NG) examples per area: learning time grows with the square of the examples
export interface LbItem { file: PathFile; path: string; plan?: Set<number>; odd?: Set<number>; found?: boolean; err?: boolean }
export interface Batch {
  pid: number; kind: Label; name: string; items: LbItem[]; skipped: number; n: number; i: number; prep: number;
  phase: 'wait' | 'start' | 'prep' | 'plan' | 'play' | 'done' | 'stopped' | 'cancel';
  learned: number; similar: number; odd: { it: LbItem; areas: number[] }[]; none: { it: LbItem }[]; notFound: LbItem[];
  forced: number; full: number; err: number; measOnly: number; perArea: Record<number, number>; curPath?: string; curNote?: string;
}
export const LB: { run: boolean; queue: Batch[]; cur: Batch | null; log: Batch[]; prog: Program | null; loop: Promise<void> | null } =
  { run: false, queue: [], cur: null, log: [], prog: null, loop: null };
/** Stops learning; what was learned so far is kept. */
export function lbStop() { LB.run = false; LB.queue = [] }
export const okCount = (id: number) => P ? P.samples.filter(s => s.labels[id] === 'ok').length : 0;
export const ngCount = (id: number) => P ? P.samples.filter(s => s.labels[id] === 'ng').length : 0;
export const areaNames = (ids: number[]) => ids.map(id => { const a = P.areas.find(t => t.id === id); return a ? a.name : '?' }).join(', ');
function newSampleId() { let id = Date.now(); while (P.samples.some(s => s.id === id)) id++; return id }
/** A coarse copy (long side ≤ 48 points) used to compare many pictures quickly. */
function small(g: Float32Array, gw: number, gh: number) {
  const k = Math.max(1, Math.ceil(Math.max(gw, gh) / 48)), w = Math.ceil(gw / k), h = Math.ceil(gh / k), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let j = y * k; j < Math.min(gh, (y + 1) * k); j++) for (let i = x * k; i < Math.min(gw, (x + 1) * k); i++) { s += g[j * gw + i]; n++ }
    o[y * w + x] = s / n;
  }
  return o;
}
const lbAlive = () => LB.run && P === LB.prog;
/** Learning is possible once the master and at least one area exist. */
export const lbReady = () => !!(P && P.ref && checks().length);

/** A folder (or pictures) for OK or NG: it waits in line, OK folders before NG folders. */
export async function lbAdd(list: PathFile[], kind: Label) {
  if (!lbReady()) { flashMsg('Register the master and add at least one area first (steps 2 and 3).'); return }
  if (FT.run || REP.run) { flashMsg('Wait for the folder test or the repeatability test to finish first.'); return }
  const all = ftCollect(list), opp = kind === 'ok' ? 'ng' : 'ok';
  const items: LbItem[] = all.filter(x => ftLabel(x.path) !== opp), skipped = all.length - items.length;
  if (!items.length) {
    flashMsg(all.length ? `All these pictures are in ${kind === 'ok' ? 'defect' : 'good'} folders: choose a folder of ${kind === 'ok' ? 'good' : 'defective'} pictures.` :
      'No pictures found (PNG, JPG, BMP or WebP). Defect masks in "ground_truth" or "mask" folders are skipped.'); return;
  }
  const roots = [...new Set(items.map(x => x.path.includes('/') ? x.path.split('/')[0] : ''))];
  const name = roots[0] ? roots[0] + (roots.length > 1 ? ` + ${roots.length - 1} more` : '') : `${items.length} picture${plural(items.length)}`;
  const b: Batch = { pid: P.id, kind, name, items, skipped, n: items.length, i: 0, prep: 0, phase: 'wait', learned: 0, similar: 0, odd: [], none: [], notFound: [], forced: 0, full: 0, err: 0, measOnly: 0, perArea: {} };
  if (kind === 'ok') { const k = LB.queue.findIndex(x => x.kind === 'ng'); if (k < 0) LB.queue.push(b); else LB.queue.splice(k, 0, b) } else LB.queue.push(b);
  if (LB.run) { flashMsg(`${kind.toUpperCase()} folder "${name}" (${items.length} pictures) waits in line.`); render(); return }
  if (LB.loop) await LB.loop; // after a Stop, the previous run finishes its picture first
  if (!LB.run && LB.queue.length) LB.loop = lbRun();
}
async function lbRun() {
  if (LB.run) return;
  LB.run = true; LB.prog = P; stopRun(); REP.run = false; U.only = null; U.drag = null; resetView(); render();
  while (lbAlive() && LB.queue.length) {
    const b = LB.queue.shift()!; LB.cur = b; b.phase = 'start'; render();
    if (learning) await learning;
    if (b.kind === 'ng') { // NG learned on top of too few good pictures: normal differences would be taken for defects
      const few = checks().filter(a => okCount(a.id) < 4), m = Math.min(...few.map(a => okCount(a.id)));
      if (few.length && !await ask(`${few.map(a => a.name).join(', ')} ${few.length === 1 ? 'knows' : 'know'} only ${m} good picture${plural(m)} besides the master. ` +
        'With so few, normal differences between good parts look like defects, and areas without the defect could be learned as NG. Learn an OK folder first?', { ok: 'Learn NG anyway', cancel: 'Not now', safe: true })) {
        b.phase = 'cancel'; LB.log.unshift(b); continue;
      }
    }
    if (b.kind === 'ok') await lbPlanOk(b);
    if (lbAlive()) await lbPlay(b);
    b.phase = lbAlive() ? 'done' : 'stopped';
    LB.log.unshift(b); if (LB.log.length > 6) LB.log.pop();
    if (P === LB.prog) save();
    flashMsg(`${b.kind.toUpperCase()} folder "${b.name}": ${b.i} of ${b.n} pictures shown, ${b.learned} learned.` + (b.phase === 'stopped' ? ' Stopped: what was learned so far is kept.' : '') +
      (b.odd.length + b.none.length ? ` ⚠ ${b.odd.length + b.none.length} to check: see the list.` : ''));
  }
  LB.run = false; LB.cur = null; LB.loop = null; render();
}
/** A quick look at every picture first: leave out the odd ones, keep the ones that bring something new. */
async function lbPlanOk(b: Batch) {
  b.phase = 'prep'; b.prep = 0; render();
  const A = checks(), rt = refTool(), cand: { it: LbItem; sm: Record<number, Float32Array> }[] = [];
  for (const it of b.items) {
    if (!lbAlive()) return;
    it.plan = new Set(); it.odd = new Set();
    let bmp: ImageBitmap | null = null; try { bmp = await createImageBitmap(it.file) } catch (e) { it.err = true; b.prep++; continue }
    const f = makeFrame(bmp); bmp.close();
    const pos = findPos(f.full, f.size), off = pos.found ? { dx: pos.dx, dy: pos.dy } : { dx: 0, dy: 0 }, sm: Record<number, Float32Array> = {};
    it.found = pos.found || !rt;
    for (const a of A) { const { gw, gh } = grid(a); sm[a.id] = small(areaGray(f.full, f.size, a, off), gw, gh) }
    if (it.found) cand.push({ it, sm }); b.prep++;
    if (b.prep % 4 === 0) { render(); await sleep(0) }
  }
  b.phase = 'plan'; render(); await sleep(0);
  for (const a of A) { // per area: leave out the odd pictures, then the most different ones first (farthest first)
    const { gw, gh } = grid(a), k = Math.max(1, Math.ceil(Math.max(gw, gh) / 48)), w = Math.ceil(gw / k), h = Math.ceil(gh / k), mk = maskOf(a, w, h), len = w * h, n = cand.length;
    if (!n) break;
    const dist = (x: Float32Array, y: Float32Array) => { let m = 0; for (let i = 0; i < len; i++) { if (mk && !mk[i]) continue; const d = Math.abs(x[i] - y[i]); if (d > m) m = d } return m / FLOOR };
    const med = new Float32Array(len), buf = new Float32Array(n);
    for (let i = 0; i < len; i++) { for (let j = 0; j < n; j++) buf[j] = cand[j].sm[a.id][i]; buf.sort(); med[i] = n % 2 ? buf[n >> 1] : (buf[(n >> 1) - 1] + buf[n >> 1]) / 2 }
    const dm = cand.map(c => dist(c.sm[a.id], med)), srt = [...dm].sort((p, q) => p - q), m = srt[n >> 1] || 0, mad = srt.map(v => Math.abs(v - m)).sort((p, q) => p - q)[n >> 1] || 0;
    const lim = m + Math.max(4 * 1.4826 * mad, 3); // much farther from the typical picture than the others: probably not a good part
    const ok: typeof cand = []; cand.forEach((c, i) => { if (n >= 8 && dm[i] > lim) c.it.odd!.add(a.id); else ok.push(c) });
    const known = [small(refGray(a), gw, gh)]; for (const s of P.samples) { const g = sGray(s, a); if (s.labels[a.id] === 'ok' && g) known.push(small(g, gw, gh)) }
    const dmin = ok.map(c => Math.min(...known.map(g => dist(c.sm[a.id], g)))), room = Math.max(0, LB_KEEP - okCount(a.id)); let nSel = 0;
    while (nSel < room) {
      let bi = -1, bd = noiseOf(a); for (let i = 0; i < ok.length; i++) if (dmin[i] > bd) { bd = dmin[i]; bi = i }
      if (bi < 0) break; // every remaining picture is within camera noise of one already kept: nothing new to learn
      const c = ok[bi]; c.it.plan!.add(a.id); nSel++; dmin[bi] = -1; for (let i = 0; i < ok.length; i++) if (dmin[i] > 0) dmin[i] = Math.min(dmin[i], dist(ok[i].sm[a.id], c.sm[a.id]));
    }
    if (nSel >= room && room < ok.length) b.full++;
    await sleep(0);
  }
}
/** Each picture like a trigger on the line: shown with its judgment, then learned. */
async function lbPlay(b: Batch) {
  b.phase = 'play'; b.i = 0; render();
  for (const it of b.items) {
    if (!lbAlive()) return;
    const T = (+U.lPer || 0) * 1000;
    if (b.i > 0) { if (T) await pause(T / 2, lbAlive); else await sleep(0) }
    if (!lbAlive()) return;
    b.i++;
    if (it.err) { b.err++; continue }
    let bmp: ImageBitmap | null = null; try { bmp = await createImageBitmap(it.file) } catch (e) { b.err++; continue }
    const f = makeFrame(bmp); bmp.close();
    if (learning) await learning;
    const t0 = performance.now(), r = inspect(f), dt = performance.now() - t0;
    const meta = { idx: b.i, n: b.n, path: it.path, expect: b.kind, agree: (b.kind === 'ng') === !!r.ng, learn: b.kind, note: '' };
    U.last = { frame: f, r, dt, labels: Object.fromEntries(r.res.map(x => [x.id, x.ng ? 'ng' : 'ok'])) as Record<number, Label>, ts: Date.now(), learned: false, test: true, ft: it.path, meta };
    U.mode = 'result'; U.view = null; b.curPath = it.path; b.curNote = '';
    if (T) flash(); render();
    if (T) await pause(T / 2, lbAlive); else await sleep(0);
    if (!lbAlive()) return; // stopped before this picture was learned: it is not
    const dec = b.kind === 'ok' ? lbDecideOk(b, it) : lbDecideNg(b, it, r);
    if (dec.labels) {
      const cache: Record<string, Float32Array> = {}; for (const x of r.res) if (dec.labels[x.id]) cache[x.key] = x.gray;
      P.samples.push({ id: newSampleId(), blob: await toBlob(f.full), thumb: thumbOf(f.full), labels: dec.labels, cache, off: { key: refKey(), dx: r.off.dx, dy: r.off.dy } });
      b.learned++; for (const id in dec.labels) b.perArea[id] = (b.perArea[id] || 0) + 1;
      U.last.learned = true; U.last.labels = { ...U.last.labels, ...dec.labels };
      meta.note = dec.note; b.curNote = dec.note;
      await learnAll(); save();
    } else { meta.note = dec.note; b.curNote = dec.note }
    render();
  }
}
type Decision = { labels?: Record<number, Label>; note: string };
function lbDecideOk(b: Batch, it: LbItem): Decision {
  if (!it.found) { b.notFound.push(it); return { note: 'position reference not found: not learned' } }
  const Lr = [...it.plan!], O = [...it.odd!];
  if (O.length) b.odd.push({ it, areas: O });
  if (Lr.length) return { labels: Object.fromEntries(Lr.map(id => [id, 'ok'])) as Record<number, Label>, note: `learned as OK ✓ (${areaNames(Lr)})` + (O.length ? ` · ⚠ not in ${areaNames(O)}: looks different there` : '') };
  if (O.length) return { note: `⚠ looks very different from the other good pictures (${areaNames(O)}): not learned — check it` };
  b.similar++; return { note: 'like pictures already learned: nothing new, not stored' };
}
function lbDecideNg(b: Batch, it: LbItem, r: ReturnType<typeof inspect>): Decision {
  if (refTool() && !r.pos.found) { b.notFound.push(it); return { note: 'position reference not found: not learned' } }
  const v = U.lNgArea, forced = v === 'auto' ? null : +v, res = (id: number) => r.res.find(x => x.id === id);
  let tgt = forced != null ? checks().filter(a => a.id === forced && res(a.id)) : checks().filter(a => res(a.id) && res(a.id)!.ng);
  if (!tgt.length) {
    const mm = r.meas.filter(m => !m.ok).map(m => m.name);
    if (mm.length) { b.measOnly++; return { note: `seen only by ${mm.join(', ')} (measures do not learn): nothing to learn` } }
    b.none.push({ it }); return { note: '⚠ no area sees a defect (every score is above its limit): not learned — check it' };
  }
  const full = tgt.filter(a => ngCount(a.id) >= LB_KEEP); tgt = tgt.filter(a => ngCount(a.id) < LB_KEEP);
  const same = tgt.filter(a => res(a.id)!.nearNg && res(a.id)!.dev === 0); tgt = tgt.filter(a => !same.includes(a));
  if (!tgt.length) {
    if (full.length) { b.full++; return { note: `not stored: ${full.map(a => a.name).join(', ')} already ${full.length === 1 ? 'has' : 'have'} ${LB_KEEP} NG examples` } }
    b.similar++; return { note: 'the same as an NG picture already learned: not stored' };
  }
  const high = forced != null && !res(forced)!.ng; if (high) b.forced++;
  return {
    labels: Object.fromEntries(tgt.map(a => [a.id, 'ng'])) as Record<number, Label>,
    note: `learned as NG ✓ (${tgt.map(a => a.name).join(', ')})` + (high ? ` · it scored ${res(forced!)!.score}, above the limit: taught NG because you chose ${tgt[0].name}` : ''),
  };
}
/** The line under the progress bar while a folder is learned. */
export function lbNowTxt(b: Batch) {
  const head = `${b.kind.toUpperCase()} folder "${b.name}" — `;
  if (b.phase === 'prep') return head + `looking at every picture first… ${b.prep}/${b.n}`;
  if (b.phase === 'plan') return head + 'choosing the pictures that bring something new…';
  if (b.phase === 'play') return head + `picture ${b.i} of ${b.n}: ${shortPath(b.curPath || '')}` + (b.curNote ? ` → ${b.curNote}` : ' → judged, learning…');
  return head + 'starting…';
}
/** Share of the current folder already done (progress bar). */
export const lbFrac = (b: Batch) => b.phase === 'prep' || b.phase === 'plan' ? b.prep / b.n : b.i / b.n;
