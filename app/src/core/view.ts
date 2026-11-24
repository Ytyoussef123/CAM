/* Screen zoom (display only): the PC screen can be zoomed with the wheel, panned, and reset with Fit. */
import { D } from './util';

export const V = { z: 1, cx: .5, cy: .5 };
export function clampView() { V.z = Math.min(8, Math.max(1, V.z)); const h = .5 / V.z; V.cx = Math.min(1 - h, Math.max(h, V.cx)); V.cy = Math.min(1 - h, Math.max(h, V.cy)) }
export function resetView() { V.z = 1; V.cx = V.cy = .5 }
export const toImg = (sx: number, sy: number): [number, number] => [V.cx + (sx - .5) / V.z, V.cy + (sy - .5) / V.z];
export function zoomBy(f: number, sx = .5, sy = .5) { const [ix, iy] = toImg(sx, sy); V.z *= f; clampView(); V.cx = ix - (sx - .5) / V.z; V.cy = iy - (sy - .5) / V.z; clampView() }
export function applyView(x: CanvasRenderingContext2D) { x.setTransform(V.z, 0, 0, V.z, D * (.5 - V.cx * V.z), D * (.5 - V.cy * V.z)) }
