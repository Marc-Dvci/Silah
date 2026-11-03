import { useEffect, useRef, useState } from 'preact/hooks';
import type { PersonState } from '../../app/person';
import { currentView, recordQuestion, escalate, escalationRef } from '../../app/person';
import { route } from '../../core/routes';
import { INTENTS, matchIntent, answerFrom } from '../../core/faq';
import type { FactCard, L10n } from '../../core/types';
import { askModel, detectLocalServer, quoteCards, type Backend } from '../../llm/answer';
import { getBackend, backendKind, useComputer as pickComputer, useDevice as pickDevice, useService as pickService } from '../../llm/backends';
import { nameOf, partnerDisplay } from '../../app/person';
import { Enter, Listen, go, useT, IconSpark } from '../kit';
import { Back } from './shell';
import { SourceChips } from './sources';
import { EscalationStatus } from './escalation';

type Act = (f: (st: PersonState) => Promise<void>) => Promise<void>;

interface Turn {
  q: string;
  lead?: L10n;
  cards?: FactCard[];
  sentences?: { text: string; cards: string[] }[];
  blocked?: number;
  routed?: { reply: L10n; urgent: boolean; ref?: string };
  none?: boolean;
  via: 'faq' | 'model' | 'route' | 'none';
}

export function Ask({ s, act, base }: { s: PersonState; act: Act; base: string }) {
  let sharedBackend: Backend | null = getBackend();   // chosen once per session, shared with "Explain in plain words"
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
      if (r.escalate) {
        const ref = escalationRef(s.id);
        turn.routed!.ref = ref;
        await act(st => escalate(st, r.route, ref));
      }
    } else {
      const intent = matchIntent(question);
      if (intent && view) {
        const a = answerFrom(intent, cards);
        turn = { q: question, lead: intent.lead, cards: a.cards, via: 'faq' };
      } else if (backend && view) {
        try {
          // The explanation service never receives a name: the question goes as typed, the cards with names replaced.
          const named = backendKind() === 'service' ? [nameOf(s), partnerDisplay(s), partnerDisplay(s, 'ar')] : [];
          const strip = (c: FactCard): FactCard => ({ ...c, text: { ...c.text, en: named.reduce((x, n) => (n ? x.split(n).join('your partner') : x), c.text.en), ar: named.reduce((x, n) => (n ? x.split(n).join('الطرف الآخر') : x), c.text.ar) } });
          const res = await askModel(backend, question, named.length ? cards.map(strip) : cards, s.lang);
          const picked = res.parsed ? quoteCards(res.parsed, cards) : [];
          // The model's own wording is shown where the verifier passed it; the cards it cites stay one tap away.
          // If nothing passed, the person reads the cited cards in their fixed words.
          const ok = res.verified?.shown ?? [];
          turn = ok.length
            ? { q: question, sentences: ok, cards: picked, via: 'model', blocked: res.verified?.blocked.length ?? 0 }
            : picked.length ? { q: question, cards: picked, via: 'model' } : { q: question, none: true, via: 'none' };
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

  const useServer = () => { pickComputer(); sharedBackend = getBackend(); setBackend(sharedBackend); };
  const useCloud = () => { pickService(); sharedBackend = getBackend(); setBackend(sharedBackend); };
  const useDevice = async () => {
    setLoading(0);
    try { await pickDevice(p => setLoading(p)); sharedBackend = getBackend(); setBackend(sharedBackend); }
    catch (e) {
      console.error('on-device model failed to start', e);
      alertLine(t({ en: 'The model could not start on this device’s graphics. Common questions still work, and your counsellor can answer the rest.', ar: 'تعذّر تشغيل النموذج على معالج الرسوميات في هذا الجهاز. ما زالت الأسئلة الشائعة متاحة، ويستطيع المستشار الوراثي الإجابة عن غيرها.' }));
    }
    setLoading(null);
  };
  const [note, setNote] = useState('');
  const alertLine = (m: string) => setNote(m);

  return (
    <main class="page" style={{ paddingBottom: '150px' }}>
      <Enter k="ask">
        <div class="row"><Back to={base} /><span class="eyebrow">{t({ en: 'Ask a question', ar: 'طرح سؤال' })}</span></div>
        <p class="muted">{t({ en: 'Answers come only from your own result and checked sources. Silah never tells you what to decide.', ar: 'تأتي الإجابات من نتيجتك ومن مصادر موثّقة فقط، ولا يملي عليكِ تطبيق صلة أي قرار.', arM: 'تأتي الإجابات من نتيجتك ومن مصادر موثّقة فقط، ولا يملي عليك تطبيق صلة أي قرار.' })}</p>
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
              {x.routed?.ref && <EscalationStatus e={s.escalations?.find(e => e.ref === x.routed!.ref)} lang={s.lang} />}
              {x.lead && <p><b>{t(x.lead)}</b></p>}
              {x.sentences?.map((sn, j) => <p key={`s${j}`}>{sn.text}</p>)}
              {x.sentences?.length ? (
                <details>
                  <summary class="tiny">{t({ en: 'Checked against this fixed text from your result', ar: 'تم التحقق منها مقابل هذا النص الثابت من نتيجتك' })}</summary>
                  <div class="stack" style={{ '--gap': '6px', marginTop: '6px' } as any}>
                    {x.cards?.map(c => <div key={c.id}><p class="small">{t(c.text)}</p><div class="row wrap" style={{ marginTop: '4px' }}><SourceChips ids={c.sources} /></div></div>)}
                  </div>
                </details>
              ) : x.cards?.map(c => (
                <div key={c.id}>
                  <p>{t(c.text)}</p>
                  <div class="row wrap" style={{ marginTop: '6px' }}><SourceChips ids={c.sources} /></div>
                </div>
              ))}
              {x.none &&<p>{t({ en: 'Silah does not have a checked answer to that. It has been added to the questions for your counsellor, who can answer it.', ar: 'لا يملك تطبيق صلة إجابة موثّقة عن ذلك، وقد أُضيف السؤال إلى قائمة أسئلتك للمستشار الوراثي الذي يستطيع الإجابة عنه.' })}</p>}
              {x.via === 'model' && (x.sentences?.length
                ? <p class="tiny muted"><IconSpark size={12} /> {t({ en: `Written by ${backend?.model ?? 'the model'} and checked against your numbers before it was shown${x.blocked ? `; ${x.blocked} held back` : ''}.`, ar: `كتبه ${backend?.model ?? 'النموذج'}، وتم التحقق منه مقابل أرقامك قبل عرضه${x.blocked ? `، وعدد الجمل المحجوبة: ${x.blocked}` : ''}.` })}</p>
                : <p class="tiny muted"><IconSpark size={12} /> {t({ en: 'The model’s own wording did not pass the checks, so these are the fixed sentences it pointed to.', ar: 'لم تجتز صياغة النموذج الفحص، لذلك هذه هي الجمل الثابتة التي أشار إليها.' })}</p>)}
              {(x.cards?.length || x.sentences?.length) ? <div><Listen text={[x.lead ? t(x.lead) : '', ...(x.sentences?.length ? x.sentences.map(z => z.text) : (x.cards?.map(c => t(c.text)) ?? []))].join(' ')} label={t({ en: 'Listen', ar: 'استماع' })} /></div> : null}
            </div>
          </div>
        ))}
        {busy && <div class="bubble silah"><span class="muted">…</span></div>}
        <div ref={end} />
        <div class="pool soft stack" style={{ '--gap': '8px' } as any}>
          <p class="small"><b>{t({ en: 'Other questions', ar: 'أسئلة أخرى' })}</b></p>
          {backend ? (
            <p class="small muted">{t({ en: `Free questions are answered by ${backend.name}, on this machine, then checked.`, ar: `يجيب عن الأسئلة المفتوحة ${backend.name} على هذا الجهاز، ثم تُفحص الإجابة.` })}</p>
          ) : (
            <>
              <p class="small muted">{t({ en: 'Common questions are answered from your cards. For other questions, Silah can use a language model that runs on this device. Nothing leaves it.', ar: 'تُجاب الأسئلة الشائعة من بطاقاتك. وللأسئلة الأخرى يمكن لتطبيق صلة استخدام نموذج لغوي يعمل على هذا الجهاز، ولا يغادره شيء.' })}</p>
              <div class="row wrap">
                {server && <button class="chip palm" onClick={useServer}>{t({ en: 'Use the model on this computer', ar: 'استخدام النموذج على هذا الحاسوب' })}</button>}
                <button class="chip" disabled={loading !== null} onClick={useDevice}>
                  {loading !== null ? `${Math.round(loading * 100)}%` : t({ en: 'Download the on-device model (about 3 GB)', ar: 'تنزيل النموذج على الجهاز (نحو 3 غيغابايت)' })}
                </button>
                <button class="chip" onClick={useCloud}>{t({ en: 'Use Silah’s explanation service (no names sent)', ar: 'استخدام خدمة الشرح في صلة (دون إرسال الأسماء)' })}</button>
              </div>
              {note && <p class="tiny muted">{note}</p>}
            </>
          )}
        </div>
      </Enter>
      <form class="ask-bar" onSubmit={e => { e.preventDefault(); submit(q); }}>
        <div class="ask-input">
          <input value={q} onInput={e => setQ((e.target as HTMLInputElement).value)} placeholder={t({ en: 'Type your question…', ar: 'سؤالك هنا…' })} aria-label={t({ en: 'Your question', ar: 'سؤالك' })} />
          <button class="btn primary" style={{ padding: '10px 18px' }} type="submit" disabled={busy}>{t({ en: 'Ask', ar: 'إرسال' })}</button>
        </div>
      </form>
    </main>
  );
}

export const goAsk = (base: string) => go(`${base}/ask`);
