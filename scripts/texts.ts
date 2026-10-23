// Every fixed sentence the demo family can hear, in both languages. Used by render_audio.py.
import { PERSONAS, demoCouples } from '../src/app/demo';
import { coupleView, labCouple, optionCards, SIMULATED_LAB } from '../src/core/kernel';
import { CONDITIONS } from '../src/core/conditions';
import { PANEL_VERSION } from '../src/core/data/panel';
import type { PersonResult } from '../src/core/types';
import { audioKey } from '../src/ui/kit';

const result = (id: string): PersonResult => {
  const p = PERSONAS.find(x => x.id === id)!;
  return { personId: id, displayName: p.name.en, sex: p.sex, findings: p.genome, panelVersion: PANEL_VERSION, testedAt: '2026-01-01', method: 'premarital' };
};

export function collect(): { lang: string; text: string; key: string }[] {
  const out = new Map<string, { lang: string; text: string; key: string }>();
  const add = (lang: string, text: string) => { const key = audioKey(lang, text); out.set(key, { lang, text, key }); };
  for (const c of demoCouples()) {
    const [fa, fb] = labCouple(result(c.a), result(c.b), c.rel, c.id, SIMULATED_LAB);
    for (const [pid, sec] of [[c.a, fa], [c.b, fb]] as const) {
      const v = coupleView(result(pid), sec);
      for (const card of v.cards) { add('en', card.text.en); add('ar', card.text.ar); }
    }
  }
  for (const o of optionCards([])) { add('en', o.text.en); add('ar', o.text.ar); }
  for (const c of CONDITIONS) if (c.birthPlan) {
    add('en', `${c.birthPlan.action.en} ${c.birthPlan.window.en}`);
    add('ar', `${c.birthPlan.action.ar} ${c.birthPlan.window.ar}`);
  }
  return [...out.values()];
}
