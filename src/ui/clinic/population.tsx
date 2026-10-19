import { useState } from 'preact/hooks';
import { simulate, outreach, foundPer100, summary, type SimConfig, type Strategy, type YieldPoint } from '../../core/population';
import { CARRIER_FREQS } from '../../core/frequencies';

// Outreach strategies compared on a synthetic consanguineous population. Seven genes use published
// Emirati carrier frequencies; forty more use the stated 1-in-200 assumption.

function config(seed: number): SimConfig {
  const genes = [
    ...CARRIER_FREQS.map(f => ({ gene: f.gene, carrier: f.carrier.toNumber() })),
    ...Array.from({ length: 40 }, (_, i) => ({ gene: `G${i + 1}`, carrier: 1 / 200 })),
  ];
  return { seed, families: 2500, genes, cousinMarriage: 0.35, declareRate: 0.8, childrenMin: 2, childrenMax: 6 };
}

const STRATS: { s: Strategy; label: string; color: string }[] = [
  { s: 'cascade', label: 'Cascade from known families', color: '#2B3A67' },
  { s: 'consanguinity-first', label: 'Declared related first', color: '#D19A3A' },
  { s: 'random', label: 'Random outreach', color: '#A9B0C4' },
];

// The same five seeds as scripts/sim_app.ts, so the app, the deck and docs/EVALUATION.md show one result.
const SEEDS = [1, 2, 3, 4, 5];
const BUDGET = 200;

interface Run {
  curves: Record<Strategy, YieldPoint[]>;   // mean over the seeds, one point per test
  per100: Record<Strategy, { mean: number; min: number; max: number }>;
  couples: number; related: number; unrelated: number;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function runAll(): Run {
  const pops = SEEDS.map(seed => simulate(config(seed)));
  const curves = {} as Run['curves'];
  const per100 = {} as Run['per100'];
  for (const { s } of STRATS) {
    const runs = pops.map(pop => outreach(pop, s, BUDGET));
    curves[s] = Array.from({ length: BUDGET }, (_, i) => ({ tested: i + 1, found: mean(runs.map(r => r[Math.min(i, r.length - 1)]?.found ?? 0)) }));
    const xs = runs.map(r => foundPer100(r, BUDGET));
    per100[s] = { mean: mean(xs), min: Math.min(...xs), max: Math.max(...xs) };
  }
  const sums = pops.map(summary);
  return {
    curves, per100,
    couples: Math.round(mean(sums.map(x => x.couples))),
    related: mean(sums.map(x => x.atRiskRateRelated)),
    unrelated: mean(sums.map(x => x.atRiskRateUnrelated)),
  };
}

export function Population() {
  const [run, setRun] = useState<Run | null>(null);
  const [busy, setBusy] = useState(false);
  const go = () => {
    setBusy(true);
    setTimeout(() => { setRun(runAll()); setBusy(false); }, 30);
  };
  const W = 460, H = 220, maxT = BUDGET;
  const maxF = run ? Math.max(...STRATS.map(x => run.curves[x.s].at(-1)?.found ?? 0), 1) : 1;
  const path = (pts: YieldPoint[]) => pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1)
    .map((p, i) => `${i ? 'L' : 'M'}${(p.tested / maxT) * W},${H - (p.found / maxF) * H}`).join(' ');
  return (
    <div class="pool stack" style={{ '--gap': '12px' } as any}>
      <p class="eyebrow">Which couples to invite first</p>
      <h3>At-risk couples found as tests are spent (simulated population)</h3>
      {!run ? (
        <button class="btn calm" disabled={busy} onClick={go}>{busy ? 'Simulating five populations…' : 'Run the simulation'}</button>
      ) : (
        <>
          <svg viewBox={`-30 -10 ${W + 40} ${H + 40}`} width="100%" role="img" aria-label="Cumulative at-risk couples found by tests used, mean of five simulated populations">
            {[0, 0.5, 1].map(f => <line key={f} x1="0" x2={W} y1={H - f * H} y2={H - f * H} stroke="#D8DCE8" />)}
            {STRATS.map(x => <path key={x.s} d={path(run.curves[x.s])} fill="none" stroke={x.color} stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />)}
            <text x="0" y={H + 22} font-size="12" fill="#545A70">0</text>
            <text x={W} y={H + 22} font-size="12" fill="#545A70" text-anchor="end">{maxT} couples tested</text>
            <text x="4" y="-2" font-size="12" fill="#545A70">{maxF.toFixed(1)} found</text>
          </svg>
          {STRATS.map(x => (
            <p key={x.s} class="row small"><span style={{ width: '18px', height: '4px', borderRadius: '2px', background: x.color, display: 'inline-block' }} />
              <span class="grow">{x.label}</span><span class="num">{run.per100[x.s].mean.toFixed(1)}</span>
              <span class="tiny muted">per 100 tests (range {run.per100[x.s].min.toFixed(1)}–{run.per100[x.s].max.toFixed(1)})</span></p>
          ))}
          <p class="tiny muted">Mean of five simulated populations (seeds 1–5), after {BUDGET} tests; about {run.couples.toLocaleString('en-US')} couples each. At-risk {(run.related * 100).toFixed(1)}% among related and {(run.unrelated * 100).toFixed(1)}% among unrelated couples. Seven genes use published Emirati carrier frequencies, forty use an assumed 1 in 200. Cousin marriage 35%.</p>
        </>
      )}
    </div>
  );
}
