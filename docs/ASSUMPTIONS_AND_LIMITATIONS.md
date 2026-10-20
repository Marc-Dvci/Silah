# Assumptions, dependencies and limitations

## Assumptions

| Assumption | Value used | Why, and where it shows |
|---|---|---|
| Carrier frequency for panel genes without a published Emirati figure (556 of 563) | 1 in 200 | A round default, not an upper bound: at 1 in 100 the rest-of-panel figure is about 2.4 times higher (`docs/SENSITIVITY.md`). Labelled "assumed frequency" next to every number that uses it |
| Share of a gene's pathogenic variants the panel detects | 90% | DoH does not publish per-gene detection rates; lower detection gives a higher, more cautious residual. It is the assumption that matters most: from 80% to 99%, Fatima's chance for her own gene moves from 1 in 140 to 1 in 1,300 (`docs/SENSITIVITY.md`) |
| Detection of a known family variant tested directly | 99% | Targeted detection is near-certain; not 100% so the residual is never zero |
| Chance that a relative carries the same variant | Coefficient of relationship (sibling 1/2, aunt or uncle 1/4, first cousin 1/8) | A carrier passes the change to each child with chance 1/2 (DoH booklet); Hamamy 2012 prints 1/8 for first cousins. Relatives in consanguineous families can share more |
| Added background chance for first cousins | 1.7 to 2.8 percentage points | Hamamy 2012 (J Community Genet, open access), which gives "1.7–2.8% higher than the population background risk" from the NSGC recommendations (Bennett et al. 2002) |
| Background chance of a birth defect | 1 in 33 | CDC |

Published Emirati carrier frequencies used: CYP21A2 10.6%, HBB 9.6%, MEFV 5.9%, ABCA4 4.3%, HBA2 1.8% (Jain et al., Genet Med Open 2025); SMN1 19 in 1,502 newborns (Rabea et al., Commun Med 2024); CFTR from a reported allele frequency of 0.34%.

## Dependencies

- **DoH Premarital Screening Standard V3 (September 2024)**: the gene panel (Appendix 12, 563 genes after mapping to current HGNC symbols), the report wording, the counselling flow and the 90% referral KPI.
- **A signed result format.** Silah proposes a lab-signed bundle delivered with the existing digital certificate. Integration with DoH, M42 and Malaffi systems is assumed, not built.
- **The Emirati Genome Programme holding sequence data for couples married before the mandate.** More than 900,000 Emiratis have been sequenced (DoH, July 2026). Returning couple results from these genomes needs a DoH policy decision and fresh consent; Silah builds the consent flow, not the policy.
- **Models:** Gemma 4 E4B and E2B (Apache-2.0) through llama.cpp or Transformers.js. No model is fine-tuned.
- **Narration:** pre-rendered with Microsoft neural voices (ar-AE-FatimaNeural, en-GB-SoniaNeural). A deployment would license Azure AI Speech.

## Limitations

- **Fictional data.** The family, their genomes and every clinic record are invented. No real person's data was used.
- **Simulated health system.** The lab, counselling clinic, hospital and invitation service run in the browser for the demonstration.
- **Birth-plan conditions.** The treatment windows come from published trials (NURTURE, SPR1NT, Escolar 2005, Fumagalli 2022, Kishnani 2007, Gaston 1986). Routine newborn screening in Abu Dhabi already covers CAH, sickle cell disease and thalassaemia (DOH/NBSC/SD/V4/2024); SMA, Pompe, MPS I, Krabbe and MLD are not on that standard list. DoH's newborn genetic screening programme (launched 18 August 2025) sequences cord blood with parental consent, screens for more than 815 treatable conditions including SMA, and reports within 21 days; its first phase runs at Kanad Hospital and Danat Al Emarat Hospital, with expansion to all maternity hospitals planned. Silah's birth plan complements it: when the parents' shared change is already known, a targeted test of that one change can answer in the first days, at any delivery hospital. Enrolment figures for the genome programme were not found.
- **Alpha-thalassaemia** (HBA1/HBA2) results always go to a counsellor first, because detection depends on the lab's method for deletions.
- **No clinical validation.** Silah has not been tested with patients or counsellors. Comprehension is assessed by a content comparison and by readability measures in both languages (`docs/READABILITY.md`), which measure text, not understanding; the protocol for a real study is in `docs/PILOT.md`. A clinician's review of all 68 statements the app can show, and a small comprehension check with readers, are set out in `docs/review/REVIEW_PROTOCOL.md`. The statements are listed for review in `docs/review/STATEMENTS.md`. Neither study has been run.
- **Companion evaluation is small** (52 answers per model), and its directive, certainty and claim-binding checks are word lists. All transcripts are published in `eval/REPORT.md`.
- **The verifier checks numbers and what they are attached to, not clinical meaning in general.** Each chance must be the one a cited card gives for that outcome and that person. A sentence saying carriers are ill is blocked. Other medical statements with no number are not checked. For this reason the fixed, cited fact cards answer the common questions, and the on-device model is optional (`docs/EVALUATION.md`, section 3).
- **Legal texts.** The UAE health data law, the personal data law, the medically assisted reproduction law and Cabinet Resolution No. 44 of 2024 were read through secondary sources; the official gazette was not reachable.
