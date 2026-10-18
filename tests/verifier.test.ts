import { describe, it, expect } from 'vitest';
import { verifyAnswer, extractNumbers, isDirective, parseModelAnswer } from '../src/core/verifier';
import { route } from '../src/core/routes';
import { coupleView, labCouple } from '../src/core/kernel';
import type { PersonResult } from '../src/core/types';

const p = (id: string, f: PersonResult['findings']): PersonResult =>
  ({ personId: id, displayName: id, sex: 'F', findings: f, panelVersion: 't', testedAt: '2026-01-01', method: 'premarital' });
const a = p('A', [{ gene: 'SMN1', variant: 'del', classification: 'P' }]);
const b = p('B', [{ gene: 'SMN1', variant: 'del', classification: 'P' }]);
const cards = coupleView(a, labCouple(a, b, 'first-cousins', 'c')[0]).cards;

const one = (text: string, ids = ['couple:SMN1']) => verifyAnswer({ sentences: [{ text, cards: ids }] }, cards).verdicts[0];

describe('numbers', () => {
  it('reads digits, Arabic-Indic digits and number words, ignoring gene symbols', () => {
    expect(extractNumbers('1 in 4 for SMN1')).toEqual([1, 4]);
    expect(extractNumbers('احتمال ١ من ٤')).toEqual([1, 4]);
    expect(extractNumbers('one in four')).toEqual(expect.arrayContaining([1, 4]));
    expect(extractNumbers('CYP21A2 and HBB')).toEqual([]);
  });

  it('allows numbers that appear on the cited card', () => {
    expect(one('In each pregnancy the chance is 1 in 4.').ok).toBe(true);
    expect(one('That is 25% each time.').ok).toBe(true);
    expect(one('في كل حمل، الاحتمال ١ من ٤.').ok).toBe(true);
  });

  it('blocks a number the card does not contain', () => {
    const v = one('The chance is 1 in 3.');
    expect(v.ok).toBe(false);
    expect(v.reasons).toContain('number');
  });

  it('blocks a sentence with no card or an unknown card', () => {
    expect(one('It is a recessive condition.', []).reasons).toContain('no-card');
    expect(one('It is a recessive condition.', ['made-up']).reasons).toContain('unknown-card');
  });
});

describe('non-directive guard', () => {
  const blocked = [
    'You should not get married.',
    'I recommend you do IVF with PGT.',
    'It is better to avoid having more children.',
    'You must not get pregnant again.',
    'يجب عليكما عدم الزواج.',
    'الأفضل أن تتجنبا الإنجاب.',
    'ننصح بأطفال الأنابيب.',
  ];
  const allowed = [
    'You can talk it through with a genetic counsellor before deciding anything about a pregnancy.',
    'Some couples choose IVF with PGT, others choose a natural pregnancy with a birth plan.',
    'يمكنكما مناقشة الأمر مع المستشار الوراثي قبل اتخاذ أي قرار بشأن الحمل.',
    'The chance is the same in every pregnancy.',
  ];
  for (const s of blocked) it(`blocks: ${s}`, () => expect(isDirective(s)).toBe(true));
  for (const s of allowed) it(`allows: ${s}`, () => expect(isDirective(s)).toBe(false));

  it('blocks certainty about a particular child', () => {
    expect(one('Your baby will have SMA.').reasons).toContain('certainty');
  });
});

describe('model output parsing', () => {
  it('accepts JSON inside a fenced block', () => {
    const a = parseModelAnswer('```json\n{"sentences":[{"text":"Hi","cards":["background"]}]}\n```');
    expect(a?.sentences[0].cards).toEqual(['background']);
  });
  it('rejects text without JSON', () => {
    expect(parseModelAnswer('no json here')).toBeNull();
  });
});

describe('hard routes', () => {
  it('routes distress first, with emergency numbers', () => {
    const r = route('I don\'t want to live anymore');
    expect(r.route).toBe('distress');
    expect(r.urgent).toBe(true);
    expect(r.reply.en).toContain('999');
    expect(route('لا أريد أن أعيش').route).toBe('distress');
  });
  it('routes termination, religion, other people and blame', () => {
    expect(route('Can we terminate the pregnancy?').route).toBe('termination');
    expect(route('هل الإجهاض ممكن؟').route).toBe('termination');
    expect(route('Is IVF halal?').route).toBe('religion');
    expect(route('هل يجوز فحص الأجنة؟').route).toBe('religion');
    expect(route('What was my sister\'s result?').route).toBe('other-person');
    expect(route('ما نتيجة أختي؟').route).toBe('other-person');
    expect(route('Is it my fault?').route).toBe('blame');
    expect(route('هل هذا ذنبي؟').route).toBe('blame');
  });
  it('lets ordinary questions through', () => {
    expect(route('What does carrier mean?').route).toBe('none');
    expect(route('ما معنى أنني حامل للجين؟').route).toBe('none');
  });
});
