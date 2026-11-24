/* Start: open the saved programs, draw the console, then start the phone link (outside claude.ai). */
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Q, stored } from './core/util';
import { P, U, progs } from './core/state';
import { openStorage, loadProg, newProg } from './core/storage';
import { SRC, startDemo, setSrc, samplePart, makeFrame } from './core/source';
import { L, linkStat, loadPeerJs, setRole } from './core/link';
import { startLoop, drawScreen } from './core/draw';
import { measureTool, findPos } from './core/analysis';
import { inspect, learnAll } from './core/learning';
import { measRef, setStep, setPage } from './core/actions';
import { FT, ftLabel } from './core/folderTest';
import { LB, lbAdd } from './core/folderLearn';
import { App } from './ui/App';

(async () => {
  await openStorage();
  const cur = +(stored('vs1-cur') || 0);
  if (!(cur && await loadProg(cur)) && !(progs.length && await loadProg(progs[progs.length - 1].id))) newProg();
  U.page = P && P.valid && stored('vs1-page') !== 'prog' ? 'run' : 'prog';
  U.step = P && P.ref ? 3 : 1; if (U.page === 'prog') U.mode = U.step === 3 ? 'edit' : 'live';
  if (SRC.kind === 'demo') startDemo();
  if (Q.has('debug')) Object.assign(window, { // test hook
    __vs1: {
      get P() { return P }, get U() { return U }, get SRC() { return SRC }, measureTool, findPos, inspect, measRef, samplePart, makeFrame, learnAll, setStep, setPage,
      ftLabel, get FT() { return FT }, get LB() { return LB }, lbAdd,
    },
  });
  createRoot(document.getElementById('root')!).render(<App />);
  startLoop(); drawScreen();
  // inside claude.ai the camera and the peer link are not available: demo camera and files still work
  const w = window as unknown as { claude?: { use?: unknown } };
  const inClaude = !!(w.claude && w.claude.use) || window.self !== window.top;
  if (!inClaude) { try { await loadPeerJs(); L.kind = 'peer' } catch (e) { L.kind = 'none'; linkStat('link unavailable (no internet?)', 'err') } }
  else { L.kind = 'none'; linkStat('phone link: GitHub Pages only', 'err'); if (SRC.kind === 'phone') setSrc('demo') }
  setRole(L.role);
})();
