import type { PhysicianSummary } from '../core/summary-types';
import { Q } from '../core/fraction';
import { formatOneIn, formatPct } from '../core/kernel';
import { activeGrants } from '../core/crypto/receipts';
import { siteById, FORMAT_LABEL, type Format } from '../core/booking';
import { shown } from '../llm/explain';
import { storedExplanation } from '../llm/stored';
import { coupleOf, currentBundle, currentView, nameOf, partnerDisplay, sexOf, isOwn, type PersonState } from './person';

// The physician summary, built on the phone from the result and what the person did in Silah. Deterministic:
// every number is the kernel's. The only model-written part is an optional paragraph that passed the verifier.

const ORIGIN_OF = (s: PersonState): PhysicianSummary['source']['origin'] =>
  s.origin === 'uploaded-pdf' ? 'uploaded-pdf' : s.origin === 'uploaded-fhir' ? 'uploaded-fhir' : s.origin === 'manual' || s.origin === 'uploaded-file' ? 'manual' : 'lab-signed';

export function buildSummary(s: PersonState, verified: boolean): PhysicianSummary | undefined {
  const b = currentBundle(s);
  const view = currentView(s);
  if (!b || !view || !b.payload.couple) return undefined;
  const couple = b.payload.couple;
  const card = (id: string) => view.cards.find(c => c.id === id);
  const shared = view.shared.map(sh => {
    const c = card(`couple:${sh.gene}`);
    const n = (k: string) => (c?.numbers[k] ? `${Q.from(c.numbers[k]).n} in ${Q.from(c.numbers[k]).d}` : '');
    const tags = couple.shared.find(x => x.gene === sh.gene);
    return {
      gene: sh.gene,
      condition: sh.condition.name.en,
      ...(tags?.ownTag ? { ownTag: tags.ownTag } : {}),
      ...(tags?.partnerTag ? { partnerTag: tags.partnerTag } : {}),
      perPregnancy: { affected: n('affected'), carrier: n('carrier'), neither: n('neither') },
      birthPlanEligible: view.birthPlanConditions.includes(sh.condition),
    };
  });
  const det = view.detection;
  const exact = det?.exactChange ? Object.values(det.exactChange)[0] : undefined;
  const flags: string[] = [];
  if (view.counsellorFirst) flags.push('Specialist first: a finding of uncertain significance or another finding to review');
  if (s.profile?.specialistGenes?.length) flags.push(`Two changed copies reported (${s.profile.specialistGenes.join(', ')}): not used in the chances; clinical geneticist`);
  if (coupleOf(s.id)?.pregnancyDue || s.profile?.pregnant) flags.push('Pregnant now');
  if (s.profile?.weddingSoon) flags.push('Wedding within three months');
  if (s.escalations?.some(e => e.route === 'distress')) flags.push('Distress expressed in Silah (routed to a person)');
  if (!verified) flags.push('Result entered by the person from their report: check against the original');
  const expl = storedExplanation({ id: s.id, lang: s.lang, own: isOwn(s.id), sampleName: s.profile?.name, explanations: s.explanations }, view.cards, 'clinician');
  const aiOk = expl ? shown(expl) : [];
  const grants = activeGrants(s.ledger, new Date());
  const site = s.booking?.siteId ? siteById(s.booking.siteId) : undefined;
  const sources = [...new Set(view.cards.flatMap(c => c.sources))].sort();
  return {
    v: 1,
    generatedAt: new Date().toISOString(),
    lang: s.lang,
    patient: { personId: s.id, name: nameOf(s), sex: sexOf(s) ?? 'F' },
    partner: { name: partnerDisplay(s) },
    relationship: view.relationship,
    source: {
      issuer: b.payload.issuer,
      verified,
      origin: verified ? 'lab-signed' : ORIGIN_OF(s),
      testedAt: b.payload.person.testedAt,
      method: b.payload.person.method === 'egp-recheck' ? 'Couple check on genomes held by the Emirati Genome Programme' : 'Premarital genetic screening',
      panelVersion: b.payload.person.panelVersion,
    },
    status: view.status,
    findings: b.payload.person.findings.map(f => ({ gene: f.gene, variant: f.variant, classification: f.classification, ...(f.tag ? { tag: f.tag } : {}) })),
    shared,
    residual: {
      panelRisk: formatOneIn(view.panelRisk),
      ...(view.panelRiskRange ? { panelRiskRange: [formatOneIn(view.panelRiskRange[0]), formatOneIn(view.panelRiskRange[1])] as [string, string] } : {}),
      ...(det ? { detection: { panel: formatPct(Q.from(det.panel), 0), ...(exact ? { exact: formatPct(Q.from(exact), 0) } : {}) } } : {}),
      note: view.status === 'at-risk'
        ? 'Chance per pregnancy of a child with at least one panel condition, including the shared gene(s).'
        : 'Remaining chance per pregnancy of a child with any panel condition after a compatible result.' + (view.relationship !== 'unrelated' ? ' Includes changes shared by descent (related partners).' : ''),
    },
    vusGenes: couple.vusGenes,
    ...(s.teachback ? { understanding: { correct: s.teachback.correct, total: s.teachback.total, missed: s.teachback.missed, at: s.teachback.at } } : {}),
    questions: s.questions.map(q => ({ at: q.at, q: q.q, route: q.route })),
    escalations: (s.escalations ?? []).map(e => ({ at: e.at, route: e.route, seen: !!e.seen })),
    flags,
    ...(s.birthPlan ? { birthPlan: { active: s.birthPlan.active, hospital: s.birthPlan.hospital, genes: view.shared.filter(x => view.birthPlanConditions.includes(x.condition)).map(x => x.gene) } } : {}),
    sharing: grants.filter(g => g.subject.kind !== 'summary').map(g => ({ kind: g.subject.kind, ...(g.subject.gene ? { gene: g.subject.gene } : {}), recipient: g.recipient.startsWith('pair:') ? 'Partner (paired phone)' : g.recipient.startsWith('p:') ? 'Partner' : g.recipient })),
    ...(s.booking?.slot && s.booking.status === 'confirmed' ? { booking: { site: site?.name.en ?? 'Genetic counselling clinic', slot: s.booking.slot, format: FORMAT_LABEL[(s.booking.format ?? 'in-person') as Format].en, language: s.booking.lang === 'en' ? 'English' : 'Arabic' } } : {}),
    ...(aiOk.length ? { aiSummary: { sentences: aiOk.map(x => ({ text: x.text, cards: x.cards })), model: expl!.model } } : {}),
    sources,
  };
}

export const isSelfEntered = (s: PersonState) => isOwn(s.id) && s.origin !== 'lab-signed';
