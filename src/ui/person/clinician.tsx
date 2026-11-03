import { useEffect, useState } from 'preact/hooks';
import type { PersonState } from '../../app/person';
import { activeSummarySeq, bundleVerified, revoke, sendSummary } from '../../app/person';
import { buildSummary } from '../../app/summary';
import { exportSummaryFhir } from '../../core/fhir';
import { Enter, Receipt, useT } from '../kit';
import { Back } from './shell';
import { ExplainPanel } from './explain';
import { downloadText } from './book';

type Act = (f: (st: PersonState) => Promise<void>) => Promise<void>;

/** "Summary for my clinician": generate it, read it, print it, file it, send it, or stop sharing it. */
export function Clinician({ s, act, base }: { s: PersonState; act: Act; base: string }) {
  const t = useT();
  const [verified, setVerified] = useState(false);
  useEffect(() => { bundleVerified(s).then(setVerified); }, []);
  const x = buildSummary(s, verified);
  const seq = activeSummarySeq(s);
  if (!x) return null;
  const items = [
    { en: 'Your result and where it came from', ar: 'نتيجتك ومصدرها' },
    { en: 'The couple result and the chances per pregnancy', ar: 'نتيجة الزوجين والاحتمالات في كل حمل' },
    { en: 'What is uncertain: detection, assumptions, variants of unknown meaning', ar: 'ما هو غير مؤكد: نسبة الكشف والافتراضات والتغيّرات غير محددة الأهمية' },
    { en: `Your understanding check${s.teachback ? ` (${s.teachback.correct} of ${s.teachback.total})` : ' (not done yet)'}`, ar: `التحقق من الفهم${s.teachback ? ` (${s.teachback.correct} من ${s.teachback.total})` : ' (لم يُنجز بعد)'}` },
    { en: `The questions you asked in Silah (${s.questions.length})`, ar: `الأسئلة التي طرحتها في صلة (${s.questions.length})` },
    { en: 'Your birth plan, sharing choices and appointment, if any', ar: 'خطة الولادة وخيارات المشاركة والموعد إن وُجدت' },
  ];
  return (
    <main class="page">
      <Enter k="clinician">
        <div class="row"><Back to={`${base}/counsellor`} /><span class="eyebrow">{t({ en: 'Summary for my clinician', ar: 'ملخص لطبيبي' })}</span></div>
        <h1>{t({ en: 'One page for your counsellor or doctor.', ar: 'صفحة واحدة لمستشارك أو طبيبك.' })}</h1>
        <p class="muted">{t({ en: 'Made on this phone from your result. Print it, keep it as a PDF, file it in your health record, or send it to the counselling clinic. You decide.', ar: 'تُنشأ على هذا الهاتف من نتيجتك. يمكنك طباعتها أو حفظها بصيغة PDF أو إضافتها إلى سجلك الصحي أو إرسالها إلى عيادة الاستشارة، والقرار لك.' })}</p>
        <div class="pool soft stack" style={{ '--gap': '6px' } as any}>
          <p class="small"><b>{t({ en: 'It contains', ar: 'تتضمن' })}</b></p>
          {items.map((i, k) => <p key={k} class="small">• {t(i)}</p>)}
        </div>

        <ExplainPanel s={s} act={act} audience="clinician" />

        <div class="stack" style={{ '--gap': '10px' } as any}>
          <button class="btn calm full" onClick={() => window.open(`${location.pathname}#/s/${s.id}`, '_blank')}>{t({ en: 'Open the printable page', ar: 'فتح الصفحة القابلة للطباعة' })}</button>
          <button class="btn calm full" onClick={() => downloadText(`silah-summary-${x.generatedAt.slice(0, 10)}.fhir.json`, JSON.stringify(exportSummaryFhir(x), null, 2), 'application/fhir+json')}>{t({ en: 'Download for the health record (FHIR)', ar: 'تنزيل للسجل الصحي (FHIR)' })}</button>
          {seq === undefined
            ? <button class="btn primary full" onClick={() => act(st => sendSummary(st, x))}>{t({ en: 'Send it to the counselling clinic', ar: 'إرسالها إلى عيادة الاستشارة' })}</button>
            : <Receipt><b>{t({ en: 'Sent to the counselling clinic', ar: 'أُرسلت إلى عيادة الاستشارة' })}</b> · <button class="link" onClick={() => act(st => revoke(st, seq))}>{t({ en: 'stop sharing', ar: 'إيقاف المشاركة' })}</button></Receipt>}
        </div>
        <p class="tiny muted">{t({ en: 'FHIR is the format health records exchange in; in Abu Dhabi, Malaffi connects them. The file is a FHIR R4 document using the HL7 genomics reporting codes.', ar: 'FHIR هي الصيغة التي تتبادل بها السجلات الصحية البيانات، وفي أبوظبي تربطها منصة «ملفي». والملف وثيقة FHIR R4 تستخدم رموز HL7 للتقارير الجينية.' })}</p>
      </Enter>
    </main>
  );
}
