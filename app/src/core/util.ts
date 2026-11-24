/* Constants and small helpers shared by the whole console. */

export const D = 640;          // size of the screen canvas
export const BASE = 96;        // analysis grid of the whole image (points)
export const MAXG = 192;       // largest analysis grid of one area
export const FULLMAX = 1600;   // largest full-resolution picture
export const FLOOR = 6;        // smallest normal variation (grey levels)
export const DEF_THR = 5;      // default score scale
export const BAND = 10;        // a result closer than this to its limit is "marginal": a small change could flip it
export const CONFLICT = 20;    // teaching against the sensor by this much asks for a confirmation
export const OKC = '#1FA45A', NGC = '#E0352B', EDC = '#41B8CD', SELC = '#F5C542', REFC = '#A07CF5';

export function store(k: string, v: string | null): boolean {
  try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true } catch (e) { return false }
}
export function stored(k: string): string | null { try { return localStorage.getItem(k) } catch (e) { return null } }

export const canvas = (w: number, h = w): HTMLCanvasElement => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c };
export type Drawable = HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap;
export const sizeOf = (s: Drawable): [number, number] => {
  const a = s as HTMLVideoElement & HTMLImageElement;
  return [a.videoWidth || a.naturalWidth || s.width, a.videoHeight || a.naturalHeight || s.height];
};
export function thumbOf(c: HTMLCanvasElement, n = 120, q = .7): string { const t = canvas(n); t.getContext('2d')!.drawImage(c, 0, 0, n, n); return t.toDataURL('image/jpeg', q) }
export const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>(ok => c.toBlob(b => ok(b as Blob), 'image/jpeg', .9));
export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
/** Waits ms milliseconds, but stops waiting as soon as alive() turns false. */
export async function pause(ms: number, alive: () => boolean) {
  const t = performance.now() + ms;
  while (alive() && performance.now() < t) await sleep(Math.min(100, Math.max(1, t - performance.now())));
}
export const Q = new URLSearchParams(location.search);
export const shortPath = (p: string) => p.split('/').slice(-2).join('/');
export const plural = (n: number, one = '', many = 's') => n === 1 ? one : many;
