/* Programs are saved in this browser (IndexedDB 'vs1' / store 'progs', with the full-resolution pictures).
   The format is the same as before React, so programs saved earlier still open. */
import type { Program, StoredProg } from './types';
import { canvas, store } from './util';
import { P, U, setP, progs, setProgs, render, flashMsg } from './state';
import { normTool } from './tools';
import { resetView } from './view';
import { learnAll } from './learning';
import { sendCam } from './link';
import { stopRun } from './actions';

let DBH: IDBDatabase | null = null;
function idb(): Promise<IDBDatabase> {
  return new Promise((ok, bad) => {
    try { const r = indexedDB.open('vs1', 1); r.onupgradeneeded = () => r.result.createObjectStore('progs', { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => bad(r.error) } catch (e) { bad(e) }
  });
}
function tx<T>(mode: IDBTransactionMode, fn: (st: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return new Promise((ok, bad) => {
    if (!DBH) return bad(new Error('no db'));
    const t = DBH.transaction('progs', mode), st = t.objectStore('progs'); const r = fn(st);
    t.oncomplete = () => ok(r && r.result); t.onerror = () => bad(t.error);
  });
}
/** Opens the database and reads every saved program. */
export async function openStorage() {
  try { DBH = await idb(); setProgs(((await tx<StoredProg[]>('readonly', st => st.getAll())) || [])) } catch (e) { DBH = null; setProgs([]) }
}
let saveT: ReturnType<typeof setTimeout> | undefined;
/** Saves the open program a moment later (several changes in a row are saved once). */
export function save() {
  clearTimeout(saveT); saveT = setTimeout(async () => {
    if (!P) return;
    const rec: StoredProg = {
      id: P.id, name: P.name, valid: P.valid, scale: P.scale || null, out: P.out || null, cam: { ...P.cam },
      areas: P.areas.map(a => { const o: Record<string, unknown> = {}; for (const k in a) if (k[0] !== '_' && k !== 'stats' && k !== 'auto') o[k] = a[k as keyof typeof a]; return o as unknown as StoredProg['areas'][number] }),
      ref: P.ref && P.ref.blob ? { blob: P.ref.blob, thumb: P.ref.thumb } : null,
      samples: P.samples.filter(s => s.blob).map(s => ({ id: s.id, blob: s.blob, thumb: s.thumb, labels: s.labels, off: s.off || null })),
    };
    const i = progs.findIndex(p => p.id === P.id); if (i < 0) progs.push(rec); else progs[i] = rec;
    store('vs1-cur', String(P.id));
    try { await tx('readwrite', st => st.put(rec)) } catch (e) { flashMsg('Could not save the program in this browser (storage blocked). It stays open until you reload.') }
    render();
  }, 300);
}
/** Opens a saved program. */
export async function loadProg(id: number): Promise<boolean> {
  const d = progs.find(p => p.id === id); if (!d) return false;
  stopRun();
  const p: Program = {
    id: d.id, name: d.name, valid: !!d.valid, scale: d.scale || null, out: d.out || { o1: 'ok', o2: 'ng' }, cam: Object.assign({ zoom: 1, ox: 0, oy: 0 }, d.cam || {}), ref: null,
    areas: (d.areas || []).map(normTool), samples: (d.samples || []).map(s => ({ ...s, cache: {} })),
  };
  setP(p);
  U.cand = null; U.last = null; U.mode = 'live'; U.selArea = null; U.only = null; U.hist = {}; U.times = []; U.selTool = null; resetView();
  if (d.ref && d.ref.blob) {
    try { const bmp = await createImageBitmap(d.ref.blob); const c = canvas(bmp.width); c.getContext('2d')!.drawImage(bmp, 0, 0); p.ref = { full: c, size: bmp.width, blob: d.ref.blob, thumb: d.ref.thumb, cache: {} } }
    catch (e) { p.ref = null; p.valid = false }
  }
  store('vs1-cur', String(id)); sendCam(); await learnAll(); render(); return true;
}
/** A new, empty program. */
export function newProg() {
  const id = progs.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  setP({ id, name: `Program ${String(id).padStart(2, '0')}`, valid: false, scale: null, out: { o1: 'ok', o2: 'ng' }, cam: { zoom: 1, ox: 0, oy: 0 }, ref: null, areas: [], samples: [] });
  U.cand = null; U.last = null; U.mode = 'live'; U.selArea = null; U.only = null; U.hist = {}; U.times = []; U.selTool = null; U.page = 'prog'; resetView(); sendCam(); save();
}
/** Deletes the open program and opens the last other one (or a new one). */
export async function deleteProg() {
  const id = P.id; setProgs(progs.filter(p => p.id !== id));
  try { await tx('readwrite', st => st.delete(id)) } catch (e) { /* not saved yet */ }
  if (!(progs.length && await loadProg(progs[progs.length - 1].id))) newProg();
}
