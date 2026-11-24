/* What the panels show, computed from the engine state. */
import type { Tool, InspectResult, AreaResult, AuditFlag, Margin } from '../core/types';
import { P, U } from '../core/state';
import { limOf, mTol } from '../core/tools';
import { fmtLen } from '../core/analysis';
import { marginOf } from '../core/learning';
import { stepOk } from '../core/actions';
import { SRC } from '../core/source';
import { L } from '../core/link';

/** The result the run list shows: the last picture, or the live view. */
export const runResult = (): InspectResult | null => U.mode === 'result' && U.last ? U.last.r : (U.mode === 'live' ? U.live : null);
export interface ToolStatus { txt: string; ok: boolean | null; fill?: number | null; lim?: number | null; marg: boolean; mg?: Margin | null; band?: [number, number]; mark?: number }
/** What the run line of a tool shows. */
export function toolStatus(a: Tool, R: InspectResult | null): ToolStatus {
  if (a.type === 'ref') {
    const p = R && R.pos, v = p && !p.none ? p.score * 100 : null;
    return { txt: v == null ? '—' : String(Math.round(v)), ok: v == null ? null : p!.found, fill: v, lim: a.minScore || 60, marg: !!(p && p.marg) };
  }
  if (a.type === 'measure') {
    const m = R && R.meas.find(z => z.id === a.id), st: ToolStatus = { txt: m ? (m.found ? fmtLen(m.value) : 'no edges') : '—', ok: m ? m.ok : null, marg: !!(m && m.marg) };
    if (a.nom != null) {
      const t = mTol(a), lo = a.nom - 3 * t, hi = a.nom + 3 * t, pc = (v: number) => Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100));
      st.band = [pc(a.nom - t), pc(a.nom + t)]; if (m && m.found) st.mark = pc(m.value!);
    }
    return st;
  }
  const r = R && R.res.find(z => z.id === a.id);
  return { txt: r ? String(Math.round(r.score)) : '—', ok: r ? !r.ng : null, fill: r ? r.score : null, lim: limOf(a), marg: !!(r && r.marg), mg: marginOf(a) };
}
export const nearTxt = (r: AreaResult | undefined) => {
  if (!r || r.near == null || !P.samples.length) return ''; const nm = r.near === 'ref' ? 'the reference' : `learned ${P.samples.findIndex(s => s.id === r.near) + 1}`;
  const k = r.nearNg ? ' (NG)' : ''; return r.dev === 0 ? ` · same as ${nm}${k}` : ` · closest: ${nm}${k}`;
};
export const flagTxt = (f: AuditFlag, ref?: boolean) => ref ? `⚠ ${f.area}: the reference scores ${f.score} against your other OK examples. If the reference part was defective, retake the reference (⚙ Program, step 1).` :
  f.lab === 'OK' ? `⚠ ${f.area}: taught OK, but judged by the other examples it scores ${f.score} (below the limit). If it was a teaching mistake, remove it.` :
    `⚠ ${f.area}: taught NG, but judged by the other examples it scores ${f.score} (above the limit): it looks like a good part. Check the label.`;
export const VERD: Record<string, string> = { good: 'Stable', fair: 'Marginal', risk: 'Not capable', unstable: 'Unstable' };
/** The program step shown: the asked one, or the last one that can be opened. */
export function curStep() { let st = U.step || 1; while (st > 1 && !stepOk(st)) st--; U.step = st; return st }
export const histTool = () => P ? P.areas.find(t => t.id === U.selTool) || null : null;
/** Image source state and hint (PROGRAM step 1). */
export function srcInfo(): { cls: string; txt: string; hint: string } {
  if (SRC.kind === 'phone') {
    const on = !!(L.conn && L.conn.open);
    return {
      cls: 'state' + (on && L.camOn ? ' good' : ' warn'), txt: on ? (L.camOn ? 'Live' : 'Camera off on phone') : 'Not connected',
      hint: L.kind === 'peer' ? 'Open this page on the phone, choose 📱 Camera, start the camera and type its code here.' : 'The phone link needs the page opened directly (GitHub Pages), not inside claude.ai. Use the demo camera or files here.',
    };
  }
  if (SRC.kind === 'demo') return { cls: 'state good', txt: 'Simulated', hint: 'A simulated camera (1280 px): a new part arrives every 2.5 s, slightly shifted, about 1 in 3 with a defect. Use it to try the whole flow without the phone.' };
  return { cls: 'state', txt: 'Files', hint: 'No live view: each Trigger or Register master asks you for an image file.' };
}
