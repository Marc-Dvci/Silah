import { useEffect, useState } from 'preact/hooks';
import type { PhysicianSummary } from '../core/summary-types';
import type { Lang } from '../core/types';
import { sourceById } from '../core/data/sources';
import { exportSummaryFhir } from '../core/fhir';
import { bundleVerified } from '../app/person';
import { buildSummary } from '../app/summary';
import { usePerson } from './hooks';
import { Mark } from './kit';
import { downloadText, fmtWhen } from './person/book';

// The physician summary as a document: A4 when printed, readable on a screen. Labels in English or Arabic;
// gene, variant and condition names stay as the laboratory prints them.

const L = {
  title: { en: 'Pre-counselling summary', ar: 'ملخص ما قبل الاستشارة' },
  generated: { en: 'Generated on the patient’s phone, at the patient’s request, by Silah. Not a laboratory report.', ar: 'أُنشئ على هاتف المريض وبطلب منه بواسطة تطبيق صلة، وليس تقرير مختبر.' },
  patient: { en: 'Patient', ar: 'المريض' },
  partner: { en: 'Partner', ar: 'الشريك' },
  relationship: { en: 'Relationship', ar: 'القرابة' },
  source: { en: 'Result and source', ar: 'النتيجة ومصدرها' },
  verified: { en: 'Lab-signed result, signature verified on the phone', ar: 'نتيجة موقّعة من المختبر، وتم التحقق من التوقيع على الهاتف' },
  entered: { en: 'Entered by the patient from their own report: check against the original before relying on it', ar: 'أدخلها المريض من تقريره: يجب مطابقتها مع التقرير الأصلي قبل الاعتماد عليها' },
  couple: { en: 'Couple result', ar: 'نتيجة الزوجين' },
  atRisk: { en: 'At risk (not compatible)', ar: 'غير متوافق' },
  compatible: { en: 'Compatible', ar: 'متوافق' },
  shared: { en: 'Shared genes, per pregnancy', ar: 'الجينات المشتركة، في كل حمل' },
  findings: { en: 'Patient’s own findings', ar: 'نتائج المريض' },
  residual: { en: 'Remaining chance', ar: 'الاحتمال المتبقي' },
  anyCondition: { en: 'Chance of any panel condition', ar: 'احتمال أي حالة من حالات اللوحة' },
  vus: { en: 'Variants of uncertain significance', ar: 'تغيّرات غير محددة الأهمية' },
  flags: { en: 'For attention', ar: 'للانتباه' },
  understanding: { en: 'Understanding check (teach-back)', ar: 'التحقق من الفهم' },
  questions: { en: 'Questions the patient asked in Silah', ar: 'الأسئلة التي طرحها المريض في صلة' },
  requests: { en: 'Requests for a person', ar: 'طلبات التحدث إلى شخص' },
  birth: { en: 'Birth plan', ar: 'خطة الولادة' },
  sharing: { en: 'Sharing consents in force', ar: 'موافقات المشاركة السارية' },
  booking: { en: 'Appointment', ar: 'الموعد' },
  ai: { en: 'Plain-language summary (language model, every sentence checked against the numbers above)', ar: 'ملخص بلغة واضحة (نموذج لغوي، وكل جملة تم التحقق منها مقابل الأرقام أعلاه)' },
  sources: { en: 'Sources', ar: 'المصادر' },
  none: { en: 'None', ar: 'لا يوجد' },
};

const REL: Record<string, { en: string; ar: string }> = {
  'unrelated': { en: 'Not related', ar: 'لا توجد قرابة' },
  'second-cousins': { en: 'Second cousins', ar: 'أبناء عمومة من الدرجة الثانية' },
  'first-cousins-once-removed': { en: 'First cousins once removed', ar: 'ابن عم أحد الوالدين' },
  'first-cousins': { en: 'First cousins', ar: 'أبناء عمومة من الدرجة الأولى' },
  'double-first-cousins': { en: 'Double first cousins', ar: 'أبناء عمومة من الجهتين' },
};

const CLS: Record<string, string> = { P: 'Pathogenic', LP: 'Likely pathogenic', VUS: 'Uncertain significance' };

export function SummaryDoc({ x, lang = 'en' }: { x: PhysicianSummary; lang?: Lang }) {
  const t = (l: { en: string; ar: string }) => l[lang];
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <article class="doc" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang}>
      <header class="doc-head">
        <div class="row" style={{ gap: '10px' }}><Mark size={28} /><b>Silah</b><span class="grow" /><span class="tiny muted">{date(x.generatedAt)}</span></div>
        <h1>{t(L.title)}</h1>
        <p class="tiny muted">{t(L.generated)}</p>
      </header>

      <dl class="doc-grid">
        <dt>{t(L.patient)}</dt><dd>{x.patient.name} · {x.patient.sex === 'F' ? (lang === 'ar' ? 'أنثى' : 'Female') : (lang === 'ar' ? 'ذكر' : 'Male')}</dd>
        {x.partner && <><dt>{t(L.partner)}</dt><dd>{x.partner.name}</dd></>}
        <dt>{t(L.relationship)}</dt><dd>{t(REL[x.relationship] ?? { en: x.relationship, ar: x.relationship })}</dd>
        <dt>{t(L.source)}</dt>
        <dd>{x.source.issuer} · {x.source.method} · {x.source.testedAt} · <span class="tiny">{x.source.panelVersion}</span><br />
          <b style={{ color: x.source.verified ? 'var(--palm)' : 'var(--madder)' }}>{x.source.verified ? t(L.verified) : t(L.entered)}</b></dd>
        <dt>{t(L.couple)}</dt><dd><b>{x.status === 'at-risk' ? t(L.atRisk) : t(L.compatible)}</b></dd>
      </dl>

      {x.flags.length > 0 && (
        <section><h2>{t(L.flags)}</h2><ul>{x.flags.map(f => <li key={f}>{f}</li>)}</ul></section>
      )}

      {x.shared.length > 0 && (
        <section>
          <h2>{t(L.shared)}</h2>
          <table class="doc-table">
            <thead><tr><th>Gene</th><th>Condition</th><th>Alleles</th><th>Affected</th><th>Carrier</th><th>Neither</th><th>Birth plan</th></tr></thead>
            <tbody>{x.shared.map(s => (
              <tr key={s.gene}><td class="num">{s.gene}</td><td>{s.condition}</td><td class="num">{[s.ownTag, s.partnerTag].filter(Boolean).join(' / ') || '–'}</td>
                <td class="num">{s.perPregnancy.affected}</td><td class="num">{s.perPregnancy.carrier}</td><td class="num">{s.perPregnancy.neither}</td><td>{s.birthPlanEligible ? 'Eligible' : '–'}</td></tr>
            ))}</tbody>
          </table>
        </section>
      )}

      <section>
        <h2>{t(L.findings)}</h2>
        {x.findings.length === 0 ? <p>{t(L.none)}</p> : (
          <table class="doc-table">
            <thead><tr><th>Gene</th><th>Variant</th><th>Classification</th><th>Allele class</th></tr></thead>
            <tbody>{x.findings.map(f => <tr key={f.gene + f.variant}><td class="num">{f.gene}</td><td class="num" dir="ltr">{f.variant}</td><td>{CLS[f.classification]}</td><td class="num">{f.tag ?? '–'}</td></tr>)}</tbody>
          </table>
        )}
      </section>

      <section>
        <h2>{x.status === 'at-risk' ? t(L.anyCondition) : t(L.residual)}</h2>
        <p><b class="num">{x.residual.panelRiskRange ? `${x.residual.panelRiskRange[0]} to ${x.residual.panelRiskRange[1]}` : x.residual.panelRisk}</b> per pregnancy. {x.residual.note}</p>
        <p class="tiny muted">{x.residual.detection
          ? `Detection ${x.source.verified ? 'stated by the laboratory' : 'as printed on the report the patient entered'}: ${x.residual.detection.panel} per gene${x.residual.detection.exact ? `; partner checked for the patient's exact change: ${x.residual.detection.exact}` : ''}.`
          : 'Detection not stated on the result: range computed at 99% and 80% detection.'} Carrier frequencies: seven published Emirati figures, 1 in 1,000 assumed for other genes. Family history not included.</p>
      </section>

      {x.vusGenes.length > 0 && <section><h2>{t(L.vus)}</h2><p class="num">{x.vusGenes.join(', ')}</p></section>}

      {x.aiSummary && (
        <section class="doc-ai">
          <h2>{t(L.ai)}</h2>
          {x.aiSummary.sentences.map((s, i) => <p key={i}>{s.text}</p>)}
          <p class="tiny muted">{x.aiSummary.model}</p>
        </section>
      )}

      <section>
        <h2>{t(L.understanding)}</h2>
        <p>{x.understanding ? `${x.understanding.correct} of ${x.understanding.total} correct${x.understanding.missed.length ? `; missed: ${x.understanding.missed.join(', ')}` : ''} (${date(x.understanding.at)})` : 'Not done'}</p>
      </section>

      <section>
        <h2>{t(L.questions)}</h2>
        {x.questions.length === 0 ? <p>{t(L.none)}</p> : <ul>{x.questions.map((q, i) => <li key={i}>{q.q}{q.route !== 'none' ? <span class="tiny muted"> · routed to a person ({q.route})</span> : null}</li>)}</ul>}
      </section>

      {x.escalations.length > 0 && <section><h2>{t(L.requests)}</h2><ul>{x.escalations.map((e, i) => <li key={i}>{date(e.at)} · {e.route === 'none' ? 'call back' : e.route} · {e.seen ? 'seen by a counsellor' : 'not yet seen'}</li>)}</ul></section>}
      {x.birthPlan && <section><h2>{t(L.birth)}</h2><p>{x.birthPlan.active ? `Active: targeted newborn test for ${x.birthPlan.genes.join(', ')} at ${x.birthPlan.hospital}` : 'Withdrawn'}</p></section>}
      <section><h2>{t(L.sharing)}</h2>{x.sharing.length ? <ul>{x.sharing.map((g, i) => <li key={i}>{g.kind}{g.gene ? ` (${g.gene})` : ''} → {g.recipient}</li>)}</ul> : <p>{t(L.none)}</p>}</section>
      {x.booking && <section><h2>{t(L.booking)}</h2><p>{fmtWhen(x.booking.slot, lang)} · {x.booking.site} · {x.booking.format} · {x.booking.language}</p></section>}

      <section class="doc-sources">
        <h2>{t(L.sources)}</h2>
        <ol>{x.sources.map(id => { const s = sourceById(id); return <li key={id} class="tiny">{s ? s.cite : id}</li>; })}</ol>
      </section>
    </article>
  );
}

/** Full-page view at #/s/<personId>: what the person prints, saves as PDF or downloads for the health record. */
export function SummaryPage({ id }: { id: string }) {
  const { s } = usePerson(id);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  useEffect(() => { if (s) bundleVerified(s).then(setVerified); }, [!!s]);
  if (!s || verified === null) return <div class="doc-page"><Mark size={48} /></div>;
  const x = buildSummary(s, verified);
  if (!x) return <div class="doc-page"><p>No result on this phone yet.</p></div>;
  return (
    <div class="doc-page">
      <div class="doc-tools row wrap no-print">
        <button class="btn primary" onClick={() => print()}>Print or save as PDF</button>
        <button class="btn calm" onClick={() => downloadText(`silah-summary-${x.generatedAt.slice(0, 10)}.fhir.json`, JSON.stringify(exportSummaryFhir(x), null, 2), 'application/fhir+json')}>Download for the health record (FHIR)</button>
        <span class="grow" />
        <button class={`chip ${lang === 'en' ? 'indigo' : ''}`} onClick={() => setLang('en')}>English</button>
        <button class={`chip ${lang === 'ar' ? 'indigo' : ''}`} lang="ar" onClick={() => setLang('ar')}>العربية</button>
      </div>
      <SummaryDoc x={x} lang={lang} />
    </div>
  );
}
