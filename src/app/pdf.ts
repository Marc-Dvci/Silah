// Browser only: reads the text layer of a PDF with pdf.js. The library loads when it is first used.

import { itemsToLines, type TextItem } from '../core/import/lines';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

const MAX_PAGES = 20;

export async function pdfToText(data: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  // pdf.js 5 has no eval option (the app CSP blocks eval), so none is passed.
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  try {
    const count = Math.min(doc.numPages, MAX_PAGES);
    for (let i = 1; i <= count; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      // Marked-content entries have no text; keep only the text items.
      const items = content.items.filter(it => 'str' in it) as TextItem[];
      pages.push(itemsToLines(items).join('\n'));
    }
  } finally {
    await doc.destroy();
  }
  const text = pages.join('\n');
  // A scanned PDF has no text layer.
  if (text.replace(/\s/g, '').length < 20) throw new Error('no-text');
  return text;
}
