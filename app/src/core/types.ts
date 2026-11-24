/* The data model of the console. Positions are normalized (0–1) on the square picture. */

export type Label = 'ok' | 'ng';
export type ToolType = 'check' | 'measure' | 'ref';
export type Sens = 'low' | 'normal' | 'high';

export interface Cam { zoom: number; ox: number; oy: number }
export interface Offset { dx: number; dy: number }

/** What an area learned: its OK and NG examples (grey levels on its grid) and the normal variation per point. */
export interface AreaModel { ok: Float32Array[]; ng: Float32Array[]; sd: Float32Array; okSrc: (number | 'ref')[]; ngSrc: number[] }
export interface AreaStats { nOk: number; nNg: number; okLow: number | null; ngHigh: number | null; overlap: boolean }

/** One inspection tool: check area (▭ ◯), measure (📏) or position reference (⌖). Fields starting with _ are not saved. */
export interface Tool {
  id: number; type: ToolType; name: string;
  x0: number; y0: number; x1: number; y1: number;
  // check area
  shape?: 'rect' | 'ellipse'; ang?: number; thr?: number; limit?: number | null; detail?: string; sens?: Sens;
  manual?: boolean; auto?: number; stats?: AreaStats;
  _legacyThr?: number; _m?: AreaModel; _k?: string;
  _loo?: { ok: [number | 'ref', number | null][]; ng: [number, number][] };
  // measure
  band?: number; contrast?: number; edges?: 'outer' | 'strong'; nom?: number | null; tol?: number | null;
  // position reference
  range?: number; minScore?: number;
}

export interface Sample {
  id: number; blob: Blob; thumb: string; labels: Record<number, Label>;
  cache: Record<string, Float32Array>; off: (Offset & { key: string }) | null;
  _img?: HTMLImageElement;
}

export interface TemplateCache { key: string; c?: { t: GrayRect; s: TStats }; f?: { t: GrayRect; s: TStats }; fG?: number }
export interface Ref { full: HTMLCanvasElement; size: number; blob: Blob; thumb: string; cache: Record<string, Float32Array>; tm?: TemplateCache }
export interface Outputs { o1: string; o2: string }

export interface Program {
  id: number; name: string; valid: boolean; scale: number | null; out: Outputs; cam: Cam;
  ref: Ref | null; areas: Tool[]; samples: Sample[];
}

/** A program as stored in the browser (IndexedDB 'vs1' / 'progs'): the same format as before React. */
export interface StoredProg {
  id: number; name: string; valid: boolean; scale: number | null; out: Outputs | null; cam: Cam;
  areas: Tool[]; ref: { blob: Blob; thumb: string } | null;
  samples: { id: number; blob: Blob; thumb: string; labels: Record<number, Label>; off: (Offset & { key: string }) | null }[];
}

export interface Frame { full: HTMLCanvasElement; size: number; meta?: unknown }
export interface GrayRect { g: Float32Array; w: number; h: number; kx: number; ky: number }
export interface TStats { z: Float32Array; norm: number }

export interface PosResult { dx: number; dy: number; score: number; found: boolean; none?: boolean; marg?: boolean }
export interface AreaResult {
  id: number; name: string; dev: number; score: number; limit: number; ng: boolean; marg: boolean; dlim: number;
  map: Float32Array | null; gw: number; gh: number; gray: Float32Array; key: string;
  near: number | 'ref' | null; nearNg: boolean;
}
export interface MeasResult {
  id: number; name: string; found: boolean; ok: boolean; value: number | null;
  e1?: [number, number]; e2?: [number, number]; edges?: number; marg?: boolean;
}
export interface InspectResult {
  res: AreaResult[]; meas: MeasResult[]; pos: PosResult; off: Offset;
  worst: AreaResult | null; ng: boolean; marg: boolean;
}

/** What the image line shows for a picture from a folder (test or learning). */
export interface FolderMeta { idx: number; n: number; path: string; expect: Label | null; agree: boolean | null; note: string; learn?: Label }
export interface TeachWarn { name: string; score: number; limit: number; lab: Label }

/** The last triggered (or folder) picture and how it was judged. */
export interface LastShot {
  frame: Frame; r: InspectResult; dt: number; labels: Record<number, Label>; ts: number; learned: boolean;
  test?: boolean; ft?: string; meta?: FolderMeta; warn?: TeachWarn[] | null;
}

export interface Margin { v: number | null; cls: string; okOnly?: boolean; ngOnly?: boolean; mid?: number | null }
export interface AuditFlag { area: string; lab: string; score: number }
