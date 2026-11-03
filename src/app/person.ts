import type { CoupleSection, Finding, Lang, PersonResult, ResultBundle, Signed } from '../core/types';
import type { Route } from '../core/routes';
import { b64url, fromB64url, generateKeyPair, verifySigned, type KeyPair } from '../core/crypto/sign';
import { appendReceipt, activeGrants, type LedgerEntry, type ReceiptSubject } from '../core/crypto/receipts';
import { finalizeInvites, importPublicKey, requestInvites } from '../core/crypto/invites';
import { coupleView, isCarrierFinding, type CoupleView } from '../core/kernel';
import { Q } from '../core/fraction';
import { PANEL_SET, PANEL_VERSION } from '../core/data/panel';
import { uncertaintyCards, type ResultOrigin } from '../core/uncertainty';
import type { Extracted } from '../core/import/types';
import type { Format, Slot } from '../core/booking';
import type { PhysicianSummary } from '../core/summary-types';
import { newPairId, newPairSecret, parsePairToken, type PairKind, type PairSecret } from '../core/crypto/pairing';
import type { Explanation } from '../llm/explain';
import { relayDelete, relayPoll, relayPost } from './relay';
import { vaultLoad, vaultSave } from './vault';
import { dbGet } from './db';
import { inbox, send, type Msg } from './net';
import { demoCouples, personaById } from './demo';

// Everything that happens on one person's phone. State lives encrypted in the vault.

export type PathState = 'result-issued' | 'notified' | 'understood' | 'counselling-booked' | 'counselled' | 'confirmatory' | 'referred' | 'closed';

export interface Teachback { at: string; correct: number; total: number; missed: string[] }
export interface Question { at: string; q: string; route: Route; cards: string[]; via: 'faq' | 'model' | 'route' | 'none' }
export interface Received { from: string; fromName: string; gene: string; variant?: string; at: string; seq: number; revoked?: boolean }
/** A request for a person. `received` and `seen` are set only when the clinic and then a counsellor confirm them. */
export interface Escalation { ref: string; at: string; route: Route; received?: string; seen?: string }

export interface Booking {
  at: string;
  status: 'requested' | 'confirmed' | 'declined' | 'cancelled';
  /** Start time, ISO. */
  slot?: string;
  slotId?: string;
  siteId?: string;
  format?: Format;
  lang?: Lang;
  counsellorId?: string;
  withSummary?: boolean;
  note?: string;
}

/** A link between two partners' phones through the relay; the key never leaves the two phones. */
export interface Pairing {
  room: string;
  key: string;
  me: string;
  role: 'host' | 'guest';
  since: string;
  after: number;
  partner?: { name: string; at: string };
  outbox: { kind: PairKind; body: unknown; at: string }[];
  ended?: string;
  lastOk?: string;
  lastError?: string;
}

/** Someone who brought their own result. Demo personas have this in demo.ts instead. */
export interface Profile { name: string; sex: 'F' | 'M'; pregnant?: boolean; weddingSoon?: boolean; specialistGenes?: string[] }

export interface PersonState {
  id: string;
  profile?: Profile;
  origin?: ResultOrigin;
  pairing?: Pairing;
  partnerBooking?: { at: string; slot: string; siteId?: string; format?: string };
  explanations?: Record<string, Explanation>;
  summaries?: { at: string; seq: number }[];
  lang: Lang;
  digits: 'latn' | 'arab';
  kp: { sk: string; pk: string; keyId: string };
  bundles: Signed<ResultBundle>[];
  ledger: LedgerEntry[];
  invitation?: { coupleId: string; partner: string; at: string; status: 'pending' | 'consented' | 'declined' };
  teachback?: Teachback;
  questions: Question[];
  received: Received[];
  invites: { tokens: string[]; pending?: { prepared: string; inv: string }[]; requested: number; shared: number };
  birthPlan?: { active: boolean; hospital: string; seq: number };
  birthOutcome?: { at: string; affected: boolean; genes: string[]; note: string };
  big?: boolean;
  booking?: Booking;
  briefShared?: string;
  escalations?: Escalation[];
  pathway: { state: PathState; at: string; note?: string }[];
  seen: string[];
}

const owner = (id: string) => `p:${id}`;
export const address = owner;

/** The phone of someone who brings their own result (as opposed to the demo's fictional family). */
export const OWN_ID = 'me';
export const isOwn = (id: string) => id === OWN_ID;

export function nameOf(s: PersonState, lang: Lang = 'en'): string {
  return personaById(s.id)?.name[lang] ?? s.profile?.name ?? '';
}
export function sexOf(s: PersonState): 'F' | 'M' | undefined {
  return personaById(s.id)?.sex ?? s.profile?.sex;
}
/** The couple's id at the clinic: the demo couple's, or one derived from this phone's key for an own result. */
export function coupleIdOf(s: PersonState): string | undefined {
  return isOwn(s.id) ? `own-${s.kp.keyId.slice(0, 8)}` : coupleOf(s.id)?.id;
}
/** The partner's name as this person knows it: the demo persona, the paired phone, or the report. */
export function partnerDisplay(s: PersonState, lang: Lang = 'en'): string {
  const pid = partnerOf(s.id);
  if (pid && personaById(pid)) return personaById(pid)!.name[lang];
  const fromReport = currentBundle(s)?.payload.couple?.partnerName;
  const name = s.pairing?.partner?.name ?? fromReport;
  if (name && !/^(your partner|partner)$/i.test(name)) return name.replace(/\s*\((sample|fictional)\)\s*$/i, '');
  return lang === 'ar' ? (sexOf(s) === 'M' ? 'شريكتك' : 'شريكك') : 'your partner';
}
/** Pregnancy, distress or a near wedding: the counselling timetable shows slots held for urgent cases. */
export function isUrgent(s: PersonState): boolean {
  return !!(coupleOf(s.id)?.pregnancyDue || s.profile?.pregnant || s.profile?.weddingSoon || s.escalations?.some(e => e.route === 'distress'));
}
/** What the clinic needs to open a case for someone who brought their own result (no demo case exists). */
function ownCase(s: PersonState) {
  if (!isOwn(s.id)) return undefined;
  const c = currentBundle(s)?.payload.couple;
  return {
    names: [nameOf(s), partnerDisplay(s)] as [string, string],
    status: c?.status ?? 'compatible',
    genes: c?.shared.map(x => x.gene) ?? [],
    conditionIds: currentView(s)?.shared.map(x => x.condition.id) ?? [],
    flags: [...(c?.vusGenes.length ? ['vus'] : []), ...(s.profile?.pregnant ? ['pregnancy'] : []), ...(s.profile?.weddingSoon ? ['wedding-date'] : []), ...(s.profile?.specialistGenes?.length ? ['specialist'] : [])],
    origin: s.origin ?? 'manual',
  };
}
const toClinic = (s: PersonState, kind: Parameters<typeof send>[2], body: Record<string, unknown>) =>
  send(owner(s.id), 'clinic', kind, { coupleId: coupleIdOf(s), personId: s.id, own: ownCase(s), ...body });

/** A phone opened on its own starts in the browser's language: Arabic for an Arabic browser, English otherwise.
 * The ع / EN switch on every phone changes it, and the demo stage sets all phones at once. */
const browserLang = (): Lang =>
  typeof navigator !== 'undefined' && (navigator.languages ?? [navigator.language]).some(l => l?.toLowerCase().startsWith('ar')) ? 'ar' : 'en';

const kpOf = (s: PersonState): KeyPair => ({ secretKey: fromB64url(s.kp.sk), publicKey: fromB64url(s.kp.pk), keyId: s.kp.keyId });

export async function loadPerson(id: string): Promise<PersonState> {
  const s = await vaultLoad<PersonState>(owner(id));
  if (s) return s;
  const kp = generateKeyPair();
  const fresh: PersonState = {
    id,
    lang: browserLang(),
    digits: 'latn',
    kp: { sk: b64url(kp.secretKey), pk: b64url(kp.publicKey), keyId: kp.keyId },
    bundles: [],
    ledger: [],
    questions: [],
    received: [],
    invites: { tokens: [], requested: 0, shared: 0 },
    pathway: [],
    seen: [],
  };
  await vaultSave(owner(id), fresh);
  return fresh;
}

export const savePerson = (s: PersonState) => vaultSave(owner(s.id), s);

export function coupleOf(personId: string) {
  return demoCouples().find(c => c.a === personId || c.b === personId);
}
export function partnerOf(personId: string): string | undefined {
  const c = coupleOf(personId);
  return c ? (c.a === personId ? c.b : c.a) : undefined;
}

async function trustedLab(): Promise<Record<string, Uint8Array>> {
  const t = await dbGet<{ keyId: string; pk: string }>('keys', 'trust:lab');
  return t ? { [t.keyId]: fromB64url(t.pk) } : {};
}

export function currentBundle(s: PersonState): Signed<ResultBundle> | undefined {
  return s.bundles[s.bundles.length - 1];
}

export function currentView(s: PersonState): CoupleView | undefined {
  const b = currentBundle(s);
  if (!b?.payload.couple) return undefined;
  const v = coupleView(b.payload.person, b.payload.couple);
  // What is uncertain is part of the result: it is shown, explained and checked like every other card.
  v.cards.push(...uncertaintyCards(b.payload.person, b.payload.couple, s.origin ?? 'lab-signed'));
  // A result the person brought states detection as printed on their report, not in a lab-signed bundle.
  if (b.keyId === 'self') v.cards = v.cards.map(c => (c.sources.includes('lab-detection') ? { ...c, sources: c.sources.map(x => (x === 'lab-detection' ? 'report-detection' : x)) } : c));
  return v;
}

export async function bundleVerified(s: PersonState): Promise<boolean> {
  const b = currentBundle(s);
  return !!b && b.keyId !== 'self' && verifySigned(b, await trustedLab());
}

function receipt(s: PersonState, action: 'consent' | 'withdraw' | 'share' | 'revoke', subject: ReceiptSubject, recipient: string, scope: string, extra: { expires?: string; ref?: number } = {}): number {
  s.ledger = appendReceipt(s.ledger, { at: new Date().toISOString(), actor: s.id, action, subject, recipient, scope, ...extra }, kpOf(s));
  return s.ledger[s.ledger.length - 1].payload.seq;
}

const push = (s: PersonState, state: PathState, note?: string) => {
  if (!s.pathway.some(p => p.state === state)) s.pathway.push({ state, at: new Date().toISOString(), note });
};

/** Apply every unseen message addressed to this person. */
export async function syncPerson(s: PersonState): Promise<boolean> {
  const paired = await syncPairing(s);
  const msgs = (await inbox(owner(s.id))).filter(m => !s.seen.includes(m.id));
  if (!msgs.length) {
    if (paired) await savePerson(s);
    return paired;
  }
  for (const m of msgs) {
    s.seen.push(m.id);
    await apply(s, m);
  }
  await savePerson(s);
  return true;
}

async function apply(s: PersonState, m: Msg): Promise<void> {
  const body = m.body as any;
  switch (m.kind) {
    case 'invite.couple-check':
      s.invitation = { coupleId: body.coupleId, partner: body.partner, at: m.at, status: 'pending' };
      break;
    case 'result.bundle': {
      const b = body as Signed<ResultBundle>;
      if (verifySigned(b, await trustedLab())) {
        s.bundles.push(b);
        push(s, 'result-issued');
      }
      break;
    }
    case 'share.finding':
      s.received.push({ from: m.from, fromName: body.fromName, gene: body.gene, variant: body.variant, at: m.at, seq: body.seq });
      break;
    case 'share.revoke':
      s.received = s.received.map(r => (r.from === m.from && r.seq === body.ref ? { ...r, revoked: true } : r));
      break;
    case 'invite.issued': {
      if (!s.invites.pending) break;
      if (body.error || !body.blindSigs?.length) { s.invites.pending = undefined; break; }
      const pk = await importPublicKey(body.publicKey);
      const pending = s.invites.pending.map(p => ({ prepared: fromB64url(p.prepared), inv: fromB64url(p.inv) }));
      const tokens = await finalizeInvites(pk, pending, body.blindSigs);
      s.invites.tokens.push(...tokens);
      s.invites.pending = undefined;
      break;
    }
    case 'escalate.received':
    case 'escalate.seen': {
      const e = s.escalations?.find(x => x.ref === body.ref);
      if (e) e[m.kind === 'escalate.seen' ? 'seen' : 'received'] = m.at;
      break;
    }
    case 'pathway.update':
      if (body.birth) s.birthOutcome = { at: m.at, ...body.birth };
      push(s, body.state as PathState, body.note);
      if (body.state === 'counselling-booked' && body.slot) {
        // A confirmation for an earlier, cancelled request does not override the current one.
        if (!body.slotId || !s.booking?.slotId || body.slotId === s.booking.slotId) {
          s.booking = { ...(s.booking ?? {}), ...(body.booking ?? {}), at: m.at, status: 'confirmed', slot: body.slot, ...(body.slotId ? { slotId: body.slotId } : {}) };
        }
      }
      break;
    case 'booking.declined':
      if (s.booking && s.booking.slotId === body.slotId) s.booking = { ...s.booking, status: 'declined', note: body.reason };
      break;
  }
}

// ---------- actions ----------

export async function respondToInvitation(s: PersonState, yes: boolean): Promise<void> {
  if (!s.invitation) return;
  s.invitation.status = yes ? 'consented' : 'declined';
  if (yes) {
    const seq = receipt(s, 'consent', { kind: 'couple-check', note: 'Couple check on genomes already held by the Emirati Genome Programme' }, 'DoH genomics service', 'carrier findings on the premarital panel, for this couple only');
    await send(owner(s.id), 'clinic', 'consent.couple-check', { coupleId: s.invitation.coupleId, personId: s.id, receiptSeq: seq });
  }
  await savePerson(s);
}

export async function acknowledgeResult(s: PersonState): Promise<void> {
  if (s.pathway.some(p => p.state === 'notified')) return;
  push(s, 'notified');
  await toClinic(s, 'pathway.update', { state: 'notified' });
  await savePerson(s);
}

export async function recordTeachback(s: PersonState, t: Teachback): Promise<void> {
  s.teachback = t;
  if (t.correct === t.total) push(s, 'understood');
  await savePerson(s);
}

/** Can this person share a finding with the partner right now: a demo partner in the same browser, or a paired phone. */
export const canShareWithPartner = (s: PersonState) => !!partnerOf(s.id) || (!!s.pairing && !s.pairing.ended);

export async function shareFinding(s: PersonState, gene: string): Promise<void> {
  const partner = partnerOf(s.id);
  const b = currentBundle(s);
  const f = b?.payload.person.findings.find(x => x.gene === gene && isCarrierFinding(x));
  if (!f) return;
  if (s.pairing && !s.pairing.ended) {
    const seq = receipt(s, 'share', { kind: 'finding', gene }, `pair:${s.pairing.room}`, `${gene} carrier status only`);
    await pairSend(s, 'share.finding', { fromName: nameOf(s), gene, variant: f.variant, seq });
  } else if (partner) {
    const seq = receipt(s, 'share', { kind: 'finding', gene }, owner(partner), `${gene} carrier status only`);
    await send(owner(s.id), owner(partner), 'share.finding', { fromName: personaById(s.id)?.name, gene, variant: f.variant, seq });
  } else return;
  await savePerson(s);
}

export async function revoke(s: PersonState, seq: number): Promise<void> {
  const r = s.ledger.find(e => e.payload.seq === seq)?.payload;
  if (!r) return;
  receipt(s, r.action === 'consent' ? 'withdraw' : 'revoke', r.subject, r.recipient, r.scope, { ref: seq });
  if (r.subject.kind === 'finding' && r.recipient.startsWith('pair:')) await pairSend(s, 'share.revoke', { ref: seq });
  else if (r.subject.kind === 'finding') await send(owner(s.id), r.recipient, 'share.revoke', { ref: seq });
  if (r.subject.kind === 'summary') await toClinic(s, 'summary.revoke', {});
  if (r.subject.kind === 'pairing') await endPairing(s, false);
  if (r.subject.kind === 'birth-plan') {
    s.birthPlan = s.birthPlan ? { ...s.birthPlan, active: false } : undefined;
    await toClinic(s, 'birthplan.revoke', {});
  }
  if (r.subject.kind === 'brief') {
    s.briefShared = undefined;
    await toClinic(s, 'brief.revoke', {});
  }
  if (r.subject.kind === 'couple-check') {
    if (s.invitation) s.invitation.status = 'declined';
    await toClinic(s, 'consent.withdraw', {});
  }
  await savePerson(s);
}

export const HOSPITAL = { en: 'Corniche Hospital, maternity', ar: 'قسم الولادة في مستشفى الكورنيش' };

export async function setBirthPlan(s: PersonState, on: boolean, conditionIds: string[], genes: string[]): Promise<void> {
  if (on && !s.birthPlan?.active) {
    const c = coupleOf(s.id);
    const expires = c?.pregnancyDue ? new Date(new Date(c.pregnancyDue).getTime() + 42 * 864e5).toISOString() : undefined;
    const seq = receipt(s, 'share', { kind: 'birth-plan', gene: genes.join(',') }, 'Corniche Hospital maternity', `${genes.join(', ')} only, this pregnancy`, { expires });
    s.birthPlan = { active: true, hospital: HOSPITAL.en, seq };
    await toClinic(s, 'birthplan.notify', { conditionIds, genes, due: c?.pregnancyDue, hospital: HOSPITAL.en, seq });
  } else if (!on && s.birthPlan?.active) {
    await revoke(s, s.birthPlan.seq);
    return;
  }
  await savePerson(s);
}

export async function shareBrief(s: PersonState): Promise<void> {
  const seq = receipt(s, 'share', { kind: 'brief' }, 'Genetic counsellor', 'teach-back results and questions asked in Silah');
  s.briefShared = new Date().toISOString();
  await toClinic(s, 'brief.packet', {
    seq,
    teachback: s.teachback,
    questions: s.questions.map(q => ({ at: q.at, q: q.q, route: q.route })),
    sharing: activeGrants(s.ledger, new Date()).map(g => ({ kind: g.subject.kind, gene: g.subject.gene, recipient: g.recipient })),
    lang: s.lang,
  });
  await savePerson(s);
}

/** A booking request without a chosen time: the clinic offers its next free slot (kept for the guided story). */
export async function requestBooking(s: PersonState): Promise<void> {
  s.booking = { at: new Date().toISOString(), status: 'requested' };
  await toClinic(s, 'booking', {});
  await savePerson(s);
}

/** Direct booking: the person chose the place, the format, the language and the time. */
export async function bookSlot(s: PersonState, slot: Slot, opts: { format: Format; lang: Lang; summary?: PhysicianSummary }): Promise<void> {
  if (s.booking?.slotId && s.booking.status !== 'cancelled' && s.booking.status !== 'declined') {
    await toClinic(s, 'booking.cancel', { slotId: s.booking.slotId });
  }
  if (opts.summary) await sendSummary(s, opts.summary);
  s.booking = { at: new Date().toISOString(), status: 'requested', slot: slot.start, slotId: slot.id, siteId: slot.siteId, format: opts.format, lang: opts.lang, counsellorId: slot.counsellorId, withSummary: !!opts.summary };
  await toClinic(s, 'booking', { slotId: slot.id, start: slot.start, siteId: slot.siteId, counsellorId: slot.counsellorId, format: opts.format, lang: opts.lang, withSummary: !!opts.summary, urgent: isUrgent(s) });
  await savePerson(s);
}

export async function cancelBooking(s: PersonState): Promise<void> {
  if (!s.booking) return;
  if (s.booking.slotId) await toClinic(s, 'booking.cancel', { slotId: s.booking.slotId });
  s.booking = { ...s.booking, status: 'cancelled', at: new Date().toISOString() };
  await savePerson(s);
}

/** The booked time, sent to the paired partner's phone so both see it. */
export async function shareBookingWithPartner(s: PersonState): Promise<void> {
  if (!s.booking?.slot || !s.pairing || s.pairing.ended) return;
  await pairSend(s, 'booking.shared', { slot: s.booking.slot, siteId: s.booking.siteId, format: s.booking.format });
  await savePerson(s);
}

// ---------- physician summary ----------

/** Send the pre-counselling summary to the counselling clinic, with a signed receipt the person can revoke. */
export async function sendSummary(s: PersonState, summary: PhysicianSummary): Promise<void> {
  const seq = receipt(s, 'share', { kind: 'summary' }, 'Genetic counsellor', 'pre-counselling summary: findings, couple result, chances, understanding check, questions asked');
  s.summaries = [...(s.summaries ?? []), { at: new Date().toISOString(), seq }];
  await toClinic(s, 'summary.packet', { seq, summary });
  await savePerson(s);
}

export function activeSummarySeq(s: PersonState): number | undefined {
  const g = activeGrants(s.ledger, new Date()).find(x => x.subject.kind === 'summary');
  return g ? s.ledger.find(e => e.payload.at === g.at && e.payload.subject.kind === 'summary')?.payload.seq : undefined;
}

// ---------- own result ----------

export interface ImportInput {
  data: Extracted;
  origin: ResultOrigin;
  profile: Profile;
  relationship: CoupleSection['relationship'];
  status: 'at-risk' | 'compatible';
  sharedGenes: string[];
  partnerName?: string;
}

const pctQ = (p?: number) => (p && p > 50 && p <= 100 ? Q.of(Math.round(p * 10), 1000) : undefined);

/**
 * Turn what the person confirmed into the same result bundle a lab would send, unsigned. The kernel then works
 * exactly as for a signed result; the phone labels it "entered by you" everywhere it is shown.
 */
export function bundleFromImport(id: string, coupleId: string, x: ImportInput): Signed<ResultBundle> {
  const hom = new Set(x.data.findings.filter(f => f.zygosity === 'hom' && f.classification !== 'VUS').map(f => f.gene));
  const findings: Finding[] = x.data.findings
    .filter(f => PANEL_SET.has(f.gene) && !hom.has(f.gene))
    .map(f => ({ gene: f.gene, variant: f.variant, classification: f.classification, ...(f.tag ? { tag: f.tag } : {}) }));
  const carrierGenes = findings.filter(isCarrierFinding).map(f => f.gene);
  const shared = x.status === 'at-risk' ? x.sharedGenes.filter(g => carrierGenes.includes(g)) : [];
  const person: PersonResult = {
    personId: id,
    displayName: x.profile.name,
    sex: x.profile.sex,
    findings,
    panelVersion: PANEL_VERSION,
    testedAt: x.data.testedAt ?? new Date().toISOString().slice(0, 10),
    method: 'premarital',
  };
  const panel = pctQ(x.data.detection?.panelPct);
  const exact = pctQ(x.data.detection?.exactPct);
  const negative = carrierGenes.filter(g => !shared.includes(g));
  const couple: CoupleSection = {
    coupleId,
    partnerName: x.partnerName?.trim() || 'your partner',
    relationship: x.relationship,
    status: shared.length ? 'at-risk' : 'compatible',
    shared: shared.map(g => ({ gene: g, ownTag: findings.find(f => f.gene === g)?.tag, partnerTag: x.data.couple?.partnerTags[g] })),
    partnerNegativeFor: negative,
    vusGenes: findings.filter(f => f.classification === 'VUS').map(f => f.gene),
    ...(panel ? { detection: { panel: panel.toJSON(), ...(exact && negative.length ? { exactChange: Object.fromEntries(negative.map(g => [g, exact.toJSON()])) } : {}) } } : {}),
  };
  const payload: ResultBundle = { v: 1, kind: 'silah.result', person, couple, issuer: x.data.lab?.trim() || 'Your report', issuedAt: new Date().toISOString() };
  return { payload, keyId: 'self', sig: '' };
}

/** Start again from a result the person brings. Earlier answers belonged to the earlier result. */
export async function importResult(s: PersonState, x: ImportInput): Promise<void> {
  const hom = x.data.findings.filter(f => f.zygosity === 'hom' && f.classification !== 'VUS').map(f => f.gene);
  s.profile = { ...x.profile, specialistGenes: hom.length ? hom : undefined };
  s.origin = x.origin;
  s.bundles = [bundleFromImport(s.id, coupleIdOf(s)!, x)];
  s.teachback = undefined;
  s.explanations = undefined;
  s.pathway = [];
  push(s, 'result-issued');
  await savePerson(s);
}

/** A Silah result file signed by a lab this phone trusts is used as it is; otherwise it is treated as entered. */
export async function importSigned(s: PersonState, b: Signed<ResultBundle>, profile: Profile): Promise<boolean> {
  const ok = verifySigned(b, await trustedLab());
  s.profile = profile;
  s.origin = ok ? 'lab-signed' : 'uploaded-file';
  s.bundles = [ok ? b : { ...b, keyId: 'self', sig: '' }];
  s.teachback = undefined;
  s.explanations = undefined;
  s.pathway = [];
  push(s, 'result-issued');
  await savePerson(s);
  return ok;
}

export async function forgetOwnResult(s: PersonState): Promise<void> {
  if (s.pairing && !s.pairing.ended) await endPairing(s, true);
  s.bundles = []; s.profile = undefined; s.origin = undefined; s.teachback = undefined; s.explanations = undefined;
  s.pathway = []; s.booking = undefined; s.questions = []; s.received = []; s.summaries = undefined; s.partnerBooking = undefined;
  await savePerson(s);
}

export async function setProfileContext(s: PersonState, ctx: { pregnant?: boolean; weddingSoon?: boolean }): Promise<void> {
  if (!s.profile) return;
  s.profile = { ...s.profile, ...ctx };
  await savePerson(s);
}

// ---------- explanations ----------

export async function saveExplanation(s: PersonState, e: Explanation): Promise<void> {
  s.explanations = { ...(s.explanations ?? {}), [`${e.audience}:${e.lang}`]: e };
  await savePerson(s);
}

// ---------- pairing with the partner's phone ----------

const lastPoll = new Map<string, number>();

export async function startPairing(s: PersonState): Promise<PairSecret> {
  const p = newPairSecret();
  s.pairing = { ...p, me: newPairId(), role: 'host', since: new Date().toISOString(), after: 0, outbox: [] };
  receipt(s, 'consent', { kind: 'pairing', note: 'Paired with the partner’s phone' }, `pair:${p.room}`, 'messages you choose to send, end-to-end encrypted');
  // Saved before the network: the link shows at once, and the hello goes when the relay answers.
  s.pairing.outbox.push({ kind: 'hello', body: { name: nameOf(s) }, at: new Date().toISOString() });
  await savePerson(s);
  await flushPairing(s);
  await savePerson(s);
  return p;
}

export async function joinPairing(s: PersonState, token: string): Promise<boolean> {
  const p = parsePairToken(token);
  if (!p) return false;
  if (s.pairing?.room === p.room && !s.pairing.ended) return true;
  s.pairing = { ...p, me: newPairId(), role: 'guest', since: new Date().toISOString(), after: 0, outbox: [] };
  receipt(s, 'consent', { kind: 'pairing', note: 'Paired with the partner’s phone' }, `pair:${p.room}`, 'messages you choose to send, end-to-end encrypted');
  s.pairing.outbox.push({ kind: 'hello', body: { name: nameOf(s) }, at: new Date().toISOString() });
  await savePerson(s);
  await flushPairing(s);
  await savePerson(s);
  return true;
}

/** Stop the pairing: tell the partner, revoke what was shared through it, and delete the room on the relay. */
export async function endPairing(s: PersonState, revokeConsent = true): Promise<void> {
  const p = s.pairing;
  if (!p || p.ended) return;
  if (revokeConsent) {
    const g = activeGrants(s.ledger, new Date()).filter(x => x.recipient === `pair:${p.room}`);
    for (const x of g) {
      const e = s.ledger.find(l => l.payload.at === x.at && l.payload.recipient === x.recipient && l.payload.subject.kind === x.subject.kind);
      if (e) receipt(s, e.payload.action === 'consent' ? 'withdraw' : 'revoke', e.payload.subject, e.payload.recipient, e.payload.scope, { ref: e.payload.seq });
    }
  }
  await relayPost(p, p.me, { kind: 'bye', from: p.me, at: new Date().toISOString(), body: {} }).catch(() => undefined);
  await relayDelete(p);
  p.ended = new Date().toISOString();
  p.outbox = [];
  await savePerson(s);
}

async function pairSend(s: PersonState, kind: PairKind, body: unknown): Promise<void> {
  if (!s.pairing) return;
  s.pairing.outbox.push({ kind, body, at: new Date().toISOString() });
  await flushPairing(s);
}

async function flushPairing(s: PersonState): Promise<void> {
  const p = s.pairing;
  if (!p) return;
  while (p.outbox.length) {
    const m = p.outbox[0];
    try {
      await relayPost(p, p.me, { kind: m.kind, from: p.me, at: m.at, body: m.body });
      p.outbox.shift();
      p.lastOk = new Date().toISOString();
      p.lastError = undefined;
    } catch (e) {
      p.lastError = String((e as Error).message ?? e);
      return;
    }
  }
}

/** Send what is waiting and read what the partner sent. At most every 3 seconds per phone. */
export async function syncPairing(s: PersonState, force = false): Promise<boolean> {
  const p = s.pairing;
  if (!p || p.ended) return false;
  const now = Date.now();
  if (!force && now - (lastPoll.get(p.room) ?? 0) < 3000) return false;
  lastPoll.set(p.room, now);
  const pending = p.outbox.length;
  await flushPairing(s);
  let changed = pending !== p.outbox.length;
  try {
    const { last, messages, closed } = await relayPoll(p, p.after);
    if (last !== p.after) changed = true;
    if (closed && !messages.some(m => m.kind === 'bye')) {
      // The partner ended the link and the relay already deleted the messages.
      p.ended = new Date().toISOString();
      s.received = s.received.map(r => (r.from.startsWith('pair:') ? { ...r, revoked: true } : r));
      return true;
    }
    p.after = last;
    p.lastOk = new Date().toISOString();
    for (const m of messages) {
      if (m.from === p.me) continue;
      const b = m.body as any;
      changed = true;
      switch (m.kind) {
        case 'hello':
          // Both phones say hello when the pairing starts, so each learns the other's name.
          p.partner = { name: String(b?.name ?? '').slice(0, 80), at: m.at };
          break;
        case 'share.finding':
          if (typeof b?.gene === 'string' && PANEL_SET.has(b.gene)) {
            s.received.push({ from: `pair:${m.from}`, fromName: String(b.fromName ?? '').slice(0, 80), gene: b.gene, variant: typeof b.variant === 'string' ? b.variant.slice(0, 80) : undefined, at: m.at, seq: Number(b.seq) });
          }
          break;
        case 'share.revoke':
          s.received = s.received.map(r => (r.from === `pair:${m.from}` && r.seq === Number(b?.ref) ? { ...r, revoked: true } : r));
          break;
        case 'booking.shared':
          if (typeof b?.slot === 'string') s.partnerBooking = { at: m.at, slot: b.slot, siteId: b.siteId, format: b.format };
          break;
        case 'bye':
          p.ended = m.at;
          s.received = s.received.map(r => (r.from === `pair:${m.from}` ? { ...r, revoked: true } : r));
          break;
      }
    }
  } catch (e) {
    p.lastError = String((e as Error).message ?? e);
  }
  return changed;
}

export const escalationRef = (id: string) => `${id}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Tell the clinic that this person needs a human. The phone records it as sent; the clinic's receipt and a
 *  counsellor's acknowledgement come back as messages, and only then does the screen say so. */
export async function escalate(s: PersonState, route: Route, ref = escalationRef(s.id)): Promise<void> {
  const at = new Date().toISOString();
  s.escalations = [...(s.escalations ?? []), { ref, at, route }];
  await toClinic(s, 'escalate', { route, ref });
  await savePerson(s);
}

export async function askForInvites(s: PersonState, n: number): Promise<void> {
  const t = await dbGet<{ spki: string }>('keys', 'trust:clinic-rsa');
  if (!t) return;
  const pk = await importPublicKey(t.spki);
  const { pending, blinded } = await requestInvites(pk, n);
  s.invites.pending = pending.map(p => ({ prepared: b64url(p.prepared), inv: b64url(p.inv) }));
  s.invites.requested += n;
  const seq = receipt(s, 'consent', { kind: 'invitation', note: `${n} anonymous invitations` }, 'DoH genomics service', 'blinded requests only; the clinic cannot link invitations to you');
  // The pseudonym limits how many invitations one person can request; it is not attached to any token.
  await send(owner(s.id), 'clinic', 'invite.request', { pseudonym: s.kp.keyId, blinded, seq });
  await savePerson(s);
}

export async function recordQuestion(s: PersonState, q: Question): Promise<void> {
  s.questions.push(q);
  await savePerson(s);
}

export async function setLang(s: PersonState, lang: Lang): Promise<void> {
  s.lang = lang;
  await savePerson(s);
}

export async function setBig(s: PersonState, big: boolean): Promise<void> {
  s.big = big;
  await savePerson(s);
}

export async function setDigits(s: PersonState, d: 'latn' | 'arab'): Promise<void> {
  s.digits = d;
  await savePerson(s);
}
