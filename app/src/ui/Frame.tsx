/* The frame of the console: toolbar, program steps, message box, phone pairing, status bar, dialog. */
import { Fragment, useEffect, useRef } from 'react';
import { P, U, progs } from '../core/state';
import { LB } from '../core/folderLearn';
import { SRC } from '../core/source';
import { L, setRole } from '../core/link';
import { C } from '../core/camera';
import { DLG } from '../core/dialog';
import { STEPS, stepDone, stepOk, setStep, setPage, newProgram, openProgram, deleteProgram } from '../core/actions';
import { curStep } from './helpers';

const pad = (id: number) => String(id).padStart(2, '0');

export function Toolbar() {
  const ok = !!(P && P.valid), cam = L.role === 'cam';
  const list = [...progs].sort((a, b) => a.id - b.id).map(p => ({ id: p.id, name: p.name }));
  if (P && !list.some(p => p.id === P.id)) list.push({ id: P.id, name: P.name }); // a new program, saved a moment later
  list.sort((a, b) => a.id - b.id);
  return (
    <header className="tb">
      <div className="brand">VS-1<small>Vision Sensor</small></div>
      <div className="modes ctl-only" role="group" aria-label="Mode">
        <button className="tile" type="button" id="pageRun" aria-pressed={U.page === 'run'} onClick={() => setPage('run')}><span className="ic">▶</span>RUN</button>
        <button className="tile" type="button" id="pageProg" aria-pressed={U.page !== 'run'} onClick={() => setPage('prog')}><span className="ic">⚙</span>PROGRAM</button>
      </div>
      <div className="progbox ctl-only"><span className="lbl">Program</span>
        <div className="row">
          <select className="prog" id="progSel" aria-label="Program" value={P ? String(P.id) : ''} disabled={LB.run} onChange={e => openProgram(+e.target.value)}>
            {list.map(p => <option key={p.id} value={p.id}>{`P${pad(p.id)} · ${p.name}`}</option>)}
            {!list.length && <option value="">No program</option>}
          </select>
          <button className="btn small" id="newBtn" type="button" disabled={LB.run} onClick={newProgram}>+ New</button>
          <button className="btn small" id="delBtn" type="button" title="Delete this program" aria-label="Delete this program" disabled={!P || LB.run} onClick={deleteProgram}>🗑</button>
        </div>
      </div>
      <span className="spacer"></span>
      <div className="stat"><span className="lbl">This device is</span>
        <div className="seg" role="group" aria-label="Device role">
          <button type="button" id="roleCtl" aria-pressed={L.role === 'ctl'} onClick={() => setRole('ctl')}>🖥 PC · controller</button>
          <button type="button" id="roleCam" aria-pressed={L.role === 'cam'} onClick={() => setRole('cam')}>📱 Camera</button>
        </div>
      </div>
      <span className={'mode' + (U.timer && !cam ? ' run' : '')} id="modeTag">{cam ? 'CAMERA' : U.timer ? 'RUN' : ok ? 'READY' : 'SETUP'}</span>
    </header>
  );
}

export function StepBar() {
  const st = curStep();
  return (
    <nav className="steps ctl-only prog-only" aria-label="Program steps">
      {[1, 2, 3, 4, 5].map(n => (
        <Fragment key={n}>
          <button className={'stab' + (stepDone(n) ? ' done' : '')} type="button" id={'st' + n} data-step={n} aria-current={n === st ? 'step' : 'false'} disabled={!stepOk(n) || LB.run} onClick={() => setStep(n)}><b>{n}</b>{STEPS[n].t}</button>
          {n < 5 && <span className="sarr" aria-hidden="true">▶</span>}
        </Fragment>
      ))}
    </nav>
  );
}

export function MsgBox() { return <div className="msgbox ctl-only" id="msgBox" role="status" hidden={!U.msg}>{U.msg}</div> }

export function CamPair() {
  return (
    <section className="step cam-only" id="camPair">
      <div className="stephead"><span className="stepnum">⇄</span><h2>Link to the PC</h2><span className={'state' + (L.camState.cls ? ' ' + L.camState.cls : '')} id="camState">{L.camState.t}</span></div>
      <div className="row"><span className="hint">On the PC, choose <b>Phone camera</b> (PROGRAM, step 1) and type this code:</span><span className="code" id="pairCode">{L.code || '······'}</span></div>
      <p className="hint" id="camHint">Keep this page open, the screen on, and the phone fixed. The PC takes the pictures.</p>
    </section>
  );
}

export function StatusBar() {
  const src = L.role === 'cam' ? (C.stream ? 'This phone camera' : 'Camera off') :
    ({ phone: 'Phone camera', demo: 'Demo camera', file: 'Image files' }[SRC.kind] || '') + (P && P.ref ? ` · ${P.ref.size} px` : '');
  return (
    <footer className="sbar" aria-label="Status">
      <span>Source: <b id="srcStat">{src}</b></span>
      <span className="ctl-only" id="sbZoom">{P ? `Camera zoom ×${(+P.cam.zoom).toFixed(1)}` : ''}</span>
      <span>Link: <span className={'link' + (L.stat.cls ? ' ' + L.stat.cls : '')} id="linkStat">{L.stat.t}</span></span>
      <span className="ctl-only" id="sbLearn">{P ? `${P.areas.length} tool${P.areas.length === 1 ? '' : 's'} · ${P.samples.length} learned image${P.samples.length === 1 ? '' : 's'}` + (P.scale ? ` · 1 px = ${(P.scale * 1000).toFixed(1)} µm` : '') : ''}</span>
      <span className="spacer"></span>
      <span>VS-1 prototype</span>
    </footer>
  );
}

/** The in-page question (Delete?, Calibrate, …). */
export function Dialog() {
  const d = DLG, inp = useRef<HTMLInputElement>(null), b1 = useRef<HTMLButtonElement>(null), b2 = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!d) return; (inp.current || (d.safe ? b2.current : b1.current))?.focus() }, [d]);
  if (!d) return null;
  return (
    <div className="askbg" onKeyDown={e => { if (e.key === 'Escape') d.done(null); else if (e.key === 'Enter' && inp.current) d.done(inp.current.value) }}>
      <div className="askbox" role="dialog" aria-modal="true">
        <p>{d.text}</p>
        {d.input != null && <input ref={inp} type="text" defaultValue={d.input} className="askin" aria-label={d.text} />}
        <div className="row">
          <button ref={b1} className={d.safe ? 'btn' : 'btn primary'} type="button" onClick={() => d.done(inp.current ? inp.current.value : true)}>{d.ok}</button>
          <button ref={b2} className={d.safe ? 'btn primary' : 'btn'} type="button" onClick={() => d.done(null)}>{d.cancel}</button>
        </div>
      </div>
    </div>
  );
}

