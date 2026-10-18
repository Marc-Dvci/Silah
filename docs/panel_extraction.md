# Premarital panel extraction (DoH Appendix 12)

## Source

- Document: Abu Dhabi Department of Health, Premarital Screening Standard V3, published September 2024.
- Section: Appendix 12, "List of tested genes".
- Text used: `research/DoH_Premarital_Screening_Standard_V3_2024.txt`, lines 1942 to 2024. This is text extracted from the PDF.
- The appendix title says the list excludes X- or Y-linked genes and autosomal dominant genes. It also says not all autosomal recessive diseases are included.

## Method

1. Took the text from the Appendix 12 heading to the Appendix 13 heading.
2. Dropped the two page numbers (47 and 48) and the heading line.
3. Split the rest on whitespace.
4. Read each token as one of two kinds. A bare symbol is a gene. A token in parentheses is an old name of the symbol printed just before it. It is not a separate gene.
5. Mapped every gene token to HGNC. The approved symbol was checked first. If that failed, the code checked `prev_symbol`, then `alias_symbol`. Each step had to give exactly one gene.
6. Checked that each parenthesised name maps to the same gene as the symbol before it.
7. Removed duplicates after mapping.
8. Compared the gene tokens with the text layer of the PDF (`pdftotext -layout`, pages 46 and 47). The two agree. The only extra words in the PDF layer are the title words and page numbers.

## Counts

- Tokens read: 591. This is 570 gene tokens and 21 parenthesised old names. Page numbers and the heading are not counted.
- Gene tokens printed: 570. The DoH text says "approximately 570 genes" (lines 237, 702 and 835), so this matches.
- Unique printed names: 565. Five names are printed twice: ADGRG1, ALDH3A2, HJV, LRPPRC and VPS13B.
- Unique genes after mapping: 563. Two more names fold into a gene that is also printed. G6PC maps to G6PC1, and MUT maps to MMUT.
- Duplicates removed: 7 (570 minus 563). Five are repeated prints. Two are old names that point to a printed gene.
- Aliases in `PANEL_ALIASES`: 21.
- Unmapped tokens: none. All 570 gene tokens and all 21 parenthesised names map to an approved HGNC symbol.

The count of 563 is inside the 540 to 600 range in the brief. No parsing change was needed.

## Aliases

| Printed name | Approved symbol | Where it is printed (line in the text file) |
|---|---|---|
| GAS8 | DRC4 | Gene slot, line 1948 |
| CCDC65 | DRC2 | Gene slot, line 1955 |
| CCDC103 | DNAAF19 | Gene slot, line 1962 |
| G6PC | G6PC1 | Gene slot, line 1976. Also in parentheses, line 1978 |
| MUT | MMUT | Gene slot, line 1989. Also in parentheses, line 2004 |
| GPR56 | ADGRG1 | Parentheses, line 1948 |
| GBA | GBA1 | Parentheses, line 1951 |
| FALDH | ALDH3A2 | Parentheses, line 1953 |
| WISP3 | CCN6 | Parentheses, line 1957 |
| C21ORF59 | CFAP298 | Parentheses, line 1959 |
| LRRC6 | DNAAF11 | Parentheses, line 1970 |
| DYX1C1 | DNAAF4 | Parentheses, line 1974 |
| HFE2 | HJV | Parentheses, line 1976 |
| KARS | KARS1 | Parentheses, line 1979 |
| LEPRE1 | P3H1 | Parentheses, line 1991 |
| COH1 | VPS13B | Parentheses, line 1996 |
| CCDC114 | ODAD1 | Parentheses, line 2012 |
| ARMC4 | ODAD2 | Parentheses, line 2014 |
| CCDC151 | ODAD3 | Parentheses, line 2016 |
| TTC25 | ODAD4 | Parentheses, line 2018 |
| DFNB59 | PJVK | Parentheses, line 2021 |

## Notes and open points

- GIF is not in the alias map. It is printed three times, each time after a different gene: CBLIF (line 1958), MIF (line 1994) and MT3 (line 2015). In HGNC, GIF is an old name of CBLIF and an alias of MIF and MT3. One key cannot point to three genes. CBLIF, MIF and MT3 are all printed by their own names, so no gene is lost.
- SMN1 is printed as `SMN1*`. The asterisk has no note in the appendix text. The asterisk was dropped, and SMN1 is kept.
- Thirty printed names are current HGNC approved symbols. HGNC also lists them as old names of other genes. Examples are CPS1, HGF, PC and MIF. The rule used here takes the approved symbol first, so each of these stays as printed. This is the standard rule, but it is a risk if the DoH list used any of these names in an older sense.
- The list is the DoH list as printed. Some entries, such as MIF and MT3, are not classic recessive disease genes. They were kept because the appendix prints them.

## HGNC reference

- File: `hgnc_complete_set.txt`, from `https://storage.googleapis.com/public-download-files/hgnc/tsv/tsv/hgnc_complete_set.txt`.
- Downloaded: 18 Oct 2026.
- Server date (Last-Modified header): 16 Oct 2026.
- Licence: CC0.
- Rows: 45,277. All have status Approved.
- The working files (download, token dumps and build output) are in `D:\tmp\silah_panel\`. Nothing from that folder is in the repo.

## Check

- `npx vitest run tests/panel.test.ts` passes, 5 of 5 tests.
