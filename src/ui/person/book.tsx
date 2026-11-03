import { useEffect, useMemo, useState } from 'preact/hooks';
import type { PersonState } from '../../app/person';
import { bookSlot, bundleVerified, cancelBooking, coupleOf, currentView, isUrgent, shareBookingWithPartner } from '../../app/person';
import { buildSummary } from '../../app/summary';
import { COUNSELLORS, FORMAT_LABEL, HAEMOGLOBIN_NOTE, counsellorById, counsellorLabel, siteById, sitesFor, slotsFor, toIcs, type Format, type Slot, type SiteId } from '../../core/booking';
import type { Lang } from '../../core/types';
import { Enter, Receipt, Toggle, go, useT } from '../kit';
import { Back } from './shell';

type Act = (f: (st: PersonState) => Promise<void>) => Promise<void>;

const fmtDay = (iso: string, lang: Lang) => new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' });
const fmtTime = (iso: string, lang: Lang) => new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Dubai' });
export const fmtWhen = (iso: string, lang: Lang) => `${fmtDay(iso, lang)}, ${fmtTime(iso, lang)}`;

export function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function Book({ s, act, base }: { s: PersonState; act: Act; base: string }) {
  const t = useT();
  const view = currentView(s);
  const b = s.booking;
  const [changing, setChanging] = useState(false);
  const live = b && (b.status === 'requested' || b.status === 'confirmed') && !changing;
  if (!view) return null;
  return (
    <main class="page">
      <Enter k={live ? 'booked' : 'book'}>
        <div class="row"><Back to={`${base}/counsellor`} /><span class="eyebrow">{t({ en: 'Book counselling', ar: 'حجز موعد استشارة' })}</span></div>
        {live ? <Booked s={s} act={act} onChange={() => setChanging(true)} /> : <Picker s={s} act={act} done={() => setChanging(false)} />}
      </Enter>
    </main>
  );
}

function Picker({ s, act, done }: { s: PersonState; act: Act; done: () => void }) {
  const t = useT();
  const view = currentView(s)!;
  const urgent = isUrgent(s);
  const choices = useMemo(() => sitesFor({
    status: view.status,
    sharedGenes: view.shared.map(x => x.gene),
    // An incompatible couple starts at the counselling clinics Appendix 13 names for them; they refer on as needed.
    specialistFirst: !!s.profile?.specialistGenes?.length || (view.counsellorFirst && view.status !== 'at-risk'),
    pregnant: !!(coupleOf(s.id)?.pregnancyDue || s.profile?.pregnant),
  }), [view.status, view.counsellorFirst, s.profile?.pregnant]);
  const [site, setSite] = useState<SiteId>(choices[0].site.id);
  const [format, setFormat] = useState<Format>('in-person');
  const [lang, setLang] = useState<Lang>(s.lang);
  const [sex, setSex] = useState<'F' | 'M' | undefined>(undefined);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [withSummary, setWithSummary] = useState(false);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  useEffect(() => { bundleVerified(s).then(setVerified); }, []);

  const slots = slotsFor({ siteId: site, format, lang, sex, urgent });
  const byDay = new Map<string, Slot[]>();
  for (const x of slots) { const d = fmtDay(x.start, s.lang); byDay.set(d, [...(byDay.get(d) ?? []), x]); }
  const days = [...byDay.entries()].slice(0, showAll ? 10 : 4);
  const staffHere = COUNSELLORS.filter(c => c.siteId === site);
  const formats = (['in-person', 'video', 'phone'] as Format[]).filter(f => staffHere.some(c => c.formats.includes(f)));
  const hb = view.shared.some(x => x.gene === 'HBB');
  const declined = s.booking?.status === 'declined';

  const confirm = async () => {
    if (!slot) return;
    setBusy(true);
    const summary = withSummary ? buildSummary(s, verified) : undefined;
    await act(st => bookSlot(st, slot, { format, lang, summary }));
    setBusy(false);
    done();
  };

  return (
    <>
      <h1>{t({ en: 'Choose a time that suits you.', ar: 'اختاري الوقت الذي يناسبك.', arM: 'اختر الوقت الذي يناسبك.' })}</h1>
      {declined && <div class="pool saffron"><p class="small">{t({ en: 'That time was booked by someone else a moment ago. Please choose another.', ar: 'حُجز ذلك الموعد من شخص آخر قبل لحظات. يُرجى اختيار موعد آخر.' })}</p></div>}

      <section class="stack" style={{ '--gap': '8px' } as any}>
        <h3>{t({ en: 'Where', ar: 'المكان' })}</h3>
        {choices.filter((c, i) => c.recommended || i < 3 || c.site.id === site).map(c => (
          <button key={c.site.id} class={`choice ${site === c.site.id ? 'picked' : ''}`} aria-pressed={site === c.site.id} onClick={() => { setSite(c.site.id); setSlot(null); }}>
            <b>{t(c.site.name)}</b>
            {c.recommended && <div class="small muted">{t(c.reason)}</div>}
          </button>
        ))}
        <details><summary class="small">{t({ en: 'Other places', ar: 'أماكن أخرى' })}</summary>
          <div class="stack" style={{ '--gap': '8px', marginTop: '8px' } as any}>
            {choices.filter((c, i) => !(c.recommended || i < 3 || c.site.id === site)).map(c => (
              <button key={c.site.id} class="choice" onClick={() => { setSite(c.site.id); setSlot(null); }}><b>{t(c.site.name)}</b></button>
            ))}
          </div>
        </details>
        {hb && <p class="tiny muted">{t(HAEMOGLOBIN_NOTE)}</p>}
        <p class="tiny muted">{t({ en: 'Places from the DoH Premarital Screening Standard, Appendix 13. Timetables in this demo are simulated.', ar: 'الأماكن من معيار فحص ما قبل الزواج لدائرة الصحة، الملحق 13. والمواعيد في هذا العرض محاكاة.' })}</p>
      </section>

      <section class="stack" style={{ '--gap': '8px' } as any}>
        <h3>{t({ en: 'How', ar: 'الطريقة' })}</h3>
        <div class="row wrap" role="radiogroup" aria-label={t({ en: 'Format', ar: 'طريقة الموعد' })}>
          {formats.map(f => <button key={f} role="radio" aria-checked={format === f} class={`chip ${format === f ? 'indigo' : ''}`} onClick={() => { setFormat(f); setSlot(null); }}>{t(FORMAT_LABEL[f])}</button>)}
        </div>
        <div class="row wrap" role="radiogroup" aria-label={t({ en: 'Language', ar: 'اللغة' })}>
          {(['ar', 'en'] as Lang[]).map(l => <button key={l} role="radio" aria-checked={lang === l} class={`chip ${lang === l ? 'indigo' : ''}`} lang={l} onClick={() => { setLang(l); setSlot(null); }}>{l === 'ar' ? 'العربية' : 'English'}</button>)}
        </div>
        <div class="row wrap" role="radiogroup" aria-label={t({ en: 'Counsellor', ar: 'المستشار' })}>
          {([[undefined, { en: 'Any counsellor', ar: 'أي مستشار' }], ['F', { en: 'A woman', ar: 'مستشارة' }], ['M', { en: 'A man', ar: 'مستشار' }]] as const).map(([v, l]) => (
            <button key={String(v)} role="radio" aria-checked={sex === v} class={`chip ${sex === v ? 'indigo' : ''}`} onClick={() => { setSex(v); setSlot(null); }}>{t(l)}</button>
          ))}
        </div>
      </section>

      <section class="stack" style={{ '--gap': '10px' } as any}>
        <h3>{t({ en: 'When', ar: 'الموعد' })}</h3>
        {urgent && <p class="tiny" style={{ color: 'var(--palm)' }}>{t({ en: 'Slots held for urgent cases are shown to you, because of a pregnancy, a near wedding or a request for help.', ar: 'تظهر لك المواعيد المحجوزة للحالات العاجلة، بسبب حمل أو زفاف قريب أو طلب مساعدة.' })}</p>}
        {days.length === 0 && <p class="small muted">{t({ en: 'No free time in the next two weeks with these choices. Try another place, format or language.', ar: 'لا توجد مواعيد متاحة خلال الأسبوعين القادمين بهذه الخيارات. جرّبي مكاناً أو طريقة أو لغة أخرى.', arM: 'لا توجد مواعيد متاحة خلال الأسبوعين القادمين بهذه الخيارات. جرّب مكاناً أو طريقة أو لغة أخرى.' })}</p>}
        {days.map(([day, list]) => (
          <div key={day} class="stack" style={{ '--gap': '6px' } as any}>
            <p class="small"><b>{day}</b></p>
            <div class="row wrap">
              {list.map(x => (
                <button key={x.id} class={`chip num ${slot?.id === x.id ? 'indigo' : x.held ? 'palm' : ''}`} aria-pressed={slot?.id === x.id} onClick={() => setSlot(x)}>
                  {fmtTime(x.start, s.lang)}{COUNSELLORS.filter(c => c.siteId === site).length > 1 ? ` · ${counsellorById(x.counsellorId)!.sex === 'F' ? t({ en: 'woman', ar: 'مستشارة' }) : t({ en: 'man', ar: 'مستشار' })}` : ''}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!showAll && byDay.size > 4 && <button class="link" onClick={() => setShowAll(true)}>{t({ en: 'Show later days', ar: 'عرض أيام لاحقة' })}</button>}
      </section>

      {slot && (
        <div class="pool stack" style={{ '--gap': '10px' } as any}>
          <p><b>{fmtWhen(slot.start, s.lang)}</b></p>
          <p class="small">{t(siteById(slot.siteId)!.name)} · {t(FORMAT_LABEL[format])}</p>
          <p class="small muted">{t(counsellorLabel(counsellorById(slot.counsellorId)!))}</p>
          <div class="row" style={{ alignItems: 'flex-start' }}>
            <span class="grow small">{t({ en: 'Send my pre-counselling summary with this booking, so the counsellor can prepare.', ar: 'إرسال ملخصي قبل الاستشارة مع هذا الحجز ليستعد المستشار.' })}</span>
            <Toggle on={withSummary} onChange={setWithSummary} label={t({ en: 'Send summary', ar: 'إرسال الملخص' })} />
          </div>
          <p class="tiny muted">{t({ en: 'The summary holds your findings, the couple result and chances, your understanding check and your questions. You can read it first under “Summary for my clinician”, and stop sharing it at any time.', ar: 'يتضمن الملخص نتائجك ونتيجة الزوجين والاحتمالات ونتيجة التحقق من الفهم وأسئلتك. يمكنك قراءته أولاً في «ملخص لطبيبي»، وإيقاف مشاركته في أي وقت.' })}</p>
          <button class="btn primary full" disabled={busy} onClick={confirm}>{t({ en: 'Book this time', ar: 'حجز هذا الموعد' })}</button>
        </div>
      )}
    </>
  );
}

function Booked({ s, act, onChange }: { s: PersonState; act: Act; onChange: () => void }) {
  const t = useT();
  const b = s.booking!;
  const site = b.siteId ? siteById(b.siteId) : undefined;
  const c = b.counsellorId ? counsellorById(b.counsellorId) : undefined;
  const paired = !!s.pairing && !s.pairing.ended;
  const [sharedNow, setSharedNow] = useState(false);
  const ics = () => b.slot && downloadText('silah-counselling.ics', toIcs({
    uid: `${b.slotId ?? b.slot}@silah`,
    start: b.slot,
    minutes: 45,
    summary: s.lang === 'ar' ? 'موعد استشارة وراثية' : 'Genetic counselling appointment',
    location: site ? t(site.name) : '',
    description: s.lang === 'ar' ? 'أحضر تقرير الفحص الجيني. حُجز عبر تطبيق صلة.' : 'Bring your genetic test report. Booked with Silah.',
  }), 'text/calendar');
  return (
    <>
      <h1>{b.status === 'confirmed' && b.slot
        ? t({ en: `Booked: ${fmtWhen(b.slot, 'en')}.`, ar: `تم الحجز: ${fmtWhen(b.slot, 'ar')}.` })
        : t({ en: 'Sending your booking…', ar: 'جارٍ إرسال الحجز…' })}</h1>
      {b.status === 'confirmed' && (
        <div class="pool palm stack" style={{ '--gap': '6px' } as any}>
          {site && <p>{t(site.name)}</p>}
          <p class="small">{b.format ? t(FORMAT_LABEL[b.format]) : ''}{b.lang ? ` · ${b.lang === 'ar' ? 'العربية' : 'English'}` : ''}</p>
          {c && <p class="small muted">{t(counsellorLabel(c))}</p>}
          {b.format === 'video' && <p class="tiny">{t({ en: 'The clinic sends the video link before the appointment.', ar: 'ترسل العيادة رابط الفيديو قبل الموعد.' })}</p>}
          {b.withSummary && <p class="tiny">{t({ en: 'Your summary went with the booking.', ar: 'أُرسل ملخصك مع الحجز.' })}</p>}
        </div>
      )}
      <div class="stack" style={{ '--gap': '10px' } as any}>
        {b.slot && b.status === 'confirmed' && <button class="btn calm full" onClick={ics}>{t({ en: 'Add to my calendar', ar: 'إضافة إلى التقويم' })}</button>}
        {paired && b.status === 'confirmed' && (
          <button class="btn calm full" disabled={sharedNow} onClick={async () => { await act(st => shareBookingWithPartner(st)); setSharedNow(true); }}>
            {sharedNow ? t({ en: 'Sent to your partner’s phone', ar: 'أُرسل إلى هاتف الشريك' }) : t({ en: 'Send the time to my partner’s phone', ar: 'إرسال الموعد إلى هاتف الشريك' })}
          </button>
        )}
        <div class="row wrap">
          <button class="chip" onClick={onChange}>{t({ en: 'Change the time', ar: 'تغيير الموعد' })}</button>
          <button class="chip" onClick={() => act(st => cancelBooking(st))}>{t({ en: 'Cancel the appointment', ar: 'إلغاء الموعد' })}</button>
          <button class="chip" onClick={() => go(`p/${s.id}/summary`)}>{t({ en: 'Summary for my clinician', ar: 'ملخص لطبيبي' })}</button>
        </div>
      </div>
      <Receipt>{t({ en: 'The clinic receives your name, the time, the format and the language. Your result goes only if you send the summary.', ar: 'تتلقى العيادة اسمك والموعد وطريقته ولغته، ولا تُرسل نتيجتك إلا مع الملخص إذا اخترتِ إرساله.', arM: 'تتلقى العيادة اسمك والموعد وطريقته ولغته، ولا تُرسل نتيجتك إلا مع الملخص إذا اخترت إرساله.' })}</Receipt>
    </>
  );
}
