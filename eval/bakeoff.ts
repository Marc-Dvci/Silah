// Runs the companion evaluation against an OpenAI-compatible server (llama.cpp) with the app's own
// prompt, parser and verifier. Raw model behaviour and what the person would see are both recorded.
import { PERSONAS, demoCouples } from '../src/app/demo';
import { coupleView, labCouple } from '../src/core/kernel';
import { PANEL_VERSION } from '../src/core/data/panel';
import { composeMessages, COUNSELLOR_CARD } from '../src/llm/answer';
import { parseModelAnswer, verifyAnswer, extractNumbers, allowedNumbers, isDirective, isCertainty, resolveIds } from '../src/core/verifier';
import type { FactCard, Lang, PersonResult } from '../src/core/types';
import { QUESTIONS, type Category } from './questions';

const result = (id: string): PersonResult => {
  const p = PERSONAS.find(x => x.id === id)!;
  return { personId: id, displayName: p.name.en, sex: p.sex, findings: p.genome, panelVersion: PANEL_VERSION, testedAt: '2026-01-01', method: 'premarital' };
};

export function cardsFor(id: string): FactCard[] {
  const c = demoCouples().find(x => x.a === id || x.b === id)!;
  const [fa, fb] = labCouple(result(c.a), result(c.b), c.rel, c.id);
  return coupleView(result(id), id === c.a ? fa : fb).cards;
}

const arabicShare = (s: string) => {
  const letters = s.replace(/[^\p{L}]/gu, '');
  return letters ? (letters.match(/[؀-ۿ]/g)?.length ?? 0) / letters.length : 0;
};

export interface Row {
  id: string; cat: Category; lang: Lang; q: string; raw: string; jsonOk: boolean; ms: number; tps?: number;
  sentences: number; shown: number; shownNonCounsellor: number;
  blocked: Record<string, number>;
  rawDirective: number; rawCertainty: number; rawBadNumber: number; rawNoCard: number;
  shownText: string[]; blockedText: { text: string; reasons: string[] }[]; langOk: boolean;
}

export async function run(base: string, model: string): Promise<{ rows: Row[] }> {
  const rows: Row[] = [];
  for (const q of QUESTIONS) for (const lang of ['en', 'ar'] as Lang[]) {
    const cards = cardsFor(q.persona);
    const question = q[lang];
    const t0 = Date.now();
    const r = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model, messages: composeMessages(question, cards, lang), temperature: 0.2, max_tokens: 420, seed: 7,
        response_format: { type: 'json_object' },
      }),
    });
    const j: any = await r.json();
    const raw = String(j.choices?.[0]?.message?.content ?? '');
    const ms = Date.now() - t0;
    rows.push(score(q.id, q.cat, lang, question, raw, cards, ms, j.timings?.predicted_per_second));
  }
  return { rows };
}

export function score(id: string, cat: Category, lang: Lang, question: string, raw: string, cards: FactCard[], ms: number, tps?: number): Row {
  const parsed = parseModelAnswer(raw);
  const all = [...cards, COUNSELLOR_CARD];
  const v = parsed ? verifyAnswer(parsed, all) : null;
  const byId = new Map(all.map(c => [c.id, c]));
  const blocked: Record<string, number> = {};
  let rawDirective = 0, rawCertainty = 0, rawBadNumber = 0, rawNoCard = 0;
  for (const s of parsed?.sentences ?? []) {
    if (isDirective(s.text)) rawDirective++;
    if (isCertainty(s.text)) rawCertainty++;
    const cited = resolveIds(s.cards, all).map(x => byId.get(x)).filter((c): c is FactCard => !!c);
    if (!cited.length) rawNoCard++;
    const allowed = allowedNumbers(cited);
    if (extractNumbers(s.text).some(x => !allowed.has(String(Math.round(x * 1e4) / 1e4)))) rawBadNumber++;
  }
  for (const b of v?.blocked ?? []) for (const reason of b.reasons) blocked[reason] = (blocked[reason] ?? 0) + 1;
  const shownText = v?.shown.map(s => s.text) ?? [];
  const joined = shownText.join(' ');
  return {
    id, cat, lang, q: question, raw, jsonOk: !!parsed, ms, tps,
    sentences: parsed?.sentences.length ?? 0,
    shown: shownText.length,
    shownNonCounsellor: v?.shown.filter(s => s.cards.some(c => c !== 'counsellor')).length ?? 0,
    blocked, rawDirective, rawCertainty, rawBadNumber, rawNoCard, shownText,
    blockedText: (v?.blocked ?? []).map(b => ({ text: b.sentence.text, reasons: b.reasons })),
    langOk: shownText.length === 0 || (lang === 'ar' ? arabicShare(joined) > 0.6 : arabicShare(joined) < 0.1),
  };
}

/** Re-score saved raw outputs with the current verifier, without calling the model again. */
export function rescore(rows: Row[]): Row[] {
  return rows.map(r => {
    const q = QUESTIONS.find(x => x.id === r.id)!;
    return score(r.id, r.cat, r.lang, r.q, r.raw, cardsFor(q.persona), r.ms, r.tps);
  });
}
