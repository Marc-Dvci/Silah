// Prints the text layer of PDF files, as src/app/pdf.ts reads it.
// Usage: node scripts/pdf_text.mjs <file.pdf> [...]
// The line grouping is the same as itemsToLines in src/core/import/lines.ts; keep the two in step.
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const MAX_PAGES = 20;
const SAME_LINE = 2.5;
const TINY_GAP = 0.1;

function itemsToLines(items) {
  const sorted = items
    .filter(it => typeof it.str === 'string' && it.str.length > 0)
    .sort((a, b) => b.transform[5] - a.transform[5]);

  const rows = [];
  let rowY = 0;
  for (const it of sorted) {
    const y = it.transform[5];
    if (rows.length === 0 || rowY - y > SAME_LINE) {
      rows.push([it]);
      rowY = y;
    } else {
      rows[rows.length - 1].push(it);
    }
  }

  return rows
    .map(row => joinRow(row.sort((a, b) => a.transform[4] - b.transform[4])).trim())
    .filter(line => line.length > 0);
}

function joinRow(row) {
  let out = '';
  let prevEnd;
  let prevSize = 10;
  for (const it of row) {
    const x = it.transform[4];
    if (out.length > 0 && !out.endsWith(' ') && !it.str.startsWith(' ')) {
      const tight = prevEnd !== undefined && x - prevEnd <= TINY_GAP * prevSize;
      if (!tight) out += ' ';
    }
    out += it.str;
    prevEnd = it.width === undefined ? undefined : x + it.width;
    prevSize = Math.abs(it.transform[3]) || 10;
  }
  return out;
}

async function pdfText(file) {
  const data = new Uint8Array(await readFile(file));
  const doc = await pdfjs.getDocument({
    data,
    useSystemFonts: false,
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  }).promise;
  const pages = [];
  try {
    const count = Math.min(doc.numPages, MAX_PAGES);
    for (let i = 1; i <= count; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages.push(itemsToLines(content.items).join('\n'));
    }
  } finally {
    await doc.destroy();
  }
  return pages.join('\n');
}

const files = process.argv.slice(2);
if (files.length === 0) {
  process.stderr.write('Usage: node scripts/pdf_text.mjs <file.pdf> [...]\n');
  process.exitCode = 2;
}
for (const file of files) {
  try {
    if (files.length > 1) process.stderr.write(`--- ${basename(file)}\n`);
    process.stdout.write(`${await pdfText(file)}\n`);
  } catch (err) {
    process.stderr.write(`${basename(file)}: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  }
}
