import { Q, qsum } from './fraction';
import type { CoupleSection, Detection, FactCard, Finding, L10n, PersonResult, Relationship } from './types';

import { conditionFor, type Condition } from './conditions';
import { carrierFreq, DETECTION_RANGE } from './frequencies';
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
 * by descent (prior = coefficient of relationship). It is missed with chance 1 − dx, where dx is the
 * sensitivity of the lab's check for that exact change, or the gene's panel rate if it was not checked.
 */
export function partnerResidual(p: Q, rel: Relationship, d: Q, dx: Q): { residual: Q; prior: Q; famPrior: Q } {
  const qf = PARTNER_AS_RELATIVE[rel];
  const prior = qf.add(p);
  const num = qf.mul(Q.one.sub(dx)).add(p.mul(Q.one.sub(d)));
  const den = Q.one.sub(qf.mul(dx)).sub(p.mul(d));
  return { residual: num.div(den), prior, famPrior: qf };
}

/**
 * Chance per pregnancy of an affected child in a gene where both partners tested negative.
 * With chance 1 − F the child's two copies come from different ancestral copies: each parent is still
 * a carrier with chance r and passes the change on with chance 1/2, so (1 − F)·r²/4. With chance F (the
 * child's inbreeding coefficient) both copies descend from one copy the parents share. The child is then
 * affected only if that copy carries a change the panel misses, since a change it detects would have shown
 * in both parents: q(1 − d)/(1 − q·d), the same Bayes step applied to the copy (q = p/2, from p = 2q(1 − q)
 * for rare changes). For unrelated partners F = 0 and this is r²/4.
 */
export function bothNegative(p: Q, d: Q, F: Q): Q {
  const r = residualCarrier(p, d);
  const shared = residualCarrier(p.mul(Q.of(1, 2)), d);
  return Q.one.sub(F).mul(r).mul(r).mul(Q.of(1, 4)).add(F.mul(shared));
}

/** Chance that a child has at least one of several conditions inherited independently: 1 − Π(1 − r). */
export function atLeastOne(rs: Q[]): Q {
  return Q.one.sub(rs.reduce((acc, r) => acc.mul(Q.one.sub(r)), Q.one));
}

/**
 * Every other panel gene, both partners negative, as the sum of the per-gene chances. The sum is never
 * below the chance of at least one of them, and with every term under 1 in 1,000 it agrees with it to
 * two significant figures (tests/kernel.test.ts). Genes with the same inputs are computed once.
 */
export function restOfPanel(genes: string[], d: (g: string) => Q, F: Q): Q {
  const groups = new Map<string, { p: Q; d: Q; n: number }>();
  for (const g of genes) {
    const p = carrierFreq(g).carrier, dg = d(g), k = `${p}|${dg}`;
    const x = groups.get(k);
    if (x) x.n++; else groups.set(k, { p, d: dg, n: 1 });
  }
  return qsum([...groups.values()].map(x => bothNegative(x.p, x.d, F).mul(Q.of(x.n))));
}

/** The detection rates one calculation uses. */
interface Rates { gene(g: string): Q; exact(g: string): Q }
const statedRates = (det: Detection): Rates => {
  const gene = (g: string) => Q.from(det.genes?.[g] ?? det.panel);
  return { gene, exact: g => (det.exactChange?.[g] ? Q.from(det.exactChange[g]) : gene(g)) };
};
const flatRate = (d: Q): Rates => ({ gene: () => d, exact: () => d });

/** What the simulated lab states about its tests: example values for the demonstration, not a validated lab's.
 *  It checks each partner's sample for the other partner's exact change, as a couple analysis can. */
export const SIMULATED_LAB = { panel: Q.of(9, 10), exactChange: Q.of(99, 100) };

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
  /** Chance per pregnancy of a child with at least one panel condition. Without the lab's detection, the cautious end. */
  panelRisk: Q;
  /** Set when the result does not state the lab's detection: panelRisk at 99% and at 80% detection. */
  panelRiskRange?: [Q, Q];
  /** The detection the lab stated. Absent: the numbers are ranges. */
  detection?: Detection;
}

/**
 * Everything one person sees about the couple, computed on their own device from their own result
 * and the couple section the lab issued. Nothing about the partner beyond that section is used.
 */
export function coupleView(own: PersonResult, couple: CoupleSection): CoupleView {
  const cards: FactCard[] = [];
  const rel = couple.relationship;
  const F = INBREEDING[rel];
  const ownCarrier = own.findings.filter(isCarrierFinding).filter(f => PANEL_SET.has(f.gene));
  const sharedGenes = new Set(couple.shared.map(s => s.gene));
  const shared: CoupleView['shared'] = [];
  const birthPlan: Condition[] = [];
  let counsellorFirst = couple.vusGenes.length > 0;
  // One calculation with the lab's stated detection. Without it, two (99% and 80%) that bound the figure.
  const det = couple.detection;
  const scenarios: Rates[] = det ? [statedRates(det)] : [flatRate(DETECTION_RANGE[1]), flatRate(DETECTION_RANGE[0])];
  const detSource = det ? 'lab-detection' : 'assumption-detection';
  // Per calculation, the chance of an affected child for each gene or group of genes.
  const perGeneRisks: Q[][] = scenarios.map(() => []);
  const each = (f: (r: Rates, i: number) => Q): Q[] => scenarios.map((r, i) => { const x = f(r, i); perGeneRisks[i].push(x); return x; });
  const withRange = (card: FactCard, xs: Q[]): FactCard => (xs.length > 1 ? { ...card, ranges: { ...card.ranges, affected: [xs[0].toJSON(), xs[1].toJSON()] } } : card);

  for (const s of couple.shared) {
    const cond = conditionFor(s.gene, s.ownTag, s.partnerTag);
    shared.push({ gene: s.gene, condition: cond });
    if (cond.counsellorFirst) counsellorFirst = true;
    if (cond.birthPlan && !birthPlan.includes(cond)) birthPlan.push(cond);
    each(() => AR_OUTCOMES.affected);
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
        en: `You both carry a change in ${s.gene}. In each pregnancy, there is a 1 in 4 chance the child has ${cond.name.en}. There is a 2 in 4 chance the child is a healthy carrier, and a 1 in 4 chance the child carries neither change.`,
        ar: `أنتما تحملان تغيّراً في الجين ${s.gene}. في كل حمل، هناك احتمال 1 من 4 أن يكون الطفل مصاباً ب${cond.name.ar}. وهناك احتمال 2 من 4 أن يكون حاملاً للتغيّر الجيني وسليماً، واحتمال 1 من 4 ألا يحمل أي تغيّر.`,
      },
      sources: ['doh-pms-2024', 'medlineplus-ar'],
      arithmetic: 'Each parent passes one of two copies at random: 1/2 × 1/2 = 1/4 affected; 2 × 1/2 × 1/2 = 1/2 carrier.',
    });
    cards.push(conditionCard(cond));
    if (cond.birthPlan) cards.push(birthPlanCard(cond));
  }

  // Two or more shared genes: the chance of at least one condition, not the sum of the chances.
  if (couple.shared.length > 1) {
    const k = couple.shared.length;
    const any = atLeastOne(couple.shared.map(() => AR_OUTCOMES.affected));
    cards.push({
      id: 'couple:any',
      kind: 'couple-gene',
      numbers: { affected: any.toJSON(), conditions: Q.of(k).toJSON() },
      text: {
        en: `Together, in each pregnancy, the chance the child has at least one of these ${k === 2 ? 'two' : k} conditions is ${any.n} in ${any.d}.`,
        ar: `معاً، في كل حمل، احتمال أن يُصاب الطفل ${k === 2 ? 'بإحدى هاتين الحالتين' : `بإحدى هذه الحالات الـ${k}`} على الأقل هو ${any.n} من ${any.d}.`,
      },
      sources: ['medlineplus-ar'],
      arithmetic: `Genes are inherited independently: 1 − (3/4)^${k} = ${any}. Adding ${k} × 1/4 would overstate it.`,
    });
  }

  // One partner carries, the other tested negative for that gene.
  for (const f of ownCarrier) {
    if (sharedGenes.has(f.gene)) continue;
    if (!couple.partnerNegativeFor.includes(f.gene)) continue;
    const src = carrierFreq(f.gene);
    const calc = scenarios.map(r => partnerResidual(src.carrier, rel, r.gene(f.gene), r.exact(f.gene)));
    const affected = each((_, i) => calc[i].residual.mul(Q.of(1, 4)));
    const famPrior = calc[0].famPrior;
    const partnerAr = own.sex === 'M' ? 'شريكتك' : 'شريكك';
    const rates = det
      ? `d=${statedRates(det).gene(f.gene)}, d_x=${statedRates(det).exact(f.gene)}, stated by the lab${det.exactChange?.[f.gene] ? ' (partner checked for this exact change)' : ' (exact change not checked, so d_x = d)'}`
      : `d = d_x from ${DETECTION_RANGE[1]} to ${DETECTION_RANGE[0]}, because the lab's detection is not stated`;
    cards.push(withRange({
      id: `residual:${f.gene}`,
      kind: 'residual-gene',
      gene: f.gene,
      numbers: {
        ...(det ? { affected: affected[0].toJSON(), partnerResidual: calc[0].residual.toJSON() } : {}),
        familialPrior: famPrior.toJSON(),
        carrierFreq: src.carrier.toJSON(),
      },
      text: det ? {
        en: `You carry a change in ${f.gene}; ${couple.partnerName} tested negative for it. A negative test lowers the chance a lot but not to zero: about ${fmt(affected[0])} per pregnancy for this gene.`,
        ar: `لديك تغيّر في الجين ${f.gene}، وجاءت نتيجة فحص ${partnerAr} لهذا الجين سلبية. النتيجة السلبية تخفض الاحتمال كثيراً لكن ليس إلى الصفر: نحو 1 من ${affected[0].oneIn().toLocaleString('en-US')} في كل حمل لهذا الجين.`,
      } : {
        en: `You carry a change in ${f.gene}; ${couple.partnerName} tested negative for it. A negative test lowers the chance a lot but not to zero. This result does not say how well the lab's test finds changes. So the chance is a range: between about ${fmt(affected[0])} and ${fmt(affected[1])} per pregnancy for this gene. Your counsellor can ask the lab for its exact figure.`,
        ar: `لديك تغيّر في الجين ${f.gene}، وجاءت نتيجة فحص ${partnerAr} لهذا الجين سلبية. النتيجة السلبية تخفض الاحتمال كثيراً لكن ليس إلى الصفر. ولا تذكر هذه النتيجة مدى قدرة فحص المختبر على كشف التغيّرات. لذلك يأتي الاحتمال في صورة نطاق: بين نحو 1 من ${affected[0].oneIn().toLocaleString('en-US')} و1 من ${affected[1].oneIn().toLocaleString('en-US')} في كل حمل لهذا الجين. ويمكن للمستشار أن يطلب من المختبر رقمه الدقيق.`,
      },
      sources: [src.ref ?? 'assumption-carrier', detSource, ...(famPrior.isZero() ? [] : ['hamamy-2012'])],
      arithmetic: `Partner residual = (r(1−d_x) + p(1−d)) / (1 − r·d_x − p·d) with r=${famPrior}, p=${src.carrier}, ${rates}; × 1 (you carry) × 1/4.`,
    }, affected));
    cards.push({
      id: `carrier:${f.gene}`,
      kind: 'carrier',
      gene: f.gene,
      numbers: {},
      text: {
        en: `Carrying a change in ${f.gene} does not make you ill. It matters only if a child also receives a change in the same gene from the other parent.`,
        ar: `وجود تغيّر في الجين ${f.gene} لديك لا يسبب المرض. ولا تكون له أهمية إلا إذا ورث الطفل تغيّراً في الجين نفسه من الوالد الآخر أيضاً.`,
      },
      sources: ['medlineplus-ar'],
    });
  }

  // Every other panel gene: both partners tested negative. For related partners this includes a change
  // both inherited from an ancestor they share, in a form the panel misses.
  const covered = new Set([...sharedGenes, ...ownCarrier.map(f => f.gene)]);
  const rest = PANEL_GENES.filter(g => !covered.has(g));
  const restRisk = each(r => restOfPanel(rest, g => r.gene(g), F));
  const n = rest.length;
  const oneIn = (q: Q) => q.oneIn().toLocaleString('en-US');
  const restText: L10n = det
    ? F.isZero()
      ? {
          en: `For the other ${n} genes on the panel, you both tested negative. The remaining chance for all of them together is very small: about ${fmt(restRisk[0])} per pregnancy.`,
          ar: `بالنسبة إلى الجينات الـ${n} الأخرى في اللوحة، جاءت نتيجتكما سلبية. الاحتمال المتبقي لها جميعاً صغير جداً: نحو 1 من ${oneIn(restRisk[0])} في كل حمل.`,
        }
      : {
          en: `For the other ${n} genes on the panel, you both tested negative. Because you are related, you may both have the same change, passed down from an ancestor you share. The test can miss such a change. The remaining chance for all of these genes together is about ${fmt(restRisk[0])} per pregnancy.`,
          ar: `بالنسبة إلى الجينات الـ${n} الأخرى في اللوحة، جاءت نتيجتكما سلبية. ولأنكما قريبان، فقد يحمل كلاكما التغيّر نفسه موروثاً من جدٍّ مشترك. وقد لا يكشف الفحص مثل هذا التغيّر. الاحتمال المتبقي لهذه الجينات كلها معاً نحو 1 من ${oneIn(restRisk[0])} في كل حمل.`,
        }
    : {
        en: `For the other ${n} genes on the panel, you both tested negative.${F.isZero() ? '' : ' Because you are related, you may both have the same change, passed down from an ancestor you share. The test can miss such a change.'} This result does not say how well the lab's test finds changes. So the remaining chance for all of these genes together is a range: between about ${fmt(restRisk[0])} and ${fmt(restRisk[1])} per pregnancy.`,
        ar: `بالنسبة إلى الجينات الـ${n} الأخرى في اللوحة، جاءت نتيجتكما سلبية.${F.isZero() ? '' : ' ولأنكما قريبان، فقد يحمل كلاكما التغيّر نفسه موروثاً من جدٍّ مشترك. وقد لا يكشف الفحص مثل هذا التغيّر.'} ولا تذكر هذه النتيجة مدى قدرة فحص المختبر على كشف التغيّرات. لذلك يأتي الاحتمال المتبقي لهذه الجينات كلها في صورة نطاق: بين نحو 1 من ${oneIn(restRisk[0])} و1 من ${oneIn(restRisk[1])} في كل حمل.`,
      };
  cards.push(withRange({
    id: 'panel-residual',
    kind: 'residual-panel',
    numbers: { ...(det ? { affected: restRisk[0].toJSON() } : {}), genes: { n: String(n), d: '1' } },
    text: restText,
    sources: ['assumption-carrier', detSource, 'doh-pms-2024', ...(F.isZero() ? [] : ['hamamy-2012'])],
    arithmetic: `Σ over genes of (1−F)·r_g²/4 + F·u_g, with r_g = p_g(1−d)/(1−p_g·d), u_g = q_g(1−d)/(1−q_g·d), q_g = p_g/2, F = ${F}. The sum is never below the chance of at least one.`,
  }, restRisk));

  cards.push(notAssessedCard(), familyHistoryCard(), backgroundCard());
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

  if (couple.status === 'at-risk') cards.push(...optionCards(birthPlan));

  // The chance of at least one panel condition. The rest of the panel enters as its sum, so this never understates.
  const panel = perGeneRisks.map(atLeastOne);
  return {
    status: couple.status,
    relationship: rel,
    cards,
    shared,
    birthPlanConditions: birthPlan,
    counsellorFirst,
    panelRisk: panel[panel.length - 1],
    panelRiskRange: det ? undefined : [panel[0], panel[1]],
    detection: det,
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
      en: 'The premarital panel looks only at recessive conditions, and not all of them. It does not look at dominant conditions or conditions linked to the X chromosome. It also does not look at chromosome differences, new changes that start in the child, or causes that are not genetic.',
      ar: 'تفحص لوحة ما قبل الزواج الحالات المتنحية فقط، وليس جميعها. ولا تفحص الحالات السائدة ولا الحالات المرتبطة بالصبغي X. ولا تفحص كذلك الاختلالات الصبغية، ولا التغيرات الجديدة التي تنشأ لدى الطفل، ولا الأسباب غير الوراثية.',
    },
    sources: ['doh-pms-2024'],
  };
}

/** The numbers come from the two results only. A known condition in the family changes them. */
export function familyHistoryCard(): FactCard {
  return {
    id: 'family-history',
    kind: 'not-assessed',
    numbers: {},
    text: {
      en: 'These numbers do not include your family history. If someone in either family has a genetic condition, tell your counsellor. It can change the numbers.',
      ar: 'لا تشمل هذه الأرقام التاريخ الصحي لعائلتيكما. إذا كان أحد أفراد العائلتين مصاباً بحالة وراثية، فأخبرا المستشار بذلك. فقد يغيّر هذا الأرقام.',
    },
    sources: ['hamamy-2012'],
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
      ar: 'لدى أي زوجين، سواء أكانا قريبين أم لا، يولد نحو 1 من كل 33 طفلاً بعيب خلقي. لا يوجد فحص يزيل هذا الاحتمال الأساسي.',
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
      numbers: { inbreeding: F.toJSON(), births: Q.of(100, 1).toJSON() },
      ranges: { added: [Q.of(17, 1000).toJSON(), Q.of(28, 1000).toJSON()] },
      text: {
        en: `For first cousins, the background chance is a little higher than for unrelated parents. In every 100 births, about 1.7 to 2.8 more children have a serious condition. Most of this comes from recessive conditions. A negative panel lowers part of it, but not all.`,
        ar: `لدى أبناء العمومة أو الخؤولة من الدرجة الأولى، يكون الاحتمال الأساسي أعلى قليلاً منه لدى الوالدين غير الأقارب. ففي كل 100 ولادة، يولد نحو 1.7 إلى 2.8 طفل إضافي بحالة خطيرة. ومعظم ذلك من حالات متنحية. والنتيجة السلبية للوحة تخفض جزءاً منه، لا كله.`,
      },
      sources: ['hamamy-2012'],
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
          ar: 'لأنكما أبناء عمومة أو خؤولة من الجهتين، فإن الاحتمال الأساسي أعلى منه لدى الوالدين غير الأقارب، وأعلى منه لدى أبناء العمومة من الدرجة الأولى.',
        }
      : {
          en: 'Because you are related, the background chance is slightly higher than for unrelated parents. It is lower than for first cousins.',
          ar: 'لأنكما قريبان، فإن الاحتمال الأساسي أعلى قليلاً منه لدى الوالدين غير الأقارب، لكنه أقل منه لدى أبناء العمومة من الدرجة الأولى.',
        },
    sources: ['hamamy-2012'],
    arithmetic: `Inbreeding coefficient F = ${F}.`,
  };
}

const PGT_OPTION: FactCard = {
  id: 'option:pgt',
  kind: 'option',
  numbers: {},
  text: {
    en: 'IVF with testing of embryos before pregnancy (PGT). Only embryos without the condition are transferred. The premarital programme refers couples at risk to fertility services.',
    ar: 'أطفال الأنابيب مع فحص الأجنة قبل الحمل (الفحص الجيني قبل الزرع). تُنقل فقط الأجنة غير المصابة. ويربط برنامج فحص ما قبل الزواج الأزواجَ المعرّضين للخطر بخدمات الطب الإنجابي.',
  },
  sources: ['doh-pms-2024'],
};

const PRENATAL_OPTION: FactCard = {
  id: 'option:prenatal',
  kind: 'option',
  numbers: { cvsFrom: { n: '11', d: '1' }, cvsTo: { n: '14', d: '1' }, amnioFrom: { n: '15', d: '1' } },
  text: {
    en: 'Natural pregnancy with a test during pregnancy. A small sample from the placenta at 11 to 14 weeks, or of the fluid around the baby from 15 weeks, shows if the baby is affected.',
    ar: 'حمل طبيعي مع فحص أثناء الحمل. عينة صغيرة من المشيمة بين الأسبوع 11 و14، أو من السائل المحيط بالجنين ابتداءً من الأسبوع 15، تبيّن ما إذا كان الجنين مصاباً.',
  },
  sources: ['nhs-cvs', 'nhs-amniocentesis'],
};

/** For a condition with no early-treatment pathway: planning, not a promise of early care. */
const NEWBORN_OPTION: FactCard = {
  id: 'option:newborn',
  kind: 'option',
  numbers: {},
  text: {
    en: 'Natural pregnancy, with a plan made with a specialist for how the baby is checked after birth.',
    ar: 'حمل طبيعي، مع خطة يضعها مختص لكيفية فحص الطفل بعد الولادة.',
  },
  sources: ['doh-pms-2024'],
};

const TIME_OPTION: FactCard = {
  id: 'option:time',
  kind: 'option',
  numbers: {},
  text: {
    en: 'Taking time. Nothing has to be decided today, and you can talk it through with a genetic counsellor first.',
    ar: 'أخذ الوقت الكافي. لا يلزم اتخاذ أي قرار اليوم، ويمكنكما مناقشة الأمر أولاً مع مستشار وراثي.',
  },
  sources: [],
};

const midSentence = (name: string) => (/^(Krabbe|Pompe)\b/.test(name) ? name : name[0].toLowerCase() + name.slice(1));

/**
 * The options offered to an at-risk couple, in a fixed order. A birth plan is offered only for conditions
 * where testing in the first days lets treatment start early (Condition.birthPlan); otherwise the third
 * option is a newborn check planned with a specialist.
 */
export function optionCards(birthPlan: Condition[]): FactCard[] {
  const third: FactCard = birthPlan.length
    ? {
        id: 'option:birth',
        kind: 'option',
        numbers: {},
        text: {
          en: `Natural pregnancy with a birth plan. The baby is tested for ${birthPlan.map(c => midSentence(c.name.en)).join(' and ')} in the first days, so care can start early if needed.`,
          ar: `حمل طبيعي مع خطة للولادة. يُفحص الطفل بحثاً عن ${birthPlan.map(c => c.name.ar).join(' و')} في أيامه الأولى، فتبدأ الرعاية مبكراً عند الحاجة.`,
        },
        sources: ['doh-pms-2024', ...birthPlan.flatMap(c => c.birthPlan!.sources)].filter((x, i, a) => a.indexOf(x) === i),
      }
    : NEWBORN_OPTION;
  return [PGT_OPTION, PRENATAL_OPTION, third, TIME_OPTION];
}

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
    'first-cousin': { en: 'a first cousin', ar: 'أحد أبناء العمومة أو الخؤولة من الدرجة الأولى' },
    'second-cousin': { en: 'a second cousin', ar: 'أحد أبناء العمومة أو الخؤولة من الدرجة الثانية' },
  };
  return {
    id: `relative:${rel}`,
    kind: 'relative',
    gene,
    numbers: { prior: p.toJSON() },
    text: {
      en: `For ${names[rel].en}, the chance of carrying the same change is about 1 in ${p.oneIn()}.`,
      ar: `بالنسبة إلى ${names[rel].ar}، فإن احتمال أن يحمل التغيّر نفسه يبلغ نحو 1 من ${p.oneIn()}.`,
    },
    sources: ['doh-pms-2024', 'hamamy-2012'],
    arithmetic: 'Coefficient of relationship to a known carrier: a carrier passes the change to each child with chance 1/2 (DoH booklet), so each step through a parent halves it: brother or sister 1/2, aunt or uncle 1/4, first cousin 1/8 (as Hamamy 2012 prints).',
  };
}

export { fmt as formatOneIn, pct as formatPct };

/**
 * Lab side (simulated): builds the couple section each partner receives. Each partner learns the
 * shared genes and, for their own carrier genes, only that the other partner tested negative.
 * `detection` is what the lab states about its tests. When it checked each partner for the other's
 * exact change, that check's sensitivity is recorded for those genes.
 */
export function labCouple(a: PersonResult, b: PersonResult, rel: Relationship, coupleId: string,
  detection?: { panel: Q; exactChange?: Q }): [CoupleSection, CoupleSection] {
  const carriers = (p: PersonResult) => new Map(p.findings.filter(isCarrierFinding).filter(f => PANEL_SET.has(f.gene)).map(f => [f.gene, f]));
  const vus = (p: PersonResult) => new Set(p.findings.filter(f => f.classification === 'VUS').map(f => f.gene));
  const ca = carriers(a), cb = carriers(b), va = vus(a), vb = vus(b);
  const shared = [...ca.keys()].filter(g => cb.has(g)).sort();
  const vusGenes = [...new Set([...va].filter(g => cb.has(g) || vb.has(g)).concat([...vb].filter(g => ca.has(g) || va.has(g))))].sort();
  const status = shared.length ? 'at-risk' : 'compatible';
  const section = (own: Map<string, Finding>, other: Map<string, Finding>, partner: PersonResult): CoupleSection => {
    const partnerNegativeFor = [...own.keys()].filter(g => !other.has(g)).sort();
    const exact = detection?.exactChange;
    return {
      coupleId,
      partnerName: partner.displayName,
      relationship: rel,
      status,
      shared: shared.map(g => ({ gene: g, ownTag: own.get(g)?.tag, partnerTag: other.get(g)?.tag })),
      partnerNegativeFor,
      vusGenes,
      ...(detection ? {
        detection: {
          panel: detection.panel.toJSON(),
          ...(exact && partnerNegativeFor.length ? { exactChange: Object.fromEntries(partnerNegativeFor.map(g => [g, exact.toJSON()])) } : {}),
        },
      } : {}),
    };
  };
  return [section(ca, cb, b), section(cb, ca, a)];
}
