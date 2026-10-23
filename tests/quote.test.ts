import { describe, it, expect } from 'vitest';
import { quoteCards, COUNSELLOR_CARD } from '../src/llm/answer';
import { verifyAnswer } from '../src/core/verifier';
import { route } from '../src/core/routes';
import { coupleView, labCouple, SIMULATED_LAB } from '../src/core/kernel';
import { PERSONAS, demoCouples } from '../src/app/demo';
import { PANEL_VERSION } from '../src/core/data/panel';
import type { PersonResult } from '../src/core/types';

// On a person's phone the model only chooses cards; the person reads each card's fixed words.

const result = (id: string): PersonResult => {
  const p = PERSONAS.find(x => x.id === id)!;
  return { personId: id, displayName: p.name.en, sex: p.sex, findings: p.genome, panelVersion: PANEL_VERSION, testedAt: '2026-01-01', method: 'premarital' };
};
const views = (lab: boolean) => demoCouples().flatMap(c => {
  const [fa, fb] = labCouple(result(c.a), result(c.b), c.rel, c.id, lab ? SIMULATED_LAB : undefined);
  return [{ id: c.a, v: coupleView(result(c.a), fa) }, { id: c.b, v: coupleView(result(c.b), fb) }];
});
const mariam = views(true).find(x => x.id === 'mariam')!.v.cards;

describe('quote mode', () => {
  it('shows the cited cards in their own words, whatever the model wrote', () => {
    const shown = quoteCards({ sentences: [{ text: 'Most affected children walk with early treatment.', cards: ['birth:sma'] }] }, mariam);
    expect(shown.map(c => c.id)).toEqual(['birth:sma']);
    expect(shown[0].text.en).toContain('22 of 25');
  });

  it('a sentence the verifier blocks still brings its card, so blocking never hides a number', () => {
    const answer = { sentences: [{ text: 'Your baby will definitely have SMA, a 1 in 3 chance.', cards: ['couple:SMN1'] }] };
    expect(verifyAnswer(answer, mariam).shown).toEqual([]);
    expect(quoteCards(answer, mariam).map(c => c.id)).toEqual(['couple:SMN1']);
  });

  it('never shows one option alone: choosing one shows all, in their fixed order', () => {
    const shown = quoteCards({ sentences: [{ text: 'You should do IVF.', cards: ['option:pgt'] }] }, mariam);
    expect(shown.map(c => c.id)).toEqual(['option:pgt', 'option:prenatal', 'option:birth', 'option:time']);
  });

  it('an answer that only points to the counsellor shows the counsellor card', () => {
    expect(quoteCards({ sentences: [{ text: 'Ask your counsellor.', cards: ['counsellor'] }] }, mariam)).toEqual([COUNSELLOR_CARD]);
  });

  it('every fixed card passes the same checks a model sentence must pass, with and without the lab’s detection', () => {
    for (const lab of [true, false]) for (const { id, v } of views(lab)) for (const c of v.cards) for (const lang of ['en', 'ar'] as const) {
      const verdict = verifyAnswer({ sentences: [{ text: c.text[lang], cards: [c.id] }] }, v.cards).verdicts[0];
      expect(verdict.ok, `${id} ${lab ? 'lab' : 'range'} ${c.id} ${lang}: ${verdict.reasons} ${verdict.badNumbers ?? ''} ${verdict.badClaims ?? ''}`).toBe(true);
    }
  });
});

describe('a request for a person', () => {
  it('the distress reply never says a person has been reached', () => {
    const r = route('I can’t go on');
    for (const text of [r.reply.en, r.reply.ar, r.reply.arM!]) {
      expect(text).toMatch(/999/);
      expect(text).not.toMatch(/asked your counsellor|will call|contact you today|طلبنا من مستشار|اليوم\./);
    }
  });
});
