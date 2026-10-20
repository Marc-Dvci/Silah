# Sensitivity of the numbers to the two assumptions

`node eval/sensitivity.mjs` · arithmetic in `eval/sensitivity.ts`

DoH does not publish two of the inputs the kernel needs:

- the share of a gene's disease-causing changes the panel detects (Silah uses 90%);
- a carrier frequency for the 556 of 563 panel genes with no published Emirati figure (Silah uses 1 in 200).

The script recomputes the numbers a person sees across a range of both. At the baseline (90%, 1 in 200) it reproduces the kernel's own fact cards exactly, and it stops with an error if it does not.

The rows below are the two demo couples:

- **Fatima** carries CYP21A2. Her fiancé Ahmed, a first cousin, tested negative for it. The certificate says "compatible".
- **Mariam and Saeed** share SMN1. Mariam also carries MEFV.

| Detection | Assumed carrier frequency | Fatima, CYP21A2, per pregnancy | Fatima, rest of panel | Mariam, rest of panel |
|---|---|---|---|---|
| 80% | 1 in 100 | 1 in 140 | 1 in 1,400 | 1 in 1,200 |
| 80% | 1 in 200 | 1 in 140 | 1 in 3,200 | 1 in 2,500 |
| 80% | 1 in 1000 | 1 in 140 | 1 in 5,600 | 1 in 3,700 |
| **90%** | 1 in 100 | 1 in 260 | 1 in 5,400 | 1 in 4,800 |
| **90%** | **1 in 200** | **1 in 260** | **1 in 13,000** | **1 in 9,700** |
| **90%** | 1 in 1000 | 1 in 260 | 1 in 22,000 | 1 in 14,000 |
| 95% | 1 in 100 | 1 in 470 | 1 in 22,000 | 1 in 19,000 |
| 95% | 1 in 200 | 1 in 470 | 1 in 51,000 | 1 in 39,000 |
| 99% | 1 in 100 | 1 in 1,300 | 1 in 540,000 | 1 in 470,000 |
| 99% | 1 in 200 | 1 in 1,300 | 1 in 1,300,000 | 1 in 960,000 |

The script prints the full 16-cell grid (it also covers 1 in 500).

## What holds across the whole range

- **Fatima's "compatible" still hides a real chance.** For the gene she carries it is between 1 in 140 and 1 in 1,300 per pregnancy. It is never zero, and it is always far above the rest of the panel. The screen's message stays true in every cell: compatible does not mean no risk, and this one gene is where the remaining chance sits.
- **That number depends on detection only.** The CYP21A2 frequency is a published Emirati figure (Jain 2025), so the assumed 1 in 200 does not touch it.
- **The rest of the panel stays small next to the background.** Even in the worst cell (80%, 1 in 100) it is 1 in 1,200 to 1 in 1,400, against 1 in 33 for a birth defect in any pregnancy.

## What does not hold, and is said so

- **The assumed 1 in 200 is not an upper bound.** At 1 in 100, the rest-of-panel figure is about 2.4 times higher than shown (1 in 5,400 against 1 in 13,000 for Fatima).
- **Detection moves the person's own number by a factor of about 9** (1 in 140 to 1 in 1,300). It is the assumption that matters most. A deployment needs the lab's validated per-gene detection rate. The app already marks every number that uses the assumed rate.
