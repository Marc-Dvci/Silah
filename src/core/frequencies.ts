import { Q } from './fraction';

// Carrier frequencies used for residual-risk arithmetic. Each figure names its source.
// Where no Emirati figure was found, a stated assumption is used and labelled as such.

export type FreqSource = 'emirati-exomes' | 'published-gulf' | 'assumed';

export interface CarrierFreq { gene: string; carrier: Q; source: FreqSource; ref?: string }

const F = (gene: string, carrier: string, source: FreqSource, ref?: string): CarrierFreq =>
  ({ gene, carrier: Q.parse(carrier), source, ref });

export const CARRIER_FREQS: CarrierFreq[] = [
  F('CYP21A2', '0.106', 'emirati-exomes', 'jain-2025-gimo'),
  F('HBB', '0.096', 'emirati-exomes', 'jain-2025-gimo'),
  F('MEFV', '0.059', 'emirati-exomes', 'jain-2025-gimo'),
  F('ABCA4', '0.043', 'emirati-exomes', 'jain-2025-gimo'),
  F('HBA2', '0.018', 'emirati-exomes', 'jain-2025-gimo'),
  // Newborn screening of 1,502 Emirati babies: 19 SMN1 carriers.
  F('SMN1', '19/1502', 'emirati-exomes', 'rabea-2024-sma-uae'),
  // Reported as a gene (allele) frequency of 0.34%; carrier frequency ≈ 2 × 0.0034.
  F('CFTR', '0.0068', 'emirati-exomes', 'jain-2025-gimo'),
];

/** Assumed carrier frequency for a panel gene with no published local figure. */
export const DEFAULT_CARRIER = Q.of(1, 200);

/** Assumed share of a gene's pathogenic variants that the panel detects (unpublished for the DoH panel). */
export const DETECTION_GENE = Q.of(9, 10);
/** A known familial variant tested directly is assumed to be detected 99 times in 100. */
export const DETECTION_FAMILIAL = Q.of(99, 100);

const BY_GENE = new Map(CARRIER_FREQS.map(f => [f.gene, f]));

export function carrierFreq(gene: string): CarrierFreq {
  return BY_GENE.get(gene) ?? { gene, carrier: DEFAULT_CARRIER, source: 'assumed' };
}

/** Lets the research results replace provisional figures without touching the kernel. */
export function setCarrierFreq(f: CarrierFreq): void { BY_GENE.set(f.gene, f); }
