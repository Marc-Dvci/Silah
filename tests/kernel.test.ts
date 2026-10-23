import { describe, it, expect } from 'vitest';
import { Q } from '../src/core/fraction';
import { residualCarrier, partnerResidual, bothNegative, atLeastOne, restOfPanel, coupleView, labCouple, optionCards, RELATIVE_PRIOR, relativeCard, AR_OUTCOMES, INBREEDING, SIMULATED_LAB } from '../src/core/kernel';
import { conditionFor } from '../src/core/conditions';
import { carrierFreq, DEFAULT_CARRIER } from '../src/core/frequencies';
import type { PersonResult } from '../src/core/types';
import { PANEL_GENES } from '../src/core/data/panel';

// Hand-calculated grid. Each expected value is worked out in the comment beside it.

const person = (id: string, sex: 'F' | 'M', findings: PersonResult['findings']): PersonResult => ({
  personId: id, displayName: id, sex, findings, panelVersion: 'test', testedAt: '2026-01-01', method: 'premarital',
});

describe('fractions', () => {
  it('reduces and compares exactly', () => {
    expect(Q.of(2, 8).eq(Q.of(1, 4))).toBe(true);
    expect(Q.parse('0.106').toString()).toBe('53/500');
    expect(Q.of(1, 4).add(Q.of(1, 2)).toString()).toBe('3/4');
    expect(Q.of(7, 13948).oneIn()).toBe(2000);   // 13948/7 = 1992.6 → 2 significant figures
  });
});

describe('residual risk', () => {
  it('p = 1/100, d = 9/10 → (1/1000)/(991/1000) = 1/991', () => {
    expect(residualCarrier(Q.of(1, 100), Q.of(9, 10)).toString()).toBe('1/991');
  });

  it('unrelated partner, default p = 1/1000: (1/10000)/(9991/10000) = 1/9991', () => {
    expect(partnerResidual(carrierFreq('XYZ_NOT_ON_PANEL').carrier, 'unrelated', Q.of(9, 10), Q.of(9, 10)).residual.toString()).toBe('1/9991');
  });

  it('first-cousin partner adds the familial prior 1/8, missed only when the check of the exact change misses it', () => {
    // num = 1/8·1/100 + 1/1000·1/10 = 27/20000 ; den = 1 − 99/800 − 9/10000 = 70028/80000 ; residual = 27/17507
    expect(partnerResidual(Q.of(1, 1000), 'first-cousins', Q.of(9, 10), Q.of(99, 100)).residual.toString()).toBe('27/17507');
  });

  it('without a check of the exact change, the familial copy is found only as often as any change in the gene', () => {
    // Fatima, p = 53/500, d = d_x = 9/10: num = 1/80 + 53/5000 = 231/10000 ; den = 1 − 9/80 − 477/5000 = 7921/10000
    // residual = 231/7921 ; affected = 231/31684, about 1 in 140 (1 in 260 when the exact change was checked)
    const r = partnerResidual(Q.parse('0.106'), 'first-cousins', Q.of(9, 10), Q.of(9, 10)).residual.mul(Q.of(1, 4));
    expect(r.toString()).toBe('231/31684');
    expect(r.oneIn()).toBe(140);
  });

  it('is monotonic in the carrier frequency and stays within [0, 1]', () => {
    let prev = Q.zero;
    for (const p of [Q.of(1, 1000), Q.of(1, 100), Q.of(1, 20), Q.of(1, 5), Q.of(1, 2)]) {
      const r = residualCarrier(p, Q.of(9, 10));
      expect(r.cmp(prev)).toBe(1);
      expect(r.cmp(Q.one)).toBe(-1);
      prev = r;
    }
  });
});

describe('both partners negative: shared ancestry', () => {
  it('unrelated partners: r²/4', () => {
    const r = residualCarrier(Q.of(1, 1000), Q.of(9, 10));
    expect(bothNegative(Q.of(1, 1000), Q.of(9, 10), Q.zero).eq(r.mul(r).mul(Q.of(1, 4)))).toBe(true);
  });

  it('first cousins add F times the chance that the copy they share carries a change the panel misses', () => {
    // r = 1/9991, so (1 − F)·r²/4 = 15/16 · 1/399280324 ; shared copy q = 1/2000: (1/20000)/(1 − 9/20000) = 1/19991
    const expected = Q.of(15, 16).mul(Q.of(1, 399280324)).add(Q.of(1, 16).mul(Q.of(1, 19991)));
    expect(bothNegative(Q.of(1, 1000), Q.of(9, 10), INBREEDING['first-cousins']).eq(expected)).toBe(true);
    // The shared-ancestry term is more than 200 times the independent one: assuming independence understated it.
    expect(Q.of(1, 16 * 19991).cmp(Q.of(200, 399280324))).toBe(1);
  });

  it('the default carrier frequency puts untested first cousins at the top of the published added chance', () => {
    // Untested, the panel's share of the added chance for first cousins is F·Σq, q = p/2. Hamamy 2012: 1.7 to 2.8 in 100,
    // given to one decimal. 1 in 1,000 for each gene without a published figure gives 2.8; 1 in 200 would give 9.8.
    const F = INBREEDING['first-cousins'];
    const sumQ = (p: Q) => PANEL_GENES.reduce((acc, g) => acc.add((carrierFreq(g).source === 'assumed' ? p : carrierFreq(g).carrier).mul(Q.of(1, 2))), Q.zero);
    const per100 = (p: Q) => Math.round(F.mul(sumQ(p)).toNumber() * 1000) / 10;
    expect(per100(DEFAULT_CARRIER)).toBe(2.8);
    expect(per100(Q.of(1, 200))).toBe(9.8);
  });

  it('the sum over the rest of the panel agrees with the chance of at least one, to two significant figures', () => {
    const genes = PANEL_GENES.filter(g => g !== 'CYP21A2');
    const F = INBREEDING['first-cousins'], d = Q.of(9, 10);
    const sum = restOfPanel(genes, () => d, F);
    const union = 1 - Math.exp(genes.reduce((a, g) => a + Math.log1p(-bothNegative(carrierFreq(g).carrier, d, F).toNumber()), 0));
    expect(sum.toNumber()).toBeGreaterThanOrEqual(union);
    expect(Math.round(1 / union / 10) * 10).toBe(sum.oneIn());
  });
});

describe('chance of at least one condition', () => {
  it('two shared genes: 1 − (3/4)² = 7/16, not 1/4 + 1/4', () => {
    expect(atLeastOne([Q.of(1, 4), Q.of(1, 4)]).toString()).toBe('7/16');
  });

  it('a couple sharing two genes is told 7 in 16, and the panel figure is not the sum', () => {
    const a = person('A', 'F', [{ gene: 'SMN1', variant: 'x', classification: 'P' }, { gene: 'GAA', variant: 'y', classification: 'P' }]);
    const b = person('B', 'M', [{ gene: 'SMN1', variant: 'x', classification: 'P' }, { gene: 'GAA', variant: 'z', classification: 'P' }]);
    const v = coupleView(a, labCouple(a, b, 'unrelated', 'c', SIMULATED_LAB)[0]);
    const any = v.cards.find(c => c.id === 'couple:any')!;
    expect(Q.from(any.numbers.affected).toString()).toBe('7/16');
    expect(any.text.en).toContain('7 in 16');
    expect(v.panelRisk.cmp(Q.of(7, 16))).toBe(1);
    expect(v.panelRisk.cmp(Q.of(1, 2))).toBe(-1);
  });
});

describe('couple outcomes', () => {
  it('both carriers: 1/4 affected, 1/2 carrier, 1/4 neither, summing to 1', () => {
    const s = AR_OUTCOMES.affected.add(AR_OUTCOMES.carrier).add(AR_OUTCOMES.neither);
    expect(s.eq(Q.one)).toBe(true);
  });

  it('HBB depends on which allele each parent carries', () => {
    expect(conditionFor('HBB', 'HbS', 'HbS').id).toBe('scd');
    expect(conditionFor('HBB', 'HbS', 'b0').id).toBe('sbthal');
    expect(conditionFor('HBB', 'b+', 'HbS').id).toBe('sbthal');
    expect(conditionFor('HBB', 'b0', 'b+').id).toBe('bthal');
    expect(conditionFor('SMN1').id).toBe('sma');
    expect(conditionFor('GALC').birthPlan).toBeDefined();
    expect(conditionFor('ZZZ1').id).toBe('gene:ZZZ1');
  });
});

describe('lab couple section and the person’s view', () => {
  const mariam = person('Mariam', 'F', [
    { gene: 'SMN1', variant: 'exon 7 deletion (1 copy)', classification: 'P' },
    { gene: 'MEFV', variant: 'c.2080A>G', classification: 'P' },
  ]);
  const saeed = person('Saeed', 'M', [
    { gene: 'SMN1', variant: 'exon 7 deletion (1 copy)', classification: 'P' },
    { gene: 'CYP21A2', variant: 'c.293-13C>G', classification: 'P' },
  ]);

  it('each partner learns only the shared gene and their own carrier genes the other tested negative for', () => {
    const [forM, forS] = labCouple(mariam, saeed, 'first-cousins', 'c1');
    expect(forM.status).toBe('at-risk');
    expect(forM.shared.map(s => s.gene)).toEqual(['SMN1']);
    expect(forM.partnerNegativeFor).toEqual(['MEFV']);
    expect(forS.partnerNegativeFor).toEqual(['CYP21A2']);
    // Mariam's section never mentions CYP21A2.
    expect(JSON.stringify(forM)).not.toContain('CYP21A2');
    expect(JSON.stringify(forS)).not.toContain('MEFV');
  });

  it('builds cards for the shared gene, the birth plan and the residual gene', () => {
    const [forM] = labCouple(mariam, saeed, 'first-cousins', 'c1', SIMULATED_LAB);
    const v = coupleView(mariam, forM);
    const ids = v.cards.map(c => c.id);
    expect(ids).toContain('couple:SMN1');
    expect(ids).toContain('condition:sma');
    expect(ids).toContain('birth:sma');
    expect(ids).toContain('residual:MEFV');
    expect(ids).toContain('panel-residual');
    expect(ids).toContain('not-assessed');
    expect(ids).toContain('consanguinity');
    expect(ids).toContain('family-history');
    expect(ids).toContain('option:pgt');
    expect(v.birthPlanConditions.map(c => c.id)).toEqual(['sma']);
    // Panel risk is at least the shared-gene 1/4 and less than 1/4 + 1/100.
    expect(v.panelRisk.cmp(Q.of(1, 4))).toBe(1);
    expect(v.panelRisk.cmp(Q.of(26, 100))).toBe(-1);
  });

  it('a compatible cousin couple is told a residual, never zero', () => {
    const fatima = person('Fatima', 'F', [{ gene: 'CYP21A2', variant: 'c.293-13C>G', classification: 'P' }]);
    const ahmed = person('Ahmed', 'M', [{ gene: 'GJB2', variant: 'c.35delG', classification: 'P' }]);
    const [forF] = labCouple(fatima, ahmed, 'first-cousins', 'c2', SIMULATED_LAB);
    expect(forF.status).toBe('compatible');
    expect(forF.detection!.exactChange!.CYP21A2).toEqual({ n: '99', d: '100' });
    const v = coupleView(fatima, forF);
    const res = v.cards.find(c => c.id === 'residual:CYP21A2')!;
    // CYP21A2 p = 53/500 (0.106). qf = 1/8.
    // num = 1/8·1/100 + 53/500·1/10 = 1/800 + 53/5000 = (25 + 212)/20000 = 237/20000
    // den = 1 − 99/800 − 477/5000 = (40000 − 4950 − 3816)/40000 = 31234/40000
    // residual = 237/20000 · 40000/31234 = 474/31234 = 237/15617 ; affected = 237/62468
    expect(Q.from(res.numbers.partnerResidual).toString()).toBe('237/15617');
    expect(Q.from(res.numbers.affected).toString()).toBe('237/62468');
    expect(res.sources).toContain('lab-detection');
    // The rest of the panel includes a change both inherited from a shared ancestor: about 1 in 390, not 1 in 13,000.
    const rest = v.cards.find(c => c.id === 'panel-residual')!;
    expect(Q.from(rest.numbers.affected).oneIn()).toBe(390);
    expect(rest.text.en).toContain('passed down from an ancestor you share');
    expect(v.panelRisk.eq(atLeastOne([Q.of(237, 62468), Q.from(rest.numbers.affected)]))).toBe(true);
    expect(v.panelRisk.oneIn()).toBe(160);
    expect(v.cards.some(c => c.kind === 'option')).toBe(false);
  });

  it('without the lab’s stated detection, remaining chances are ranges, never one figure', () => {
    const fatima = person('Fatima', 'F', [{ gene: 'CYP21A2', variant: 'c.293-13C>G', classification: 'P' }]);
    const ahmed = person('Ahmed', 'M', [{ gene: 'GJB2', variant: 'c.35delG', classification: 'P' }]);
    const [forF] = labCouple(fatima, ahmed, 'first-cousins', 'c2');
    expect(forF.detection).toBeUndefined();
    const v = coupleView(fatima, forF);
    for (const id of ['residual:CYP21A2', 'panel-residual']) {
      const c = v.cards.find(x => x.id === id)!;
      expect(c.numbers.affected).toBeUndefined();
      expect(c.ranges!.affected).toBeDefined();
      expect(c.sources).toContain('assumption-detection');
      expect(c.text.en).toContain('between about');
    }
    // CYP21A2 at 99% detection: 1 in 1,300; at 80%: 1 in 71.
    expect(v.cards.find(x => x.id === 'residual:CYP21A2')!.text.en).toContain('between about 1 in 1,300 and 1 in 71');
    expect(v.panelRiskRange!.map(x => x.oneIn())).toEqual([1000, 52]);
    expect(v.panelRisk.eq(v.panelRiskRange![1])).toBe(true);
  });

  it('a birth plan is offered only for conditions with an early-treatment pathway', () => {
    // SMA has one: the option names it.
    const [forM] = labCouple(mariam, saeed, 'first-cousins', 'c1', SIMULATED_LAB);
    const sma = coupleView(mariam, forM).cards.filter(c => c.kind === 'option');
    expect(sma.map(c => c.id)).toEqual(['option:pgt', 'option:prenatal', 'option:birth', 'option:time']);
    expect(sma[2].text.en).toContain('tested for spinal muscular atrophy (SMA)');
    // Familial Mediterranean fever has none: a newborn check planned with a specialist, and no birth plan.
    const a = person('A', 'F', [{ gene: 'MEFV', variant: 'x', classification: 'P' }]);
    const b = person('B', 'M', [{ gene: 'MEFV', variant: 'y', classification: 'P' }]);
    const v = coupleView(a, labCouple(a, b, 'unrelated', 'c', SIMULATED_LAB)[0]);
    expect(v.birthPlanConditions).toEqual([]);
    expect(v.cards.filter(c => c.kind === 'option').map(c => c.id)).toEqual(['option:pgt', 'option:prenatal', 'option:newborn', 'option:time']);
    expect(optionCards([])[2].text.en).not.toMatch(/care can start early/);
  });

  it('a VUS routes the couple to a counsellor first', () => {
    const a = person('A', 'F', [{ gene: 'GAA', variant: 'c.1A>G', classification: 'VUS' }]);
    const b = person('B', 'M', [{ gene: 'GAA', variant: 'c.2A>G', classification: 'P' }]);
    const [forA] = labCouple(a, b, 'unrelated', 'c3');
    expect(forA.vusGenes).toEqual(['GAA']);
    expect(coupleView(a, forA).counsellorFirst).toBe(true);
  });

  it('panel residual uses every other panel gene', () => {
    const [forM] = labCouple(mariam, saeed, 'unrelated', 'c1', SIMULATED_LAB);
    const card = coupleView(mariam, forM).cards.find(c => c.id === 'panel-residual')!;
    expect(Number(card.numbers.genes.n)).toBe(PANEL_GENES.length - 2);
  });
});

describe('relatives', () => {
  it('uses the coefficient of relationship', () => {
    expect(RELATIVE_PRIOR.sibling.toString()).toBe('1/2');
    expect(RELATIVE_PRIOR['aunt-uncle'].toString()).toBe('1/4');
    expect(RELATIVE_PRIOR['first-cousin'].toString()).toBe('1/8');
    expect(relativeCard('first-cousin', 'SMN1').text.en).toContain('1 in 8');
  });
});

describe('consanguinity card', () => {
  it('double first cousins are higher than first cousins, second cousins lower', async () => {
    const { consanguinityCard } = await import('../src/core/kernel');
    expect(consanguinityCard('double-first-cousins')!.text.en).toContain('higher than for first cousins');
    expect(consanguinityCard('second-cousins')!.text.en).toContain('lower than for first cousins');
    expect(consanguinityCard('unrelated')).toBeNull();
  });
});
