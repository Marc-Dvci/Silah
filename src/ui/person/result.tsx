import { useEffect, useState } from 'preact/hooks';
import type { PersonState } from '../../app/person';
import { acknowledgeResult, bundleVerified, currentBundle, currentView, recordTeachback, shareFinding, revoke, requestBooking } from '../../app/person';
import { isCarrierFinding } from '../../core/kernel';
import { Q } from '../../core/fraction';
import type { FactCard } from '../../core/types';
import { activeGrants } from '../../core/crypto/receipts';
import { Enter, Kids, Field, KidFigure, Listen, ListenAll, Toggle, Receipt, IconSeal, go, useT, type Tx, type KidKind } from '../kit';
import { Back } from './shell';
import { partnerName } from './home';
import { SourceChips } from './sources';

type Act = (f: (st: PersonState) => Promise<void>) => Promise<void>;

export function Result({ s, act, base }: { s: PersonState; act: Act; base: string }) {
  const t = useT();
  const view = currentView(s)!;
  const bundle = currentBundle(s)!;
  const [verified, setVerified] = useState<boolean | null>(null);
  useEffect(() => { bundleVerified(s).then(setVerified); act(st => acknowledgeResult(st)); }, [bundle.sig]);
  const card = (id: string) => view.cards.find(c => c.id === id);
  const byKind = (k: FactCard['kind']) => view.cards.filter(c => c.kind === k);
  const partner = partnerName(s, s.lang);
  const atRisk = view.status === 'at-risk';

  return (
    <main class="page">
      <Enter k="result">
        <div class="row"><Back to={base} /><span class="eyebrow">{t({ en: 'Your result, together', ar: 'نتيجتكما معاً' })}</span></div>
        <p class="row small" style={{ color: verified ? 'var(--palm)' : 'var(--ink-2)', gap: '6px' }}>
          <IconSeal size={18} />
          {verified === null ? '…' : verified
            ? t({ en: `Signed by ${bundle.payload.issuer}. Checked on this phone.`, ar: `موقّعة من ${issuerAr(bundle.payload.issuer)}، وتم التحقق منها على هذا الهاتف.` })
            : t({ en: 'This result could not be verified. Do not rely on it.', ar: 'تعذّر التحقق من هذه النتيجة، فلا تعتمدي عليها.', arM: 'تعذّر التحقق من هذه النتيجة، فلا تعتمد عليها.' })}
        </p>

        <ListenAll label={t({ en: 'Listen to this page', ar: 'استمع إلى الصفحة كلها' })} texts={view.cards.filter(c => !c.id.startsWith('option:')).map(c => t(c.text))} />

        {view.counsellorFirst && (
          <div class="pool indigo stack" style={{ '--gap': '8px' } as any}>
            <h3>{t({ en: 'Part of this result needs a specialist first', ar: 'جزء من هذه النتيجة يحتاج إلى مختص أولاً' })}</h3>
            <p class="small">{t({ en: 'Some findings, like a change whose meaning is not yet known, are explained by a genetics professional before anything else. Nothing here is a diagnosis.', ar: 'بعض النتائج، مثل تغيّر لم يُعرف معناه بعد، يشرحها مختص في علم الوراثة قبل أي شيء آخر، ولا شيء هنا تشخيص.' })}</p>
            {!s.booking && <button class="btn primary" onClick={() => act(st => requestBooking(st))}>{t({ en: 'Book a counselling appointment', ar: 'حجز موعد استشارة' })}</button>}
          </div>
        )}

        {atRisk ? view.shared.map(sh => {
          const c = card(`couple:${sh.gene}`)!;
          return (
            <section class="stack" key={sh.gene}>
              <h1>{t({ en: `You and ${partner} both carry a change in the same gene.`, ar: `أنتِ و${partner} تحملان تغيّراً في الجين نفسه.`, arM: `أنت و${partner} تحملان تغيّراً في الجين نفسه.` })}</h1>
              <p class="row wrap"><span class="chip saffron num">{sh.gene}</span><span class="muted">{t(sh.condition.name)}</span></p>
              <p class="muted">{t(sh.condition.what)}</p>
              <div class="pool">
                <p class="eyebrow">{t({ en: 'In each pregnancy', ar: 'في كل حمل' })}</p>
                <Kids labels={{
                  aff: t({ en: 'May have the condition', ar: 'قد يُصاب بالحالة' }),
                  car: t({ en: 'Healthy carrier', ar: 'حامل سليم' }),
                  non: t({ en: 'Carries neither', ar: 'لا يحمل التغيّر' }),
                }} />
                <p style={{ marginTop: '6px' }}>{t(c.text)}</p>
                <div class="row wrap" style={{ marginTop: '12px' }}>
                  <Listen id={c.id} text={t(c.text)} label={t({ en: 'Listen', ar: 'استمع' })} />
                  <SourceChips ids={c.sources} />
                </div>
              </div>
              <div class="pool palm">
                <h3>{t({ en: 'What does not change', ar: 'ما الذي لا يتغيّر' })}</h3>
                <p style={{ marginTop: '6px' }}>{t(sh.condition.notChanged)}</p>
                <p class="muted small" style={{ marginTop: '6px' }}>{t({ en: 'This is a chance, not a diagnosis. It is the same in every pregnancy, and nobody is to blame for it.', ar: 'هذا احتمال وليس تشخيصاً، وهو نفسه في كل حمل، ولا لوم فيه على أحد.' })}</p>
              </div>
            </section>
          );
        }) : (
          <section class="stack">
            <h1>{t({ en: 'The panel found no gene where you both carry a change.', ar: 'لم تجد اللوحة جيناً تحملان كلاكما تغيّراً فيه.' })}</h1>
            <p class="muted">{t({ en: '“Compatible” is good news. It does not mean zero chance, and the numbers below show how small the remaining chance is.', ar: '«متوافق» خبر طيب، لكنه لا يعني أن الاحتمال صفر، والأرقام أدناه تبيّن مدى صغر الاحتمال المتبقي.' })}</p>
            <div class="pool">
              <p class="eyebrow">{t({ en: 'Conditions on the panel, per pregnancy', ar: 'حالات اللوحة، في كل حمل' })}</p>
              <div style={{ margin: '14px 0' }}><Field n={view.panelRisk.oneIn()} /></div>
              <p><b class="num">{t({ en: `1 in ${view.panelRisk.oneIn().toLocaleString('en-US')}`, ar: `1 من ${view.panelRisk.oneIn().toLocaleString('en-US')}` })}</b> {t({ en: 'per pregnancy: about one dot in this whole field.', ar: 'في كل حمل: نحو نقطة واحدة في هذا الحقل كله.' })}</p>
              <p class="muted small" style={{ marginTop: '8px' }}>{t({ en: 'The official certificate wording for a compatible couple reads “No risk for either the other partner or children to be carrier or diseased”. The same standard also says the test does not cover all genetic disorders. Silah shows both halves.', ar: 'تنص صيغة الشهادة الرسمية للزوجين المتوافقين على «لا توجد خطورة على الطرف الآخر والأطفال»، بينما يذكر المعيار نفسه أن الفحص لا يغطي جميع الاضطرابات الوراثية. يعرض تطبيق صلة الأمرين معاً.' })}</p>
              <div style={{ marginTop: '10px' }}><SourceChips ids={['doh-pms-2024']} /></div>
            </div>
          </section>
        )}

        <OwnFindings s={s} act={act} />

        <h2>{t({ en: 'What this test cannot see', ar: 'ما لا يستطيع هذا الفحص رؤيته' })}</h2>
        <section class="flow">
          {[...byKind('vus'), ...byKind('residual-gene'), card('panel-residual'), card('not-assessed'), card('consanguinity'), card('background')]
            .filter((c): c is FactCard => !!c)
            .map(c => <CardLine key={c.id} c={c} />)}
        </section>

        <div class="stack" style={{ '--gap': '10px' } as any}>
          <button class="btn primary full" onClick={() => go(`${base}/check`)}>{t({ en: 'Check I have understood', ar: 'تحقّقي من فهمي', arM: 'تحقّق من فهمي' })}</button>
          <p class="tiny muted" style={{ textAlign: 'center' }}>{t({ en: `Panel: ${bundle.payload.person.panelVersion}`, ar: `اللوحة: ${bundle.payload.person.panelVersion}` })}</p>
        </div>
      </Enter>
    </main>
  );
}

const issuerAr = (x: string) => x.includes('EGP') ? 'خدمة الجينوم الإماراتي (محاكاة)' : 'مختبر الجينوم لفحص ما قبل الزواج (محاكاة)';

export function CardLine({ c }: { c: FactCard }) {
  const t = useT();
  return (
    <div>
      <p>{t(c.text)}</p>
      <div class="row wrap" style={{ marginTop: '10px' }}>
        <Listen id={c.id} text={t(c.text)} label={t({ en: 'Listen', ar: 'استمع' })} />
        <SourceChips ids={c.sources} />
      </div>
    </div>
  );
}

/** The person's own carrier findings. Private by default; each can be shared with the partner. */
function OwnFindings({ s, act }: { s: PersonState; act: Act }) {
  const t = useT();
  const b = currentBundle(s)!;
  const view = currentView(s)!;
  const sharedGenes = new Set(view.shared.map(x => x.gene));
  const own = b.payload.person.findings.filter(isCarrierFinding).filter(f => !sharedGenes.has(f.gene));
  if (!own.length) return null;
  const grants = activeGrants(s.ledger, new Date());
  const partner = partnerName(s, s.lang);
  return (
    <section class="stack">
      <h2>{t({ en: 'Your own findings', ar: 'نتائجك الخاصة' })}</h2>
      <p class="muted">{t({ en: `These are yours. ${partner} does not see them unless you share them.`, ar: `هذه نتائجك أنتِ، ولا يراها ${partner} إلا إذا شاركتِها.`, arM: `هذه نتائجك أنت، ولا تراها ${partner} إلا إذا شاركتها.` })}</p>
      {own.map(f => {
        const g = grants.find(x => x.subject.kind === 'finding' && x.subject.gene === f.gene);
        const seq = g ? s.ledger.find(e => e.payload.action === 'share' && e.payload.subject.gene === f.gene && e.payload.at === g.at)?.payload.seq : undefined;
        return (
          <div key={f.gene} class="stack" style={{ '--gap': '6px' } as any}>
            <div class="row">
              <span class="chip saffron num">{f.gene}</span>
              <span class="grow small muted">{t({ en: 'You carry one changed copy. You are healthy.', ar: 'تحملين نسخة متغيرة واحدة، وأنتِ سليمة.', arM: 'تحمل نسخة متغيرة واحدة، وأنت سليم.' })}</span>
              <Toggle on={!!g} label={t({ en: `Share ${f.gene} with ${partner}`, ar: `مشاركة ${f.gene} مع ${partner}` })}
                onChange={on => act(st => on ? shareFinding(st, f.gene) : seq !== undefined ? revoke(st, seq) : Promise.resolve())} />
            </div>
            {g && <Receipt><b>{t({ en: 'Shared', ar: 'تمت المشاركة' })}</b> · {partner} · {t({ en: `${f.gene} carrier status only`, ar: `حالة الحمل للجين ${f.gene} فقط` })} · {t({ en: 'you can stop sharing at any time', ar: 'يمكنك إيقاف المشاركة في أي وقت' })}</Receipt>}
          </div>
        );
      })}
    </section>
  );
}

// ---------- teach-back ----------

interface TQ { id: string; ask: Tx; kind: 'pick' | 'tf'; answer: number | boolean; options?: KidKind[][]; explain: Tx }

function questions(atRisk: boolean): TQ[] {
  if (atRisk) return [
    {
      id: 'chance', kind: 'pick', answer: 0,
      ask: { en: 'Which picture shows what can happen in each pregnancy?', ar: 'أي صورة تبيّن ما قد يحدث في كل حمل؟' },
      options: [['aff', 'car', 'car', 'non'], ['aff', 'aff', 'car', 'car'], ['aff', 'aff', 'aff', 'aff']],
      explain: { en: 'In each pregnancy: 1 in 4 may have the condition, 2 in 4 are healthy carriers, 1 in 4 carries neither change.', ar: 'في كل حمل: 1 من 4 قد يُصاب بالحالة، و2 من 4 حاملون أصحّاء، و1 من 4 لا يحمل أي تغيّر.' },
    },
    { id: 'next', kind: 'tf', answer: false, ask: { en: '“If our first child is healthy, the next one will be too.”', ar: '«إذا كان طفلنا الأول سليماً فسيكون الثاني سليماً أيضاً.»' }, explain: { en: 'The chance is the same in every pregnancy. A healthy child does not change it.', ar: 'الاحتمال نفسه في كل حمل، وسلامة طفل لا تغيّره.' } },
    { id: 'ill', kind: 'tf', answer: false, ask: { en: '“Being a carrier means I am ill.”', ar: '«حمل التغيّر يعني أن الشخص مريض.»' }, explain: { en: 'Carriers are healthy. It matters only when both parents carry a change in the same gene.', ar: 'الحاملون أصحّاء، ولا يهم الأمر إلا إذا حمل الوالدان كلاهما تغيّراً في الجين نفسه.' } },
    { id: 'ours', kind: 'tf', answer: true, ask: { en: '“The decision about what to do next is ours.”', ar: '«القرار في ما نفعله بعد ذلك قرارنا.»' }, explain: { en: 'Yes. Silah and the counsellor explain; the decision belongs to you.', ar: 'نعم. يشرح تطبيق صلة والمستشار، والقرار لكما.' } },
  ];
  return [
    { id: 'zero', kind: 'tf', answer: false, ask: { en: '“Compatible means there is no chance at all.”', ar: '«متوافق يعني أنه لا يوجد أي احتمال على الإطلاق.»' }, explain: { en: 'Compatible lowers the chance a lot, but not to zero.', ar: '«متوافق» يخفض الاحتمال كثيراً، لكن ليس إلى الصفر.' } },
    { id: 'all', kind: 'tf', answer: false, ask: { en: '“The test checks every genetic condition.”', ar: '«الفحص يكشف كل الحالات الوراثية.»' }, explain: { en: 'It checks recessive conditions on the panel only, not all of them.', ar: 'يفحص الحالات المتنحية في اللوحة فقط، وليس جميعها.' } },
    { id: 'ill', kind: 'tf', answer: false, ask: { en: '“Being a carrier means I am ill.”', ar: '«حمل التغيّر يعني أن الشخص مريض.»' }, explain: { en: 'Carriers are healthy.', ar: 'الحاملون أصحّاء.' } },
    { id: 'cousins', kind: 'tf', answer: true, ask: { en: '“Because we are cousins, our background chance is a little higher than for unrelated parents.”', ar: '«لأننا أقارب، فإن احتمالنا الأساسي أعلى قليلاً منه لدى الوالدين غير الأقارب.»' }, explain: { en: 'Yes, mostly from recessive conditions the panel does not test.', ar: 'نعم، ومعظم ذلك من حالات متنحية لا تفحصها اللوحة.' } },
  ];
}

export function Check({ s, act, base }: { s: PersonState; act: Act; base: string }) {
  const t = useT();
  const view = currentView(s)!;
  const qs = questions(view.status === 'at-risk');
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<(number | boolean | null)[]>(qs.map(() => null));
  const done = i >= qs.length;
  const q = qs[Math.min(i, qs.length - 1)];
  const answered = picked[i] !== null && picked[i] !== undefined;
  const right = (k: number) => picked[k] === qs[k].answer;

  const pick = (v: number | boolean) => {
    if (answered) return;
    const p = [...picked]; p[i] = v; setPicked(p);
  };
  const finish = async () => {
    const correct = qs.filter((_, k) => right(k)).length;
    await act(st => recordTeachback(st, { at: new Date().toISOString(), correct, total: qs.length, missed: qs.filter((_, k) => !right(k)).map(x => x.id) }));
    setI(qs.length);
  };

  if (done) {
    const correct = qs.filter((_, k) => right(k)).length;
    return (
      <main class="page">
        <Enter k="check-done">
          <div class="row"><Back to={base} /><span class="eyebrow">{t({ en: 'Make sure it is clear', ar: 'تأكدي من وضوح الصورة', arM: 'تأكد من وضوح الصورة' })}</span></div>
          <h1>{correct === qs.length
            ? t({ en: 'You have it, clearly.', ar: 'الصورة واضحة لديك تماماً.' })
            : t({ en: `${correct} of ${qs.length} — here is the rest, once more.`, ar: `${correct} من ${qs.length}، وإليك الباقي مرة أخرى.` })}</h1>
          {qs.map((x, k) => !right(k) && <div key={x.id} class="pool saffron"><p>{t(x.explain)}</p></div>)}
          <p class="muted">{t({ en: 'Your counsellor can see these answers only if you choose to share them, so your appointment can start where you are.', ar: 'لا يرى مستشارك هذه الإجابات إلا إذا اخترت مشاركتها، ليبدأ موعدك من حيث وصلت.' })}</p>
          <div class="stack" style={{ '--gap': '10px' } as any}>
            <button class="btn primary full" onClick={() => go(`${base}/counsellor`)}>{t({ en: 'Go to my counsellor', ar: 'الانتقال إلى مستشاري' })}</button>
            <button class="btn calm full" onClick={() => { setPicked(qs.map(() => null)); setI(0); }}>{t({ en: 'Try again', ar: 'المحاولة مرة أخرى' })}</button>
          </div>
        </Enter>
      </main>
    );
  }

  return (
    <main class="page">
      <Enter k={`check-${i}`}>
        <div class="row"><Back to={base} /><span class="eyebrow">{t({ en: `Question ${i + 1} of ${qs.length}`, ar: `السؤال ${i + 1} من ${qs.length}` })}</span></div>
        <h2>{t(q.ask)}</h2>
        {q.kind === 'pick' ? (
          <div class="stack" style={{ '--gap': '10px' } as any}>
            {q.options!.map((row, k) => (
              <button key={k} class={`choice ${answered ? (k === q.answer ? 'right' : picked[i] === k ? 'wrong' : '') : picked[i] === k ? 'picked' : ''}`} onClick={() => pick(k)}
                aria-label={describeRow(row, t)}>
                <div class="row" style={{ justifyContent: 'space-around' }}>{row.map((kind, j) => <KidFigure key={j} kind={kind} size={0.75} />)}</div>
              </button>
            ))}
          </div>
        ) : (
          <div class="tf">
            {[true, false].map(v => (
              <button key={String(v)} class={`choice ${answered ? (v === q.answer ? 'right' : picked[i] === v ? 'wrong' : '') : ''}`} style={{ textAlign: 'center' }} onClick={() => pick(v)}>
                {v ? t({ en: 'True', ar: 'صحيح' }) : t({ en: 'Not true', ar: 'غير صحيح' })}
              </button>
            ))}
          </div>
        )}
        {answered && (
          <div class={`pool ${right(i) ? 'palm' : 'saffron'}`}>
            <p><b>{right(i) ? t({ en: 'Yes.', ar: 'نعم.' }) : t({ en: 'Not quite.', ar: 'ليس تماماً.' })}</b> {t(q.explain)}</p>
          </div>
        )}
        {answered && (
          <button class="btn primary full" onClick={() => (i + 1 < qs.length ? setI(i + 1) : finish())}>
            {i + 1 < qs.length ? t({ en: 'Next', ar: 'التالي' }) : t({ en: 'Finish', ar: 'إنهاء' })}
          </button>
        )}
      </Enter>
    </main>
  );
}

export const oneInOf = (c: FactCard, key = 'affected') => Q.from(c.numbers[key]).oneIn();

/** A spoken description of a row of counted children, for screen readers. */
function describeRow(row: KidKind[], t: (x: Tx) => string): string {
  const n = (k: KidKind) => row.filter(x => x === k).length;
  return t({
    en: `${n('aff')} of 4 may have the condition, ${n('car')} of 4 healthy carriers, ${n('non')} of 4 carry neither`,
    ar: `${n('aff')} من 4 قد يُصاب بالحالة، و${n('car')} من 4 حاملون أصحّاء، و${n('non')} من 4 لا يحملون التغيّر`,
  });
}
