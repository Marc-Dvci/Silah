import { describe, expect, it } from 'vitest';
import { foundPer100, outreach, realisticConfig, simulate, summary, testOrder, type Strategy, type SimConfig } from '../src/core/population';

const STRATEGIES: Strategy[] = ['random', 'consanguinity-first', 'cascade'];

// One gene at carrier 0.1, first cousins optional.
const oneGene = (seed: number, cousinMarriage: number, families: number): SimConfig => ({
  seed,
  families,
  genes: [{ gene: 'G1', carrier: 0.1 }],
  cousinMarriage,
  declareRate: 0.8,
  childrenMin: 2,
  childrenMax: 6,
});

describe('population simulator', () => {
  it('same seed gives the same summary and outreach curves', () => {
    const cfg = { ...realisticConfig(7), families: 500 };
    const a = simulate(cfg);
    const b = simulate(cfg);
    expect(summary(a)).toEqual(summary(b));
    for (const s of STRATEGIES) expect(outreach(a, s)).toEqual(outreach(b, s));
  });

  it('different seed gives different results', () => {
    const a = simulate({ ...realisticConfig(1), families: 500 });
    const b = simulate({ ...realisticConfig(2), families: 500 });
    expect(summary(a)).not.toEqual(summary(b));
    expect(outreach(a, 'random')).not.toEqual(outreach(b, 'random'));
  });

  it('unrelated gen-2 at-risk rate is within 25% of carrier squared', () => {
    const pop = simulate(oneGene(11, 0, 4000));
    const s = summary(pop);
    expect(s.atRiskRate).toBe(s.atRiskRateUnrelated);
    expect(s.atRiskRateUnrelated).toBeGreaterThan(0.1 * 0.1 * 0.75);
    expect(s.atRiskRateUnrelated).toBeLessThan(0.1 * 0.1 * 1.25);
  });

  it('related couples are at risk more often than unrelated couples', () => {
    const s = summary(simulate(oneGene(11, 0.5, 4000)));
    expect(Number.isFinite(s.atRiskRateRelated)).toBe(true);
    expect(s.atRiskRateRelated).toBeGreaterThan(s.atRiskRateUnrelated);
  });

  it('cascade > consanguinity-first > random at 200 tests (realistic config, mean of seeds 1-5)', { timeout: 60_000 }, () => {
    const mean = (s: Strategy): number => {
      const values = [1, 2, 3, 4, 5].map(seed => foundPer100(outreach(simulate(realisticConfig(seed)), s), 200));
      return values.reduce((x, y) => x + y, 0) / values.length;
    };
    const random = mean('random');
    const consanguinity = mean('consanguinity-first');
    const cascade = mean('cascade');
    expect(cascade, `cascade ${cascade} vs consanguinity-first ${consanguinity}`).toBeGreaterThan(consanguinity);
    expect(consanguinity, `consanguinity-first ${consanguinity} vs random ${random}`).toBeGreaterThan(random);
  });

  it('no couple is tested twice and found never decreases', { timeout: 60_000 }, () => {
    const pop = simulate({ ...realisticConfig(3), families: 1000 });
    const targets = pop.couples.filter(c => c.gen === 2 && !c.affectedChild);
    const atRiskTargets = targets.filter(c => c.atRiskGenes.length > 0).length;
    for (const s of STRATEGIES) {
      const order = testOrder(pop, s);
      expect(new Set(order.map(c => c.id)).size, s).toBe(order.length);
      expect(order.length, s).toBe(targets.length);

      const points = outreach(pop, s);
      expect(points.map(p => p.tested), s).toEqual(points.map((_, i) => i + 1));
      for (let i = 1; i < points.length; i++) expect(points[i].found, s).toBeGreaterThanOrEqual(points[i - 1].found);
      expect(points[points.length - 1].found, s).toBe(atRiskTargets);

      expect(outreach(pop, s, 50).length, s).toBe(50);
    }
  });
});
