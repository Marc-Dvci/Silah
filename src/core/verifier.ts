import { Q } from './fraction';
import type { FactCard } from './types';
import { normalize, toAsciiDigits } from './text';

// The verifier stands between the language model and the person. A sentence is shown only if
// it cites at least one fact card it was given, every number in it appears on a cited card,
// it does not steer a reproductive or marriage decision, and it does not state a diagnosis.

export interface ModelSentence { text: string; cards: string[] }
export interface ModelAnswer { sentences: ModelSentence[] }

export type BlockReason = 'no-card' | 'unknown-card' | 'number' | 'directive' | 'certainty' | 'empty';
export interface Verdict { sentence: ModelSentence; ok: boolean; reasons: BlockReason[]; badNumbers?: string[] }

const EN_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  half: 0.5, quarter: 0.25, third: 1 / 3, twice: 2, double: 2,
};
const AR_WORDS: Record<string, number> = {
  'واحد': 1, 'واحده': 1, 'اثنين': 2, 'اثنان': 2, 'اثنتين': 2, 'ثلاث': 3, 'ثلاثه': 3, 'اربع': 4, 'اربعه': 4,
  'خمس': 5, 'خمسه': 5, 'نصف': 0.5, 'ربع': 0.25, 'ثلث': 1 / 3,
};

/** Remove tokens that contain digits but are not quantities: gene symbols (SMN1), HGVS (c.123A>G). */
function stripNonQuantities(s: string): string {
  return s
    .replace(/\bc\.[^\s,;]+/g, ' ')
    .replace(/\b[A-Z][A-Z0-9-]*[0-9][A-Z0-9-]*\b/g, ' ');
}

/** Every quantity mentioned, as numbers. */
export function extractNumbers(text: string): number[] {
  const t = stripNonQuantities(toAsciiDigits(text));
  const out: number[] = [];
  for (const m of t.matchAll(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)/g)) out.push(Number(m[1].replace(/,/g, '')));
  const n = normalize(t);
  for (const [w, v] of Object.entries(EN_WORDS)) if (new RegExp(`\\b${w}\\b`).test(n)) out.push(v);
  for (const [w, v] of Object.entries(AR_WORDS)) if (new RegExp(`(^|[\\s،,.])(ال)?${w}($|[\\s،,.])`).test(n)) out.push(v);
  return out;
}

/** The set of numbers a sentence citing these cards may use. */
export function allowedNumbers(cards: FactCard[]): Set<string> {
  const allowed = new Set<string>();
  const add = (x: number) => {
    if (!isFinite(x)) return;
    allowed.add(String(round(x, 4)));
  };
  const addQ = (q: Q) => {
    add(Number(q.n)); add(Number(q.d)); add(q.toNumber()); add(q.oneIn());
    const p = q.toNumber() * 100;
    add(Math.round(p)); add(round(p, 1)); add(round(p, 2));
    // "2 in 4" style restatements of simple fractions
    add(Number(q.n) * 2); add(Number(q.d) * 2);
  };
  for (const c of cards) {
    for (const v of Object.values(c.numbers)) addQ(Q.from(v));
    for (const [a, b] of Object.values(c.ranges ?? {})) { addQ(Q.from(a)); addQ(Q.from(b)); }
  }
  // Counting words that carry no quantity of their own ("one of you", "both")
  add(1); add(2);
  return allowed;
}

const round = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

// Decision topics a sentence must never steer.
const EN_DECISION = /\b(marr(y|ied|iage)|wedding|engage(d|ment)|divorc|separat|conceiv|get(ting)? pregnant|pregnan|hav(e|ing) (a |another |more )?(child|children|baby|babies|kids)|ivf|pgt|embryo|terminat|abort|end (the|a|your) pregnancy|cancel)/;
const EN_STEER = /\b(you (should|must|need to|have to|ought to)|(should|must) (not|n't)|shouldn't|mustn't|i (would )?(recommend|advise|suggest)|we (recommend|advise|suggest)|(it is|it's) (best|better|wise|safer)|you'?d better|better (not )?to|don'?t|do not|avoid|never)\b/;
const AR_DECISION = /(زواج|الزواج|تتزوج|يتزوج|تتزوجا|الخطوبه|خطوبه|طلاق|الطلاق|انفصال|الانجاب|انجاب|تنجب|تنجبا|الحمل|حمل|تحمل|تحملي|اطفال|طفل|الاجنه|اجنه|اطفال الانابيب|الاجهاض|اجهاض|انهاء الحمل|الغاء)/;
const AR_STEER = /(يجب|ينبغي|عليكما|عليكم|عليك|لابد|لا بد|انصح|ننصح|نوصي|اوصي|الافضل|من الافضل|من الاحسن|الاحسن|لا تتزوج|لا تنجب|تجنب|تجنبا|لا تحمل)/;

// Pointing to a professional or to the standard next step is allowed.
const EN_REFERRAL = /\b(counsell?or|genetic counsell?ing|geneticist|doctor|clinic|physician|specialist)\b/;
const AR_REFERRAL = /(مستشار|الاستشاره|استشاره|الطبيب|طبيب|العياده|عياده|اخصائي|مختص)/;

// Certainty about a particular child, with no probability attached.
const EN_CERTAIN = /\b(your (baby|child|son|daughter) (will|is going to) (have|be born with|be affected|be sick|be ill)|will definitely|is certain to|100 ?%)\b/;
const AR_CERTAIN = /(سيصاب|سيكون مصابا|سيولد مصابا|سيولد مريضا|مؤكد ان|بالتاكيد سي)/;

export function isDirective(text: string): boolean {
  const n = normalize(text);
  const decision = EN_DECISION.test(n) || AR_DECISION.test(n);
  const steer = EN_STEER.test(n) || AR_STEER.test(n);
  if (!decision || !steer) return false;
  // "You can talk it through with your counsellor before deciding about a pregnancy" is fine;
  // a steer whose object is the referral, not the decision, is allowed only if no steer verb
  // directly precedes a decision word.
  const referral = EN_REFERRAL.test(n) || AR_REFERRAL.test(n);
  if (referral && !steersDecisionDirectly(n)) return false;
  return true;
}

function steersDecisionDirectly(n: string): boolean {
  const en = /(should|must|need to|have to|recommend|advise|suggest|best|better|don'?t|do not|avoid|never)\s+(\w+\s+){0,3}(marr|wed|divorc|conceiv|get pregnant|hav(e|ing) (a |another |more )?(child|children|baby|kids)|ivf|pgt|terminat|abort|end the pregnancy|cancel)/;
  const ar = /(يجب|ينبغي|عليكما|عليكم|عليك|لا بد|لابد|انصح|ننصح|نوصي|الافضل|تجنب|لا)\s+(\S+\s+){0,3}(الزواج|تتزوج|الانجاب|تنجب|الحمل|تحمل|الاجهاض|انهاء الحمل|اطفال الانابيب|الطلاق|الغاء)/;
  return en.test(n) || ar.test(n);
}

export function isCertainty(text: string): boolean {
  const n = normalize(text);
  return EN_CERTAIN.test(n) || AR_CERTAIN.test(n);
}

export function verifySentence(s: ModelSentence, cards: Map<string, FactCard>): Verdict {
  const reasons: BlockReason[] = [];
  if (!s.text || !s.text.trim()) return { sentence: s, ok: false, reasons: ['empty'] };
  if (!s.cards || s.cards.length === 0) reasons.push('no-card');
  const cited = (s.cards ?? []).map(id => cards.get(id));
  if (cited.some(c => !c)) reasons.push('unknown-card');
  const ok = cited.filter((c): c is FactCard => !!c);
  const allowed = allowedNumbers(ok);
  const bad = extractNumbers(s.text).filter(x => !allowed.has(String(round(x, 4))));
  if (bad.length) reasons.push('number');
  if (isDirective(s.text)) reasons.push('directive');
  if (isCertainty(s.text)) reasons.push('certainty');
  return { sentence: s, ok: reasons.length === 0, reasons, badNumbers: bad.length ? bad.map(String) : undefined };
}

export interface VerifiedAnswer { shown: ModelSentence[]; blocked: Verdict[]; verdicts: Verdict[] }

export function verifyAnswer(a: ModelAnswer, cards: FactCard[]): VerifiedAnswer {
  const byId = new Map(cards.map(c => [c.id, c]));
  const verdicts = (a.sentences ?? []).slice(0, 8).map(s => verifySentence(s, byId));
  return { shown: verdicts.filter(v => v.ok).map(v => v.sentence), blocked: verdicts.filter(v => !v.ok), verdicts };
}

/** Tolerant parser for model output: accepts a JSON object, or a JSON object inside a fenced block. */
export function parseModelAnswer(raw: string): ModelAnswer | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const j = JSON.parse(m[0]);
    if (!Array.isArray(j.sentences)) return null;
    return {
      sentences: j.sentences
        .filter((s: unknown) => s && typeof (s as ModelSentence).text === 'string')
        .map((s: ModelSentence) => ({ text: s.text, cards: Array.isArray(s.cards) ? s.cards.map(String) : [] })),
    };
  } catch {
    return null;
  }
}
