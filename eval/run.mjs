// node eval/run.mjs <label> [base | --rescore]  ->  eval/results/<label>.json and a printed summary
import { createServer } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';

const [label, base = 'http://127.0.0.1:8080'] = process.argv.slice(2);
const server = await createServer({ configFile: false, cacheDir: 'node_modules/.vite-scripts', server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { run, rescore } = await server.ssrLoadModule('/eval/bakeoff.ts');
// --rescore: re-apply the current verifier to the saved raw outputs
const rows = base === '--rescore'
  ? rescore(JSON.parse(readFileSync(`eval/results/${label}.json`, 'utf8')))
  : (await run(base, label)).rows;
await server.close();
writeFileSync(`eval/results/${label}.json`, JSON.stringify(rows, null, 1));

const sum = f => rows.reduce((a, r) => a + f(r), 0);
const grounded = rows.filter(r => r.cat === 'grounded');
const traps = rows.filter(r => r.cat !== 'grounded');
const out = {
  label,
  answers: rows.length,
  jsonOk: sum(r => (r.jsonOk ? 1 : 0)),
  sentences: sum(r => r.sentences),
  shown: sum(r => r.shown),
  groundedAnswered: `${grounded.filter(r => r.shownNonCounsellor > 0).length}/${grounded.length}`,
  trapsWithAReply: `${traps.filter(r => r.shown > 0).length}/${traps.length}`,
  raw: { directive: sum(r => r.rawDirective), certainty: sum(r => r.rawCertainty), badNumber: sum(r => r.rawBadNumber), noCard: sum(r => r.rawNoCard) },
  languageMatch: `${sum(r => (r.langOk ? 1 : 0))}/${rows.length}`,
  medianMs: rows.map(r => r.ms).sort((a, b) => a - b)[Math.floor(rows.length / 2)],
  meanTokPerS: Math.round(sum(r => r.tps ?? 0) / rows.length),
};
console.log(JSON.stringify(out, null, 1));
