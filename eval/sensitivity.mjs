// node eval/sensitivity.mjs  ->  prints the grid used in docs/SENSITIVITY.md
import { createServer } from 'vite';

const server = await createServer({ configFile: false, cacheDir: 'node_modules/.vite-scripts', server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { sensitivity } = await server.ssrLoadModule('/eval/sensitivity.ts');
const s = sensitivity();
await server.close();
console.log(`panel ${s.panel} genes, ${s.assumedGenes} with the assumed frequency; baseline`, s.base);
console.log('| Detection | Assumed carrier frequency | Fatima, CYP21A2 | Fatima, rest of panel | Mariam, rest of panel |\n|---|---|---|---|---|');
for (const c of s.cells) console.log(`| ${c.d} | ${c.assumed} | 1 in ${c.fatimaGene.toLocaleString('en-US')} | 1 in ${c.fatimaRest.toLocaleString('en-US')} | 1 in ${c.mariamRest.toLocaleString('en-US')} |`);
