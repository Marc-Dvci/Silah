// Every statement Silah can show about risk, conditions and options, gathered for review by a genetic
// counsellor: each fact card (as the three demo couples see them, plus every relative and relationship
// variant), the fixed opening sentences of the common answers, and the hard-route replies.
import { demoCouples } from '../src/app/demo';
import { conditionCard, birthPlanCard, consanguinityCard, relativeCard, OPTIONS, RELATIVE_PRIOR, type Relative } from '../src/core/kernel';
import { CONDITIONS } from '../src/core/conditions';
import { INTENTS } from '../src/core/faq';
import { RULES } from '../src/core/routes';
import { sourceById } from '../src/core/data/sources';
import { COUNSELLOR_CARD } from '../src/llm/answer';
import type { FactCard, L10n, Relationship } from '../src/core/types';
import { cardsFor } from './bakeoff';

export interface Statement { id: string; group: string; en: string; ar: string; sources: string; arithmetic: string }

const short = (id: string) => {
  const s = sourceById(id);
  if (!s) return id;
  if (id.startsWith('assumption-')) return `Stated assumption [${id}]`;
  const first = s.cite.split(/(?<![A-Z])\.\s/)[0];
  const who = first.includes(',') ? `${first.split(',')[0].trim()} et al.` : first;
  return `${who}${s.year ? ` ${s.year}` : ''} [${id}]`;
};
const cite = (ids: string[]) => ids.map(short).join('; ');

export function statements(): Statement[] {
  const out: Statement[] = [];
  const seen = new Set<string>();
  const add = (group: string, id: string, text: L10n, sources: string[] = [], arithmetic = '') => {
    const key = `${id}|${text.en}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ id, group, en: text.en, ar: text.ar, sources: cite(sources), arithmetic });
  };
  const card = (group: string, c: FactCard) => add(group, c.id, c.text, c.sources, c.arithmetic ?? '');

  for (const couple of demoCouples()) for (const person of [couple.a, couple.b]) {
    for (const c of cardsFor(person)) if (!['condition', 'birth-plan', 'option'].includes(c.kind)) card(`Result cards · ${person}`, c);
  }
  for (const c of CONDITIONS) card('Conditions', conditionCard(c));
  for (const c of CONDITIONS) if (c.birthPlan) card('Birth plan', birthPlanCard(c));
  for (const rel of ['second-cousins', 'first-cousins-once-removed', 'first-cousins', 'double-first-cousins'] as Relationship[]) {
    const c = consanguinityCard(rel);
    if (c) add('Related partners', `consanguinity:${rel}`, c.text, c.sources, c.arithmetic ?? '');
  }
  for (const rel of Object.keys(RELATIVE_PRIOR) as Relative[]) card('Relatives', relativeCard(rel, 'SMN1'));
  for (const c of [...OPTIONS, COUNSELLOR_CARD]) card('Options', c);
  for (const i of INTENTS) if (i.lead) add('Fixed answer openings', `faq:${i.id}`, i.lead);
  for (const r of RULES) add('Hand-offs to a person', `route:${r.route}`, r.reply);
  return out;
}
