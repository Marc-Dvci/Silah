# Sensitivity of the numbers to what is not published

`node eval/sensitivity.mjs` · arithmetic in `eval/sensitivity.ts`, using the kernel's own functions

DoH does not publish three of the inputs the kernel needs:

- the share of a gene's disease-causing changes the panel detects;
- whether, and how well, a partner's sample is checked for the other partner's exact change;
- a carrier frequency for the 556 of 563 panel genes with no published Emirati figure.

The first two belong to the lab and its tests. Silah takes them from the signed result (`couple.detection`) and names them on the result screen. When a result does not state them, Silah gives each remaining chance as a range from 99% to 80% detection, never one figure. The demo's simulated lab states 90% for the panel and 99% for a check of an exact change. The third input is calibrated (below).

The script recomputes what a person sees across these inputs. At the baseline (90%, exact change checked at 99%, 1 in 1,000) it reproduces the kernel's own fact cards and Fatima's whole-panel figure exactly, and it stops with an error if it does not.

The rows below are the two demo couples, both first cousins:

- **Fatima** carries CYP21A2. Her fiancé Ahmed tested negative for it. The certificate says "compatible".
- **Mariam and Saeed** share SMN1. Mariam also carries MEFV.

| Detection | Assumed carrier frequency | Untested first cousins: added children per 100 births, panel genes | Fatima, CYP21A2, Ahmed checked for her exact change | Fatima, CYP21A2, not checked | Fatima, rest of panel | Fatima, whole panel | Mariam, rest of panel |
|---|---|---|---|---|---|---|---|
| 80% | 1 in 200 | 9.8 | 1 in 140 | 1 in 71 | 1 in 52 | 1 in 38 | 1 in 51 |
| 80% | 1 in 1000 | 2.8 | 1 in 140 | 1 in 71 | 1 in 190 | 1 in 82 | 1 in 180 |
| 80% | 1 in 2000 | 1.9 | 1 in 140 | 1 in 71 | 1 in 290 | 1 in 95 | 1 in 270 |
| **90%** | 1 in 200 | 9.8 | 1 in 260 | 1 in 140 | 1 in 100 | 1 in 75 | 1 in 100 |
| **90%** | 1 in 500 | 4.5 | 1 in 260 | 1 in 140 | 1 in 230 | 1 in 120 | 1 in 230 |
| **90%** | **1 in 1000** | **2.8** | **1 in 260** | 1 in 140 | **1 in 390** | **1 in 160** | **1 in 370** |
| **90%** | 1 in 2000 | 1.9 | 1 in 260 | 1 in 140 | 1 in 600 | 1 in 180 | 1 in 550 |
| 95% | 1 in 1000 | 2.8 | 1 in 470 | 1 in 270 | 1 in 790 | 1 in 300 | 1 in 750 |
| 99% | 1 in 200 | 9.8 | 1 in 1,300 | 1 in 1,300 | 1 in 1,100 | 1 in 590 | 1 in 1,000 |
| 99% | 1 in 1000 | 2.8 | 1 in 1,300 | 1 in 1,300 | 1 in 4,000 | 1 in 1,000 | 1 in 3,800 |

The script prints the full 16-cell grid.

## The carrier frequency is calibrated against published data

For an untested first-cousin couple, the panel genes add F·Σq to the chance of a child with a serious condition (F = 1/16, q = p/2 for each gene). That cannot exceed the 1.7 to 2.8 added children in every 100 births that Hamamy 2012 gives for first cousins, of which the panel is only a part. With the seven published Emirati frequencies:

- 1 in 200 for each of the other 556 genes would imply 9.8 in 100, three and a half times the top of the range;
- 1 in 1,000 gives 2.8 in 100, the top of the range. Silah uses it, the most cautious value the published figure allows;
- 1 in 2,000 gives 1.9 in 100, near the bottom.

`tests/kernel.test.ts` checks the first two.

## What holds across the whole range

- **Fatima's "compatible" still hides a real chance.** For the panel as a whole it is between 1 in 1,100 and 1 in 38 per pregnancy, never zero. The screen's message stays true in every cell: compatible does not mean no risk.
- **For related partners, both remaining chances matter.** Her own gene and the rest of the panel are of the same order in most cells. The second comes from a change both partners inherited from an ancestor they share, which the panel misses.
- **Her own gene's figure depends on the lab's tests only.** The CYP21A2 frequency is a published Emirati figure (Jain 2025), so the assumed frequency does not touch it.

## What does not hold, and is said so

- **Detection moves every remaining chance by an order of magnitude.** Fatima's whole-panel figure goes from 1 in 82 at 80% to 1 in 1,000 at 99% (at 1 in 1,000). That is why a personal figure needs the lab's validated rates, and why a result without them gets a range.
- **Whether Ahmed was checked for Fatima's exact change roughly halves or doubles her own gene's figure** (1 in 140 against 1 in 260 at 90%). The data model now records it per gene; a result that does not say so is treated as not checked.
- **The calibration uses the top of a published range for all recessive conditions together.** Within that, the share that belongs to the panel genes is not known.
