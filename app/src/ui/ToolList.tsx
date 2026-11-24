/* Tool lines (RUN and PROGRAM step 3) and the settings of the selected tool. */
import type { CSSProperties } from 'react';
import type { Tool, InspectResult } from '../core/types';
import { REFC } from '../core/util';
import { P, U, render } from '../core/state';
import { runOrder, tNum, tIcon, limOf, mTol } from '../core/tools';
import { grid, fmtLen, unit } from '../core/analysis';
import { marginOf, marginTxt, inspect, learnAll } from '../core/learning';
import { save } from '../core/storage';
import { editOnly, copyTool, delArea, afterLimit, centerLimit, measRef, setNominal, calibrate, stopRun } from '../core/actions';
import { drawScreen } from '../core/draw';
import { toolStatus } from './helpers';
import { CommitInput, Slider } from './fields';

/** Compact tool lines: number, icon, name, margin, OK/NG, value, bar. */
export function ToolRows({ id, label, sel, onSel, R, setup }: { id: string; label: string; sel: number | null; onSel: (a: Tool) => void; R: InspectResult | null; setup?: boolean }) {
  const tools = runOrder();
  return (
    <div className="tlist" id={id} aria-label={label}>
      {!tools.length && <div className="empty">No tool yet: press ＋ Add tool.</div>}
      {tools.map(a => {
        const s = toolStatus(a, R), mg = s.mg, showMg = !!(mg && mg.v != null);
        const val = setup && s.ok == null ? (s.lim != null ? `limit ${s.lim}` : a.type === 'measure' ? (a.nom != null ? `${fmtLen(a.nom)} ± ${fmtLen(mTol(a))}` : 'no tolerance') : '—') : s.txt;
        return (
          <button key={a.id} className={'trow' + (a.id === sel ? ' sel' : '')} type="button" data-id={a.id} aria-pressed={a.id === sel} onClick={() => onSel(a)}>
            <span className="tn">{tNum(a)}</span><span className="ti">{tIcon(a)}</span><span className="tname">{a.name}</span>
            <span className={'mg' + (showMg ? ' ' + mg!.cls : '')} hidden={!showMg} title={showMg ? marginTxt(mg!) : undefined}>{showMg ? `margin ${mg!.v}` : ''}</span>
            <span className={'tbadge' + (s.ok == null ? '' : s.ok ? ' ok' : ' ng') + (s.marg ? ' marg' : '')} hidden={!!setup && s.ok == null}
              title={s.marg ? 'Marginal: close to the limit, a small change could flip this result' : undefined}>{s.ok == null ? '—' : (s.marg ? '⚠ ' : '') + (s.ok ? 'OK' : 'NG')}</span>
            <span className="tval">{val}</span>
            <div className="tbar">
              <i className="tband" hidden={!s.band} style={s.band ? { left: s.band[0] + '%', width: (s.band[1] - s.band[0]) + '%' } : undefined}></i>
              <i className={'tfill' + (s.ok === false ? ' ng' : '')} hidden={s.fill == null} style={s.fill != null ? { width: Math.max(0, Math.min(100, s.fill)) + '%' } : undefined}></i>
              <i className="tlim" hidden={s.lim == null} style={s.lim != null ? { left: `calc(${s.lim}% - 1px)` } : undefined}></i>
              <i className="tmark" hidden={s.mark == null} style={s.mark != null ? { left: s.mark + '%' } : undefined}></i>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/** The OK / NG limit of a tool, on the 0–100 score. */
export function LimitRow({ a }: { a: Tool }) {
  if (a.type === 'ref') return <Slider label="Min match" min={0} max={100} step={1} val={a.minScore || 60} fmt={String}
    onInput={v => { a.minScore = v; afterLimit() }} onCommit={() => { if (U.last) U.last.r = inspect(U.last.frame); save(); render() }} />;
  const m = marginOf(a);
  const extra = (
    <span className="tools">
      <button className="btn small" type="button" title="Back to the default limit (50)" onClick={() => { a.limit = 50; afterLimit(); render() }}>↺ 50</button>
      {m && m.mid != null && m.mid !== limOf(a) && <button className="btn small" type="button" title="Put the limit half way between the lowest OK example and the highest NG example: the biggest margin on both sides" onClick={() => centerLimit(a)}>⇔ {m.mid}</button>}
    </span>
  );
  return <Slider label="Limit" min={0} max={100} step={1} val={limOf(a)} fmt={String} onInput={v => { a.limit = v; afterLimit() }} extra={extra} />;
}

/** Nominal ± tolerance of a measure, in mm when calibrated. */
export function TolInputs({ a }: { a: Tool }) {
  const k = P.scale || 1;
  return (
    <div className="opts">
      <span className="lbl">Nominal</span>
      <CommitInput type="number" className="num" step="any" aria-label="Nominal" value={a.nom != null ? String(+(a.nom * k).toFixed(3)) : ''}
        onCommit={s => { const v = parseFloat(s); a.nom = isFinite(v) ? v / k : null; if (a.nom != null && a.tol == null) a.tol = Math.max(2, a.nom * .05); afterLimit(); render() }} />
      <span className="lbl">±</span>
      <CommitInput type="number" className="num" step="any" min={0} aria-label="Tolerance" value={a.nom != null ? String(+(mTol(a) * k).toFixed(3)) : ''}
        onCommit={s => { const v = parseFloat(s); a.tol = isFinite(v) && v >= 0 ? v / k : null; afterLimit(); render() }} />
      <span className="val">{unit()}</span>
    </div>
  );
}

/** Settings of one tool (PROGRAM step 3). */
export function ToolRow({ a, res }: { a: Tool; res: InspectResult | null }) {
  const kind = a.type || 'check';
  const sw: CSSProperties = {};
  if (a.shape === 'ellipse') sw.borderRadius = '50%';
  if (kind === 'measure') sw.border = '0'; else if (kind === 'ref') sw.borderColor = REFC;
  if (kind === 'check' && a.ang) sw.transform = `rotate(${a.ang}rad)`;
  let valCls = 'val', valTxt = '';
  if (kind === 'check') { const r = res && res.res.find(z => z.id === a.id); if (r) { valCls = 'val ' + (r.ng ? 'ng' : 'ok'); valTxt = `${r.ng ? 'NG' : 'OK'} ${Math.round(r.score)}` } }
  else if (kind === 'measure') {
    const r = res && res.meas.find(z => z.id === a.id);
    if (r) { valCls = 'val ' + (r.ok ? 'ok' : 'ng'); valTxt = r.found ? fmtLen(r.value) : 'no edges' }
    else { const rr = measRef(a); valTxt = rr && rr.found ? 'ref ' + fmtLen(rr.value) : 'ref: no edges' }
  }
  else { const p = res && res.pos; if (p && !p.none) { valCls = 'val ' + (p.found ? 'ok' : 'ng'); valTxt = `${p.found ? 'OK' : 'NG'} ${Math.round(p.score * 100)}` } }
  const head = (
    <>
      <span className="sw" style={sw}>{kind === 'measure' ? '📏' : null}</span>
      <CommitInput type="text" value={a.name} maxLength={24} aria-label="Tool name"
        onFocus={() => { U.selArea = a.id; if (P.ref && U.mode !== 'edit') { stopRun(); U.mode = 'edit'; render() } else drawScreen() }}
        onCommit={v => { a.name = v.trim() || a.name; save(); render() }} />
      <span className={valCls}>{valTxt}</span>
      <span className="tools">
        <button className={'ed' + (U.only === a.id ? ' on' : '')} type="button" title={U.only === a.id ? 'Stop editing this tool' : 'Edit only this tool (zoomed)'} disabled={!P.ref} onClick={() => editOnly(a)}>✎</button>
        {kind !== 'ref' && <button className="ed" type="button" title="Copy this tool" disabled={!P.ref} onClick={() => copyTool(a)}>⧉</button>}
        <button className="x" type="button" title="Delete" onClick={() => delArea(a)}>✕</button>
      </span>
    </>
  );
  const cls = 'area' + (U.selArea === a.id && U.mode === 'edit' ? ' sel' : '') + (U.only && U.only !== a.id && U.mode === 'edit' ? ' dim' : '');
  if (kind === 'check') {
    const g = grid(a), deg = Math.round((a.ang || 0) * 180 / Math.PI), st = a.stats, mg = marginOf(a);
    return (
      <div className={cls}>
        {head}
        <div className="opts">
          <span className="shape">
            {([['rect', '▭', 'Rectangle'], ['ellipse', '◯', 'Circle / ellipse']] as const).map(([k, t, ti]) =>
              <button key={k} className={a.shape === k ? 'on' : ''} type="button" title={ti} onClick={() => { a.shape = k; P.valid = false; U.selArea = a.id; if (P.ref) U.mode = 'edit'; save(); learnAll() }}>{t}</button>)}
          </span>
          <span className="lbl">Detail</span>
          <select aria-label={a.name + ' detail'} value={String(a.detail || 'auto')} onChange={e => { a.detail = e.target.value; P.valid = false; save(); learnAll() }}>
            {[['auto', 'Auto'], ['1', '×1'], ['2', '×2'], ['4', '×4'], ['8', '×8']].map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
          <span className="val">{`${g.gw}×${g.gh} pts · zoom ×${g.k.toFixed(1)}`}</span>
          <span className="lbl">Sensitivity</span>
          <select aria-label={a.name + ' sensitivity'} value={a.sens || 'normal'} title="Low: tolerant · Normal · High: also finds faint differences (check with the repeatability test)"
            onChange={e => { a.sens = e.target.value as Tool['sens']; save(); learnAll() }}>
            {[['low', 'Low'], ['normal', 'Normal'], ['high', 'High']].map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
          {deg !== 0 && <button className="btn small" type="button" title="Angle reset" onClick={() => { a.ang = 0; P.valid = false; save(); learnAll() }}>{`⟲ ${deg}° → 0°`}</button>}
        </div>
        <LimitRow a={a} />
        {st && <div className={'stats' + (st.overlap ? ' warn' : '')} title="Lowest / highest: how the examples score when each one is judged without itself — how well this area tells OK from NG">
          {`${st.nOk} OK example${st.nOk > 1 ? 's' : ''}` + (st.okLow != null ? ` (lowest ${Math.round(st.okLow)})` : '') + ` · ${st.nNg} NG` + (st.ngHigh != null ? ` (highest ${Math.round(st.ngHigh)})` : '') +
            (st.overlap ? ' · OK and NG overlap: move or shrink the area, or raise the detail' : '')}</div>}
        <div className="opts"><span className={'mg ' + (mg ? mg.cls : 'none')} title="Safety margin: distance between the limit and the closest taught example (each judged without itself). Green ≥ 20, orange ≥ 10, red below.">{marginTxt(mg)}</span></div>
      </div>
    );
  }
  if (kind === 'measure') return (
    <div className={cls}>
      {head}
      <div className="opts">
        <span className="lbl">Edges</span>
        <select aria-label="Edges" value={a.edges || 'outer'} onChange={e => { a.edges = e.target.value as Tool['edges']; save(); render() }}>
          <option value="outer">First edge from each end</option><option value="strong">Two strongest edges</option>
        </select>
        <button className="btn small" type="button" onClick={() => setNominal(a)}>Set from reference</button>
        <button className="btn small" type="button" onClick={() => calibrate(a)}>{P.scale ? 'Recalibrate mm' : 'Calibrate mm'}</button>
      </div>
      <Slider label="Edge contrast" min={5} max={120} step={1} val={a.contrast || 25} fmt={String} onInput={v => { a.contrast = v; drawScreen(); save() }} />
      <Slider label="Line width" min={.005} max={.15} step={.005} val={a.band || .03} fmt={v => (v * 100).toFixed(1) + '%'} onInput={v => { a.band = v; drawScreen(); save() }} />
      <TolInputs a={a} />
    </div>
  );
  const p = res && res.pos;
  return ( // position reference
    <div className={cls}>
      {head}
      <Slider label="Search range ±" min={5} max={45} step={1} val={a.range || 20} fmt={v => v + '%'} onInput={v => { a.range = v; drawScreen() }} onCommit={() => { save(); learnAll() }} />
      <LimitRow a={a} />
      <div className="stats">{p && p.found && !p.none ? `Part moved by ${(p.dx * (P.ref ? P.ref.size : 0)).toFixed(1)} px, ${(p.dy * (P.ref ? P.ref.size : 0)).toFixed(1)} px → all tools follow` :
        'Draw it on a distinctive, sharp part of the piece (a hole, a corner, a logo). All other tools follow it.'}</div>
    </div>
  );
}
