import { Q } from './fraction';
import type { FactCard } from './types';
import { normalize, toAsciiDigits } from './text';
import { CONDITIONS } from './conditions';

// The verifier stands between the language model and the person. A sentence is shown only if
// it cites at least one fact card it was given, every number in it appears on a cited card,
// every chance it states is the one a cited card gives for that outcome and that person,
// it does not steer a reproductive or marriage decision, and it does not state a diagnosis.

export interface ModelSentence { text: string; cards: string[] }
export interface ModelAnswer { sentences: ModelSentence[] }

export type BlockReason = 'no-card' | 'unknown-card' | 'number' | 'binding' | 'directive' | 'certainty' | 'empty';
export interface Verdict { sentence: ModelSentence; ok: boolean; reasons: BlockReason[]; badNumbers?: string[]; badClaims?: string[] }

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

// ── Claim binding ────────────────────────────────────────────────────────────────────────────
// A number can be on the card and still be wrong: "a 1 in 4 chance the child is a carrier" uses
// the card's 1 in 4, but the card gives 1 in 4 for an affected child and 2 in 4 for a carrier.
// Each chance in a sentence is read as (value, outcome, whose outcome) and must equal the value a
// cited card gives for that outcome and that person.

// 'defect' is the background chance of a birth defect from any cause, kept apart from the panel's conditions so a
// figure cannot move between the two ("1 in 33 for the other panel genes").
export type Outcome = 'affected' | 'unaffected' | 'carrier' | 'neither' | 'defect';
export type Subject = 'child' | 'adult' | 'any';
export interface Claim { text: string; value: number; parts: number[]; pct?: number; outcome: Outcome | null; subject: Subject }
interface Stated { outcome: Outcome; subject: Subject; value?: Q; range?: [Q, Q]; relative?: string }

const EN_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, hundred: 100 };
const AR_NUM: Record<string, number> = {
  'واحد': 1, 'واحده': 1, 'اثنين': 2, 'اثنان': 2, 'اثنتين': 2, 'ثلاث': 3, 'ثلاثه': 3, 'اربع': 4, 'اربعه': 4,
  'خمس': 5, 'خمسه': 5, 'عشر': 10, 'عشره': 10, 'مئه': 100, 'مائه': 100,
};
const NUM = `(\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?|${Object.keys(EN_NUM).join('|')}|${Object.keys(AR_NUM).join('|')})`;
const toNum = (s: string) => EN_NUM[s] ?? AR_NUM[s] ?? Number(s.replace(/,/g, ''));

// "1 in 4", "one in every four", "1 out of 4", "1 من 4", "1 من كل 4"
const RATIO = new RegExp(`(?<![\\w.])${NUM}\\s+(?:in|out of|من)\\s+(?:every\\s+|كل\\s+)?${NUM}(?!\\w|\\.\\d)`, 'g');
const PERCENT = /(?<![\w.])(\d+(?:\.\d+)?)\s*(%|٪|percent(?!age)|per cent|في المئه|في المائه|بالمئه|بالمائه)/g;
const WORD_FRACTION: [RegExp, number][] = [
  [/\bthree quarters\b|ثلاثه ارباع/g, 3 / 4],
  [/\b(a|one) quarter\b|(^|\s)(ال)?ربع(?=\s|$)/g, 1 / 4],
  [/\bhalf\b(?!-)|(^|\s)(ال)?نصف(?=\s|$)/g, 1 / 2],
];

const conditionTerms = CONDITIONS.flatMap(c => {
  const en = normalize(c.name.en);
  const abbr = en.match(/\(([^)]+)\)/)?.[1];
  return [en.replace(/\s*\([^)]*\)/, ''), abbr, normalize(c.name.ar)].filter((x): x is string => !!x);
}).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

// Each outcome's phrases. When two match at the same place, the longer wins ("healthy carrier" is
// a carrier, "not affected" is unaffected).
const OUTCOME_TERMS: [Outcome, RegExp][] = [
  ['defect', /\b((affected by|born with|ha(ve|s|ving)) (a |an )?)?birth defects?\b|((لل|ل|ب|ال)?اصابه\S* |يولد\S* )?(ب)?عيب\S* خلقي\S*|(ال)?عيوب (ال)?خلقيه/g],
  ['neither', /\b(carr(y|ies|ying) neither|neither change|neither (copy|variant)|not (be )?a carrier|non-?carrier|(does not|doesn't|will not|won't|not) carry|carr(y|ies|ying) no change|no change at all)\b|(ا|ال)?لا يحمل|لن يحمل|غير حامل\S*|لا يكون حاملا/g],
  ['carrier', /\b(healthy carriers?|carriers?|carr(y|ies|ying))\b|حامل\S* و?سليم\S*|سليم\S* و?حامل\S*|حامل\S*|(^|\s)(ي|ت)حمل(ان|ون|ه|ها)?(?=\s|$)/g],
  ['unaffected', /\b(unaffected|not (be )?affected|(does not|doesn't|will not|won't|would not|not) (have|get|develop|be born with)( it| the condition)?|free of (it|the condition)|healthy)\b|غير مصاب\S*|(الا|لا|لن) (يصاب|تصاب)|(الا|لا|لن) (يكون|تكون)( \S+){0,2} مصاب\S*|سليم\S*|معافي/g],
  ['affected', new RegExp(`\\b(affected|ill|sick|illness|disease|disorder|condition|born with|symptoms)\\b|${conditionTerms.join('|')}|مصاب\\S*|يصاب|سيصاب|(ال|ل|ب)?اصابه\\S*|مريض\\S*|(ال)?مرض\\S*|بالحاله|حاله وراثيه|حاله خطيره`, 'g')],
];
const CHILD_TERMS = /\b(child|children|baby|babies|son|daughter|kids?|pregnanc(y|ies)|embryos?|fetus|births?)\b|(^|\s)(ال)?(طفل|اطفال|جنين|اجنه|مولود|ولاده|حمل)\S*|يولد/;
const ADULT_TERMS = /\b(you|your partner|partner|husband|wife|people|person|brother|sister|cousin|aunt|uncle|parent|parents|relative)\b|(^|\s)(انت|انتما|كلاكما|شريك\S*|زوج\S*|الناس|شخص|اخ|اخت|عم|خال|قريب\S*)(?=\s|$)/;

type Hit = { outcome: Outcome; start: number; end: number };
function outcomeHits(s: string): Hit[] {
  const hits: Hit[] = [];
  for (const [outcome, re] of OUTCOME_TERMS) for (const m of s.matchAll(re)) {
    const lead = m[0].length - m[0].trimStart().length;
    hits.push({ outcome, start: m.index! + lead, end: m.index! + m[0].length });
  }
  // Earliest first; at the same place, the longer phrase; a phrase inside a longer one is dropped.
  hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  return hits.filter((h, i) => !hits.some((o, j) => j !== i && o.start <= h.start && o.end >= h.end && (o.end - o.start) > (h.end - h.start)));
}
// A chance given "per pregnancy" with no other outcome named is the chance of an affected child.
const PER_PREGNANCY = /\b(per|each|every) pregnancy\b|(في|لكل) كل حمل|لكل حمل/;
const subjectOf = (s: string): Subject | null => CHILD_TERMS.test(s) ? 'child' : ADULT_TERMS.test(s) ? 'adult' : null;

/** Every chance a sentence states, with the outcome and the person it is attached to. */
export function extractClaims(text: string): Claim[] {
  const n = normalize(stripNonQuantities(toAsciiDigits(text)));
  type Found = { start: number; end: number; value: number; parts: number[]; pct?: number; text: string };
  const found: Found[] = [];
  for (const m of n.matchAll(RATIO)) {
    const [a, d] = [toNum(m[1]), toNum(m[2])];
    if (d > 0) found.push({ start: m.index!, end: m.index! + m[0].length, value: a / d, parts: [a, d], text: m[0] });
  }
  for (const m of n.matchAll(PERCENT)) {
    const dp = (m[1].split('.')[1] ?? '').length;
    found.push({ start: m.index!, end: m.index! + m[0].length, value: Number(m[1]) / 100, parts: [Number(m[1])], pct: dp, text: m[0] });
  }
  for (const [re, v] of WORD_FRACTION) for (const m of n.matchAll(re)) {
    const start = m.index! + (m[0].length - m[0].trimStart().length);
    if (!found.some(f => start >= f.start && start < f.end)) found.push({ start, end: m.index! + m[0].length, value: v, parts: [], text: m[0].trim() });
  }
  found.sort((a, b) => a.start - b.start);
  // A chance's outcome is looked for in its own clause only: "about 1 in 260 per pregnancy,
  // even though you carry a change" does not make 1 in 260 a chance of carrying.
  // A comma only ends the clause softly: "Half of your children, on average, would be carriers".
  const HARD = /[.;؛!?:](\s|$)|\s(even though|although|though|because|since|while|whereas|but|لكن|ولكن|رغم|مع ان|لان\S*|بسبب|حيث)\s/g;
  const SOFT = /[,،]\s?(?!\d{3}\b)/g;
  const hard = [...n.matchAll(HARD)].map(m => m.index!);
  const soft = [...n.matchAll(SOFT)].map(m => m.index!);
  const after = (cuts: number[], from: number) => cuts.find(c => c >= from) ?? n.length;
  const before = (cuts: number[], to: number) => { const c = cuts.filter(x => x < to).at(-1); return c === undefined ? 0 : c + 1; };
  return found.map((f, i) => {
    const prevEnd = i > 0 ? found[i - 1].end : 0;
    const nextStart = found[i + 1]?.start ?? n.length;
    const fwdClause = n.slice(f.end, Math.min(nextStart, after(soft, f.end), after(hard, f.end)));
    const ext = n.slice(f.end, Math.min(nextStart, after(hard, f.end)));
    const back = n.slice(Math.max(prevEnd, before(hard, f.start), before(soft, f.start)), f.start);
    // The phrase right after the chance names its outcome ("1 in 4 chance the child has SMA");
    // failing that, the nearest phrase before it ("the chance of being a carrier is 1 in 2"), or "per pregnancy"
    // in its own clause. Only then does the next clause count ("Half of your children, on average, would be
    // carriers"), so "1 in 390 per pregnancy for other genes, and the chance of birth defects is 1 in 33" keeps
    // each chance to its own clause. Whose chance it is comes first from the clause that named the outcome.
    let outcome: Outcome | null = null, from: string[] = [];
    if (outcomeHits(fwdClause).length) [outcome, from] = [outcomeHits(fwdClause)[0].outcome, [fwdClause, back]];
    else if (outcomeHits(back).length) [outcome, from] = [outcomeHits(back).at(-1)!.outcome, [back, fwdClause]];
    else if (PER_PREGNANCY.test(fwdClause) || PER_PREGNANCY.test(back)) [outcome, from] = ['affected', [fwdClause, back]];
    else if (outcomeHits(ext).length) [outcome, from] = [outcomeHits(ext)[0].outcome, [ext, back]];
    else if (PER_PREGNANCY.test(n)) [outcome, from] = ['affected', [ext, back]];
    else from = [ext, back];
    const subject = from.map(subjectOf).find(x => x) ?? subjectOf(n) ?? 'any';
    return { text: f.text, value: f.value, parts: f.parts, pct: f.pct, outcome, subject };
  });
}

/** What each card states, as (outcome, whose, value). */
export function statedOutcomes(c: FactCard): Stated[] {
  const q = (k: string) => (c.numbers[k] ? Q.from(c.numbers[k]) : undefined);
  const out: Stated[] = [];
  const push = (outcome: Outcome, subject: Subject, value?: Q) => { if (value) out.push({ outcome, subject, value }); };
  // A remaining chance given as a range, because the result does not state the lab's detection.
  if ((c.kind === 'residual-gene' || c.kind === 'residual-panel') && c.ranges?.affected) {
    out.push({ outcome: 'affected', subject: 'child', range: [Q.from(c.ranges.affected[0]), Q.from(c.ranges.affected[1])] });
  }
  switch (c.kind) {
    case 'couple-gene':
      push('affected', 'child', q('affected'));
      push('carrier', 'child', q('carrier'));
      push('neither', 'child', q('neither'));
      push('unaffected', 'child', q('affected') && Q.one.sub(q('affected')!));
      break;
    case 'residual-gene':
      push('affected', 'child', q('affected'));
      push('carrier', 'adult', q('partnerResidual'));
      push('carrier', 'adult', q('carrierFreq'));
      if (q('familialPrior') && !q('familialPrior')!.isZero()) push('carrier', 'adult', q('familialPrior'));
      break;
    case 'residual-panel':
      push('affected', 'child', q('affected'));
      break;
    case 'background':
      push('defect', 'child', q('birthDefects'));
      break;
    case 'relative':
      // "For a child, the chance of carrying the same change": the relative may be any age.
      if (q('prior')) out.push({ outcome: 'carrier', subject: 'any', value: q('prior'), relative: c.id.slice('relative:'.length) });
      break;
    case 'consanguinity':
      if (c.ranges?.added) out.push({ outcome: 'affected', subject: 'child', range: [Q.from(c.ranges.added[0]), Q.from(c.ranges.added[1])] });
      break;
  }
  return out;
}

function sameChance(claim: Claim, s: Stated): boolean {
  if (s.range) return claim.value >= s.range[0].toNumber() * 0.95 && claim.value <= s.range[1].toNumber() * 1.05;
  const x = s.value!.toNumber();
  if (claim.pct !== undefined && Math.abs(claim.value * 100 - x * 100) <= 0.5 * 10 ** -claim.pct + 1e-9) return true;
  // "about 1 in 1,200" restates 1/1,187: the card's "1 in N" is rounded to two significant figures.
  return x > 0 && Math.abs(claim.value - x) / x <= 0.05;
}

// A sentence that names one degree of relative may only use that relative's chance.
const RELATIVE_TERMS: [string, RegExp][] = [
  ['half-sibling', /\bhalf-(brother|sister|sibling)s?\b|من احد الوالدين/],
  ['first-cousin', /\bfirst cousins?\b|من الدرجه الاولي/],
  ['second-cousin', /\bsecond cousins?\b|من الدرجه الثانيه/],
  ['sibling', /(?<!half-)\b(brothers?|sisters?|siblings?)\b|(^|\s)(ال)?(اخ|اخت|اخوه|اخوات)(?=\s|$)/],
  ['aunt-uncle', /\b(aunts?|uncles?)\b|(^|\s)(ال)?(عم|عمه|خال|خاله)(?=\s|$)/],
  ['niece-nephew', /\b(nieces?|nephews?)\b/],
  ['parent', /\b(parents?|mother|father)\b|(^|\s)(ال)?(والد|والده|الوالدين)(?=\s|$)/],
];
function namedRelative(text: string): string | null {
  const n = normalize(text);
  const named = RELATIVE_TERMS.filter(([, re]) => re.test(n)).map(([r]) => r);
  return named.length === 1 ? named[0] : null;
}

/** Each chance in a sentence, and whether a cited card gives that value for that outcome and that person. */
export function bindClaims(text: string, cited: FactCard[]): { claim: Claim; bound: boolean }[] {
  const rel = namedRelative(text);
  const stated = cited.flatMap(statedOutcomes).filter(s => !s.relative || !rel || s.relative === rel);
  return extractClaims(text).filter(c => c.outcome).map(claim => {
    const fits = stated.filter(s => s.outcome === claim.outcome && (claim.subject === 'any' || s.subject === 'any' || s.subject === claim.subject));
    return { claim, bound: fits.some(s => sameChance(claim, s)) };
  });
}

// Every card says the opposite: a carrier of a recessive change is healthy.
const EN_CARRIER_ILL = /\b(carriers? (is|are|will be|can be|may be|become|becomes|gets?)( also| usually| often| sometimes)? (ill|sick|unwell|affected)|being a carrier (means|makes|will make|can make) (you |them |him |her )?((are|is|will be|become) )?(ill|sick|unwell|affected)|carriers? (has|have|develop|develops|gets?) (the |a mild form of the )?(condition|disease|illness))\b/;
const AR_CARRIER_ILL = /(الحامل|حاملو|حاملي|حامل التغير)\S*( \S+){0,3} (مريض|مرضي|مصاب|مصابون|مصابين)|(يسبب|سيسبب) (لك |له |لها )?(المرض|الاصابه)( \S+){0,2} (للحامل|لدي الحامل)/;
export function saysCarrierIsIll(text: string): boolean {
  const n = normalize(text);
  return EN_CARRIER_ILL.test(n) || AR_CARRIER_ILL.test(n);
}

/** The chances in a sentence that no cited card gives for that outcome and that person.
 *  A bare chance, with no outcome named, is left to the number check. */
export function unboundClaims(text: string, cited: FactCard[]): Claim[] {
  return bindClaims(text, cited).filter(b => !b.bound).map(b => b.claim);
}

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

// "I can't tell you what you should do" refuses to steer; remove that clause before looking for a steer.
const EN_NEG_TELL = /\b(i )?(can'?not|can'?t|won'?t|will not|do not|don'?t|am not able to)( be able to)? (tell|say|decide)( (you|for you))?[^,.;]*/g;
const AR_NEG_TELL = /(لا يمكنني|لا استطيع|لا يمكن لي|لن) (ان )?(اخبرك|اخبركما|اخبارك|اخباركما|اقول|القول|اقرر|احدد)[^،,.؛]*/g;

export function isDirective(text: string): boolean {
  const n = normalize(text).replace(EN_NEG_TELL, ' ').replace(AR_NEG_TELL, ' ');
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
  const bindings = bindClaims(s.text, ok);
  // "3 in 4 chance the child does not have SMA" restates the card's 1 in 4: a complement is allowed
  // only where it is bound to "not affected".
  for (const b of bindings) if (b.bound && b.claim.outcome === 'unaffected') for (const x of b.claim.parts) allowed.add(String(round(x, 4)));
  const bad = extractNumbers(s.text).filter(x => !allowed.has(String(round(x, 4))));
  if (bad.length) reasons.push('number');
  const misbound = bindings.filter(b => !b.bound).map(b => b.claim);
  if (misbound.length || saysCarrierIsIll(s.text)) reasons.push('binding');
  if (isDirective(s.text)) reasons.push('directive');
  if (isCertainty(s.text)) reasons.push('certainty');
  return {
    sentence: s, ok: reasons.length === 0, reasons,
    badNumbers: bad.length ? bad.map(String) : undefined,
    badClaims: misbound.length ? misbound.map(c => `${c.text} → ${c.outcome} (${c.subject})`) : undefined,
  };
}

export interface VerifiedAnswer { shown: ModelSentence[]; blocked: Verdict[]; verdicts: Verdict[] }

/**
 * Models sometimes cite a card by its prefix ("residual" for "residual:CYP21A2"). The id is resolved
 * only when exactly one card matches; anything ambiguous stays unknown and the sentence is blocked.
 */
export function resolveIds(ids: string[], cards: FactCard[]): string[] {
  const known = new Set(cards.map(c => c.id));
  return ids.map(id => {
    if (known.has(id)) return id;
    const hits = cards.filter(c => c.id.startsWith(`${id}:`) || c.id.toLowerCase() === id.toLowerCase());
    return hits.length === 1 ? hits[0].id : id;
  });
}

export function verifyAnswer(a: ModelAnswer, cards: FactCard[]): VerifiedAnswer {
  const byId = new Map(cards.map(c => [c.id, c]));
  const verdicts = (a.sentences ?? []).slice(0, 8).map(s => verifySentence({ ...s, cards: resolveIds(s.cards ?? [], cards) }, byId));
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
        .map((s: ModelSentence) => ({ text: stripInlineIds(s.text), cards: Array.isArray(s.cards) ? s.cards.map(String) : [] })),
    };
  } catch {
    return null;
  }
}

/** Models sometimes repeat card ids inside the sentence, e.g. "... [couple:SMN1]". */
export function stripInlineIds(text: string): string {
  return text.replace(/\s*[\[(]\s*(?:[a-z]+:[A-Za-z0-9:-]+|counsellor|background|not-assessed|panel-residual|consanguinity)(?:\s*,\s*[a-zA-Z0-9:-]+)*\s*[\])]/g, '').trim();
}
