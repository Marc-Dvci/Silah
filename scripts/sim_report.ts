// Outreach comparison on the realistic config, seeds 1..5.
// Run: node --experimental-strip-types scripts/sim_report.ts
// (vite-node is not installed in this repo; Node 24 strips the types natively.)

import { foundPer100, outreach, realisticConfig, simulate, summary } from '../src/core/population.ts';
import type { Strategy } from '../src/core/population.ts';

const SEEDS = [1, 2, 3, 4, 5];
const STRATEGIES: Strategy[] = ['random', 'consanguinity-first', 'cascade'];
const BUDGETS = [100, 200, 500];

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const pad = (s: string | number, n: number): string => String(s).padEnd(n);

const found: Record<string, number[]> = {};
const rows = SEEDS.map(seed => {
  const pop = simulate(realisticConfig(seed));
  for (const s of STRATEGIES) {
    const points = outreach(pop, s);
    for (const b of BUDGETS) (found[`${s}|${b}`] ??= []).push(foundPer100(points, b));
  }
  return { seed, ...summary(pop) };
});

const cfg = realisticConfig(1);
const carriers = cfg.genes.map(g => g.carrier);
console.log(`Realistic config: ${cfg.genes.length} genes (carrier ${Math.min(...carriers).toFixed(3)}-${Math.max(...carriers).toFixed(3)}), ` +
  `${cfg.families} families, cousinMarriage ${cfg.cousinMarriage}, declareRate ${cfg.declareRate}`);
console.log(`foundPer100 = carriers found per 100 tests. Mean over seeds ${SEEDS.join(', ')}, [min-max] in brackets.\n`);

const cell = (xs: number[]): string => `${mean(xs).toFixed(2)} [${Math.min(...xs).toFixed(1)}-${Math.max(...xs).toFixed(1)}]`;
console.log(pad('strategy', 22) + BUDGETS.map(b => pad(`@${b} tests`, 22)).join(''));
for (const s of STRATEGIES) {
  console.log(pad(s, 22) + BUDGETS.map(b => pad(cell(found[`${s}|${b}`]), 22)).join(''));
}

const pct = (xs: number[]): string => `${(mean(xs) * 100).toFixed(2)}%`;
console.log('\nGen-2 couples (index couples included in the rates)');
console.log(pad('seed', 6) + pad('couples', 10) + pad('at-risk', 10) + pad('related', 10) + pad('unrelated', 11) + 'index');
for (const r of rows) {
  console.log(pad(r.seed, 6) + pad(r.couples, 10) + pad(`${(r.atRiskRate * 100).toFixed(2)}%`, 10) +
    pad(`${(r.atRiskRateRelated * 100).toFixed(2)}%`, 10) + pad(`${(r.atRiskRateUnrelated * 100).toFixed(2)}%`, 11) + r.knownIndex);
}
console.log(pad('mean', 6) + pad(mean(rows.map(r => r.couples)).toFixed(0), 10) + pad(pct(rows.map(r => r.atRiskRate)), 10) +
  pad(pct(rows.map(r => r.atRiskRateRelated)), 10) + pad(pct(rows.map(r => r.atRiskRateUnrelated)), 11) +
  mean(rows.map(r => r.knownIndex)).toFixed(0));
