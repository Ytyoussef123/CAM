/* Link (PeerJS): phone = camera, PC = controller. The phone shows a 6-letter code; the PC connects with it. */
import type { Peer as PeerT, DataConnection, MediaConnection, PeerOptions } from 'peerjs';
import type { Cam } from './types';
import { Q, store, stored } from './util';
import { P, U, DOM, render, flashMsg } from './state';
import { C, snap, stopCam } from './camera';
import { SRC, setSrc } from './source';
import { stopRun } from './actions';

type Msg = { type: 'snap'; id: string; img?: string | null } | { type: 'cam'; cam: Cam } | { type: 'status'; cam: boolean };
export const L: {
  role: 'ctl' | 'cam'; kind: 'peer' | 'none' | null; peer: PeerT | null; conns: DataConnection[]; conn: DataConnection | null; calls: MediaConnection[];
  video: HTMLVideoElement | null; camOn: boolean; wait: Record<string, (img: string | null) => void>; code: string | null; pcCam: Cam | null;
  stat: { t: string; cls: string }; camState: { t: string; cls: string };
} = {
  role: (stored('vs1-role2') as 'ctl' | 'cam') || (matchMedia('(pointer:coarse)').matches ? 'cam' : 'ctl'),
  kind: null, peer: null, conns: [], conn: null, calls: [], video: null, camOn: false, wait: {}, code: null, pcCam: null,
  stat: { t: '—', cls: '' }, camState: { t: '—', cls: '' },
};
export function linkStat(t: string, cls?: string) { L.stat = { t, cls: cls || '' }; render() }
function peerOpts(): PeerOptions { const h = Q.get('peer'); if (!h) return {}; const [host, port] = h.split(':'); return { host, port: +port || 443, path: '/', secure: (+port || 443) === 443 } }
let PeerCls: typeof PeerT | null = null;
/** PeerJS is part of the page; it is only started outside claude.ai. */
export async function loadPeerJs() { if (!PeerCls) PeerCls = (await import('peerjs')).Peer }
function newCode() { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; return s }
export function sendStatus() { for (const c of L.conns) if (c.open) try { c.send({ type: 'status', cam: !!C.stream }) } catch (e) { /* closed */ } }
export function sendCam() { if (L.conn && L.conn.open && P) try { L.conn.send({ type: 'cam', cam: P.cam }) } catch (e) { /* closed */ } }
export function callPCs() {
  for (const c of L.calls) try { c.close() } catch (e) { /* closed */ }
  L.calls = []; if (!L.peer || !C.stream) return;
  for (const c of L.conns) if (c.open) L.calls.push(L.peer.call(c.peer, C.stream));
}
function flashScreen() { if (DOM.screen) DOM.screen.animate([{ filter: 'brightness(1.8)' }, { filter: 'none' }], { duration: 180 }) }
/** Phone: waits for the PC with its code. */
function startCamPeer() {
  if (L.peer) { L.peer.destroy(); L.peer = null }
  let code = stored('vs1-code'); if (!code) { code = newCode(); store('vs1-code', code) }
  L.code = code; L.camState = { t: 'Waiting for PC', cls: '' }; render();
  const p = new PeerCls!('vs1-' + code, peerOpts()); L.peer = p;
  p.on('open', () => linkStat('ready · code ' + code, 'on'));
  p.on('error', e => { if (e.type === 'unavailable-id') { store('vs1-code', newCode()); setTimeout(startCamPeer, 500) } else linkStat('link error: ' + e.type, 'err') });
  p.on('disconnected', () => { try { p.reconnect() } catch (e) { /* retried by PeerJS */ } });
  p.on('connection', c => {
    c.on('open', () => {
      L.conns.push(c); L.camState = { t: 'PC connected', cls: 'good' }; linkStat('PC connected', 'on');
      c.send({ type: 'status', cam: !!C.stream }); if (C.stream) L.calls.push(p.call(c.peer, C.stream)); render();
    });
    c.on('data', d => {
      const m = d as Msg; if (!m) return;
      if (m.type === 'snap') { c.send({ type: 'snap', id: m.id, img: snap() }); flashScreen() }
      if (m.type === 'cam' && m.cam && typeof m.cam.zoom === 'number') L.pcCam = { zoom: Math.min(4, Math.max(1, m.cam.zoom)), ox: +m.cam.ox || 0, oy: +m.cam.oy || 0 };
    });
    c.on('close', () => { L.conns = L.conns.filter(x => x !== c); if (!L.conns.length) { L.camState = { t: 'Waiting for PC', cls: '' }; linkStat('ready · code ' + code, 'on') } render() });
  });
}
/** PC: connects to the phone whose code was typed. */
export function connectPhone() {
  if (L.kind !== 'peer') { render(); return }
  if (L.peer) { L.peer.destroy(); L.peer = null } L.conn = null; L.camOn = false;
  const code = (U.pairIn || '').trim().toLowerCase();
  if (code.length !== 6) { flashMsg('Type the 6-letter code shown on the phone.'); return }
  store('vs1-pair', code); linkStat('connecting…');
  const p = new PeerCls!(peerOpts()); L.peer = p;
  p.on('open', () => {
    const c = p.connect('vs1-' + code, { reliable: true }); L.conn = c;
    c.on('open', () => { linkStat('phone ' + code + ' connected', 'on'); sendCam(); render() });
    c.on('data', d => {
      const m = d as Msg; if (!m) return; if (m.type === 'status') { L.camOn = !!m.cam; render() }
      if (m.type === 'snap') { const f = L.wait[m.id]; delete L.wait[m.id]; if (f) { if (m.img) f(m.img); else f(null) } }
    });
    c.on('close', () => { L.camOn = false; linkStat('phone disconnected', 'err'); if (L.video) L.video.srcObject = null; render() });
  });
  p.on('call', call => {
    call.answer(); call.on('stream', st => {
      if (!L.video) { L.video = document.createElement('video'); L.video.playsInline = true; L.video.muted = true; L.video.setAttribute('playsinline', '') }
      L.video.srcObject = st; L.video.play().catch(() => { /* autoplay blocked: the next frame retries */ }); render();
    });
  });
  p.on('error', e => linkStat(e.type === 'peer-unavailable' ? 'code not found — is the phone page open?' : 'link error: ' + e.type, 'err'));
}
/** This device is the PC (controller) or the phone (camera). */
export function setRole(r: 'ctl' | 'cam') {
  L.role = r; store('vs1-role2', r); stopRun();
  if (r === 'ctl') { stopCam(); if (L.kind === 'peer') { if (L.peer) { L.peer.destroy(); L.peer = null } L.conns = []; if (SRC.kind === 'phone') setSrc('phone') } }
  else { if (L.kind === 'peer') startCamPeer(); else linkStat('needs the GitHub Pages address', 'err') }
  render();
}
