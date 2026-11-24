/* The image screen: picture, tools, heat map — drawn directly on the canvas (outside React, up to 60 times a second). */
import type { Tool, Offset, InspectResult, MeasResult, PosResult } from './types';
import { D, OKC, NGC, EDC, SELC, REFC, canvas, shortPath, plural } from './util';
import { P, U, DOM, learning, setScreen } from './state';
import { checks, measures, refTool, shift, ctr, rotP, corners, mTol } from './tools';
import { grid, fmtLen } from './analysis';
import { inspect } from './learning';
import { V, applyView } from './view';
import { SRC, liveSrc, drawSrc, makeFrame, camCrop } from './source';
import { L } from './link';
import { C } from './camera';
import { measRef } from './actions';
import { outSel, outVal } from './outputs';

/* ---------- the live result list in RUN follows the live view (a few times a second) ---------- */
let liveVersion = 0;
const liveSubs = new Set<() => void>();
function liveTick() { liveVersion++; for (const f of liveSubs) f() }
export const subscribeLive = (f: () => void) => { liveSubs.add(f); return () => { liveSubs.delete(f) } };
export const getLiveVersion = () => liveVersion;

type Box = { x0: number; y0: number; x1: number; y1: number; shape?: string; ang?: number; type?: string };
function areaPath(x: CanvasRenderingContext2D, a: Box) { // rectangle or ellipse, turned by its angle
  const [cx, cy] = ctr(a), w = (a.x1 - a.x0) * D, h = (a.y1 - a.y0) * D; x.beginPath();
  if (a.shape === 'ellipse') { x.ellipse(cx * D, cy * D, Math.max(1, Math.abs(w) / 2), Math.max(1, Math.abs(h) / 2), a.ang || 0, 0, Math.PI * 2); return }
  const c = corners(a as Tool); x.moveTo(c[0][0] * D, c[0][1] * D); x.lineTo(c[1][0] * D, c[1][1] * D); x.lineTo(c[3][0] * D, c[3][1] * D); x.lineTo(c[2][0] * D, c[2][1] * D); x.closePath();
}
function label(x: CanvasRenderingContext2D, X: number, Y: number, color: string, text: string) {
  const z = V.z, fs = 26 / z; x.font = `600 ${fs}px "Barlow Condensed",Arial,sans-serif`; const tw = x.measureText(text).width + 12 / z, ly = Y > fs * 1.3 ? Y - fs * 1.23 : Y + 3 / z;
  x.fillStyle = color; x.fillRect(X, ly, tw, fs * 1.15); x.fillStyle = color === SELC ? '#222' : '#fff'; x.fillText(text, X + 6 / z, ly + fs * .88);
}
function handle(x: CanvasRenderingContext2D, hx: number, hy: number, color: string) { const hs = 18 / V.z; x.fillStyle = color; x.fillRect(hx - hs / 2, hy - hs / 2, hs, hs) }
/** Where the round rotation handle sits, above the top edge (normalized). */
export function rotHandle(a: Tool): [number, number] { const [cx, cy] = ctr(a), hh = (a.y1 - a.y0) / 2, [p, q] = rotP(0, -hh - .05 / V.z, a.ang || 0); return [cx + p, cy + q] }
function strokeArea(x: CanvasRenderingContext2D, a: Box, color: string, text: string, handles?: boolean, dash?: number[] | null) {
  const z = V.z, c = corners(a as Tool);
  x.lineWidth = 3 / z; x.strokeStyle = color; x.setLineDash(dash || (color === EDC ? [10 / z, 6 / z] : [])); areaPath(x, a); x.stroke(); x.setLineDash([]);
  if (handles) {
    if (a.shape === 'ellipse') {
      x.lineWidth = 1 / z; x.setLineDash([4 / z, 4 / z]); x.beginPath(); x.moveTo(c[0][0] * D, c[0][1] * D); x.lineTo(c[1][0] * D, c[1][1] * D);
      x.lineTo(c[3][0] * D, c[3][1] * D); x.lineTo(c[2][0] * D, c[2][1] * D); x.closePath(); x.stroke(); x.setLineDash([]);
    }
    for (const [hx, hy] of c) handle(x, hx * D, hy * D, color);
    if (a.type === 'check') { // rotation handle: a stem and a round knob with a turning arrow
      const [rx, ry] = rotHandle(a as Tool), [cx, cy] = ctr(a), [tx, ty] = rotP(0, -(a.y1 - a.y0) / 2, a.ang || 0);
      x.strokeStyle = color; x.lineWidth = 2 / z; x.beginPath(); x.moveTo((cx + tx) * D, (cy + ty) * D); x.lineTo(rx * D, ry * D); x.stroke();
      x.beginPath(); x.arc(rx * D, ry * D, 11 / z, 0, Math.PI * 2); x.fillStyle = color; x.fill();
      x.strokeStyle = color === SELC ? '#222' : '#fff'; x.lineWidth = 2 / z; x.beginPath(); x.arc(rx * D, ry * D, 5.5 / z, -Math.PI * .95, Math.PI * .45); x.stroke();
      const ex = rx * D + 5.5 / z * Math.cos(Math.PI * .45), ey = ry * D + 5.5 / z * Math.sin(Math.PI * .45); x.beginPath(); x.moveTo(ex - 4 / z, ey + .5 / z); x.lineTo(ex, ey); x.lineTo(ex + .5 / z, ey - 4 / z); x.stroke();
    }
  }
  if (text) { const xs = c.map(p => p[0]), ys = c.map(p => p[1]); label(x, Math.min(...xs) * D, Math.min(...ys) * D, color, text) }
}
function drawMeasure(x: CanvasRenderingContext2D, m: Tool, o: Offset | null, r: MeasResult | undefined | null, sel: boolean, edit: boolean) {
  const a = shift(m, o), z = V.z, X0 = a.x0 * D, Y0 = a.y0 * D, X1 = a.x1 * D, Y1 = a.y1 * D, Ln = Math.hypot(X1 - X0, Y1 - Y0) || 1, nx = -(Y1 - Y0) / Ln, ny = (X1 - X0) / Ln, bw = (m.band || .02) * D / 2;
  const color = sel ? SELC : r ? (r.ok ? OKC : NGC) : EDC;
  x.strokeStyle = color; x.lineWidth = 1 / z; x.setLineDash([4 / z, 4 / z]); x.beginPath();
  x.moveTo(X0 + nx * bw, Y0 + ny * bw); x.lineTo(X1 + nx * bw, Y1 + ny * bw); x.lineTo(X1 - nx * bw, Y1 - ny * bw); x.lineTo(X0 - nx * bw, Y0 - ny * bw); x.closePath(); x.stroke(); x.setLineDash([]);
  x.lineWidth = 2 / z; x.beginPath(); x.moveTo(X0, Y0); x.lineTo(X1, Y1); x.stroke();
  // arrow head shows the direction
  const ah = 14 / z, ux = (X1 - X0) / Ln, uy = (Y1 - Y0) / Ln; x.beginPath(); x.moveTo(X1, Y1); x.lineTo(X1 - ux * ah + nx * ah * .5, Y1 - uy * ah + ny * ah * .5); x.lineTo(X1 - ux * ah - nx * ah * .5, Y1 - uy * ah - ny * ah * .5); x.closePath(); x.fillStyle = color; x.fill();
  if (r && r.found && r.e1 && r.e2) {
    const E1 = [r.e1[0] * D, r.e1[1] * D], E2 = [r.e2[0] * D, r.e2[1] * D], t = bw + 10 / z; x.lineWidth = 4 / z; x.strokeStyle = color;
    for (const E of [E1, E2]) { x.beginPath(); x.moveTo(E[0] + nx * t, E[1] + ny * t); x.lineTo(E[0] - nx * t, E[1] - ny * t); x.stroke() }
    x.lineWidth = 3 / z; x.beginPath(); x.moveTo(E1[0] + nx * t * .7, E1[1] + ny * t * .7); x.lineTo(E2[0] + nx * t * .7, E2[1] + ny * t * .7); x.stroke();
  }
  if (sel) { handle(x, X0, Y0, color); handle(x, X1, Y1, color) }
  const txt = (r && r.marg ? '⚠ ' : '') + m.name + (r ? (r.found ? ' ' + fmtLen(r.value) : ' no edges') : edit && m.nom != null ? ' ' + fmtLen(m.nom) : '');
  label(x, Math.min(X0, X1), Math.min(Y0, Y1) - bw, color, txt);
}
function drawRef(x: CanvasRenderingContext2D, a: Tool, pos: PosResult | null, sel: boolean) {
  if (pos && !pos.none) { const f = pos.found ? shift(a, pos) : a; strokeArea(x, f, pos.found ? REFC : NGC, `${pos.marg ? '⚠ ' : ''}⌖ ${a.name} ${Math.round(pos.score * 100)}`, false, pos.found ? null : [6, 6]) }
  else strokeArea(x, a, sel ? SELC : REFC, `⌖ ${a.name}` + (sel ? ` · search ±${a.range}%` : ''), sel, [10 / V.z, 6 / V.z]);
  if (sel) {
    const R = (a.range || 20) / 100; x.strokeStyle = REFC; x.lineWidth = 1 / V.z; x.setLineDash([3 / V.z, 5 / V.z]);
    x.strokeRect((a.x0 - R) * D, (a.y0 - R) * D, (a.x1 - a.x0 + 2 * R) * D, (a.y1 - a.y0 + 2 * R) * D); x.setLineDash([]);
  }
}
function drawAreas(x: CanvasRenderingContext2D, R: InspectResult | null, edit: boolean) {
  const o = R && R.off;
  for (const a of P.areas) {
    const sel = edit && U.selArea === a.id; x.globalAlpha = edit && U.only && U.only !== a.id ? .3 : 1;
    if (a.type === 'measure') drawMeasure(x, a, o, R && R.meas.find(z => z.id === a.id), sel, edit);
    else if (a.type === 'ref') drawRef(x, a, R && R.pos, sel);
    else {
      const r = R && R.res.find(z => z.id === a.id), deg = Math.round((a.ang || 0) * 180 / Math.PI);
      strokeArea(x, shift(a, o), sel ? SELC : r ? (r.ng ? NGC : OKC) : EDC,
        (r && r.marg ? '⚠ ' : '') + a.name + (r ? ` ${Math.round(r.score)}` : edit ? ` · ${grid(a).gw}×${grid(a).gh}` + (deg ? ` · ${deg}°` : '') : ''), sel);
    }
  }
  x.globalAlpha = 1;
}
function heat(x: CanvasRenderingContext2D, R: InspectResult) {
  for (const r of R.res) {
    const a0 = P.areas.find(z => z.id === r.id); if (!a0 || !r.map) continue; const a = shift(a0, R.off);
    const hm = canvas(r.gw, r.gh), hx = hm.getContext('2d')!, id = hx.createImageData(r.gw, r.gh), dl = r.dlim || 1;
    for (let i = 0; i < r.gw * r.gh; i++) {
      const q0 = r.map[i] / dl; if (q0 < .5) continue; const q = Math.min(1, (q0 - .5) / 1.5);
      id.data[i * 4] = 255; id.data[i * 4 + 1] = Math.round(215 - 175 * q); id.data[i * 4 + 2] = Math.round(40 * (1 - q)); id.data[i * 4 + 3] = Math.round(255 * (.22 + .5 * q));
    }
    hx.putImageData(id, 0, 0); const [cx, cy] = ctr(a), w = (a.x1 - a.x0) * D, h = (a.y1 - a.y0) * D;
    x.save(); areaPath(x, a); x.clip(); x.translate(cx * D, cy * D); x.rotate(a.ang || 0); x.imageSmoothingEnabled = true; x.drawImage(hm, -w / 2, -h / 2, w, h); x.restore();
  }
}
export function tolTxt(m: Tool) { if (m.nom == null) return 'no tolerance set'; return `${fmtLen(m.nom)} ± ${fmtLen(mTol(m))}` }
const lamps = (R: InspectResult | null): [boolean, boolean] => [outVal(outSel('o1'), R), outVal(outSel('o2'), R)];
/** The status block for a result: verdict, worst tool, outputs. */
function readout(r: InspectResult | null, live: boolean) {
  if (!r) { setScreen({ lamps: [false, false] }); return }
  let a = '', b = ''; const mf = r.meas.find(m => !m.ok), w = r.worst;
  if (!r.pos.found) { const rt = refTool(), lim = rt ? rt.minScore || 60 : 60; a = `⌖ ${rt ? rt.name : 'Position'} not found · ${Math.round(r.pos.score * 100)}`; b = `Limit ${lim}` }
  else if (w && (w.ng || !mf)) { a = `${w.name} · ${Math.round(w.score)}`; b = `Limit ${w.limit}` }
  else { const m = mf || r.meas[0]; if (m) { const t = measures().find(z => z.id === m.id); a = `${m.name} · ${m.found ? fmtLen(m.value) : 'no edges'}`; b = t ? tolTxt(t) : '' } }
  setScreen({
    vCls: 'verdict ' + (r.ng ? 'ng' : 'ok') + (r.marg ? ' marg' : ''), vTxt: (live ? 'LIVE · ' : '') + (r.ng ? 'NG' : 'OK') + (r.marg ? ' ⚠' : ''),
    vTitle: r.marg ? 'Marginal: a tool is close to its limit' : '', a, b, lamps: live ? [false, false] : lamps(r),
  });
}
function idle(t: string, name?: string, a?: string, b?: string) { setScreen({ vCls: 'verdict idle', vTxt: t, vTitle: '', name: name || '—', nameTitle: '', a: a || '—', b: b || '—', lamps: [false, false] }) }
/** Draws the screen for the current mode: live view, master, tools being edited, a learned picture or a result. */
export function drawScreen(ts?: number) {
  const cv = DOM.view; if (!cv) return; const x = cv.getContext('2d')!;
  x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#05080a'; x.fillRect(0, 0, D, D);
  if (L.role === 'cam') {
    if (C.stream && C.video && C.video.videoWidth) {
      const v = C.video, sw = v.videoWidth, sh = v.videoHeight, s = Math.min(sw, sh); x.drawImage(v, (sw - s) / 2, (sh - s) / 2, s, s, 0, 0, D, D);
      const z = L.pcCam && L.pcCam.zoom > 1 ? L.pcCam : null;
      if (z) { const [cx0, cy0, cs] = camCrop(s, s, z); x.strokeStyle = '#F5C542'; x.lineWidth = 3; x.setLineDash([12, 8]); x.strokeRect(cx0 / s * D, cy0 / s * D, cs / s * D, cs / s * D); x.setLineDash([]) }
      setScreen({ vCls: 'verdict live', vTxt: L.conns.length ? 'LIVE · PC connected' : 'LIVE', name: `${sw}×${sh}`, nameTitle: '', a: z ? `PC zoom ×${z.zoom.toFixed(1)} (yellow box)` : (C.locked ? 'Exposure locked' : 'Auto exposure'), b: 'code ' + (L.code || '—') });
    }
    else idle('CAMERA OFF', '—', 'Press Start camera', '');
    return;
  }
  applyView(x);
  const fin = () => x.setTransform(1, 0, 0, 1, 0, 0);
  if (!P) { fin(); idle('NO PROGRAM'); return }
  if (U.mode === 'cand' && U.cand) { x.drawImage(U.cand.full, 0, 0, D, D); fin(); idle('REFERENCE?', 'candidate · ' + U.cand.size + ' px', 'Is this image good?', 'Valid or retake'); return }
  if (U.mode === 'master' && P.ref) {
    x.drawImage(P.ref.full, 0, 0, D, D); drawAreas(x, null, false); fin();
    setScreen({ vCls: 'verdict master', vTxt: 'MASTER', vTitle: '', name: `master image · ${P.ref.size} px`, nameTitle: '', a: `${P.areas.length} tool${plural(P.areas.length)}`, b: P.valid ? 'program finished' : 'program not finished' });
    readout(null, false); return;
  }
  if (U.mode === 'edit' && P.ref) {
    x.drawImage(P.ref.full, 0, 0, D, D); drawAreas(x, null, true);
    if (U.drag && U.drag.mode === 'new') { const d = U.drag; strokeArea(x, { shape: 'rect', x0: Math.min(d.sx, d.cx), y0: Math.min(d.sy, d.cy), x1: Math.max(d.sx, d.cx), y1: Math.max(d.sy, d.cy) }, SELC, '') }
    fin(); const one = U.only ? P.areas.find(a => a.id === U.only) : null;
    if (one && one.type === 'measure') { const r = measRef(one); idle('EDIT · ' + one.name, 'reference · ' + P.ref.size + ' px', r && r.found ? `On reference: ${fmtLen(r.value)}` : 'No two edges found', tolTxt(one)) }
    else idle(one ? 'EDIT · ' + one.name : 'EDIT TOOLS', 'reference · ' + P.ref.size + ' px' + (V.z > 1.01 ? ` · view ×${V.z.toFixed(1)}` : ''), `${P.areas.length} tool${plural(P.areas.length)}`, one ? 'Only this tool moves' : 'Drag · corners · ↻ handle');
    return;
  }
  if (U.mode === 'sample' && U.view) {
    const s = U.view;
    if (s._img && s._img.complete && s._img.naturalWidth) x.drawImage(s._img, 0, 0, D, D);
    else if (!s._img) { s._img = new Image(); s._img.onload = () => drawScreen(); s._img.src = URL.createObjectURL(s.blob) }
    drawAreas(x, null, false); fin();
    idle('LEARNED IMAGE', 'learned picture', checks().map(a => `${a.name} ${s.labels[a.id] === 'ng' ? 'NG' : s.labels[a.id] === 'ok' ? 'OK' : '—'}`).join(' · '), ''); return;
  }
  if (U.mode === 'result' && U.last) {
    x.drawImage(U.last.frame.full, 0, 0, D, D); if (U.heat) heat(x, U.last.r); drawAreas(x, U.last.r, false); fin();
    const mt = U.last.meta;
    setScreen({
      name: (mt ? `${mt.idx}/${mt.n} · ${shortPath(mt.path)}` + (mt.expect ? (mt.agree ? ` · ✓ folder: ${mt.expect.toUpperCase()}` : ` · ✗ folder says ${mt.expect.toUpperCase()}`) : '') + (mt.note ? ` · ${mt.note}` : '') :
        'triggered ' + new Date(U.last.ts).toLocaleTimeString() + ` · ${U.last.frame.size} px`) + (U.last.learned && !(mt && mt.learn) ? ' · learned' : ''),
      nameTitle: mt ? mt.path : '',
    });
    readout(U.last.r, false); return;
  }
  const src = liveSrc();
  if (!src) { fin(); idle(SRC.kind === 'file' ? 'FILES' : 'NO LIVE IMAGE', SRC.kind === 'phone' ? 'phone not connected' : '—', SRC.kind === 'file' ? 'Trigger opens a file' : 'Connect the phone', SRC.kind === 'phone' ? 'and start its camera' : ''); return }
  drawSrc(x, src);
  if (P.valid && P.ref && !learning) {
    if (!ts || ts - U.lastLive > 400 || !U.live) { U.lastLive = ts || 0; U.live = inspect(makeFrame(src, 900)); if (U.page === 'run') liveTick() }
    drawAreas(x, U.live, false); fin(); setScreen({ name: 'LIVE', nameTitle: '' }); readout(U.live, true);
  }
  else { if (P.ref) drawAreas(x, null, false); fin(); idle('LIVE', `LIVE · camera zoom ×${P.cam.zoom.toFixed(1)}`, P.ref ? 'Program not validated' : 'No reference yet', '') }
}
/** The screen loop: the live view and the phone camera are drawn every frame. */
export function startLoop() {
  const loop = (ts: number) => { requestAnimationFrame(loop); if (L.role === 'cam' || (U.mode === 'live' && liveSrc())) drawScreen(ts) };
  requestAnimationFrame(loop);
}
