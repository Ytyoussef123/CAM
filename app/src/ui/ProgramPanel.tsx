/* ⚙ PROGRAM: 1 Image · 2 Master · 3 Tools · 4 Learn · 5 Outputs. */
import { useEffect, useRef, type DragEvent } from 'react';
import type { Label } from '../core/types';
import { P, U, learning, render } from '../core/state';
import { checks, measures, refTool, tNum, isCheck, runOrder } from '../core/tools';
import { store } from '../core/util';
import { SRC, setSrc } from '../core/source';
import { connectPhone } from '../core/link';
import { save } from '../core/storage';
import { resetView } from '../core/view';
import {
  STEPS, stepNext, stepBack, setCam, changeZoom, renameProgram, takeRef, refValid, addArea, addMeasure, addRef,
  editOnly, copyTool, delSel, selTool3, validate,
} from '../core/actions';
import { outSel, outOptions } from '../core/outputs';
import { LB, LB_KEEP, lbAdd, lbStop, lbReady, lbNowTxt, lbFrac, okCount, ngCount, areaNames, type Batch } from '../core/folderLearn';
import { FT, ftDropFiles, type PathFile } from '../core/folderTest';
import { shortPath } from '../core/util';
import { CommitInput } from './fields';
import { ToolRows, ToolRow } from './ToolList';
import { curStep, srcInfo } from './helpers';

const files = (e: { target: HTMLInputElement }) => { const f = [...(e.target.files || [])] as PathFile[]; e.target.value = ''; return f };

function SourceStep() {
  const s = srcInfo(), cam = P ? P.cam : { zoom: 1, ox: 0, oy: 0 }, locked = !!(P && P.ref);
  return (
    <div className="sp sp1" id="srcStep">
      <div className="sec"><span className="lbl">Program name</span>
        <CommitInput className="pname" type="text" id="progName" maxLength={40} aria-label="Program name" value={P ? P.name : ''} disabled={!P} onCommit={renameProgram} /></div>
      <div className="sec">
        <div className="row"><span className="lbl">Image source</span><span className="spacer"></span><span className={s.cls} id="srcState">{s.txt}</span></div>
        <div className="seg" role="group" aria-label="Image source">
          <button type="button" id="srcPhone" aria-pressed={SRC.kind === 'phone'} onClick={() => setSrc('phone')}>📱 Phone camera</button>
          <button type="button" id="srcDemo" aria-pressed={SRC.kind === 'demo'} onClick={() => setSrc('demo')}>🎲 Demo camera</button>
          <button type="button" id="srcFile" aria-pressed={SRC.kind === 'file'} onClick={() => setSrc('file')}>📁 Image files</button>
        </div>
        <div className="row" id="phoneRow" hidden={SRC.kind !== 'phone'}><span className="hint">Code shown on the phone:</span>
          <input className="codein" type="text" id="pairIn" maxLength={6} autoComplete="off" spellCheck={false} aria-label="Phone code" value={U.pairIn}
            onChange={e => { U.pairIn = e.target.value; render() }} onKeyDown={e => { if (e.key === 'Enter') connectPhone() }} />
          <button className="btn primary" id="pairBtn" type="button" onClick={connectPhone}>Connect</button></div>
        <p className="hint" id="srcHint">{s.hint}</p>
      </div>
      <div className="sec">
        <span className="lbl">Camera zoom (saved in the program)</span>
        <div className="zrow"><input type="range" id="zoomIn" min="1" max="4" step="0.1" value={cam.zoom} aria-label="Camera zoom" disabled={locked} onChange={e => setCam('zoom', +e.target.value)} /><output id="zoomOut">{'×' + (+cam.zoom).toFixed(1)}</output></div>
        <div className="zrow" id="panRow" hidden={cam.zoom <= 1.01}><span className="lbl">Position ↔</span>
          <input type="range" id="panX" min="-1" max="1" step="0.02" value={cam.ox} aria-label="Horizontal position" disabled={locked} onChange={e => setCam('ox', +e.target.value)} /><span className="lbl">↕</span>
          <input type="range" id="panY" min="-1" max="1" step="0.02" value={cam.oy} aria-label="Vertical position" disabled={locked} onChange={e => setCam('oy', +e.target.value)} /></div>
        <div className="row" id="zoomLock" hidden={!locked}><span className="hint" id="zoomLockTxt">{`Zoom ×${(+cam.zoom).toFixed(1)} is locked by the master image.`}</span><button className="btn small" id="zoomChange" type="button" onClick={changeZoom}>Change zoom</button></div>
        <p className="hint">Keep the light constant and the camera fixed: every picture is compared with the master image.</p>
      </div>
    </div>
  );
}

function MasterStep() {
  const cand = U.mode === 'cand' && U.cand;
  return (
    <div className={'sp sp2' + (!P ? ' locked' : '')} id="refStep">
      <div className="row"><span className="lbl">Master image</span><span className="spacer"></span><span className={'state' + (P && P.ref ? ' good' : ' warn')} id="refState">{cand ? 'Check it' : P && P.ref ? 'Saved' : 'Needed'}</span></div>
      <div className="refbox" id="refBox">
        {P && P.ref ? <><img src={P.ref.thumb} alt="Master image" /><span className="hint">{`Master image saved · ${P.ref.size} px` + (P.scale ? ` · 1 px = ${(P.scale * 1000).toFixed(1)} µm` : '')}</span></> : <div className="empty">No master image yet.</div>}
      </div>
      <div className="row">
        <button className="btn primary big" id="refBtn" type="button" hidden={!!cand} onClick={takeRef}>{P && P.ref ? '📷 Register a new master' : '📷 Register master'}</button>
        <button className="btn primary big" id="refOk" type="button" hidden={!cand} onClick={refValid}>✔ Valid</button>
        <button className="btn big" id="refNo" type="button" hidden={!cand} onClick={takeRef}>↺ Not valid · retake</button>
      </div>
    </div>
  );
}

function ToolsStep() {
  const ready = !!(P && P.ref);
  if (P && !selTool3() && P.areas.length) { const t = P.areas.find(isCheck) || runOrder()[0]; U.selArea = t.id }
  const sa = selTool3(), lr = (U.mode === 'result' && U.last ? U.last.r : null) || (U.mode === 'live' && U.live) || null;
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => { if (U.addMenu) { const f = menu.current && menu.current.querySelector('button'); if (f) f.focus() } }, [U.addMenu]);
  const close = () => { U.addMenu = false; render() };
  return (
    <div className={'sp sp3' + (!ready ? ' locked' : '')} id="areaStep">
      <div className="ttools">
        <div className="addwrap">
          <button className="tile2 add" id="addBtn" type="button" aria-haspopup="menu" aria-expanded={U.addMenu} aria-controls="addMenu" disabled={!ready} onClick={e => { e.stopPropagation(); U.addMenu = !U.addMenu; render() }}><span className="ic">＋</span>Add tool</button>
          <div className="menu" id="addMenu" role="menu" hidden={!U.addMenu} ref={menu} onClick={close}
            onKeyDown={e => { if (e.key === 'Escape') { close(); document.getElementById('addBtn')?.focus() } }}>
            <button type="button" role="menuitem" id="addRect" onClick={() => addArea('rect')}>▭ Area (rectangle)</button>
            <button type="button" role="menuitem" id="addCirc" onClick={() => addArea('ellipse')}>◯ Area (circle)</button>
            <button type="button" role="menuitem" id="addMeas" onClick={addMeasure}>📏 Measure (gap, width)</button>
            <button type="button" role="menuitem" id="addRef" onClick={addRef}>{refTool() ? '⌖ Position reference (edit)' : '⌖ Position reference'}</button>
          </div>
        </div>
        <button className={'tile2' + (U.only && sa && U.only === sa.id ? ' on' : '')} id="editBtn" type="button" title="Edit only this tool, zoomed" disabled={!sa || !ready} onClick={() => { if (sa) editOnly(sa) }}><span className="ic">✎</span>Edit</button>
        <button className="tile2" id="copyBtn" type="button" title="Copy this tool" disabled={!sa || sa.type === 'ref' || !ready} onClick={() => { if (sa) copyTool(sa) }}><span className="ic">⧉</span>Copy</button>
        <button className="tile2" id="delToolBtn" type="button" title="Delete this tool" disabled={!sa || !ready} onClick={delSel}><span className="ic">✕</span>Delete</button>
        <button className="tile2" id="doneBtn" type="button" hidden={!U.only || U.mode !== 'edit'} onClick={() => { U.only = null; resetView(); render() }}><span className="ic">✓</span>Done</button>
      </div>
      {P && <ToolRows id="toolList3" label="Tools of the program" sel={U.selArea} R={lr} setup
        onSel={a => { U.selArea = a.id; U.only = null; if (P.ref) U.mode = 'edit'; resetView(); render() }} />}
      <div className="row"><span className="lbl">Settings of the selected tool</span><span className="spacer"></span>
        <span className="state" id="areaState">{sa ? `${tNum(sa)} · ${{ check: sa.shape === 'ellipse' ? 'circle area' : 'area', measure: 'measure', ref: 'position reference' }[sa.type || 'check']}` : '—'}</span></div>
      <div className="areas" id="areaList">{sa ? <ToolRow key={sa.id} a={sa} res={lr} /> : <div className="empty">{P && P.areas.length ? 'Select a tool in the list.' : 'No tool yet: press ＋ Add tool.'}</div>}</div>
      <div className="note"><b>How it decides:</b> each area remembers the pictures you taught it. A new picture is compared with the closest one: the same as a taught OK picture scores <b>100</b>, the same as a taught NG picture scores <b>0</b>, other parts score by how close they are. Below its <b>limit</b> (50 by default) the area is NG, and one NG tool makes the part NG. Parts must sit in the same place each time (or use a ⌖ position reference) and the light must stay the same.</div>
    </div>
  );
}

/* ---------- step 4 · Learn ---------- */
function Thumbs({ id, lab }: { id: string; lab: Label }) {
  const ss = P ? P.samples.filter(s => Object.values(s.labels).includes(lab)).slice(-8) : [];
  return (
    <div className="lthumbs" id={id}>
      {!ss.length ? <span className="hint">{lab === 'ok' ? 'Only the master image so far.' : 'No NG picture yet.'}</span> :
        ss.map(s => <img key={s.id} src={s.thumb} alt="" title={checks().filter(a => s.labels[a.id] === lab).map(a => a.name).join(', ')} />)}
    </div>
  );
}
/** What one folder gave, and what to check. */
function Summary({ b }: { b: Batch }) {
  const pa = Object.keys(b.perArea).map(id => `${areaNames([+id])}: ${b.perArea[+id]}`).join(', ');
  const head = <b>{`${b.kind.toUpperCase()} folder "${b.name}"` + (b.phase === 'stopped' ? ' — stopped' : b.phase === 'cancel' ? ' — not learned' : '')}</b>;
  if (b.phase === 'cancel') return <div className={'lsum' + (b.kind === 'ng' ? ' ng' : '')}>{head}<div className="hs">Not learned: learn an OK folder first, then add this NG folder again.</div></div>;
  const parts = [`${b.i} of ${b.n} picture${b.n === 1 ? '' : 's'} shown`, `${b.learned} learned` + (pa ? ` (${pa})` : '')];
  if (b.similar) parts.push(`${b.similar} like pictures already learned`);
  if (b.skipped) parts.push(`${b.skipped} skipped (in ${b.kind === 'ok' ? 'defect' : 'good'} folders)`);
  if (b.measOnly) parts.push(`${b.measOnly} seen only by a measure`);
  if (b.err) parts.push(`${b.err} could not be read`);
  const list = (title: string, arr: { it: { path: string }; areas?: number[] }[], tip: string) => !arr.length ? null : (
    <div className="warnbox"><b>{title}</b>
      <div>{arr.slice(0, 12).map(x => shortPath(x.it.path) + (x.areas ? ` (${areaNames(x.areas)})` : '')).join(' · ') + (arr.length > 12 ? ` … and ${arr.length - 12} more` : '')}</div>
      {tip && <div>{tip}</div>}</div>
  );
  return (
    <div className={'lsum' + (b.kind === 'ng' ? ' ng' : '')}>
      {head}
      <div className="hs">{parts.join(' · ')}</div>
      {list(`⚠ ${b.odd.length} picture${b.odd.length === 1 ? '' : 's'} looked very different from the others and ${b.odd.length === 1 ? 'was' : 'were'} not learned there:`, b.odd,
        'Check them: a defective part may be hidden in the folder. If one is really good, teach it alone in ▶ RUN → Additional learning.')}
      {list(`⚠ ${b.none.length} picture${b.none.length === 1 ? '' : 's'}: no area sees a defect, not learned:`, b.none,
        'The defect may be too small for the area, or outside every area. Check them; to force one area, choose it in "Learn NG in" and add the pictures again.')}
      {list(`${b.notFound.length} picture${b.notFound.length === 1 ? '' : 's'}: the position reference was not found, not learned:`, b.notFound.map(it => ({ it })), '')}
      {b.forced > 0 && <div className="warnbox">{`${b.forced} picture${b.forced === 1 ? '' : 's'} scored above the limit in the chosen area and ${b.forced === 1 ? 'was' : 'were'} taught NG anyway: good parts that look like ${b.forced === 1 ? 'it' : 'them'} will be rejected too.`}</div>}
      {b.full > 0 && <div className="hs">{`Some areas reached ${LB_KEEP} examples: more pictures would only slow learning down.`}</div>}
      {b.kind === 'ok' && b.n < 8 && b.phase === 'done' && <div className="hs">Fewer than 8 pictures: odd ones cannot be spotted automatically — check them yourself.</div>}
    </div>
  );
}
function dropZone(kind: Label) {
  return {
    onDragOver: (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.currentTarget.classList.add('drag') },
    onDragLeave: (e: DragEvent<HTMLDivElement>) => e.currentTarget.classList.remove('drag'),
    onDrop: async (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.currentTarget.classList.remove('drag'); const p = ftDropFiles(e.dataTransfer); if (lbReady() && !FT.run) lbAdd(await p, kind) },
  };
}
function LearnStep() {
  const A = P ? checks() : [], ready = lbReady(), run = LB.run;
  const nOk = P ? P.samples.filter(s => Object.values(s.labels).includes('ok')).length : 0, nNg = P ? P.samples.filter(s => Object.values(s.labels).includes('ng')).length : 0;
  if (U.lNgArea !== 'auto' && !A.some(a => String(a.id) === U.lNgArea)) U.lNgArea = 'auto';
  const dis = !ready || FT.run, b = LB.cur;
  return (
    <div className="sp sp4" id="learnStep">
      <div className="row"><span className="lbl">Learn from folders of pictures</span><span className="spacer"></span>
        <span className={'state' + (nOk || nNg ? ' good' : '')} id="learnState">{nOk + nNg ? `${nOk} OK · ${nNg} NG` : 'Optional'}</span></div>
      <div className="lblock ok" id="lbOk" {...dropZone('ok')}>
        <div className="lbh"><b>OK</b><span className="hint">good parts</span><span className="spacer"></span><span className="lcount" id="lnOk">{nOk}</span><span className="hint">learned</span></div>
        <div className="hs" id="lsOk">{A.length ? A.map(a => `${a.name}: master + ${okCount(a.id)}`).join(' · ') : ''}</div>
        <Thumbs id="ltOk" lab="ok" />
        <div className="row">
          <label className="btn primary">📁 Add OK folder(s)<input type="file" id="lOkDir" webkitdirectory="" multiple disabled={dis} onChange={e => lbAdd(files(e), 'ok')} /></label>
          <label className="btn">🖼 OK pictures<input type="file" id="lOkFiles" accept="image/*" multiple disabled={dis} onChange={e => lbAdd(files(e), 'ok')} /></label>
        </div>
      </div>
      <div className="lblock ng" id="lbNg" {...dropZone('ng')}>
        <div className="lbh"><b>NG</b><span className="hint">defective parts</span><span className="spacer"></span><span className="lcount" id="lnNg">{nNg}</span><span className="hint">learned</span></div>
        <div className="hs" id="lsNg">{A.length ? A.map(a => `${a.name}: ${ngCount(a.id)}`).join(' · ') : ''}</div>
        <Thumbs id="ltNg" lab="ng" />
        <div className="row">
          <label className="btn primary">📁 Add NG folder(s)<input type="file" id="lNgDir" webkitdirectory="" multiple disabled={dis} onChange={e => lbAdd(files(e), 'ng')} /></label>
          <label className="btn">🖼 NG pictures<input type="file" id="lNgFiles" accept="image/*" multiple disabled={dis} onChange={e => lbAdd(files(e), 'ng')} /></label>
        </div>
        <label className="toggle">Learn NG in <select id="lNgArea" aria-label="Where NG pictures are learned" value={U.lNgArea} onChange={e => { U.lNgArea = e.target.value; render() }}>
          <option value="auto">the area(s) where the defect is seen</option>
          {A.map(a => <option key={a.id} value={String(a.id)}>{`${tNum(a)} · ${a.name} only`}</option>)}
        </select></label>
        <p className="hint" id="lNgHint" hidden={!(ready && nOk < 3 && !run)}>Learn good pictures first: with only the master image, normal differences between good parts look like defects.</p>
      </div>
      <div className="row"><label className="toggle">One picture every <select id="lPer" aria-label="Time per picture" value={U.lPer} onChange={e => { U.lPer = e.target.value; store('vs1-lper', U.lPer); render() }}>
        <option value="1">1 s</option><option value="3">3 s</option><option value="5">5 s</option><option value="0">fast</option></select></label>
        <span className="spacer"></span><button className="btn" id="lStop" type="button" hidden={!run} onClick={() => { lbStop(); render() }}>■ Stop</button></div>
      <div className="ftprog" id="lProg" hidden={!run || !b || b.phase === 'start'}><i id="lBar" style={{ width: b ? Math.round(lbFrac(b) * 100) + '%' : 0 }}></i></div>
      <div className="areas" id="lOut">
        {!ready ? <div className="empty">{P && P.ref ? 'Add at least one area (▭ or ◯) in step 3: measures and the position reference do not learn.' : 'Register the master image first (step 2).'}</div> : <>
          {run && b && <p className="hint lnow" id="lNow">{lbNowTxt(b)}</p>}
          {LB.queue.length > 0 && <div className="hs">{'Waiting: ' + LB.queue.map(q => `${q.kind.toUpperCase()} "${q.name}" (${q.n})`).join(' · ')}</div>}
          {LB.log.filter(x => x.pid === P.id).map((x, i) => <Summary key={i + x.name + x.phase} b={x} />)}
        </>}
      </div>
      <div className="note"><b>How it learns:</b> each picture is triggered like a part on the line: you see it and its judgment, then it is learned. From an <b>OK</b> folder only the pictures that bring something new are kept (at most 50 per area), and pictures that look very different from the others are shown but not learned. From an <b>NG</b> folder a picture is learned as NG only in the area(s) where the defect is seen. Pictures in folders named <i>good</i> are skipped when learning NG, and the other way round. Learn the OK folders first. To add several folders, add them one after the other (they wait in line) or drag them onto the block. This step is optional: single pictures can also be taught in ▶ RUN → Additional learning.</div>
    </div>
  );
}

function OutputsStep() {
  const ok = !!(P && P.ref && (checks().length || measures().length));
  const sel = (k: 'o1' | 'o2') => (
    <select id={k + 'Sel'} aria-label={`What ${k === 'o1' ? 'OUT1' : 'OUT2'} signals`} value={outSel(k)}
      onChange={e => { if (!P) return; P.out = { ...(P.out || { o1: 'ok', o2: 'ng' }), [k]: e.target.value }; save(); render() }}>
      {outOptions().map(([v, t]) => <option key={v} value={v}>{t}</option>)}
    </select>
  );
  return (
    <div className="sp sp5" id="outStep">
      <div className="outrow"><b>OUT1</b>{sel('o1')}</div>
      <div className="outrow"><b>OUT2</b>{sel('o2')}</div>
      <p className="hint">On the VS-1 sensor these are the two isolated outputs to the PLC. In this prototype they are the two lamps under the image.</p>
      <button className="btn primary big" id="validBtn" type="button" disabled={!ok} onClick={validate}>{P && P.valid ? '✔ Finished · go to RUN' : '✔ Finish · go to RUN'}</button>
    </div>
  );
}

export function ProgramPanel() {
  const st = curStep();
  return (
    <section className="pnl ctl-only prog-only" id="progPanel" data-step={st} aria-labelledby="pStepTitle">
      <header className="pnlh"><span className="pstep" id="pStepNo">{`STEP ${st}`}</span><h2 id="pStepTitle">{STEPS[st].t}</h2>
        <span className={'state' + (P && P.valid ? ' good' : P ? ' warn' : '')} id="progState">{learning || LB.run ? 'Learning…' : P ? (P.valid ? 'Finished' : 'Not finished') : '—'}</span></header>
      <p className="hint" id="pStepHint">{STEPS[st].h}</p>
      <div className="pbody">
        <SourceStep />
        <MasterStep />
        <ToolsStep />
        <LearnStep />
        <OutputsStep />
      </div>
      <footer className="pnlf">
        <button className="btn" id="stepBack" type="button" disabled={st <= 1 || LB.run} onClick={stepBack}>◀ Back</button><span className="spacer"></span>
        <button className="btn primary" id="stepNext" type="button" hidden={st >= 5} disabled={LB.run} onClick={stepNext}>{['', 'Next: master ▶', 'Next: tools ▶', 'Next: learn ▶', P && P.samples.length ? 'Next: outputs ▶' : 'Skip · outputs ▶'][st] || 'Next ▶'}</button>
      </footer>
    </section>
  );
}

