import type { Classification, Lang, Relationship } from './types';

// The physician summary: one page a counsellor, obstetrician or family physician can read, print or file.
// Built deterministically on the phone from the result and what the person did in Silah; the person
// decides to generate it and to send it. Numbers are the kernel's, as printed strings.

export interface SummaryFinding { gene: string; variant: string; classification: Classification; tag?: string }

export interface SummaryShared {
  gene: string;
  condition: string;            // English condition name
  ownTag?: string;
  partnerTag?: string;
  /** Per pregnancy, as "1 in 4" style strings. */
  perPregnancy: { affected: string; carrier: string; neither: string };
  /** The condition has an early-treatment pathway, so a birth plan can be offered. */
  birthPlanEligible: boolean;
}

export interface PhysicianSummary {
  v: 1;
  generatedAt: string;          // ISO
  lang: Lang;                   // language the person used in Silah
  patient: { personId: string; name: string; sex: 'F' | 'M' };
  partner?: { name: string };
  relationship: Relationship;
  source: {
    issuer: string;
    /** true only for a lab-signed result verified on the phone; false for an upload or typed entry. */
    verified: boolean;
    origin: 'lab-signed' | 'uploaded-pdf' | 'uploaded-fhir' | 'manual';
    testedAt: string;
    method: string;
    panelVersion: string;
  };
  status: 'at-risk' | 'compatible';
  findings: SummaryFinding[];
  shared: SummaryShared[];
  residual: {
    /** Chance per pregnancy of a child with at least one panel condition, "1 in N". */
    panelRisk: string;
    /** When the lab states no detection: the figure at 99% and at 80% detection. */
    panelRiskRange?: [string, string];
    detection?: { panel: string; exact?: string };
    note: string;
  };
  vusGenes: string[];
  understanding?: { correct: number; total: number; missed: string[]; at: string };
  questions: { at: string; q: string; route: string }[];
  /** Escalations to a person, newest last; route only, never message text. */
  escalations: { at: string; route: string; seen: boolean }[];
  flags: string[];
  birthPlan?: { active: boolean; hospital: string; genes: string[] };
  sharing: { kind: string; gene?: string; recipient: string }[];
  booking?: { site: string; slot: string; format: string; language: string };
  /** Optional plain-language paragraph written by a language model and passed by the verifier. */
  aiSummary?: { sentences: { text: string; cards: string[] }[]; model: string };
  sources: string[];
}
