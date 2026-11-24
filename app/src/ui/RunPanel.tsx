/* ▶ RUN: trigger, tool results, and the tabs Limit & histogram · Additional learning · Repeatability · Test a folder. */
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { Tool } from '../core/types';
import { BAND, store } from '../core/util';
import { P, U, render, flashMsg } from '../core/state';
import { checks, measures, refTool, runOrder, isCheck, tNum } from '../core/tools';
import { fmtLen } from '../core/analysis';
import { audit } from '../core/learning';
import { trigger, toggleRun, setRunPeriod, learnLast, forget, afterLimit, setPage, setStep } from '../core/actions';
import { tolTxt } from '../core/draw';
import { ask } from '../core/dialog';
import { REP, repStart } from '../core/repeat';
import { FT, ftStart, ftStats, ftBest, worstTxt, ftOpen, toolLim, ftDropFiles, ftForgetOtherProgram, type PathFile } from '../core/folderTest';
import { LB } from '../core/folderLearn';
import { ToolRows, LimitRow, TolInputs } from './ToolList';
import { useLive } from './hooks';
import { runResult, nearTxt, flagTxt, VERD, histTool } from './helpers';
import { drawHist, drawFolderChart, histStatsTxt } from './charts';

const files = (e: { target: HTMLInputElement }) => { const f = [...(e.target.files || [])] as PathFile[]; e.target.value = ''; return f };

/** A canvas chart drawn after every render. */
function Chart({ id, height, label, draw }: { id: string; height: number; label: string; draw: (c: HTMLCanvasElement) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => { if (ref.current) draw(ref.current) });
  return <canvas id={id} height={height} aria-label={label} ref={ref}></canvas>;
}

function RunToolList() {
  useLive(); // follows the live view
  const tools = runOrder();
  if (!tools.some(a => a.id === U.selTool)) { const t = tools.find(isCheck) || tools[0]; U.selTool = t ? t.id : null }
  return <ToolRows id="toolList" label="Results per tool" sel={U.selTool} R={runResult()} onSel={a => { U.selTool = a.id; render() }} />;
}

function HistTab({ ok }: { ok: boolean }) {
  const a = histTool();
  return (
    <div className="rt rt-hist histo" id="histo" hidden={!ok}>
      <span className="lbl" id="histTitle">{a ? `${tNum(a)} · ${a.name} — results since the last reset` : '—'}</span>
      <Chart id="histC" height={130} label="Score histogram of the selected tool" draw={c => { if (U.page === 'run' && P && P.valid && (U.rtab || 'hist') === 'hist') drawHist(c, a) }} />
      <div className="hs" id="histStats">{a ? histStatsTxt(a) : ''}</div>
      <div id="histLim">{a && (a.type === 'measure' ? <TolInputs key={a.id} a={a} /> : <LimitRow key={a.id} a={a} />)}</div>
    </div>
  );
}

function TeachBox() {
  const flags = P ? audit() : {};
  if (U.mode === 'sample' && U.view && P) {
    const s = U.view, si = P.samples.indexOf(s);
    return (
      <div className="teach" id="teach">
        <span className="lbl">{`Learned image ${si + 1}`}</span>
        {checks().map(a => <div key={a.id} className="stats">{`${a.name}: taught ${s.labels[a.id] === 'ng' ? 'NG' : s.labels[a.id] === 'ok' ? 'OK' : '— (not used for this area)'}`}</div>)}
        {(flags[s.id] || []).map((f, i) => <div key={i} className="warnbox">{flagTxt(f)}</div>)}
        <div className="row">
          <button className="btn" type="button" onClick={async () => { if (await ask(`Remove learned image ${si + 1}? The areas will be learned again without it.`, { ok: 'Remove' })) forget(s) }}>🗑 Remove from learning</button>
          <button className="btn small" type="button" onClick={() => { U.view = null; U.mode = 'live'; render() }}>Close</button>
        </div>
      </div>
    );
  }
  if (U.mode === 'result' && U.last && P) {
    const l = U.last, R = l.r;
    return (
      <div className="teach" id="teach">
        <span className="lbl">{l.learned ? 'Learned ✓ — trigger the next part' : (l.ft ? `Folder picture ${l.ft.split('/').pop()} — ` : l.test ? 'Repeatability test picture — ' : '') + 'Teach this image — is each area OK or NG?'}</span>
        {!R.pos.none && <div className="t"><span>{'⌖ ' + (refTool() || { name: undefined }).name}</span><small>{R.pos.found ? `found · ${Math.round(R.pos.score * 100)}` : `NOT FOUND · ${Math.round(R.pos.score * 100)}`}</small><span></span></div>}
        {checks().map(a => {
          const r = R.res.find(z => z.id === a.id);
          return (
            <div key={a.id} className="t">
              <span>{a.name}</span>
              <small>{r ? `score ${Math.round(r.score)} · ${r.ng ? 'NG' : 'OK'}${r.marg ? ' ⚠ near the limit' : ''}${nearTxt(r)}` : ''}</small>
              <div className="okng">
                {([['ok', 'OK', 'k'], ['ng', 'NG', 'g']] as const).map(([v, lbl, cls]) =>
                  <button key={v} className={cls + (l.labels[a.id] === v ? ' on' : '')} type="button" disabled={l.learned} onClick={() => { l.labels[a.id] = v; l.warn = null; render() }}>{lbl}</button>)}
              </div>
            </div>
          );
        })}
        {measures().map(m => {
          const r = R.meas.find(z => z.id === m.id);
          return <div key={m.id} className="t"><span>{'📏 ' + m.name}</span><small>{r ? (r.found ? `${fmtLen(r.value)} · ${r.ok ? 'OK' : 'NG'}` : 'no edges · NG') : ''}</small><small>{tolTxt(m)}</small></div>;
        })}
        {l.warn ? (
          <div className="warnbox"><b>Are you sure?</b>
            {l.warn.map((c, i) => <div key={i}>{c.lab === 'ok' ? `${c.name} scored ${c.score} (limit ${c.limit}): it looks very different from the good examples. Taught as OK, it will be accepted from now on — and so will any part that looks like it, even with a defect at that spot.` :
              `${c.name} scored ${c.score} (limit ${c.limit}): it looks like the good examples. Taught as NG, parts that look like it will be rejected — good parts may be rejected too.`}</div>)}
            <div className="row">
              <button className="btn primary" type="button" onClick={() => { l.warn = null; render() }}>Cancel — check the labels</button>
              <button className="btn" type="button" onClick={() => learnLast(true)}>Teach anyway</button>
            </div>
          </div>
        ) : checks().length > 0 && <button className="btn primary" type="button" disabled={l.learned} onClick={() => learnLast(false)}>{l.learned ? '✓ Learned' : '🎓 Learn this image'}</button>}
      </div>
    );
  }
  return <div className="teach" id="teach" hidden></div>;
}

function TeachTab() {
  const flags = P ? audit() : {}, nf = P ? P.samples.filter(s => flags[s.id]).length : 0;
  return (
    <div className="rt rt-teach" id="teachStep">
      <div className="row"><span className="lbl">Teach</span><span className="spacer"></span><span className="state" id="teachState">{P ? `${P.samples.length} learned` : '—'}</span></div>
      <p className="hint">After a trigger, tell the sensor, area by area, if the part is <b>OK</b> or <b>NG</b> and press <b>Learn</b>. A taught picture then scores 100 where you said OK and 0 where you said NG, and so does a new picture of the same part in the same place.</p>
      <div className="row"><button className="btn" id="goLearn" type="button" onClick={() => { setPage('prog'); setStep(4) }}>📁 Learn from folders…</button><span className="hint">in ⚙ PROGRAM → 4 Learn: each picture is shown, judged, then learned.</span></div>
      <TeachBox />
      <span className="lbl">Learned images</span>
      <div className="thumbs" id="sampleList">
        {!P || !P.samples.length ? <div className="empty" style={{ gridColumn: '1/-1' }}>Nothing learned yet: only the master image is used.</div> :
          P.samples.map((s, si) => {
            const ngA = checks().filter(a => s.labels[a.id] === 'ng'), fl = flags[s.id];
            return (
              <button key={s.id} className={'thumb' + (U.view === s && U.mode === 'sample' ? ' sel' : '')} type="button" title={(fl ? fl.map(f => flagTxt(f)).join('\n') + '\n' : '') + 'Click to see it (and remove it if needed)'}
                onClick={() => { if (U.view === s && U.mode === 'sample') { U.view = null; U.mode = 'live' } else { U.view = s; U.mode = 'sample' } render() }}>
                <img src={s.thumb} alt="Learned image" />
                <span className={'chip ' + (ngA.length ? 'ng' : 'ok')}>{`${si + 1} · ` + (ngA.length ? 'NG ' + ngA.map(a => a.id).join(',') : 'OK')}</span>
                {fl && <span className="flag">⚠</span>}
              </button>
            );
          })}
      </div>
      <div className="areas" id="auditBox">
        {(flags.ref || []).map((f, i) => <div key={i} className="warnbox">{flagTxt(f, true)}</div>)}
        {nf > 0 && <div className="warnbox">{`⚠ ${nf} learned image${nf > 1 ? 's' : ''} disagree${nf > 1 ? '' : 's'} with the others (marked ⚠). Open ${nf > 1 ? 'them' : 'it'} to check: a teaching mistake makes that defect accepted (or good parts rejected).`}</div>}
      </div>
    </div>
  );
}

const MGC: Record<string, string> = { good: 'good', fair: 'fair', risk: 'risk', unstable: 'risk' };
function RepTab() {
  const res = REP.res, bad = res ? res.filter(t => t.verdict === 'unstable' || t.verdict === 'risk').length : 0, fair = res ? res.filter(t => t.verdict === 'fair').length : 0;
  const st = REP.run ? { cls: 'state', t: `Picture ${REP.i}/${REP.n}` } : !res ? { cls: 'state', t: '—' } : { cls: 'state' + (bad ? ' warn' : fair ? '' : ' good'), t: bad ? 'Unstable' : fair ? 'Marginal' : 'Stable' };
  return (
    <div className="rt rt-rep" id="repStep">
      <div className="row"><span className="lbl">Repeatability test</span><span className="spacer"></span><span className={st.cls} id="repState">{st.t}</span></div>
      <p className="hint">Leave one OK part under the camera and start the test: the sensor takes several pictures without learning and shows how much each result moves and how close it comes to its limit. Tick <b>re-place</b> to take the part out and put it back between pictures (4 s each): the placement is then part of the test.</p>
      <div className="row">
        <label className="toggle">Pictures <select id="repN" aria-label="Number of pictures" value={String(U.repN)} disabled={REP.run} onChange={e => { U.repN = +e.target.value || 20; render() }}><option>10</option><option>20</option><option>30</option></select></label>
        <label className="toggle"><input type="checkbox" id="repMove" checked={U.repMove} disabled={REP.run} onChange={e => { U.repMove = e.target.checked; render() }} /> I re-place the part between pictures</label>
        <button className="btn primary" id="repBtn" type="button" disabled={!REP.run && !(P && P.valid)} onClick={repStart}>{REP.run ? '■ Stop the test' : '⟳ Start the test'}</button>
      </div>
      <div className="areas" id="repOut">
        {REP.run ? <p className="hint">{REP.move ? `Picture ${REP.i} of ${REP.n}: take the part out and put it back in its place before the next picture.` : `Picture ${REP.i} of ${REP.n}: do not touch the part.`}</p> : res && <>
          <p className="hint">{`${REP.shots.length} pictures` + (REP.move ? ', the part re-placed each time' : ' of the same part, not touched') + '. Nothing was learned and the counters were not changed.'}</p>
          {res.map(t => {
            let txt = '';
            if (t.type === 'measure') {
              if (t.st) txt = `${fmtLen(t.st.min)} – ${fmtLen(t.st.max)} · average ${fmtLen(t.st.mean)} · spread σ ${fmtLen(t.st.sd)}` + (t.pct != null ? ` · 6σ = ${t.pct.toFixed(0)} % of the tolerance (good below 10 %, too much above 30 %)` : ' · set a tolerance to judge it');
              if (t.miss) txt += ` · no edges ${t.miss}×`;
            }
            else if (t.st) {
              txt = `scores ${t.st.min}–${t.st.max} · average ${t.st.mean.toFixed(1)} · spread σ ${t.st.sd.toFixed(1)} · closest to the limit (${t.L}): ${Math.round(t.close!)} points`;
              if (t.type === 'ref') txt += ` · position spread σ ${t.sdx!.toFixed(1)} × ${t.sdy!.toFixed(1)} px`;
            }
            return (
              <div key={t.id} className="rep">
                <div className="rhead"><b>{t.name}</b><span className={'mg ' + (MGC[t.verdict || ''] || 'none')}>{VERD[t.verdict || ''] || '—'}</span></div>
                <div className="rstrip" title="One mark per picture: green OK, red NG">{t.oks.map((o, i) => <i key={i} className={o ? 'ok' : 'ng'}></i>)}</div>
                <div className="stats">{txt + ` · ${t.nOk} OK / ${t.nNg} NG`}</div>
              </div>
            );
          })}
        </>}
      </div>
    </div>
  );
}

function FolderTab() {
  ftForgetOtherProgram();
  const ok = !!(P && P.valid), z = useRef<HTMLDivElement>(null);
  const has = FT.res || FT.run, s = has ? ftStats() : null, c = s ? s.c : null;
  const stCls = !has ? 'state' : 'state' + (s!.n ? (c!.ngok ? ' warn' : c!.okng ? '' : ' good') : '');
  const stTxt = !has ? '—' : (FT.run ? `${FT.done}/${FT.total}` + (s!.n ? ' · ' : '') : '') + (s!.n ? `${Math.round(s!.acc! * 100)} % right` : FT.run ? '' : `${s!.total} tested`);
  const tools = P ? runOrder() : [];
  if (has && !tools.some(a => a.id === FT.tool)) { const t = tools.find(isCheck) || tools[0]; FT.tool = t ? t.id : null }
  const a = tools.find(t => t.id === FT.tool) || null, best = has && a && a.type !== 'measure' && !FT.run ? ftBest(a) : null;
  const mist = has ? FT.items.filter(x => !x.err && !x.known && x.expect && x.expect !== (x.ok ? 'ok' : 'ng')).sort((p, q) => (p.expect === 'ng' ? 0 : 1) - (q.expect === 'ng' ? 0 : 1)) : [];
  const nOkTaught = P ? P.samples.filter(x => Object.values(x.labels).includes('ok')).length : 0;
  useEffect(() => {
    const el = z.current!;
    const over = (e: DragEvent) => { e.preventDefault(); el.classList.add('drag') }, leave = () => el.classList.remove('drag');
    const drop = async (e: DragEvent) => { e.preventDefault(); el.classList.remove('drag'); const p = ftDropFiles(e.dataTransfer!); if (!FT.run) ftStart(await p) };
    el.addEventListener('dragover', over); el.addEventListener('dragleave', leave); el.addEventListener('drop', drop);
    return () => { el.removeEventListener('dragover', over); el.removeEventListener('dragleave', leave); el.removeEventListener('drop', drop) };
  }, []);
  const card = (n: string, txt: string, cls: string) => <div className={'ftc' + (cls ? ' ' + cls : '')}><b>{n}</b><span>{txt}</span></div>;
  const lines: string[] = [];
  if (s && c) {
    lines.push(`${s.total} picture${s.total === 1 ? '' : 's'} tested · ${s.avg.toFixed(0)} ms each`);
    if (s.n) lines.push(`${Math.round(s.acc! * 100)} % judged right on ${s.n} picture${s.n === 1 ? '' : 's'} with a label from the folder names`);
    if (c.uok + c.ung) lines.push(`${c.uok + c.ung} without a label: ${c.uok} OK, ${c.ung} NG`);
    if (s.marg) lines.push(`⚠ ${s.marg} marginal (within ${BAND} points of a limit)`);
  }
  return (
    <div className="rt rt-folder" id="ftStep" ref={z}>
      <div className="row"><span className="lbl">Test a folder</span><span className="spacer"></span><span className={stCls} id="ftState">{stTxt}</span></div>
      <p className="hint">Choose a folder of pictures, or drop it here. Every picture is triggered in turn and judged with this program, like parts on the line: nothing is learned and the counters are not changed. If the folder names say <b>good / ok / normal</b> or <b>defect / ng / anomaly</b> (like the MVTec, VisA and Kaggle casting datasets), you also see how many pictures were judged right.</p>
      <div className="row">
        <label className="btn primary">📁 Choose a folder<input type="file" id="ftDir" webkitdirectory="" multiple disabled={FT.run || LB.run || !ok} onChange={e => ftStart(files(e))} /></label>
        <label className="btn">🖼 Choose pictures<input type="file" id="ftFiles" accept="image/*" multiple disabled={FT.run || LB.run || !ok} onChange={e => ftStart(files(e))} /></label>
        <button className="btn" id="ftStop" type="button" hidden={!FT.run} onClick={() => { FT.run = false }}>■ Stop</button>
      </div>
      <div className="row">
        <label className="toggle">Expected result <select id="ftExp" aria-label="Expected result" value={U.ftExp} disabled={FT.run} onChange={e => { U.ftExp = e.target.value as typeof U.ftExp; render() }}>
          <option value="auto">from the folder names</option><option value="ok">all pictures are good</option><option value="ng">all pictures are defective</option><option value="none">unknown</option></select></label>
        <label className="toggle">One picture every <select id="ftPer" aria-label="Time per picture" value={U.ftPer} onChange={e => { U.ftPer = e.target.value; store('vs1-ftper', U.ftPer); render() }}>
          <option value="1">1 s</option><option value="3">3 s</option><option value="5">5 s</option><option value="0">fast</option></select></label>
      </div>
      <div className="ftprog" id="ftProg" hidden={!FT.run}><i id="ftBar" style={{ width: (FT.total ? FT.done / FT.total * 100 : 0) + '%' }}></i></div>
      <div className="areas" id="ftOut">
        {has && s && c && <>
          {FT.run && <p className="hint lnow">{`Picture ${FT.done} of ${FT.total}: ${FT.cur}`}</p>}
          {s.n > 0 && <div className="ftgrid">
            {card(`${c.okok}/${c.okok + c.okng}`, 'good parts accepted', '')}{card(String(c.okng), 'good parts rejected (false alarms)', c.okng ? 'warn' : '')}
            {card(`${c.ngng}/${c.ngng + c.ngok}`, 'defects caught', '')}{card(String(c.ngok), 'defects missed', c.ngok ? 'bad' : '')}
          </div>}
          <div className="stats">{lines.join(' · ')}</div>
          {s.known > 0 && <div className="warnbox">{`${s.known} picture${s.known === 1 ? ' is' : 's are'} practically identical (within camera noise) to a taught picture or the master: not counted, because the sensor remembers ${s.known === 1 ? 'it' : 'them'}. To judge the sensor fairly, test pictures you did not teach (for example the MVTec "test" folder, not "train").`}</div>}
          {c.okng > c.okok && nOkTaught < 5 && <div className="warnbox">{`Most good parts are rejected: the sensor knows only ${nOkTaught ? nOkTaught + ' taught good picture' + (nOkTaught > 1 ? 's' : '') + ' and the master' : 'the master'}. Teach some good pictures first (Additional learning) — for a dataset, take them from its "train/good" folder, not from the folder you test.`}</div>}
          {s.err > 0 && <div className="warnbox">{`${s.err} file${s.err === 1 ? '' : 's'} could not be read.`}</div>}
          {s.sz > 0 && <div className="warnbox">{`${s.sz} picture${s.sz === 1 ? ' has' : 's have'} a very different size than the master image: did you register the master from this same set of pictures?`}</div>}
          {FT.stamp && P.samples.length !== FT.stamp.n && <div className="warnbox">You taught pictures after this test: run it again to see the new scores.</div>}
        </>}
      </div>
      <div className="sec" id="ftHistBox" hidden={!has || !tools.length}>
        <div className="row"><span className="lbl">Scores by folder</span><span className="spacer"></span>
          <select id="ftTool" aria-label="Tool to show" value={FT.tool != null ? String(FT.tool) : ''} onChange={e => { FT.tool = +e.target.value; render() }}>
            {tools.map(t => <option key={t.id} value={t.id}>{`${tNum(t)} · ${t.name}`}</option>)}
          </select></div>
        <Chart id="ftC" height={140} label="Scores of the tested pictures, by folder" draw={cv => { if (has && a && (U.rtab || 'hist') === 'folder') drawFolderChart(cv, a) }} />
        <div className="hs" id="ftLegend">{has ? 'green: pictures from good folders · red: from defect folders · grey: no label · line: limit (dashed: tolerance)' : ''}</div>
        <div id="ftBest">{best && a && <div className="row">
          <span className="stats">{`If ${a.name} alone decided: limit ${best.lo === best.hi ? best.L : `${best.lo}–${best.hi} (middle ${best.L})`} judges ${Math.round(best.acc * 100)} % of ${best.n} labelled pictures right.`}</span>
          {best.L !== toolLim(a) && <button className="btn small" type="button" title="Set this limit; it is tuned on this folder only, check it on other pictures too"
            onClick={() => applyLimit(a, best.L)}>{`Use ${best.L}`}</button>}
        </div>}</div>
      </div>
      <div className="areas" id="ftMist">
        {mist.length > 0 && <>
          <span className="lbl">{`Wrong results (${mist.length}) — missed defects first`}</span>
          {mist.slice(0, 40).map(x => (
            <div key={x.path} className="ftrow">
              {x.thumb ? <img src={x.thumb} alt="" /> : <span className="ftnoimg">🖼</span>}
              <div className="ftname" title={x.path}><b>{x.path.split('/').slice(-3).join('/')}</b><small>{(x.expect === 'ng' ? 'defect folder → judged OK' : 'good folder → judged NG') + ` · ${worstTxt(x)}`}</small></div>
              <button className="btn small" type="button" onClick={() => ftOpen(x, false)}>Show</button>
              <button className="btn small" type="button" onClick={() => ftOpen(x, true)}>Teach</button>
            </div>
          ))}
          {mist.length > 40 && <p className="hint">{`… and ${mist.length - 40} more.`}</p>}
        </>}
      </div>
    </div>
  );
}
function applyLimit(a: Tool, L: number) {
  if (a.type === 'ref') a.minScore = L; else a.limit = L; afterLimit(); render();
  flashMsg(`${a.name}: limit ${L}. It was tuned on this folder only: check it on other pictures too.`);
}

export function RunPanel() {
  const ok = !!(P && P.valid), rt = U.rtab || 'hist';
  const tab = (id: string, k: typeof U.rtab, txt: string) => <button type="button" role="tab" id={id} data-rt={k} aria-selected={rt === k} onClick={() => { U.rtab = k; render() }}>{txt}</button>;
  return (
    <section className="pnl ctl-only run-only" id="runStep" data-rt={rt} aria-labelledby="runTitle">
      <header className="pnlh"><span className="pstep">RUN</span><h2 id="runTitle">Inspection</h2><span className={'state' + (ok ? ' good' : ' warn')} id="runState">{ok ? (U.timer ? 'Running' : 'Ready') : 'Not finished'}</span></header>
      <div className="pbody">
        <p className="hint" id="runHint" hidden={ok}>This program is not finished yet. Go to <b>⚙ PROGRAM</b>, complete the steps and press Finish.</p>
        <div className="row">
          <button className="btn primary big" id="trigBtn" type="button" disabled={!ok} onClick={trigger}>📷 Trigger</button>
          <button className="btn" id="runBtn" type="button" disabled={!ok} onClick={toggleRun}>{U.timer ? '■ Stop auto' : `▶ Auto every ${U.period || 3} s`}</button>
          <label className="toggle">every <select id="runPer" aria-label="Auto trigger period" value={String(U.period || 3)} onChange={e => setRunPeriod(+e.target.value)}><option value="1">1 s</option><option value="3">3 s</option><option value="5">5 s</option></select></label>
        </div>
        {ok ? <RunToolList /> : <div className="tlist" id="toolList" aria-label="Results per tool" hidden></div>}
        <div className="rtabs" role="tablist" aria-label="Run tools">
          {tab('rtHist', 'hist', 'Limit & histogram')}
          {tab('rtTeach', 'teach', 'Additional learning' + (U.mode === 'result' && U.last && !U.last.learned ? ' •' : ''))}
          {tab('rtRep', 'rep', 'Repeatability')}
          {tab('rtFolder', 'folder', 'Test a folder' + (FT.run ? ` ${FT.done}/${FT.total}` : ''))}
        </div>
        <HistTab ok={ok} />
        <TeachTab />
        <RepTab />
        <FolderTab />
      </div>
    </section>
  );
}
