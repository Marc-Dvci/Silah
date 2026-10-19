import { describe, it, expect } from 'vitest';
import { matchIntent } from '../src/core/faq';

// Questions people type in their own words. Each must reach a checked answer without the language model.
describe('typed questions reach a fact card', () => {
  const cases: [string, string][] = [
    ['Will my baby have SMA?', 'chance'],
    ['Can we still have a healthy child?', 'chance'],
    ['Is our child going to be sick?', 'chance'],
    ['Will our children inherit it?', 'chance'],
    ['هل سيصاب طفلنا بالمرض؟', 'chance'],
    ['هل يمكن أن نرزق بطفل سليم؟', 'chance'],
    ['What is SMA?', 'what-is'],
    ['Does compatible mean no risk?', 'compatible'],
    ['If our first child is healthy, is the next one safe?', 'every-pregnancy'],
  ];
  for (const [q, id] of cases) it(q, () => expect(matchIntent(q)?.id).toBe(id));
});

describe('a question that asks for a decision gets every option, never one', () => {
  for (const q of ['Should we do IVF?', 'Should I have a prenatal test?', 'Should we have another baby?', 'What would you do?', 'Is it better to do IVF?', 'هل يجب أن نلجأ إلى أطفال الأنابيب؟', 'ماذا تنصحنا؟']) {
    it(q, () => {
      const it = matchIntent(q);
      expect(it?.id).toBe('options');
      expect(it?.lead?.en).toMatch(/decision is yours/);
      expect(it?.answer).toEqual(['kind:option']);
    });
  }
  it('a question about IVF itself still gets the IVF card', () => expect(matchIntent('What is IVF with embryo testing?')?.id).toBe('pgt'));
});
