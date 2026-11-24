/* The whole console. The engine (src/core) holds the state; React draws it again after every render(). */
import { useEffect, useLayoutEffect } from 'react';
import { P, U, DOM, render } from '../core/state';
import { L } from '../core/link';
import { drawScreen } from '../core/draw';
import { trigger } from '../core/actions';
import { useVersion } from './hooks';
import { Toolbar, StepBar, MsgBox, CamPair, StatusBar, Dialog } from './Frame';
import { ImagePanel } from './ImagePanel';
import { ProgramPanel } from './ProgramPanel';
import { RunPanel } from './RunPanel';

export function App() {
  useVersion();
  useLayoutEffect(() => { // page classes, and the screen follows every change (as render() always did)
    document.body.classList.toggle('role-cam', L.role === 'cam');
    document.body.classList.toggle('page-run', U.page === 'run');
    drawScreen();
  });
  useEffect(() => {
    const click = (e: MouseEvent) => { if (U.addMenu && !(e.target as Element).closest('.addwrap')) { U.addMenu = false; render() } };
    const key = (e: KeyboardEvent) => { if (L.role === 'ctl' && e.code === 'Space' && e.target === document.body && P && P.valid) { e.preventDefault(); trigger() } };
    const resize = () => { if (U.page === 'run') render() };
    document.addEventListener('click', click); document.addEventListener('keydown', key); addEventListener('resize', resize);
    return () => { document.removeEventListener('click', click); document.removeEventListener('keydown', key); removeEventListener('resize', resize) };
  }, []);
  return (
    <div className="app">
      <Toolbar />
      <StepBar />
      <main className="work">
        <ImagePanel />
        <aside className="right">
          <MsgBox />
          {/* phone (camera) */}
          <CamPair />
          {/* PROGRAM: 5 steps */}
          <ProgramPanel />
          {/* RUN */}
          <RunPanel />
        </aside>
      </main>
      <StatusBar />
      <input type="file" id="fileIn" accept="image/*" hidden ref={el => { DOM.fileIn = el }} />
      <Dialog />
    </div>
  );
}
