// node eval/sensitivity.mjs  ->  prints the grid used in docs/SENSITIVITY.md
import { createServer } from 'vite';

const server = await createServer({ configFile: false, cacheDir: 'node_modules/.vite-scripts', server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { sensitivity } = await server.ssrLoadModule('/eval/sensitivity.ts');
const s = sensitivity();
await server.close();
const n = x => `1 in ${x.toLocaleString('en-US')}`;
console.log(`panel ${s.panel} genes, ${s.assumedGenes} with the assumed frequency; baseline`, s.base);
console.log('| Detection | Assumed carrier frequency | Untested first cousins: added per 100 births, panel genes | Fatima, CYP21A2, Ahmed checked for her exact change | Fatima, CYP21A2, not checked | Fatima, rest of panel | Fatima, whole panel | Mariam, rest of panel |\n|---|---|---|---|---|---|---|---|');
for (const c of s.cells) console.log(`| ${c.d} | ${c.assumed} | ${c.untested} | ${n(c.fatimaGene)} | ${n(c.fatimaGeneUnchecked)} | ${n(c.fatimaRest)} | ${n(c.fatimaPanel)} | ${n(c.mariamRest)} |`);
