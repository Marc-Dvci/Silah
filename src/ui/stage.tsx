import { useEffect, useRef, useState } from 'preact/hooks';
import { PERSONAS } from '../app/demo';
import { dbClearAll } from '../app/db';
import { loadClinic, sendOutreach, OUTREACH_REGISTER } from '../app/clinic';
import { loadPerson, syncPerson, respondToInvitation, currentView, setBirthPlan, setLang, type PersonState } from '../app/person';
import type { Lang } from '../core/types';
import { ensureSeeded } from './hooks';
import { LangCtx, Mark, go } from './kit';

// The demonstration stage: one person's phone beside the health-system side, in one browser.
// Each story step points both screens at the right place, and runs the system's part of the step.
// On a phone, the same page becomes a simple chooser.

interface StoryStep { who: string; page?: string; clinic: string; title: string; text: string; action?: () => Promise<void> }

const withClinic = (f: (c: NonNullable<Awaited<ReturnType<typeof loadClinic>>>) => Promise<void>) => async () => {
  const run = async () => { const c = await loadClinic(); if (c) await f(c); };
  if ('locks' in navigator) await navigator.locks.request('silah-clinic', run); else await run();
};

/** Completes a person's step if the viewer skipped it, so later steps always have something to show. */
const withPerson = (id: string, f: (st: PersonState) => Promise<void>) => async () => {
  const run = async () => { const st = await loadPerson(id); await syncPerson(st); await f(st); };
  if ('locks' in navigator) await navigator.locks.request(`silah-person-${id}`, run); else await run();
};
const consent = (id: string) => withPerson(id, async st => { if (st.invitation?.status === 'pending') await respondToInvitation(st, true); });
const birthPlanOn = withPerson('noura', async st => {
  const v = currentView(st);
  if (!v || st.birthPlan?.active) return;
  await setBirthPlan(st, true, v.birthPlanConditions.map(c => c.id), v.shared.filter(x => v.birthPlanConditions.includes(x.condition)).map(x => x.gene));
});
const settle = (ms: number) => new Promise(r => setTimeout(r, ms));

const STORY: StoryStep[] = [
  {
    who: 'mariam', clinic: 'outreach', title: 'The health system invites',
    text: 'Couples married before the mandate are ranked by declared signals only, never genetics. The top three are invited.',
    action: withClinic(c => sendOutreach(c, OUTREACH_REGISTER.slice(0, 3).map(r => r.id))),
  },
  { who: 'mariam', clinic: 'outreach', title: 'Mariam agrees', text: 'She reads what will and will not happen, and agrees. Nothing is checked until Saeed agrees too.' },
  { who: 'saeed', clinic: 'outreach', title: 'Saeed agrees', text: 'The check runs on genomes already held. Each phone receives a result signed by the lab.', action: consent('mariam') },
  {
    who: 'mariam', page: 'result', clinic: 'queue/C-2019-0412', title: 'Mariam reads her result',
    text: 'Four children, counted; what does not change; what the test cannot see. The couple joins the counselling queue.',
    action: async () => { await consent('mariam')(); await consent('saeed')(); await settle(1500); },
  },
  { who: 'mariam', page: 'check', clinic: 'queue/C-2019-0412', title: 'She checks her understanding', text: 'Four questions. She can share the answers so her counsellor starts where she is.' },
  { who: 'saeed', page: 'result', clinic: 'queue/C-2019-0412', title: 'Saeed’s private finding', text: 'Saeed carries CYP21A2. Mariam never sees it unless he chooses to share it.' },
  { who: 'mariam', page: 'family', clinic: 'invites', title: 'Invitations for the family', text: 'Blind-signed invitations: the clinic can verify each one but not who sent it.' },
  { who: 'noura', page: 'birth', clinic: 'births', title: 'Noura’s birth plan', text: 'Noura, 31 weeks pregnant, tells the delivery hospital to test the baby for SMA in the first days.' },
  { who: 'noura', page: 'birth', clinic: 'births', title: 'The baby is tested', text: 'On the hospital side, record the newborn result. The parents see it on Noura’s phone.', action: birthPlanOn },
  { who: 'fatima', page: 'result', clinic: 'pathway', title: '“Compatible” is not zero', text: 'Fatima’s certificate says compatible. Silah shows 1 in 260 for her gene, because her fiancé is her cousin.' },
];

export function Stage() {
  const wide = useWide();
  const [who, setWho] = useState(() => sessionStorageGet('silah-who') ?? 'mariam');
  const [step, setStep] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);
  const phone = useRef<HTMLIFrameElement>(null);
  // The frame's src is set once; afterwards it is driven through its location so a page can be chosen.
  const firstSrc = useRef(`#/p/${who}`);
  const clinic = useRef<HTMLIFrameElement>(null);
  const pick = (id: string, page?: string) => {
    setWho(id);
    try { sessionStorage.setItem('silah-who', id); } catch { /* private mode */ }
    const w = phone.current?.contentWindow;
    if (w) w.location.hash = `#/p/${id}${page ? `/${page}` : ''}`;
  };
  const play = async (i: number) => {
    const s = STORY[i];
    setStep(i);
    if (s.action) await s.action();
    pick(s.who, s.page);
    const w = clinic.current?.contentWindow;
    if (w) w.location.hash = `#/c/${s.clinic}`;
  };
  // One switch for every phone, so a viewer who does not read Arabic can follow the story in English.
  const [phoneLang, setPhoneLang] = useState<Lang | null>(null);
  const switchLang = async (lang: Lang) => {
    setPhoneLang(lang);
    for (const p of PERSONAS) await withPerson(p.id, st => setLang(st, lang))();
    phone.current?.contentWindow?.location.reload();
  };
  const reset = async () => {
    await dbClearAll();
    await ensureSeeded();
    setStep(null);
    setPhoneLang(null);
    setNonce(n => n + 1);
  };
  if (!wide) return <Chooser reset={reset} />;
  return (
    <LangCtx.Provider value={{ lang: 'en', digits: 'latn' }}>
      <div dir="ltr">
        <header class="row stage-head" style={{ padding: '16px 28px 0', gap: '14px' }}>
          <Mark size={32} /><span class="wordmark">صلة</span><b style={{ fontSize: '20px' }}>Silah</b>
          <span class="muted small tagline">Inherited-risk pathway · prototype with a fictional family</span>
          <span class="grow" />
          <span class="tiny muted" style={{ whiteSpace: 'nowrap' }}>Phone:</span>
          {PERSONAS.map(p => <button key={p.id} class={`chip ${p.id === who ? 'indigo' : ''}`} onClick={() => pick(p.id)}>{p.name.en}</button>)}
          <span class="tiny muted" style={{ marginInlineStart: '8px', whiteSpace: 'nowrap' }}>Phones in:</span>
          <button class={`chip ${phoneLang === 'ar' ? 'indigo' : ''}`} lang="ar" onClick={() => switchLang('ar')}>العربية</button>
          <button class={`chip ${phoneLang === 'en' ? 'indigo' : ''}`} onClick={() => switchLang('en')}>English</button>
          <button class="chip saffron" onClick={reset}>Reset demo</button>
        </header>
        <div class="stage">
          <div class="stack" style={{ '--gap': '10px' } as any}>
            <div class="device"><iframe ref={phone} key={`phone-${nonce}`} src={firstSrc.current} title="Person's phone" /></div>
            <p class="small muted" style={{ maxWidth: '410px' }}>{PERSONAS.find(p => p.id === who)?.blurb.en}</p>
          </div>
          <div class="stack" style={{ '--gap': '14px' } as any}>
            <Story step={step} play={play} />
            <iframe ref={clinic} key={`clinic-${nonce}`} class="desk-frame" src="#/c/queue" title="Health-system side" />
          </div>
        </div>
      </div>
    </LangCtx.Provider>
  );
}

/** The story as a woven strip: one knot per step; the current step's text sits under it. */
function Story({ step, play }: { step: number | null; play: (i: number) => void }) {
  const cur = step ?? -1;
  const s = step !== null ? STORY[step] : null;
  return (
    <div class="stack" style={{ '--gap': '8px' } as any}>
      <div class="row" style={{ gap: '10px', flexWrap: 'wrap' }}>
        <span class="eyebrow">The story</span>
        <div class="story-strip">
          {STORY.map((x, i) => (
            <button key={i} class={`story-knot ${i < cur ? 'done' : i === cur ? 'now' : ''}`} onClick={() => play(i)} title={x.title} aria-label={`Step ${i + 1}: ${x.title}`}>
              <span>{i + 1}</span>
            </button>
          ))}
        </div>
        <button class="btn primary" style={{ padding: '8px 18px', fontSize: '14px' }} onClick={() => play(Math.min(STORY.length - 1, cur + 1))}>
          {cur < 0 ? 'Start the story' : cur >= STORY.length - 1 ? 'Last step' : 'Next step'}
        </button>
      </div>
      <p class="small" style={{ minHeight: '1.6em' }}>
        {s ? <><b>{s.title}.</b> <span class="muted">{s.text}</span></> : <span class="muted">Ten steps. Each step moves both screens; act on the phone or the clinic yourself, or press Next and the story completes the step for you.</span>}
      </p>
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
