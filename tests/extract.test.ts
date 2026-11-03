import { describe, it, expect } from 'vitest';
import type { Extracted } from '../src/core/import/types';
import { extractFromText } from '../src/core/import/extract';
import { itemsToLines, type TextItem } from '../src/core/import/lines';
import aishaPdf from './fixtures/aisha-khalfan-sample.txt?raw';
import rashidPdf from './fixtures/rashid-khalfan-sample.txt?raw';
import noorPdf from './fixtures/noor-hamdan-sample.txt?raw';

// The three sample reports, as docs/SAMPLE_REPORTS.md prints them.
const AISHA_DOC = `SAMPLE: fictional person, not a real result
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
Reported by: Dr. Sample Geneticist (fictional)`;

const RASHID_DOC = `SAMPLE: fictional person, not a real result
Al Waha Genomics Laboratory (fictional)
Premarital Genetic Screening Report

Patient name: Rashid Khalfan (sample)
Sex: Male
Date of birth: 1996-07-02
Report date: 2026-10-20
Test: Premarital genetic screening, DoH panel (Premarital Screening Standard V3, Appendix 12), 563 genes
Partner: Aisha Khalfan (sample)
Declared relationship: First cousins

Results: variants reported
Gene | Variant (HGVS) | Protein | Zygosity | Classification | Associated condition
HBB | NM_000518.5:c.92+5G>C | IVS-I-5 (beta-plus) | Heterozygous | Pathogenic | Beta-thalassaemia
CFTR | NM_000492.4:c.1521_1523del | p.Phe508del | Heterozygous | Pathogenic | Cystic fibrosis

Couple analysis
Couple status: AT RISK (not compatible)
Both partners carry a pathogenic variant in: HBB
Partner's variant in the shared gene: HBB c.20A>T (HbS)
Your partner was tested for your other carrier variants and none was found in: CFTR

Methods and limitations
Analytical sensitivity: the panel detects 95% of disease-causing single-nucleotide variants and small insertions or deletions in the panel genes.
Targeted analysis of the partner's sample for your familial variant: 99% sensitivity.
This test does not detect all genetic disorders. A negative result reduces but does not remove the chance of being a carrier.
Reported by: Dr. Sample Geneticist (fictional)`;

const NOOR_DOC = `Patient name: Noor Hamdan (sample)
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
This test does not detect all genetic disorders.`;

function expectAisha(x: Extracted) {
  expect(x.name).toBe('Aisha Khalfan (sample)');
  expect(x.sex).toBe('F');
  expect(x.testedAt).toBe('2026-10-20');
  expect(x.lab).toBe('Al Waha Genomics Laboratory (fictional)');
  expect(x.findings.map(f => [f.gene, f.variant, f.classification, f.zygosity, f.confidence])).toEqual([
    ['HBB', 'NM_000518.5:c.20A>T', 'P', 'het', 'high'],
    ['GJB2', 'NM_004004.6:c.35delG', 'P', 'het', 'high'],
    ['MEFV', 'NM_000243.3:c.442G>C', 'VUS', 'het', 'high'],
  ]);
  expect(x.findings[0]).toMatchObject({ protein: 'p.Glu7Val', tag: 'HbS' });
  expect(x.findings[1]).toMatchObject({ protein: 'p.Gly12fs' });
  expect(x.findings[1].tag).toBeUndefined();
  expect(x.findings[2]).toMatchObject({ protein: 'p.Glu148Gln' });
  expect(x.couple).toEqual({
    status: 'at-risk',
    sharedGenes: ['HBB'],
    partnerTags: { HBB: 'b+' },
    partnerNegativeFor: ['GJB2'],
    partnerName: 'Rashid Khalfan (sample)',
    relationship: 'first-cousins',
  });
  expect(x.detection).toEqual({ panelPct: 95, exactPct: 99 });
  expect(x.unknownGenes).toEqual([]);
  expect(x.warnings).toEqual([]);
}

function expectRashid(x: Extracted) {
  expect(x.name).toBe('Rashid Khalfan (sample)');
  expect(x.sex).toBe('M');
  expect(x.testedAt).toBe('2026-10-20');
  expect(x.lab).toBe('Al Waha Genomics Laboratory (fictional)');
  expect(x.findings.map(f => [f.gene, f.variant, f.classification, f.zygosity, f.confidence])).toEqual([
    ['HBB', 'NM_000518.5:c.92+5G>C', 'P', 'het', 'high'],
    ['CFTR', 'NM_000492.4:c.1521_1523del', 'P', 'het', 'high'],
  ]);
  expect(x.findings[0].tag).toBe('b+');
  expect(x.findings[0].protein).toBeUndefined();
  expect(x.findings[1]).toMatchObject({ protein: 'p.Phe508del' });
  expect(x.couple).toEqual({
    status: 'at-risk',
    sharedGenes: ['HBB'],
    partnerTags: { HBB: 'HbS' },
    partnerNegativeFor: ['CFTR'],
    partnerName: 'Aisha Khalfan (sample)',
    relationship: 'first-cousins',
  });
  expect(x.detection).toEqual({ panelPct: 95, exactPct: 99 });
  expect(x.unknownGenes).toEqual([]);
  expect(x.warnings).toEqual([]);
}

function expectNoor(x: Extracted) {
  expect(x.name).toBe('Noor Hamdan (sample)');
  expect(x.sex).toBe('F');
  expect(x.testedAt).toBe('2026-09-08');
  expect(x.findings.map(f => [f.gene, f.variant, f.classification, f.zygosity, f.confidence])).toEqual([
    ['CYP21A2', 'NM_000500.9:c.293-13C>G', 'P', 'het', 'high'],
  ]);
  expect(x.findings[0].tag).toBeUndefined();
  expect(x.couple).toEqual({
    status: 'compatible',
    sharedGenes: [],
    partnerTags: {},
    partnerNegativeFor: ['CYP21A2'],
    partnerName: 'Hamad Obaid (sample)',
    relationship: 'unrelated',
  });
  // No sensitivity figure in this report, so no detection.
  expect(x.detection).toBeUndefined();
  expect(x.unknownGenes).toEqual([]);
  expect(x.warnings).toEqual([]);
}

describe('sample reports', () => {
  it.each([
    ['Aisha, text block', AISHA_DOC, expectAisha],
    ['Aisha, PDF text', aishaPdf, expectAisha],
    ['Rashid, text block', RASHID_DOC, expectRashid],
    ['Rashid, PDF text', rashidPdf, expectRashid],
    ['Noor, text block', NOOR_DOC, expectNoor],
    ['Noor, PDF text', noorPdf, expectNoor],
  ] as const)('%s reads what Silah should read', (_label, text, check) => {
    check(extractFromText(text, 'pdf'));
  });
});

describe('findings', () => {
  it('reads a row with | separators and a row with plain spaces the same way', () => {
    const pipes = extractFromText('HBB | NM_000518.5:c.20A>T | p.Glu7Val | Heterozygous | Pathogenic | Sickle cell disease');
    const spaces = extractFromText('HBB NM_000518.5:c.20A>T p.Glu7Val Heterozygous Pathogenic Sickle cell disease');
    for (const x of [pipes, spaces]) {
      expect(x.findings).toHaveLength(1);
      expect(x.findings[0]).toMatchObject({
        gene: 'HBB',
        variant: 'NM_000518.5:c.20A>T',
        protein: 'p.Glu7Val',
        classification: 'P',
        zygosity: 'het',
        tag: 'HbS',
        confidence: 'high',
      });
    }
  });

  it('reads columns in any order', () => {
    const x = extractFromText('Pathogenic | Homozygous | GJB2 | NM_004004.6:c.35delG');
    expect(x.findings[0]).toMatchObject({ gene: 'GJB2', variant: 'NM_004004.6:c.35delG', zygosity: 'hom' });
  });

  it('tells Likely pathogenic from Pathogenic', () => {
    const x = extractFromText([
      'CFTR | NM_000492.4:c.1521_1523del | Likely pathogenic | Heterozygous',
      'GJB2 | NM_004004.6:c.35delG | Pathogenic | Heterozygous',
    ].join('\n'));
    expect(x.findings.map(f => [f.gene, f.classification])).toEqual([['CFTR', 'LP'], ['GJB2', 'P']]);
  });

  it('skips Benign and Likely benign rows', () => {
    const x = extractFromText([
      'CFTR | NM_000492.4:c.1521_1523del | Benign',
      'HBB | NM_000518.5:c.20A>T | Likely benign',
      'GJB2 c.35delG non-pathogenic',
      'MEFV c.442G>C غير ممرض',
    ].join('\n'));
    expect(x.findings).toEqual([]);
    expect(x.unknownGenes).toEqual([]);
    expect(x.warnings).toEqual([]);
  });

  it('reads a row without a classification word as P with low confidence and a warning', () => {
    const x = extractFromText('GJB2 | NM_004004.6:c.35delG | p.Gly12fs | Heterozygous');
    expect(x.findings[0]).toMatchObject({ gene: 'GJB2', classification: 'P', confidence: 'low' });
    expect(x.warnings).toHaveLength(1);
    expect(x.warnings[0]).toContain('GJB2');
  });

  it('maps an alias to the current symbol', () => {
    const x = extractFromText([
      'GBA c.1448T>C Heterozygous Pathogenic',
      'MUT c.1106G>A Heterozygous Pathogenic',
    ].join('\n'));
    expect(x.findings.map(f => f.gene)).toEqual(['GBA1', 'MMUT']);
  });

  it('sends a gene that is not on the panel to unknownGenes', () => {
    const x = extractFromText('BRCA1 NM_007294.4:c.68_69del Pathogenic');
    expect(x.findings).toEqual([]);
    expect(x.unknownGenes).toEqual(['BRCA1']);
  });

  it('accepts a gene symbol followed by a colon', () => {
    const x = extractFromText('GJB2: NM_004004.6:c.35delG Pathogenic');
    expect(x.findings[0]).toMatchObject({ gene: 'GJB2', variant: 'NM_004004.6:c.35delG' });
  });

  it('accepts the HGVS forms the sample reports use', () => {
    const forms = [
      'c.20A>T', 'c.35delG', 'c.92+5G>C', 'c.293-13C>G', 'c.1521_1523del', 'c.1521_1523delCTT',
      'c.-138C>T', 'c.*32A>G', 'c.27_28insG', 'c.315+1G>A', 'c.442G>C',
    ];
    const x = extractFromText(forms.map(f => `GJB2 ${f} Heterozygous Pathogenic`).join('\n'));
    expect(x.findings.map(f => f.variant)).toEqual(forms);
  });

  it('reads zygosity as unknown when the line does not say', () => {
    expect(extractFromText('GJB2 c.35delG Pathogenic').findings[0].zygosity).toBe('unknown');
  });

  it('warns on a homozygous P or LP finding', () => {
    const x = extractFromText('HBB NM_000518.5:c.20A>T Homozygous Pathogenic');
    expect(x.findings[0].zygosity).toBe('hom');
    expect(x.warnings).toHaveLength(1);
    expect(x.warnings[0]).toContain('HBB');
  });

  it('keeps one finding per gene and variant', () => {
    const x = extractFromText('GJB2 c.35delG Pathogenic\nGJB2 c.35delG Pathogenic');
    expect(x.findings).toHaveLength(1);
  });

  it('does not make a finding from the partner line', () => {
    const x = extractFromText("Partner's variant in the shared gene: HBB c.92+5G>C (beta-plus thalassaemia)");
    expect(x.findings).toEqual([]);
    expect(x.couple?.partnerTags).toEqual({ HBB: 'b+' });
    expect(x.couple?.sharedGenes).toEqual([]);
  });

  it('gives HBB allele tags from the change and from words', () => {
    const tagOf = (line: string) => extractFromText(line).findings[0]?.tag;
    expect(tagOf('HBB c.20A>T Pathogenic')).toBe('HbS');
    expect(tagOf('HBB c.19G>A Pathogenic')).toBe('HbC');
    expect(tagOf('HBB c.79G>A Pathogenic')).toBe('HbE');
    expect(tagOf('HBB c.118C>T Pathogenic')).toBe('b0');
    expect(tagOf('HBB c.92+5G>C Pathogenic')).toBe('b+');
    expect(tagOf('HBB c.123A>G Pathogenic (beta zero)')).toBe('b0');
    expect(tagOf('HBB c.123A>G Pathogenic β0')).toBe('b0');
    expect(tagOf('HBB c.123A>G Pathogenic beta-plus')).toBe('b+');
    expect(tagOf('HBB c.123A>G Pathogenic β+')).toBe('b+');
    expect(tagOf('HBB c.123A>G Pathogenic')).toBeUndefined();
    expect(tagOf('GJB2 c.35delG Pathogenic (HbS)')).toBeUndefined();
  });

  it('reads Arabic classification words', () => {
    const x = extractFromText([
      'HBB c.123A>G ممرض محتمل',
      'GJB2 c.35delG ممرض',
      'MEFV c.442G>C غير مؤكد الأهمية',
      'CFTR c.1521_1523del غير محددة الأهمية',
    ].join('\n'));
    expect(x.findings.map(f => [f.gene, f.classification, f.confidence])).toEqual([
      ['HBB', 'LP', 'high'],
      ['GJB2', 'P', 'high'],
      ['MEFV', 'VUS', 'high'],
      ['CFTR', 'VUS', 'high'],
    ]);
  });

  it('does not put common words into unknownGenes', () => {
    const x = extractFromText('ACMG class and HGVS: GJB2 NM_004004.6:c.35delG Pathogenic IVS2-13');
    expect(x.unknownGenes).toEqual([]);
  });
});

describe('patient block', () => {
  it('reads sex from Gender and from one-letter values', () => {
    expect(extractFromText('Gender: Male').sex).toBe('M');
    expect(extractFromText('Sex: F').sex).toBe('F');
    expect(extractFromText('Sex: M').sex).toBe('M');
  });

  it('reads Arabic labels and sex words', () => {
    const x = extractFromText('الاسم: سارة خالد\nالجنس: أنثى');
    expect(x.name).toBe('سارة خالد');
    expect(x.sex).toBe('F');
    expect(extractFromText('الجنس: ذكر').sex).toBe('M');
  });

  it('reads the name from Patient: and Name:', () => {
    expect(extractFromText('Patient: Omar Test').name).toBe('Omar Test');
    expect(extractFromText('Name: Omar Test').name).toBe('Omar Test');
  });

  it('does not take the partner name as the patient name', () => {
    const x = extractFromText('Partner name: Hana\nPatient name: Omar');
    expect(x.name).toBe('Omar');
    expect(x.couple?.partnerName).toBe('Hana');
  });

  it.each([
    ['2026-10-20'],
    ['20/10/2026'],
    ['20-10-2026'],
    ['20 October 2026'],
  ])('reads the report date %s as ISO', value => {
    expect(extractFromText(`Report date: ${value}`).testedAt).toBe('2026-10-20');
  });

  it.each([
    ['Report date'],
    ['Date reported'],
    ['Date of report'],
    ['Collection date'],
  ])('reads the date from the "%s" label', label => {
    expect(extractFromText(`${label}: 2026-10-20`).testedAt).toBe('2026-10-20');
  });

  it('reads Arabic digits in dates', () => {
    expect(extractFromText('Report date: ٢٠٢٦-١٠-٢٠').testedAt).toBe('2026-10-20');
  });

  it('prefers the report date over the collection date', () => {
    expect(extractFromText('Collection date: 2026-10-01\nReport date: 2026-10-20').testedAt).toBe('2026-10-20');
  });

  it('ignores the date of birth', () => {
    expect(extractFromText('Date of birth: 1999-03-14').testedAt).toBeUndefined();
  });

  it('warns on an impossible date and leaves it out', () => {
    const x = extractFromText('Report date: 31/02/2026');
    expect(x.testedAt).toBeUndefined();
    expect(x.warnings.some(w => w.includes('Date not read'))).toBe(true);
  });

  it('reads the lab from the first eight lines only', () => {
    expect(extractFromText('Al Waha Genomics Laboratory (fictional)').lab).toBe('Al Waha Genomics Laboratory (fictional)');
    expect(extractFromText('مختبر الوفاء للوراثة').lab).toBe('مختبر الوفاء للوراثة');
    const late = [...Array(8).fill('Filler line'), 'Lab Centre'].join('\n');
    expect(extractFromText(late).lab).toBeUndefined();
  });
});

describe('couple', () => {
  it('is undefined when the report has no couple information', () => {
    expect(extractFromText('GJB2 c.35delG Pathogenic').couple).toBeUndefined();
  });

  it('reads at-risk and compatible status', () => {
    expect(extractFromText('Couple status: AT RISK (not compatible)').couple?.status).toBe('at-risk');
    expect(extractFromText('Couple status: incompatible').couple?.status).toBe('at-risk');
    expect(extractFromText('Couple status: COMPATIBLE').couple?.status).toBe('compatible');
    expect(extractFromText('Certificate wording: No risk for either the other partner').couple?.status)
      .toBe('compatible');
    expect(extractFromText('حالة الزوجين: غير متوافق').couple?.status).toBe('at-risk');
    expect(extractFromText('حالة الزوجين: متوافق').couple?.status).toBe('compatible');
  });

  it.each([
    ['Declared relationship: Double first cousins', 'double-first-cousins'],
    ['Declared relationship: First cousins once removed', 'first-cousins-once-removed'],
    ['Declared relationship: First cousin', 'first-cousins'],
    ['Declared relationship: Second cousins', 'second-cousins'],
    ['Declared relationship: Not related', 'unrelated'],
    ['صلة القرابة: ابن عم', 'first-cousins'],
    ['صلة القرابة: ابنة خال', 'first-cousins'],
    ['صلة القرابة: أبناء عمومة', 'first-cousins'],
    ['صلة القرابة: غير أقارب', 'unrelated'],
  ])('reads "%s" as %s', (line, expected) => {
    expect(extractFromText(line).couple?.relationship).toBe(expected);
  });

  it('reads shared genes from the Arabic "both of them" line', () => {
    const x = extractFromText('كلاكما يحمل تغيرا مسببا للمرض في الجين HBB');
    expect(x.couple?.sharedGenes).toEqual(['HBB']);
  });

  it('reads the genes the partner tested negative for', () => {
    const x = extractFromText('Your partner tested negative for CFTR');
    expect(x.couple?.partnerNegativeFor).toEqual(['CFTR']);
  });
});

describe('detection', () => {
  it('reads the panel and exact-change figures', () => {
    const x = extractFromText([
      'Analytical sensitivity: the panel detects 95% of changes.',
      "Targeted analysis of the partner's sample for your familial variant: 99% sensitivity.",
    ].join('\n'));
    expect(x.detection).toEqual({ panelPct: 95, exactPct: 99 });
  });

  it('reads an exact-change figure alone', () => {
    expect(extractFromText('Targeted familial check: 98%').detection).toEqual({ exactPct: 98 });
  });

  it('ignores a figure outside (50, 100] with a warning', () => {
    const x = extractFromText('Analytical sensitivity: the panel detects 40% of changes.');
    expect(x.detection).toBeUndefined();
    expect(x.warnings.some(w => w.includes('40'))).toBe(true);
    expect(extractFromText('Analytical sensitivity: 50%').detection).toBeUndefined();
    expect(extractFromText('Analytical sensitivity: 100%').detection).toEqual({ panelPct: 100 });
  });

  it('reads Arabic digits and the Arabic percent sign', () => {
    expect(extractFromText('Analytical sensitivity: ٩٥٪').detection).toEqual({ panelPct: 95 });
  });
});

describe('itemsToLines', () => {
  const item = (str: string, x: number, y: number, width = 20, size = 10): TextItem => ({
    str,
    transform: [size, 0, 0, size, x, y],
    width,
  });

  it('orders lines top to bottom and items left to right, with items within 2.5 units on one line', () => {
    const lines = itemsToLines([
      item('Sex:', 50, 680),
      item('name:', 95, 698.5, 30),
      item('Female', 80, 680, 35),
      item('Aisha', 130, 700, 30),
      item('Patient', 50, 700, 40),
    ]);
    expect(lines).toEqual(['Patient name: Aisha', 'Sex: Female']);
  });

  it('joins touching items without a space and separates the rest', () => {
    const lines = itemsToLines([
      item('c.20', 50, 500),
      item('A>T', 70.2, 500, 15),
      item('HBB', 10, 400),
      item('c.20A>T', 60, 400),
    ]);
    expect(lines).toEqual(['c.20A>T', 'HBB c.20A>T']);
  });

  it('does not add a second space after one that is already there', () => {
    expect(itemsToLines([item('Gene ', 50, 300, 30), item('HBB', 80.5, 300)])).toEqual(['Gene HBB']);
  });

  it('separates items whose width is unknown and drops empty lines', () => {
    const noWidth: TextItem[] = [
      { str: 'HBB', transform: [10, 0, 0, 10, 50, 400] },
      { str: 'c.20A>T', transform: [10, 0, 0, 10, 50, 400] },
    ];
    expect(itemsToLines(noWidth)).toEqual(['HBB c.20A>T']);
    expect(itemsToLines([item('', 10, 300), item('   ', 10, 290)])).toEqual([]);
  });
});
