import { useState } from 'preact/hooks';
import type { PersonState } from '../../app/person';
import { importResult, importSigned, type ImportInput } from '../../app/person';
import type { Extracted, ExtractedFinding } from '../../core/import/types';
import type { Classification, Relationship, ResultBundle, Signed } from '../../core/types';
import type { ResultOrigin } from '../../core/uncertainty';
import { extractFromText } from '../../core/import/extract';
import { importResultFile } from '../../core/fhir';
import { PANEL_GENES, PANEL_SET, PANEL_ALIASES } from '../../core/data/panel';
import { Enter, Receipt, Toggle, go, useT } from '../kit';
import { Back } from './shell';

type Act = (f: (st: PersonState) => Promise<void>) => Promise<void>;

// "Use my own result": the person brings a report (PDF, a FHIR or Silah file) or types it in. Everything is read
// on this phone; nothing is uploaded anywhere. Nothing is computed until the person confirms what was read.

export const SAMPLES = [
  { id: 'aisha', file: 'samples/aisha-khalfan-sample.pdf', label: { en: 'Aisha: cousins, both carry a change in HBB', ar: 'عائشة: زوجان قريبان يحملان كلاهما تغيّراً في الجين HBB' } },
  { id: 'rashid', file: 'samples/rashid-khalfan-sample.pdf', label: { en: 'Rashid: Aisha’s partner', ar: 'راشد: شريك عائشة' } },
  { id: 'noor', file: 'samples/noor-hamdan-sample.pdf', label: { en: 'Noor: a “compatible” result, no detection stated', ar: 'نور: نتيجة «متوافق» دون ذكر نسبة الكشف' } },
];

interface Draft {
  data: Extracted;
  origin: ResultOrigin;
  name: string;
  sex: 'F' | 'M' | '';
  status: 'at-risk' | 'compatible' | '';
  shared: string[];
  partnerName: string;
  relationship: Relationship | '';
  panelPct: string;
  exactPct: string;
  pregnant: boolean;
  weddingSoon: boolean;
  signed?: Signed<ResultBundle>;
}

const REL: { v: Relationship; en: string; ar: string }[] = [
  { v: 'unrelated', en: 'Not related', ar: 'لا توجد قرابة' },
  { v: 'second-cousins', en: 'Second cousins', ar: 'أبناء عمومة من الدرجة الثانية' },
  { v: 'first-cousins-once-removed', en: 'First cousins once removed', ar: 'ابن عم أحد الوالدين' },
  { v: 'first-cousins', en: 'First cousins', ar: 'أبناء عمومة من الدرجة الأولى' },
  { v: 'double-first-cousins', en: 'Double first cousins', ar: 'أبناء عمومة من الجهتين' },
];

function draftFrom(data: Extracted, origin: ResultOrigin): Draft {
  const carriers = data.findings.filter(f => f.classification !== 'VUS').map(f => f.gene);
  return {
    data, origin,
    name: (data.name ?? '').trim(),
    sex: data.sex ?? '',
    status: data.couple?.status ?? '',
    shared: (data.couple?.sharedGenes ?? []).filter(g => carriers.includes(g)),
    partnerName: (data.couple?.partnerName ?? '').trim(),
    relationship: data.couple?.relationship ?? '',
    panelPct: data.detection?.panelPct ? String(data.detection.panelPct) : '',
    exactPct: data.detection?.exactPct ? String(data.detection.exactPct) : '',
    pregnant: false,
    weddingSoon: false,
  };
}

const emptyExtracted = (source: Extracted['source']): Extracted => ({ source, findings: [], unknownGenes: [], warnings: [] });

/** The guided story's shortcut: read a sample PDF and accept what was read, as a person pressing "Yes" would. */
export async function importSamplePdf(st: PersonState, file: string): Promise<boolean> {
  const { pdfToText } = await import('../../app/pdf');
  const r = await fetch(file);
  const data = extractFromText(await pdfToText(await r.arrayBuffer()), 'pdf');
  const d = draftFrom(data, 'uploaded-pdf');
  if (!d.name || !d.sex || !d.status || !d.relationship) return false;
  await importResult(st, {
    data, origin: 'uploaded-pdf', profile: { name: d.name, sex: d.sex }, relationship: d.relationship,
    status: d.status, sharedGenes: d.shared, partnerName: d.partnerName,
  });
  return true;
}

export function Import({ s, act, base }: { s: PersonState; act: Act; base: string }) {
  const t = useT();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const readFile = async (file: File | Blob, name: string) => {
    setErr(''); setBusy(true);
    try {
      if (/\.pdf$/i.test(name) || file.type === 'application/pdf') {
        const { pdfToText } = await import('../../app/pdf');
        const text = await pdfToText(await file.arrayBuffer());
        setDraft(draftFrom(extractFromText(text, 'pdf'), 'uploaded-pdf'));
      } else {
        const text = await file.text();
        const r = importResultFile(text);
        if (r.kind === 'signed') {
          const p = r.bundle.payload.person;
          setDraft({ ...draftFrom({ ...emptyExtracted('silah-json'), name: p.displayName, sex: p.sex }, 'uploaded-file'), signed: r.bundle });
        } else {
          setDraft(draftFrom(r.data, r.data.source === 'fhir' ? 'uploaded-fhir' : 'uploaded-file'));
        }
      }
    } catch (e) {
      const m = String((e as Error)?.message ?? e);
      setErr(m === 'no-text'
        ? t({ en: 'This PDF has no readable text (it may be a scan). Type the result in instead; it takes a minute.', ar: 'لا يحتوي ملف PDF هذا على نص قابل للقراءة (قد يكون صورة ممسوحة). يمكنك إدخال النتيجة يدوياً، ولن يستغرق ذلك سوى دقيقة.' })
        : t({ en: 'Silah could not read this file. It reads PDF reports, FHIR genomics files and Silah result files. You can also type the result in.', ar: 'تعذّر على تطبيق صلة قراءة هذا الملف. يقرأ التطبيق تقارير PDF وملفات FHIR الجينية وملفات نتائج صلة، ويمكنك أيضاً إدخال النتيجة يدوياً.' }));
    }
    setBusy(false);
  };

  const sample = async (file: string) => {
    setBusy(true);
    try {
      const r = await fetch(file);
      await readFile(await r.blob(), file);
    } catch { setErr('sample'); }
    setBusy(false);
  };

  if (draft) return <Confirm s={s} act={act} base={base} draft={draft} setDraft={setDraft} />;

  return (
    <main class="page">
      <Enter k="import">
        <div class="row"><Back to={base} /><span class="eyebrow">{t({ en: 'Use your own result', ar: 'استخدام نتيجتك' })}</span></div>
        <h1>{t({ en: 'Bring your premarital genetic result.', ar: 'أحضِري نتيجة فحصك الجيني قبل الزواج.', arM: 'أحضِر نتيجة فحصك الجيني قبل الزواج.' })}</h1>
        <p class="muted">{t({ en: 'Silah reads the report on this phone. Nothing is uploaded: the file never leaves the device. You check what it read before anything is worked out.', ar: 'يقرأ تطبيق صلة التقرير على هذا الهاتف، ولا يُرفع أي شيء: لا يغادر الملف الجهاز. وتراجعين ما قرأه قبل أي حساب.', arM: 'يقرأ تطبيق صلة التقرير على هذا الهاتف، ولا يُرفع أي شيء: لا يغادر الملف الجهاز. وتراجع ما قرأه قبل أي حساب.' })}</p>

        <div class="stack" style={{ '--gap': '10px' } as any}>
          <label class="btn primary full" style={{ cursor: 'pointer' }}>
            {t({ en: 'Choose a PDF report or result file', ar: 'اختيار تقرير PDF أو ملف نتيجة' })}
            <input type="file" accept="application/pdf,.pdf,application/json,.json,application/fhir+json" style={{ display: 'none' }}
              onChange={e => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) readFile(f, f.name); }} />
          </label>
          <button class="btn calm full" onClick={() => setDraft(draftFrom(emptyExtracted('manual'), 'manual'))}>{t({ en: 'Type it in instead', ar: 'إدخال النتيجة يدوياً' })}</button>
        </div>
        {busy && <p class="small muted">{t({ en: 'Reading…', ar: 'جارٍ القراءة…' })}</p>}
        {err && <div class="pool saffron"><p class="small">{err}</p></div>}

        <div class="pool soft stack" style={{ '--gap': '8px' } as any}>
          <p class="small"><b>{t({ en: 'No report to hand? Try a sample', ar: 'لا يتوفر تقرير؟ جرّبي نموذجاً', arM: 'لا يتوفر تقرير؟ جرّب نموذجاً' })}</b></p>
          <p class="tiny muted">{t({ en: 'Fictional people, a fictional laboratory. Each opens exactly as a PDF you upload would.', ar: 'أشخاص ومختبر من نسج الخيال، ويُفتح كل نموذج تماماً كما يُفتح أي ملف PDF.' })}</p>
          {SAMPLES.map(x => (
            <div key={x.id} class="row">
              <button class="link grow" style={{ textAlign: 'start' }} onClick={() => sample(x.file)}>{t(x.label)}</button>
              <a class="chip" href={x.file} download>{t({ en: 'PDF', ar: 'PDF' })}</a>
            </div>
          ))}
        </div>

        <p class="tiny muted">{t({ en: 'Formats: PDF reports with selectable text (gene, change and classification on one line), HL7 FHIR genomics files, Silah result files. A result signed by a laboratory Silah trusts is marked as verified; anything else is marked as entered by you.', ar: 'الصيغ: تقارير PDF ذات نص قابل للتحديد (الجين والتغيّر والتصنيف في سطر واحد)، وملفات FHIR الجينية، وملفات نتائج صلة. تُعلَّم النتيجة الموقّعة من مختبر يثق به التطبيق بأنها موثّقة، وتُعلَّم غيرها بأنها مُدخلة منك.' })}</p>
      </Enter>
    </main>
  );
}

function Confirm({ s, act, base, draft, setDraft }: { s: PersonState; act: Act; base: string; draft: Draft; setDraft: (d: Draft | null) => void }) {
  const t = useT();
  const [problem, setProblem] = useState('');
  const set = (p: Partial<Draft>) => setDraft({ ...draft, ...p });
  const setFinding = (i: number, p: Partial<ExtractedFinding>) => {
    const findings = draft.data.findings.map((f, k) => (k === i ? { ...f, ...p, confidence: 'high' as const } : f));
    set({ data: { ...draft.data, findings } });
  };
  const carriers = [...new Set(draft.data.findings.filter(f => f.classification !== 'VUS' && PANEL_SET.has(f.gene)).map(f => f.gene))];
  const signed = draft.signed;

  const save = async () => {
    setProblem('');
    if (!draft.name.trim() || !draft.sex) return setProblem(t({ en: 'Add your name and whether you are a woman or a man (Arabic text is written for the reader).', ar: 'أضيفي اسمك وحدّدي إن كنتِ امرأة أو رجلاً (تُكتب العبارات العربية بحسب القارئ).', arM: 'أضف اسمك وحدّد إن كنت امرأة أو رجلاً (تُكتب العبارات العربية بحسب القارئ).' }));
    const profile = { name: draft.name.trim(), sex: draft.sex as 'F' | 'M', pregnant: draft.pregnant, weddingSoon: draft.weddingSoon };
    if (signed) {
      await act(async st => { await importSigned(st, signed, profile); });
      go(`${base}/result`);
      return;
    }
    const bad = draft.data.findings.find(f => !PANEL_SET.has(f.gene) || !/^(?:[A-Z]{2}_\d+(?:\.\d+)?:)?c\.\S+$/.test(f.variant.trim()));
    if (bad) return setProblem(t({ en: `Check the row for ${bad.gene || 'a gene'}: the gene must be on the DoH panel and the change written as on the report (c.…).`, ar: `راجعي السطر الخاص بـ${bad.gene || 'أحد الجينات'}: يجب أن يكون الجين ضمن لوحة دائرة الصحة، وأن يُكتب التغيّر كما ورد في التقرير (c.…).`, arM: `راجع السطر الخاص بـ${bad.gene || 'أحد الجينات'}: يجب أن يكون الجين ضمن لوحة دائرة الصحة، وأن يُكتب التغيّر كما ورد في التقرير (c.…).` }));
    if (!draft.status) return setProblem(t({ en: 'Choose the couple result printed on your report or certificate.', ar: 'اختاري نتيجة الزوجين كما وردت في التقرير أو الشهادة.', arM: 'اختر نتيجة الزوجين كما وردت في التقرير أو الشهادة.' }));
    if (draft.status === 'at-risk' && !draft.shared.length) return setProblem(t({ en: 'For an at-risk result, tick the gene you both carry (it is named on the couple report).', ar: 'في نتيجة «غير متوافق»، حدّدي الجين الذي تحملانه كلاكما (يُذكر في تقرير الزوجين).', arM: 'في نتيجة «غير متوافق»، حدّد الجين الذي تحملانه كلاكما (يُذكر في تقرير الزوجين).' }));
    if (!draft.relationship) return setProblem(t({ en: 'Choose how you and your partner are related. It changes the remaining chance.', ar: 'اختاري صلة القرابة بينك وبين شريكك، فهي تغيّر الاحتمال المتبقي.', arM: 'اختر صلة القرابة بينك وبين شريكتك، فهي تغيّر الاحتمال المتبقي.' }));
    const pct = (x: string) => { const n = Number(x.replace(',', '.')); return x && n > 50 && n <= 100 ? n : undefined; };
    const input: ImportInput = {
      data: { ...draft.data, detection: pct(draft.panelPct) ? { panelPct: pct(draft.panelPct), exactPct: pct(draft.exactPct) } : undefined },
      origin: draft.origin,
      profile,
      relationship: draft.relationship as Relationship,
      status: draft.status as 'at-risk' | 'compatible',
      sharedGenes: draft.shared,
      partnerName: draft.partnerName,
    };
    await act(st => importResult(st, input));
    go(`${base}/result`);
  };

  const originLabel = {
    'uploaded-pdf': { en: 'Read from your PDF', ar: 'مقروءة من ملف PDF' },
    'uploaded-fhir': { en: 'Read from your FHIR file', ar: 'مقروءة من ملف FHIR' },
    'uploaded-file': { en: 'Read from your result file', ar: 'مقروءة من ملف النتيجة' },
    'manual': { en: 'Typed in by you', ar: 'مُدخلة يدوياً' },
    'lab-signed': { en: 'Signed by the lab', ar: 'موقّعة من المختبر' },
  }[draft.origin];

  return (
    <main class="page">
      <Enter k="confirm">
        <div class="row"><Back to={base} label={t({ en: 'Cancel', ar: 'إلغاء' })} /><span class="eyebrow">{t(originLabel)}</span></div>
        <h1>{signed ? t({ en: 'A Silah result file.', ar: 'ملف نتيجة من صلة.' }) : t({ en: 'Is this what your report says?', ar: 'هل هذا ما يقوله تقريرك؟' })}</h1>
        <p class="muted">{signed
          ? t({ en: 'If it was signed by a laboratory this phone trusts, it is used as it is and marked verified. Otherwise it is marked as entered by you.', ar: 'إذا كان موقّعاً من مختبر يثق به هذا الهاتف فسيُستخدم كما هو ويُعلَّم بأنه موثّق، وإلا فسيُعلَّم بأنه مُدخل منك.' })
          : t({ en: 'Compare each line with your report and correct anything that is wrong. The numbers Silah shows depend on it.', ar: 'قارني كل سطر بتقريرك وصحّحي ما هو خاطئ، فالأرقام التي يعرضها تطبيق صلة تعتمد على ذلك.', arM: 'قارن كل سطر بتقريرك وصحّح ما هو خاطئ، فالأرقام التي يعرضها تطبيق صلة تعتمد على ذلك.' })}</p>

        <section class="stack" style={{ '--gap': '10px' } as any}>
          <h3>{t({ en: 'You', ar: 'بياناتك' })}</h3>
          <label class="field-row"><span class="small">{t({ en: 'Name', ar: 'الاسم' })}</span>
            <input class="input" value={draft.name} onInput={e => set({ name: (e.target as HTMLInputElement).value })} autocomplete="off" /></label>
          <div class="row wrap" role="radiogroup" aria-label={t({ en: 'Sex', ar: 'الجنس' })}>
            {(['F', 'M'] as const).map(x => (
              <button key={x} role="radio" aria-checked={draft.sex === x} class={`chip ${draft.sex === x ? 'indigo' : ''}`} onClick={() => set({ sex: x })}>
                {x === 'F' ? t({ en: 'Woman', ar: 'امرأة' }) : t({ en: 'Man', ar: 'رجل' })}
              </button>
            ))}
          </div>
        </section>

        {!signed && (
          <>
            <section class="stack" style={{ '--gap': '12px' } as any}>
              <h3>{t({ en: 'Changes reported for you', ar: 'التغيّرات المذكورة لك' })}</h3>
              {draft.data.findings.length === 0 && <p class="small muted">{t({ en: 'None yet. A report with no change found is also a result: leave this empty, or add each gene the report lists.', ar: 'لا شيء بعد. التقرير الذي لم يجد أي تغيّر هو نتيجة أيضاً: اتركي هذا فارغاً، أو أضيفي كل جين يذكره التقرير.', arM: 'لا شيء بعد. التقرير الذي لم يجد أي تغيّر هو نتيجة أيضاً: اترك هذا فارغاً، أو أضف كل جين يذكره التقرير.' })}</p>}
              {draft.data.findings.map((f, i) => (
                <div key={i} class={`pool ${f.confidence === 'low' || !PANEL_SET.has(f.gene) ? 'saffron' : 'soft'} stack`} style={{ '--gap': '8px' } as any}>
                  <div class="row">
                    <input class="input num" style={{ width: '7em' }} list="silah-panel" value={f.gene} aria-label={t({ en: 'Gene', ar: 'الجين' })}
                      onInput={e => { const v = (e.target as HTMLInputElement).value.trim().toUpperCase(); setFinding(i, { gene: PANEL_ALIASES[v] ?? v }); }} />
                    <select class="input grow" value={f.classification} aria-label={t({ en: 'Classification', ar: 'التصنيف' })}
                      onChange={e => setFinding(i, { classification: (e.target as HTMLSelectElement).value as Classification })}>
                      <option value="P">{t({ en: 'Pathogenic', ar: 'مُمرِض' })}</option>
                      <option value="LP">{t({ en: 'Likely pathogenic', ar: 'مُمرِض محتمل' })}</option>
                      <option value="VUS">{t({ en: 'Uncertain significance (VUS)', ar: 'غير محدد الأهمية' })}</option>
                    </select>
                  </div>
                  <input class="input num" dir="ltr" style={{ width: '100%', fontSize: '14.5px' }} value={f.variant} aria-label={t({ en: 'Change (c.)', ar: 'التغيّر (c.)' })}
                    onInput={e => setFinding(i, { variant: (e.target as HTMLInputElement).value })} />
                  <div class="row wrap">
                    <select class="input" value={f.zygosity ?? 'het'} aria-label={t({ en: 'Copies', ar: 'عدد النسخ' })}
                      onChange={e => setFinding(i, { zygosity: (e.target as HTMLSelectElement).value as any })}>
                      <option value="het">{t({ en: 'One copy (heterozygous)', ar: 'نسخة واحدة (متغاير الزيجوت)' })}</option>
                      <option value="hom">{t({ en: 'Two copies (homozygous)', ar: 'نسختان (متماثل الزيجوت)' })}</option>
                    </select>
                    <span class="grow" />
                    <button class="link" onClick={() => set({ data: { ...draft.data, findings: draft.data.findings.filter((_, k) => k !== i) }, shared: draft.shared.filter(g => g !== f.gene) })}>{t({ en: 'Remove', ar: 'حذف' })}</button>
                  </div>
                  {f.zygosity === 'hom' && f.classification !== 'VUS' && <p class="tiny">{t({ en: 'Two changed copies can mean a condition, not carrier status. Silah will not work out chances for this gene; a clinical geneticist will go through it with you.', ar: 'قد تعني النسختان المتغيّرتان وجود الحالة لا مجرد حملها، لذلك لن يحسب تطبيق صلة الاحتمالات لهذا الجين، وسيراجعه معك طبيب وراثة سريرية.' })}</p>}
                  {f.line && <p class="tiny muted mono-line" dir="ltr">{f.line}</p>}
                </div>
              ))}
              <button class="chip" onClick={() => set({ data: { ...draft.data, findings: [...draft.data.findings, { gene: '', variant: 'c.', classification: 'P', zygosity: 'het', confidence: 'high', line: '' }] } })}>+ {t({ en: 'Add a gene', ar: 'إضافة جين' })}</button>
              <datalist id="silah-panel">{PANEL_GENES.map(g => <option key={g} value={g} />)}</datalist>
              {draft.data.unknownGenes.length > 0 && <p class="tiny muted">{t({ en: `Not on the DoH panel, so not used: ${draft.data.unknownGenes.join(', ')}.`, ar: `ليست ضمن لوحة دائرة الصحة، لذلك لن تُستخدم: ${draft.data.unknownGenes.join('، ')}.` })}</p>}
              {draft.data.warnings.map((w, i) => <p key={i} class="tiny muted" dir="ltr">⚠ {w}</p>)}
            </section>

            <section class="stack" style={{ '--gap': '10px' } as any}>
              <h3>{t({ en: 'The couple result', ar: 'نتيجة الزوجين' })}</h3>
              <div class="row wrap" role="radiogroup" aria-label={t({ en: 'Couple result', ar: 'نتيجة الزوجين' })}>
                {([['compatible', { en: 'Compatible', ar: 'متوافق' }], ['at-risk', { en: 'Not compatible (at risk)', ar: 'غير متوافق' }]] as const).map(([v, l]) => (
                  <button key={v} role="radio" aria-checked={draft.status === v} class={`chip ${draft.status === v ? 'indigo' : ''}`} onClick={() => set({ status: v, shared: v === 'compatible' ? [] : draft.shared })}>{t(l)}</button>
                ))}
              </div>
              {draft.status === 'at-risk' && (
                <div class="stack" style={{ '--gap': '6px' } as any}>
                  <p class="small">{t({ en: 'Which gene do you both carry?', ar: 'ما الجين الذي تحملانه كلاكما؟' })}</p>
                  {carriers.length === 0 && <p class="tiny muted">{t({ en: 'Add your own change in that gene above first.', ar: 'أضيفي أولاً التغيّر الذي لديك في ذلك الجين أعلاه.', arM: 'أضف أولاً التغيّر الذي لديك في ذلك الجين أعلاه.' })}</p>}
                  {carriers.map(g => (
                    <div key={g} class="row"><span class="chip saffron num">{g}</span><span class="grow" />
                      <Toggle on={draft.shared.includes(g)} label={t({ en: `Both carry ${g}`, ar: `كلاكما يحمل ${g}` })} onChange={on => set({ shared: on ? [...draft.shared, g] : draft.shared.filter(x => x !== g) })} /></div>
                  ))}
                </div>
              )}
              <label class="field-row"><span class="small">{t({ en: 'Partner’s first name (optional)', ar: 'الاسم الأول للطرف الآخر (اختياري)' })}</span>
                <input class="input" value={draft.partnerName} onInput={e => set({ partnerName: (e.target as HTMLInputElement).value })} autocomplete="off" /></label>
              <label class="field-row"><span class="small">{t({ en: 'How you are related', ar: 'صلة القرابة' })}</span>
                <select class="input" value={draft.relationship} onChange={e => set({ relationship: (e.target as HTMLSelectElement).value as Relationship })}>
                  <option value="">{t({ en: 'Choose…', ar: 'اختيار…' })}</option>
                  {REL.map(r => <option key={r.v} value={r.v}>{t(r)}</option>)}
                </select></label>
            </section>

            <section class="stack" style={{ '--gap': '10px' } as any}>
              <h3>{t({ en: 'What the lab says about its test', ar: 'ما يذكره المختبر عن فحصه' })}</h3>
              <p class="tiny muted">{t({ en: 'Often in "Methods" or "Limitations". Leave empty if the report does not say: Silah then shows ranges.', ar: 'تُذكر غالباً في قسم «الطريقة» أو «القيود». اتركيها فارغة إن لم يذكرها التقرير، وسيعرض التطبيق نطاقات.', arM: 'تُذكر غالباً في قسم «الطريقة» أو «القيود». اتركها فارغة إن لم يذكرها التقرير، وسيعرض التطبيق نطاقات.' })}</p>
              <div class="row wrap">
                <label class="field-row"><span class="small">{t({ en: 'Detection, %', ar: 'نسبة الكشف ٪' })}</span>
                  <input class="input num" inputMode="decimal" style={{ width: '6em' }} value={draft.panelPct} onInput={e => set({ panelPct: (e.target as HTMLInputElement).value })} /></label>
                <label class="field-row"><span class="small">{t({ en: 'Partner checked for your exact change, %', ar: 'فحص الشريك للتغيّر نفسه ٪' })}</span>
                  <input class="input num" inputMode="decimal" style={{ width: '6em' }} value={draft.exactPct} onInput={e => set({ exactPct: (e.target as HTMLInputElement).value })} /></label>
              </div>
            </section>
          </>
        )}

        <section class="stack" style={{ '--gap': '10px' } as any}>
          <h3>{t({ en: 'So the clinic can see you in time', ar: 'لكي تستقبلك العيادة في الوقت المناسب' })}</h3>
          <div class="row"><span class="grow small">{t({ en: 'I am pregnant now, or my partner is', ar: 'هناك حمل الآن' })}</span><Toggle on={draft.pregnant} label="pregnant" onChange={v => set({ pregnant: v })} /></div>
          <div class="row"><span class="grow small">{t({ en: 'Our wedding is within three months', ar: 'زفافنا خلال ثلاثة أشهر' })}</span><Toggle on={draft.weddingSoon} label="wedding" onChange={v => set({ weddingSoon: v })} /></div>
          <p class="tiny muted">{t({ en: 'Optional. Used only to offer earlier counselling slots; stays on this phone unless you book.', ar: 'اختياري، ويُستخدم فقط لعرض مواعيد استشارة أقرب، ويبقى على هذا الهاتف ما لم تحجزي موعداً.', arM: 'اختياري، ويُستخدم فقط لعرض مواعيد استشارة أقرب، ويبقى على هذا الهاتف ما لم تحجز موعداً.' })}</p>
        </section>

        {problem && <div class="pool saffron"><p class="small">{problem}</p></div>}
        <button class="btn primary full" onClick={save}>{t({ en: 'Yes, this is what my report says', ar: 'نعم، هذا ما يقوله تقريري' })}</button>
        <Receipt>{t({ en: 'Kept on this phone, encrypted. You can delete it at any time from “Private”.', ar: 'تُحفظ على هذا الهاتف مشفّرة، ويمكنك حذفها في أي وقت من صفحة «خاص».' })}</Receipt>
      </Enter>
    </main>
  );
}
