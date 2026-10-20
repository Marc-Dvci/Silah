# Clinical review and comprehension check: protocol

Neither study has been run yet. This file fixes the method before any data is collected, so that the results can be reported as they come out. Results go in `docs/review/RESULTS.md`, and only once they exist.

## A. Review by a genetic counsellor or clinical geneticist

**What is reviewed.** `STATEMENTS.md` lists all 68 statements Silah can show about risk, conditions, options and hand-offs. It is generated from the app's code (`node eval/statements.mjs`), so it matches what the app shows. Each statement is given in English and Arabic, with its sources and, where it computes a number, the arithmetic.

**Who.** One or more accredited genetic counsellors or clinical geneticists, preferably with practice in the Gulf. Arabic is reviewed by an Arabic-speaking clinician where possible.

**How.** The reviewer fills in `statements_review.csv` (it opens in Excel), with one row per statement:

1. **Correct (yes/no):** is the statement clinically correct for the case shown, number and meaning together?
2. **Non-directive (yes/no):** does it avoid steering a marriage or reproductive decision?
3. **Suggested wording:** if either answer is no.
4. **Comment:** anything else, for example a missing caveat.

Then three questions on the whole:

- Are the two stated assumptions (90% detection, 1 in 200 carrier frequency for genes without an Emirati figure) acceptable for a prototype? `docs/SENSITIVITY.md` shows what each one changes.
- Is any hand-off to a person missing, for example a situation that should never be answered by an app?
- Would you use the pre-visit brief (what the couple understood) in a session?

**Reporting.** The number of statements marked correct and non-directive, every suggested change, and what was changed in the app as a result. Statements are not removed from the count because they were fixed afterwards. The reviewer's name and role are given only with their permission.

## B. Comprehension check with readers (before any pilot)

**Question.** After reading their result, do people understand the four teach-back points better with Silah's result screen than with the current DoH wording?

**Readers.** 16 to 20 adults with no genetics training, half reading in Arabic and half in English where possible. They are not patients and use the fictional demo couples, so no health data is collected.

**Arms.** Each reader is assigned by alternation to one of two arms:

- **Silah:** Mariam's result screen in the demo, for the case of an at-risk couple, and Fatima's, for a couple marked compatible with a remaining chance.
- **Current wording:** the same two results, written as the DoH Standard V3 report wording and information sheet (`eval/readability/doh_appendix5_*.txt`).

**Measure.** The teach-back questions the app itself asks (`src/ui/person/result.tsx`). They are given on paper after reading, without the screen, in the reader's language.

For the at-risk couple:

1. Which picture shows what can happen in each pregnancy? (1 affected, 2 carriers, 1 neither, against two wrong pictures)
2. "If our first child is healthy, the next one will be too." (false)
3. "Being a carrier means I am ill." (false)
4. "The decision about what to do next is ours." (true)

For the compatible couple:

1. "Compatible means there is no chance at all." (false)
2. "The test checks every genetic condition." (false)
3. "Being a carrier means I am ill." (false)
4. "Because we are cousins, our background chance is a little higher than for unrelated parents." (true)

**Analysis.** For each question and in total, the number of correct answers in each arm, reported by language. With fewer than 20 readers this is descriptive only: no p-values, and no claim beyond "in this small group".

**Consent.** Readers agree in writing to answer questions about fictional results. No names are stored with the answers.
