/* Repeatability test: the same part, several pictures, no learning — how much each result moves. */
import type { InspectResult, Label, Tool } from './types';
import { sleep } from './util';
import { P, U, learning, render, flashMsg } from './state';
import { runOrder, mTol } from './tools';
import { BAND } from './util';
import { inspect } from './learning';
import { SRC, samplePart, demoNext, grab } from './source';
import { stopRun } from './actions';
import { FT } from './folderTest';
import { LB } from './folderLearn';

export interface Stats { n: number; min: number; max: number; mean: number; sd: number }
export interface RepTool {
  id: number; name: string; type: Tool['type']; oks: boolean[]; nOk: number; nNg: number; flip: boolean; st: Stats | null; L: number | null; miss: number;
  sdx?: number; sdy?: number; pct?: number; verdict?: 'good' | 'fair' | 'risk' | 'unstable'; close?: number;
}
export const REP: { run: boolean; shots: InspectResult[]; i: number; n: number; move: boolean; res: RepTool[] | null } = { run: false, shots: [], i: 0, n: 20, move: false, res: null };

/** The demo part again: fresh camera noise, and a small re-placement if asked. */
function demoShot(move: boolean) {
  const p = SRC.params; if (!p) return SRC.demo;
  const c = samplePart(p.seed, p.defect, 1280, p.mx + (move ? (Math.random() - .5) * 2.5 : 0), p.my + (move ? (Math.random() - .5) * 2.5 : 0));
  const x = c.getContext('2d')!, id = x.getImageData(0, 0, c.width, c.height), d = id.data, lt = move ? (Math.random() - .5) * 4 : 0;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 6 + lt; d[i] += n; d[i + 1] += n; d[i + 2] += n }
  x.putImageData(id, 0, 0); return c;
}
export async function repStart() {
  if (REP.run) { REP.run = false; render(); return } // second press: stop
  if (!P || !P.valid || FT.run || LB.run) return;
  if (SRC.kind === 'file') { flashMsg('The repeatability test needs a live picture of the same part: use the phone camera or the demo camera.'); return }
  stopRun();
  Object.assign(REP, { run: true, shots: [], i: 0, n: U.repN || 20, move: U.repMove, res: null });
  const demo = SRC.kind === 'demo'; if (demo) clearInterval(SRC.demoT);
  render();
  for (let i = 0; i < REP.n && REP.run; i++) {
    REP.i = i + 1;
    if (i > 0) await sleep(REP.move && !demo ? 4000 : 500); // time to take the part out and put it back
    if (!REP.run) break;
    if (demo) SRC.demo = demoShot(REP.move && i > 0);
    const f = await grab(); if (!f) break; if (learning) await learning;
    const t0 = performance.now(), r = inspect(f), dt = performance.now() - t0;
    REP.shots.push(r);
    U.last = { frame: f, r, dt, labels: Object.fromEntries(r.res.map(x => [x.id, x.ng ? 'ng' : 'ok'])) as Record<number, Label>, ts: Date.now(), learned: false, test: true };
    U.mode = 'result'; render();
  }
  REP.run = false; REP.res = repSummary(REP.shots);
  if (demo) SRC.demoT = setInterval(demoNext, 2500);
  render();
}
export function stats(v: number[]): Stats | null {
  const n = v.length; if (!n) return null; const mean = v.reduce((s, x) => s + x, 0) / n;
  return { n, min: Math.min(...v), max: Math.max(...v), mean, sd: n > 1 ? Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0 };
}
/** Per tool: spread of the results and how close they came to the limit. */
function repSummary(shots: InspectResult[]): RepTool[] | null {
  if (!shots.length) return null;
  return runOrder().map(a => {
    const oks: boolean[] = [], vals: (number | null)[] = []; let L: number | null = null;
    for (const r of shots) {
      if (a.type === 'ref') { if (r.pos.none) continue; vals.push(Math.round(r.pos.score * 100)); oks.push(r.pos.found); L = a.minScore || 60 }
      else if (a.type === 'measure') { const m = r.meas.find(z => z.id === a.id); if (!m) continue; vals.push(m.found ? m.value : null); oks.push(m.ok) }
      else { const x = r.res.find(z => z.id === a.id); if (!x) continue; vals.push(x.score); oks.push(!x.ng); L = x.limit }
    }
    const nOk = oks.filter(Boolean).length, nNg = oks.length - nOk, flip = nOk > 0 && nNg > 0, num = vals.filter((v): v is number => v != null), st = stats(num);
    const out: RepTool = { id: a.id, name: a.name, type: a.type, oks, nOk, nNg, flip, st, L, miss: vals.length - num.length };
    if (a.type === 'ref') {
      const sz = P.ref ? P.ref.size : 0, used = shots.filter(r => !r.pos.none);
      const dx = stats(used.map(r => r.off.dx * sz)), dy = stats(used.map(r => r.off.dy * sz)); out.sdx = dx ? dx.sd : 0; out.sdy = dy ? dy.sd : 0;
    }
    if (a.type === 'measure') {
      if (a.nom != null && st) { const W = 2 * mTol(a); out.pct = 6 * st.sd / W * 100; out.verdict = flip || out.miss ? 'unstable' : out.pct > 30 ? 'risk' : out.pct > 10 ? 'fair' : 'good' }
      else out.verdict = flip || out.miss ? 'unstable' : 'good';
    } else if (st) {
      out.close = Math.min(...num.map(v => Math.abs(v - L!)));
      out.verdict = flip ? 'unstable' : out.close < BAND ? 'fair' : 'good';
    }
    return out;
  });
}
