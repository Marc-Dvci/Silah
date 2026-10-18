import type { L10n } from './types';
import type { QLike } from './fraction';

// Plain-language condition cards. Clinical statements cite source ids from sources.ts.
// Arabic is Modern Standard Arabic, written for this prototype.

export interface BirthPlan {
  /** What can be done at birth, in one sentence. */
  action: L10n;
  /** Why timing matters, in one sentence. */
  window: L10n;
  urgency: 'first-days' | 'first-weeks' | 'first-months';
  /** Every number the sentences above contain, so the verifier can check restatements. */
  numbers?: Record<string, QLike>;
  sources: string[];
}

export interface Condition {
  id: string;
  genes: string[];
  name: L10n;
  what: L10n;
  /** Something that does not change, to counter fear and stigma. */
  notChanged: L10n;
  birthPlan?: BirthPlan;
  /** Results in these genes always go to a counsellor before anything else is shown. */
  counsellorFirst?: boolean;
  sources: string[];
}

export const CONDITIONS: Condition[] = [
  {
    id: 'sma',
    genes: ['SMN1'],
    name: { en: 'Spinal muscular atrophy (SMA)', ar: 'ضمور العضلات الشوكي' },
    what: {
      en: 'A condition that weakens the muscles a baby uses to move, sit, swallow and breathe.',
      ar: 'حالة تُضعف العضلات التي يستخدمها الطفل للحركة والجلوس والبلع والتنفس.',
    },
    notChanged: {
      en: 'Carriers of SMA are healthy. Being a carrier does not affect your own muscles.',
      ar: 'حاملو التغيّر المرتبط بضمور العضلات الشوكي أصحّاء، ووجود هذا التغيّر لديك لا يؤثر في عضلاتك.',
    },
    birthPlan: {
      action: {
        en: 'A blood test in the baby’s first days can confirm SMA, so treatment can start before any signs appear.',
        ar: 'يمكن لفحص دم في الأيام الأولى بعد الولادة أن يؤكد الإصابة، فيبدأ العلاج قبل ظهور أي علامات.',
      },
      window: {
        en: 'In one study of babies treated before any signs, 22 of 25 later walked on their own.',
        ar: 'في دراسة على أطفال عولجوا قبل ظهور أي علامة، تمكّن 22 منهم من أصل 25 من المشي لاحقاً دون مساعدة.',
      },
      urgency: 'first-days',
      numbers: { walked: { n: '22', d: '25' } },
      sources: ['devivo-2019-nurture', 'strauss-2022-2copy'],
    },
    sources: ['strauss-2022-2copy'],
  },
  {
    id: 'krabbe',
    genes: ['GALC'],
    name: { en: 'Krabbe disease', ar: 'داء كرابي' },
    what: {
      en: 'A condition that damages the protective coating of the nerves. In the infant form, signs begin in the first months.',
      ar: 'حالة تُتلف الغلاف الواقي للأعصاب، وفي الشكل الذي يصيب الرضّع تبدأ العلامات في الأشهر الأولى.',
    },
    notChanged: {
      en: 'Carriers are healthy and do not develop the disease.',
      ar: 'الحاملون أصحّاء ولا يُصابون بالمرض.',
    },
    birthPlan: {
      action: {
        en: 'If the baby is affected, a stem-cell transplant in the first weeks of life, before signs appear, can change the course of the disease.',
        ar: 'إذا كان الطفل مصاباً، فإن زراعة الخلايا الجذعية في الأسابيع الأولى من العمر، قبل ظهور العلامات، قد تغيّر مسار المرض.',
      },
      window: {
        en: 'The benefit depends on treating before symptoms, so the test has to happen right after birth.',
        ar: 'تعتمد الفائدة على العلاج قبل الأعراض، لذلك يجب أن يُجرى الفحص بعد الولادة مباشرة.',
      },
      urgency: 'first-weeks',
      sources: ['escolar-2005'],
    },
    sources: ['escolar-2005'],
  },
  {
    id: 'mld',
    genes: ['ARSA'],
    name: { en: 'Metachromatic leukodystrophy (MLD)', ar: 'حثل المادة البيضاء متبدّل اللون' },
    what: {
      en: 'A condition that slowly damages the nervous system. In its early-onset forms, signs begin in early childhood.',
      ar: 'حالة تُتلف الجهاز العصبي تدريجياً، وفي أشكالها المبكرة تبدأ العلامات في الطفولة المبكرة.',
    },
    notChanged: {
      en: 'Carriers are healthy.',
      ar: 'الحاملون أصحّاء.',
    },
    birthPlan: {
      action: {
        en: 'A gene therapy exists for children diagnosed before symptoms. Knowing at birth keeps that door open.',
        ar: 'يوجد علاج جيني للأطفال الذين يُشخَّصون قبل ظهور الأعراض، والمعرفة عند الولادة تُبقي هذا الباب مفتوحاً.',
      },
      window: {
        en: 'Once symptoms have started, the treatment helps much less.',
        ar: 'بعد بدء الأعراض تقل فائدة العلاج كثيراً.',
      },
      urgency: 'first-months',
      sources: ['fumagalli-2022', 'fda-lenmeldy-2024'],
    },
    sources: ['fumagalli-2022'],
  },
  {
    id: 'pompe',
    genes: ['GAA'],
    name: { en: 'Pompe disease', ar: 'داء بومبي' },
    what: {
      en: 'A condition where sugar builds up in muscles. The infant form affects the heart and breathing in the first months.',
      ar: 'حالة يتراكم فيها السكر في العضلات، ويؤثر الشكل الذي يصيب الرضّع في القلب والتنفس خلال الأشهر الأولى.',
    },
    notChanged: {
      en: 'Carriers are healthy.',
      ar: 'الحاملون أصحّاء.',
    },
    birthPlan: {
      action: {
        en: 'If the baby is affected, enzyme replacement started in the first weeks protects the heart and muscles.',
        ar: 'إذا كان الطفل مصاباً، فإن العلاج التعويضي بالإنزيم، إذا بدأ في الأسابيع الأولى، يحمي القلب والعضلات.',
      },
      window: {
        en: 'Babies who start treatment earliest do best.',
        ar: 'الأطفال الذين يبدأون العلاج في وقت أبكر تكون نتائجهم أفضل.',
      },
      urgency: 'first-weeks',
      sources: ['kishnani-2007', 'chien-2009'],
    },
    sources: ['kishnani-2007'],
  },
  {
    id: 'mps1',
    genes: ['IDUA'],
    name: { en: 'Mucopolysaccharidosis type I (MPS I)', ar: 'داء عديدات السكاريد المخاطية من النوع الأول' },
    what: {
      en: 'A condition where the body cannot break down certain sugars, which slowly affects growth, joints, heart and learning.',
      ar: 'حالة لا يستطيع فيها الجسم تفكيك سكريات معيّنة، فتؤثر تدريجياً في النمو والمفاصل والقلب والتعلّم.',
    },
    notChanged: {
      en: 'Carriers are healthy.',
      ar: 'الحاملون أصحّاء.',
    },
    birthPlan: {
      action: {
        en: 'If the baby is affected, a stem-cell transplant early in life gives the best results.',
        ar: 'إذا كان الطفل مصاباً، فإن زراعة الخلايا الجذعية في سن مبكرة تعطي أفضل النتائج.',
      },
      window: {
        en: 'Younger age at transplant is linked to better long-term outcomes.',
        ar: 'ترتبط الزراعة في سن أصغر بنتائج أفضل على المدى الطويل.',
      },
      urgency: 'first-months',
      sources: ['aldenhoven-2015'],
    },
    sources: ['aldenhoven-2015'],
  },
  {
    id: 'cah',
    genes: ['CYP21A2'],
    name: { en: 'Congenital adrenal hyperplasia (CAH)', ar: 'تضخم الغدة الكظرية الخلقي' },
    what: {
      en: 'A condition where the adrenal glands cannot make enough of some hormones. It is treated with daily medicine.',
      ar: 'حالة لا تستطيع فيها الغدتان الكظريتان إنتاج ما يكفي من بعض الهرمونات، وتُعالَج بدواء يومي.',
    },
    notChanged: {
      en: 'Carriers are healthy. Many people with CAH live full lives with treatment.',
      ar: 'الحاملون أصحّاء، وكثير من المصابين يعيشون حياة كاملة مع العلاج.',
    },
    birthPlan: {
      action: {
        en: 'Routine newborn screening in Abu Dhabi already includes CAH. Telling the delivery team in advance means they watch for it from the first day and can start medicine early.',
        ar: 'يشمل فحص حديثي الولادة الروتيني في أبوظبي هذه الحالة أصلاً. وإبلاغ فريق الولادة مسبقاً يعني أنه يراقبها منذ اليوم الأول، ويمكنه بدء الدواء مبكراً.',
      },
      window: {
        en: 'In the severe form, a crisis can happen in infancy if the condition is not known.',
        ar: 'في الشكل الشديد قد تحدث أزمة في سن الرضاعة إذا لم تكن الحالة معروفة.',
      },
      urgency: 'first-days',
      sources: ['speiser-2018', 'doh-newborn-standard-2025'],
    },
    sources: ['speiser-2018'],
  },
  {
    id: 'scd',
    genes: ['HBB'],
    name: { en: 'Sickle cell disease', ar: 'فقر الدم المنجلي' },
    what: {
      en: 'A blood condition where red cells change shape, causing pain episodes and a higher risk of infection.',
      ar: 'حالة دموية يتغير فيها شكل خلايا الدم الحمراء، فتسبب نوبات ألم وزيادة في خطر العدوى.',
    },
    notChanged: {
      en: 'People with sickle cell trait (carriers) are healthy.',
      ar: 'حاملو سمة الخلية المنجلية أصحّاء.',
    },
    birthPlan: {
      action: {
        en: 'Routine newborn screening already looks for sickle cell. Knowing in advance means care, including daily penicillin by four months of age, is planned before birth. In the trial that established penicillin, serious pneumococcal infections fell by 84%.',
        ar: 'يبحث فحص حديثي الولادة الروتيني عن فقر الدم المنجلي أصلاً. والمعرفة المسبقة تعني التخطيط للرعاية قبل الولادة، ومنها البنسلين اليومي بحلول سن أربعة أشهر. وفي التجربة التي أثبتت فائدة البنسلين، انخفضت العدوى الخطيرة بالمكوّرات الرئوية بنسبة 84%.',
      },
      window: {
        en: 'The risk of serious infection is highest in early childhood.',
        ar: 'يبلغ خطر العدوى الخطيرة ذروته خلال الطفولة المبكرة.',
      },
      urgency: 'first-months',
      numbers: { months: { n: '4', d: '1' }, reduction: { n: '84', d: '100' } },
      sources: ['gaston-1986', 'doh-newborn-standard-2025'],
    },
    sources: ['gaston-1986'],
  },
  {
    id: 'bthal',
    genes: ['HBB'],
    name: { en: 'Beta-thalassaemia major', ar: 'الثلاسيميا بيتا الكبرى' },
    what: {
      en: 'A blood condition where the body makes too little haemoglobin. Children usually need regular blood transfusions.',
      ar: 'حالة دموية ينتج فيها الجسم كمية قليلة جداً من الهيموغلوبين، ويحتاج الأطفال عادة إلى نقل دم منتظم.',
    },
    notChanged: {
      en: 'Carriers (thalassaemia minor) are healthy, sometimes with mild anaemia.',
      ar: 'حاملو الثلاسيميا الصغرى أصحّاء، وقد يكون لديهم فقر دم بسيط أحياناً.',
    },
    birthPlan: {
      action: {
        en: 'Knowing at birth lets the haematology team plan care before the baby becomes anaemic.',
        ar: 'المعرفة عند الولادة تتيح لفريق أمراض الدم التخطيط للرعاية قبل أن يصاب الطفل بفقر الدم.',
      },
      window: {
        en: 'Planning early means the first transfusion is a scheduled visit, not an emergency.',
        ar: 'التخطيط المبكر يعني أن يكون أول نقل للدم موعداً مرتّباً لا حالة طارئة.',
      },
      urgency: 'first-months',
      sources: ['tif-2021'],
    },
    sources: ['tif-2021'],
  },
  {
    id: 'sbthal',
    genes: ['HBB'],
    name: { en: 'Sickle beta-thalassaemia', ar: 'الثلاسيميا بيتا المنجلية' },
    what: {
      en: 'A form of sickle cell disease that happens when a child inherits one sickle gene and one beta-thalassaemia gene.',
      ar: 'شكل من أشكال فقر الدم المنجلي يحدث عندما يرث الطفل جين الخلية المنجلية من أحد الوالدين وجين الثلاسيميا بيتا من الآخر.',
    },
    notChanged: {
      en: 'Each parent, as a carrier, is healthy.',
      ar: 'كلٌّ من الوالدين حاملٌ للتغيّر الجيني وسليم.',
    },
    birthPlan: {
      action: {
        en: 'Knowing at birth means preventive care, including penicillin, can start in the first months.',
        ar: 'المعرفة عند الولادة تعني إمكانية بدء الرعاية الوقائية، ومنها البنسلين، في الأشهر الأولى.',
      },
      window: {
        en: 'The risk of serious infection is highest in early childhood.',
        ar: 'يبلغ خطر العدوى الخطيرة ذروته خلال الطفولة المبكرة.',
      },
      urgency: 'first-months',
      sources: ['gaston-1986'],
    },
    sources: ['gaston-1986'],
  },
  {
    id: 'athal',
    genes: ['HBA1', 'HBA2'],
    name: { en: 'Alpha-thalassaemia', ar: 'الثلاسيميا ألفا' },
    what: {
      en: 'A blood condition with several forms, from mild to severe, depending on how many alpha-globin genes are missing.',
      ar: 'حالة دموية لها عدة أشكال، من الخفيف إلى الشديد، حسب عدد جينات ألفا غلوبين المفقودة.',
    },
    notChanged: {
      en: 'Most carriers are healthy.',
      ar: 'معظم الحاملين أصحّاء.',
    },
    counsellorFirst: true,
    sources: ['doh-pms-2024'],
  },
  {
    id: 'cf',
    genes: ['CFTR'],
    name: { en: 'Cystic fibrosis', ar: 'التليّف الكيسي' },
    what: {
      en: 'A condition that makes mucus thick, affecting the lungs and digestion.',
      ar: 'حالة تجعل المخاط كثيفاً، فتؤثر في الرئتين والهضم.',
    },
    notChanged: {
      en: 'Carriers are healthy.',
      ar: 'الحاملون أصحّاء.',
    },
    sources: ['doh-pms-2024'],
  },
  {
    id: 'retinal',
    genes: ['RPE65', 'ABCA4', 'CRB1', 'CEP290', 'EYS', 'CNGA3', 'CNGB3', 'GUCY2D', 'CERKL', 'FAM161A'],
    name: { en: 'Inherited retinal dystrophy', ar: 'ضمور الشبكية الوراثي' },
    what: {
      en: 'A group of conditions that slowly reduce vision because the retina, the back of the eye, does not work as it should.',
      ar: 'مجموعة من الحالات تُضعف البصر تدريجياً لأن الشبكية، وهي الجزء الخلفي من العين، لا تعمل كما ينبغي.',
    },
    notChanged: {
      en: 'Carriers have normal vision.',
      ar: 'بصر الحاملين طبيعي.',
    },
    sources: ['doh-pms-2024', 'russell-2017'],
  },
  {
    id: 'pcd',
    genes: ['DNAH5', 'DNAI1', 'DNAI2', 'DNAH11', 'CCDC39', 'CCDC40', 'CCDC103', 'CCDC65', 'DNAAF1', 'DNAAF2', 'DNAAF3', 'DNAAF4', 'DNAAF5', 'DNAAF11', 'DNAL1', 'HYDIN', 'CCNO', 'DRC1', 'GAS8'],
    name: { en: 'Primary ciliary dyskinesia (PCD)', ar: 'خلل الحركة الهدبية الأوّلية' },
    what: {
      en: 'A condition where the tiny hairs that clear the airways do not move properly, leading to repeated chest and ear infections.',
      ar: 'حالة لا تتحرك فيها الشعيرات الدقيقة التي تنظف المجاري التنفسية كما ينبغي، مما يؤدي إلى التهابات متكررة في الصدر والأذن.',
    },
    notChanged: {
      en: 'Carriers are healthy.',
      ar: 'الحاملون أصحّاء.',
    },
    sources: ['doh-pms-2024'],
  },
  {
    id: 'fmf',
    genes: ['MEFV'],
    name: { en: 'Familial Mediterranean fever', ar: 'حمى البحر الأبيض المتوسط العائلية' },
    what: {
      en: 'A condition that causes repeated episodes of fever and pain. It is usually controlled with daily medicine.',
      ar: 'حالة تسبب نوبات متكررة من الحمى والألم، وعادة ما يُسيطَر عليها بدواء يومي.',
    },
    notChanged: {
      en: 'Carriers are usually healthy.',
      ar: 'الحاملون عادة أصحّاء.',
    },
    sources: ['doh-pms-2024'],
  },
];

const BY_ID = new Map(CONDITIONS.map(c => [c.id, c]));
export const conditionById = (id: string): Condition | undefined => BY_ID.get(id);

/** HBB allele classes the lab reports in the finding tag. */
const isSickle = (t?: string) => t === 'HbS';
const isBetaThal = (t?: string) => t === 'b0' || t === 'b+';

/**
 * The condition a child could have if it inherits both parents' variants in this gene.
 * HBB depends on which allele each parent carries.
 */
export function conditionFor(gene: string, tagA?: string, tagB?: string): Condition {
  if (gene === 'HBB') {
    if (isSickle(tagA) && isSickle(tagB)) return BY_ID.get('scd')!;
    if ((isSickle(tagA) && isBetaThal(tagB)) || (isBetaThal(tagA) && isSickle(tagB))) return BY_ID.get('sbthal')!;
    return BY_ID.get('bthal')!;
  }
  const hit = CONDITIONS.find(c => c.genes.includes(gene) && c.id !== 'scd' && c.id !== 'sbthal');
  return hit ?? genericCondition(gene);
}

export function genericCondition(gene: string): Condition {
  return {
    id: `gene:${gene}`,
    genes: [gene],
    name: { en: `A recessive condition linked to ${gene}`, ar: `حالة متنحية مرتبطة بالجين ${gene}` },
    what: {
      en: `Your counsellor will explain what changes in ${gene} mean for a child, and how serious the condition is.`,
      ar: `سيشرح لكما المستشار الوراثي ما تعنيه التغيرات في الجين ${gene} بالنسبة للطفل، ومدى شدة الحالة.`,
    },
    notChanged: {
      en: 'Carriers of recessive conditions are almost always healthy.',
      ar: 'حاملو التغيّرات المرتبطة بالحالات المتنحية أصحّاء في الغالب الأعم.',
    },
    sources: ['doh-pms-2024'],
  };
}
