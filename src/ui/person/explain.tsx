import { useEffect, useState } from 'preact/hooks';
import type { PersonState } from '../../app/person';
import { currentView, isOwn, nameOf, partnerDisplay, saveExplanation, sexOf } from '../../app/person';
import type { FactCard } from '../../core/types';
import { explain, explainCards, shown, type Audience, type Explanation } from '../../llm/explain';
import { storedExplanation } from '../../llm/stored';
import { backendKind, getBackend, hasComputerModel, onBackend, useComputer, useDevice, useService } from '../../llm/backends';
import { IconSpark, Listen, useT } from '../kit';
import { SourceChips } from './sources';

type Act = (f: (st: PersonState) => Promise<void>) => Promise<void>;

/** The stored explanation for this result and language, or the one written for a fictional person, re-checked now. */
export function currentExplanation(s: PersonState, cards: FactCard[], audience: Audience = 'person'): Explanation | undefined {
  return storedExplanation({ id: s.id, lang: s.lang, own: isOwn(s.id), sampleName: s.profile?.name, explanations: s.explanations }, cards, audience);
}

export function ExplainPanel({ s, act, audience = 'person' }: { s: PersonState; act: Act; audience?: Audience }) {
  const t = useT();
  const view = currentView(s);
  const cards = view?.cards ?? [];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [choose, setChoose] = useState(false);
  const [computer, setComputer] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [, bump] = useState(0);
  useEffect(() => { hasComputerModel().then(setComputer); return onBackend(() => bump(x => x + 1)); }, []);
  if (!view) return null;

  const e = currentExplanation(s, cards, audience);
  const ok = e ? shown(e) : [];
  const held = e ? e.sentences.length - e.sentences.filter(x => x.ok).length : 0;
  const byId = new Map(cards.map(c => [c.id, c]));

  const run = async () => {
    const b = getBackend();
    if (!b) { setChoose(true); return; }
    setBusy(true); setErr(''); setChoose(false);
    try {
      // The explanation service never receives a name: both names are replaced before the cards leave the phone.
      const redact = backendKind() === 'service' ? [nameOf(s), nameOf(s, 'ar'), partnerDisplay(s), partnerDisplay(s, 'ar')] : [];
      const lang = audience === 'clinician' ? 'en' : s.lang;
      const x = await explain(b, cards, lang, audience, sexOf(s), redact);
      await act(st => saveExplanation(st, x));
    } catch (ex) {
      console.error('explanation failed', ex);
      setErr(t({ en: 'The model could not write an explanation just now. Everything on this page is still checked text.', ar: 'تعذّر على النموذج كتابة الشرح الآن، وكل ما في هذه الصفحة ما زال نصاً موثّقاً.' }));
    }
    setBusy(false);
  };
  const pick = async (k: 'device' | 'computer' | 'service') => {
    setErr('');
    try {
      if (k === 'computer') useComputer();
      else if (k === 'service') useService();
      else { setProgress(0); await useDevice(p => setProgress(p)); setProgress(null); }
      await run();
    } catch (ex) {
      setProgress(null);
      console.error(ex);
      setErr(t({ en: 'The model could not start on this device’s graphics. Try the explanation service, or read the checked text below.', ar: 'تعذّر تشغيل النموذج على معالج الرسوميات في هذا الجهاز. يمكنك تجربة خدمة الشرح، أو قراءة النص الموثّق أدناه.' }));
    }
  };

  const title = audience === 'clinician'
    ? t({ en: 'Summary for the clinician, in plain words', ar: 'ملخص للطبيب بلغة واضحة' })
    : t({ en: 'Your result in plain words', ar: 'نتيجتك بكلمات بسيطة' });

  return (
    <section class="pool indigo stack" id="focus-explain" style={{ '--gap': '10px', scrollMarginTop: '72px' } as any}>
      <p class="eyebrow row" style={{ gap: '6px' }}><IconSpark size={14} /> {title}</p>
      {ok.length > 0 ? (
        <>
          <div class="stack" style={{ '--gap': '8px' } as any}>
            {ok.map((x, i) => (
              <div key={i}>
                <p>{x.text} <button class="cite" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} title={t({ en: 'Checked against', ar: 'تم التحقق مقابل' })}>{t({ en: 'source', ar: 'المصدر' })}</button></p>
                {open === i && (
                  <div class="receipt stack" style={{ '--gap': '6px', marginTop: '6px' } as any}>
                    <p class="tiny"><b>{t({ en: 'Checked against this fixed text from your result:', ar: 'تم التحقق منها مقابل هذا النص الثابت من نتيجتك:' })}</b></p>
                    {x.cards.map(id => byId.get(id)).filter((c): c is FactCard => !!c).map(c => (
                      <div key={c.id}><p class="tiny">{t(c.text)}</p><div class="row wrap" style={{ marginTop: '4px' }}><SourceChips ids={c.sources} /></div></div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div class="row wrap">
            <Listen text={ok.map(x => x.text).join(' ')} label={t({ en: 'Listen', ar: 'استماع' })} />
            <button class="chip" disabled={busy} onClick={run}>{busy ? '…' : t({ en: 'Write it again', ar: 'كتابته من جديد' })}</button>
          </div>
          <p class="tiny muted">
            {e!.precomputed
              ? t({ en: `Written by ${e!.model} when this demo was built, for this fictional person. Checked again on this phone just now: ${ok.length} sentences passed`, ar: `كتبه ${e!.model} عند إعداد هذا العرض لهذا الشخص الافتراضي، وتم التحقق منه مجدداً على هذا الهاتف الآن. عدد الجمل التي اجتازت الفحص: ${ok.length}` })
              : t({ en: `Written by ${e!.model}. Each sentence was checked on this phone against your numbers before it was shown: ${ok.length} passed`, ar: `كتبه ${e!.model}، وقبل عرض كل جملة تم التحقق منها على هذا الهاتف مقابل أرقامك. عدد الجمل التي اجتازت الفحص: ${ok.length}` })}
            {held > 0 ? t({ en: `, ${held} held back.`, ar: `، وعدد المحجوبة: ${held}.` }) : '.'}
            {' '}{t({ en: 'It is not medical advice; the fixed text on this page is the reference.', ar: 'وليس هذا نصيحة طبية، والنص الثابت في هذه الصفحة هو المرجع.' })}
          </p>
        </>
      ) : (
        <>
          <p class="small">{audience === 'clinician'
            ? t({ en: 'A language model can add a short paragraph for the clinician. Every sentence is checked against the numbers before it is used.', ar: 'يمكن لنموذج لغوي إضافة فقرة قصيرة للطبيب، ويُتحقق من كل جملة مقابل الأرقام قبل استخدامها.' })
            : t({ en: 'A language model can explain your result in everyday words, including what is still uncertain. Each sentence is checked against your own numbers before you see it, and nothing it writes can tell you what to decide.', ar: 'يمكن لنموذج لغوي أن يشرح نتيجتك بكلمات يومية، بما في ذلك ما زال غير مؤكد. ويُتحقق من كل جملة مقابل أرقامك قبل عرضها، ولا يمكن لما يكتبه أن يملي عليك أي قرار.' })}</p>
          {e && <p class="tiny muted">{t({ en: 'The last attempt did not pass the checks, so it is not shown.', ar: 'لم تجتز المحاولة الأخيرة الفحص، لذلك لا تُعرض.' })}</p>}
          <button class="btn primary" disabled={busy || progress !== null} onClick={run}>
            {busy ? t({ en: 'Writing and checking…', ar: 'جارٍ الكتابة والتحقق…' }) : progress !== null ? `${Math.round(progress * 100)}%` : t({ en: 'Explain in plain words', ar: 'اشرح بكلمات بسيطة' })}
          </button>
        </>
      )}
      {choose && !busy && (
        <div class="stack" style={{ '--gap': '8px' } as any}>
          <p class="small"><b>{t({ en: 'Where should the model run?', ar: 'أين يعمل النموذج؟' })}</b></p>
          <button class="choice" onClick={() => pick('device')}>
            <b>{t({ en: 'On this device', ar: 'على هذا الجهاز' })}</b>
            <div class="small muted">{t({ en: 'Gemma 4 E2B in the browser. Nothing leaves the phone. About 3 GB to download once; needs WebGPU.', ar: 'نموذج Gemma 4 E2B داخل المتصفح، ولا يغادر الهاتف شيء. يتطلب تنزيل نحو 3 غيغابايت مرة واحدة، ودعم WebGPU.' })}</div>
          </button>
          {computer && (
            <button class="choice" onClick={() => pick('computer')}>
              <b>{t({ en: 'On this computer', ar: 'على هذا الحاسوب' })}</b>
              <div class="small muted">{t({ en: 'Gemma 4 through llama.cpp, running here. Nothing leaves the machine.', ar: 'نموذج Gemma 4 عبر llama.cpp يعمل هنا، ولا يغادر الجهاز شيء.' })}</div>
            </button>
          )}
          <button class="choice" onClick={() => pick('service')}>
            <b>{t({ en: 'Silah’s explanation service', ar: 'خدمة الشرح في صلة' })}</b>
            <div class="small muted">{t({ en: 'Gemma on Cloudflare Workers AI. Sends only the fixed text and numbers of your result, with names removed; nothing is stored. The checks still run on this phone.', ar: 'نموذج Gemma على Cloudflare Workers AI. لا يُرسَل إلا النص الثابت والأرقام الخاصة بنتيجتك بعد حذف الأسماء، ولا يُحفظ شيء. ويبقى التحقق على هذا الهاتف.' })}</div>
          </button>
        </div>
      )}
      {err && <p class="small">{err}</p>}
    </section>
  );
}

/** The cards an explanation can use, for display in the "what is uncertain" section. */
export const uncertaintyOf = (cards: FactCard[]) => explainCards(cards).filter(c => c.kind === 'uncertainty');
