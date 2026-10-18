# Clinical source check

Checked 18 October 2026. The machine-readable version is `sources_clinical.json` in this folder.

Method: abstracts came from Europe PMC records, which carry the same PMIDs and DOIs as PubMed. Open-access full texts came from PMC. PubMed, Springer, ASH and AAP pages returned blocks or 403 to the fetch tool, so they were not read directly. Quotes from the CDC and FDA pages were extracted by the fetch tool, so re-check their wording in a browser before submission.

Summary: 13 of 18 records are verified as written. Five are not verified: Bennett 2002 (risk figures), Chien 2009 (ventilator-free survival), Aldenhoven 2015 (age threshold), Speiser 2018 (crisis timing), and TIF 2021 (transfusion onset age).

---

## 1. Bennett 2002 (bennett-2002): NOT VERIFIED for the risk figures

Citation: Bennett RL, Motulsky AG, Bittles A, et al. Genetic counseling and screening of consanguineous couples and their offspring: recommendations of the National Society of Genetic Counselors. J Genet Couns. 2002;11(2):97-119.
DOI 10.1023/A:1014593404915. PMID 26141656 (Europe PMC record).

Facts from the abstract:
- The paper covers couples related as second cousins or closer.
- Beyond a thorough family history, no extra preconception screening is recommended. Couples get the same ethnicity-based screening as any couple of their group.

Not verified:
- The 1.7-2.8% excess risk and the 2-3% baseline do not appear in the abstract. They come only from a secondary 2017 slide deck. A fact sheet gives 4.4% for the same paper.
- Do not state these figures until the full text is read.

Related and verified: the 1999 companion paper (PMID 11258630) reports quoted first-cousin risk figures from 0.25% to 20%.

---

## 2. CDC birth defects (cdc-birth-defects-1-in-33): VERIFIED

Official page: https://www.cdc.gov/birth-defects/resources/index.html
Exact wording: "About 1 in 33 babies is born with a birth defect."

The page gives no year or period for the figure. Do not use the 2004 archived CDC page, which gives 150,000 births a year.

---

## 3. SMA presymptomatic treatment (strauss-2022-2copy, devivo-2019-nurture, strauss-2022-3copy): VERIFIED, with corrections

Strauss KA et al. Nat Med 2022;28(7):1381-1389. PMID 35715566. DOI 10.1038/s41591-022-01866-4. This is the two-copy paper.
- 14 children with two SMN2 copies, treated at 6 weeks of life or younger.
- All 14 sat independently for at least 30 seconds by 18 months. 11 of them were within the normal window (P < 0.001).
- All survived without permanent ventilation at 14 months. 13 kept weight at or above the 3rd WHO percentile through 18 months.
- Correction: the two-copy abstract reports sitting, not walking. Median age at first sitting was 265 days (range 172-354), per the full text.

Strauss KA et al. Nat Med 2022;28(7):1390-1397. PMID 35715567. DOI 10.1038/s41591-022-01867-3. This is the three-copy paper.
- 15 children with three copies. All stood independently before 24 months. 14 walked independently.
- Ten of 15 (67%) kept weight without feeding support through 24 months.

De Vivo DC et al. Neuromuscular Disorders 2019;29(11):842-856. PMID 31704158. DOI 10.1016/j.nmd.2019.09.007. This is the NURTURE study.
- 25 presymptomatic infants treated with nusinersen. 15 had two SMN2 copies and 10 had three.
- Treated at 6 weeks old or younger. Median age at first dose 22.0 days (range 3-42), per the full text.
- All 25 sat without support. 23 of 25 (92%) walked with assistance. 22 of 25 (88%) walked independently.
- All were alive at the last visit (median age 34.8 months). None needed tracheostomy or permanent ventilation.
- Single-arm study with no concurrent control.

---

## 4. Krabbe disease (escolar-2005): VERIFIED

Escolar ML et al. N Engl J Med 2005;352(20):2069-2081. PMID 15901860. DOI 10.1056/NEJMoa042604.
- 11 asymptomatic newborns were transplanted at 12 to 44 days of age.
- 14 symptomatic infants were transplanted at 142 to 352 days of age.
- Survival was 100% in the newborns and 43% in the symptomatic infants. Engraftment was 100% in both.
- Infants transplanted before symptoms had progressive myelination and mostly age-appropriate cognition. A few had language and motor delays.
- Children transplanted after symptoms had minimal neurologic improvement.

---

## 5. Metachromatic leukodystrophy (fumagalli-2022, fda-lenmeldy-2024): VERIFIED, with one correction

Fumagalli F et al. Lancet 2022;399(10322):372-383. PMID 35065785. DOI 10.1016/S0140-6736(21)02017-1.
- 29 treated children with pre-symptomatic or early-symptomatic early-onset MLD, compared with 31 untreated matched patients.
- At 2 years, gross motor function was better than controls by 66% (95% CI 48.9-82.3) in late-infantile and 42% (95% CI 12.3-71.8) in early-juvenile MLD.
- The full text describes benefit in pre-symptomatic late-infantile patients.
- Correction: the abstract does not say late-infantile. The 66% figure covers all late-infantile patients, of whom 15 of 16 were pre-symptomatic at treatment. It is not a pre-symptomatic-only figure.
- 26 treated patients were alive, with median follow-up 3.16 years (range 0.64-7.51).

FDA approval of Lenmeldy (FDA press release, 18 March 2024):
- Indicated for "pre-symptomatic late infantile, pre-symptomatic early juvenile or early symptomatic early juvenile" MLD. This matches your list.
- Evidence: 37 children in two single-arm trials and an expanded access program, compared with untreated natural history.
- URL: https://www.fda.gov/news-events/press-announcements/fda-approves-first-gene-therapy-children-metachromatic-leukodystrophy

---

## 6. Infantile-onset Pompe disease (kishnani-2007, chien-2009)

Kishnani-2007: VERIFIED. Kishnani PS et al. Neurology 2007;68(2):99-109. PMID 17151339. DOI 10.1212/01.wnl.0000251268.41188.04.
- 18 patients, diagnosed at 6 months of age or younger. All 18 survived to 18 months.
- Against an untreated historical control: risk of death reduced by 99%. Death or invasive ventilation reduced by 92%. Death or any ventilation reduced by 88%.
- Correction: the 6-month figure is age at diagnosis, not exact age at first infusion. Ventilator-free survival is not a stated endpoint.

Chien-2009: NOT VERIFIED for ventilator-free survival. Chien YH et al. Pediatrics 2009;124(6):e1116-e1125. PMID 19948615. DOI 10.1542/peds.2008-3667.
- Verified: 6 of 206088 newborns screened were positive and treated. Five had the rapidly progressive form and were treated soon after diagnosis. The sixth started treatment at 14 months.
- Verified: survival was significantly better than in the untreated reference cohort (P = .001).
- Not verified: ventilator-free survival is not in the abstract. The full text was blocked (403). Do not state it.

---

## 7. MPS I Hurler (aldenhoven-2015): NOT VERIFIED for the age threshold

Aldenhoven M et al. Blood 2015;125(13):2164-2172. PMID 25624320. DOI 10.1182/blood-2014-11-608075.
- 217 patients engrafted, with median follow-up age 9.2 years.
- A younger age at transplant was a major predictor of better cognitive development.
- The abstract gives no numeric age threshold. The full text was blocked (403). Do not state a threshold such as 2 years.

---

## 8. Congenital adrenal hyperplasia (speiser-2018): NOT VERIFIED for crisis timing

Speiser PW et al. J Clin Endocrinol Metab 2018;103(11):4043-4088. PMID 30272171. DOI 10.1210/jc.2018-01865.
- Verified from the full text: in 75% of severe cases, salt wasting, failure to thrive, and potentially fatal hypovolemia and shock.
- Verified: missed diagnosis is associated with early neonatal morbidity and mortality.
- Verified: newborn screening "can mitigate these complications." It does not say it prevents them.
- Verified: Recommendation 1.1 says all newborn screening programs should include CAH.
- Not verified: "typically in the first weeks of life" for crisis timing. Not found in the full text. Do not state it.
- Correction: the phrase "universal newborn screening" comes from the 2010 guideline abstract (PMID 20823466), not this 2018 guideline.

---

## 9. Sickle cell disease penicillin (gaston-1986): VERIFIED, with two corrections

Gaston MH et al. N Engl J Med 1986;314(25):1593-1599. PMID 3086721. DOI 10.1056/NEJM198606193142501.
- 84% reduction in the incidence of infection on penicillin vs placebo (13 of 110 placebo vs 2 of 105 penicillin; P = 0.0025).
- Children under 3 years at entry. Penicillin V potassium 125 mg twice daily.
- Correction 1: the paper says prophylaxis should start "by four months of age," not 2-4 months.
- Correction 2: the 84% is a reduction in the incidence of infection. The endpoint was documented pneumococcal septicemia. Do not describe it as all pneumococcal infections.

---

## 10. RPE65 gene therapy (russell-2017, fda-luxturna-2017): VERIFIED

Russell S et al. Lancet 2017;390(10097):849-860. PMID 28712537. DOI 10.1016/S0140-6736(17)31868-8.
- Phase 3 trial in participants aged 3 years or older with biallelic RPE65 mutations.
- The primary endpoint was 1-year change in MLMT, which measures functional vision at light levels. Improvement was 1.8 light levels vs 0.2 in controls (difference 1.6; 95% CI 0.72-2.41; p = 0.0013).
- 13 of 20 treated participants (65%) passed at the lowest light level. No controls did.
- It improves functional vision, not visual acuity.

FDA approval year 2017 (Luxturna):
- Verified from FDA-hosted text. The FDA Summary Basis is dated 18 December 2017.
- The news-release URL returned 404 on direct fetch. Re-check the link.
- The exact day (12/19/2017 per a search summary of the FDA orphan database) is not confirmed on an official page.

---

## 11. Beta-thalassaemia major (tif-2021): NOT VERIFIED for transfusion onset

Farmakis D et al. HemaSphere 2022;6(8):e732. PMID 35928543. DOI 10.1097/HS9.0000000000000732. This summarises the 4th edition (2021).
- Verified: the 4th edition was published in 2021.
- Not verified: "transfusion dependence starts in the first 2 years of life." Not found in the full text. The 5th edition summary (HemaSphere 2025, PMID 40045934) also has no onset statement.
- Correction: the request's author list does not match this guideline. Use Farmakis, Porter, Taher, Cappellini, Angastiniotis, Eleftheriou.

---

## 12. BRIDGE trial (kaphingst-2024-bridge): VERIFIED, with corrections

Kaphingst KA et al. JAMA Netw Open 2024;7(9):e2432143. PMID 39250153. DOI 10.1001/jamanetworkopen.2024.32143.
- 3073 patients: 1554 chatbot, 1519 enhanced standard of care (pretest appointment with a certified genetic counselor).
- Difference in completion of pretest services: 2.0 percentage points (95% CI -1.1 to 5.0). Difference in genetic testing: -1.3 points (95% CI -3.7 to 1.1). "Analyses suggested equivalence in the primary outcomes."
- Correction 1: this is an equivalence trial, not non-inferiority.
- Correction 2: the population is cancer genetic evaluation, not pretest genetic services in general.
- The abstract gives no equivalence margin. Check the full text before stating one.
- The abstract's women denominator (3063) does not match the total (3073). Do not quote that line.

---

## 13. Pakistan extended-family screening (ahmed-2002): VERIFIED, with one correction

Ahmed S et al. N Engl J Med 2002;347(15):1162-1168. PMID 12374877. DOI 10.1056/NEJMsa013234.
- In the 10 index-case families, 183 of 591 persons tested (31%) were carriers.
- In the 5 control families, no carrier was found among 397 members tested.
- 17 of 214 married couples (8%) had two carriers.
- No at-risk couple was found among 350 randomly selected pregnant women and their partners.
- Correction: the 17 of 214 figure is not a comparison with controls. The control comparison is 0 of 397.
