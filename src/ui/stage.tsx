import { useEffect, useState } from 'preact/hooks';
import { PERSONAS } from '../app/demo';
import { dbClearAll } from '../app/db';
import { ensureSeeded } from './hooks';
import { LangCtx, Mark, go } from './kit';

// The demonstration stage: one person's phone beside the health-system side, in one browser.
// On a phone, the same page becomes a simple chooser.

export function Stage() {
  const wide = useWide();
  const [who, setWho] = useState(() => sessionStorageGet('silah-who') ?? 'mariam');
  const [nonce, setNonce] = useState(0);
  const pick = (id: string) => { setWho(id); try { sessionStorage.setItem('silah-who', id); } catch { /* private mode */ } };
  const reset = async () => {
    await dbClearAll();
    await ensureSeeded();
    setNonce(n => n + 1);
  };
  if (!wide) return <Chooser reset={reset} />;
  return (
    <LangCtx.Provider value={{ lang: 'en', digits: 'latn' }}>
      <div dir="ltr">
        <header class="row" style={{ padding: '16px 28px 0', gap: '14px' }}>
          <Mark size={32} /><span class="wordmark">صلة</span><b style={{ fontSize: '20px' }}>Silah</b>
          <span class="muted small">Inherited-risk pathway · prototype with a fictional family</span>
          <span class="grow" />
          <span class="tiny muted">Phone:</span>
          {PERSONAS.map(p => <button key={p.id} class={`chip ${p.id === who ? 'indigo' : ''}`} onClick={() => pick(p.id)}>{p.name.en}</button>)}
          <button class="chip saffron" onClick={reset}>Reset demo</button>
        </header>
        <div class="stage">
          <div class="stack" style={{ '--gap': '10px' } as any}>
            <div class="device"><iframe key={`${who}-${nonce}`} src={`#/p/${who}`} title="Person's phone" /></div>
            <p class="small muted" style={{ maxWidth: '410px' }}>{PERSONAS.find(p => p.id === who)?.blurb.en}</p>
            <Story pick={pick} />
          </div>
          <iframe key={`clinic-${nonce}`} class="desk-frame" src="#/c/queue" title="Health-system side" />
        </div>
      </div>
    </LangCtx.Provider>
  );
}

const STORY: { who?: string; text: string }[] = [
  { text: 'Clinic › Outreach › Send invitations. Couples married before the mandate are invited by non-genetic signals only.' },
  { who: 'mariam', text: 'Mariam agrees to the couple check. Nothing happens until Saeed agrees too.' },
  { who: 'saeed', text: 'Saeed agrees. The service checks genomes already held and signs a result for each phone.' },
  { who: 'mariam', text: 'Mariam reads the result, checks her understanding, asks questions, shares a summary and books counselling.' },
  { who: 'saeed', text: 'Saeed sees his own CYP21A2 finding, which Mariam never sees, and chooses whether to share it.' },
  { who: 'noura', text: 'Noura, 31 weeks pregnant, turns on a birth plan for the delivery hospital.' },
  { who: 'fatima', text: 'Fatima’s certificate says compatible. Silah shows what that does and does not mean.' },
];

function Story({ pick }: { pick: (id: string) => void }) {
  return (
    <div class="stack" style={{ maxWidth: '410px', '--gap': '6px' } as any}>
      <p class="eyebrow">The story, in order</p>
      {STORY.map((s, i) => (
        <button key={i} class="row small" style={{ all: 'unset', cursor: s.who ? 'pointer' : 'default', display: 'flex', gap: '10px', alignItems: 'flex-start' }} onClick={() => s.who && pick(s.who)}>
          <span class="chip indigo num" style={{ padding: '2px 9px' }}>{i + 1}</span><span class="muted">{s.text}</span>
        </button>
      ))}
    </div>
  );
}

function Chooser({ reset }: { reset: () => void }) {
  return (
    <div class="phone" dir="ltr">
      <main class="page stack" style={{ '--gap': '18px', paddingTop: '28px' } as any}>
        <div class="row"><Mark size={40} /><span class="wordmark" style={{ fontSize: '34px' }}>صلة</span></div>
        <h1>Silah</h1>
        <p class="muted">A private companion for inherited disease risk in Abu Dhabi: from the couple check to counselling, birth and family. This prototype runs entirely in your browser with a fictional family.</p>
        <p class="eyebrow">Open a phone</p>
        {PERSONAS.map(p => (
          <button key={p.id} class="choice" onClick={() => go(`p/${p.id}`)}>
            <b>{p.name.en}</b> <span class="muted">· {p.name.ar}</span>
            <div class="small muted">{p.blurb.en}</div>
          </button>
        ))}
        <button class="choice" onClick={() => go('c/queue')}><b>Clinic and hospital</b><div class="small muted">The simulated health-system side</div></button>
        <button class="link" onClick={reset}>Reset the demo</button>
      </main>
    </div>
  );
}

function useWide() {
  const q = '(min-width: 1180px)';
  const [w, setW] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const f = () => setW(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, []);
  return w;
}

function sessionStorageGet(k: string): string | null {
  try { return sessionStorage.getItem(k); } catch { return null; }
}
