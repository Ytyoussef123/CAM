/* Inputs that behave like the console always did: text is taken when it is confirmed (Enter or leaving the field),
   and a slider follows the pointer while it moves. */
import { useEffect, useRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { render } from '../core/state';

type CommitProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'defaultValue' | 'onChange'> & { value: string; onCommit: (v: string) => void };
/** An input whose value is taken on "change" (Enter / blur). While it has the focus, what is typed is not replaced. */
export function CommitInput({ value, onCommit, ...rest }: CommitProps) {
  const ref = useRef<HTMLInputElement>(null), cb = useRef(onCommit);
  cb.current = onCommit;
  useEffect(() => { const el = ref.current; if (el && document.activeElement !== el && el.value !== value) el.value = value });
  useEffect(() => { const el = ref.current!; const h = () => cb.current(el.value); el.addEventListener('change', h); return () => el.removeEventListener('change', h) }, []);
  return <input ref={ref} defaultValue={value} {...rest} />;
}

interface SliderProps { label: string; min: number; max: number; step: number; val: number; fmt: (v: number) => string; onInput: (v: number) => void; onCommit?: () => void; extra?: ReactNode }
/** A labelled slider with its value; onCommit runs when the slider is released. */
export function Slider({ label, min, max, step, val, fmt, onInput, onCommit, extra }: SliderProps) {
  const ref = useRef<HTMLInputElement>(null), cb = useRef(onCommit);
  cb.current = onCommit;
  useEffect(() => { const el = ref.current!; const h = () => { if (cb.current) cb.current(); else render() }; el.addEventListener('change', h); return () => el.removeEventListener('change', h) }, []);
  return (
    <div className="slider">
      <span className="lbl">{label}</span>
      <input ref={ref} type="range" min={min} max={max} step={step} value={val} aria-label={label} onChange={e => { onInput(+e.target.value); render() }} />
      <output>{fmt(+val)}</output>
      {extra}
    </div>
  );
}

/** Folder pickers: the browser offers whole folders with webkitdirectory. */
declare module 'react' {
  interface InputHTMLAttributes<T> { webkitdirectory?: string }
}
