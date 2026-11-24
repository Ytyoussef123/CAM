/* Test a folder: every picture triggered in turn, like parts on a line — shown, judged, and compared with what the folder names say. */
import type { Tool, Label, InspectResult } from './types';
import { BAND, sleep, pause, thumbOf, plural } from './util';
import { P, U, learning, render, flashMsg } from './state';
import { refTool, limOf, mTol } from './tools';
import { fmtLen } from './analysis';
import { inspect, measMarg } from './learning';
import { makeFrame } from './source';
import { stopRun, flash } from './actions';
import { drawScreen } from './draw';
import { REP } from './repeat';
import { LB } from './folderLearn';

export interface FTItem {
  path: string; file: File; expect: Label | null; tools: { id: number; v: number | null }[]; dt: number; known: boolean; size: number;
  ok?: boolean; thumb?: string; err?: boolean;
}
export const FT: {
  run: boolean; items: FTItem[]; done: number; total: number; t0: number; res: boolean | null; tool: number | null; lastShow: number; cur: string;
  stamp: { id: number; n: number } | null;
} = { run: false, items: [], done: 0, total: 0, t0: 0, res: null, tool: null, lastShow: 0, cur: '', stamp: null };

const OKW = new Set(['good', 'ok', 'oks', 'okay', 'normal', 'pass', 'passed', 'accept', 'accepted', 'conforming']);
const NGW = new Set(['ng', 'nok', 'def', 'defect', 'defects', 'defective', 'bad', 'anomaly', 'anomalies', 'anomalous', 'abnormal', 'fail', 'failed', 'reject', 'rejected', 'faulty', 'damaged', 'broken']);
const IMG_EXT = /\.(png|jpe?g|bmp|webp|gif)$/i;
/** Expected result read from the folder names; the deepest folder that tells wins. */
export function ftLabel(path: string): Label | null {
  const segs = path.split('/').slice(0, -1);
  for (let i = segs.length - 1; i >= 0; i--) {
    const t = segs[i].toLowerCase().split(/[^a-z]+/).filter(Boolean);
    if (t.some(w => OKW.has(w))) return 'ok';
    if (t.some(w => NGW.has(w))) return 'ng';
    if (i > 0 && /^test$/i.test(segs[i - 1])) return 'ng'; // MVTec style: test/<name of the defect>
  }
  return null;
}
export type PathFile = File & { _path?: string };
/** Pictures only; defect masks of the datasets are skipped. */
export function ftCollect(list: PathFile[]): { file: PathFile; path: string }[] {
  const out: { file: PathFile; path: string }[] = [];
  for (const f of list) {
    const path = f._path || f.webkitRelativePath || f.name;
    if (!IMG_EXT.test(f.name)) continue;
    if (/(^|\/)(ground[_ -]?truth|masks?|gt)(\/|$)/i.test(path) || /_mask\.[a-z]+$/i.test(f.name)) continue;
    out.push({ file: f, path });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
}
/** A folder dropped on a panel: read it with its sub-folders. */
export async function ftDropFiles(dt: DataTransfer): Promise<PathFile[]> {
  const out: PathFile[] = [], roots = [...(dt.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter((e): e is FileSystemEntry => !!e);
  if (!roots.length) return [...(dt.files || [])];
  const walk = async (ent: FileSystemEntry, pre: string): Promise<void> => {
    if (ent.isFile) { try { const f = await new Promise<File>((ok, bad) => (ent as FileSystemFileEntry).file(ok, bad)) as PathFile; f._path = pre + f.name; out.push(f) } catch (e) { /* unreadable */ } }
    else if (ent.isDirectory) {
      const rd = (ent as FileSystemDirectoryEntry).createReader();
      for (; ;) { const b = await new Promise<FileSystemEntry[]>((ok, bad) => rd.readEntries(ok, bad)); if (!b.length) break; for (const e of b) await walk(e, pre + ent.name + '/') }
    }
  };
  for (const r of roots) await walk(r, '');
  return out;
}
/** What is kept of a result: enough to judge it again when a limit changes. */
function ftTools(r: InspectResult) {
  const t: { id: number; v: number | null }[] = [];
  for (const x of r.res) t.push({ id: x.id, v: x.score });
  for (const m of r.meas) t.push({ id: m.id, v: m.found ? m.value : null });
  const rt = refTool(); if (rt && !r.pos.none) t.push({ id: rt.id, v: Math.round(r.pos.score * 100) });
  return t;
}
export const toolLim = (a: Tool) => a.type === 'ref' ? (a.minScore || 60) : limOf(a);
/** OK / NG of one tool value with today's limits (null: the tool no longer exists). */
function toolOk(a: Tool | undefined, v: number | null): boolean | null {
  if (!a) return null;
  if (a.type === 'measure') return v != null && (a.nom == null || Math.abs(v - a.nom) <= mTol(a));
  return v != null && v >= toolLim(a);
}
function toolMarg(a: Tool | undefined, v: number | null) { if (!a || v == null) return false; if (a.type === 'measure') return measMarg(a, { id: a.id, name: a.name, found: true, ok: true, value: v }); return Math.abs(v - toolLim(a)) < BAND }
const ftOk = (it: FTItem) => it.tools.every(t => toolOk(P.areas.find(a => a.id === t.id), t.v) !== false);
export async function ftStart(list: PathFile[]) {
  if (FT.run || LB.run) return;
  if (!P || !P.valid) { flashMsg('Finish the program first: ⚙ PROGRAM → step 5 → Finish.'); return }
  const items = ftCollect(list);
  if (!items.length) { flashMsg('No pictures found (PNG, JPG, BMP or WebP). Defect masks in "ground_truth" or "mask" folders are skipped.'); return }
  stopRun(); REP.run = false;
  const exp = U.ftExp, alive = () => FT.run;
  Object.assign(FT, { run: true, items: [], done: 0, total: items.length, t0: performance.now(), res: null, lastShow: 0, cur: '', stamp: { id: P.id, n: P.samples.length } });
  U.rtab = 'folder'; render();
  for (const [k, it] of items.entries()) {
    if (!FT.run) break;
    const T = (+U.ftPer || 0) * 1000;
    if (k > 0) { if (T) await pause(T, alive); else await sleep(0) }
    if (!FT.run) break;
    FT.cur = it.path;
    let bmp: ImageBitmap | null = null; try { bmp = await createImageBitmap(it.file) } catch (e) { FT.items.push({ path: it.path, file: it.file, err: true, tools: [], expect: null, dt: 0, known: false, size: 0 }); FT.done++; continue }
    const f = makeFrame(bmp); bmp.close();
    if (learning) await learning;
    const t0 = performance.now(), r = inspect(f), dt = performance.now() - t0;
    const expect = exp === 'auto' ? ftLabel(it.path) : exp === 'none' ? null : exp;
    const known = r.res.length > 0 && r.res.every(x => x.dev === 0); // the same as a taught picture or the master: says nothing about accuracy
    const item: FTItem = { path: it.path, file: it.file, expect, tools: ftTools(r), dt, known, size: f.size };
    item.ok = ftOk(item);
    if (expect && expect !== (item.ok ? 'ok' : 'ng')) item.thumb = thumbOf(f.full, 96, .7);
    FT.items.push(item); FT.done++;
    U.last = {
      frame: f, r, dt, labels: Object.fromEntries(r.res.map(x => [x.id, x.ng ? 'ng' : 'ok'])) as Record<number, Label>, ts: Date.now(), learned: false, test: true, ft: it.path,
      meta: { idx: k + 1, n: items.length, path: it.path, expect, agree: expect ? expect === (item.ok ? 'ok' : 'ng') : null, note: known ? 'the same as a taught picture: not counted' : '' },
    };
    U.mode = 'result'; U.view = null;
    const now = performance.now();
    if (T || now - FT.lastShow > 250) { FT.lastShow = now; if (T) flash(); render() } else drawScreen(); // "fast": the panel follows a few times a second
  }
  FT.run = false; FT.res = true; render();
  const s = ftStats();
  flashMsg(`Folder test ${FT.done < FT.total ? 'stopped' : 'finished'}: ${s.total} picture${plural(s.total)}` + (s.n ? `, ${Math.round(s.acc! * 100)} % judged right on the ${s.n} with a label from the folder names.` : '.'));
}
/** Counts with today's limits. */
export function ftStats() {
  const it = FT.items.filter(x => !x.err), use = it.filter(x => !x.known);
  const c = { okok: 0, okng: 0, ngng: 0, ngok: 0, uok: 0, ung: 0 };
  for (const x of it) {
    x.ok = ftOk(x); if (x.known) continue;
    if (x.expect === 'ok') { if (x.ok) c.okok++; else c.okng++ } else if (x.expect === 'ng') { if (x.ok) c.ngok++; else c.ngng++ } else { if (x.ok) c.uok++; else c.ung++ }
  }
  const n = c.okok + c.okng + c.ngng + c.ngok;
  const marg = use.filter(x => x.tools.some(t => toolMarg(P.areas.find(a => a.id === t.id), t.v))).length;
  const sz = P.ref ? it.filter(x => x.size && (x.size / P.ref!.size > 1.5 || x.size / P.ref!.size < .67)).length : 0;
  return { c, n, acc: n ? (c.okok + c.ngng) / n : null, known: it.length - use.length, err: FT.items.length - it.length, marg, sz, avg: it.length ? it.reduce((s, x) => s + x.dt, 0) / it.length : 0, total: it.length };
}
/** The limit that would judge the most labelled pictures right if this tool alone decided. */
export function ftBest(a: Tool) {
  const xs = FT.items.filter(x => !x.err && !x.known && x.expect).map(x => { const t = x.tools.find(t => t.id === a.id); return t && t.v != null ? { v: t.v, ok: x.expect === 'ok' } : null }).filter((x): x is { v: number; ok: boolean } => !!x);
  if (xs.length < 4 || !xs.some(x => x.ok) || !xs.some(x => !x.ok)) return null;
  let best = -1, lo = 0, hi = 0;
  for (let L = 0; L <= 100; L++) { const r = xs.reduce((s, x) => s + ((x.v >= L) === x.ok ? 1 : 0), 0); if (r > best) { best = r; lo = hi = L } else if (r === best) hi = L }
  return { L: Math.round((lo + hi) / 2), lo, hi, acc: best / xs.length, n: xs.length };
}
/** The tool closest to failing (or failing most) on one tested picture. */
export function worstTxt(x: FTItem) {
  let w: [Tool, number | null] | null = null, wm = Infinity;
  for (const t of x.tools) {
    const a = P.areas.find(z => z.id === t.id); if (!a) continue;
    const m = a.type === 'measure' ? (t.v == null ? -1e9 : (a.nom == null ? 1e9 : mTol(a) - Math.abs(t.v - a.nom))) : (t.v == null ? -1e9 : t.v - toolLim(a));
    if (m < wm) { wm = m; w = [a, t.v] }
  }
  if (!w) return ''; const [a, v] = w; return a.type === 'measure' ? `${a.name} ${v == null ? 'no edges' : fmtLen(v)}` : `${a.name} ${v}`;
}
/** Shows one tested picture on the screen (and opens the teaching panel if asked). */
export async function ftOpen(item: FTItem, teach: boolean) {
  let bmp: ImageBitmap | null = null; try { bmp = await createImageBitmap(item.file) } catch (e) { flashMsg('Could not read ' + item.path); return }
  const f = makeFrame(bmp); bmp.close();
  const r = inspect(f);
  const labels = Object.fromEntries(r.res.map(x => [x.id, item.expect === 'ok' ? 'ok' : x.ng ? 'ng' : 'ok'])) as Record<number, Label>;
  U.last = { frame: f, r, dt: 0, labels, ts: Date.now(), learned: false, test: true, ft: item.path }; U.mode = 'result'; U.view = null;
  if (teach) U.rtab = 'teach';
  render();
  if (teach) flashMsg(item.expect === 'ok' ? 'This picture comes from a good folder: every area is set to OK. Press Learn if it really is good.' :
    'This picture comes from a defect folder: set the area(s) with the defect to NG, then press Learn.');
}
/** A test of another program is forgotten when the program changes. */
export function ftForgetOtherProgram() { if (FT.stamp && P && FT.stamp.id !== P.id && !FT.run) { FT.res = null; FT.items = []; FT.stamp = null } }
