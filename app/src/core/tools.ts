/* Tools: check areas (▭ ◯), measures (📏), position reference (⌖) — geometry and the 0–100 score scale. */
import type { Tool, Offset, AreaResult } from './types';
import { P } from './state';

export const isCheck = (a: Tool) => !a.type || a.type === 'check';
export const checks = (): Tool[] => P ? P.areas.filter(isCheck) : [];
export const measures = (): Tool[] => P ? P.areas.filter(a => a.type === 'measure') : [];
export const refTool = (): Tool | null => P ? P.areas.find(a => a.type === 'ref') || null : null;
export const shift = (a: Tool, o: Offset | null | undefined): Tool => o && (o.dx || o.dy) ? { ...a, x0: a.x0 + o.dx, x1: a.x1 + o.dx, y0: a.y0 + o.dy, y1: a.y1 + o.dy } : a;
/** Fills in what tools saved by older versions do not have. */
export function normTool(a: Tool): Tool {
  const b: Tool = { shape: 'rect', detail: 'auto', ang: 0, ...a, type: a.type || 'check' };
  if (b.type === 'check' && b.limit == null) { b.limit = 50; if (b.manual) b._legacyThr = b.thr }
  delete b.manual; return b;
}
// a box is (x0,y0)-(x1,y1) before rotation, turned by ang (radians) around its centre
export const ctr = (a: { x0: number; y0: number; x1: number; y1: number }): [number, number] => [(a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2];
export function rotP(x: number, y: number, ang: number): [number, number] { const c = Math.cos(ang), s = Math.sin(ang); return [x * c - y * s, x * s + y * c] }
export function corners(a: Tool): [number, number][] {
  const [cx, cy] = ctr(a), hw = (a.x1 - a.x0) / 2, hh = (a.y1 - a.y0) / 2, g = a.ang || 0;
  return [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]].map(([u, v]) => { const [p, q] = rotP(u, v, g); return [cx + p, cy + q] as [number, number] });
}
/** Upright box around any tool. */
export function toolBox(a: Tool): { x0: number; y0: number; x1: number; y1: number } {
  if (a.type === 'measure') return { x0: Math.min(a.x0, a.x1), y0: Math.min(a.y0, a.y1), x1: Math.max(a.x0, a.x1), y1: Math.max(a.y0, a.y1) };
  if (!a.ang) return a;
  const c = corners(a), xs = c.map(p => p[0]), ys = c.map(p => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

/* ---------- scores 0–100: 100 = looks like the good examples; a tool is OK at or above its limit (50 by default) ---------- */
export const limOf = (a: Tool) => a.limit != null ? a.limit : 50;
export const match = (d: number, s: number) => 100 / (1 + (d / Math.max(s, 1e-6)) ** 2);                      // deviation -> score
export const devAt = (lim: number, s: number) => s * Math.sqrt(100 / Math.min(99.5, Math.max(.5, lim)) - 1);  // score -> deviation
export const mTol = (m: Tool) => m.tol != null ? m.tol : Math.max(2, (m.nom || 0) * .05);
export function worstOf(res: AreaResult[]): AreaResult | null { let w: AreaResult | null = null; for (const r of res) if (!w || r.score - r.limit < w.score - w.limit) w = r; return w }
export const tNum = (a: Tool) => String(a.id).padStart(2, '0');
export const tIcon = (a: Tool) => a.type === 'ref' ? '⌖' : a.type === 'measure' ? '📏' : a.shape === 'ellipse' ? '◯' : '▭';
/** Tools in run order: the position reference first, then by number. */
export const runOrder = () => [...P.areas].sort((a, b) => ((a.type === 'ref' ? -1 : 0) - (b.type === 'ref' ? -1 : 0)) || a.id - b.id);
