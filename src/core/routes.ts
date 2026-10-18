import type { L10n } from './types';
import { normalize } from './text';

// Deterministic hard routes. They run before any model and decide on their own.
// Each one hands the person to a human and never answers the substance of the question.

export type Route = 'distress' | 'termination' | 'religion' | 'other-person' | 'blame' | 'none';

export interface RouteResult {
  route: Route;
  reply: L10n;
  /** Raise the case in the counsellor queue. */
  escalate: boolean;
  /** Show emergency contacts immediately. */
  urgent: boolean;
}

interface Rule { route: Exclude<Route, 'none'>; en: RegExp; ar: RegExp; reply: L10n; escalate: boolean; urgent: boolean }

const RULES: Rule[] = [
  {
    route: 'distress',
    en: /\b(kill myself|suicid|end my life|want to die|don'?t want to live|no reason to live|hurt myself|self[- ]harm|can'?t go on|hopeless)\b/,
    ar: /(انتحار|انتحر|اقتل نفسي|انهي حياتي|انهاء حياتي|اريد ان اموت|ابي اموت|ما ابي اعيش|لا اريد ان اعيش|اوذي نفسي|ايذاء نفسي|لا امل)/,
    reply: {
      en: 'I’m sorry you are carrying this. You do not have to carry it alone. If you are in danger now, call 999 (police) or 998 (ambulance). I have asked your counsellor to contact you today.',
      ar: 'نأسف لأنكِ تحملين هذا العبء، ولستِ مضطرةً لحمله وحدكِ. إذا كنتِ في خطر الآن فاتصلي بالرقم 999 (الشرطة) أو 998 (الإسعاف). وقد طلبنا من مستشاركِ التواصل معكِ اليوم.', arM: 'نأسف لأنك تحمل هذا العبء، ولست مضطراً لحمله وحدك. إذا كنت في خطر الآن فاتصل بالرقم 999 (الشرطة) أو 998 (الإسعاف). وقد طلبنا من مستشارك التواصل معك اليوم.',
    },
    escalate: true,
    urgent: true,
  },
  {
    route: 'termination',
    en: /\b(abort|abortion|terminat(e|ion)|end (the|my|this) pregnancy|get rid of (the|my) (baby|pregnancy))\b/,
    ar: /(اجهاض|اسقاط|انهاء الحمل|انهي الحمل|التخلص من الحمل|التخلص من الجنين)/,
    reply: {
      en: 'Questions about ending a pregnancy are decided with doctors, under UAE law. Silah does not answer them. Your counsellor can explain what applies to you, privately.',
      ar: 'الأسئلة المتعلقة بإنهاء الحمل تُحسم مع الأطباء وفق قانون دولة الإمارات، ولا يجيب عنها تطبيق صلة. يمكن لمستشارك أن يشرح لك ما ينطبق عليك بسرية.',
    },
    escalate: true,
    urgent: false,
  },
  {
    route: 'religion',
    en: /\b(halal|haram|fatwa|sharia|islam(ic)?|religio(n|us)|allowed in islam|is it a sin|sin\b|god'?s will|qadar|imam|sheikh|mufti)/,
    ar: /(حلال|حرام|فتوي|فتوى|الشرع|شرعا|شرعي|الدين|ديني|يجوز|جائز|اثم|قدر الله|القضاء والقدر|الامام|الشيخ|المفتي)/,
    reply: {
      en: 'That is a question for a religious scholar you trust, and Silah does not give religious rulings. Your counsellor can tell you which questions families often take to a scholar, and can join that conversation if you wish.',
      ar: 'هذا سؤال يُوجَّه إلى عالم دين تثقين به، ولا يقدّم تطبيق صلة أحكاماً شرعية. ويمكن لمستشاركِ أن يوضح لكِ الأسئلة التي تعرضها الأسر عادة على العلماء، وأن يشارك في ذلك الحديث إن رغبتِ.', arM: 'هذا سؤال يُوجَّه إلى عالم دين تثق به، ولا يقدّم تطبيق صلة أحكاماً شرعية. ويمكن لمستشارك أن يوضح لك الأسئلة التي تعرضها الأسر عادة على العلماء، وأن يشارك في ذلك الحديث إن رغبت.',
    },
    escalate: false,
    urgent: false,
  },
  {
    route: 'other-person',
    en: /\b(my|his|her) (sister|brother|cousin|mother|father|aunt|uncle|husband|wife|fianc[eé]e?|partner)('s)? (result|test|gene|carrier|status)|is my (sister|brother|cousin|husband|wife|fianc[eé]e?) a carrier|what (did|does) (his|her) (result|test) say\b/,
    ar: /(نتيجه|نتائج|فحص|تحليل) (اختي|اخي|ابن عمي|بنت عمي|ابن خالي|بنت خالي|امي|ابي|زوجي|زوجتي|خطيبي|خطيبتي)|هل (اختي|اخي|زوجي|زوجتي|خطيبي|خطيبتي) (حامل|حامله) (للجين|للمرض)/,
    reply: {
      en: 'Silah only shows what each person chose to share. Another person’s result belongs to them. You can invite a relative to test, without saying it came from you.',
      ar: 'لا يعرض تطبيق صلة إلا ما اختار كل شخص مشاركته، فنتيجة الشخص الآخر ملك لصاحبها. يمكنك دعوة قريبك لإجراء الفحص دون أن تذكر الدعوة أنها منك.',
    },
    escalate: false,
    urgent: false,
  },
  {
    route: 'blame',
    en: /\b(my fault|his fault|her fault|whose fault|blame|because of (me|him|her)|guilty)\b/,
    ar: /(ذنبي|ذنبه|ذنبها|غلطتي|غلطته|غلطتها|بسببي|بسببه|بسببها|من السبب|اللوم|الوم)/,
    reply: {
      en: 'Nobody chooses the genes they carry, and nobody is to blame. Almost everyone carries a few recessive changes without knowing. What matters now is what you both want to do next, and your counsellor can help with that.',
      ar: 'لا أحد يختار الجينات التي يحملها، ولا لوم على أحد. فكل إنسان تقريباً يحمل بعض التغيرات المتنحية دون أن يعلم. المهم الآن هو ما تريدانه أنتما في الخطوة التالية، ويمكن لمستشاركما المساعدة في ذلك.',
    },
    escalate: false,
    urgent: false,
  },
];

export function route(question: string): RouteResult {
  const n = normalize(question);
  for (const r of RULES) if (r.en.test(n) || r.ar.test(n)) {
    return { route: r.route, reply: r.reply, escalate: r.escalate, urgent: r.urgent };
  }
  return { route: 'none', reply: { en: '', ar: '' }, escalate: false, urgent: false };
}
