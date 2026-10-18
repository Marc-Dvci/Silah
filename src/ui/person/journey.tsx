import { useState } from 'preact/hooks';
import type { PersonState, PathState } from '../../app/person';
import { coupleOf, currentView, setBirthPlan, askForInvites, requestBooking, shareBrief, revoke, escalate, HOSPITAL } from '../../app/person';
import { OPTIONS, relativeCard, type Relative } from '../../core/kernel';
import { activeGrants } from '../../core/crypto/receipts';
import { Enter, Listen, Toggle, Receipt, Step, KidFigure, go, useT, useN, IconShare, IconCheck } from '../kit';
import { Back } from './shell';
import { fmtSlot } from './home';
import { SourceChips } from './sources';
import { CardLine } from './result';

type Act = (f: (st: PersonState) => Promise<void>) => Promise<void>;

// ---------- options: equal weight, fixed order, no ranking ----------

export function Options({ base }: { s: PersonState; base: string }) {
  const t = useT();
  return (
    <main class="page">
      <Enter k="options">
        <div class="row"><Back to={base} /><span class="eyebrow">{t({ en: 'Your options', ar: 'خياراتكما' })}</span></div>
        <h1>{t({ en: 'There is no single right choice for every family.', ar: 'لا يوجد خيار واحد صحيح لكل الأسر.' })}</h1>
        <p class="muted">{t({ en: 'These are the paths the programme offers. Silah will not tell you which to take. Many couples talk them through with a counsellor and with their family first.', ar: 'هذه هي المسارات التي يقدّمها البرنامج، ولن يخبركما تطبيق صلة أيّها تسلكان. كثير من الأزواج يناقشونها أولاً مع مستشار وراثي ومع أسرهم.' })}</p>
        <div class="flow">{OPTIONS.map(o => <CardLine key={o.id} c={o} />)}</div>
        <button class="btn primary full" onClick={() => go(`${base}/counsellor`)}>{t({ en: 'Talk it through with a counsellor', ar: 'ناقشا الأمر مع مستشار وراثي' })}</button>
      </Enter>
    </main>
  );
}

// ---------- birth plan ----------

export function BirthPlan({ s, act, base }: { s: PersonState; act: Act; base: string }) {
  const t = useT();
  const view = currentView(s)!;
  const couple = coupleOf(s.id);
  const conds = view.birthPlanConditions;
  const genes = view.shared.filter(x => conds.includes(x.condition)).map(x => x.gene);
  const on = !!s.birthPlan?.active;
  const due = couple?.pregnancyDue;
  const weeksLeft = due ? Math.max(0, Math.round((new Date(due).getTime() - Date.now()) / (7 * 864e5))) : null;
  return (
    <main class="page">
      <Enter k="birth">
        <div class="row"><Back to={base} /><span class="eyebrow">{t({ en: 'A plan for birth', ar: 'خطة للولادة' })}</span></div>
        <h1>{t({ en: 'Whatever you decided, the first days can make a difference.', ar: 'مهما كان قراركما، قد تُحدث الأيام الأولى فرقاً.' })}</h1>
        {conds.map(c => (
          <div key={c.id} class="pool stack">
            <div class="row"><KidFigure kind="car" size={0.7} /><h3>{t(c.name)}</h3></div>
            <p>{t(c.birthPlan!.action)}</p>
            <p class="muted">{t(c.birthPlan!.window)}</p>
            <div class="row wrap"><Listen id={`birth:${c.id}`} text={`${t(c.birthPlan!.action)} ${t(c.birthPlan!.window)}`} label={t({ en: 'Listen', ar: 'استمع' })} /><SourceChips ids={c.birthPlan!.sources} /></div>
          </div>
        ))}
        {s.birthOutcome && (
          <div class={`pool ${s.birthOutcome.affected ? 'indigo' : 'palm'} stack`} style={{ '--gap': '8px' } as any}>
            <p class="eyebrow">{t({ en: 'Your baby’s test', ar: 'فحص طفلكما' })} · {new Date(s.birthOutcome.at).toLocaleDateString(s.lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long' })}</p>
            {s.birthOutcome.affected ? (
              <p>{t({ en: `The test in the first days confirmed ${s.birthOutcome.genes.join(', ')}. Your baby was referred this week to the treating team, before any signs.`, ar: `أكّد الفحص في الأيام الأولى الإصابة المرتبطة بالجين ${s.birthOutcome.genes.join('، ')}. وقد أُحيل طفلكما هذا الأسبوع إلى الفريق المعالج، قبل ظهور أي علامات.` })}</p>
            ) : (
              <p>{t({ en: `The test in the first days showed your baby is not affected (${s.birthOutcome.genes.join(', ')}). Children are not tested for carrier status; they can choose that for themselves when they are older.`, ar: `أظهر الفحص في الأيام الأولى أن طفلكما غير مصاب (${s.birthOutcome.genes.join('، ')}). لا يُفحص الأطفال لمعرفة إن كانوا حاملين للتغيّر، ويمكنهم أن يقرروا ذلك بأنفسهم عندما يكبرون.` })}</p>
            )}
          </div>
        )}
        {s.birthOutcome ? null : due ? (
          <div class="stack">
            <p class="row"><span class="chip indigo num">{t({ en: `Due ${new Date(due).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`, ar: `الموعد المتوقع ${new Date(due).toLocaleDateString('ar-AE-u-nu-latn', { day: 'numeric', month: 'long' })}` })}</span>
              <span class="muted small">{t({ en: `about ${weeksLeft} weeks`, ar: `بعد نحو ${weeksLeft} أسبوعاً` })}</span></p>
            <div class="row" style={{ alignItems: 'flex-start' }}>
              <div class="grow">
                <h3>{t({ en: 'Tell the delivery hospital', ar: 'إبلاغ مستشفى الولادة' })}</h3>
                <p class="muted small">{t({ en: `${t(HOSPITAL)} will know to test the baby for ${genes.join(', ')} in the first days. Nothing else is shared.`, ar: `سيعرف ${HOSPITAL.ar} أن يفحص الطفل لـ${genes.join('، ')} في الأيام الأولى، ولا يُشارَك أي شيء آخر.` })}</p>
              </div>
              <Toggle on={on} label={t({ en: 'Tell the delivery hospital', ar: 'إبلاغ مستشفى الولادة' })} onChange={v => act(st => setBirthPlan(st, v, conds.map(c => c.id), genes))} />
            </div>
            {on && <Receipt><b>{t({ en: 'Shared', ar: 'تمت المشاركة' })}</b> · {t(HOSPITAL)} · {t({ en: `${genes.join(', ')} only, this pregnancy, until six weeks after birth`, ar: `${genes.join('، ')} فقط، لهذا الحمل، حتى ستة أسابيع بعد الولادة` })} · {t({ en: 'turn off to withdraw', ar: 'أوقفيه للسحب', arM: 'أوقفه للسحب' })}</Receipt>}
          </div>
        ) : (
          <p class="muted">{t({ en: 'When you are expecting, you can turn this on here, and the delivery hospital will be ready.', ar: 'عندما يحدث حمل، يمكنكما تفعيل هذا من هنا، وسيكون مستشفى الولادة مستعداً.' })}</p>
        )}
      </Enter>
    </main>
  );
}

// ---------- family: anonymous invitations ----------

const RELS: Relative[] = ['sibling', 'aunt-uncle', 'first-cousin'];

export function Family({ s, act, base }: { s: PersonState; act: Act; base: string }) {
  const t = useT();
  const n = useN();
  const view = currentView(s)!;
  const gene = view.shared[0]?.gene ?? (s.bundles.at(-1)?.payload.person.findings[0]?.gene ?? '');
  const [withGene, setWithGene] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const tokens = s.invites.tokens;
  const link = (tok: string) => `${location.origin}${location.pathname}#/r/${tok}${withGene ? `?g=${gene}` : ''}`;
  const message = (tok: string) => t({
    en: `Someone in your family has learned they carry a gene change that can matter for children. Testing is available to you. This invitation does not say who sent it.${withGene ? ` The gene is ${gene}.` : ''} ${link(tok)}`,
    ar: `علم أحد أفراد عائلتك أنه يحمل تغيّراً جينياً قد يهم الأطفال، والفحص متاح لك. لا تذكر هذه الدعوة من أرسلها.${withGene ? ` الجين هو ${gene}.` : ''} ${link(tok)}`,
  });
  const shareIt = async (tok: string, k: number) => {
    const text = message(tok);
    if (navigator.share) { try { await navigator.share({ text }); return; } catch { /* fall back to copy */ } }
    await navigator.clipboard?.writeText(text);
    setCopied(k);
  };
  return (
    <main class="page">
      <Enter k="family">
        <div class="row"><Back to={base} /><span class="eyebrow">{t({ en: 'Your family', ar: 'عائلتك' })}</span></div>
        <h1>{t({ en: 'The same change often runs in a family.', ar: 'كثيراً ما يسري التغيّر نفسه في العائلة.' })}</h1>
        <p class="muted">{t({ en: 'Relatives who marry within the family are the people most likely to share it. Knowing early gives them the same choices you have.', ar: 'الأقارب الذين يتزوجون داخل العائلة هم الأكثر احتمالاً لمشاركته، والمعرفة المبكرة تمنحهم الخيارات نفسها المتاحة لك.' })}</p>
        <div class="pool stack" style={{ '--gap': '10px' } as any}>
          {RELS.map(r => {
            const c = relativeCard(r, gene);
            const k = Number(c.numbers.prior.d);
            return (
              <div key={r} class="row">
                <div class="row" style={{ gap: '2px', width: '120px', flex: 'none' }}>
                  {Array.from({ length: Math.min(k, 8) }, (_, i) => <KidFigure key={i} kind={i === 0 ? 'car' : 'non'} size={k > 4 ? 0.34 : 0.45} />)}
                </div>
                <p class="small">{t(c.text)}</p>
              </div>
            );
          })}
          <SourceChips ids={['bennett-2002']} />
        </div>

        <h2>{t({ en: 'Invite them without saying it was you', ar: 'ادعيهم دون أن يعرفوا أنكِ المرسِلة', arM: 'ادعُهم دون أن يعرفوا أنك المرسِل' })}</h2>
        <div class="pool palm stack" style={{ '--gap': '8px' } as any}>
          <p class="small"><b>{t({ en: 'How this stays anonymous', ar: 'كيف تبقى الدعوة مجهولة المصدر' })}</b></p>
          <p class="small">{t({ en: 'Each invitation is signed by the clinic with a blind signature: the clinic signs it without seeing it. When a relative uses it, the clinic can tell it is genuine and unused, but not who it came from.', ar: 'تُوقَّع كل دعوة من العيادة بتوقيع أعمى، أي أن العيادة توقّعها دون أن تراها. وعندما يستخدمها القريب، تستطيع العيادة التأكد من أنها أصلية وغير مستخدمة، لكنها لا تعرف من أرسلها.' })}</p>
        </div>
        {tokens.length === 0 ? (
          <button class="btn primary full" disabled={!!s.invites.pending} onClick={() => act(st => askForInvites(st, 3))}>
            {s.invites.pending ? t({ en: 'Preparing invitations…', ar: 'جارٍ تجهيز الدعوات…' }) : t({ en: 'Prepare 3 invitations', ar: 'تجهيز 3 دعوات' })}
          </button>
        ) : (
          <div class="stack" style={{ '--gap': '10px' } as any}>
            <div class="row">
              <p class="grow small">{t({ en: `Add the gene name (${gene})? It helps the lab, but makes it easier to guess who sent it.`, ar: `إضافة اسم الجين (${gene})؟ يساعد ذلك المختبر، لكنه يسهّل تخمين المرسِل.` })}</p>
              <Toggle on={withGene} onChange={setWithGene} label="gene" />
            </div>
            {tokens.map((tok, k) => (
              <div key={tok} class="row">
                <span class="chip indigo num">{n(k + 1)}</span>
                <span class="grow tiny muted num" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>…{tok.slice(-18)}</span>
                <button class="chip" onClick={() => shareIt(tok, k)}>{copied === k ? <IconCheck size={15} /> : <IconShare size={15} />} {copied === k ? t({ en: 'Copied', ar: 'نُسخت' }) : t({ en: 'Send', ar: 'إرسال' })}</button>
              </div>
            ))}
            <p class="tiny muted">{t({ en: 'Open a link on another device to see what your relative sees.', ar: 'افتح الرابط على جهاز آخر لترى ما يراه قريبك.' })} <a href={`#/r/${tokens[0]}`} target="_blank">{t({ en: 'Preview', ar: 'معاينة' })}</a></p>
          </div>
        )}
      </Enter>
    </main>
  );
}

// ---------- counsellor ----------

const PATH_LABEL: Record<PathState, { en: string; ar: string }> = {
  'result-issued': { en: 'Result issued', ar: 'صدرت النتيجة' },
  'notified': { en: 'You opened it', ar: 'تم فتح النتيجة' },
  'understood': { en: 'You explained it back', ar: 'تم التحقق من الفهم' },
  'counselling-booked': { en: 'Counselling booked', ar: 'حُجز موعد الاستشارة' },
  'counselled': { en: 'Counselling done', ar: 'تمت الاستشارة' },
  'confirmatory': { en: 'Confirmatory test', ar: 'الفحص التأكيدي' },
  'referred': { en: 'Referred', ar: 'تمت الإحالة' },
  'closed': { en: 'Closed', ar: 'أُغلق الملف' },
};
const ORDER: PathState[] = ['result-issued', 'notified', 'understood', 'counselling-booked', 'counselled', 'referred'];

export function Counsellor({ s, act, base }: { s: PersonState; act: Act; base: string }) {
  const t = useT();
  const [sent, setSent] = useState(false);
  const [called, setCalled] = useState(false);
  const has = (x: PathState) => s.pathway.some(p => p.state === x);
  const firstOpen = ORDER.findIndex(x => !has(x));
  const briefGrant = activeGrants(s.ledger, new Date()).find(g => g.subject.kind === 'brief');
  const briefSeq = briefGrant ? s.ledger.find(e => e.payload.at === briefGrant.at && e.payload.subject.kind === 'brief')?.payload.seq : undefined;
  return (
    <main class="page">
      <Enter k="counsellor">
        <div class="row"><Back to={base} /><span class="eyebrow">{t({ en: 'Your counsellor', ar: 'مستشارك الوراثي' })}</span></div>
        <h1>{s.booking?.slot
          ? t({ en: `You are booked for ${fmtSlot(s.booking.slot, 'en')}.`, ar: `موعدك ${fmtSlot(s.booking.slot, 'ar')}.` })
          : t({ en: 'A genetic counsellor who already knows your result.', ar: 'مستشار وراثي يعرف نتيجتك مسبقاً.' })}</h1>
        <p class="muted">{t({ en: 'Genetic Counselling Clinic, Corniche Hospital. The counsellor explains, answers, and supports whatever you decide.', ar: 'عيادة الاستشارة الوراثية، مستشفى الكورنيش. يشرح المستشار ويجيب ويدعم أي قرار تتخذانه.' })}</p>
        {!s.booking && (
          <button class="btn primary full" onClick={() => act(st => requestBooking(st))}>{t({ en: 'Book a counselling appointment', ar: 'حجز موعد استشارة' })}</button>
        )}
        {s.booking?.status === 'requested' && <p class="chip indigo">{t({ en: 'Request sent. The clinic will confirm a time.', ar: 'أُرسل الطلب، وستؤكد العيادة الموعد.' })}</p>}

        <div class="thread">
          {ORDER.map((x, i) => (
            <Step key={x} state={has(x) ? 'done' : i === firstOpen ? 'now' : 'next'} title={t(PATH_LABEL[x])}
              sub={has(x) ? new Date(s.pathway.find(p => p.state === x)!.at).toLocaleDateString(s.lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long' }) : undefined} />
          ))}
        </div>

        <h2>{t({ en: 'Let the counsellor start where you are', ar: 'دعي المستشار يبدأ من حيث وصلتِ', arM: 'دع المستشار يبدأ من حيث وصلت' })}</h2>
        <div class="pool stack" style={{ '--gap': '8px' } as any}>
          <p class="small muted">{t({ en: 'If you share, the counsellor sees exactly this and nothing else:', ar: 'إذا شاركتِ، يرى المستشار هذا فقط ولا شيء غيره:', arM: 'إذا شاركت، يرى المستشار هذا فقط ولا شيء غيره:' })}</p>
          <p class="small">• {s.teachback ? t({ en: `Your check: ${s.teachback.correct} of ${s.teachback.total} points explained back`, ar: `تحقّقك: ${s.teachback.correct} من ${s.teachback.total} نقاط` }) : t({ en: 'Your check: not done yet', ar: 'التحقق: لم يُنجز بعد' })}</p>
          <p class="small">• {t({ en: `Questions you asked in Silah: ${s.questions.length}`, ar: `الأسئلة التي طرحتِها في صلة: ${s.questions.length}`, arM: `الأسئلة التي طرحتها في صلة: ${s.questions.length}` })}</p>
          <p class="small">• {t({ en: 'What you chose to share, with whom', ar: 'ما اخترتِ مشاركته ومع من', arM: 'ما اخترت مشاركته ومع من' })}</p>
          {briefGrant ? (
            <Receipt><b>{t({ en: 'Shared with your counsellor', ar: 'تمت المشاركة مع مستشارك' })}</b> · <button class="link" onClick={() => briefSeq !== undefined && act(st => revoke(st, briefSeq))}>{t({ en: 'stop sharing', ar: 'إيقاف المشاركة' })}</button></Receipt>
          ) : (
            <button class="btn calm full" onClick={async () => { await act(st => shareBrief(st)); setSent(true); }}>{t({ en: 'Share this with my counsellor', ar: 'مشاركة هذا مع مستشاري' })}</button>
          )}
          {sent && !briefGrant && <p class="tiny">…</p>}
        </div>

        <div class="pool soft stack" style={{ '--gap': '8px' } as any}>
          <h3>{t({ en: 'Need someone now?', ar: 'تحتاجين إلى أحد الآن؟', arM: 'تحتاج إلى أحد الآن؟' })}</h3>
          <p class="small muted">{t({ en: 'The counsellor will call you back today. In an emergency, call 999 or 998.', ar: 'سيتصل بك المستشار اليوم. وفي حالة الطوارئ اتصل بالرقم 999 أو 998.' })}</p>
          {called
            ? <p class="chip palm"><IconCheck size={15} /> {t({ en: 'Your counsellor has been asked to call you today.', ar: 'طُلب من مستشارك الاتصال بك اليوم.' })}</p>
            : <button class="btn calm" onClick={() => act(st => escalate(st, 'none')).then(() => setCalled(true))}>{t({ en: 'Ask for a call back', ar: 'طلب معاودة الاتصال' })}</button>}
        </div>
      </Enter>
    </main>
  );
}
