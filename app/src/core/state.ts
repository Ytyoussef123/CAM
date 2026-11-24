/* The live state of the console. The engine changes it, then calls render(): React draws the screens again. */
import type { Program, StoredProg, Frame, LastShot, InspectResult, Sample, Tool, Label } from './types';
import { stored } from './util';

/** The open program. It is set before the screens are first drawn and is never empty afterwards. */
export let P: Program;
export function setP(p: Program) { P = p }
/** Every program saved in this browser. */
export let progs: StoredProg[] = [];
export function setProgs(v: StoredProg[]) { progs = v }
/** Learning in progress (pictures decoded again, areas learned): wait for it before inspecting. */
export let learning: Promise<void> | null = null;
export function setLearning(v: Promise<void> | null) { learning = v }

export type Mode = 'live' | 'cand' | 'master' | 'edit' | 'result' | 'sample';
export type RunTab = 'hist' | 'teach' | 'rep' | 'folder';
export type Drag =
  | { mode: 'rot' | 'move'; a: Tool; sx: number; sy: number; o: Tool }
  | { mode: 'end'; a: Tool; k: 0 | 1; sx: number; sy: number; o: Tool }
  | { mode: 'corner'; a: Tool; k: number; F: [number, number]; sx: number; sy: number; o: Tool }
  | { mode: 'pan'; ex: number; ey: number; cx: number; cy: number; w: number; a?: undefined }
  | { mode: 'new'; sx: number; sy: number; cx: number; cy: number; a?: undefined };

export interface UIState {
  only: number | null; page: 'prog' | 'run'; step: number; rtab: RunTab;
  hist: Record<number, (number | null)[]>; times: number[]; selTool: number | null; mode: Mode;
  cand: Frame | null; last: LastShot | null; selArea: number | null; drag: Drag | null;
  c: { ok: number; ng: number; marg?: number }; timer: ReturnType<typeof setInterval> | null; heat: boolean;
  live: InspectResult | null; lastLive: number; view: Sample | null; msg: string; period: number;
  // settings of the panels (were read from the page before React)
  ftExp: 'auto' | Label | 'none'; ftPer: string; lPer: string; lNgArea: string; repN: number; repMove: boolean;
  pairIn: string; addMenu: boolean;
}
const per = (k: string) => { const v = stored(k); return v != null && ['0', '1', '3', '5'].includes(v) ? v : '3' };
export const U: UIState = {
  only: null, page: 'prog', step: 1, rtab: 'hist', hist: {}, times: [], selTool: null, mode: 'live', cand: null, last: null,
  selArea: null, drag: null, c: { ok: 0, ng: 0 }, timer: null, heat: true, live: null, lastLive: 0, view: null, msg: '',
  period: +(stored('vs1-per') || 0) || 3,
  ftExp: 'auto', ftPer: per('vs1-ftper'), lPer: per('vs1-lper'), lNgArea: 'auto', repN: 20, repMove: false,
  pairIn: stored('vs1-pair') || '', addMenu: false,
};

/* ---------- React connection: render() asks React to draw the screens again ---------- */
let version = 0;
const subs = new Set<() => void>();
export function render() { version++; for (const f of subs) f() }
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } };
export const getVersion = () => version;

/* ---------- the status block over the image: it follows the screen drawing (up to 60 times a second) ---------- */
export interface ScreenInfo { vCls: string; vTxt: string; vTitle: string; name: string; nameTitle: string; a: string; b: string; lamps: [boolean, boolean] }
export const SCR: ScreenInfo = { vCls: 'verdict idle', vTxt: '—', vTitle: '', name: '—', nameTitle: '', a: '—', b: '—', lamps: [false, false] };
let scrVersion = 0;
const scrSubs = new Set<() => void>();
/** Changes the status block; React is told only when something really changed. */
export function setScreen(p: Partial<ScreenInfo>) {
  let ch = false;
  for (const k in p) {
    const key = k as keyof ScreenInfo, v = p[key];
    if (key === 'lamps') { const l = v as [boolean, boolean]; if (l[0] !== SCR.lamps[0] || l[1] !== SCR.lamps[1]) { SCR.lamps = l; ch = true } }
    else if (SCR[key] !== v) { (SCR as unknown as Record<string, unknown>)[key] = v; ch = true }
  }
  if (ch) { scrVersion++; for (const f of scrSubs) f() }
}
export const subscribeScreen = (f: () => void) => { scrSubs.add(f); return () => { scrSubs.delete(f) } };
export const getScreenVersion = () => scrVersion;

/** Elements the engine draws into or animates (registered by the React components). */
export const DOM: { view: HTMLCanvasElement | null; screen: HTMLDivElement | null; fileIn: HTMLInputElement | null } = { view: null, screen: null, fileIn: null };

let msgT: ReturnType<typeof setTimeout> | undefined;
/** A message in the box above the panels, for 6 seconds. */
export function flashMsg(t: string) { U.msg = t; clearTimeout(msgT); msgT = setTimeout(() => { U.msg = ''; render() }, 6000); render() }
