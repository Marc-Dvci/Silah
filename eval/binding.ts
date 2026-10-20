// Mutation test for claim binding. Every sentence a model wrote that the verifier showed, and that
// states a chance for a named outcome, is copied with that chance replaced by another number from
// the same cited cards: the number is on the card, so the number check passes it, but it now belongs
// to the wrong outcome ("1 in 4 chance the child is a carrier"). The binding check must block it.
import { Q } from '../src/core/fraction';
import { parseModelAnswer, verifyAnswer, extractClaims, statedOutcomes } from '../src/core/verifier';
import { COUNSELLOR_CARD } from '../src/llm/answer';
import { toAsciiDigits } from '../src/core/text';
import type { FactCard } from '../src/core/types';
import { QUESTIONS } from './questions';
import { cardsFor, type Row } from './bakeoff';

export interface Mutant { model: string; id: string; lang: string; original: string; mutant: string; claim: string; from: number; to: string; numberCheckPasses: boolean; blocked: boolean }

const fmtRatio = (q: Q, lang: string) => `${q.n} ${lang === 'ar' ? 'من' : 'in'} ${q.d}`;

export function mutate(model: string, rows: Row[]): { sentences: number; withClaims: number; claims: number; mutants: Mutant[] } {
  let sentences = 0, withClaims = 0, claims = 0;
  const mutants: Mutant[] = [];
  for (const r of rows) {
    const q = QUESTIONS.find(x => x.id === r.id)!;
    const all: FactCard[] = [...cardsFor(q.persona), COUNSELLOR_CARD];
    const parsed = parseModelAnswer(r.raw);
    if (!parsed) continue;
    const v = verifyAnswer(parsed, all);
    for (const s of v.shown) {
      sentences++;
      const text = toAsciiDigits(s.text);
      const bound = extractClaims(text).filter(c => c.outcome);
      if (!bound.length) continue;
      withClaims++;
      claims += bound.length;
      const cited = s.cards.map(id => all.find(c => c.id === id)).filter((c): c is FactCard => !!c);
      const values = cited.flatMap(statedOutcomes).filter(x => x.value).map(x => x.value!);
      for (const c of bound) {
        // Only ratios are rewritten; the literal must occur once so the swap is unambiguous.
        const m = c.text.match(/^(\d+)\s+(in|من|out of)\s+(?:every\s+|كل\s+)?([\d,]+)$/);
        if (!m || text.split(c.text).length !== 2) continue;
        const seen = new Set<string>();
        for (const x of values) {
          if (Math.abs(x.toNumber() - c.value) / c.value <= 0.05 || x.toNumber() >= 1 || seen.has(x.toString())) continue;
          seen.add(x.toString());
          const mutantText = text.replace(c.text, fmtRatio(x, r.lang));
          const mv = verifyAnswer({ sentences: [{ text: mutantText, cards: s.cards }] }, all).verdicts[0];
          mutants.push({
            model, id: r.id, lang: r.lang, original: s.text, mutant: mutantText, claim: `${c.text} (${c.outcome}, ${c.subject})`,
            from: c.value, to: fmtRatio(x, r.lang),
            numberCheckPasses: !mv.reasons.includes('number'),
            blocked: mv.reasons.includes('binding'),
          });
        }
      }
    }
  }
  return { sentences, withClaims, claims, mutants };
}
