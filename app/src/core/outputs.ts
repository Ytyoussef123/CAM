/* OUT1 / OUT2: what the two outputs (lamps under the image) signal. */
import type { InspectResult } from './types';
import { P } from './state';
import { refTool, runOrder, tNum } from './tools';

export const outSel = (k: 'o1' | 'o2') => (P && P.out && P.out[k]) || (k === 'o1' ? 'ok' : 'ng');
export function outName(v: string) {
  if (v === 'ok') return 'OK'; if (v === 'ng') return 'NG'; if (v === 'marg') return '⚠ marginal'; if (v === 'none') return '—';
  const a = P && P.areas.find(t => 't:' + t.id === v); return a ? a.name + ' NG' : '?';
}
export function outOptions(): [string, string][] {
  const o: [string, string][] = [['ok', 'Part OK'], ['ng', 'Part NG'], ['marg', 'Marginal result ⚠ (close to a limit)']];
  if (P) for (const a of runOrder()) o.push([`t:${a.id}`, `${tNum(a)} · ${a.name} NG` + (a.type === 'ref' ? ' (part not found)' : '')]);
  o.push(['none', 'Not used']); return o;
}
/** Is an output on, for a result (null = no result)? */
export function outVal(v: string, R: InspectResult | null): boolean {
  if (!R) return false;
  if (v === 'ok') return !R.ng; if (v === 'ng') return !!R.ng; if (v === 'marg') return !!R.marg; if (v === 'none') return false;
  const id = +String(v).slice(2), x = R.res.find(z => z.id === id); if (x) return !!x.ng;
  const m = R.meas.find(z => z.id === id); if (m) return !m.ok;
  const rt = refTool(); return !!(rt && rt.id === id && !R.pos.found);
}
/** The lamp colour class of an output. */
export const lampKind = (v: string) => v === 'ok' ? 'okl' : v === 'marg' ? 'mgl' : 'ngl';
