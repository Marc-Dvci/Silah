# Readability across languages and reading levels

Challenge 03 asks for "equitable performance across languages and literacy levels". Before any study with people, Silah's explanations are measured against published readability and risk-communication standards. They are also compared, on the same measures, with the text couples read today: the information sheet in Appendix 5 of the DoH Premarital Screening Standard V3, which couples read and sign before the genetic test (Arabic 5a, English 5b).

Run it: `pip install textstat==0.7.13`, then `python eval/readability/score.py`. Results are written to `eval/readability/results.json`.

## Standards used

| Standard | What it asks | How Silah is checked |
|---|---|---|
| US health-literacy guidance (NIH, CDC: grade 8 or lower; AMA: grade 6 or lower) | Patient materials readable at a lower-secondary level | Flesch-Kincaid grade, Flesch Reading Ease and SMOG on the English explanations |
| OSMAN (El-Haj and Rayson, LREC 2016) | An open readability formula for Arabic. Higher is easier, as with Flesch | Computed on the Arabic explanations and on the DoH Arabic sheet |
| IPDAS risk-communication guidance (Trevena et al., BMC Med Inform Decis Mak 2013) | Natural frequencies ("1 in 4") over percentages, the same denominator for outcomes compared side by side, pictures of risk, and uncertainty stated | Counted in the text, and checked screen by screen (below) |
| ISO 24495-1:2023, Plain language | Readers can find what they need, understand it and use it | Short sentences, one idea per card, the action next to the explanation |

## Results

Silah: the 35 fixed explanations per language that the app shows and narrates (the fact cards for every family in the demo). DoH: the 24 sentences of Appendix 5. The Arabic sheet was transcribed from the PDF, because text extraction reverses many of its right-to-left lines. Its wording was kept as printed.

| | Silah EN | DoH EN | Silah AR | DoH AR |
|---|---|---|---|---|
| Words per sentence | 13.3 | 24.1 | 12.0 | 23.0 |
| Sentences over 25 words | 1 of 93 | 12 of 24 | 0 of 90 | 8 of 24 |
| Flesch-Kincaid grade (lower is easier) | **6.4** | 14.2 | | |
| Flesch Reading Ease (higher is easier) | 72.7 | 36.5 | | |
| SMOG grade | 10.2 | 16.2 | | |
| OSMAN (higher is easier) | | | **83.4** | 67.4 |
| Letters per word | | | 4.49 | 4.91 |
| Chances written as "1 in N" | 15 | 0 | 15 | 0 |
| Chances written as a percentage | 1 | 1 | 1 | 1 |

- **English** meets the NIH and CDC target (grade 8 or lower) and sits just above the AMA's grade 6. The DoH sheet reads at university level (grade 14).
- **Arabic** scores higher on OSMAN than the DoH Arabic sheet, with sentences about half as long.
- **The two languages are at the same level**: 13.3 and 12.0 words per sentence, with every number in the same form in both.
- The SMOG grade stays near 10 because the subject needs words such as *pregnancy*, *condition* and *chromosome*. The narration and the pictures carry the meaning for people who read less easily.

The measures were used to rewrite text, not just to report on it. On 19 October 2026, the five hardest sentences were split or reworded. One of them was the cousin background chance, which is now written as "1.7 to 2.8 more children in every 100 births" instead of "percentage points". That moved English from grade 7.3 to 6.9 and Arabic OSMAN from 81.7 to 84.1. On 23 October 2026 the new sentences (shared ancestry, family history, the birth-plan option) were measured and split the same way: English moved from 7.2 to 6.4 and Arabic OSMAN from 81.5 to 83.4.

## Risk communication checks (IPDAS)

| Recommendation | In Silah |
|---|---|
| Natural frequencies, not percentages | Every chance a person sees is a natural frequency ("1 in 4", "1.7 to 2.8 more in every 100 births"). The one percentage is a trial result (84% fewer infections) |
| Same denominator when outcomes are compared | The four outcomes of a pregnancy are all "in 4" (1, 2, 1) |
| A picture of the risk | Four children for each pregnancy. For a compatible couple, a field of dots with one marked dot: 1 in 160 for Fatima and Ahmed, for any panel condition |
| Several formats | Words, numbers, the picture and narration for each explanation |
| The person's own situation | Every number comes from the couple's own result, relationship and genes |
| Context | The 1 in 33 background chance that applies to every couple is shown beside the couple's own chance |
| Uncertainty | The remaining chance after a negative test, what the test cannot see, and every assumption, labelled where it is used |
| No steer | Options at equal weight in a fixed order. A verifier removes directive or certain sentences from model answers |

## For people who read less easily

- Every fixed explanation can be heard, in Arabic or English (70 recordings).
- The picture carries the main message without reading: four children for each pregnancy.
- Larger text is one switch away. Arabic-Indic digits are available.
- Four short questions check understanding, and a person can share the answers so the counsellor starts where the person is.

## Limits

Readability formulas measure words and sentences, not understanding. OSMAN has no official grade scale, so the Arabic result is shown as a comparison with the DoH sheet, not as a grade. Only a study with people can show that understanding improves. The study is in `docs/PILOT.md`: the four teach-back questions asked by a researcher, Silah against the current report, reported by language and by reading confidence.
