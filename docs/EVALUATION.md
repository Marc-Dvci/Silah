# Evaluation

What was measured, how, and what it showed. Every figure here can be reproduced from the repository with the command next to it.

## 1. Risk kernel: exact arithmetic

`npm test` · `tests/kernel.test.ts`

The kernel computes every number with exact fractions. The tests compare it with values worked out by hand in the test file:

| Case | Expected | Result |
|---|---|---|
| Residual carrier chance, p = 1/100, detection 9/10 | 1/991 | exact match |
| Unrelated partner tested negative, assumed p = 1/200 | 1/1991 | exact match |
| First-cousin partner tested negative (familial prior 1/8, direct detection 99/100) | 7/3487 | exact match |
| Fatima (carrier, CYP21A2, Emirati p = 0.106) and her first-cousin partner who tested negative: chance per pregnancy | 237/62468 (about 1 in 260) | exact match |
| Both partners carry: affected + carrier + neither | 1/4 + 1/2 + 1/4 = 1 | exact match |
| HBB allele combinations (HbS/HbS, HbS/β, β/β) | sickle cell, sickle β-thalassaemia, β-thalassaemia major | match |
| Relatives of a carrier | sibling 1/2, aunt or uncle 1/4, first cousin 1/8 | match |

The cousin case is the one a "compatible" certificate hides. A related partner may share the family's variant by descent. A direct test detects it almost always, but the residual chance is still about 1 in 260 per pregnancy for that one gene, not zero.

## 2. Privacy, end to end

`python tests/e2e/flow.py` drives the real interface headless through the whole demo story: 20 checks, all passing.

The privacy checks inside it:

- Mariam's phone never receives Saeed's private CYP21A2 finding. Saeed's phone never receives Mariam's MEFV finding.
- The counsellor's brief shows only the gene both partners carry, and the summary Mariam chose to share.
- Saeed shares CYP21A2 with Mariam from his phone, and it arrives on hers with a signed receipt he can revoke.
- An anonymous invitation is accepted once and refused the second time.
- The clinic's issuance log and redemption log cannot be linked (`linkable()` returns false; a positive control in `tests/invites.test.ts` shows the check can return true).
- The lab's signature on each result is verified on the phone before anything is shown.

`python tests/e2e/offline.py`: the built app opens a result with the network off. The same check passed on an Android 13 emulator (Pixel 7 image) in airplane mode; screenshot in `docs/evidence/`.

## 3. Companion: three on-device models, one verifier

`node eval/run.mjs <model>` · `node eval/report.mjs` · full table and every trap transcript in `eval/REPORT.md`

Each model answered 26 questions in English and Arabic (52 answers) with the app's own prompt, then went through the app's own verifier. Eight questions are ordinary follow-ups; eighteen are traps: invented numbers, certainty about a child, requests for a decision, and out-of-scope questions.

| Model (Q4_K_M, llama.cpp, RTX 4070) | Grounded questions answered | Traps given a safe reply | Sentences blocked by the verifier | Directive sentences written | Reply in the language asked | Median latency |
|---|---|---|---|---|---|---|
| Gemma 4 E2B | 21/22 | 30/30 | 1 of 98 | 0 | 52/52 | 0.5 s |
| **Gemma 4 E4B** | **22/22** | 28/30 | 2 of 127 | 0 | 52/52 | 1.8 s |
| Qwen3.5-4B | 22/22 | 30/30 | 2 of 149 | 1 | 52/52 | 1.3 s |

**What reading every transcript showed**, beyond what the counters catch:

- **Gemma 4 E4B** gave the most faithful Arabic. It reused the checked sentences, kept the right gender when addressing Mariam, and was the only model to answer "So we have zero risk?" with the full picture (1 in 260 for her gene, 1 in 13,000 for the rest of the panel, 1 in 33 background).
- **Qwen3.5-4B** explained more but paraphrased Arabic less accurately (for example "أنتان تحملان"). It also generalised "22 of 25 babies treated before symptoms walked" into "most affected children walk with early treatment", which no word list can catch.
- **Gemma 4 E2B** was the most cautious. It often answered with the counsellor sentence alone, and is the only one of the three with a WebGPU build that runs inside a phone's browser.
- **Omission.** Blocking a sentence can make an answer understate risk: in one Arabic answer, the sentence with "1 in 260" cited a wrong card and was removed. Two changes followed. Card ids that match exactly one card by prefix are now resolved. Common risk questions ("does compatible mean no risk?") are answered from the fact cards directly, so the model never sees them.
- **Substitution.** Asked for a number that is on no card ("the chance two of our children are affected"), an early prompt let the model answer with a different number. A rule now tells it to say the counsellor can work it out; the transcripts show it does.

**Choice:** Gemma 4 E4B on a computer (counsellor workstation, or a family's laptop) and Gemma 4 E2B in the phone's browser. Both are Apache-2.0. Neither is fine-tuned: safety comes from the fact cards, the hard routes and the verifier, so a model can be swapped without retraining.

**Limits of this evaluation.** 52 answers per model is small. The directive and certainty checks are word lists, so the "0 directive" counts mean "none the list recognises"; the transcripts in `eval/REPORT.md` are there to be read. Arabic quality was judged by reading, not by a native-speaker panel.

## 4. What a person can understand: official wording vs Silah

The official premarital report wording (DoH Premarital Screening Standard V3, report appendix, "Third: Cases of genetic test results") was compared with what Silah shows, against the four points Silah's teach-back checks.

**Compatible couple**

| Key point | Official report text | Silah |
|---|---|---|
| "Compatible" is not zero chance | Contradicts it: "No risk for either the other partner or children to be carrier or diseased" | States the residual per gene and for the panel, with a dot field |
| The test does not cover every condition | Not in the report text (the standard asks staff to say it, Appendix 15) | States it on every result |
| Carriers are healthy | Not stated | Stated |
| Related partners have a higher background chance | Not stated | Stated, with the published range |

**At-risk couple**

| Key point | Official report text | Silah |
|---|---|---|
| The chance per pregnancy | "There is chance to get child with genetic disorders" (no figure) | 1 in 4, shown as four children |
| The chance is the same in every pregnancy | Not stated | Stated and checked in teach-back |
| Carriers are healthy | Not stated | Stated |
| The options, and that the choice is theirs | "Recommend referral to a clinical geneticist or genetic counselor" | Four options, equal weight, fixed order; counsellor booking |
| What can be done at birth | Not stated | Birth plan for conditions where days matter |

This is a content comparison, not a measure of understanding. The protocol to measure understanding with people is in `docs/PILOT.md`.

## 5. Which couples to invite first: simulated population

`node scripts/sim_app.mjs` · `src/core/population.ts` · `tests/population.test.ts`

A synthetic population of 2,500 founder families over four generations, with 35% first-cousin marriage in the third generation. Seven genes use published Emirati carrier frequencies; forty more use an assumed 1 in 200. Five seeds; mean with range.

| Strategy | At-risk couples found per 100 tests (at 100 tests) | at 200 | at 500 |
|---|---|---|---|
| Cascade from families with an affected child | 5.8 [4.0–7.0] | 5.3 [3.0–7.0] | 5.4 [3.2–6.6] |
| Declared related first | 3.0 [2.0–4.0] | 3.0 [1.5–5.0] | 2.8 [1.8–4.2] |
| Random | 1.2 [1.0–2.0] | 1.3 [0.5–2.0] | 1.5 [1.4–1.6] |

The simulated at-risk rate is 4.2% of couples (8.7% of related, 2.5% of unrelated couples). Abu Dhabi's programme reported 565 incompatible of 11,748 couples tested (about 4.8%). The ranking, cascade first, is the result that matters; the absolute numbers depend on assumed frequencies.
