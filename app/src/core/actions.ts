/* What the buttons do: program steps, master image, tools, trigger, teaching, pages. */
import type { Tool, Sample, Label, InspectResult, Cam } from './types';
import { DEF_THR, CONFLICT, store, thumbOf, toBlob } from './util';
import { P, U, DOM, learning, render, flashMsg } from './state';
import { checks, measures, refTool, isCheck, toolBox } from './tools';
import { fmtLen, measureTool, refKey } from './analysis';
import { learnAll, inspect, rejudge, marginOf } from './learning';
import { V, clampView, resetView } from './view';
import { grab } from './source';
import { save, newProg, loadProg, deleteProg } from './storage';
import { sendCam } from './link';
import { ask } from './dialog';
import { drawScreen } from './draw';
import { FT } from './folderTest';
import { LB, lbStop } from './folderLearn';

/* ---------- PROGRAM steps ---------- */
export const STEPS: Record<number, { t: string; h: string }> = {
  1: { t: 'Image', h: 'Choose the camera and frame the part. The camera zoom and position are saved in the program.' },
  2: { t: 'Master', h: 'Put one good part in its exact position and register it as the master image: everything else is set on it.' },
  3: { t: 'Tools', h: 'Add inspection tools on the master image, place them and set their limits. Select a tool in the list to change it.' },
  4: { t: 'Learn', h: 'Teach the areas with folders of good (OK) and defective (NG) pictures: each one is triggered, judged, then learned. Optional: you can go on to step 5.' },
  5: { t: 'Outputs', h: 'Choose what the two outputs signal, then finish: the program goes to RUN.' },
};
export const stepDone = (n: number) => !P ? false : n === 1 ? true : n === 2 ? !!P.ref : n === 3 ? !!(P.ref && (checks().length || measures().length)) : n === 4 ? P.samples.length > 0 : !!P.valid;
export const stepOk = (n: number) => n <= 2 || (n === 3 ? !!(P && P.ref) : !!(P && P.ref && (checks().length || measures().length)));
/** What the image shows follows the step: live to frame, master, tools to edit, learned pictures, master with outputs. */
export function setStep(n: number) {
  if (LB.run) return; // the steps stay put while folders are learned
  n = Math.max(1, Math.min(5, n || 1)); while (n > 1 && !stepOk(n)) n--;
  U.step = n; stopRun(); U.only = null; U.drag = null; U.addMenu = false;
  if (n === 2) U.mode = U.cand ? 'cand' : 'live'; else if (n === 3) U.mode = 'edit';
  else if (n === 4) U.mode = U.last && U.last.meta && U.last.meta.learn ? 'result' : 'master'; else if (n === 5) U.mode = 'master'; else U.mode = 'live';
  resetView(); render();
}
export function stepNext() {
  const n = (U.step || 1) + 1;
  if (!stepOk(n)) { flashMsg(n === 3 ? 'Register the master image first (press 📷 Register master).' : 'Add at least one area or measure first (＋ Add tool).'); return }
  if (LB.run) return;
  setStep(n);
}
export function stepBack() { setStep((U.step || 1) - 1) }
/** ⚙ PROGRAM (5 steps: image, master, tools, learn, outputs) or ▶ RUN (inspect, statistics, teach). */
export function setPage(p: 'prog' | 'run') {
  U.page = p; store('vs1-page', p); if (p !== 'run') FT.run = false; else lbStop(); // leaving a page stops what runs on it
  if (p === 'run') { if (U.mode === 'edit' || U.mode === 'cand' || U.mode === 'master') { U.mode = 'live'; U.cand = null } U.only = null; U.drag = null; resetView(); render() }
  else { stopRun(); setStep(U.step || (P && P.ref ? 3 : 1)) }
}

/* ---------- programs ---------- */
export function newProgram() { stopRun(); newProg(); setStep(1) }
export async function openProgram(id: number) { await loadProg(id); if (U.page === 'prog') setStep(P && P.ref ? 3 : 1) }
export async function deleteProgram() {
  if (!P || !await ask(`Delete program "${P.name}"? Its reference and learned images are deleted too.`, { ok: 'Delete' })) return;
  await deleteProg(); if (U.page === 'prog') setStep(P && P.ref ? 3 : 1); else render();
}
export function renameProgram(v: string) { if (!P) return; P.name = v.trim() || P.name; save(); render() }
export function setCam(k: keyof Cam, v: number) { P.cam[k] = v; sendCam(); save(); render() }
export async function changeZoom() {
  if (!await ask('Changing the camera zoom needs a new reference. The reference and the learned images will be cleared (areas are kept). Continue?')) return;
  P.ref = null; P.samples = []; P.valid = false; U.mode = 'live'; U.last = null; save(); render();
}

/* ---------- master image ---------- */
export async function takeRef() { stopRun(); const f = await grab(); if (!f) return; U.cand = f; U.mode = 'cand'; U.only = null; resetView(); flash(); render() }
export async function refValid() {
  const f = U.cand; if (!f) return; U.cand = null;
  P.ref = { full: f.full, size: f.size, thumb: thumbOf(f.full), blob: await toBlob(f.full), cache: {} };
  const had = P.areas.length; P.samples = []; P.valid = false;
  if (!had) addArea('rect', false);
  save(); learnAll(); setStep(3);
  flashMsg(had ? 'New reference saved. Tools kept, learned images cleared.' : 'Reference saved. Step 2: move and resize Area 1, add more tools.');
}

/* ---------- tools ---------- */
export const nextId = () => P.areas.reduce((m, a) => Math.max(m, a.id), 0) + 1;
/** "Screw 1" → "Screw 2" (the next free number). */
function nextName(name: string) {
  const names = new Set(P.areas.map(a => a.name)), m = /^(.*?)(\d+)\s*$/.exec(name);
  if (m) { let n = +m[2] + 1; while (names.has(m[1] + n)) n++; return m[1] + n }
  let n = 2; while (names.has(`${name} ${n}`)) n++; return `${name} ${n}`;
}
function addTool(a: Tool) { P.areas.push(a); U.selArea = a.id; P.valid = false; U.mode = 'edit'; U.only = null; resetView() }
export function addArea(shape: 'rect' | 'ellipse', r = true) {
  const id = nextId(), o = (P.areas.length % 4) * .04, s = shape === 'ellipse' ? .2 : .3;
  addTool({ id, type: 'check', name: `Area ${id}`, shape, x0: .5 - s / 2 + o, y0: .5 - s / 2 + o, x1: .5 + s / 2 + o, y1: .5 + s / 2 + o, ang: 0, thr: DEF_THR, limit: 50, detail: 'auto' });
  if (r) { save(); learnAll() }
}
export function addMeasure() {
  const id = nextId(), o = (P.areas.length % 4) * .04;
  addTool({ id, type: 'measure', name: `Measure ${id}`, x0: .38, y0: .5 + o, x1: .62, y1: .5 + o, band: .03, contrast: 25, edges: 'outer', nom: null, tol: null }); save(); render();
}
export function addRef() {
  const r = refTool(); if (r) { editOnly(r); return }
  addTool({ id: nextId(), type: 'ref', name: 'Position', x0: .4, y0: .4, x1: .6, y1: .6, range: 20, minScore: 60 }); save(); learnAll();
}
/** A duplicate next to the original, e.g. one window per screw. */
export function copyTool(a: Tool) {
  if (a.type === 'ref') return;
  const c = {} as Tool; for (const k in a) if (k[0] !== '_' && k !== 'stats' && k !== 'auto') (c as unknown as Record<string, unknown>)[k] = a[k as keyof Tool];
  c.id = nextId(); c.name = nextName(a.name);
  const b = toolBox(a), dx = b.x1 + .06 <= 1 ? .06 : -.06; c.x0 += dx; c.x1 += dx;
  P.areas.push(c); U.selArea = c.id; U.only = null; U.mode = 'edit'; P.valid = false; save();
  flashMsg(`${c.name} created next to ${a.name}. Drag it into place.`);
  if (isCheck(c)) learnAll(); else render();
}
export function delArea(a: Tool) { P.areas = P.areas.filter(x => x !== a); for (const s of P.samples) delete s.labels[a.id]; delete U.hist[a.id]; if (U.only === a.id) U.only = null; P.valid = false; save(); learnAll() }
export const selTool3 = (): Tool | null => P ? P.areas.find(a => a.id === U.selArea) || null : null;
export async function delSel() { const a = selTool3(); if (a && await ask(`Delete ${a.name}?`, { ok: 'Delete' })) delArea(a) }
/** Edits one tool alone, zoomed on it. */
export function editOnly(a: Tool) {
  if (U.only === a.id) { U.only = null; resetView(); render(); return }
  stopRun(); U.only = a.id; U.selArea = a.id; U.mode = 'edit';
  const b = toolBox(a), w = Math.max(.02, b.x1 - b.x0), h = Math.max(.02, b.y1 - b.y0);
  V.z = Math.min(8, Math.max(1, .6 / Math.max(w, h))); V.cx = (b.x0 + b.x1) / 2; V.cy = (b.y0 + b.y1) / 2; clampView(); render();
}
export function measRef(m: Tool) { return P.ref ? measureTool(P.ref.full, P.ref.size, m, null) : null }
export function setNominal(m: Tool) {
  const r = measRef(m); if (!r || !r.found) { flashMsg(`${m.name}: no two edges found on the reference. Move the line across the gap, or lower the contrast.`); return }
  m.nom = r.value; m.tol = Math.max(2, r.value! * .05); save(); render(); flashMsg(`${m.name}: nominal ${fmtLen(m.nom)} ± ${fmtLen(m.tol)}`);
}
export async function calibrate(m: Tool) {
  const r = measRef(m); if (!r || !r.found) { flashMsg(`${m.name}: no edges found on the reference, cannot calibrate.`); return }
  const v = await ask(`${m.name} measures ${r.value!.toFixed(1)} px on the reference. What is its real length in mm?`, { input: '', ok: 'Calibrate' }); if (v == null) return;
  const mm = parseFloat(String(v).replace(',', '.')); if (!(mm > 0)) { flashMsg('Calibration cancelled: type a length in mm.'); return }
  P.scale = mm / r.value!; save(); render(); flashMsg(`Calibrated: 1 px = ${(P.scale * 1000).toFixed(1)} µm. All measures now in mm.`);
}
export async function validate() {
  if (!P.ref || !(checks().length || measures().length)) return;
  await learnAll(); P.valid = true; U.mode = 'live'; U.selArea = null; U.only = null; U.hist = {}; U.times = []; resetView(); save();
  setPage('run'); flashMsg('Program validated. Put a part and press Trigger.');
}

/* ---------- RUN: trigger, histogram history, teaching ---------- */
/** History for the histograms, and the processing time. */
function record(r: InspectResult, dt: number) {
  const push = (id: number, v: number | null) => { const h = U.hist[id] || (U.hist[id] = []); h.push(v); if (h.length > 2000) h.shift() };
  for (const x of r.res) push(x.id, x.score);
  for (const m of r.meas) push(m.id, m.found ? m.value : null);
  const rt = refTool(); if (rt && !r.pos.none) push(rt.id, Math.round(r.pos.score * 100));
  U.times.push(dt); if (U.times.length > 2000) U.times.shift();
}
export async function trigger() {
  if (!P || !P.valid || FT.run || LB.run) return;
  const f = await grab(); if (!f) return; if (learning) await learning;
  const t0 = performance.now(), r = inspect(f), dt = performance.now() - t0;
  if (r.ng) U.c.ng++; else U.c.ok++; if (r.marg) U.c.marg = (U.c.marg || 0) + 1; record(r, dt);
  U.last = { frame: f, r, dt, labels: Object.fromEntries(r.res.map(x => [x.id, x.ng ? 'ng' : 'ok'])) as Record<number, Label>, ts: Date.now(), learned: false };
  U.mode = 'result'; U.view = null; flash(); if (r.ng && navigator.vibrate) navigator.vibrate(150); render();
}
export async function learnLast(force: boolean) {
  const l = U.last; if (!l || l.learned) return;
  if (FT.run || LB.run) { flashMsg('Wait for the folder test or the learning from folders to finish (or stop it) before teaching.'); return }
  if (force !== true) { // a label far from what the sensor sees is often a teaching mistake: ask first
    const w = l.r.res.filter(r => { const lab = l.labels[r.id]; return lab === 'ok' && r.score <= r.limit - CONFLICT || lab === 'ng' && r.score >= r.limit + CONFLICT });
    if (w.length) { l.warn = w.map(r => ({ name: r.name, score: r.score, limit: r.limit, lab: l.labels[r.id] })); render(); return }
  }
  l.warn = null; l.learned = true; render();
  const cache: Record<string, Float32Array> = {}; for (const r of l.r.res) cache[r.key] = r.gray;
  P.samples.push({ id: Date.now(), blob: await toBlob(l.frame.full), thumb: thumbOf(l.frame.full), labels: { ...l.labels }, cache, off: { key: refKey(), dx: l.r.off.dx, dy: l.r.off.dy } });
  await learnAll(); save();
  const n = P.samples.length, warn = checks().filter(a => a.stats && a.stats.overlap).map(a => a.name);
  const sum = checks().filter(a => a.stats && (a.stats.okLow != null || a.stats.ngHigh != null)).map(a => `${a.name}: ` +
    (a.stats!.okLow != null ? `OK ≥ ${Math.round(a.stats!.okLow)}` : '') + (a.stats!.okLow != null && a.stats!.ngHigh != null ? ', ' : '') +
    (a.stats!.ngHigh != null ? `NG ≤ ${Math.round(a.stats!.ngHigh)}` : '')).join(' · ');
  flashMsg(`Learned as image ${n}. It now scores 100 where you said OK and 0 where you said NG; a new picture of the same part in the same place scores the same.` +
    (sum ? ` Other parts — ${sum}.` : '') + (warn.length ? ` ⚠ ${warn.join(', ')}: an OK and an NG example look alike — move or shrink the area.` : ''));
}
/** Puts the limit half way between the lowest OK example and the highest NG example. */
export function centerLimit(a: Tool) {
  const m = marginOf(a); if (!m || m.mid == null) return; a.limit = m.mid; afterLimit(); render();
  flashMsg(`${a.name}: limit set to ${m.mid}, half way between the OK and the NG examples.`);
}
export function forget(s: Sample) { P.samples = P.samples.filter(x => x !== s); U.view = null; U.mode = 'live'; save(); learnAll(); flashMsg('Image removed from learning.') }
export function stopRun() { if (U.timer) { clearInterval(U.timer); U.timer = null } }
export function toggleRun() { if (U.timer) { stopRun(); render(); return } if (!P || !P.valid) return; U.timer = setInterval(trigger, (U.period || 3) * 1000); trigger() }
export function setRunPeriod(v: number) { U.period = v || 3; store('vs1-per', String(U.period)); if (U.timer) { stopRun(); toggleRun() } render() }
/** The screen flashes like a camera when a picture is taken. */
export function flash() { if (DOM.screen) DOM.screen.animate([{ filter: 'brightness(1.8)' }, { filter: 'none' }], { duration: 180 }) }
/** A limit or tolerance changed: judge the shown results again. */
export function afterLimit() { if (U.last) rejudge(U.last.r); rejudge(U.live); drawScreen(); render(); save() }
export function resetCounters() { U.c = { ok: 0, ng: 0 }; U.hist = {}; U.times = []; render() }
