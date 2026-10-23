import type { FactCard, L10n } from './types';
import { normalize } from './text';

// Questions people ask most often, answered from fact cards without any model.
// The model is used only when no intent matches, and its answer still goes through the verifier.

export interface Intent {
  id: string;
  label: L10n;              // shown as a suggested question
  en: RegExp;
  ar: RegExp;
  /** Card ids or kinds to answer with, in order. A kind is written as "kind:<kind>". */
  answer: string[];
  lead?: L10n;              // a fixed opening sentence, no numbers
}

export const INTENTS: Intent[] = [
  {
    id: 'chance',
    label: { en: 'What is the chance for our children?', ar: 'ما احتمال إصابة أطفالنا؟' },
    en: /\b(chance|risk|odds|likely|probabilit|percent|how many|inherit\w*|pass(ed)? (it|this) on)\b|\bwill (my|our|the) (baby|babies|child|children|kids?|son|daughter)\b|\b(baby|babies|child|children|kids?) (will|going to) (have|get|be)\b|\b(healthy|sick|ill|affected) (baby|babies|child|children|kids?)\b/,
    ar: /(احتمال|نسبه|خطر|خطوره|فرصه|(^|\s)كم(\s|$)|سيصاب|هل يصاب|طفل سليم|طفلا سليما|اطفال اصحاء|يرث|سيرث)/,
    answer: ['kind:couple-gene', 'kind:residual-gene', 'panel-residual'],
  },
  {
    id: 'compatible',
    label: { en: 'Does “compatible” mean no risk?', ar: 'هل تعني كلمة «متوافق» عدم وجود أي خطر؟' },
    en: /\b(compatible|no risk|zero risk|safe|normal result|all clear)\b/,
    ar: /(متوافق|توافق|لا يوجد خطر|بدون خطر|لا خطر|النتيجه طبيعيه)/,
    answer: ['panel-residual', 'kind:residual-gene', 'not-assessed', 'family-history', 'background', 'consanguinity'],
    lead: {
      en: '“Compatible” means the panel found no gene where you both carry a change. It does not mean zero chance.',
      ar: '«متوافق» يعني أن لوحة الفحص لم تجد جيناً يحمل كلاكما تغيّراً فيه، ولا يعني أن الاحتمال صفر.',
    },
  },
  {
    id: 'carrier',
    label: { en: 'What does being a carrier mean?', ar: 'ماذا يعني أنني أحمل تغيّراً في الجين؟' },
    en: /\b(carrier|carry|carries|am i (sick|ill)|affect me)\b/,
    ar: /(حامل للجين|حامله للجين|حامل للتغير|حامله للتغير|احمل|معني حامل|هل انا مريض|هل انا مريضه|يوثر علي)/,
    answer: ['kind:carrier', 'kind:condition'],
    lead: {
      en: 'A carrier has one changed copy of a gene and one working copy. Carriers are healthy.',
      ar: 'من يحمل تغيّراً في الجين لديه نسخة متغيرة منه ونسخة سليمة، والحاملون أصحّاء.',
    },
  },
  {
    id: 'options',
    label: { en: 'What options do we have?', ar: 'ما الخيارات المتاحة لنا؟' },
    en: /\b(option|choice|what can we do|what now|next step|can we (still )?(marry|have children)|should we)\b/,
    ar: /(خيار|خيارات|ماذا نفعل|ما العمل|الخطوه التاليه|هل يمكننا|هل نستطيع|هل نتزوج)/,
    answer: ['kind:option'],
    lead: {
      en: 'The decision is yours. These are the options the programme offers; none of them is the right one for every family.',
      ar: 'القرار قراركما. هذه هي الخيارات التي يقدّمها البرنامج، ولا يوجد خيار واحد يناسب كل الأسر.',
    },
  },
  {
    id: 'pgt',
    label: { en: 'What is IVF with embryo testing?', ar: 'ما المقصود بأطفال الأنابيب مع فحص الأجنة؟' },
    en: /\b(ivf|pgt|embryo|test tube)\b/,
    ar: /(اطفال الانابيب|الاجنه|اجنه|فحص الاجنه|التلقيح الصناعي)/,
    answer: ['option:pgt'],
  },
  {
    id: 'birth',
    label: { en: 'What can be done when the baby is born?', ar: 'ما الذي يمكن فعله عند ولادة الطفل؟' },
    en: /\b(born|birth|newborn|after delivery|baby is born|treat(ment)?|cure)\b/,
    ar: /(الولاده|ولاده|المولود|مولود|بعد الولاده|علاج|يشفي|شفاء)/,
    answer: ['kind:birth-plan', 'kind:condition'],
  },
  {
    id: 'cousins',
    label: { en: 'Does being cousins change anything?', ar: 'هل تغيّر القرابة بيننا شيئاً؟' },
    en: /\b(cousin|related|relatives?|family marriage|consanguin)\b/,
    ar: /(ابن عم|بنت عم|ابن خال|بنت خال|قرابه|اقارب|زواج الاقارب)/,
    answer: ['consanguinity', 'panel-residual', 'background', 'kind:residual-gene', 'family-history'],
  },
  {
    id: 'what-is',
    label: { en: 'What is the condition?', ar: 'ما هي هذه الحالة؟' },
    en: /\b(what is (it|this|sma|the condition|the disease)|what does .* mean|symptom|serious)\b/,
    ar: /(ما هي|ما هو|ما معني|الاعراض|اعراض|خطيره|خطير)/,
    answer: ['kind:condition'],
  },
  {
    id: 'every-pregnancy',
    label: { en: 'If our first child is healthy, is the next one safe?', ar: 'إذا كان طفلنا الأول سليماً، فهل يكون الثاني سليماً أيضاً؟' },
    en: /\b(next (child|baby|pregnancy)|second (child|baby)|first child|already have|each pregnancy|every pregnancy)\b/,
    ar: /(الطفل الثاني|الحمل القادم|الحمل الثاني|طفلنا الاول|كل حمل)/,
    answer: ['kind:couple-gene'],
    lead: {
      en: 'The chance is the same in every pregnancy. A healthy first child does not change the chance for the next one.',
      ar: 'الاحتمال نفسه في كل حمل، وسلامة الطفل الأول لا تغيّر الاحتمال في الحمل التالي.',
    },
  },
];

export interface FaqAnswer { intent: Intent; cards: FactCard[] }

/** "Should we…?" asks for a decision. It always gets every option at equal weight and the reminder that the choice is
 * theirs, even when it names one option, so the answer never reads as a recommendation. */
const DECIDE = {
  en: /\b(should (we|i)|do you recommend|would you recommend|what would you do|is it better|which is better|best (option|choice|thing))\b/,
  ar: /(هل يجب|هل ينبغي|هل علينا|هل نختار|تنصح|تنصحين|تنصحون|الافضل لنا|ما الافضل|ايهما افضل)/,
};

export function matchIntent(question: string): Intent | undefined {
  const n = normalize(question);
  if (DECIDE.en.test(n) || DECIDE.ar.test(n)) return INTENTS.find(i => i.id === 'options');
  // Specific intents before general ones: check in a fixed priority order.
  const order = ['every-pregnancy', 'compatible', 'pgt', 'birth', 'cousins', 'carrier', 'options', 'chance', 'what-is'];
  for (const id of order) {
    const it = INTENTS.find(i => i.id === id)!;
    if (it.en.test(n) || it.ar.test(n)) return it;
  }
  return undefined;
}

export function answerFrom(intent: Intent, cards: FactCard[]): FaqAnswer {
  const out: FactCard[] = [];
  for (const ref of intent.answer) {
    const hits = ref.startsWith('kind:') ? cards.filter(c => c.kind === ref.slice(5)) : cards.filter(c => c.id === ref);
    for (const h of hits) if (!out.includes(h)) out.push(h);
  }
  return { intent, cards: out };
}
