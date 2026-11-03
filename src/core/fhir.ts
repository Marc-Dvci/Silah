// FHIR R4 for Silah. Reads a result file the person brings (a signed Silah bundle, an unsigned Silah
// result, a FHIR bundle or a DiagnosticReport with contained resources), and writes a results collection
// or the physician summary as a document. Nothing read here is verified; the app verifies signed files.

import { PANEL_ALIASES, PANEL_SET } from './data/panel';
import type { Extracted, ExtractedCouple, ExtractedFinding, Imported } from './import/types';
import type { PhysicianSummary } from './summary-types';
import type { Classification, Relationship, ResultBundle, Signed } from './types';

type Fhir = Record<string, any>;
type Detection = NonNullable<Extracted['detection']>;

const LOINC = 'http://loinc.org';
const HGNC = 'http://www.genenames.org/geneId';
const HGVS = 'http://varnomen.hgvs.org';
const UCUM = 'http://unitsofmeasure.org';
const SILAH = 'https://marc-dvci.github.io/Silah/fhir/CodeSystem/silah';
const XHTML = 'http://www.w3.org/1999/xhtml';

const L_VARIANT = '69548-6';     // Genetic variant assessment
const L_REPORT = '51969-4';      // Genetic analysis report
const L_SUMMARY = '11488-4';     // Consult note
const L_GENE = '48018-6';
const L_DNA = '48004-6';
const L_PROTEIN = '48005-3';
const L_ZYGOSITY = '53034-5';
const L_SIGNIFICANCE = '53037-8';

const LABEL: Record<Classification, string> = { P: 'Pathogenic', LP: 'Likely pathogenic', VUS: 'Uncertain significance' };
const SIG_LOINC: Record<Classification, { code: string; text: string }> = {
  P: { code: 'LA6668-3', text: 'Pathogenic' },
  LP: { code: 'LA26332-9', text: 'Likely pathogenic' },
  VUS: { code: 'LA26333-7', text: 'Uncertain significance' },
};
const SIG_CODES = new Map<string, Classification | 'benign'>([
  ['LA6668-3', 'P'], ['LA26332-9', 'LP'], ['LA26333-7', 'VUS'], ['LA26334-5', 'benign'], ['LA6675-8', 'benign'],
]);
const ZYG_CODES = new Map<string, 'het' | 'hom'>([['LA6706-1', 'het'], ['LA6705-3', 'hom']]);
const HBB_TAGS = new Map<string, string>([
  ['c.20A>T', 'HbS'], ['c.19G>A', 'HbC'], ['c.79G>A', 'HbE'],
  ['c.92+5G>C', 'b+'], ['c.92+6T>C', 'b+'], ['c.93-21G>A', 'b+'], ['c.-138C>T', 'b+'], ['c.-78A>G', 'b+'],
  ['c.92+1G>A', 'b0'], ['c.118C>T', 'b0'], ['c.315+1G>A', 'b0'], ['c.27_28insG', 'b0'], ['c.25_26delAA', 'b0'],
]);
const RELATIONSHIPS: readonly Relationship[] = [
  'unrelated', 'second-cousins', 'first-cousins-once-removed', 'first-cousins', 'double-first-cousins',
];

const isObj = (x: unknown): x is Fhir => typeof x === 'object' && x !== null && !Array.isArray(x);
const arr = (x: unknown): Fhir[] => (Array.isArray(x) ? x.filter(isObj) : []);
const str = (x: unknown): string | undefined => (typeof x === 'string' && x.trim() !== '' ? x.trim() : undefined);
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.map(str).filter((s): s is string => s !== undefined) : []);
const isRelationship = (x: unknown): x is Relationship => RELATIONSHIPS.includes(x as Relationship);
const isClassification = (x: unknown): x is Classification => x === 'P' || x === 'LP' || x === 'VUS';

const isoDate = (x: unknown): string | undefined => {
  const s = str(x);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
};

const canonGene = (raw: string): string => {
  const g = raw.trim().toUpperCase();
  return Object.hasOwn(PANEL_ALIASES, g) ? PANEL_ALIASES[g] : g;
};

const afterColon = (v: string): string => v.slice(v.lastIndexOf(':') + 1).trim();

const sexOf = (gender: unknown): 'F' | 'M' | undefined => {
  const g = str(gender)?.toLowerCase();
  return g === 'female' ? 'F' : g === 'male' ? 'M' : undefined;
};

// Codings and components. A component is one entry of Observation.component.
const codings = (cc: unknown): Fhir[] => (isObj(cc) ? arr(cc.coding) : []);
const hasCoding = (cc: unknown, system: string, code: string): boolean =>
  codings(cc).some(c => c.code === code && c.system === system);
const compsOf = (obs: Fhir, code: string, system: string): Fhir[] =>
  arr(obs.component).filter(c => hasCoding(c.code, system, code));
const compOf = (obs: Fhir, code: string, system: string): Fhir | undefined => compsOf(obs, code, system)[0];
const vcc = (c: Fhir | undefined): Fhir | undefined => {
  const v = c?.valueCodeableConcept;
  return isObj(v) ? v : undefined;
};

/** The HGNC symbol in a codeable concept: the display, or the code when it is a symbol, or the text. */
function symbolOf(cc: Fhir | undefined): string | undefined {
  const cs = codings(cc);
  const hgnc = cs.find(c => c.system === HGNC) ?? cs[0];
  const pick = [hgnc?.display, hgnc?.code, cc?.text].map(str).find(x => x !== undefined && !/^HGNC:/i.test(x));
  return pick?.toUpperCase();
}

/** An HGVS string in a component: the HGVS coding, else the text, else any code. */
function hgvsOf(c: Fhir | undefined): string | undefined {
  const cc = vcc(c);
  return str(codings(cc).find(x => x.system === HGVS)?.code) ?? str(cc?.text) ?? str(codings(cc)[0]?.code);
}

/** The code of a Silah-coded value (or the first code, or the text). */
function ccCode(c: Fhir | undefined): string | undefined {
  const cc = vcc(c);
  return str(codings(cc).find(x => x.system === SILAH)?.code) ?? str(codings(cc)[0]?.code) ?? str(cc?.text);
}

function significanceOf(c: Fhir | undefined): Classification | 'benign' | undefined {
  const cc = vcc(c);
  for (const x of codings(cc)) {
    const hit = SIG_CODES.get(String(x.code));
    if (hit) return hit;
  }
  const text = [cc?.text, ...codings(cc).map(x => x.display)].map(str).find(x => x !== undefined);
  if (!text) return undefined;
  const t = text.toLowerCase();
  if (t.includes('likely pathogenic')) return 'LP';
  if (t.includes('likely benign')) return 'benign';
  if (t.includes('uncertain')) return 'VUS';
  if (t.includes('benign')) return 'benign';
  if (t.includes('pathogenic')) return 'P';
  return undefined;
}

function zygosityOf(c: Fhir | undefined): 'het' | 'hom' | 'unknown' | undefined {
  if (!c) return undefined;
  const cc = vcc(c);
  for (const x of codings(cc)) {
    const hit = ZYG_CODES.get(String(x.code));
    if (hit) return hit;
  }
  const t = (str(cc?.text) ?? codings(cc).map(x => str(x.display)).find(x => x !== undefined) ?? '').toLowerCase();
  if (t.includes('hetero')) return 'het';
  if (t.includes('homo')) return 'hom';
  return 'unknown';
}

const pctOf = (x: unknown): number | undefined => {
  const m = typeof x === 'string' ? x.match(/^\s*(\d+(?:\.\d+)?)\s*%?\s*$/) : null;
  return m ? Number(m[1]) : undefined;
};

/** An exact fraction n/d (decimal integer strings) as a percentage, one decimal place. */
function qPct(q: unknown): number | undefined {
  if (!isObj(q) || typeof q.n !== 'string' || typeof q.d !== 'string') return undefined;
  if (!/^\d+$/.test(q.n) || !/^\d+$/.test(q.d) || Number(q.d) === 0) return undefined;
  return Math.round((Number(q.n) / Number(q.d)) * 1000) / 10;
}

function pctValue(c: Fhir | undefined, warnings: string[], label: string): number | undefined {
  if (!c) return undefined;
  const raw = c.valueQuantity?.value;
  const v = typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+(\.\d+)?$/.test(raw) ? Number(raw) : NaN;
  if (v > 0 && v <= 100) return v;
  warnings.push(`${label} is not a percentage; not read.`);
  return undefined;
}

function patientName(p: Fhir): string | undefined {
  const n = arr(p.name)[0];
  if (!n) return undefined;
  const text = str(n.text);
  if (text) return text;
  const joined = [...strs(n.given), str(n.family)].filter(Boolean).join(' ');
  return joined || undefined;
}

/** Resources of a bundle, or of a single resource, with their contained resources. */
function resourcesOf(json: Fhir, warnings: string[]): Fhir[] {
  let roots: Fhir[] = [];
  if (json.resourceType === 'Bundle') roots = arr(json.entry).map(e => e.resource).filter(isObj);
  else if (typeof json.resourceType === 'string') roots = [json];
  else warnings.push('Not a FHIR resource.');
  return roots.flatMap(r => [r, ...arr(r.contained)]);
}

// ---------------------------------------------------------------- import

/** Reads a file the person brings. Throws 'not-json' or 'unknown-format'. */
export function importResultFile(text: string): Imported {
  let json: unknown;
  try {
    json = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new Error('not-json');
  }
  if (!isObj(json)) throw new Error('unknown-format');
  if (isObj(json.payload) && json.payload.kind === 'silah.result' && typeof json.keyId === 'string' && typeof json.sig === 'string') {
    return { kind: 'signed', bundle: json as unknown as Signed<ResultBundle> };
  }
  if (json.kind === 'silah.result' && json.v === 1) return { kind: 'extracted', data: importSilah(json) };
  if (json.resourceType === 'Bundle' || (json.resourceType === 'DiagnosticReport' && Array.isArray(json.contained))) {
    return { kind: 'extracted', data: importFhir(json) };
  }
  throw new Error('unknown-format');
}

/** An unsigned Silah result file. Its findings are not verified; the person confirms them. */
function importSilah(r: Fhir): Extracted {
  const out: Extracted = { source: 'silah-json', findings: [], unknownGenes: [], warnings: [] };
  const person = isObj(r.person) ? r.person : {};
  const name = str(person.displayName);
  if (name) out.name = name;
  if (person.sex === 'F' || person.sex === 'M') out.sex = person.sex;
  const day = isoDate(person.testedAt);
  if (day) out.testedAt = day;
  const lab = str(r.issuer);
  if (lab) out.lab = lab;

  for (const f of arr(person.findings)) {
    const raw = str(f.gene);
    if (!raw) { out.warnings.push('A finding has no gene; not read.'); continue; }
    const gene = canonGene(raw);
    if (!PANEL_SET.has(gene)) {
      if (!out.unknownGenes.includes(raw.toUpperCase())) out.unknownGenes.push(raw.toUpperCase());
      continue;
    }
    const cls: unknown = f.classification;
    if (!isClassification(cls)) { out.warnings.push(`${gene}: unknown classification not read.`); continue; }
    const variant = str(f.variant);
    if (!variant) { out.warnings.push(`${gene}: no variant printed; not read.`); continue; }
    const finding: ExtractedFinding = { gene, variant, classification: cls, confidence: 'high', line: `${gene} ${variant} ${LABEL[cls]}` };
    const tag = str(f.tag);
    if (tag) finding.tag = tag;
    out.findings.push(finding);
  }

  if (isObj(r.couple)) {
    const c = r.couple;
    const couple: ExtractedCouple = { sharedGenes: [], partnerTags: {}, partnerNegativeFor: [] };
    if (c.status === 'at-risk' || c.status === 'compatible') couple.status = c.status;
    for (const sh of arr(c.shared)) {
      const g = str(sh.gene);
      if (!g) continue;
      const cg = canonGene(g);
      couple.sharedGenes.push(cg);
      const pt = str(sh.partnerTag);
      if (pt) couple.partnerTags[cg] = pt;
    }
    couple.partnerNegativeFor = strs(c.partnerNegativeFor).map(canonGene);
    const pn = str(c.partnerName);
    if (pn) couple.partnerName = pn;
    if (isRelationship(c.relationship)) couple.relationship = c.relationship;
    const detection: Detection = {};
    const panelPct = qPct(c.detection?.panel);
    if (panelPct !== undefined) detection.panelPct = panelPct;
    const exactPct = qPct(Object.values(isObj(c.detection?.exactChange) ? c.detection.exactChange : {})[0]);
    if (exactPct !== undefined) detection.exactPct = exactPct;
    if (hasCouple(couple)) out.couple = couple;
    if (Object.keys(detection).length) out.detection = detection;
  }
  return out;
}

const hasCouple = (c: ExtractedCouple): boolean =>
  c.status !== undefined || c.sharedGenes.length > 0 || c.partnerNegativeFor.length > 0 ||
  Object.keys(c.partnerTags).length > 0 || c.relationship !== undefined || c.partnerName !== undefined;

/** A FHIR R4 bundle (any type) or a DiagnosticReport with contained resources, in the HL7 Genomics Reporting shape. */
export function importFhir(json: unknown): Extracted {
  const out: Extracted = { source: 'fhir', findings: [], unknownGenes: [], warnings: [] };
  if (!isObj(json)) { out.warnings.push('Not a FHIR JSON object.'); return out; }
  const resources = resourcesOf(json, out.warnings);

  const patient = resources.find(r => r.resourceType === 'Patient');
  if (patient) {
    const name = patientName(patient);
    if (name) out.name = name;
    const sex = sexOf(patient.gender);
    if (sex) out.sex = sex;
  } else {
    out.warnings.push('No Patient resource: name and sex not read.');
  }

  const report = resources.find(r => r.resourceType === 'DiagnosticReport');
  if (report) {
    const day = isoDate(report.effectiveDateTime ?? report.effectivePeriod?.start ?? report.issued);
    if (day) out.testedAt = day;
    const lab = str(arr(report.performer)[0]?.display);
    if (lab) out.lab = lab;
  } else {
    out.warnings.push('No DiagnosticReport: test date and lab not read.');
  }
  if (!out.lab) {
    const org = resources.find(r => r.resourceType === 'Organization' && str(r.name));
    if (org) out.lab = str(org.name);
  }

  const seen = new Set<string>();
  for (const obs of resources) {
    if (obs.resourceType !== 'Observation' || !hasCoding(obs.code, LOINC, L_VARIANT)) continue;
    const f = readVariant(obs, out);
    if (!f) continue;
    const key = `${f.gene} ${f.variant} ${f.protein ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.findings.push(f);
  }

  const couples = resources.filter(r => r.resourceType === 'Observation' && hasCoding(r.code, SILAH, 'couple-analysis'));
  if (couples.length > 1) out.warnings.push('More than one couple analysis; the first is used.');
  if (couples[0]) {
    const { couple, detection } = readCouple(couples[0], out.warnings);
    if (couple) out.couple = couple;
    if (detection) out.detection = detection;
  }
  return out;
}

/** One variant observation. Benign calls are skipped; a call without a classification is read as VUS. */
function readVariant(obs: Fhir, out: Extracted): ExtractedFinding | undefined {
  const sig = significanceOf(compOf(obs, L_SIGNIFICANCE, LOINC));
  if (sig === 'benign') return undefined;
  const raw = symbolOf(vcc(compOf(obs, L_GENE, LOINC)));
  const dna = hgvsOf(compOf(obs, L_DNA, LOINC));
  const protein = hgvsOf(compOf(obs, L_PROTEIN, LOINC));
  if (!raw) {
    out.warnings.push(`Variant ${dna ?? protein ?? ''} has no gene; not read.`);
    return undefined;
  }
  const gene = canonGene(raw);
  if (!PANEL_SET.has(gene)) {
    if (!out.unknownGenes.includes(raw)) out.unknownGenes.push(raw);
    return undefined;
  }
  const classification: Classification = sig ?? 'VUS';
  const variant = dna ?? '';
  if (!dna) out.warnings.push(`${gene}: no c. change printed; check the line.`);
  if (!sig) out.warnings.push(`${gene} ${variant}: no classification; shown as uncertain significance.`);

  const explicitTag = str(compOf(obs, 'allele-class', SILAH)?.valueString);
  const tag = explicitTag ?? (gene === 'HBB' ? HBB_TAGS.get(afterColon(variant)) : undefined);
  const zygosity = zygosityOf(compOf(obs, L_ZYGOSITY, LOINC));

  const f: ExtractedFinding = {
    gene,
    variant,
    classification,
    confidence: dna && sig ? 'high' : 'low',
    line: [gene, dna ?? protein, LABEL[classification]].filter(Boolean).join(' '),
  };
  if (protein) f.protein = protein;
  if (tag) f.tag = tag;
  if (zygosity) f.zygosity = zygosity;
  return f;
}

/** Silah's couple-analysis observation. The detection figures live on it too. */
function readCouple(obs: Fhir, warnings: string[]): { couple?: ExtractedCouple; detection?: Detection } {
  const couple: ExtractedCouple = { sharedGenes: [], partnerTags: {}, partnerNegativeFor: [] };
  const status = ccCode(compOf(obs, 'couple-status', SILAH));
  if (status === 'at-risk' || status === 'compatible') couple.status = status;
  else if (status) warnings.push(`Unknown couple status "${status}" not read.`);

  for (const c of compsOf(obs, 'shared-gene', SILAH)) {
    const g = symbolOf(vcc(c));
    if (g) couple.sharedGenes.push(canonGene(g));
    else warnings.push('A shared gene has no symbol; not read.');
  }
  for (const c of compsOf(obs, 'partner-allele', SILAH)) {
    const v = str(c.valueString);
    const at = v ? v.indexOf(':') : -1;
    if (v && at > 0 && at < v.length - 1) couple.partnerTags[canonGene(v.slice(0, at))] = v.slice(at + 1).trim();
    else warnings.push(`Partner allele "${v ?? ''}" not read.`);
  }
  for (const c of compsOf(obs, 'partner-negative-gene', SILAH)) {
    const g = symbolOf(vcc(c));
    if (g) couple.partnerNegativeFor.push(canonGene(g));
  }
  const rel = ccCode(compOf(obs, 'relationship', SILAH));
  if (isRelationship(rel)) couple.relationship = rel;
  else if (rel) warnings.push(`Unknown relationship "${rel}" not read.`);
  const partner = str(compOf(obs, 'partner-name', SILAH)?.valueString);
  if (partner) couple.partnerName = partner;

  const detection: Detection = {};
  const panelPct = pctValue(compOf(obs, 'detection-panel', SILAH), warnings, 'detection-panel');
  if (panelPct !== undefined) detection.panelPct = panelPct;
  const exactPct = pctValue(compOf(obs, 'detection-exact-change', SILAH), warnings, 'detection-exact-change');
  if (exactPct !== undefined) detection.exactPct = exactPct;

  return {
    ...(hasCouple(couple) ? { couple } : {}),
    ...(Object.keys(detection).length ? { detection } : {}),
  };
}

// ---------------------------------------------------------------- export

const uuid = (n: number): string => `6e3a0000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const urn = (id: string): string => `urn:uuid:${id}`;
/** Deterministic ids for one export, so the same input gives the same file. */
function idSource(): () => string {
  let n = 0;
  return () => uuid(++n);
}

const coding = (system: string, code: string, display?: string): Fhir => (display ? { system, code, display } : { system, code });
const codeable = (cs: Fhir[], text?: string): Fhir => (text ? { coding: cs, text } : { coding: cs });
const silahCode = (code: string): Fhir => codeable([coding(SILAH, code)]);
const loincCode = (code: string, display: string): Fhir => codeable([coding(LOINC, code, display)], display);
const geneCode = (g: string): Fhir => codeable([coding(HGNC, g, g)], g);
const hgvsCode = (v: string): Fhir => codeable([coding(HGVS, v)], v);
const percent = (v: number): Fhir => ({ value: v, unit: '%', system: UCUM, code: '%' });

function zygosityCode(z: 'het' | 'hom' | 'unknown'): Fhir {
  if (z === 'het') return codeable([coding(LOINC, 'LA6706-1', 'Heterozygous')], 'heterozygous');
  if (z === 'hom') return codeable([coding(LOINC, 'LA6705-3', 'Homozygous')], 'homozygous');
  return { text: 'unknown' };
}

function patientResource(id: string, name?: string, sex?: 'F' | 'M'): Fhir {
  return {
    resourceType: 'Patient',
    id,
    ...(name ? { name: [{ text: name }] } : {}),
    ...(sex ? { gender: sex === 'F' ? 'female' : 'male' } : {}),
  };
}

type VariantInput = Pick<ExtractedFinding, 'gene' | 'variant' | 'classification' | 'protein' | 'zygosity' | 'tag'>;

function variantObservation(id: string, subject: string, f: VariantInput): Fhir {
  const sig = SIG_LOINC[f.classification];
  const components: Fhir[] = [
    { code: loincCode(L_GENE, 'Gene studied'), valueCodeableConcept: geneCode(f.gene) },
    { code: loincCode(L_DNA, 'DNA change (c.HGVS)'), valueCodeableConcept: hgvsCode(f.variant) },
  ];
  if (f.protein) components.push({ code: loincCode(L_PROTEIN, 'Amino acid change (p.HGVS)'), valueCodeableConcept: hgvsCode(f.protein) });
  if (f.zygosity) components.push({ code: loincCode(L_ZYGOSITY, 'Allelic state'), valueCodeableConcept: zygosityCode(f.zygosity) });
  components.push({
    code: loincCode(L_SIGNIFICANCE, 'Clinical significance'),
    valueCodeableConcept: codeable([coding(LOINC, sig.code, sig.text)], sig.text),
  });
  if (f.tag) components.push({ code: silahCode('allele-class'), valueString: f.tag });
  return {
    resourceType: 'Observation',
    id,
    status: 'final',
    code: loincCode(L_VARIANT, 'Genetic variant assessment'),
    subject: { reference: subject },
    component: components,
  };
}

/** Silah's couple analysis. Undefined when there is nothing to say. */
function coupleObservation(id: string, subject: string, couple?: ExtractedCouple, detection?: Detection): Fhir | undefined {
  const c: Fhir[] = [];
  if (couple?.status) c.push({ code: silahCode('couple-status'), valueCodeableConcept: codeable([coding(SILAH, couple.status)], couple.status) });
  for (const g of couple?.sharedGenes ?? []) c.push({ code: silahCode('shared-gene'), valueCodeableConcept: geneCode(g) });
  for (const [g, tag] of Object.entries(couple?.partnerTags ?? {})) c.push({ code: silahCode('partner-allele'), valueString: `${g}:${tag}` });
  for (const g of couple?.partnerNegativeFor ?? []) c.push({ code: silahCode('partner-negative-gene'), valueCodeableConcept: geneCode(g) });
  if (couple?.relationship) {
    c.push({ code: silahCode('relationship'), valueCodeableConcept: codeable([coding(SILAH, couple.relationship)], couple.relationship) });
  }
  if (couple?.partnerName) c.push({ code: silahCode('partner-name'), valueString: couple.partnerName });
  if (detection?.panelPct !== undefined) c.push({ code: silahCode('detection-panel'), valueQuantity: percent(detection.panelPct) });
  if (detection?.exactPct !== undefined) c.push({ code: silahCode('detection-exact-change'), valueQuantity: percent(detection.exactPct) });
  if (!c.length) return undefined;
  return {
    resourceType: 'Observation',
    id,
    status: 'final',
    code: codeable([coding(SILAH, 'couple-analysis', 'Couple analysis')], 'Couple analysis'),
    subject: { reference: subject },
    component: c,
  };
}

/** The inverse of importFhir: a results collection with the patient, lab, report and observations. */
export function exportExtractedFhir(e: Extracted, opts: { id?: string } = {}): object {
  const next = idSource();
  const bundleId = opts.id ?? next();
  const patientId = next();
  const patientUrl = urn(patientId);
  const orgId = e.lab ? next() : undefined;
  const reportId = next();
  const obsIds = e.findings.map(() => next());
  const coupleId = next();
  const couple = e.couple || e.detection ? coupleObservation(coupleId, patientUrl, e.couple, e.detection) : undefined;

  const report: Fhir = {
    resourceType: 'DiagnosticReport',
    id: reportId,
    status: 'final',
    code: loincCode(L_REPORT, 'Genetic analysis report'),
    subject: { reference: patientUrl },
    ...(e.testedAt ? { effectiveDateTime: e.testedAt } : {}),
    ...(orgId ? { performer: [{ reference: urn(orgId), display: e.lab }] } : {}),
    ...(obsIds.length || couple ? { result: [...obsIds.map(id => ({ reference: urn(id) })), ...(couple ? [{ reference: urn(coupleId) }] : [])] } : {}),
  };
  const resources: Fhir[] = [
    patientResource(patientId, e.name, e.sex),
    ...(orgId ? [{ resourceType: 'Organization', id: orgId, name: e.lab }] : []),
    report,
    ...e.findings.map((f, i) => variantObservation(obsIds[i], patientUrl, f)),
    ...(couple ? [couple] : []),
  ];
  return {
    resourceType: 'Bundle',
    id: bundleId,
    type: 'collection',
    entry: resources.map(r => ({ fullUrl: urn(r.id), resource: r })),
  };
}

// Narrative helpers. Every string that reaches the narrative is escaped here.
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const div = (body: string): string => `<div xmlns="${XHTML}">${body}</div>`;
const p = (t: string): string => `<p>${esc(t)}</p>`;
const ul = (items: string[]): string => `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;
const section = (title: string, body: string, refs: string[] = []): Fhir => ({
  title,
  text: { status: 'generated', div: div(body) },
  ...(refs.length ? { entry: refs.map(reference => ({ reference })) } : {}),
});
const yesNo = (b: boolean): string => (b ? 'yes' : 'no');

/** One shared gene's per-pregnancy figures, as a Silah-coded observation. */
function riskObservation(id: string, subject: string, sh: PhysicianSummary['shared'][number]): Fhir {
  return {
    resourceType: 'Observation',
    id,
    status: 'final',
    code: codeable([coding(SILAH, 'risk-per-pregnancy', 'Risk per pregnancy')], 'Risk per pregnancy'),
    subject: { reference: subject },
    component: [
      { code: silahCode('gene'), valueString: sh.gene },
      { code: silahCode('condition'), valueString: sh.condition },
      { code: silahCode('affected'), valueString: sh.perPregnancy.affected },
      { code: silahCode('carrier'), valueString: sh.perPregnancy.carrier },
      { code: silahCode('neither'), valueString: sh.perPregnancy.neither },
    ],
  };
}

/** The physician summary as a FHIR document: a Composition with one narrative section per topic. */
export function exportSummaryFhir(s: PhysicianSummary): object {
  const next = idSource();
  const patientId = next();
  const patientUrl = urn(patientId);
  const res: Fhir[] = [patientResource(patientId, s.patient.name, s.patient.sex)];
  const add = (r: Fhir): string => {
    res.push(r);
    return urn(r.id);
  };
  const sections: Fhir[] = [];

  const labUrl = add({ resourceType: 'Organization', id: next(), name: s.source.issuer });
  sections.push(section(
    'Result and source',
    p(`Issuer: ${s.source.issuer}.`) +
      p(`Verified on the phone: ${yesNo(s.source.verified)}. Origin: ${s.source.origin}.`) +
      p(`Tested: ${s.source.testedAt}. Method: ${s.source.method}. Panel: ${s.source.panelVersion}.`),
    [labUrl],
  ));

  const findingRefs = s.findings.map(f => add(variantObservation(next(), patientUrl, f)));
  sections.push(section(
    'Findings',
    s.findings.length
      ? ul(s.findings.map(f => `${f.gene} ${f.variant}, ${LABEL[f.classification]}${f.tag ? `, ${f.tag}` : ''}`))
      : p('No findings listed.'),
    findingRefs,
  ));

  const panelDetection = pctOf(s.residual.detection?.panel);
  const exactDetection = pctOf(s.residual.detection?.exact);
  const couple = coupleObservation(
    next(),
    patientUrl,
    {
      status: s.status,
      relationship: s.relationship,
      partnerName: s.partner?.name,
      sharedGenes: s.shared.map(x => x.gene),
      partnerTags: Object.fromEntries(s.shared.flatMap(x => (x.partnerTag ? [[x.gene, x.partnerTag]] : []))),
      partnerNegativeFor: [],
    },
    { panelPct: panelDetection, exactPct: exactDetection },
  );
  const coupleRefs: string[] = [];
  if (couple) coupleRefs.push(add(couple));
  for (const sh of s.shared) coupleRefs.push(add(riskObservation(next(), patientUrl, sh)));
  const sharedLines = s.shared.map(x =>
    `${x.gene} (${x.condition}): own ${x.ownTag ?? 'not stated'}, partner ${x.partnerTag ?? 'not stated'}. ` +
    `Per pregnancy: affected ${x.perPregnancy.affected}, carrier ${x.perPregnancy.carrier}, neither ${x.perPregnancy.neither}.`);
  sections.push(section(
    'Couple result',
    p(`Status: ${s.status === 'at-risk' ? 'at risk' : 'compatible'}. Relationship: ${s.relationship.replace(/-/g, ' ')}.`) +
      (s.partner ? p(`Partner: ${s.partner.name}.`) : '') +
      (sharedLines.length ? ul(sharedLines) : p('No shared gene.')),
    coupleRefs,
  ));

  const range = s.residual.panelRiskRange;
  const residual: Fhir = {
    resourceType: 'Observation',
    id: next(),
    status: 'final',
    code: codeable([coding(SILAH, 'panel-residual-risk', 'Panel residual risk')], 'Panel residual risk'),
    subject: { reference: patientUrl },
    valueString: s.residual.panelRisk,
    ...(range ? {
      component: [
        { code: silahCode('risk-at-99-detection'), valueString: range[0] },
        { code: silahCode('risk-at-80-detection'), valueString: range[1] },
      ],
    } : {}),
  };
  const det = s.residual.detection;
  sections.push(section(
    'Remaining chance',
    p(`Chance per pregnancy of a child with at least one panel condition: ${s.residual.panelRisk}.`) +
      (range ? p(`The lab states no detection rate. At 99% detection: ${range[0]}. At 80% detection: ${range[1]}.`) : '') +
      (det ? p(`Lab detection: panel ${det.panel}${det.exact ? `; exact change ${det.exact}` : ''}.`) : '') +
      p(s.residual.note),
    [add(residual)],
  ));

  if (s.vusGenes.length) {
    sections.push(section(
      'Variants of uncertain significance',
      p('Genes with a variant of uncertain significance that matters for the couple. Routed to a counsellor first.') + ul(s.vusGenes),
    ));
  }

  if (s.understanding) {
    const u = s.understanding;
    const value = `${u.correct} of ${u.total} correct` + (u.missed.length ? `; missed: ${u.missed.join(', ')}` : '');
    const obs: Fhir = {
      resourceType: 'Observation',
      id: next(),
      status: 'final',
      code: codeable([coding(SILAH, 'understanding-check', 'Understanding check')], 'Understanding check'),
      subject: { reference: patientUrl },
      valueString: value,
    };
    sections.push(section('Understanding check', p(value) + p(`Checked at ${u.at}.`), [add(obs)]));
  }

  sections.push(section(
    'Questions the patient asked',
    s.questions.length ? ul(s.questions.map(q => `${q.at}: ${q.q} (route: ${q.route})`)) : p('None recorded.'),
  ));

  sections.push(section(
    'Requests for a person',
    (s.escalations.length
      ? ul(s.escalations.map(e => `${e.at}: route ${e.route}, ${e.seen ? 'seen' : 'not yet seen'}`))
      : p('None.')) +
      (s.flags.length ? p(`Flags: ${s.flags.join(', ')}.`) : ''),
  ));

  if (s.birthPlan) {
    const b = s.birthPlan;
    sections.push(section(
      'Birth plan',
      p(`Active: ${yesNo(b.active)}. Hospital: ${b.hospital}.`) + (b.genes.length ? p(`Genes: ${b.genes.join(', ')}.`) : ''),
    ));
  }

  sections.push(section(
    'Sharing consents',
    s.sharing.length
      ? ul(s.sharing.map(x => `${x.kind}${x.gene ? ` (${x.gene})` : ''}: ${x.recipient}`))
      : p('None.'),
  ));

  if (s.booking) {
    const b = s.booking;
    sections.push(section('Booking', p(`${b.site}, ${b.slot}, ${b.format}, language ${b.language}.`)));
  }

  if (s.aiSummary) {
    const body = s.aiSummary.sentences
      .map(x => p(x.cards.length ? `${x.text} [${x.cards.join(', ')}]` : x.text))
      .join('') + p(`Model: ${s.aiSummary.model}.`);
    sections.push(section('Plain-language summary (language model, checked)', body));
  }

  sections.push(section('Sources', s.sources.length ? ul(s.sources) : p('None listed.')));

  const composition: Fhir = {
    resourceType: 'Composition',
    id: next(),
    status: 'final',
    type: codeable([coding(LOINC, L_SUMMARY, 'Consult note')]),
    subject: { reference: patientUrl },
    date: s.generatedAt,
    title: 'Silah pre-counselling summary',
    author: [{ display: "Silah (generated on the patient's phone at the patient's request)" }],
    text: { status: 'generated', div: div(p(`Silah pre-counselling summary for ${s.patient.name}, generated ${s.generatedAt}.`)) },
    section: sections,
  };
  return {
    resourceType: 'Bundle',
    id: next(),
    identifier: { system: 'urn:ietf:rfc:3986', value: urn(next()) },
    type: 'document',
    timestamp: s.generatedAt,
    entry: [composition, ...res].map(r => ({ fullUrl: urn(r.id), resource: r })),
  };
}
