import { describe, it, expect } from 'vitest';
import { PANEL_GENES, PANEL_ALIASES, PANEL_SET } from '../src/core/data/panel';

describe('premarital genetic panel (DoH Appendix 12)', () => {
  it('has 563 unique genes', () => {
    expect(PANEL_GENES.length).toBe(563);
  });

  it('has no duplicate genes', () => {
    expect(new Set(PANEL_GENES).size).toBe(PANEL_GENES.length);
  });

  it('is sorted alphabetically', () => {
    expect([...PANEL_GENES]).toEqual([...PANEL_GENES].sort());
  });

  it('contains the core genes', () => {
    const core = [
      'SMN1', 'GALC', 'ARSA', 'GAA', 'IDUA', 'CYP21A2', 'HBB', 'HBA1', 'HBA2',
      'RPE65', 'CFTR', 'MEFV', 'ABCA4', 'GJB2',
    ];
    for (const gene of core) {
      expect(PANEL_SET.has(gene), gene).toBe(true);
    }
  });

  it('maps every alias to a member of the panel', () => {
    for (const [alias, target] of Object.entries(PANEL_ALIASES)) {
      expect(PANEL_SET.has(target), `${alias} -> ${target}`).toBe(true);
    }
  });
});
