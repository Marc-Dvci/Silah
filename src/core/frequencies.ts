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

/**
 * Assumed carrier frequency for a panel gene with no published local figure. It is calibrated, not round: for an
 * untested first-cousin couple, the panel's share of the added chance is F·Σq over the panel genes (q = p/2), and
 * it cannot exceed the published 1.7 to 2.8 added children per 100 births (Hamamy 2012). With the seven published
 * Emirati figures, 1 in 1,000 for each of the other genes reaches the top of that range; 1 in 200 would imply 9.8 in
 * 100. tests/kernel.test.ts checks the bound.
 */
export const DEFAULT_CARRIER = Q.of(1, 1000);

/** When a result does not state the lab's detection, remaining chances are given as a range over these detection
 *  rates (share of a gene's disease-causing changes a sequencing panel finds), never as one personal figure. */
export const DETECTION_RANGE: [Q, Q] = [Q.of(80, 100), Q.of(99, 100)];

const BY_GENE = new Map(CARRIER_FREQS.map(f => [f.gene, f]));

export function carrierFreq(gene: string): CarrierFreq {
  return BY_GENE.get(gene) ?? { gene, carrier: DEFAULT_CARRIER, source: 'assumed' };
}

/** Lets the research results replace provisional figures without touching the kernel. */
export function setCarrierFreq(f: CarrierFreq): void { BY_GENE.set(f.gene, f); }
