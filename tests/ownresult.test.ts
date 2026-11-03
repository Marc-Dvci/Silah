import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { extractFromText } from '../src/core/import/extract';
import { bundleFromImport, type ImportInput } from '../src/app/person';
import { coupleView, formatOneIn, labCouple, SIMULATED_LAB } from '../src/core/kernel';
import { uncertaintyCards } from '../src/core/uncertainty';
import { verifySentence } from '../src/core/verifier';
import { Q } from '../src/core/fraction';
import type { PersonResult } from '../src/core/types';

const read = (name: string) => extractFromText(readFileSync(`tests/fixtures/${name}.txt`, 'utf8'), 'pdf');
const input = (name: string): ImportInput => {
  const data = read(name);
  return {
    data, origin: 'uploaded-pdf', profile: { name: data.name!, sex: data.sex! }, relationship: data.couple!.relationship!,
    status: data.couple!.status!, sharedGenes: data.couple!.sharedGenes, partnerName: data.couple!.partnerName,
  };
};

describe('a result brought by the person', () => {
  it('becomes the same bundle a lab would send, unsigned', () => {
    const b = bundleFromImport('me', 'own-test', input('aisha-khalfan-sample'));
    expect(b.keyId).toBe('self');
    expect(b.sig).toBe('');
    expect(b.payload.couple).toMatchObject({ status: 'at-risk', relationship: 'first-cousins', partnerNegativeFor: ['GJB2'], vusGenes: ['MEFV'] });
    expect(b.payload.couple!.shared).toEqual([{ gene: 'HBB', ownTag: 'HbS', partnerTag: 'b+' }]);
    expect(Q.from(b.payload.couple!.detection!.panel).toNumber()).toBeCloseTo(0.95);
    expect(Q.from(b.payload.couple!.detection!.exactChange!.GJB2).toNumber()).toBeCloseTo(0.99);
  });

  it('gives the same numbers as the lab path for the same two people', () => {
    const a = bundleFromImport('me', 'own-test', input('aisha-khalfan-sample')).payload;
    const r = read('rashid-khalfan-sample');
    const rashid: PersonResult = { ...a.person, personId: 'r', displayName: 'Rashid', sex: 'M', findings: r.findings.map(f => ({ gene: f.gene, variant: f.variant, classification: f.classification, ...(f.tag ? { tag: f.tag } : {}) })) };
    const [forA] = labCouple(a.person, rashid, 'first-cousins', 'x', { panel: Q.of(95, 100), exactChange: Q.of(99, 100) });
    const fromLab = coupleView(a.person, forA);
    const fromUpload = coupleView(a.person, a.couple!);
    expect(fromUpload.panelRisk.eq(fromLab.panelRisk)).toBe(true);
    expect(fromUpload.shared.map(x => x.condition.id)).toEqual(['sbthal']);
  });

  it('shows ranges when the report states no detection', () => {
    const b = bundleFromImport('me', 'own-test', input('noor-hamdan-sample'));
    const v = coupleView(b.payload.person, b.payload.couple!);
    expect(b.payload.couple!.detection).toBeUndefined();
    expect(v.status).toBe('compatible');
    expect(v.panelRiskRange).toBeDefined();
  });

  it('never computes chances for two changed copies, and ignores genes off the panel', () => {
    const x = input('aisha-khalfan-sample');
    x.data = { ...x.data, findings: [...x.data.findings.map(f => (f.gene === 'GJB2' ? { ...f, zygosity: 'hom' as const } : f)), { gene: 'NOTAGENE', variant: 'c.1A>G', classification: 'P', confidence: 'high', line: '' }] };
    const b = bundleFromImport('me', 'own-test', x);
    expect(b.payload.person.findings.map(f => f.gene)).toEqual(['HBB', 'MEFV']);
  });

  it('cannot be at risk for a gene the person does not carry', () => {
    const x = { ...input('noor-hamdan-sample'), status: 'at-risk' as const, sharedGenes: ['HBB'] };
    expect(bundleFromImport('me', 'own-test', x).payload.couple!.status).toBe('compatible');
  });
});

describe('what is still uncertain', () => {
  const b = bundleFromImport('me', 'own-test', input('aisha-khalfan-sample')).payload;
  const cards = uncertaintyCards(b.person, b.couple!, 'uploaded-pdf');
  const byId = new Map(cards.map(c => [c.id, c]));

  it('states the lab’s detection, the range it gives, the assumed frequency and the reading of the report', () => {
    expect(cards.map(c => c.id)).toEqual(['uncertainty:detection', 'uncertainty:range', 'uncertainty:frequency', 'uncertainty:entry']);
    expect(byId.get('uncertainty:detection')!.text.en).toContain('95%');
  });

  it('works out the range with the kernel itself', () => {
    const r = byId.get('uncertainty:range')!;
    const [lo, hi] = r.ranges!.affected.map(Q.from);
    expect(lo.cmp(hi)).toBe(-1);
    expect(r.text.en).toContain(formatOneIn(lo));
    expect(r.text.en).toContain(formatOneIn(hi));
  });

  it('lets the verifier pass the cards’ own sentences and block a moved number', () => {
    for (const c of cards) for (const s of c.text.en.split(/(?<=\.)\s+/)) {
      expect(verifySentence({ text: s, cards: [c.id] }, byId).ok, s).toBe(true);
    }
    const r = byId.get('uncertainty:range')!;
    const hi = Q.from(r.ranges!.affected[1]);
    expect(verifySentence({ text: `If the test finds 80% of changes, the chance is about 1 in 4 per pregnancy.`, cards: [r.id] }, byId).ok).toBe(false);
    expect(verifySentence({ text: `If the test finds 80% of changes, the chance is about ${formatOneIn(hi)} per pregnancy.`, cards: [r.id] }, byId).ok).toBe(true);
    expect(verifySentence({ text: 'The test finds about 70% of the changes.', cards: ['uncertainty:detection'] }, byId).ok).toBe(false);
  });

  it('adds no reading-of-the-report card to a lab-signed result', () => {
    const sim = labCouple(b.person, b.person, 'unrelated', 'x', SIMULATED_LAB)[0];
    expect(uncertaintyCards(b.person, sim, 'lab-signed').some(c => c.id === 'uncertainty:entry')).toBe(false);
  });
});
