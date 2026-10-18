// Outreach strategies on the app's simulated population (7 published Emirati carrier frequencies + 40 genes
// at an assumed 1 in 200, 35% cousin marriage), seeds 1-5.
import { simulate, outreach, foundPer100, summary, type Strategy } from '../src/core/population';
import { CARRIER_FREQS } from '../src/core/frequencies';

export function report() {
  const genes = [
    ...CARRIER_FREQS.map(f => ({ gene: f.gene, carrier: f.carrier.toNumber() })),
    ...Array.from({ length: 40 }, (_, i) => ({ gene: `G${i + 1}`, carrier: 1 / 200 })),
  ];
  const strategies: Strategy[] = ['cascade', 'consanguinity-first', 'random'];
  const out: any = { seeds: [], per100: {} as Record<string, number[][]> };
  for (const s of strategies) out.per100[s] = [];
  for (let seed = 1; seed <= 5; seed++) {
    const pop = simulate({ seed, families: 2500, genes, cousinMarriage: 0.35, declareRate: 0.8, childrenMin: 2, childrenMax: 6 });
    out.seeds.push(summary(pop));
    for (const s of strategies) {
      const pts = outreach(pop, s, 500);
      out.per100[s].push([100, 200, 500].map(t => foundPer100(pts, t)));
    }
  }
  return out;
}
