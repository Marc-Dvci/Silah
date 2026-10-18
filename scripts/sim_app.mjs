import { createServer } from 'vite';
const server = await createServer({ configFile: false, cacheDir: 'node_modules/.vite-scripts', server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { report } = await server.ssrLoadModule('/scripts/sim_app.ts');
const r = report();
await server.close();
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
for (const [s, rows] of Object.entries(r.per100)) {
  const cols = [0, 1, 2].map(i => rows.map(x => x[i]));
  console.log(s.padEnd(20), cols.map(c => `${mean(c).toFixed(1)} [${Math.min(...c).toFixed(1)}-${Math.max(...c).toFixed(1)}]`).join('   '));
}
const m = k => mean(r.seeds.map(x => x[k]));
console.log(`couples ${Math.round(m('couples'))}  at-risk ${(100 * m('atRiskRate')).toFixed(1)}%  related ${(100 * m('atRiskRateRelated')).toFixed(1)}%  unrelated ${(100 * m('atRiskRateUnrelated')).toFixed(1)}%  known index ${Math.round(m('knownIndex'))}`);
