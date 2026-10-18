import type { QLike } from './fraction';

export type Lang = 'ar' | 'en';
/** A string in both languages. Arabic is Modern Standard Arabic, pending native review.
 *  `ar` addresses a woman or the couple; `arM`, when present, is the masculine form shown to a man. */
export type L10n = { ar: string; en: string; arM?: string };

/** ACMG classes the panel reports. Only P and LP count as carrier findings. */
export type Classification = 'P' | 'LP' | 'VUS';

export interface Finding {
  gene: string;            // HGNC symbol, must be on the panel
  variant: string;         // HGVS c. notation as reported
  classification: Classification;
  /** Gene-specific allele class, e.g. HBB: 'HbS' | 'HbC' | 'b0' | 'b+'. */
  tag?: string;
}

/** Degree of relationship between partners. */
export type Relationship =
  | 'unrelated'
  | 'second-cousins'
  | 'first-cousins-once-removed'
  | 'first-cousins'
  | 'double-first-cousins';

export interface PersonResult {
  personId: string;
  displayName: string;
  sex: 'F' | 'M';
  findings: Finding[];     // the person's own findings, all of them
  panelVersion: string;
  testedAt: string;        // ISO date
  method: 'premarital' | 'egp-recheck';
}

/** What the lab tells this person about the couple. Never includes the partner's other findings. */
export interface CoupleSection {
  coupleId: string;
  partnerName: string;
  relationship: Relationship;
  status: 'at-risk' | 'compatible';
  /** Genes where both partners carry a P/LP variant. */
  shared: { gene: string; ownTag?: string; partnerTag?: string }[];
  /** Genes where this person is a carrier and the partner tested negative (the partner's result for that gene only). */
  partnerNegativeFor: string[];
  /** Genes where either partner has a VUS that matters for the couple. Routed to a counsellor. */
  vusGenes: string[];
}

export interface ResultBundle {
  v: 1;
  kind: 'silah.result';
  person: PersonResult;
  couple?: CoupleSection;
  issuer: string;          // e.g. "Simulated genomics lab"
  issuedAt: string;
  validUntil?: string;     // premarital certificates are valid three months
}

export interface Signed<T> {
  payload: T;
  keyId: string;
  sig: string;             // base64url Ed25519 signature over canonical JSON of payload
}

export type CardKind =
  | 'couple-gene'      // per-pregnancy outcomes for a shared gene
  | 'residual-gene'    // one partner carries, the other tested negative
  | 'residual-panel'   // everything else on the panel, both negative
  | 'not-assessed'     // what the panel cannot see
  | 'background'       // baseline risk for any couple
  | 'consanguinity'    // added baseline risk for related partners
  | 'condition'        // what the condition is
  | 'birth-plan'       // what can be done at birth
  | 'option'           // a reproductive option offered by the programme
  | 'relative'         // a relative's chance of carrying the same variant
  | 'carrier'          // what being a carrier means
  | 'vus';             // a variant of uncertain significance

/** The only facts the language model may use. Every number shown anywhere comes from a card. */
export interface FactCard {
  id: string;
  kind: CardKind;
  gene?: string;
  conditionId?: string;
  /** Named exact numbers, e.g. { affected: 1/4 }. */
  numbers: Record<string, QLike>;
  /** Ranges that come from literature rather than arithmetic, e.g. { added: [17/1000, 28/1000] }. */
  ranges?: Record<string, [QLike, QLike]>;
  text: L10n;
  sources: string[];
  arithmetic?: string;
}

export type SourceId = string;
export interface Source {
  id: SourceId;
  cite: string;
  url?: string;
  year?: number;
  verified: boolean;     // checked against the primary source in this project
  note?: string;
}
