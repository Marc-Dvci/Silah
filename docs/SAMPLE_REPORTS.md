# Sample reports

Three fictional premarital genetic reports ship with the demo, so anyone can try **Use my own result** without a real result. They are in `public/samples/` and the app links to them. Every person, the laboratory and the signature are invented. Each page is marked "SAMPLE: fictional person, not a real result".

The layout is generic: a header, a patient block, a table of reported variants, a couple analysis and a methods section. Silah does not depend on this layout. It looks for panel gene symbols, HGVS changes and classification words on each line, then asks the person to confirm what it found.

## Sample 1: Aisha (at-risk couple, detection stated)

`aisha-khalfan-sample.pdf`

```
SAMPLE: fictional person, not a real result
Al Waha Genomics Laboratory (fictional)
Premarital Genetic Screening Report

Patient name: Aisha Khalfan (sample)
Sex: Female
Date of birth: 1999-03-14
Report date: 2026-10-20
Test: Premarital genetic screening, DoH panel (Premarital Screening Standard V3, Appendix 12), 563 genes
Partner: Rashid Khalfan (sample)
Declared relationship: First cousins

Results: variants reported
Gene | Variant (HGVS) | Protein | Zygosity | Classification | Associated condition
HBB | NM_000518.5:c.20A>T | p.Glu7Val (HbS) | Heterozygous | Pathogenic | Sickle cell disease
GJB2 | NM_004004.6:c.35delG | p.Gly12fs | Heterozygous | Pathogenic | Nonsyndromic hearing loss
MEFV | NM_000243.3:c.442G>C | p.Glu148Gln | Heterozygous | Uncertain significance (VUS) | Familial Mediterranean fever

Couple analysis
Couple status: AT RISK (not compatible)
Both partners carry a pathogenic variant in: HBB
Partner's variant in the shared gene: HBB c.92+5G>C (beta-plus thalassaemia)
Your partner was tested for your other carrier variants and none was found in: GJB2

Methods and limitations
Analytical sensitivity: the panel detects 95% of disease-causing single-nucleotide variants and small insertions or deletions in the panel genes.
Targeted analysis of the partner's sample for your familial variant: 99% sensitivity.
This test does not detect all genetic disorders. A negative result reduces but does not remove the chance of being a carrier.
Reported by: Dr. Sample Geneticist (fictional)
```

What Silah should read: Aisha, female, tested 2026-10-20; HBB c.20A>T Pathogenic (tag HbS), GJB2 c.35delG Pathogenic, MEFV c.442G>C VUS; couple at risk, shared gene HBB with the partner's tag b+, partner negative for GJB2, partner Rashid Khalfan (sample), first cousins; detection 95% (panel) and 99% (exact change). The child condition for HbS + beta-plus is sickle beta-thalassaemia.

## Sample 2: Rashid (Aisha's partner)

`rashid-khalfan-sample.pdf`. The same layout, with:

```
Patient name: Rashid Khalfan (sample)
Sex: Male
Date of birth: 1996-07-02
Report date: 2026-10-20
Partner: Aisha Khalfan (sample)
Declared relationship: First cousins

HBB | NM_000518.5:c.92+5G>C | IVS-I-5 (beta-plus) | Heterozygous | Pathogenic | Beta-thalassaemia
CFTR | NM_000492.4:c.1521_1523del | p.Phe508del | Heterozygous | Pathogenic | Cystic fibrosis

Couple status: AT RISK (not compatible)
Both partners carry a pathogenic variant in: HBB
Partner's variant in the shared gene: HBB c.20A>T (HbS)
Your partner was tested for your other carrier variants and none was found in: CFTR
```

The methods section is the same as Aisha's (95% and 99%).

## Sample 3: Noor (compatible couple, no detection stated)

`noor-hamdan-sample.pdf`

```
Patient name: Noor Hamdan (sample)
Sex: Female
Date of birth: 2001-11-30
Report date: 2026-09-08
Partner: Hamad Obaid (sample)
Declared relationship: Not related

CYP21A2 | NM_000500.9:c.293-13C>G | IVS2-13 | Heterozygous | Pathogenic | Congenital adrenal hyperplasia

Couple status: COMPATIBLE
Certificate wording: No risk for either the other partner or children to be carrier or diseased
Your partner was tested for your carrier variants and none was found in: CYP21A2

Methods and limitations
This test does not detect all genetic disorders.
```

There is deliberately no sensitivity figure, so Silah shows its remaining-chance figures as ranges (99% to 80% detection), as it does for any result that does not state detection.
