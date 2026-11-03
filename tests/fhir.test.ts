import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { exportExtractedFhir, exportSummaryFhir, importFhir, importResultFile } from '../src/core/fhir';
import type { Extracted, ExtractedFinding } from '../src/core/import/types';
import type { PhysicianSummary } from '../src/core/summary-types';

const LOINC = 'http://loinc.org';
const HGNC = 'http://www.genenames.org/geneId';
const HGVS = 'http://varnomen.hgvs.org';
const SILAH = 'https://marc-dvci.github.io/Silah/fhir/CodeSystem/silah';
const XHTML = '<div xmlns="http://www.w3.org/1999/xhtml">';

type Res = { resourceType: string; id: string; [k: string]: any };

const loinc = (code: string) => ({ system: LOINC, code });
const comp = (code: string, value: Record<string, unknown>) => ({ code: { coding: [loinc(code)] }, ...value });
const silahComp = (code: string, value: Record<string, unknown>) => ({ code: { coding: [{ system: SILAH, code }] }, ...value });
const geneComp = (symbol: string) =>
  comp('48018-6', { valueCodeableConcept: { coding: [{ system: HGNC, code: `HGNC:${symbol}`, display: symbol }] } });
const dnaComp = (v: string) => comp('48004-6', { valueCodeableConcept: { coding: [{ system: HGVS, code: v }] } });
const sigComp = (code?: string, text?: string) =>
  comp('53037-8', { valueCodeableConcept: { ...(code ? { coding: [loinc(code)] } : {}), ...(text ? { text } : {}) } });

/** A variant observation; sig null leaves out the significance component. */
const variant = (gene: string, dna: string, sig: string | null = 'LA6668-3', extra: unknown[] = []): Res => ({
  resourceType: 'Observation',
  id: `v-${gene}-${dna}`,
  status: 'final',
  code: { coding: [loinc('69548-6')] },
  component: [geneComp(gene), dnaComp(dna), ...(sig ? [sigComp(sig)] : []), ...extra],
});
const bundle = (...resources: Res[]) => ({ resourceType: 'Bundle', type: 'collection', entry: resources.map(resource => ({ resource })) });
const patient = (extra: Record<string, unknown> = {}): Res => ({
  resourceType: 'Patient', id: 'p', name: [{ text: 'Test Person' }], gender: 'male', ...extra,
});
const report = (extra: Record<string, unknown> = {}): Res => ({
  resourceType: 'DiagnosticReport', id: 'r', status: 'final', code: { coding: [loinc('51969-4')] },
  effectiveDateTime: '2026-03-01', performer: [{ display: 'Test Lab' }], ...extra,
});
const extractedOf = (json: unknown): Extracted => {
  const r = importResultFile(JSON.stringify(json));
  if (r.kind !== 'extracted') throw new Error('expected an extracted result');
  return r.data;
};

const pick = (f: ExtractedFinding) => ({
  gene: f.gene, variant: f.variant, protein: f.protein, classification: f.classification, tag: f.tag, zygosity: f.zygosity,
});

const sample: Extracted = {
  source: 'pdf',
  name: 'Aisha Khalfan (sample)',
  sex: 'F',
  testedAt: '2026-10-20',
  lab: 'Al Waha Genomics Laboratory (fictional)',
  findings: [
    { gene: 'HBB', variant: 'NM_000518.5:c.20A>T', protein: 'p.Glu7Val', classification: 'P', tag: 'HbS', zygosity: 'het', confidence: 'high', line: 'HBB NM_000518.5:c.20A>T Pathogenic' },
    { gene: 'GJB2', variant: 'NM_004004.6:c.35delG', protein: 'p.Gly12fs', classification: 'P', zygosity: 'unknown', confidence: 'low', line: 'GJB2 NM_004004.6:c.35delG Pathogenic' },
    { gene: 'MEFV', variant: 'NM_000243.3:c.442G>C', protein: 'p.Glu148Gln', classification: 'VUS', zygosity: 'het', confidence: 'high', line: 'MEFV NM_000243.3:c.442G>C Uncertain significance' },
    { gene: 'CFTR', variant: 'NM_000492.4:c.1521_1523del', classification: 'LP', zygosity: 'hom', confidence: 'high', line: 'CFTR NM_000492.4:c.1521_1523del Likely pathogenic' },
  ],
  couple: {
    status: 'at-risk',
    sharedGenes: ['HBB'],
    partnerTags: { HBB: 'b+' },
    partnerNegativeFor: ['GJB2'],
    partnerName: 'Rashid Khalfan (sample)',
    relationship: 'first-cousins',
  },
  detection: { panelPct: 95, exactPct: 99 },
  unknownGenes: [],
  warnings: [],
};

function expectAisha(d: Extracted): void {
  expect(d.name).toBe('Aisha Khalfan (sample)');
  expect(d.sex).toBe('F');
  expect(d.testedAt).toBe('2026-10-20');
  expect(d.lab).toBe('Al Waha Genomics Laboratory (fictional)');
  expect(d.findings.map(f => [f.gene, f.classification, f.tag ?? null])).toEqual([
    ['HBB', 'P', 'HbS'],
    ['GJB2', 'P', null],
    ['MEFV', 'VUS', null],
  ]);
  expect(d.couple).toEqual({
    status: 'at-risk',
    sharedGenes: ['HBB'],
    partnerTags: { HBB: 'b+' },
    partnerNegativeFor: ['GJB2'],
    partnerName: 'Rashid Khalfan (sample)',
    relationship: 'first-cousins',
  });
  expect(d.detection).toEqual({ panelPct: 95, exactPct: 99 });
  expect(d.unknownGenes).toEqual([]);
  expect(d.warnings).toEqual([]);
}

/** Every `reference` string anywhere in a JSON value. */
function refsIn(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) x.forEach(v => refsIn(v, out));
  else if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) {
      if (k === 'reference' && typeof v === 'string') out.push(v);
      else refsIn(v, out);
    }
  }
  return out;
}

describe('FHIR variant observations', () => {
  it('maps each significance code to its classification', () => {
    const out = importFhir(bundle(
      variant('CFTR', 'NM_000492.4:c.1521_1523del', 'LA6668-3'),
      variant('HBA1', 'NM_000517.6:c.1A>G', 'LA26332-9'),
      variant('MEFV', 'NM_000243.3:c.442G>C', 'LA26333-7'),
    ));
    expect(out.findings.map(f => [f.gene, f.classification])).toEqual([['CFTR', 'P'], ['HBA1', 'LP'], ['MEFV', 'VUS']]);
  });

  it('skips benign and likely benign calls', () => {
    const out = importFhir(bundle(
      variant('CFTR', 'NM_000492.4:c.1A>G', 'LA26334-5'),
      variant('CFTR', 'NM_000492.4:c.2A>G', 'LA6675-8'),
    ));
    expect(out.findings).toEqual([]);
    expect(out.unknownGenes).toEqual([]);
  });

  it('reads the classification from the text when the code is missing', () => {
    const out = importFhir(bundle(
      variant('CFTR', 'NM_000492.4:c.1A>G', null, [sigComp(undefined, 'Likely pathogenic')]),
      variant('GJB2', 'NM_004004.6:c.35delG', null, [sigComp(undefined, 'Pathogenic')]),
    ));
    expect(out.findings.map(f => f.classification)).toEqual(['LP', 'P']);
    expect(out.findings.every(f => f.confidence === 'high')).toBe(true);
  });

  it('reads homozygous and heterozygous allelic state', () => {
    const hom = comp('53034-5', { valueCodeableConcept: { coding: [loinc('LA6705-3')] } });
    const het = comp('53034-5', { valueCodeableConcept: { coding: [loinc('LA6706-1')] } });
    const out = importFhir(bundle(
      variant('CFTR', 'NM_000492.4:c.1A>G', 'LA6668-3', [hom]),
      variant('GJB2', 'NM_004004.6:c.35delG', 'LA6668-3', [het]),
    ));
    expect(out.findings.map(f => f.zygosity)).toEqual(['hom', 'het']);
  });

  it('takes the gene from the code when it is a symbol', () => {
    const symbolOnly = comp('48018-6', { valueCodeableConcept: { coding: [{ system: HGNC, code: 'GJB2' }] } });
    const out = importFhir(bundle({ ...variant('GJB2', 'NM_004004.6:c.35delG'), component: [symbolOnly, dnaComp('NM_004004.6:c.35delG'), sigComp('LA6668-3')] }));
    expect(out.findings[0]?.gene).toBe('GJB2');
  });

  it('maps gene aliases to the panel gene', () => {
    const out = importFhir(bundle(
      variant('G6PC', 'NM_000151.4:c.648G>C', 'LA6668-3'),
      variant('GBA', 'NM_000157.4:c.1226A>G', 'LA6668-3'),
    ));
    expect(out.findings.map(f => f.gene)).toEqual(['G6PC1', 'GBA1']);
  });

  it('sends a gene off the panel to unknownGenes, not to findings', () => {
    const out = importFhir(bundle(variant('BRCA1', 'NM_007294.4:c.68_69del', 'LA6668-3'), variant('BRCA1', 'NM_007294.4:c.5A>G', 'LA6668-3')));
    expect(out.findings).toEqual([]);
    expect(out.unknownGenes).toEqual(['BRCA1']);
  });

  it('keeps the transcript prefix, the protein and a high confidence when all parts are present', () => {
    const protein = comp('48005-3', { valueCodeableConcept: { coding: [{ system: HGVS, code: 'p.Glu7Val' }] } });
    const out = importFhir(bundle(variant('HBB', 'NM_000518.5:c.20A>T', 'LA6668-3', [protein])));
    const f = out.findings[0];
    expect(f?.variant).toBe('NM_000518.5:c.20A>T');
    expect(f?.protein).toBe('p.Glu7Val');
    expect(f?.confidence).toBe('high');
    expect(f?.line).toBe('HBB NM_000518.5:c.20A>T Pathogenic');
  });

  it('reads a variant without a classification as VUS with low confidence and a warning', () => {
    const out = importFhir(bundle(variant('CFTR', 'NM_000492.4:c.1A>G', null)));
    expect(out.findings[0]?.classification).toBe('VUS');
    expect(out.findings[0]?.confidence).toBe('low');
    expect(out.warnings.length).toBeGreaterThan(0);
  });

  const HBB_CASES: [string, string][] = [
    ['c.20A>T', 'HbS'], ['c.19G>A', 'HbC'], ['c.79G>A', 'HbE'],
    ['c.92+5G>C', 'b+'], ['c.92+6T>C', 'b+'], ['c.93-21G>A', 'b+'], ['c.-138C>T', 'b+'], ['c.-78A>G', 'b+'],
    ['c.92+1G>A', 'b0'], ['c.118C>T', 'b0'], ['c.315+1G>A', 'b0'], ['c.27_28insG', 'b0'], ['c.25_26delAA', 'b0'],
  ];
  for (const [dna, tag] of HBB_CASES) {
    it(`reads HBB ${dna} as ${tag}`, () => {
      const out = importFhir(bundle(variant('HBB', `NM_000518.5:${dna}`)));
      expect(out.findings[0]?.tag).toBe(tag);
    });
  }

  it('reads no tag for a gene other than HBB', () => {
    const out = importFhir(bundle(variant('CFTR', 'NM_000492.4:c.20A>T')));
    expect(out.findings[0]?.tag).toBeUndefined();
  });
});

describe('FHIR patient, report and tolerance', () => {
  it('reads name, sex, test date and lab', () => {
    const out = importFhir(bundle(patient(), report(), variant('CFTR', 'NM_000492.4:c.1A>G')));
    expect(out.name).toBe('Test Person');
    expect(out.sex).toBe('M');
    expect(out.testedAt).toBe('2026-03-01');
    expect(out.lab).toBe('Test Lab');
    expect(out.warnings).toEqual([]);
  });

  it('builds the name from given and family when there is no text', () => {
    const out = importFhir(bundle(patient({ name: [{ given: ['Amal'], family: 'Saleh' }], gender: 'female' }), report()));
    expect(out.name).toBe('Amal Saleh');
    expect(out.sex).toBe('F');
  });

  it('takes the lab from the first Organization when the report names no performer', () => {
    const org: Res = { resourceType: 'Organization', id: 'o', name: 'Org Lab' };
    const out = importFhir(bundle(org, report({ performer: undefined })));
    expect(out.lab).toBe('Org Lab');
  });

  it('tolerates a missing Patient with a warning', () => {
    const out = importFhir(bundle(report(), variant('CFTR', 'NM_000492.4:c.1A>G')));
    expect(out.name).toBeUndefined();
    expect(out.findings).toHaveLength(1);
    expect(out.warnings.some(w => w.includes('Patient'))).toBe(true);
  });

  it('reads a single DiagnosticReport with contained resources', () => {
    const single = { ...report({ effectiveDateTime: '2026-03-01T10:00:00+04:00' }), contained: [patient(), variant('CFTR', 'NM_000492.4:c.1A>G')] };
    const r = importResultFile(JSON.stringify(single));
    expect(r.kind).toBe('extracted');
    if (r.kind !== 'extracted') return;
    expect(r.data.source).toBe('fhir');
    expect(r.data.name).toBe('Test Person');
    expect(r.data.findings).toHaveLength(1);
    expect(r.data.testedAt).toBe('2026-03-01');
    expect(r.data.lab).toBe('Test Lab');
  });

  it('warns and does not throw on an unreadable couple component', () => {
    const couple: Res = {
      resourceType: 'Observation', id: 'c', status: 'final',
      code: { coding: [{ system: SILAH, code: 'couple-analysis' }] },
      component: [
        silahComp('detection-panel', { valueQuantity: { value: 'abc' } }),
        silahComp('relationship', { valueCodeableConcept: { coding: [{ system: SILAH, code: 'cousins' }] } }),
      ],
    };
    let out: Extracted | undefined;
    expect(() => { out = importFhir(bundle(couple)); }).not.toThrow();
    expect(out?.detection).toBeUndefined();
    expect(out?.couple).toBeUndefined();
    expect(out?.warnings.length).toBeGreaterThan(0);
  });
});

describe('FHIR couple analysis (Silah codes)', () => {
  it('reads status, shared genes, partner alleles, negatives, relationship, name and detection', () => {
    const couple: Res = {
      resourceType: 'Observation', id: 'c', status: 'final',
      code: { coding: [{ system: SILAH, code: 'couple-analysis' }] },
      component: [
        silahComp('couple-status', { valueCodeableConcept: { coding: [{ system: SILAH, code: 'at-risk' }] } }),
        silahComp('shared-gene', { valueCodeableConcept: { coding: [{ system: HGNC, code: 'HGNC:5', display: 'HBB' }] } }),
        silahComp('partner-allele', { valueString: 'HBB:b+' }),
        silahComp('partner-negative-gene', { valueCodeableConcept: { coding: [{ system: HGNC, code: 'HGNC:4284', display: 'GJB2' }] } }),
        silahComp('relationship', { valueCodeableConcept: { coding: [{ system: SILAH, code: 'second-cousins' }] } }),
        silahComp('partner-name', { valueString: 'Partner Name' }),
        silahComp('detection-panel', { valueQuantity: { value: 80, unit: '%' } }),
        silahComp('detection-exact-change', { valueQuantity: { value: 99.5, unit: '%' } }),
      ],
    };
    const out = importFhir(bundle(couple));
    expect(out.couple).toEqual({
      status: 'at-risk',
      sharedGenes: ['HBB'],
      partnerTags: { HBB: 'b+' },
      partnerNegativeFor: ['GJB2'],
      partnerName: 'Partner Name',
      relationship: 'second-cousins',
    });
    expect(out.detection).toEqual({ panelPct: 80, exactPct: 99.5 });
  });

  it('warns on a partner allele without a colon', () => {
    const couple: Res = {
      resourceType: 'Observation', id: 'c', status: 'final',
      code: { coding: [{ system: SILAH, code: 'couple-analysis' }] },
      component: [silahComp('partner-allele', { valueString: 'HBB' }), silahComp('shared-gene', { valueCodeableConcept: { coding: [{ system: HGNC, code: 'HBB', display: 'HBB' }] } })],
    };
    const out = importFhir(bundle(couple));
    expect(out.couple?.partnerTags).toEqual({});
    expect(out.warnings.length).toBeGreaterThan(0);
  });
});

describe('importResultFile dispatch', () => {
  it('passes a signed Silah bundle through without verifying it', () => {
    const signed = {
      payload: { v: 1, kind: 'silah.result', person: { personId: 'x' } },
      keyId: '0123456789abcdef',
      sig: 'AAAA',
    };
    const r = importResultFile(JSON.stringify(signed));
    expect(r.kind).toBe('signed');
    if (r.kind === 'signed') expect(r.bundle).toEqual(signed);
  });

  it('converts an unsigned Silah result, with detection as percentages', () => {
    const d = extractedOf({
      v: 1,
      kind: 'silah.result',
      person: {
        personId: 'x',
        displayName: 'Test Person',
        sex: 'M',
        findings: [
          { gene: 'HBB', variant: 'NM_000518.5:c.92+5G>C', classification: 'P', tag: 'b+' },
          { gene: 'BRCA1', variant: 'NM_007294.4:c.68_69del', classification: 'P' },
        ],
        panelVersion: 'x',
        testedAt: '2026-02-11T10:00:00.000Z',
        method: 'premarital',
      },
      couple: {
        coupleId: 'c',
        partnerName: 'Partner',
        relationship: 'first-cousins',
        status: 'at-risk',
        shared: [{ gene: 'HBB', ownTag: 'b+', partnerTag: 'HbS' }],
        partnerNegativeFor: [],
        vusGenes: [],
        detection: { panel: { n: '19', d: '20' }, exactChange: { GJB2: { n: '1', d: '3' } } },
      },
      issuer: 'Test lab',
      issuedAt: '2026-02-11T10:00:00.000Z',
    });
    expect(d.source).toBe('silah-json');
    expect(d.name).toBe('Test Person');
    expect(d.sex).toBe('M');
    expect(d.testedAt).toBe('2026-02-11');
    expect(d.lab).toBe('Test lab');
    expect(d.findings.map(f => [f.gene, f.classification, f.tag])).toEqual([['HBB', 'P', 'b+']]);
    expect(d.unknownGenes).toEqual(['BRCA1']);
    expect(d.couple).toEqual({
      status: 'at-risk',
      sharedGenes: ['HBB'],
      partnerTags: { HBB: 'HbS' },
      partnerNegativeFor: [],
      partnerName: 'Partner',
      relationship: 'first-cousins',
    });
    expect(d.detection).toEqual({ panelPct: 95, exactPct: 33.3 });
  });

  it('throws unknown-format for JSON that is neither Silah nor FHIR', () => {
    expect(() => importResultFile('{"hello":1}')).toThrow('unknown-format');
    expect(() => importResultFile('[]')).toThrow('unknown-format');
  });

  it('throws not-json for text that is not JSON', () => {
    expect(() => importResultFile('not json')).toThrow('not-json');
  });
});

describe('FHIR round trip and export', () => {
  it('reproduces findings, identity, lab, couple and detection', () => {
    const json = JSON.parse(JSON.stringify(exportExtractedFhir(sample)));
    const out = importFhir(json);
    expect(out.findings.map(pick)).toEqual(sample.findings.map(pick));
    expect(out.name).toBe(sample.name);
    expect(out.sex).toBe(sample.sex);
    expect(out.testedAt).toBe(sample.testedAt);
    expect(out.lab).toBe(sample.lab);
    expect(out.couple).toEqual(sample.couple);
    expect(out.detection).toEqual(sample.detection);
    expect(out.warnings).toEqual([]);
  });

  it('exports the same JSON for the same input', () => {
    expect(exportExtractedFhir(sample)).toEqual(exportExtractedFhir(sample));
  });

  it('exports a collection with a Patient, a DiagnosticReport and one variant Observation per finding', () => {
    const b = exportExtractedFhir(sample) as { type: string; entry: { fullUrl: string; resource: Res }[] };
    expect(b.type).toBe('collection');
    const types = b.entry.map(e => e.resource.resourceType);
    expect(types.filter(t => t === 'Observation')).toHaveLength(sample.findings.length + 1);
    expect(types).toContain('Patient');
    expect(types).toContain('DiagnosticReport');
    expect(types).toContain('Organization');
    for (const e of b.entry) expect(e.fullUrl).toBe(`urn:uuid:${e.resource.id}`);
    const urls = new Set(b.entry.map(e => e.fullUrl));
    for (const r of refsIn(b)) expect(urls.has(r), r).toBe(true);
  });
});

describe('exportSummaryFhir', () => {
  const summary: PhysicianSummary = {
    v: 1,
    generatedAt: '2026-10-21T08:00:00.000Z',
    lang: 'en',
    patient: { personId: 'p-1', name: 'Aisha Khalfan (sample)', sex: 'F' },
    partner: { name: 'Rashid Khalfan (sample)' },
    relationship: 'first-cousins',
    source: {
      issuer: 'Al Waha Genomics Laboratory (fictional)',
      verified: false,
      origin: 'uploaded-pdf',
      testedAt: '2026-10-20',
      method: 'premarital',
      panelVersion: 'DoH Premarital Screening Standard V3 (Sep 2024), Appendix 12',
    },
    status: 'at-risk',
    findings: [
      { gene: 'HBB', variant: 'NM_000518.5:c.20A>T', classification: 'P', tag: 'HbS' },
      { gene: 'GJB2', variant: 'NM_004004.6:c.35delG', classification: 'P' },
    ],
    shared: [{
      gene: 'HBB',
      condition: 'Sickle cell disease',
      ownTag: 'HbS',
      partnerTag: 'b+',
      perPregnancy: { affected: '1 in 4', carrier: '1 in 2', neither: '1 in 4' },
      birthPlanEligible: true,
    }],
    residual: {
      panelRisk: '1 in 40',
      detection: { panel: '95%', exact: '99%' },
      note: 'This test does not detect all genetic disorders.',
    },
    vusGenes: ['MEFV'],
    understanding: { correct: 3, total: 4, missed: ['q2'], at: '2026-10-21T07:55:00.000Z' },
    questions: [{ at: '2026-10-21T07:50:00.000Z', q: '<script>alert(1)</script> Can my child be affected?', route: 'counsellor' }],
    escalations: [{ at: '2026-10-21T07:51:00.000Z', route: 'counsellor', seen: false }],
    flags: ['vus'],
    birthPlan: { active: true, hospital: 'Corniche Hospital', genes: ['HBB'] },
    sharing: [{ kind: 'result', gene: 'HBB', recipient: 'Dr. Sample' }],
    booking: { site: 'Clinic', slot: 'Monday 10:00', format: 'in person', language: 'en' },
    aiSummary: { sentences: [{ text: 'Both of you carry a sickle cell variant.', cards: ['shared:HBB'] }], model: 'Sample model' },
    sources: ['doh-pms-2024'],
  };
  type Bundle = { resourceType: string; id: string; identifier: unknown; timestamp: string; type: string; entry: { fullUrl: string; resource: Res }[] };
  const b = exportSummaryFhir(summary) as Bundle;
  const composition = b.entry[0]?.resource as Res;
  const sections: { title: string; text: { status: string; div: string }; entry?: { reference: string }[] }[] = composition.section;

  it('is a document whose first entry is a Composition', () => {
    expect(b.type).toBe('document');
    expect(b.timestamp).toBe(summary.generatedAt);
    expect(b.identifier).toBeTruthy();
    expect(composition.resourceType).toBe('Composition');
    expect(composition.author[0].display).toBe("Silah (generated on the patient's phone at the patient's request)");
  });

  it('gives every resource an id', () => {
    for (const e of b.entry) expect(e.resource.id).toBeTruthy();
  });

  it('gives every section a narrative div in the XHTML namespace', () => {
    expect(sections.length).toBeGreaterThanOrEqual(8);
    for (const sec of sections) {
      expect(sec.text.status).toBe('generated');
      expect(sec.text.div.startsWith(XHTML), sec.title).toBe(true);
      expect(sec.text.div.endsWith('</div>'), sec.title).toBe(true);
    }
  });

  it('escapes HTML in the narrative', () => {
    const questions = sections.find(s => s.title === 'Questions the patient asked');
    expect(questions?.text.div).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(questions?.text.div).not.toContain('<script>');
    expect(JSON.stringify(b)).not.toContain('<script>');
  });

  it('keeps the questions section free of Observations', () => {
    const questions = sections.find(s => s.title === 'Questions the patient asked');
    expect(questions?.entry).toBeUndefined();
  });

  it('links the couple analysis and one risk observation per shared gene', () => {
    const couple = sections.find(s => s.title === 'Couple result');
    const linked = (couple?.entry ?? []).map(e => b.entry.find(x => x.fullUrl === e.reference)?.resource);
    const codes = linked.map(r => r?.code?.coding?.[0]?.code);
    expect(codes).toEqual(['couple-analysis', 'risk-per-pregnancy']);
  });

  it('gives the remaining chance as a Silah observation with the panel risk', () => {
    const chance = sections.find(s => s.title === 'Remaining chance');
    const obs = b.entry.find(x => x.fullUrl === chance?.entry?.[0]?.reference)?.resource;
    expect(obs?.code.coding[0].code).toBe('panel-residual-risk');
    expect(obs?.valueString).toBe('1 in 40');
  });

  it('resolves every reference to an entry fullUrl', () => {
    const urls = new Set(b.entry.map(e => e.fullUrl));
    const refs = refsIn(b);
    expect(refs.length).toBeGreaterThan(5);
    for (const r of refs) expect(urls.has(r), r).toBe(true);
  });

  it('omits the optional sections when the summary has none of them', () => {
    const bare = exportSummaryFhir({ ...summary, vusGenes: [], understanding: undefined, birthPlan: undefined, booking: undefined, aiSummary: undefined }) as Bundle;
    const titles = ((bare.entry[0]?.resource as Res).section as { title: string }[]).map(s => s.title);
    expect(titles).not.toContain('Variants of uncertain significance');
    expect(titles).not.toContain('Understanding check');
    expect(titles).not.toContain('Birth plan');
    expect(titles).not.toContain('Booking');
    expect(titles).not.toContain('Plain-language summary (language model, checked)');
    expect(titles[titles.length - 1]).toBe('Sources');
  });
});

describe('sample files (docs/SAMPLE_REPORTS.md, sample 1)', () => {
  const samples = new URL('../public/samples/', import.meta.url);
  const sampleText = (name: string) => readFileSync(new URL(name, samples), 'utf8');

  it('reads the FHIR sample as Aisha', () => {
    const r = importResultFile(sampleText('aisha-khalfan-sample.fhir.json'));
    expect(r.kind).toBe('extracted');
    if (r.kind !== 'extracted') return;
    expect(r.data.source).toBe('fhir');
    expectAisha(r.data);
  });

  it('reads the Silah sample as Aisha', () => {
    const r = importResultFile(sampleText('aisha-khalfan-sample.silah.json'));
    expect(r.kind).toBe('extracted');
    if (r.kind !== 'extracted') return;
    expect(r.data.source).toBe('silah-json');
    expectAisha(r.data);
  });
});
