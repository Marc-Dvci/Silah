// Lists every bilingual text in src: each object literal with an `ar` property, with its `en` (and `arM`).
// Output: JSON lines {file, line, en, ar, arM}. Usage: node scripts/extract-arabic.mjs > texts.jsonl
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

// TypeScript 7 (this project's compiler) has no JavaScript API; any TypeScript 5 install works. Set TS5 to its path.
if (!process.env.TS5) { console.error('Set TS5 to the folder of a TypeScript 5 install, e.g. TS5=/path/to/node_modules/typescript'); process.exit(1); }
const ts = createRequire(import.meta.url)(process.env.TS5);

const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f)) files.push(p);
  }
})('src');
const raw = (n) => n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) ? n.text : n.getText());
for (const file of files) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      const get = (k) => n.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText() === k)?.initializer;
      const ar = get('ar');
      if (ar) {
        const line = src.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        console.log(JSON.stringify({ file: file.split(path.sep).join('/'), line, en: raw(get('en')), ar: raw(ar), arM: raw(get('arM')) }));
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
}
