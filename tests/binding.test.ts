import { describe, it, expect } from 'vitest';
import { verifyAnswer, extractClaims } from '../src/core/verifier';
import { coupleView, labCouple, relativeCard, SIMULATED_LAB } from '../src/core/kernel';
import { PANEL_GENES } from '../src/core/data/panel';
import { Q } from '../src/core/fraction';
import type { FactCard, PersonResult } from '../src/core/types';

// A number can be on the card and still be attached to the wrong outcome. These tests check that
// every chance in a model sentence is the one the cited card gives for that outcome and that person.

const p = (id: string, sex: 'F' | 'M', f: PersonResult['findings']): PersonResult =>
  ({ personId: id, displayName: id, sex, findings: f, panelVersion: 't', testedAt: '2026-01-01', method: 'premarital' });
const carrierOf = (id: string, sex: 'F' | 'M', ...genes: string[]) => p(id, sex, genes.map(gene => ({ gene, variant: 'x', classification: 'P' as const })));

// Mariam & Saeed share SMN1; Fatima carries CYP21A2 and Ahmed tested negative for it.
const shared = (() => { const a = carrierOf('A', 'F', 'SMN1'), b = carrierOf('B', 'M', 'SMN1'); return coupleView(a, labCouple(a, b, 'first-cousins', 'c1', SIMULATED_LAB)[0]).cards; })();
const residual = (() => { const a = carrierOf('F', 'F', 'CYP21A2'), b = carrierOf('H', 'M'); return coupleView(a, labCouple(a, b, 'first-cousins', 'c2', SIMULATED_LAB)[0]).cards; })();

const check = (cards: FactCard[], text: string, ids: string[]) => verifyAnswer({ sentences: [{ text, cards: ids }] }, cards).verdicts[0];
const passes = (cards: FactCard[], text: string, ids: string[]) => expect(check(cards, text, ids).ok, text).toBe(true);
const misbound = (cards: FactCard[], text: string, ids: string[]) => {
  const v = check(cards, text, ids);
  expect(v.reasons, text).toContain('binding');
  expect(v.reasons, `${text}: the number check alone would have passed it`).not.toContain('number');
};

describe('claim binding: the card itself', () => {
  // Every couple card states three outcomes. Its own text passes; every way of swapping the three
  // values between outcomes that changes at least one of them is blocked, in both languages.
  const genes = ['SMN1', 'HBB', 'CYP21A2', 'GAA', 'MEFV', PANEL_GENES.find(g => !['SMN1', 'HBB', 'CYP21A2', 'GAA', 'MEFV'].includes(g))!];
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const gene of genes) for (const lang of ['en', 'ar'] as const) {
    it(`${gene} · ${lang}`, () => {
      const a = carrierOf('A', 'F', gene), b = carrierOf('B', 'M', gene);
      const cards = coupleView(a, labCouple(a, b, 'unrelated', 'c', SIMULATED_LAB)[0]).cards;
      const card = cards.find(c => c.id === `couple:${gene}`)!;
      const text = card.text[lang];
      passes(cards, text, [card.id]);
      const claims = extractClaims(text);
      expect(claims.map(c => c.outcome)).toEqual(['affected', 'carrier', 'neither']);
      const lits = lang === 'ar' ? ['1 من 4', '2 من 4', '1 من 4'] : ['1 in 4', '2 in 4', '1 in 4'];
      for (const perm of perms) {
        const values = perm.map(i => lits[i]);
        if (values.every((v, i) => v === lits[i])) continue;
        let k = 0;
        const mutant = text.replace(lang === 'ar' ? /\d من 4/g : /\d in 4/g, () => values[k++]);
        misbound(cards, mutant, [card.id]);
      }
    });
  }
});

describe('claim binding: sentences a model could write', () => {
  const ids = ['couple:SMN1', 'condition:sma'];
  const right = [
    'There is a 1 in 4 chance in each pregnancy that the child has SMA.',
    'In each pregnancy, the chance that the child is a healthy carrier is 2 in 4.',
    'There is a 1 in 2 chance that a child is a carrier, like both of you.',
    'There is a 3 in 4 chance that the child will not have SMA.',
    'Half of your children, on average, would be healthy carriers.',
    'There is a 1 in 4 chance the child carries neither change.',
    'That is a 25% chance of an affected child in each pregnancy.',
    'The chance is the same in every pregnancy: 1 in 4.',
    'في كل حمل، هناك احتمال 1 من 4 أن يكون الطفل مصاباً بضمور العضلات الشوكي.',
    'احتمال أن يكون الطفل حاملاً سليماً هو 2 من 4 في كل حمل.',
    'هناك احتمال 3 من 4 ألا يكون الطفل مصاباً.',
    'هناك احتمال ١ من ٤ ألا يحمل الطفل أي تغيّر.',
  ];
  const wrong = [
    'There is a 1 in 4 chance the child is a carrier.',                 // the reviewer's example
    'There is a 1 in 2 chance that the child has SMA.',
    'There is a 2 in 4 chance that the child will be affected.',
    'There is a 1 in 4 chance that the child will not have SMA.',
    'There is a 1 in 2 chance the child carries neither change.',
    'Each of you has a 1 in 2 chance of being a carrier.',              // the parents are known carriers
    'That is a 50% chance of an affected child in each pregnancy.',
    'In each pregnancy, the chance is 1 in 2.',                         // a bare per-pregnancy chance is for an affected child
    'في كل حمل، هناك احتمال 1 من 4 أن يكون الطفل حاملاً للتغيّر.',
    'هناك احتمال 2 من 4 أن يكون الطفل مصاباً.',
    'هناك احتمال 1 من 4 ألا يكون الطفل مصاباً.',
    'الاحتمال في كل حمل هو 2 من 4.',
  ];
  for (const s of right) it(`passes: ${s}`, () => passes(shared, s, ids));
  for (const s of wrong) it(`blocks: ${s}`, () => misbound(shared, s, ids));
});

describe('claim binding: residual, relatives and background', () => {
  const card = residual.find(c => c.id === 'residual:CYP21A2')!;
  const affected = Q.from(card.numbers.affected).oneIn().toLocaleString('en-US');
  const partner = Q.from(card.numbers.partnerResidual).oneIn().toLocaleString('en-US');

  it('a per-pregnancy chance must be the affected chance, not the partner\'s chance of still carrying', () => {
    passes(residual, `For CYP21A2 the chance is about 1 in ${affected} per pregnancy, even though your partner tested negative.`, [card.id]);
    passes(residual, `The chance that your partner still carries a change in CYP21A2 is about 1 in ${partner}.`, [card.id]);
    misbound(residual, `For CYP21A2 the chance is about 1 in ${partner} per pregnancy.`, [card.id]);
    misbound(residual, `There is about a 1 in ${partner} chance the child has the condition.`, [card.id]);
    misbound(residual, `The chance that your partner still carries a change is about 1 in ${affected}.`, [card.id]);
  });

  it('a relative\'s chance of carrying is a carrier chance', () => {
    const rel = [relativeCard('sibling', 'SMN1'), relativeCard('first-cousin', 'SMN1')];
    passes(rel, 'A brother or sister has a 1 in 2 chance of carrying the same change.', ['relative:sibling']);
    passes(rel, 'For a first cousin, the chance of carrying the same change is about 1 in 8.', ['relative:first-cousin']);
    misbound(rel, 'A first cousin has a 1 in 2 chance of carrying the same change.', ['relative:sibling', 'relative:first-cousin']);
  });

  it('the background chance is for a baby born with a birth defect', () => {
    passes(shared, 'For any couple, about 1 in 33 babies is born with a birth defect.', ['background']);
    misbound(shared, 'About 1 in 33 people are carriers.', ['background']);
  });

  it('a chance with no outcome or person named is left to the number check', () => {
    expect(extractClaims('That is 25% each time.')[0].outcome).toBeNull();
    passes(shared, 'That is 25% each time.', ['couple:SMN1']);
  });

  it('blocks a sentence that says carriers are ill, and passes the cards that say they are not', () => {
    for (const s of [
      'Carriers are usually ill with a mild form of SMA.',
      'Being a carrier means you are affected too.',
      'Carriers have a mild form of the condition.',
      'الحامل للتغير مريض أيضاً.',
      'حاملو التغيّر مصابون بشكل خفيف.',
    ]) expect(check(shared, s, ['condition:sma']).reasons, s).toContain('binding');
    for (const c of shared.concat(residual).filter(c => c.kind === 'condition' || c.kind === 'carrier')) for (const lang of ['en', 'ar'] as const) {
      expect(check(shared.concat(residual), c.text[lang], [c.id]).ok, c.text[lang]).toBe(true);
    }
    passes(shared, 'Carriers are healthy and do not have the condition.', ['condition:sma']);
    passes(shared, 'Being a carrier does not make you ill.', ['condition:sma']);
  });

  it('does not read "percentage points" as a percent', () => {
    expect(extractClaims('about 1.7 to 2.8 percentage points higher')).toEqual([]);
  });
});
