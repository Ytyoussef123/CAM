/* Left side: status block, screen zoom bar, the image, camera buttons (phone), counters and output lamps. */
import { useEffect, useRef } from 'react';
import { P, U, SCR, DOM, render } from '../core/state';
import { V, resetView } from '../core/view';
import { drawScreen } from '../core/draw';
import { attachPointer, zoomAt } from '../core/pointer';
import { resetCounters } from '../core/actions';
import { outSel, outName, lampKind } from '../core/outputs';
import { L } from '../core/link';
import { C, startCam, stopCam, lockCam } from '../core/camera';
import { useScreen } from './hooks';

function StatusRow() {
  useScreen();
  const prog = L.role === 'cam' ? 'VS-1 camera' : P ? `P${String(P.id).padStart(2, '0')} · ${P.name}` : '—';
  return (
    <div className="statusrow">
      <div className={SCR.vCls} id="verdict" role="status" title={SCR.vTitle || undefined}>{SCR.vTxt}</div>
      <div className="sinfo">
        <div className="pname" id="progStat">{prog}</div>
        <div id="imgName" title={SCR.nameTitle || undefined}>{SCR.name}</div>
        <div><span id="roScore">{SCR.a}</span> · <span id="roThr">{SCR.b}</span></div>
      </div>
    </div>
  );
}

function Screen() {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => { DOM.view = cv.current; const off = attachPointer(cv.current!); drawScreen(); return () => { off(); DOM.view = null } }, []);
  return <div className="screenwrap"><div className="screen" ref={el => { DOM.screen = el }}><canvas id="view" width={640} height={640} ref={cv}></canvas></div></div>;
}

function Counters() {
  useScreen();
  const tot = U.c.ok + U.c.ng, tm = U.times;
  const o1 = outSel('o1'), o2 = outSel('o2');
  return (
    <div className="counters ctl-only">
      <div className="cbox"><span className="lbl">Time</span>
        <b id="cTime">{tm.length ? Math.round(tm[tm.length - 1]) + ' ms' : '—'}</b>
        <small id="cTimeS">{tm.length ? `max ${Math.round(Math.max(...tm))} · min ${Math.round(Math.min(...tm))} · avg ${Math.round(tm.reduce((s, v) => s + v, 0) / tm.length)}` : 'max · min · avg'}</small></div>
      <div className="cbox"><span className="lbl">Trigger</span><b id="cTotal">{tot}</b>
        <small>OK <i id="cOk">{U.c.ok}</i> · NG <i id="cNg">{U.c.ng}</i> · NG rate <i id="cRate">{(tot ? U.c.ng / tot * 100 : 0).toFixed(1) + '%'}</i></small>
        <small id="cMarg">{U.c.marg ? `⚠ ${U.c.marg} marginal` : ''}</small></div>
      <div className="cbox lamps" aria-label="Outputs">
        <div className={'lamp ' + lampKind(o1) + (SCR.lamps[0] ? ' on' : '')} id="lampOk"><i></i><span id="o1Lbl">{'OUT1 · ' + outName(o1)}</span></div>
        <div className={'lamp ' + lampKind(o2) + (SCR.lamps[1] ? ' on' : '')} id="lampNg"><i></i><span id="o2Lbl">{'OUT2 · ' + outName(o2)}</span></div>
      </div>
      <button className="btn small" id="resetBtn" type="button" onClick={resetCounters}>↺ Reset</button>
    </div>
  );
}

export function ImagePanel() {
  return (
    <section className="left" aria-label="Image">
      <StatusRow />
      <div className="imgbar ctl-only">
        <span className="vz" aria-label="Screen zoom">
          <button className="btn small" id="vzOut" type="button" aria-label="Zoom out" onClick={() => zoomAt(1 / 1.5)}>−</button>
          <output id="vzVal">{'×' + V.z.toFixed(1)}</output>
          <button className="btn small" id="vzIn" type="button" aria-label="Zoom in" onClick={() => zoomAt(1.5)}>+</button>
          <button className="btn small" id="vzFit" type="button" onClick={() => { resetView(); render() }}>⛶ Fit</button>
        </span>
        <label className="toggle"><input type="checkbox" id="heatT" checked={U.heat} onChange={e => { U.heat = e.target.checked; render() }} /> Defect heat map</label>
        <span className="spacer"></span>
        <button className="btn small" id="liveBtn" type="button" disabled={U.mode === 'live'} onClick={() => { U.mode = 'live'; U.view = null; render() }}>● Live view</button>
      </div>
      <Screen />
      <div className="cambar cam-only">
        <button className={'btn' + (C.stream ? '' : ' primary')} id="camBtn" type="button" onClick={() => C.stream ? stopCam() : startCam()}>{C.stream ? '■ Stop camera' : '📷 Start camera'}</button>
        <button className="btn" id="flipBtn" type="button" hidden={!C.stream} onClick={() => { C.facing = C.facing === 'environment' ? 'user' : 'environment'; startCam() }}>Switch camera</button>
        <button className="btn" id="lockBtn" type="button" hidden={!C.stream} onClick={lockCam}>{C.locked ? 'Unlock exposure' : 'Lock exposure'}</button>
        <span className={'msg' + (C.msgErr ? ' err' : '')} id="camMsg">{C.msg}</span>
      </div>
      <Counters />
    </section>
  );
}
