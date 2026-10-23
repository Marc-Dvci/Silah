# Assumptions, dependencies and limitations

Every chance Silah shows is model-derived: exact arithmetic on stated inputs, under the model below. The figures for the demo family are an example with fictional people and a simulated lab. They are not clinically established individual risks.

## The model

| Situation | What Silah computes | Code |
|---|---|---|
| Both partners carry a change in the same gene | 1 in 4 affected, 2 in 4 healthy carrier, 1 in 4 neither, per pregnancy | `coupleView` |
| Two or more such genes | The chance of at least one condition, 1 − (3/4)^k: 7 in 16 for two genes, not 1 in 4 + 1 in 4 | `atLeastOne` |
| One partner carries, the other tested negative for that gene | Bayes on the partner: the population carrier frequency, plus, for related partners, the chance of sharing the family's change by descent (first cousins 1/8). Each is missed with the detection rate of the test that covered it | `partnerResidual` |
| Both tested negative, every other panel gene | Unrelated: r²/4 per gene. Related: (1 − F)·r²/4 + F·q(1 − d)/(1 − q·d), where F is the child's inbreeding coefficient (first cousins 1/16). The second term is the child inheriting both copies from one copy the parents share, carrying a change the panel misses | `bothNegative` |
| The whole panel | The chance of at least one condition across genes. The rest of the panel enters as its sum, which is never below its own chance of at least one and agrees with it to two significant figures (test) | `coupleView`, `restOfPanel` |

Before 23 October 2026 the both-negative term was r²/4 for every couple, which treats the two partners' remaining carrier chances as independent. For related partners that left out the shared-ancestry term, which is the larger one: for Fatima and Ahmed it moved the rest of the panel from 1 in 13,000 to 1 in 390. The whole-panel figure had also added per-gene chances instead of taking the chance of at least one.

## Assumptions

| Assumption | Value used | Why, and where it shows |
|---|---|---|
| Detection: share of a gene's disease-causing changes the panel finds | **Stated by the lab** in the signed result (`couple.detection`). The simulated lab states 90%. Without it, Silah gives every remaining chance as a range, from 99% down to 80% detection, and never one figure | DoH does not publish per-gene detection rates. It is the input that matters most: from 80% to 99%, Fatima's chance for her own gene moves from 1 in 140 to 1 in 1,300 (`docs/SENSITIVITY.md`). The result screen names where the rates came from |
| Check of a known family change in the partner | **Stated by the lab, gene by gene** (`detection.exactChange`). The simulated lab checks each partner for the other's exact change and states 99%. A gene not listed is treated as covered by the panel only, so the family change is found only as often as any change in that gene | If Ahmed was not checked for Fatima's exact change, her figure is 1 in 140, not 1 in 260 (`tests/kernel.test.ts`) |
| Carrier frequency for panel genes without a published Emirati figure (556 of 563) | 1 in 1,000 | Calibrated, not round. For an untested first-cousin couple, the panel's share of the added chance is F·Σq over the panel genes. Hamamy 2012 gives 1.7 to 2.8 added children in 100 births in all. With the seven published Emirati figures, 1 in 1,000 reaches the top of that range (2.8); 1 in 200 would imply 9.8. The test suite checks this. Labelled "assumed frequency" next to every number that uses it |
| Allele frequency | q = p/2 | From p = 2q(1 − q) for rare changes |
| Genes are inherited independently | Used for the chance of at least one condition | Genes that sit close together on a chromosome (HBA1 and HBA2) are not independent; alpha-thalassaemia results go to a counsellor first |
| Inbreeding coefficient | From the relationship the couple declares (first cousins 1/16) | In families with cousin marriage over several generations, the true coefficient is higher than the declared relationship gives |
| Chance that a relative carries the same change | Coefficient of relationship (sibling 1/2, aunt or uncle 1/4, first cousin 1/8) | A carrier passes the change to each child with chance 1/2 (DoH booklet); Hamamy 2012 prints 1/8 for first cousins. Relatives in consanguineous families can share more |
| Added background chance for first cousins | 1.7 to 2.8 more children in every 100 births | Hamamy 2012 (J Community Genet, open access), which gives "1.7–2.8% higher than the population background risk", "mostly attributable to autosomal recessive diseases", from the NSGC recommendations (Bennett et al. 2002) |
| Background chance of a birth defect | 1 in 33 | CDC |

Published Emirati carrier frequencies used: CYP21A2 10.6%, HBB 9.6%, MEFV 5.9%, ABCA4 4.3%, HBA2 1.8% (Jain et al., Genet Med Open 2025); SMN1 19 in 1,502 newborns (Rabea et al., Commun Med 2024); CFTR from a reported allele frequency of 0.34%.

## Dependencies

- **DoH Premarital Screening Standard V3 (September 2024)**: the gene panel (Appendix 12, 563 genes after mapping to current HGNC symbols), the report wording, the counselling flow and the 90% referral KPI.
- **A signed result format** (`schema/result-bundle.schema.json`) that carries the lab's validated detection rates and, gene by gene, whether the partner was checked for the exact family change. Silah proposes it alongside the existing digital certificate. Integration with DoH, M42 and Malaffi systems is assumed, not built.
- **The Emirati Genome Programme holding sequence data for couples married before the mandate.** More than 900,000 Emiratis have been sequenced (DoH, July 2026). Returning couple results from these genomes needs a DoH policy decision and fresh consent; Silah builds the consent flow, not the policy.
- **A clinic service that acknowledges requests for a person.** The phone says a request was received, and later that a counsellor has seen it, only when the clinic sends those messages (`escalate.received`, `escalate.seen`). In the demo the clinic is simulated in the browser.
- **Models:** Gemma 4 E4B and E2B (Apache-2.0) through llama.cpp or Transformers.js. No model is fine-tuned.
- **Narration:** pre-rendered with Microsoft neural voices (ar-AE-FatimaNeural, en-GB-SoniaNeural). A deployment would license Azure AI Speech.

## Limitations

- **Fictional data.** The family, their genomes and every clinic record are invented. No real person's data was used.
- **Simulated health system.** The lab, counselling clinic, hospital and invitation service run in the browser for the demonstration. The lab's detection rates are example values.
- **Family history is not in the numbers.** The kernel uses the two results and the declared relationship only. Every result says so and asks the couple to tell the counsellor about any genetic condition in either family.
- **Birth-plan conditions.** A birth plan is offered only for conditions with an early-treatment pathway in the condition data (SMA, Krabbe, MLD, Pompe, MPS I, CAH, sickle cell disease and the beta-thalassaemias). For other shared conditions the option reads "a plan made with a specialist for how the baby is checked after birth". The treatment windows come from published trials (NURTURE, SPR1NT, Escolar 2005, Fumagalli 2022, Kishnani 2007, Gaston 1986). Routine newborn screening in Abu Dhabi already covers CAH, sickle cell disease and thalassaemia (DOH/NBSC/SD/V4/2024); SMA, Pompe, MPS I, Krabbe and MLD are not on that standard list. DoH's newborn genetic screening programme (launched 18 August 2025) sequences cord blood with parental consent, screens for more than 815 treatable conditions including SMA, and reports within 21 days; its first phase runs at Kanad Hospital and Danat Al Emarat Hospital, with expansion to all maternity hospitals planned. Silah's birth plan complements it: when the parents' shared change is already known, a targeted test of that one change can answer in the first days, at any delivery hospital. Enrolment figures for the genome programme were not found.
- **Alpha-thalassaemia** (HBA1/HBA2) results always go to a counsellor first, because detection depends on the lab's method for deletions.
- **What the evaluation measures.** The tests and measures in `docs/EVALUATION.md` cover the software and the text: arithmetic, privacy, accessibility, offline use, readability and the model's answers. Understanding, trust and time to counselling in couples are the pilot's measures (`docs/PILOT.md`).
- **Companion evaluation is small** (52 answers per model, on this project's own questions), and its directive, certainty and claim-binding checks are word lists. All transcripts are published in `eval/REPORT.md`.
- **On the phone, the model only chooses.** A person reads the cited fact cards in their fixed, checked words; the model's own wording is never shown (`quoteCards`). The verifier still scores the model's wording in the evaluation. It checks numbers and what they are attached to, and blocks a sentence saying carriers are ill, but other qualitative statements are not checked: for example, Gemma 4 E4B told Fatima "even though you tested negative" when it was her fiancé who did, and Qwen3.5-4B turned "22 of 25 babies treated before symptoms walked" into "early treatment allows most babies to walk". That is why the wording is not shown.
- **Legal texts.** The UAE health data law, the personal data law, the medically assisted reproduction law and Cabinet Resolution No. 44 of 2024 were read through secondary sources; the official gazette was not reachable.
