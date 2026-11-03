// Writes the sample files for Aisha Khalfan (fictional), sample 1 in docs/SAMPLE_REPORTS.md:
//   public/samples/aisha-khalfan-sample.fhir.json   FHIR collection (HL7 Genomics Reporting shape)
//   public/samples/aisha-khalfan-sample.silah.json  unsigned Silah result
// Run: node scripts/make_sample_fhir.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'samples');

const SAMPLE = 'SAMPLE: fictional person, not a real result';
const LOINC = 'http://loinc.org';
const HGNC = 'http://www.genenames.org/geneId';
const HGVS = 'http://varnomen.hgvs.org';
const UCUM = 'http://unitsofmeasure.org';
const SILAH = 'https://marc-dvci.github.io/Silah/fhir/CodeSystem/silah';
const LAB = 'Al Waha Genomics Laboratory (fictional)';
const PARTNER = 'Rashid Khalfan (sample)';
const PERSON = 'Aisha Khalfan (sample)';
const PANEL = 'DoH Premarital Screening Standard V3 (Sep 2024), Appendix 12';

const uuid = (n) => `5a1e0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const urn = (u) => `urn:uuid:${u}`;
const ref = (u) => ({ reference: urn(u) });
const coding = (system, code, display) => (display ? { system, code, display } : { system, code });
const sampleTag = { system: SILAH, code: 'sample', display: SAMPLE };

const P = uuid(1);
const LAB_ID = uuid(2);
const REPORT = uuid(3);
const HBB = uuid(4);
const GJB2 = uuid(5);
const MEFV = uuid(6);
const COUPLE = uuid(7);

const gene = (symbol) => ({ coding: [coding(HGNC, symbol, symbol)], text: symbol });
const hgvs = (text) => ({ coding: [coding(HGVS, text)], text });
const percent = (value) => ({ value, unit: '%', system: UCUM, code: '%' });
const silah = (code) => ({ coding: [coding(SILAH, code)] });

function variantObservation(u, symbol, dna, protein, zygosity, significance) {
  const [sigCode, sigText] = significance;
  const [zygCode, zygText] = zygosity;
  return {
    resourceType: 'Observation',
    id: u,
    status: 'final',
    code: { coding: [coding(LOINC, '69548-6', 'Genetic variant assessment')], text: 'Genetic variant assessment' },
    subject: ref(P),
    component: [
      { code: { coding: [coding(LOINC, '48018-6', 'Gene studied')] }, valueCodeableConcept: gene(symbol) },
      { code: { coding: [coding(LOINC, '48004-6', 'DNA change (c.HGVS)')] }, valueCodeableConcept: hgvs(dna) },
      { code: { coding: [coding(LOINC, '48005-3', 'Amino acid change (p.HGVS)')] }, valueCodeableConcept: hgvs(protein) },
      {
        code: { coding: [coding(LOINC, '53034-5', 'Allelic state')] },
        valueCodeableConcept: { coding: [coding(LOINC, zygCode, zygText)], text: zygText.toLowerCase() },
      },
      {
        code: { coding: [coding(LOINC, '53037-8', 'Clinical significance')] },
        valueCodeableConcept: { coding: [coding(LOINC, sigCode, sigText)], text: sigText },
      },
    ],
  };
}

const HET = ['LA6706-1', 'Heterozygous'];
const PATHOGENIC = ['LA6668-3', 'Pathogenic'];
const VUS = ['LA26333-7', 'Uncertain significance'];

const fhir = {
  resourceType: 'Bundle',
  id: 'aisha-khalfan-sample',
  meta: { tag: [sampleTag] },
  type: 'collection',
  timestamp: '2026-10-20T09:00:00Z',
  entry: [
    {
      fullUrl: urn(P),
      resource: {
        resourceType: 'Patient',
        id: P,
        meta: { tag: [sampleTag] },
        name: [{ text: PERSON }],
        gender: 'female',
        birthDate: '1999-03-14',
      },
    },
    {
      fullUrl: urn(LAB_ID),
      resource: { resourceType: 'Organization', id: LAB_ID, name: LAB },
    },
    {
      fullUrl: urn(REPORT),
      resource: {
        resourceType: 'DiagnosticReport',
        id: REPORT,
        status: 'final',
        code: { coding: [coding(LOINC, '51969-4', 'Genetic analysis report')], text: 'Genetic analysis report' },
        subject: ref(P),
        effectiveDateTime: '2026-10-20',
        issued: '2026-10-20T09:00:00Z',
        performer: [{ reference: urn(LAB_ID), display: LAB }],
        result: [ref(HBB), ref(GJB2), ref(MEFV), ref(COUPLE)],
      },
    },
    {
      fullUrl: urn(HBB),
      resource: variantObservation(HBB, 'HBB', 'NM_000518.5:c.20A>T', 'p.Glu7Val', HET, PATHOGENIC),
    },
    {
      fullUrl: urn(GJB2),
      resource: variantObservation(GJB2, 'GJB2', 'NM_004004.6:c.35delG', 'p.Gly12fs', HET, PATHOGENIC),
    },
    {
      fullUrl: urn(MEFV),
      resource: variantObservation(MEFV, 'MEFV', 'NM_000243.3:c.442G>C', 'p.Glu148Gln', HET, VUS),
    },
    {
      fullUrl: urn(COUPLE),
      resource: {
        resourceType: 'Observation',
        id: COUPLE,
        status: 'final',
        code: { coding: [coding(SILAH, 'couple-analysis', 'Couple analysis')], text: 'Couple analysis' },
        subject: ref(P),
        component: [
          { code: silah('couple-status'), valueCodeableConcept: { coding: [coding(SILAH, 'at-risk')], text: 'at-risk' } },
          { code: silah('shared-gene'), valueCodeableConcept: gene('HBB') },
          { code: silah('partner-allele'), valueString: 'HBB:b+' },
          { code: silah('partner-negative-gene'), valueCodeableConcept: gene('GJB2') },
          { code: silah('relationship'), valueCodeableConcept: { coding: [coding(SILAH, 'first-cousins')], text: 'first-cousins' } },
          { code: silah('partner-name'), valueString: PARTNER },
          { code: silah('detection-panel'), valueQuantity: percent(95) },
          { code: silah('detection-exact-change'), valueQuantity: percent(99) },
        ],
      },
    },
  ],
};

// No _comment here: the payload schema (schema/result-bundle.schema.json) forbids extra keys.
const silahResult = {
  v: 1,
  kind: 'silah.result',
  person: {
    personId: 'sample-aisha-khalfan',
    displayName: PERSON,
    sex: 'F',
    findings: [
      { gene: 'HBB', variant: 'NM_000518.5:c.20A>T', classification: 'P', tag: 'HbS' },
      { gene: 'GJB2', variant: 'NM_004004.6:c.35delG', classification: 'P' },
      { gene: 'MEFV', variant: 'NM_000243.3:c.442G>C', classification: 'VUS' },
    ],
    panelVersion: PANEL,
    testedAt: '2026-10-20',
    method: 'premarital',
  },
  couple: {
    coupleId: 'sample-aisha-rashid',
    partnerName: PARTNER,
    relationship: 'first-cousins',
    status: 'at-risk',
    shared: [{ gene: 'HBB', ownTag: 'HbS', partnerTag: 'b+' }],
    partnerNegativeFor: ['GJB2'],
    vusGenes: [],
    detection: {
      panel: { n: '19', d: '20' },
      exactChange: { GJB2: { n: '99', d: '100' } },
    },
  },
  issuer: LAB,
  issuedAt: '2026-10-20T09:00:00Z',
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'aisha-khalfan-sample.fhir.json'), `${JSON.stringify(fhir, null, 2)}\n`);
writeFileSync(join(outDir, 'aisha-khalfan-sample.silah.json'), `${JSON.stringify(silahResult, null, 2)}\n`);
console.log(`wrote ${join(outDir, 'aisha-khalfan-sample.fhir.json')}`);
console.log(`wrote ${join(outDir, 'aisha-khalfan-sample.silah.json')}`);
