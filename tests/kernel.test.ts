import { describe, it, expect } from 'vitest';
import { Q } from '../src/core/fraction';
import { residualCarrier, partnerResidual, coupleView, labCouple, RELATIVE_PRIOR, relativeCard, AR_OUTCOMES } from '../src/core/kernel';
import { conditionFor } from '../src/core/conditions';
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

  it('unrelated partner, default p = 1/200: (1/2000)/(1991/2000) = 1/1991', () => {
    expect(partnerResidual('XYZ_NOT_ON_PANEL', 'unrelated').residual.toString()).toBe('1/1991');
  });

  it('first-cousin partner adds the familial prior 1/8 that a direct test detects 99 times in 100', () => {
    // num = 1/8·1/100 + 1/200·1/10 = 7/4000 ; den = 1 − 99/800 − 9/2000 = 6974/8000 ; residual = 7/3487
    expect(partnerResidual('XYZ_NOT_ON_PANEL', 'first-cousins').residual.toString()).toBe('7/3487');
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
    const [forM] = labCouple(mariam, saeed, 'first-cousins', 'c1');
    const v = coupleView(mariam, forM);
    const ids = v.cards.map(c => c.id);
    expect(ids).toContain('couple:SMN1');
    expect(ids).toContain('condition:sma');
    expect(ids).toContain('birth:sma');
    expect(ids).toContain('residual:MEFV');
    expect(ids).toContain('panel-residual');
    expect(ids).toContain('not-assessed');
    expect(ids).toContain('consanguinity');
    expect(ids).toContain('option:pgt');
    expect(v.birthPlanConditions.map(c => c.id)).toEqual(['sma']);
    // Panel risk is at least the shared-gene 1/4 and less than 1/4 + 1/100.
    expect(v.panelRisk.cmp(Q.of(1, 4))).toBe(1);
    expect(v.panelRisk.cmp(Q.of(26, 100))).toBe(-1);
  });

  it('a compatible cousin couple is told a residual, never zero', () => {
    const fatima = person('Fatima', 'F', [{ gene: 'CYP21A2', variant: 'c.293-13C>G', classification: 'P' }]);
    const ahmed = person('Ahmed', 'M', [{ gene: 'GJB2', variant: 'c.35delG', classification: 'P' }]);
    const [forF] = labCouple(fatima, ahmed, 'first-cousins', 'c2');
    expect(forF.status).toBe('compatible');
    const v = coupleView(fatima, forF);
    const res = v.cards.find(c => c.id === 'residual:CYP21A2')!;
    // CYP21A2 p = 53/500 (0.106). qf = 1/8.
    // num = 1/8·1/100 + 53/500·1/10 = 1/800 + 53/5000 = (25 + 212)/20000 = 237/20000
    // den = 1 − 99/800 − 477/5000 = (40000 − 4950 − 3816)/40000 = 31234/40000
    // residual = 237/20000 · 40000/31234 = 474/31234 = 237/15617 ; affected = 237/62468
    expect(Q.from(res.numbers.partnerResidual).toString()).toBe('237/15617');
    expect(Q.from(res.numbers.affected).toString()).toBe('237/62468');
    expect(v.panelRisk.isZero()).toBe(false);
    expect(v.cards.some(c => c.kind === 'option')).toBe(false);
  });

  it('a VUS routes the couple to a counsellor first', () => {
    const a = person('A', 'F', [{ gene: 'GAA', variant: 'c.1A>G', classification: 'VUS' }]);
    const b = person('B', 'M', [{ gene: 'GAA', variant: 'c.2A>G', classification: 'P' }]);
    const [forA] = labCouple(a, b, 'unrelated', 'c3');
    expect(forA.vusGenes).toEqual(['GAA']);
    expect(coupleView(a, forA).counsellorFirst).toBe(true);
  });

  it('panel residual uses every other panel gene', () => {
    const [forM] = labCouple(mariam, saeed, 'unrelated', 'c1');
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
