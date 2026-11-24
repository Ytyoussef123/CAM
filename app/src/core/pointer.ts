/* Pointer on the image: move, resize and turn tools, pan the zoomed screen, hand cursors. */
import type { Tool } from './types';
import { DEF_THR } from './util';
import { P, U, render } from './state';
import { isCheck, ctr, rotP, corners, toolBox } from './tools';
import { V, toImg, clampView, resetView, zoomBy } from './view';
import { L } from './link';
import { drawScreen, rotHandle } from './draw';
import { nextId } from './actions';
import { save } from './storage';
import { learnAll } from './learning';

function localP(a: Tool, px: number, py: number) { const [cx, cy] = ctr(a); return rotP(px - cx, py - cy, -(a.ang || 0)) } // point in the tool's own (unturned) frame
function inside(a: Tool, px: number, py: number) {
  const [u, v] = localP(a, px, py), hw = (a.x1 - a.x0) / 2, hh = (a.y1 - a.y0) / 2;
  return a.shape === 'ellipse' ? (u / hw) ** 2 + (v / hh) ** 2 <= 1 : Math.abs(u) <= hw && Math.abs(v) <= hh;
}
function segDist(a: Tool, px: number, py: number) { const dx = a.x1 - a.x0, dy = a.y1 - a.y0, l2 = dx * dx + dy * dy || 1e-9, t = Math.max(0, Math.min(1, ((px - a.x0) * dx + (py - a.y0) * dy) / l2)); return Math.hypot(px - (a.x0 + t * dx), py - (a.y0 + t * dy)) }
const ROT_CURSOR = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12A7 7 0 1 1 12 5M9 2l3 3-3 3" stroke="#fff" stroke-width="5"/><path d="M19 12A7 7 0 1 1 12 5M9 2l3 3-3 3" stroke="#000" stroke-width="2"/></g></svg>') + '") 12 12, crosshair';
type Hit = { mode: 'rot' | 'move'; a: Tool } | { mode: 'end'; a: Tool; k: 0 | 1 } | { mode: 'corner'; a: Tool; k: number; F: [number, number] };
function hit(px: number, py: number): Hit | null {
  if (U.mode !== 'edit' || L.role !== 'ctl' || !P) return null; const tol = .03 / V.z;
  const list = [...P.areas].reverse().filter(a => !U.only || a.id === U.only);
  const sel = list.find(a => a.id === U.selArea && isCheck(a)); // the round rotation handle of the selected area
  if (sel) { const [rx, ry] = rotHandle(sel); if (Math.hypot(px - rx, py - ry) < tol * .9) return { mode: 'rot', a: sel } }
  for (const a of list) {
    if (a.type === 'measure') { if (Math.hypot(px - a.x0, py - a.y0) < tol) return { mode: 'end', a, k: 0 }; if (Math.hypot(px - a.x1, py - a.y1) < tol) return { mode: 'end', a, k: 1 }; continue }
    const c = corners(a), k = c.findIndex(([cx, cy]) => Math.abs(px - cx) < tol && Math.abs(py - cy) < tol);
    if (k >= 0) return { mode: 'corner', a, k, F: c[3 - k] };
  }
  for (const a of list) {
    if (a.type === 'measure') { if (segDist(a, px, py) < Math.max(tol * .6, (a.band || .02) / 2)) return { mode: 'move', a }; continue }
    if (inside(a, px, py)) return { mode: 'move', a };
  }
  return null;
}
/** The resize arrow that matches the corner's direction on screen. */
function resizeCursor(a: Tool, k: number) {
  const [cx, cy] = ctr(a), c = corners(a)[k]; let d = Math.atan2(c[1] - cy, c[0] - cx) * 180 / Math.PI; d = ((d % 180) + 180) % 180;
  return d < 22.5 || d >= 157.5 ? 'ew-resize' : d < 67.5 ? 'nwse-resize' : d < 112.5 ? 'ns-resize' : 'nesw-resize';
}
function cursorFor(px: number, py: number) {
  const h = hit(px, py);
  if (h && h.mode === 'rot') return ROT_CURSOR;
  if (h && h.mode === 'corner') return resizeCursor(h.a, h.k);
  if (h && h.mode === 'end') return 'move';
  if (h) return 'grab';
  if (V.z > 1.01) return 'grab';
  return U.mode === 'edit' && !U.only ? 'crosshair' : 'default';
}
/** Zooms the screen (buttons and wheel). */
export function zoomAt(f: number, sx = .5, sy = .5) { zoomBy(f, sx, sy); drawScreen(); render() }
/** Connects the pointer to the screen canvas; returns the disconnection. */
export function attachPointer(cv: HTMLCanvasElement): () => void {
  const ptr = (e: PointerEvent | MouseEvent) => { const r = cv.getBoundingClientRect(); return toImg(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))) };
  const down = (e: PointerEvent) => {
    if (L.role !== 'ctl' || !P) return;
    const [px, py] = ptr(e), h = hit(px, py);
    if (!h && V.z <= 1.01 && (U.mode !== 'edit' || U.only)) return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    if (h) { U.drag = { ...h, sx: px, sy: py, o: { ...h.a } }; U.selArea = h.a.id; if (h.mode === 'move') cv.style.cursor = 'grabbing'; render(); return }
    if (V.z > 1.01) { const r = cv.getBoundingClientRect(); U.drag = { mode: 'pan', ex: e.clientX, ey: e.clientY, cx: V.cx, cy: V.cy, w: r.width }; cv.style.cursor = 'grabbing'; return }
    U.drag = { mode: 'new', sx: px, sy: py, cx: px, cy: py };
  };
  const move = (e: PointerEvent) => {
    const d = U.drag;
    if (!d) { if (L.role === 'ctl' && P) { const [px, py] = ptr(e); cv.style.cursor = cursorFor(px, py) } return }
    if (d.mode === 'pan') { V.cx = d.cx - (e.clientX - d.ex) / d.w / V.z; V.cy = d.cy - (e.clientY - d.ey) / d.w / V.z; clampView(); drawScreen(); return }
    const [px, py] = ptr(e);
    if (d.mode === 'new') { d.cx = px; d.cy = py }
    else if (d.mode === 'end') { if (d.k === 0) { d.a.x0 = px; d.a.y0 = py } else { d.a.x1 = px; d.a.y1 = py } }
    else if (d.mode === 'move') {
      const a = d.a, b = toolBox(d.o), ddx = Math.min(1 - b.x1, Math.max(-b.x0, px - d.sx)), ddy = Math.min(1 - b.y1, Math.max(-b.y0, py - d.sy));
      Object.assign(a, { x0: d.o.x0 + ddx, y0: d.o.y0 + ddy, x1: d.o.x1 + ddx, y1: d.o.y1 + ddy });
    }
    else if (d.mode === 'rot') { // turn around the centre; snaps to 0°, 90°, 180°, 270°
      const a = d.a, [cx, cy] = ctr(a); let g = Math.atan2(py - cy, px - cx) + Math.PI / 2; g = Math.atan2(Math.sin(g), Math.cos(g));
      const q = Math.round(g / (Math.PI / 2)) * (Math.PI / 2); if (Math.abs(g - q) < .07) g = q; a.ang = Math.abs(g) < 1e-9 ? 0 : g;
    }
    else if (d.mode === 'corner') { // the opposite corner stays where it is, also when the box is turned
      const a = d.a, g = a.ang || 0, F = d.F, [u, v] = rotP(px - F[0], py - F[1], -g), w = Math.max(.01, Math.abs(u)), h = Math.max(.01, Math.abs(v));
      const [ox, oy] = rotP((u < 0 ? -1 : 1) * w / 2, (v < 0 ? -1 : 1) * h / 2, g), cx = F[0] + ox, cy = F[1] + oy;
      Object.assign(a, { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 });
    }
    drawScreen();
  };
  const end = (e: PointerEvent) => {
    const d = U.drag; if (!d) return; U.drag = null;
    if (e && e.clientX != null) { const [px, py] = ptr(e); cv.style.cursor = cursorFor(px, py) }
    if (d.mode === 'pan') return;
    if (d.mode === 'new') {
      const a = { x0: Math.min(d.sx, d.cx), y0: Math.min(d.sy, d.cy), x1: Math.max(d.sx, d.cx), y1: Math.max(d.sy, d.cy) };
      if (a.x1 - a.x0 > .02 && a.y1 - a.y0 > .02) { const id = nextId(); P.areas.push({ id, type: 'check', name: `Area ${id}`, shape: 'rect', ...a, ang: 0, thr: DEF_THR, limit: 50, detail: 'auto' }); U.selArea = id }
      else { render(); return }
    }
    else {
      const a = d.a;
      if (a.type !== 'measure') { if (a.x1 - a.x0 < .02) { const c = (a.x0 + a.x1) / 2; a.x0 = c - .01; a.x1 = c + .01 } if (a.y1 - a.y0 < .02) { const c = (a.y0 + a.y1) / 2; a.y0 = c - .01; a.y1 = c + .01 } }
      if (d.o.x0 === a.x0 && d.o.y0 === a.y0 && d.o.x1 === a.x1 && d.o.y1 === a.y1 && (d.o.ang || 0) === (a.ang || 0)) { render(); return }
    }
    P.valid = false; save();
    if (d.a && d.a.type === 'measure') render(); else learnAll();
  };
  const wheel = (e: WheelEvent) => { if (L.role !== 'ctl') return; e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(Math.pow(1.0015, -e.deltaY), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height) };
  const dbl = () => { if (L.role === 'ctl') { resetView(); render() } };
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', wheel, { passive: false }); cv.addEventListener('dblclick', dbl);
  return () => {
    cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', end); cv.removeEventListener('pointercancel', end);
    cv.removeEventListener('wheel', wheel); cv.removeEventListener('dblclick', dbl);
  };
}
