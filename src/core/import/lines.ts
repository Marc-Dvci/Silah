// pdf.js text items to lines of text. Pure, so it can be tested without a PDF.

export interface TextItem {
  str: string;
  transform: number[];
  width?: number;
}

const SAME_LINE = 2.5;   // items this close in y are one line
const TINY_GAP = 0.1;    // a gap up to this many font sizes joins two items with no space

export function itemsToLines(items: TextItem[]): string[] {
  const sorted = items
    .filter(it => typeof it.str === 'string' && it.str.length > 0)
    .sort((a, b) => b.transform[5] - a.transform[5]);

  // Top to bottom: the first item of a row is its highest one.
  const rows: TextItem[][] = [];
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

function joinRow(row: TextItem[]): string {
  let out = '';
  let prevEnd: number | undefined;   // undefined when the previous width is unknown
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
