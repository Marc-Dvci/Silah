// Reads the text of a result the person brings (PDF text or pasted text) into the Extracted shape.
// It works line by line and is tolerant: cells may be split by ' | ' or by spaces, and the column
// order may vary. Nothing here is trusted until the person confirms it on the confirm screen.

import { PANEL_ALIASES, PANEL_SET } from '../data/panel';
import { toAsciiDigits } from '../text';
import type { Classification, Relationship } from '../types';
import type { Extracted, ExtractedCouple, ExtractedFinding } from './types';

type Detection = NonNullable<Extracted['detection']>;

// Optional transcript prefix, then the c. change. Group 1 is the variant as printed, group 2 the c. part.
const HGVS_RE = /((?:[NX][MR]_\d+(?:\.\d+)?(?:\([A-Z0-9]+\))?:)?(c\.[-*]?\d+(?:[+-]\d+)?(?:_[-*]?\d+(?:[+-]\d+)?)?(?:[ACGTacgt]>[ACGTacgt]|delins[ACGTacgt]*|del[ACGTacgt]*|ins[ACGTacgt]*|dup[ACGTacgt]*|inv[ACGTacgt]*)))/;
const PROTEIN_RE = /p\.\(?[A-Za-z]{3}\d+[A-Za-z*=?]*\)?/;
const PERCENT_RE = /(\d+(?:[.,]\d+)?)\s*[%٪]/;
const INVISIBLE_RE = /[\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

const PARTNER_WORD_RE = /partner|شريك/i;
const PARTNER_VARIANT_RE = /partner['’]s variant|partner variant/i;
const SHARED_RE = /both partners carry|both carry|shared gene|كلاكما/i;
const NEGATIVE_RE = /none was found in|no pathogenic variant was found in|tested negative for|negative for/i;

// 'حميد' is left out on purpose: it is also a first name, and a false skip would hide a real finding.
const BENIGN_RE = /\bbenign\b|\bnon[- ]pathogenic\b|\bnot pathogenic\b|غير ممرض/i;
const VUS_RE = /uncertain significance|variant of uncertain|\bVUS\b|غير مؤكد ال[أاإ]همية|غير محددة ال[أاإ]همية/i;
const LP_RE = /likely pathogenic|ممرض محتمل/i;
const P_RE = /\bpathogenic\b|ممرض/i;

const AT_RISK_RE = /not compatible|incompatible|at risk|غير متوافق/i;
const COMPATIBLE_RE = /compatible|no risk for either|متوافق/i;
const RELATION_LINE_RE = /relationship|consanguin|relation|related|cousin|قرابة|أقارب|عمومة|ابن\s+عم|ابنة\s+عم|ابن\s+خال|ابنة\s+خال/i;

const TOKEN_SPLIT = /[^A-Za-z0-9]+/;
const GENE_SHAPE = /^[A-Z][A-Z0-9]{2,9}$/;
const NOT_GENES = new Set([
  'HGVS', 'DNA', 'RNA', 'VUS', 'NM', 'ACMG', 'DOH', 'UAE', 'PMS', 'ID', 'AR', 'EN',
  'PATHOGENIC', 'BENIGN', 'LIKELY', 'HETEROZYGOUS', 'HOMOZYGOUS', 'SAMPLE',
]);

// HBB allele classes by c. change.
const B0_CHANGES = new Set([
  'c.92+1G>A', 'c.118C>T', 'c.315+1G>A', 'c.27_28insG', 'c.25_26delAA', 'c.17_18delCT',
  'c.126_129delCTTT', 'c.135delC',
]);
const BPLUS_CHANGES = new Set([
  'c.92+5G>C', 'c.92+6T>C', 'c.93-21G>A', 'c.-138C>T', 'c.-137C>G', 'c.-78A>G', 'c.316-106C>G',
]);

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
  'october', 'november', 'december',
];

export function extractFromText(text: string, source: 'pdf' | 'text' = 'text'): Extracted {
  const lines = normalise(text);
  const warnings: string[] = [];
  const findings: ExtractedFinding[] = [];
  const unknown = new Set<string>();
  const seen = new Set<string>();

  for (const line of lines) {
    if (HGVS_RE.test(line)) for (const g of unknownGenesIn(line)) unknown.add(g);
    // Couple-analysis lines describe the partner, never this person.
    if (PARTNER_WORD_RE.test(line) || BENIGN_RE.test(line)) continue;

    const hgvs = HGVS_RE.exec(line);
    const gene = panelGenesIn(line)[0];
    if (!hgvs || !gene) continue;

    const variant = hgvs[1];
    const key = `${gene}|${variant}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const cls = classify(line);
    const classification: Classification = cls ?? 'P';
    const zygosity = zygosityIn(line);
    if (!cls) warnings.push(`${gene} ${variant}: no classification word on the line. Read as P; check it.`);
    if (zygosity === 'hom' && (classification === 'P' || classification === 'LP')) {
      warnings.push(`${gene} ${variant}: homozygous. The person may be affected.`);
    }

    const protein = PROTEIN_RE.exec(line)?.[0];
    const tag = allelTag(gene, line, hgvs[2]);
    findings.push({
      gene,
      variant,
      classification,
      zygosity,
      confidence: cls ? 'high' : 'low',
      line,
      ...(protein ? { protein } : {}),
      ...(tag ? { tag } : {}),
    });
  }

  const out: Extracted = { source, findings, unknownGenes: [...unknown].sort(), warnings };
  const name = field(lines, /^(?:Patient name|Patient|Name|الاسم)\s*[:：]\s*(.*)$/i);
  if (name) out.name = name;
  const sex = sexIn(lines);
  if (sex) out.sex = sex;
  const testedAt = testedAtIn(lines, warnings);
  if (testedAt) out.testedAt = testedAt;
  const lab = labIn(lines);
  if (lab) out.lab = lab;
  const couple = coupleIn(lines);
  if (couple) out.couple = couple;
  const detection = detectionIn(lines, warnings);
  if (detection) out.detection = detection;
  return out;
}

function normalise(text: string): string[] {
  return toAsciiDigits(text)
    .replace(INVISIBLE_RE, '')
    .replace(/[ \t]/g, ' ')
    .split(/\r\n|\r|\n/)
    .map(line => line.replace(/ {2,}/g, ' ').trim())
    .filter(line => line.length > 0);
}

function toPanelGene(token: string): string | undefined {
  if (PANEL_SET.has(token)) return token;
  if (Object.hasOwn(PANEL_ALIASES, token)) return PANEL_ALIASES[token];
  return undefined;
}

function panelGenesIn(line: string): string[] {
  const genes: string[] = [];
  for (const token of line.split(TOKEN_SPLIT)) {
    const gene = toPanelGene(token);
    if (gene && !genes.includes(gene)) genes.push(gene);
  }
  return genes;
}

function unknownGenesIn(line: string): string[] {
  return line.split(TOKEN_SPLIT).filter(t =>
    GENE_SHAPE.test(t) && !NOT_GENES.has(t) && !t.startsWith('IVS') && toPanelGene(t) === undefined,
  );
}

function classify(line: string): Classification | undefined {
  if (VUS_RE.test(line)) return 'VUS';
  if (LP_RE.test(line)) return 'LP';
  if (P_RE.test(line)) return 'P';
  return undefined;
}

function zygosityIn(line: string): 'het' | 'hom' | 'unknown' {
  if (/\bheterozygous\b|\bhet\b|متغاير/i.test(line)) return 'het';
  if (/\bhomozygous\b|\bhom\b|متماثل/i.test(line)) return 'hom';
  return 'unknown';
}

/** HBB allele class from the c. change, then from words on the line. Other genes have no tag. */
function allelTag(gene: string, line: string, change?: string): string | undefined {
  if (gene !== 'HBB') return undefined;
  const c = change ?? HGVS_RE.exec(line)?.[2];
  if (c) {
    if (c === 'c.20A>T') return 'HbS';
    if (c === 'c.19G>A') return 'HbC';
    if (c === 'c.79G>A') return 'HbE';
    if (B0_CHANGES.has(c)) return 'b0';
    if (BPLUS_CHANGES.has(c)) return 'b+';
  }
  if (/\bHbS\b|sickle/i.test(line)) return 'HbS';
  if (/\bHbC\b/i.test(line)) return 'HbC';
  if (/\bHbE\b/i.test(line)) return 'HbE';
  if (/beta[- ]zero|β0|\bb0\b/i.test(line)) return 'b0';
  if (/beta[- ]plus|β\+|\bb\+/i.test(line)) return 'b+';
  return undefined;
}

function relationshipIn(line: string): Relationship | undefined {
  if (/double\s+first\s+cousins?/i.test(line)) return 'double-first-cousins';
  if (/first\s+cousins?\s+once\s+removed/i.test(line)) return 'first-cousins-once-removed';
  if (/first\s+cousins?/i.test(line)) return 'first-cousins';
  if (/second\s+cousins?/i.test(line)) return 'second-cousins';
  if (/not\s+related|unrelated|no\s+relation/i.test(line)) return 'unrelated';
  if (/أبناء\s+عمومة|ابن\s+عم|ابنة\s+عم|ابن\s+خال|ابنة\s+خال|أقارب\s+من\s+الدرجة\s+الأولى/.test(line)) {
    return 'first-cousins';
  }
  if (/غير\s+أقارب|لا\s+توجد\s+قرابة/.test(line)) return 'unrelated';
  return undefined;
}

function coupleIn(lines: string[]): ExtractedCouple | undefined {
  let status: ExtractedCouple['status'];
  if (lines.some(l => AT_RISK_RE.test(l))) status = 'at-risk';
  else if (lines.some(l => COMPATIBLE_RE.test(l))) status = 'compatible';

  const sharedGenes: string[] = [];
  const partnerTags: Record<string, string> = {};
  const partnerNegativeFor: string[] = [];
  let relationship: Relationship | undefined;

  for (const line of lines) {
    if (PARTNER_VARIANT_RE.test(line)) {
      for (const gene of panelGenesIn(line)) {
        const tag = allelTag(gene, line);
        if (tag) partnerTags[gene] = tag;
      }
    } else if (SHARED_RE.test(line)) {
      addAll(sharedGenes, panelGenesIn(line));
    }
    if (NEGATIVE_RE.test(line)) addAll(partnerNegativeFor, panelGenesIn(line));
    if (!relationship && RELATION_LINE_RE.test(line)) relationship = relationshipIn(line);
  }

  const partnerName = field(lines, /^Partner(?: name)?\s*[:：]\s*(.*)$/i);
  const found = status || partnerName || relationship || sharedGenes.length || partnerNegativeFor.length
    || Object.keys(partnerTags).length;
  if (!found) return undefined;

  const couple: ExtractedCouple = { sharedGenes, partnerTags, partnerNegativeFor };
  if (status) couple.status = status;
  if (partnerName) couple.partnerName = partnerName;
  if (relationship) couple.relationship = relationship;
  return couple;
}

function addAll(list: string[], items: string[]): void {
  for (const item of items) if (!list.includes(item)) list.push(item);
}

/** Value of the first "Label: value" field. A field starts a segment, so 'Partner name' never matches 'Name'. */
function field(lines: string[], re: RegExp): string | undefined {
  for (const line of lines) {
    for (const segment of line.split(/\s*\|\s*/)) {
      const value = re.exec(segment)?.[1]?.trim();
      if (value) return value;
    }
  }
  return undefined;
}

function sexIn(lines: string[]): 'F' | 'M' | undefined {
  const word = field(lines, /^(?:Sex|Gender|الجنس)\s*[:：]\s*(\p{L}+)/iu)?.toLowerCase();
  if (word === 'female' || word === 'f' || word === 'أنثى') return 'F';
  if (word === 'male' || word === 'm' || word === 'ذكر') return 'M';
  return undefined;
}

function testedAtIn(lines: string[], warnings: string[]): string | undefined {
  const labels = [
    /^Report date\s*[:：]\s*(.*)$/i,
    /^Date reported\s*[:：]\s*(.*)$/i,
    /^Date of report\s*[:：]\s*(.*)$/i,
    /^Collection date\s*[:：]\s*(.*)$/i,
  ];
  for (const re of labels) {
    const value = field(lines, re);
    if (!value) continue;
    const iso = parseDate(value);
    if (iso) return iso;
    warnings.push(`Date not read: "${value}".`);
  }
  return undefined;
}

function parseDate(value: string): string | undefined {
  const v = value.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/.exec(v);
  if (m) return isoDate(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?!\d)/.exec(v);
  if (m) return isoDate(+m[3], +m[2], +m[1]);
  m = /^(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})(?!\d)/.exec(v);
  if (m) {
    const month = monthNumber(m[2]);
    return month ? isoDate(+m[3], month, +m[1]) : undefined;
  }
  m = /^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})(?!\d)/.exec(v);
  if (m) {
    const month = monthNumber(m[1]);
    return month ? isoDate(+m[3], month, +m[2]) : undefined;
  }
  return undefined;
}

function monthNumber(name: string): number | undefined {
  const w = name.toLowerCase();
  if (w.length < 3) return undefined;
  const index = MONTHS.findIndex(month => month.startsWith(w));
  return index < 0 ? undefined : index + 1;
}

function isoDate(year: number, month: number, day: number): string | undefined {
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return undefined;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function labIn(lines: string[]): string | undefined {
  return lines.slice(0, 8).find(line =>
    /\bLab\s|Laboratory|مختبر/i.test(line) && !/sensitivity|method|limitation/i.test(line),
  );
}

function detectionIn(lines: string[], warnings: string[]): Detection | undefined {
  let panelPct: number | undefined;
  let exactPct: number | undefined;
  let panelSeen = false;
  let exactSeen = false;

  for (const line of lines) {
    const match = PERCENT_RE.exec(line);
    if (!match) continue;
    const value = Number(match[1].replace(',', '.'));
    const inRange = value > 50 && value <= 100;

    if (!panelSeen && /sensitivity|detects/i.test(line) && !/partner|familial|targeted/i.test(line)) {
      panelSeen = true;
      if (inRange) panelPct = value;
      else warnings.push(`Detection ${value}% is outside 50-100 and was ignored.`);
    } else if (!exactSeen && /familial|targeted|partner['’]s sample/i.test(line)) {
      exactSeen = true;
      if (inRange) exactPct = value;
      else warnings.push(`Exact-change check ${value}% is outside 50-100 and was ignored.`);
    }
  }

  if (panelPct === undefined && exactPct === undefined) return undefined;
  const detection: Detection = {};
  if (panelPct !== undefined) detection.panelPct = panelPct;
  if (exactPct !== undefined) detection.exactPct = exactPct;
  return detection;
}
