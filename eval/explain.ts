// Plain-language explanations written by a model and gated by the verifier, for every demo persona and every
// sample report, in English and Arabic, plus the clinician paragraph. Uses the app's own prompt, parser,
// verifier and cards (including the uncertainty cards), against an OpenAI-compatible server (llama.cpp).
import { readFileSync } from 'node:fs';
import { PERSONAS, demoCouples } from '../src/app/demo';
import { coupleView, labCouple, SIMULATED_LAB } from '../src/core/kernel';
import { PANEL_VERSION } from '../src/core/data/panel';
import { uncertaintyCards, type ResultOrigin } from '../src/core/uncertainty';
import { extractFromText } from '../src/core/import/extract';
import { bundleFromImport } from '../src/app/person';
import { localServer } from '../src/llm/answer';
import { cardsKey, cloudBackend, explain, type Audience, type Explanation } from '../src/llm/explain';
import type { FactCard, Lang, PersonResult } from '../src/core/types';

export interface Case { key: string; label: string; sex: 'F' | 'M'; cards: FactCard[]; redact: string[]; sample: boolean }

const result = (id: string): PersonResult => {
  const p = PERSONAS.find(x => x.id === id)!;
  return { personId: id, displayName: p.name.en, sex: p.sex, findings: p.genome, panelVersion: PANEL_VERSION, testedAt: '2026-01-01', method: 'premarital' };
};

const withUncertainty = (own: PersonResult, couple: Parameters<typeof coupleView>[1], origin: ResultOrigin) =>
  [...coupleView(own, couple).cards, ...uncertaintyCards(own, couple, origin)];

export function cases(): Case[] {
  const out: Case[] = [];
  for (const p of PERSONAS) {
    const c = demoCouples().find(x => x.a === p.id || x.b === p.id)!;
    const [fa, fb] = labCouple(result(c.a), result(c.b), c.rel, c.id, SIMULATED_LAB);
    const sec = p.id === c.a ? fa : fb;
    out.push({ key: p.id, label: p.name.en, sex: p.sex, cards: withUncertainty(result(p.id), sec, 'lab-signed'), redact: [p.name.en, sec.partnerName], sample: false });
  }
  for (const name of ['aisha-khalfan-sample', 'rashid-khalfan-sample', 'noor-hamdan-sample']) {
    const data = extractFromText(readFileSync(`tests/fixtures/${name}.txt`, 'utf8'), 'pdf');
    const shared = (data.couple?.sharedGenes ?? []).filter(g => data.findings.some(f => f.gene === g && f.classification !== 'VUS'));
    const b = bundleFromImport('me', 'own-eval', {
      data, origin: 'uploaded-pdf', profile: { name: data.name!, sex: data.sex! }, relationship: data.couple!.relationship!,
      status: data.couple!.status!, sharedGenes: shared, partnerName: data.couple?.partnerName,
    });
    const cards = withUncertainty(b.payload.person, b.payload.couple!, 'uploaded-pdf');
    out.push({ key: `sample:${cardsKey(cards)}`, label: name, sex: data.sex!, cards, redact: [data.name!, data.couple?.partnerName ?? ''], sample: true });
  }
  return out;
}

export interface Row { case: string; label: string; audience: Audience; lang: Lang; e?: Explanation; error?: string }

export async function run(base: string, model: string): Promise<Row[]> {
  // A local llama.cpp server, or the relay's explanation service (names removed, as the phone does).
  const cloud = base.startsWith('https://');
  const backend = cloud ? { ...cloudBackend(base), model } : { ...localServer(base), model };
  const rows: Row[] = [];
  for (const c of cases()) {
    const jobs: [Audience, Lang][] = [['person', 'en'], ['person', 'ar'], ['clinician', 'en']];
    for (const [audience, lang] of jobs) {
      try {
        const e = await explain(backend, c.cards, lang, audience, c.sex, cloud ? c.redact : []);
        rows.push({ case: c.key, label: c.label, audience, lang, e });
        const ok = e.sentences.filter(s => s.ok).length;
        console.log(`${c.label.padEnd(22)} ${audience.padEnd(9)} ${lang}  ${ok}/${e.sentences.length} passed  ${e.ms} ms`);
      } catch (err) {
        rows.push({ case: c.key, label: c.label, audience, lang, error: String((err as Error).message ?? err) });
        console.log(`${c.label.padEnd(22)} ${audience.padEnd(9)} ${lang}  ERROR ${(err as Error).message}`);
      }
    }
  }
  return rows;
}
