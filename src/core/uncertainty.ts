import { Q } from './fraction';
import type { CoupleSection, FactCard, PersonResult } from './types';
import { coupleView, formatOneIn } from './kernel';
import { CARRIER_FREQS, DETECTION_RANGE } from './frequencies';

// What is uncertain about a result, as fact cards: how well the test finds changes, how much the remaining
// chance moves with that, the assumed carrier frequency, and (for an uploaded result) the reading of the report.
// Same rules as every other card: exact numbers, sources, and the only facts a language model may use.

export type ResultOrigin = 'lab-signed' | 'uploaded-pdf' | 'uploaded-fhir' | 'uploaded-file' | 'manual';

const pct = (q: Q) => Math.round(q.toNumber() * 100);

/** The panel-residual chance if the lab found a given share of changes, from the kernel itself. */
function residualAt(own: PersonResult, couple: CoupleSection, d: Q): Q | undefined {
  const v = coupleView(own, { ...couple, detection: { panel: d.toJSON() } });
  const c = v.cards.find(x => x.id === 'panel-residual');
  return c?.numbers.affected ? Q.from(c.numbers.affected) : undefined;
}

export function uncertaintyCards(own: PersonResult, couple: CoupleSection, origin: ResultOrigin = 'lab-signed'): FactCard[] {
  const cards: FactCard[] = [];
  const [lo, hi] = DETECTION_RANGE;
  const det = couple.detection;

  if (det) {
    const d = Q.from(det.panel);
    cards.push({
      id: 'uncertainty:detection',
      kind: 'uncertainty',
      numbers: { detected: d.toJSON() },
      text: {
        en: `The lab says its test finds about ${pct(d)}% of the disease-causing changes in each gene it checks. A change it misses does not show on the result, which is why a negative result lowers a chance but does not remove it.`,
        ar: `يذكر المختبر أن فحصه يكشف نحو ${pct(d)}% من التغيّرات المسبّبة للمرض في كل جين يفحصه. والتغيّر الذي لا يكشفه الفحص لا يظهر في النتيجة، ولهذا تخفض النتيجة السلبية الاحتمال ولا تلغيه.`,
      },
      sources: ['lab-detection'],
    });
  } else {
    cards.push({
      id: 'uncertainty:detection',
      kind: 'uncertainty',
      numbers: { low: lo.toJSON(), high: hi.toJSON() },
      text: {
        en: `This result does not say how well the lab's test finds changes. So Silah works out each remaining chance twice, for a test that finds ${pct(hi)}% and one that finds ${pct(lo)}% of the disease-causing changes in a gene, and shows the range between them.`,
        ar: `لا تذكر هذه النتيجة مدى قدرة فحص المختبر على كشف التغيّرات. لذلك يحسب تطبيق صلة كل احتمال متبقٍّ مرتين، لفحص يكشف ${pct(hi)}% ولفحص يكشف ${pct(lo)}% من التغيّرات المسبّبة للمرض في الجين، ويعرض النطاق بينهما.`,
      },
      sources: ['assumption-detection'],
    });
  }

  const atHi = residualAt(own, couple, hi);
  const atLo = residualAt(own, couple, lo);
  if (atHi && atLo) {
    cards.push({
      id: 'uncertainty:range',
      kind: 'uncertainty',
      numbers: { high: hi.toJSON(), low: lo.toJSON() },
      ranges: { affected: [atHi.toJSON(), atLo.toJSON()] },
      text: {
        en: `For the genes where you both tested negative, the remaining chance depends on how well the test finds changes. If it finds ${pct(hi)}% of them, the chance is about ${formatOneIn(atHi)} per pregnancy. If it finds ${pct(lo)}%, it is about ${formatOneIn(atLo)}.`,
        ar: `بالنسبة إلى الجينات التي جاءت نتيجتكما فيها سلبية، يعتمد الاحتمال المتبقي على مدى قدرة الفحص على كشف التغيّرات. فإذا كشف ${pct(hi)}% منها، يكون الاحتمال نحو 1 من ${atHi.oneIn().toLocaleString('en-US')} في كل حمل. وإذا كشف ${pct(lo)}%، يكون نحو 1 من ${atLo.oneIn().toLocaleString('en-US')}.`,
      },
      sources: ['assumption-detection', 'assumption-carrier'],
      arithmetic: `panel-residual recomputed by the kernel with d = ${hi} and d = ${lo} (no exact-change check).`,
    });
  }

  const published = CARRIER_FREQS.length;
  cards.push({
    id: 'uncertainty:frequency',
    kind: 'uncertainty',
    numbers: { assumed: Q.of(1, 1000).toJSON(), published: Q.of(published).toJSON() },
    text: {
      en: `For most genes, no one has measured how many people in the UAE carry a change, so Silah assumes 1 in 1,000 people do. For ${published} genes it uses published Emirati figures. Your counsellor may use other figures.`,
      ar: `لم يُقَس لمعظم الجينات عدد الأشخاص في الإمارات الذين يحملون تغيّراً فيها، لذلك يفترض تطبيق صلة أن 1 من 1,000 شخص يحمل تغيّراً. ويستخدم أرقاماً إماراتية منشورة لـ${published} جينات. وقد يستخدم المستشار أرقاماً أخرى.`,
    },
    sources: ['assumption-carrier', 'jain-2025-gimo'],
  });

  if (origin !== 'lab-signed') {
    cards.push({
      id: 'uncertainty:entry',
      kind: 'uncertainty',
      numbers: {},
      text: {
        en: 'These numbers come from what was read from your report and what you confirmed. If a gene or a change was read wrongly, the numbers would be wrong too. Your counsellor will check the original report.',
        ar: 'تستند هذه الأرقام إلى ما قُرئ من تقريركِ وما أكّدتِه. وإذا قُرئ جين أو تغيّر بشكل خاطئ فستكون الأرقام خاطئة أيضاً. وسيراجع المستشار التقرير الأصلي.',
        arM: 'تستند هذه الأرقام إلى ما قُرئ من تقريرك وما أكّدتَه. وإذا قُرئ جين أو تغيّر بشكل خاطئ فستكون الأرقام خاطئة أيضاً. وسيراجع المستشار التقرير الأصلي.',
      },
      sources: [],
    });
  }
  return cards;
}
