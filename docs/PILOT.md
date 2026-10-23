# Path to pilot

## Who it is for

- **Couples who receive a premarital genetic result** in Abu Dhabi: about 565 incompatible couples since 2022, and every "compatible" couple who reads a certificate that says "No risk".
- **Couples married before the mandate**, who were never offered a genetic couple check. Abu Dhabi recorded 15,628 Emirati births in 2024. All 11,748 couples tested from 2022 to July 2026, at an assumed 0.3 births per couple per year, would account for at most about 3,500 births a year (11,748 × 0.3), about 22% of 15,628. So at least 78% of this year's Emirati births, roughly three in four, are to couples the genetic test has not reached. This is an estimate from stated inputs, not a published figure.
- **Genetic counsellors and family physicians**, who start each session already knowing what the couple has understood.
- **Delivery hospitals**, who know before birth which babies need a targeted test.

## Who would run it

| Stakeholder | Role |
|---|---|
| Department of Health, Abu Dhabi | Programme owner: approves the couple re-check and the outreach rules, receives the referral KPI |
| M42 / Emirati Genome Programme | Holds the genomes, runs the couple check, signs results |
| SEHA (Corniche Hospital counselling clinics and maternity, SKMC, Tawam) | Counselling, confirmatory testing, IVF + PGT, birth plans |
| Premarital screening centres | Issue the signed result alongside the existing digital certificate |

## Pilot design

- **Sites:** one premarital screening centre, the genetic counselling clinic at Corniche Hospital, and its maternity unit.
- **Arms:** couples receiving a result are offered Silah or the current report alone (randomised by week).
- **Primary measure:** the DoH KPI, share of non-compatible couples referred to a geneticist or counsellor (target 90%), and days from result to counselling.
- **Understanding:** the four teach-back points, asked by a researcher at the counselling visit in both arms, in the person's language.
- **Secondary:** misconception "compatible means zero risk" among compatible couples; birth plans set up among at-risk pregnancies; invitations redeemed; withdrawals of consent; time saved per counselling session.
- **Equity:** every measure reported by language (Arabic, English) and by self-reported reading confidence, with counts under 5 suppressed.
- **Not a success measure:** marriages cancelled or any single reproductive choice. Choices are reported, never ranked.

- **Trust:** a short questionnaire at the counselling visit, both arms, on whether the person trusted the explanation they received and knew where its numbers came from.
- **Time:** days from result to the first counselling visit, from the pathway log, both arms.

**Size.** Understanding is compared among compatible couples, where the misconception "compatible means zero risk" is the clearest single outcome. To detect a fall from 50% to 30% holding it (assumed figures), with 80% power at a two-sided 5% level, a two-proportion test needs 93 people per arm. Randomising by week groups people, so with an assumed design effect of 1.5 the target is 140 per arm, 280 in all: about 5% of the roughly 5,200 people tested each year in Abu Dhabi (2,600 couples, measured).

**What is already measured, and what the pilot adds.** The software and the text are measured in this repository: arithmetic, privacy, accessibility, readability against the DoH information sheet, and the model's answers (`docs/EVALUATION.md`). Whether couples understand their risk better, trust the explanation more and reach counselling sooner is what the pilot measures.

Pre-registration: the protocol above is fixed before any data is collected; deviations are reported.

## What must happen before a pilot

1. Recording the narration with a licensed voice.
2. DoH approval of the signed result format and of the couple re-check consent wording.
3. Hosting of the clinic services inside the UAE (Federal Law No. 2 of 2019).
4. A clinical safety review of the birth-plan statements by a paediatric geneticist.
5. Classification under DoH's Policy on Use of AI in the Healthcare Sector (2018): Silah's model only chooses which fixed, checked sentences to show; it writes nothing a person reads, and no decision depends on it.
6. The lab's validated detection rates, per gene, and a check of each partner's sample for the other partner's exact change, carried in the signed result.

## How it scales

- **No new sequencing for the couple re-check:** the genomes already exist; the marginal cost is analysis, a notification and counselling time.
- **The phone does the explaining**, so counselling time goes to decisions, not biology lessons, for a workforce of about nine genetic counsellors nationally (PMC12619030).
- **The same core serves other programmes:** Dubai's premarital programme (1,000 couples, 8% at risk, 80% proceeding with marriage, Nature Medicine 2026), other emirates, and preconception screening for residents outside the mandatory test.

## What it costs and who pays

Each figure is marked as measured (published), assumed (my input, to be replaced by DoH data) or priced (arithmetic on the two).

| | Figure | Type |
|---|---|---|
| Genetics workforce | 9 practising genetic counsellors and 8 clinical geneticists for nearly 11 million people in the UAE (J Genet Couns 2025, PMC12619030) | Measured |
| Today's at-risk flow in Abu Dhabi | 565 non-compatible couples of 11,748 tested, 2022 to July 2026: about 4.8%, about 125 couples a year | Measured |
| Re-check volume | DoH invites 20,000 couples married before the mandate each year | Assumed |
| At-risk couples found by the re-check | 20,000 × 4.8% ≈ 960 a year, about 8 times today's flow | Priced |
| Licence | AED 100 per couple served, all moments included | Assumed |
| Premarital couples tested each year | 11,748 from 2022 to July 2026: about 2,600 a year | Measured |
| Annual cost at that volume | (20,000 re-check + 2,600 premarital couples) × AED 100 ≈ AED 2.26 million | Priced |
| Running cost per question | None on the server: the model runs on the phone or the counsellor's computer | Design |

**Why the programme owner would pay.** The re-check would multiply the number of at-risk couples needing counselling by about eight, against a national genetics workforce of 17. Silah takes the explaining, the understanding check and the triage off that workforce: every counselling visit starts from a brief that shows what the couple already understood, and urgent cases (a pregnancy, distress) come first. The genomes, the panel and the referral KPI already exist; Silah is the delivery layer that lets them reach married couples.

**Who pays.** The programme owner (DoH, or M42 as the operator of the couple check). Families never pay and never see advertising. Pilot pricing is to be agreed with DoH.

