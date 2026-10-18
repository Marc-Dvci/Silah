# Arabic review: Silah (Future Health Challenge prototype)

Companion to `arabic_review.json` (74 findings: 15 error, 36 important, 23 minor). Each JSON entry gives the file, line, English source, the exact current Arabic, a complete replacement, and the reason. Every `current` value was found verbatim in the working tree at its listed line. Six entries share identical text with another line in the same file (noted in their reasons); apply those by line number.

## Overall quality

The Arabic is generally clear, grammatical modern standard Arabic, and it already uses DoH's own terms where they matter: متوافق / عدم توافق, مستشار وراثي, أبناء العمومة أو الخؤولة, and the 1 من 4 ordering. Numbers match the English in every fixed sentence checked (1 من 4, 2 من 4, 22 من 25, 84%, 1.7 إلى 2.8 نقطة مئوية, 1 من 33, and the 563-gene count). The weak points are systematic rather than local:

1. Gender. The default `ar` is feminine by design, but a large number of person-facing strings use masculine second-person verbs, adjectives or imperatives with no `arM`, so women see masculine forms in labels and sentences, and men do not get a masculine form at all. The relative page and the route replies have no sex in context, so neutral wording is used there.
2. The word حمل. In Arabic it means both "carry" (as a carrier) and "pregnancy". Several carrier sentences read as "your pregnancy", and a bare حامل often means "pregnant".
3. Anonymity overpromise. "without saying it came from you" is rendered as "without them knowing", which the app cannot guarantee (four places, two with arM pairs).
4. Dual versus plural for the couple, and a few verb agreement slips.

## Top 10 problems

1. Carrier wording that reads as pregnancy: `حامل سليم` (result, Kids label), `حاملاً` (conditions SMA, sbthal; kernel couple card), `حملك` (kernel carrier card), `احتمال حمل التغيّر` (relative invitation), `حامل للجين` (faq label), `الحامل لديه` (faq lead), `حالة الحمل للجين` (result receipt and privacy), `نتيجة حمل لجين` and `نتائج الحمل للجينات` (privacy), `حمل التغيّر` (teach-back question, twice).
2. Masculine imperatives and verbs with no arM: اطرح (ask, shell), استمع (four buttons, plus the "listen to this page" label), اسأل, اكتب, المس, انتقل, اتصل, افتح and لترى, أحضر (relative), and the routes (distress: تحمل, مضطراً, كنت, فاتصل; religion: تثق, رغبت), relative page (تعرف), counsellor-check (اخترت, وصلت), ask (تقرره).
3. Dual or plural errors: `كلاكما يحمل` (kernel couple card; needs تحملان), `لكم` for the couple (conditions generic card; needs لكما), `معكم` (VUS card; needs معكما).
4. Relative names: "ابن العم أو الخال" is male-only and reads as "uncle's son or maternal uncle" (first cousin); "ابن الأخ أو الأخت أو ابنتهما" misstates niece/nephew; "غير الشقيقين" (half-sibling) is a wrong dual.
5. Anonymity: "دون أن يعرف" (without knowing) is used where the English says "without saying it came from you" (home family line + arM, journey h2 + arM, routes other-person). The relative page's own text says the invitation does not say who sent it, so the Arabic should match that.
6. Consanguinity (latent): the non-first-cousin card says the risk is "slightly higher" and "lower than for first cousins". That is false for double-first-cousins (coefficient 1/8, versus 1/16 for first cousins). No UI offers that relationship yet, but the type allows it. The card needs its own text and the English must change too.
7. Numeral agreement: `بعد نحو N أسبوعاً` is wrong for 3 to 10 weeks. The demo (Noura, 9 weeks) shows the wrong form now. Counts of signed records and blocked sentences have the same issue (one, two, three to ten, eleven or more).
8. Fidelity in the sickle-cell penicillin sentence: "العدوى الرئوية الخطيرة" (serious lung infections) should be pneumococcal infections (العدوى الخطيرة بالمكوّرات الرئوية); "by four months" becomes "بحلول سن أربعة أشهر".
9. Non-standard or misspelled forms: `الأولي` (should be الأوّلية, agreeing with الحركة), `شوركت معك` (privacy heading; use ما تمت مشاركته معك), `أحضر` (imperative lost).
10. Typography: a kashida is placed after prefixes (`بـ${name}` in the couple card, `ولـ${partner}` on the invitation, `لـ${genes}` in the birth-plan line). The prefix should attach directly (`ب`, `ول`, and `يُفحص ... بحثاً عن`).

## Glossary (English to recommended Arabic)

| English | Recommended Arabic | Note |
|---|---|---|
| carrier (person) | حامل للتغيّر الجيني, or يحمل تغيّراً في الجين | Never bare حامل or حمل in carrier sense. DoH uses حامل لصفة وراثية مرضية. |
| carrier status (receipt) | حالة التغيّر في الجين X | Replaces حالة الحمل. |
| healthy carrier | حامل للتغيّر وسليم | |
| gene change / variant | تغيّر في الجين | Plain Arabic. DoH's consent form uses طفرة; keep تغيّر for lay readers. |
| recessive | متنحٍ / متنحية | DoH: متنحي. |
| dominant | سائد | DoH: سائد. |
| compatible / not compatible | متوافق / غير متوافق | DoH: التوافق / عدم توافق. |
| residual risk | الاحتمال المتبقي | Already used. |
| panel | لوحة ما قبل الزواج | |
| genetic counsellor | مستشار وراثي | DoH Appendix 13. |
| clinical geneticist | أخصائي علم الوراثة الإكلينيكي | DoH wording. |
| IVF | أطفال الأنابيب | Already used. |
| PGT / preimplantation testing | الفحص الجيني قبل الزرع | Already used. |
| prenatal testing | الفحص أثناء الحمل | |
| CVS | عينة من المشيمة | Already used. |
| amniocentesis | عينة من السائل الأمنيوسي | Already used. |
| newborn screening | فحص حديثي الولادة | DoH: الفحص الروتيني لحديثي الولادة. |
| spinal muscular atrophy | ضمور العضلات الشوكي | |
| congenital adrenal hyperplasia | تضخم الغدة الكظرية الخلقي | Acceptable. |
| thalassaemia (beta major / minor) | الثلاسيميا بيتا الكبرى / الثلاسيميا الصغرى | |
| sickle cell disease / trait | فقر الدم المنجلي / السمة المنجلية | DoH: الأنيميا المنجلية. |
| Krabbe | داء كرابي | |
| metachromatic leukodystrophy | (unsure, see below) | |
| Pompe | داء بومبي | |
| MPS I | داء عديدات السكاريد المخاطية، النوع الأول | Plural form, unsure. |
| primary ciliary dyskinesia | خلل الحركة الهدبية الأوّلية | Agreement fixed. |
| familial Mediterranean fever | حمى البحر الأبيض المتوسط العائلية | |
| cystic fibrosis | التليّف الكيسي | Already used. |
| inherited retinal dystrophy | ضمور الشبكية الوراثي | Already used. |
| consanguinity (first cousins) | أبناء العمومة أو الخؤولة من الدرجة الأولى | Matches DoH القرابة. |
| chromosome abnormality | الاختلالات الصبغية | DoH: خلل بالصبغيات. |
| X-linked | المرتبطة بالصبغي X | |
| pregnancy | حمل, حامل (pregnant woman) | Use these only for pregnancy. |
| "Listen" button | استماع | Noun, works for both genders. |
| "Ask" / "Ask a question" | إرسال / طرح سؤال | Noun forms. |

## Unsure, to verify before release

- Metachromatic leukodystrophy: `حثل المادة البيضاء متبدّل اللون` is not a term I could confirm for UAE or DoH material. Check with an Arabic-speaking geneticist.
- MPS I: the plural form `عديدات` is my preference; `عديد السكاريد المخاطي` also appears in some texts.
- Familial Mediterranean fever: the proposed name is the usual one; not checked against DoH.
- Gene count: the app says 563 (matches the 563 unique symbols in `src/core/data/panel.ts`, which cites DoH Appendix 12). DoH's FAQ (text line 702) says "570 جينًا". Verify before publishing.
- "عيب خلقي" (birth defect) in the background card: kept as the standard term; check whether DoH prefers a softer phrasing.
- Pompe: "يتراكم فيها السكر" simplifies glycogen to sugar, matching the English. Kept.
- Result screen, certificate quote: the Arabic quote is DoH's own Arabic line, and the English quote is from the English text; the two DoH versions differ slightly. Left as is.
- "أعلى قليلاً" for second cousins and once-removed cousins: the direction is right, but the size word was not checked against the coefficients beyond the code.
- Partner sentences: `ar` is written for a male partner (the viewer is a woman) and `arM` for a female partner. This is consistent with opposite-sex couples in the demo, but it breaks if a same-sex couple is ever shown.

## Not in the JSON: matcher and build notes (Arabic-related, not display strings)

- `src/core/faq.ts`, `chance` intent: the pattern `كم` also matches inside `كلاكما` and `كما`. Checked: "هل يمكن لكلاكما أن تختارا بحرية؟" is routed to the chance card. Fix: match `كم` as a whole word after normalisation.
- The faq and route regexes run on the normalised question (ة to ه, أ to ا, diacritics removed); the Arabic patterns I read are written in that normalised form.

## Scope and repo state

- Reviewed in full: src/core/conditions.ts, kernel.ts, routes.ts, faq.ts; src/llm/answer.ts; src/app/demo.ts; src/ui/person/home.tsx, result.tsx, journey.tsx, privacy.tsx, ask.tsx, shell.tsx, sources.tsx; src/ui/relative.tsx. Also the DoH text (appendices 5a, 7, 9, 13 and the FAQ) for terms.
- result.tsx, journey.tsx, privacy.tsx and shell.tsx have uncommitted edits in the working tree (another session is changing them). The line numbers in the JSON match the working tree as of this review; re-run the check before applying.
- Not reviewed (outside the list): src/ui/kit.tsx (modified, has new strings), src/app/person.ts (HOSPITAL object: 'مستشفى الكورنيش، قسم الولادة' reads correctly in the birth-plan sentence), src/core/verifier.ts.
- No source file was edited. Only `docs/research/arabic_review.json` and this file were written.
