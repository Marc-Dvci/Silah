import { useEffect, useRef, useState } from 'preact/hooks';
import type { PersonState } from '../../app/person';
import { currentView, recordQuestion, escalate } from '../../app/person';
import { route } from '../../core/routes';
import { INTENTS, matchIntent, answerFrom } from '../../core/faq';
import type { FactCard, L10n } from '../../core/types';
import { askModel, detectLocalServer, localServer, webgpuBackend, type Backend } from '../../llm/answer';
import { Enter, Listen, go, useT, IconSpark } from '../kit';
import { Back } from './shell';
import { SourceChips } from './sources';

type Act = (f: (st: PersonState) => Promise<void>) => Promise<void>;

interface Turn {
  q: string;
  lead?: L10n;
  cards?: FactCard[];
  sentences?: { text: string; cards: string[] }[];
  blocked?: number;
  routed?: { reply: L10n; urgent: boolean };
  none?: boolean;
  via: 'faq' | 'model' | 'route' | 'none';
}

let sharedBackend: Backend | null = null;   // survives navigation within the session

export function Ask({ s, act, base }: { s: PersonState; act: Act; base: string }) {
  const t = useT();
  const view = currentView(s);
  const cards = view?.cards ?? [];
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [backend, setBackend] = useState<Backend | null>(sharedBackend);
  const [loading, setLoading] = useState<number | null>(null);
  const [server, setServer] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { detectLocalServer().then(setServer); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns.length, busy]);

  const submit = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    setQ('');
    setBusy(true);
    const r = route(question);
    let turn: Turn;
    if (r.route !== 'none') {
      turn = { q: question, routed: { reply: r.reply, urgent: r.urgent }, via: 'route' };
      if (r.escalate) await act(st => escalate(st, r.route));
    } else {
      const intent = matchIntent(question);
      if (intent && view) {
        const a = answerFrom(intent, cards);
        turn = { q: question, lead: intent.lead, cards: a.cards, via: 'faq' };
      } else if (backend && view) {
        try {
          const res = await askModel(backend, question, cards, s.lang);
          const shown = res.verified?.shown ?? [];
          turn = shown.length
            ? { q: question, sentences: shown, blocked: res.verified!.blocked.length, via: 'model' }
            : { q: question, none: true, blocked: res.verified?.blocked.length ?? 0, via: 'none' };
        } catch {
          turn = { q: question, none: true, via: 'none' };
        }
      } else {
        turn = { q: question, none: true, via: 'none' };
      }
    }
    setTurns(x => [...x, turn]);
    await act(st => recordQuestion(st, { at: new Date().toISOString(), q: question, route: r.route, cards: turn.cards?.map(c => c.id) ?? turn.sentences?.flatMap(x => x.cards) ?? [], via: turn.via }));
    setBusy(false);
  };

  const useServer = () => { sharedBackend = localServer(); setBackend(sharedBackend); };
  const useDevice = async () => {
    setLoading(0);
    try { sharedBackend = await webgpuBackend(p => setLoading(p)); setBackend(sharedBackend); }
    catch (e) { alertLine(String(e)); }
    setLoading(null);
  };
  const [note, setNote] = useState('');
  const alertLine = (m: string) => setNote(m);

  const byId = new Map([...cards].map(c => [c.id, c]));
  return (
    <main class="page" style={{ paddingBottom: '150px' }}>
      <Enter k="ask">
        <div class="row"><Back to={base} /><span class="eyebrow">{t({ en: 'Ask a question', ar: 'اطرح سؤالاً' })}</span></div>
        <p class="muted">{t({ en: 'Answers come only from your own result and checked sources. Silah never tells you what to decide.', ar: 'تأتي الإجابات من نتيجتك ومن مصادر موثّقة فقط، ولا يخبرك تطبيق صلة بما تقرره.' })}</p>
        {turns.length === 0 && (
          <div class="row wrap">
            {INTENTS.filter(i => view?.status === 'at-risk' || i.id !== 'options').slice(0, 7).map(i => (
              <button key={i.id} class="chip" onClick={() => submit(t(i.label))}>{t(i.label)}</button>
            ))}
          </div>
        )}
        {turns.map((x, k) => (
          <div key={k} class="stack" style={{ '--gap': '10px' } as any}>
            <div class="bubble me">{x.q}</div>
            <div class="bubble silah stack" style={{ '--gap': '8px' } as any}>
              {x.routed && <p>{t(x.routed.reply)}</p>}
              {x.routed?.urgent && <p class="row wrap"><a class="btn palm" href="tel:999">999</a><a class="btn palm" href="tel:998">998</a></p>}
              {x.lead && <p><b>{t(x.lead)}</b></p>}
              {x.cards?.map(c => (
                <div key={c.id}>
                  <p>{t(c.text)}</p>
                  <div class="row wrap" style={{ marginTop: '6px' }}><SourceChips ids={c.sources} /></div>
                </div>
              ))}
              {x.sentences?.map((sn, j) => (
                <p key={j}>{sn.text}{sn.cards.map(id => <span class="cite" key={id}>{byId.get(id) ? id : 'counsellor'}</span>)}</p>
              ))}
              {x.none && <p>{t({ en: 'Silah does not have a checked answer to that. It has been added to the questions for your counsellor, who can answer it.', ar: 'لا يملك تطبيق صلة إجابة موثّقة عن ذلك، وقد أُضيف السؤال إلى أسئلتك للمستشار الوراثي الذي يستطيع الإجابة عنه.' })}</p>}
              {x.via === 'model' && <p class="tiny muted"><IconSpark size={12} /> {t({ en: `Worded by the on-device model from your cards${x.blocked ? `; ${x.blocked} sentence(s) held back by the safety check` : ''}.`, ar: `صاغها النموذج على الجهاز من بطاقاتك${x.blocked ? `، وحُجبت ${x.blocked} جملة بفحص السلامة` : ''}.` })}</p>}
              {(x.cards?.length || x.sentences?.length) ? <div><Listen text={[x.lead ? t(x.lead) : '', ...(x.cards?.map(c => t(c.text)) ?? []), ...(x.sentences?.map(z => z.text) ?? [])].join(' ')} label={t({ en: 'Listen', ar: 'استمع' })} /></div> : null}
            </div>
          </div>
        ))}
        {busy && <div class="bubble silah"><span class="muted">…</span></div>}
        <div ref={end} />
        <div class="pool soft stack" style={{ '--gap': '8px' } as any}>
          <p class="small"><b>{t({ en: 'Other questions', ar: 'أسئلة أخرى' })}</b></p>
          {backend ? (
            <p class="small muted">{t({ en: `Free questions are answered by ${backend.name}, on this machine, then checked.`, ar: `يجيب عن الأسئلة الحرة ${backend.name} على هذا الجهاز، ثم تُفحص الإجابة.` })}</p>
          ) : (
            <>
              <p class="small muted">{t({ en: 'Common questions are answered from your cards. For other questions, Silah can use a language model that runs on this device. Nothing leaves it.', ar: 'تُجاب الأسئلة الشائعة من بطاقاتك. وللأسئلة الأخرى يمكن لتطبيق صلة استخدام نموذج لغوي يعمل على هذا الجهاز، ولا يغادره شيء.' })}</p>
              <div class="row wrap">
                {server && <button class="chip palm" onClick={useServer}>{t({ en: 'Use the model on this computer', ar: 'استخدام النموذج على هذا الحاسوب' })}</button>}
                <button class="chip" disabled={loading !== null} onClick={useDevice}>
                  {loading !== null ? `${Math.round(loading * 100)}%` : t({ en: 'Download the on-device model (about 3 GB)', ar: 'تنزيل النموذج على الجهاز (نحو 3 غيغابايت)' })}
                </button>
              </div>
              {note && <p class="tiny muted">{note}</p>}
            </>
          )}
        </div>
      </Enter>
      <form class="ask-bar" onSubmit={e => { e.preventDefault(); submit(q); }}>
        <div class="ask-input">
          <input value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} placeholder={t({ en: 'Type your question…', ar: 'اكتب سؤالك…' })} aria-label={t({ en: 'Your question', ar: 'سؤالك' })} />
          <button class="btn primary" style={{ padding: '10px 18px' }} type="submit" disabled={busy}>{t({ en: 'Ask', ar: 'اسأل' })}</button>
        </div>
      </form>
    </main>
  );
}

export const goAsk = (base: string) => go(`${base}/ask`);
