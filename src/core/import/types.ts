import type { Classification, Relationship, ResultBundle, Signed } from '../types';

// What Silah reads out of a result the person brings: a PDF report, a FHIR file, a Silah result file or
// typed entry. Nothing here is trusted until the person confirms it on the "Is this what your report says?"
// screen; a lab-signed Silah file is the only input whose findings are verified.

export interface ExtractedFinding {
  gene: string;                 // HGNC symbol on the DoH panel (aliases already mapped)
  variant: string;              // HGVS c. notation as printed, transcript prefix kept if present
  protein?: string;             // HGVS p. notation if printed
  classification: Classification;
  tag?: string;                 // HBB allele class: 'HbS' | 'HbC' | 'HbE' | 'b0' | 'b+'
  zygosity?: 'het' | 'hom' | 'unknown';
  /** 'high' when gene, variant and classification were all found on the same line. */
  confidence: 'high' | 'low';
  /** The source line, shown on the confirm screen so the person can compare. */
  line: string;
}

export interface ExtractedCouple {
  status?: 'at-risk' | 'compatible';
  /** Genes where the report says both partners carry a disease-causing change. */
  sharedGenes: string[];
  /** For a shared gene, the partner's allele class if the report prints the partner's change (HBB). */
  partnerTags: Record<string, string>;
  /** This person's carrier genes for which the report says the partner tested negative. */
  partnerNegativeFor: string[];
  partnerName?: string;
  relationship?: Relationship;
}

export interface Extracted {
  source: 'pdf' | 'text' | 'fhir' | 'silah-json' | 'manual';
  name?: string;
  sex?: 'F' | 'M';
  testedAt?: string;            // ISO date (YYYY-MM-DD)
  lab?: string;
  findings: ExtractedFinding[];
  couple?: ExtractedCouple;
  /** Detection as the report states it, in percent (e.g. 95). Absent: Silah gives ranges. */
  detection?: { panelPct?: number; exactPct?: number };
  /** Gene-like tokens near a variant that are not on the DoH panel; shown to the person, never used. */
  unknownGenes: string[];
  warnings: string[];
}

/** A Silah result file: already a signed bundle (verified against the lab key if it is trusted). */
export type Imported =
  | { kind: 'signed'; bundle: Signed<ResultBundle> }
  | { kind: 'extracted'; data: Extracted };
