// Loads scripts/texts.ts through Vite (so TypeScript and path resolution match the app) and prints JSON.
import { createServer } from 'vite';
const server = await createServer({ configFile: false, cacheDir: 'node_modules/.vite-scripts', server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const mod = await server.ssrLoadModule('/scripts/texts.ts');
process.stdout.write(JSON.stringify(mod.collect()));
await server.close();
