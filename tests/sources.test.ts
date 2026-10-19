import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCES, sourceById } from '../src/core/data/sources';

// Every source chip a person can tap must point to a source checked for the statement it supports.

function files(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

describe('sources', () => {
  it('every listed source is checked and says what it supports', () => {
    for (const s of SOURCES) {
      expect(s.verified, s.id).toBe(true);
      expect(s.note && s.note.length > 20, s.id).toBe(true);
    }
  });

  it('every source id the app cites exists', () => {
    const code = files('src').filter(f => !f.endsWith('sources.ts')).map(f => readFileSync(f, 'utf-8')).join('\n');
    const cited = new Set<string>();
    for (const m of code.matchAll(/sources: \[([^\]]*)\]|SourceChips ids=\{\[([^\]]*)\]/g)) {
      for (const id of (m[1] ?? m[2]).matchAll(/'([a-z0-9-]+)'/g)) cited.add(id[1]);
    }
    expect(cited.size).toBeGreaterThan(10);
    for (const id of cited) expect(sourceById(id), id).toBeDefined();
  });
});
