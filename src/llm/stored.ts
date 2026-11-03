import type { FactCard, Lang } from '../core/types';
import { cardsKey, verifyExplanation, type Audience, type Explanation } from './explain';
import PRECOMPUTED from './precomputed.json';

// The explanation a phone shows: the one written on this phone for this result, or, for fictional people only,
// the one written when the demo was built (eval/explain.mjs). Either way the verifier runs again on it now,
// against the cards the phone holds, so a stale or edited explanation cannot slip through.

type Stored = { model: string; at: string; sentences: { text: string; cards: string[] }[] };
const PRE = PRECOMPUTED as Record<string, Stored>;

export interface ExplainHolder { id: string; lang: Lang; own: boolean; sampleName?: string; explanations?: Record<string, Explanation> }

export function storedExplanation(h: ExplainHolder, cards: FactCard[], audience: Audience = 'person'): Explanation | undefined {
  const lang: Lang = audience === 'clinician' ? 'en' : h.lang;
  const key = cardsKey(cards);
  const mine = h.explanations?.[`${audience}:${lang}`];
  if (mine && mine.cardsKey === key) return { ...mine, sentences: verifyExplanation(mine.sentences, cards) };
  // Written in advance only for fictional people: the demo family, and the sample reports when read unchanged.
  const sample = h.own && /\(sample\)\s*$/i.test(h.sampleName ?? '');
  const pre = !h.own ? PRE[`${h.id}:${audience}:${lang}`] : sample ? PRE[`sample:${key}:${audience}:${lang}`] : undefined;
  if (!pre) return undefined;
  return { at: pre.at, lang, audience, backend: 'precomputed', model: pre.model, sentences: verifyExplanation(pre.sentences, cards), ms: 0, cardsKey: key, precomputed: true };
}
