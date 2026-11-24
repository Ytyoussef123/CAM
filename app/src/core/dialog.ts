/* In-page dialog (browser pop-ups can be blocked inside claude.ai). The React <Dialog> component shows it. */
import { render } from './state';

export interface Dlg { text: string; ok: string; cancel: string; input: string | null; safe: boolean; done: (v: string | true | null) => void }
export let DLG: Dlg | null = null;
/** Resolves to true (OK), the typed text (when input is given) or null (Cancel, Escape). safe: Cancel is the default button. */
export function ask(text: string, { ok = 'OK', cancel = 'Cancel', input = null as string | null, safe = false } = {}): Promise<string | true | null> {
  if (DLG) DLG.done(null); // one question at a time
  return new Promise(res => {
    const d: Dlg = { text, ok, cancel, input, safe, done: v => { if (DLG === d) DLG = null; render(); res(v) } };
    DLG = d; render();
  });
}
