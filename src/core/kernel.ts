import { Q, qsum } from './fraction';
import type { CoupleSection, FactCard, Finding, L10n, PersonResult, Relationship } from './types';

import { conditionFor, type Condition } from './conditions';
import { carrierFreq, DETECTION_FAMILIAL, DETECTION_GENE } from './frequencies';
import { PANEL_GENES, PANEL_SET } from './data/panel';

// The deterministic risk kernel. It computes; it never explains beyond fixed sentences.
// The language model only ever sees the fact cards produced here.

export const isCarrierFinding = (f: Finding) => f.classification === 'P' || f.classification === 'LP';

/** Coefficient of inbreeding of a child of these partners. */
export const INBREEDING: Record<Relationship, Q> = {
  'unrelated': Q.zero,
  'second-cousins': Q.of(1, 64),
  'first-cousins-once-removed': Q.of(1, 32),
  'first-cousins': Q.of(1, 16),
  'double-first-cousins': Q.of(1, 8),
};

/** Probability that a relative carries the same specific variant as a known carrier: the coefficient of relationship. */
export type Relative =
  | 'parent' | 'sibling' | 'child' | 'half-sibling' | 'aunt-uncle' | 'niece-nephew' | 'first-cousin' | 'second-cousin';

export const RELATIVE_PRIOR: Record<Relative, Q> = {
  'parent': Q.of(1, 2),
  'sibling': Q.of(1, 2),
  'child': Q.of(1, 2),
  'half-sibling': Q.of(1, 4),
  'aunt-uncle': Q.of(1, 4),
  'niece-nephew': Q.of(1, 4),
  'first-cousin': Q.of(1, 8),
  'second-cousin': Q.of(1, 32),
};

/** Partner relationship as a relative of the carrier (used for the familial-variant prior). */
const PARTNER_AS_RELATIVE: Record<Relationship, Q> = {
  'unrelated': Q.zero,
  'second-cousins': Q.of(1, 32),
  'first-cousins-once-removed': Q.of(1, 16),
  'first-cousins': Q.of(1, 8),
  'double-first-cousins': Q.of(1, 4),
};

/** Per-pregnancy outcomes when both partners carry a variant in the same recessive gene. */
export const AR_OUTCOMES = { affected: Q.of(1, 4), carrier: Q.of(1, 2), neither: Q.of(1, 4) };

/**
 * Chance a person is still a carrier after a negative panel result (Bayes).
 * p = prior carrier probability, d = detection rate.  p(1-d) / (1 - p d)
 */
export function residualCarrier(p: Q, d: Q): Q {
  const one = Q.one;
  return p.mul(one.sub(d)).div(one.sub(p.mul(d)));
}

/**
 * Residual carrier chance for a partner who tested negative, when the other partner carries a
 * variant in this gene. If the partners are related, the partner may share the familial variant
 * by descent (prior = coefficient of relationship), which a direct test detects almost always.
 */
export function partnerResidual(gene: string, rel: Relationship): { residual: Q; prior: Q; famPrior: Q } {
  const p = carrierFreq(gene).carrier;
  const qf = PARTNER_AS_RELATIVE[rel];
  const prior = qf.add(p);
  const num = qf.mul(Q.one.sub(DETECTION_FAMILIAL)).add(p.mul(Q.one.sub(DETECTION_GENE)));
  const den = Q.one.sub(qf.mul(DETECTION_FAMILIAL)).sub(p.mul(DETECTION_GENE));
  return { residual: num.div(den), prior, famPrior: qf };
}

// ---------- fixed sentences ----------

const fmt = (q: Q) => `1 in ${q.oneIn().toLocaleString('en-US')}`;

const pct = (q: Q, dp = 1) => `${(q.toNumber() * 100).toFixed(dp)}%`;

export interface CoupleView {
  status: 'at-risk' | 'compatible';
  relationship: Relationship;
  cards: FactCard[];
  shared: { gene: string; condition: Condition }[];
  birthPlanConditions: Condition[];
  counsellorFirst: boolean;
  /** Total chance per pregnancy of a child with a panel condition, given everything known. */
  panelRisk: Q;
}

/**
 * Everything one person sees about the couple, computed on their own device from their own result
 * and the couple section the lab issued. Nothing about the partner beyond that section is used.
 */
export function coupleView(own: PersonResult, couple: CoupleSection): CoupleView {
  const cards: FactCard[] = [];
  const rel = couple.relationship;
  const ownCarrier = own.findings.filter(isCarrierFinding).filter(f => PANEL_SET.has(f.gene));
  const sharedGenes = new Set(couple.shared.map(s => s.gene));
  const shared: CoupleView['shared'] = [];
  const birthPlan: Condition[] = [];
  let counsellorFirst = couple.vusGenes.length > 0;
  const perGeneRisks: Q[] = [];

  for (const s of couple.shared) {
    const cond = conditionFor(s.gene, s.ownTag, s.partnerTag);
    shared.push({ gene: s.gene, condition: cond });
    if (cond.counsellorFirst) counsellorFirst = true;
    if (cond.birthPlan && !birthPlan.includes(cond)) birthPlan.push(cond);
    perGeneRisks.push(AR_OUTCOMES.affected);
    cards.push({
      id: `couple:${s.gene}`,
      kind: 'couple-gene',
      gene: s.gene,
      conditionId: cond.id,
      numbers: {
        affected: AR_OUTCOMES.affected.toJSON(),
        carrier: AR_OUTCOMES.carrier.toJSON(),
        neither: AR_OUTCOMES.neither.toJSON(),
      },
      text: {
        en: `You both carry a change in ${s.gene}. In each pregnancy there is a 1 in 4 chance the child has ${cond.name.en}, a 2 in 4 chance the child is a healthy carrier, and a 1 in 4 chance the child carries neither change.`,
        ar: `أنتما تحملان تغيّراً في الجين ${s.gene}. في كل حمل، هناك احتمال 1 من 4 أن يكون الطفل مصاباً ب${cond.name.ar}، واحتمال 2 من 4 أن يكون حاملاً للتغيّر الجيني وسليماً، واحتمال 1 من 4 ألا يحمل أي تغيّر.`,
      },
      sources: ['doh-pms-2024', 'medlineplus-ar'],
      arithmetic: 'Each parent passes one of two copies at random: 1/2 × 1/2 = 1/4 affected; 2 × 1/2 × 1/2 = 1/2 carrier.',
    });
    cards.push(conditionCard(cond));
    if (cond.birthPlan) cards.push(birthPlanCard(cond));
  }

  // One partner carries, the other tested negative for that gene.
  for (const f of ownCarrier) {
    if (sharedGenes.has(f.gene)) continue;
    if (!couple.partnerNegativeFor.includes(f.gene)) continue;
    const { residual, famPrior } = partnerResidual(f.gene, rel);
    const affected = residual.mul(Q.of(1, 4));
    perGeneRisks.push(affected);
    const src = carrierFreq(f.gene);
    cards.push({
      id: `residual:${f.gene}`,
      kind: 'residual-gene',
      gene: f.gene,
      numbers: { affected: affected.toJSON(), partnerResidual: residual.toJSON(), familialPrior: famPrior.toJSON(), carrierFreq: src.carrier.toJSON() },
      text: {
        en: `You carry a change in ${f.gene}; ${couple.partnerName} tested negative for it. A negative test lowers the chance a lot but not to zero: about ${fmt(affected)} per pregnancy for this gene.`,
        ar: `لديك تغيّر في الجين ${f.gene}، وجاءت نتيجة شريكك سلبية له. النتيجة السلبية تخفض الاحتمال كثيراً لكن ليس إلى الصفر: نحو 1 من ${affected.oneIn().toLocaleString('en-US')} في كل حمل لهذا الجين.`,
      },
      sources: [src.ref ?? 'assumption-carrier', 'assumption-detection', ...(famPrior.isZero() ? [] : ['bennett-2002'])],
      arithmetic: `Partner residual = (r(1−d_fam) + p(1−d)) / (1 − r·d_fam − p·d) with r=${famPrior}, p=${src.carrier}, d=${DETECTION_GENE}, d_fam=${DETECTION_FAMILIAL}; × 1 (you carry) × 1/4.`,
    });
    cards.push({
      id: `carrier:${f.gene}`,
      kind: 'carrier',
      gene: f.gene,
      numbers: {},
      text: {
        en: `Carrying a change in ${f.gene} does not make you ill. It matters only if a child also receives a change in the same gene from the other parent.`,
        ar: `وجود تغيّر في الجين ${f.gene} لديك لا يسبب المرض، ولا يهم ذلك إلا إذا ورث الطفل تغيّراً في الجين نفسه من الوالد الآخر أيضاً.`,
      },
      sources: ['medlineplus-ar'],
    });
  }

  // Every other panel gene: both partners tested negative.
  const covered = new Set([...sharedGenes, ...ownCarrier.map(f => f.gene)]);
  const rest = PANEL_GENES.filter(g => !covered.has(g));
  const restRisk = qsum(rest.map(g => {
    const r = residualCarrier(carrierFreq(g).carrier, DETECTION_GENE);
    return r.mul(r).mul(Q.of(1, 4));
  }));
  perGeneRisks.push(restRisk);
  cards.push({
    id: 'panel-residual',
    kind: 'residual-panel',
    numbers: { affected: restRisk.toJSON(), genes: { n: String(rest.length), d: '1' } },
    text: {
      en: `For the other ${rest.length} genes on the panel, you both tested negative. The remaining chance for all of them together is very small: about ${fmt(restRisk)} per pregnancy.`,
      ar: `بالنسبة إلى الجينات الـ${rest.length} الأخرى في اللوحة، جاءت نتيجتكما سلبية. الاحتمال المتبقي لها جميعاً صغير جداً: نحو 1 من ${restRisk.oneIn().toLocaleString('en-US')} في كل حمل.`,
    },
    sources: ['assumption-carrier', 'assumption-detection', 'doh-pms-2024'],
    arithmetic: 'Σ over genes of r_g² / 4, r_g = p_g(1−d)/(1−p_g·d).',
  });

  cards.push(notAssessedCard(), backgroundCard());
  const consang = consanguinityCard(rel);
  if (consang) cards.push(consang);

  for (const g of couple.vusGenes) {
    counsellorFirst = true;
    cards.push({
      id: `vus:${g}`,
      kind: 'vus',
      gene: g,
      numbers: {},
      text: {
        en: `A change in ${g} was found whose meaning is not yet known. It is not counted as a risk, and a genetics professional will review it with you.`,
        ar: `وُجد تغيّر في الجين ${g} لم يُعرف معناه بعد. لا يُحتسب خطراً، وسيراجعه معكما مختص في علم الوراثة.`,
      },
      sources: ['doh-pms-2024'],
    });
  }

  for (const o of OPTIONS) if (couple.status === 'at-risk') cards.push(o);

  return {
    status: couple.status,
    relationship: rel,
    cards,
    shared,
    birthPlanConditions: birthPlan,
    counsellorFirst,
    panelRisk: qsum(perGeneRisks),
  };
}

export function conditionCard(c: Condition): FactCard {
  return {
    id: `condition:${c.id}`,
    kind: 'condition',
    conditionId: c.id,
    numbers: {},
    text: { en: `${c.name.en}: ${c.what.en} ${c.notChanged.en}`, ar: `${c.name.ar}: ${c.what.ar} ${c.notChanged.ar}` },
    sources: c.sources,
  };
}

export function birthPlanCard(c: Condition): FactCard {
  const bp = c.birthPlan!;
  return {
    id: `birth:${c.id}`,
    kind: 'birth-plan',
    conditionId: c.id,
    numbers: bp.numbers ?? {},
    text: { en: `${bp.action.en} ${bp.window.en}`, ar: `${bp.action.ar} ${bp.window.ar}` },
    sources: bp.sources,
  };
}

export function notAssessedCard(): FactCard {
  return {
    id: 'not-assessed',
    kind: 'not-assessed',
    numbers: {},
    text: {
      en: 'The premarital panel looks only at recessive conditions, and not all of them. It does not look at conditions passed through the X chromosome, dominant conditions, chromosome differences, new changes that arise in the child, or causes that are not genetic.',
      ar: 'تفحص لوحة ما قبل الزواج الحالات المتنحية فقط، وليس جميعها. ولا تفحص الحالات المرتبطة بالصبغي X، ولا الحالات السائدة، ولا الاختلالات الصبغية، ولا التغيرات الجديدة التي تنشأ لدى الطفل، ولا الأسباب غير الوراثية.',
    },
    sources: ['doh-pms-2024'],
  };
}

export function backgroundCard(): FactCard {
  const b = Q.of(1, 33);
  return {
    id: 'background',
    kind: 'background',
    numbers: { birthDefects: b.toJSON() },
    text: {
      en: 'For every couple, related or not, about 1 in 33 babies is born with a birth defect. No test removes this background chance.',
      ar: 'لدى كل زوجين، أقارب كانا أم لا، يولد نحو 1 من كل 33 طفلاً بعيب خلقي. لا يوجد فحص يزيل هذا الاحتمال الأساسي.',
    },
    sources: ['cdc-birth-defects-1-in-33'],
  };
}

export function consanguinityCard(rel: Relationship): FactCard | null {
  if (rel === 'unrelated') return null;
  const F = INBREEDING[rel];
  if (rel === 'first-cousins') {
    return {
      id: 'consanguinity',
      kind: 'consanguinity',
      numbers: { inbreeding: F.toJSON() },
      ranges: { added: [Q.of(17, 1000).toJSON(), Q.of(28, 1000).toJSON()] },
      text: {
        en: `For first cousins, the background chance of a child with a serious condition is about 1.7 to 2.8 percentage points higher than for unrelated parents, mostly from recessive conditions the panel does not test.`,
        ar: `لدى أبناء العمومة أو الخؤولة من الدرجة الأولى، يرتفع الاحتمال الأساسي لإنجاب طفل بحالة خطيرة بنحو 1.7 إلى 2.8 نقطة مئوية مقارنة بالوالدين غير الأقارب، ومعظم ذلك من حالات متنحية لا تفحصها اللوحة.`,
      },
      sources: ['bennett-2002'],
      arithmetic: `Inbreeding coefficient F = ${F}.`,
    };
  }
  const closer = rel === 'double-first-cousins';
  return {
    id: 'consanguinity',
    kind: 'consanguinity',
    numbers: { inbreeding: F.toJSON() },
    text: closer
      ? {
          en: 'Because you are double first cousins, the background chance is higher than for unrelated parents, and higher than for first cousins.',
          ar: 'لأنكما ابنا عمومة أو خؤولة مزدوجان، فإن الاحتمال الأساسي أعلى منه لدى الوالدين غير الأقارب، وأعلى منه لدى أبناء العمومة من الدرجة الأولى.',
        }
      : {
          en: 'Because you are related, the background chance is slightly higher than for unrelated parents. It is lower than for first cousins.',
          ar: 'لأنكما قريبان، فإن الاحتمال الأساسي أعلى قليلاً منه لدى الوالدين غير الأقارب، لكنه أقل منه لدى أبناء العمومة من الدرجة الأولى.',
        },
    sources: ['bennett-2002'],
    arithmetic: `Inbreeding coefficient F = ${F}.`,
  };
}

export const OPTIONS: FactCard[] = [
  {
    id: 'option:pgt',
    kind: 'option',
    numbers: {},
    text: {
      en: 'IVF with testing of embryos before pregnancy (PGT). Only embryos without the condition are transferred. The premarital programme links at-risk couples to reproductive medicine services.',
      ar: 'أطفال الأنابيب مع فحص الأجنة قبل الحمل (الفحص الجيني قبل الزرع). تُنقل فقط الأجنة غير المصابة. ويربط برنامج فحص ما قبل الزواج الأزواجَ المعرّضين للخطر بخدمات الطب الإنجابي.',
    },
    sources: ['doh-pms-2024', 'law-7-2019-mar'],
  },
  {
    id: 'option:prenatal',
    kind: 'option',
    numbers: { cvsFrom: { n: '11', d: '1' }, cvsTo: { n: '14', d: '1' }, amnioFrom: { n: '15', d: '1' } },
    text: {
      en: 'Natural pregnancy with a test during pregnancy: a placenta sample at 11 to 14 weeks, or a fluid sample from 15 weeks, shows whether the baby is affected.',
      ar: 'حمل طبيعي مع فحص أثناء الحمل: عينة من المشيمة بين الأسبوع 11 و14، أو عينة من السائل الأمنيوسي ابتداءً من الأسبوع 15، تبيّن ما إذا كان الجنين مصاباً.',
    },
    sources: ['acog-162'],
  },
  {
    id: 'option:birth',
    kind: 'option',
    numbers: {},
    text: {
      en: 'Natural pregnancy with a birth plan: the baby is tested in the first days, so care can start early if needed.',
      ar: 'حمل طبيعي مع خطة للولادة: يُفحص الطفل في أيامه الأولى، فتبدأ الرعاية مبكراً عند الحاجة.',
    },
    sources: ['doh-pms-2024'],
  },
  {
    id: 'option:time',
    kind: 'option',
    numbers: {},
    text: {
      en: 'Taking time. Nothing has to be decided today, and you can talk it through with a genetic counsellor first.',
      ar: 'أخذ الوقت الكافي. لا شيء يجب تقريره اليوم، ويمكنكما مناقشة الأمر أولاً مع مستشار وراثي.',
    },
    sources: [],
  },
];

/** A relative's chance of carrying the same variant, for the invitation screen. */
export function relativeCard(rel: Relative, gene: string): FactCard {
  const p = RELATIVE_PRIOR[rel];
  const names: Record<Relative, L10n> = {
    'parent': { en: 'each parent', ar: 'كل من الوالدين' },
    'sibling': { en: 'a brother or sister', ar: 'الأخ أو الأخت' },
    'child': { en: 'a child', ar: 'الابن أو الابنة' },
    'half-sibling': { en: 'a half-brother or half-sister', ar: 'الأخ أو الأخت من أحد الوالدين فقط' },
    'aunt-uncle': { en: 'an aunt or uncle', ar: 'العم أو العمة أو الخال أو الخالة' },
    'niece-nephew': { en: 'a niece or nephew', ar: 'ابن أو ابنة الأخ أو الأخت' },
    'first-cousin': { en: 'a first cousin', ar: 'ابن أو بنت العم أو الخال من الدرجة الأولى' },
    'second-cousin': { en: 'a second cousin', ar: 'قريب من الدرجة الثانية' },
  };
  return {
    id: `relative:${rel}`,
    kind: 'relative',
    gene,
    numbers: { prior: p.toJSON() },
    text: {
      en: `For ${names[rel].en}, the chance of carrying the same change is about 1 in ${p.oneIn()}.`,
      ar: `بالنسبة إلى ${names[rel].ar}، فإن احتمال أن يحمل التغيّر نفسه نحو 1 من ${p.oneIn()}.`,
    },
    sources: ['bennett-2002'],
    arithmetic: 'Coefficient of relationship to a known carrier.',
  };
}

export { fmt as formatOneIn, pct as formatPct };

/**
 * Lab side (simulated): builds the couple section each partner receives. Each partner learns the
 * shared genes and, for their own carrier genes, only that the other partner tested negative.
 */
export function labCouple(a: PersonResult, b: PersonResult, rel: Relationship, coupleId: string): [CoupleSection, CoupleSection] {
  const carriers = (p: PersonResult) => new Map(p.findings.filter(isCarrierFinding).filter(f => PANEL_SET.has(f.gene)).map(f => [f.gene, f]));
  const vus = (p: PersonResult) => new Set(p.findings.filter(f => f.classification === 'VUS').map(f => f.gene));
  const ca = carriers(a), cb = carriers(b), va = vus(a), vb = vus(b);
  const shared = [...ca.keys()].filter(g => cb.has(g)).sort();
  const vusGenes = [...new Set([...va].filter(g => cb.has(g) || vb.has(g)).concat([...vb].filter(g => ca.has(g) || va.has(g))))].sort();
  const status = shared.length ? 'at-risk' : 'compatible';
  const section = (own: Map<string, Finding>, other: Map<string, Finding>, partner: PersonResult): CoupleSection => ({
    coupleId,
    partnerName: partner.displayName,
    relationship: rel,
    status,
    shared: shared.map(g => ({ gene: g, ownTag: own.get(g)?.tag, partnerTag: other.get(g)?.tag })),
    partnerNegativeFor: [...own.keys()].filter(g => !other.has(g)).sort(),
    vusGenes,
  });
  return [section(ca, cb, b), section(cb, ca, a)];
}
