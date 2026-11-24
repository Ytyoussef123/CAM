/* Phone camera (Camera role): the phone only takes pictures; everything else is done on the PC. */
import { canvas } from './util';
import { render } from './state';
import { callPCs, sendStatus } from './link';

export const C: {
  stream: MediaStream | null; video: HTMLVideoElement | null; facing: 'environment' | 'user'; locked: boolean;
  wake?: WakeLockSentinel; msg: string; msgErr: boolean;
} = {
  stream: null, video: null, facing: 'environment', locked: false,
  msg: 'This phone is only the camera: everything is done from the PC. Fix the phone above the part and start the camera.', msgErr: false,
};
function camMsg(t: string, err?: boolean) { C.msg = t; C.msgErr = !!err; render() }
export async function startCam() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camMsg('The camera needs this page opened directly over https (GitHub Pages), not inside claude.ai.', true); return }
  try {
    stopCam();
    C.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: C.facing }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
    if (!C.video) { C.video = document.createElement('video'); C.video.playsInline = true; C.video.muted = true; C.video.setAttribute('playsinline', '') }
    C.video.srcObject = C.stream; await C.video.play(); C.locked = false;
    camMsg('Camera on. Fix the phone above the part. Everything else is done on the PC.');
    callPCs(); sendStatus(); render();
    try { if (navigator.wakeLock) C.wake = await navigator.wakeLock.request('screen') } catch (e) { /* the screen may turn off */ }
  } catch (e) {
    C.stream = null; const n = (e as Error) && (e as Error).name;
    camMsg(n === 'NotAllowedError' ? 'Camera blocked. Open this page directly (GitHub Pages address) and allow the camera.' : 'Could not open the camera (' + (n || e) + ').', true);
  }
}
export function stopCam() { if (C.stream) { C.stream.getTracks().forEach(t => t.stop()); C.stream = null; sendStatus(); render() } }
export async function lockCam() {
  const tr = C.stream && C.stream.getVideoTracks()[0]; if (!tr) return;
  const caps = (tr.getCapabilities ? tr.getCapabilities() : {}) as Record<string, string[] | undefined>, adv: Record<string, string> = {}, mode = C.locked ? 'continuous' : 'manual';
  for (const k of ['exposureMode', 'whiteBalanceMode', 'focusMode']) if (caps[k] && caps[k]!.includes(mode)) adv[k] = mode;
  if (!Object.keys(adv).length) { camMsg('This phone browser cannot lock exposure. Keep the light constant.', true); return }
  try { await tr.applyConstraints({ advanced: [adv as MediaTrackConstraintSet] }); C.locked = !C.locked; render() } catch (e) { camMsg('Lock failed: ' + (e as Error).name, true) }
}
/** Full camera frame at native resolution; the PC applies the program's zoom. */
export function snap(): string | null {
  if (!C.stream || !C.video || !C.video.videoWidth) return null; const v = C.video, c = canvas(v.videoWidth, v.videoHeight); c.getContext('2d')!.drawImage(v, 0, 0); return c.toDataURL('image/jpeg', .9);
}
