import { createContext, type ComponentChildren } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { L10n, Lang } from '../core/types';
import { toArabicDigits, toAsciiDigits } from '../core/text';
import { sha256Hex } from '../core/crypto/sign';

// ---------- language ----------

export interface LangState { lang: Lang; digits: 'latn' | 'arab'; sex?: 'F' | 'M' }
export const LangCtx = createContext<LangState>({ lang: 'en', digits: 'latn' });

/** A string with an optional masculine Arabic form; the default Arabic is addressed to a woman or to the couple. */
export type Tx = L10n & { arM?: string };

export function useT() {
  const { lang, digits, sex } = useContext(LangCtx);
  return useCallback((x: Tx | string | undefined) => {
    if (x === undefined) return '';
    const s = typeof x === 'string' ? x : lang === 'ar' && sex === 'M' && x.arM ? x.arM : x[lang];
    return lang === 'ar' && digits === 'arab' ? toArabicDigits(s) : s;
  }, [lang, digits, sex]);
}
export const useLang = () => useContext(LangCtx);

/** Format a number for display, honouring the digit preference. */
export function useN() {
  const { lang, digits } = useContext(LangCtx);
  return useCallback((x: number | string) => {
    const s = typeof x === 'number' ? x.toLocaleString('en-US') : x;
    return lang === 'ar' && digits === 'arab' ? toArabicDigits(s) : s;
  }, [lang, digits]);
}

// ---------- router ----------

export function useRoute(): string[] {
  const read = () => location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  const [r, setR] = useState(read);
  useEffect(() => {
    const f = () => setR(read());
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}
export const go = (path: string) => { location.hash = path.startsWith('#') ? path : `#/${path.replace(/^\//, '')}`; scrollTo({ top: 0 }); };

// ---------- motion helper ----------

/** Re-key children on route change so the entrance animation replays. */
export function Enter({ k, children }: { k: string; children: ComponentChildren }) {
  return <div key={k} class="enter stack" style={{ '--gap': '22px' } as any}>{children}</div>;
}

// ---------- marks ----------

export function Mark({ size = 34 }: { size?: number }) {
  const A = 'M8 40 L20 24 L32 40 L44 24 L56 40';
  const B = 'M8 24 L20 40 L32 24 L44 40 L56 24';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path d={A} fill="none" stroke="#D19A3A" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
      <path d={B} fill="none" stroke="#ECEEF5" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
      <path d={B} fill="none" stroke="#2B3A67" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M23 28 L29 36 M47 28 L53 36" fill="none" stroke="#ECEEF5" stroke-width="11" />
      <path d="M22.5 27.3 L29.5 36.7 M46.5 27.3 L53.5 36.7" fill="none" stroke="#D19A3A" stroke-width="6" />
    </svg>
  );
}

export function Bloom() {
  return <div class="bloom" aria-hidden="true"><i /><i /><i /></div>;
}

// ---------- icons (stroke, 22px) ----------

const I = (d: string, extra?: ComponentChildren) => ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d={d} />{extra}
  </svg>
);
export const IconArrow = I('M5 12h14M13 6l6 6-6 6');
export const IconBack = I('M19 12H5M11 6l-6 6 6 6');
export const IconPlay = I('M8 5v14l11-7z');
export const IconPause = I('M8 5v14M16 5v14');
export const IconLock = I('M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3');
export const IconEyeOff = I('M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.2 4M6.1 6.1C3.8 7.7 2.5 12 2.5 12S6 19 12 19a9.7 9.7 0 0 0 4-.9');
export const IconChat = I('M4 5h16v11H9l-5 4z');
export const IconCheck = I('M5 12l5 5L20 7');
export const IconSeal = I('M12 3l2.4 1.8 3 .2.9 2.9 2.2 2-1 2.8 1 2.8-2.2 2-.9 2.9-3 .2L12 21l-2.4-1.8-3-.2-.9-2.9-2.2-2 1-2.8-1-2.8 2.2-2 .9-2.9 3-.2z', <path d="M8.5 12l2.3 2.3 4.7-4.6" />);
export const IconShare = I('M12 3v12M7 8l5-5 5 5M5 14v6h14v-6');
export const IconGlobe = I('M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18');
export const IconSpark = I('M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6');

// ---------- counted figures (Isotype) ----------

export type KidKind = 'aff' | 'car' | 'non';
const KID_FILL: Record<KidKind, string> = { aff: '#A3392B', car: '#D19A3A', non: '#FFFFFF' };
const KID_STROKE: Record<KidKind, string> = { aff: '#A3392B', car: '#D19A3A', non: '#A9B0C4' };

export function KidFigure({ kind, size = 1 }: { kind: KidKind; size?: number }) {
  const f = KID_FILL[kind], s = KID_STROKE[kind];
  return (
    <svg width={40 * size} height={50 * size} viewBox="0 0 40 50" aria-hidden="true">
      <circle cx="20" cy="10" r="7.5" fill={f} stroke={s} stroke-width="1.8" />
      <path d="M8.5 47 L11 25 Q20 19.5 29 25 L31.5 47Z" fill={f} stroke={s} stroke-width="1.8" stroke-linejoin="round" />
    </svg>
  );
}

/** Four children, one pregnancy each: 1 may have the condition, 2 carry, 1 neither. */
export function Kids({ labels }: { labels: { aff: string; car: string; non: string } }) {
  const order: KidKind[] = ['aff', 'car', 'car', 'non'];
  return (
    <div class="kids" role="img" aria-label={`${labels.aff}; ${labels.car}; ${labels.car}; ${labels.non}`}>
      {order.map((k, i) => (
        <div class="kid" key={i} style={{ animation: `rise .7s var(--ease) ${0.15 + i * 0.12}s both` }}>
          <KidFigure kind={k} />
          <span class="k-label">{labels[k]}</span>
        </div>
      ))}
    </div>
  );
}

/** A field of N quiet dots with one lit: how rare "1 in N" is. */
export function Field({ n, cols }: { n: number; cols?: number }) {
  const total = Math.min(n, 2500);
  const c = cols ?? Math.min(50, Math.ceil(Math.sqrt(total * 1.6)));
  const hit = useMemo(() => Math.floor(total * 0.61), [total]);
  return (
    <div class="field" style={{ gridTemplateColumns: `repeat(${c}, 5px)` }} role="img" aria-label={`1 in ${n}`}>
      {Array.from({ length: total }, (_, i) => <i key={i} class={i === hit ? 'hit' : ''} />)}
    </div>
  );
}

// ---------- thread ----------

export function Step({ state, title, sub, onClick, children }: { state: 'done' | 'now' | 'next'; title: ComponentChildren; sub?: ComponentChildren; onClick?: () => void; children?: ComponentChildren }) {
  const inner = (
    <>
      <h3>{title}{onClick && <span class="go"><IconArrow size={18} /></span>}</h3>
      {sub && <p class="muted small">{sub}</p>}
      {children}
    </>
  );
  return (
    <div class={`step ${state}`}>
      <div class="rail"><div class="knot" /></div>
      {onClick ? <button class="body" onClick={onClick}>{inner}</button> : <div class="body">{inner}</div>}
    </div>
  );
}

// ---------- controls ----------

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button class={`toggle ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} />;
}

export function Sheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: ComponentChildren }) {
  if (!open) return null;
  return (
    <>
      <div class="sheet-scrim" onClick={onClose} />
      <div class="sheet" role="dialog" aria-modal="true"><div class="grip" />{children}</div>
    </>
  );
}

export function Receipt({ children }: { children: ComponentChildren }) {
  return <div class="receipt"><IconLock size={18} /><div>{children}</div></div>;
}

/** File name of the pre-rendered narration for a text: the same key the render script uses. */
export const audioKey = (lang: string, text: string) => sha256Hex(`${lang}|${toAsciiDigits(text)}`).slice(0, 16);

/** Reads text aloud. Pre-rendered narration is used when it exists; otherwise the device voice. */
export function Listen({ text, label }: { text: string; id?: string; label: string }) {
  const { lang } = useLang();
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => { audio.current?.pause(); if ('speechSynthesis' in window) speechSynthesis.cancel(); }, []);
  const play = async () => {
    if (playing) { audio.current?.pause(); if ('speechSynthesis' in window) speechSynthesis.cancel(); setPlaying(false); return; }
    setPlaying(true);
    const src = `audio/${audioKey(lang, text)}.mp3`;
    try {
      const head = await fetch(src, { method: 'HEAD' });
      if (head.ok && (head.headers.get('content-type') ?? '').includes('audio')) {
        audio.current = new Audio(src);
        audio.current.onended = () => setPlaying(false);
        await audio.current.play();
        return;
      }
    } catch { /* fall through to the device voice */ }
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'ar' ? 'ar-AE' : 'en-GB';
      const v = speechSynthesis.getVoices().find(x => x.lang.startsWith(lang));
      if (v) u.voice = v;
      u.rate = 0.95;
      u.onend = () => setPlaying(false);
      speechSynthesis.speak(u);
    } else setPlaying(false);
  };
  return (
    <button class="chip indigo" onClick={play} aria-pressed={playing}>
      {playing ? <IconPause size={16} /> : <IconPlay size={16} />} {label}
    </button>
  );
}

export function useInterval(f: () => void, ms: number) {
  const saved = useRef(f);
  saved.current = f;
  useEffect(() => { const id = setInterval(() => saved.current(), ms); return () => clearInterval(id); }, [ms]);
}
