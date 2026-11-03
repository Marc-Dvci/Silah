import type { FactCard, Lang } from '../core/types';
import { Q } from '../core/fraction';
import { canonicalJson, sha256Hex } from '../core/crypto/sign';
import { parseModelAnswer, verifyAnswer } from '../core/verifier';
import { COUNSELLOR_CARD, type Backend, type ChatMessage } from './answer';

// A plain-language explanation of a person's own result, written by a language model and shown only where the
// verifier passes it. The model writes; the verifier decides, sentence by sentence, with the same rules as for
// answers (cites a card, uses only that card's numbers, binds each chance to its outcome and person, does not
// steer, states no certainty about a child). A blocked sentence is not shown; the fixed, checked text of every
// card stays on the same page, so nothing the person needs depends on the model.

export type Audience = 'person' | 'clinician';

export interface ExplainedSentence { text: string; cards: string[]; ok: boolean; reasons?: string[] }

export interface Explanation {
  at: string;
  lang: Lang;
  audience: Audience;
  backend: string;
  model: string;
  sentences: ExplainedSentence[];
  ms: number;
  /** Hash of the cards the explanation was written from. A change in the result makes it stale. */
  cardsKey: string;
  /** Written when the demo was built (fictional people only), re-checked on the phone when shown. */
  precomputed?: boolean;
}

const KINDS = new Set<FactCard['kind']>(['couple-gene', 'condition', 'carrier', 'residual-gene', 'residual-panel', 'uncertainty', 'vus', 'not-assessed', 'consanguinity', 'birth-plan']);

/** The cards an explanation may use. Options and relatives' chances are left to their own pages and the counsellor. */
export function explainCards(cards: FactCard[]): FactCard[] {
  return cards.filter(c => KINDS.has(c.kind) || c.id === 'family-history');
}

export function cardsKey(cards: FactCard[]): string {
  return sha256Hex(canonicalJson(explainCards(cards).map(c => ({ id: c.id, numbers: c.numbers, ranges: c.ranges ?? null })))).slice(0, 16);
}

export function composeExplain(cards: FactCard[], lang: Lang, audience: Audience = 'person', sex?: 'F' | 'M', redact: string[] = []): ChatMessage[] {
  const all = [...explainCards(cards), COUNSELLOR_CARD];
  // Names are replaced before anything leaves the phone for the explanation service.
  const hide = (x: string) => redact.filter(n => n && n.length > 1).reduce((t, n) => t.split(n).join(lang === 'ar' ? 'الطرف الآخر' : 'your partner'), x);
  const list = all.map(c => {
    const nums = Object.entries(c.numbers).map(([k, v]) => `${k}=${Q.from(v).toString()}`).join(', ');
    const ranges = Object.entries(c.ranges ?? {}).map(([k, [a, b]]) => `${k}=${Q.from(a)}..${Q.from(b)}`).join(', ');
    return `- id: ${c.id}\n  text: ${hide(c.text[lang === 'ar' && sex === 'M' && c.text.arM ? 'arM' : lang] ?? c.text[lang])}${nums ? `\n  numbers: ${nums}` : ''}${ranges ? `\n  ranges: ${ranges}` : ''}`;
  }).join('\n');
  const language = lang === 'ar' ? `Modern Standard Arabic${sex ? `, addressing ${sex === 'F' ? 'a woman' : 'a man'}` : ''}` : 'English';
  const person = [
    'You are Silah. Explain this person\'s own premarital or preconception genetic result to them in plain words, as a kind and careful genetic counsellor would.',
    'You may only use the FACT CARDS below. They were computed for this person and checked.',
    'Rules:',
    `1. Reply in ${language}. Use short everyday words a 12-year-old understands. If you must use a medical word, say what it means in the same sentence.`,
    '2. Output JSON only, in the form {"sentences":[{"text":"...","cards":["card-id"]}]}. No other text.',
    '3. Write 5 to 8 sentences, each at most 25 words, in this order: what was found for the couple; what it means in each pregnancy; what does not change (a carrier is healthy); what is still uncertain and why (how well the test finds changes, figures that are assumed, what the test cannot see); and that the genetic counsellor can talk it through.',
    '4. Every sentence must list the id of at least one card it is based on, in the "cards" field only. Never mention cards, ids or "fact cards" in the text.',
    '5. Use only numbers that appear on the cards you cite, written the same way ("1 in 4", "95%"). Do not compute, round or combine numbers.',
    '6. Never tell the person what to decide about marriage, pregnancy, IVF, embryo testing or ending a pregnancy.',
    '7. Never say a particular child will or will not be affected. Speak about chances in each pregnancy.',
    '8. Do not blame anyone. Do not mention religion.',
    ...(lang === 'ar' ? [
      `9. Arabic grammar: speak to the reader in the second person ${sex === 'M' ? 'masculine (أنتَ، لديكَ، تحملُ)' : 'feminine (أنتِ، لديكِ، تحملين)'}; when you speak about the couple use the dual: أنتما، لديكما، تحملان، كلاكما (never أنتم). Write the gene names in Latin letters as on the cards.`,
    ] : []),
  ];
  const clinician = [
    'You are Silah. Write a short summary of this patient\'s result for the genetic counsellor or physician who will see them.',
    'You may only use the FACT CARDS below. They were computed for this patient and checked.',
    'Rules:',
    '1. Reply in English, in plain clinical language.',
    '2. Output JSON only, in the form {"sentences":[{"text":"...","cards":["card-id"]}]}. No other text.',
    '3. Write 3 to 5 sentences, each at most 30 words: the couple result and the shared genes; the chances per pregnancy; the main uncertainties (detection, assumed frequencies, findings of uncertain significance); anything a specialist should see first.',
    '4. Every sentence must list the id of at least one card it is based on, in the "cards" field only.',
    '5. Use only numbers that appear on the cards you cite. Do not compute, round or combine numbers.',
    '6. Do not recommend a reproductive decision. Do not state that a child will or will not be affected.',
  ];
  const system = [...(audience === 'person' ? person : clinician), '', 'FACT CARDS:', list].join('\n');
  const user = audience === 'person'
    ? (lang === 'ar' ? 'اشرح لي نتيجتي بكلمات بسيطة، وما الذي ما زال غير مؤكد فيها.' : 'Please explain my result in plain words, including what is still uncertain.')
    : 'Summarise this result for the clinician.';
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}

/** Run the verifier on an explanation's sentences against the cards the person has now. */
export function verifyExplanation(sentences: { text: string; cards: string[] }[], cards: FactCard[]): ExplainedSentence[] {
  const v = verifyAnswer({ sentences }, [...explainCards(cards), COUNSELLOR_CARD]);
  return v.verdicts.map(x => ({ text: x.sentence.text, cards: x.sentence.cards, ok: x.ok, reasons: x.ok ? undefined : x.reasons }));
}

export async function explain(backend: Backend, cards: FactCard[], lang: Lang, audience: Audience = 'person', sex?: 'F' | 'M', redact: string[] = []): Promise<Explanation> {
  const t0 = performance.now();
  const raw = await backend.generate(composeExplain(cards, lang, audience, sex, redact), { maxTokens: 900, maxSentences: 8 });
  const parsed = parseModelAnswer(raw);
  if (!parsed || !parsed.sentences.length) throw new Error('unreadable');
  return {
    at: new Date().toISOString(),
    lang,
    audience,
    backend: backend.name,
    model: backend.model ?? backend.name,
    sentences: verifyExplanation(parsed.sentences.slice(0, 8), cards),
    ms: Math.round(performance.now() - t0),
    cardsKey: cardsKey(cards),
  };
}

/** What the person sees: passing sentences, in order. Fewer than two passing sentences shows none. */
export function shown(e: Explanation): ExplainedSentence[] {
  const ok = e.sentences.filter(s => s.ok);
  return ok.length >= 2 ? ok : [];
}

// ---------- the opt-in explanation service ----------

/** Workers AI behind the Silah relay. Only the cards are sent: numbers, gene names and fixed text, never a name. */
export function cloudBackend(base: string): Backend {
  return {
    name: 'the Silah explanation service (Gemma on Cloudflare Workers AI)',
    model: 'Gemma 3 12B (Cloudflare Workers AI)',
    async generate(messages, opts = {}) {
      const r = await fetch(`${base}/v1/explain`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages, max_tokens: opts.maxTokens ?? 700 }),
        signal: AbortSignal.timeout(45000),
      });
      if (!r.ok) throw new Error(`service ${r.status}`);
      const j = await r.json();
      if (j.model) this.model = String(j.model);
      return String(j.content ?? '');
    },
  };
}
