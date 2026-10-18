import type { Lang, ResultBundle, Signed } from '../core/types';
import type { Route } from '../core/routes';
import { b64url, fromB64url, generateKeyPair, verifySigned, type KeyPair } from '../core/crypto/sign';
import { appendReceipt, activeGrants, type LedgerEntry, type ReceiptSubject } from '../core/crypto/receipts';
import { finalizeInvites, importPublicKey, requestInvites } from '../core/crypto/invites';
import { coupleView, isCarrierFinding, type CoupleView } from '../core/kernel';
import { vaultLoad, vaultSave } from './vault';
import { dbGet } from './db';
import { inbox, send, type Msg } from './net';
import { demoCouples, personaById } from './demo';

// Everything that happens on one person's phone. State lives encrypted in the vault.

export type PathState = 'result-issued' | 'notified' | 'understood' | 'counselling-booked' | 'counselled' | 'confirmatory' | 'referred' | 'closed';

export interface Teachback { at: string; correct: number; total: number; missed: string[] }
export interface Question { at: string; q: string; route: Route; cards: string[]; via: 'faq' | 'model' | 'route' | 'none' }
export interface Received { from: string; fromName: string; gene: string; variant?: string; at: string; seq: number; revoked?: boolean }

export interface PersonState {
  id: string;
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
  booking?: { at: string; status: 'requested' | 'confirmed'; slot?: string };
  briefShared?: string;
  pathway: { state: PathState; at: string; note?: string }[];
  seen: string[];
}

const owner = (id: string) => `p:${id}`;
export const address = owner;

const kpOf = (s: PersonState): KeyPair => ({ secretKey: fromB64url(s.kp.sk), publicKey: fromB64url(s.kp.pk), keyId: s.kp.keyId });

export async function loadPerson(id: string): Promise<PersonState> {
  const s = await vaultLoad<PersonState>(owner(id));
  if (s) return s;
  const kp = generateKeyPair();
  const fresh: PersonState = {
    id,
    lang: personaById(id)?.lang ?? 'ar',
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
  return coupleView(b.payload.person, b.payload.couple);
}

export async function bundleVerified(s: PersonState): Promise<boolean> {
  const b = currentBundle(s);
  return !!b && verifySigned(b, await trustedLab());
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
  const msgs = (await inbox(owner(s.id))).filter(m => !s.seen.includes(m.id));
  if (!msgs.length) return false;
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
    case 'pathway.update':
      push(s, body.state as PathState, body.note);
      if (body.state === 'counselling-booked' && body.slot) s.booking = { at: m.at, status: 'confirmed', slot: body.slot };
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
  const c = coupleOf(s.id);
  await send(owner(s.id), 'clinic', 'pathway.update', { coupleId: c?.id, personId: s.id, state: 'notified' });
  await savePerson(s);
}

export async function recordTeachback(s: PersonState, t: Teachback): Promise<void> {
  s.teachback = t;
  if (t.correct === t.total) push(s, 'understood');
  await savePerson(s);
}

export async function shareFinding(s: PersonState, gene: string): Promise<void> {
  const partner = partnerOf(s.id);
  const b = currentBundle(s);
  const f = b?.payload.person.findings.find(x => x.gene === gene && isCarrierFinding(x));
  if (!partner || !f) return;
  const seq = receipt(s, 'share', { kind: 'finding', gene }, owner(partner), `${gene} carrier status only`);
  await send(owner(s.id), owner(partner), 'share.finding', { fromName: personaById(s.id)?.name, gene, variant: f.variant, seq });
  await savePerson(s);
}

export async function revoke(s: PersonState, seq: number): Promise<void> {
  const r = s.ledger.find(e => e.payload.seq === seq)?.payload;
  if (!r) return;
  receipt(s, r.action === 'consent' ? 'withdraw' : 'revoke', r.subject, r.recipient, r.scope, { ref: seq });
  if (r.subject.kind === 'finding') await send(owner(s.id), r.recipient, 'share.revoke', { ref: seq });
  if (r.subject.kind === 'birth-plan') {
    s.birthPlan = s.birthPlan ? { ...s.birthPlan, active: false } : undefined;
    await send(owner(s.id), 'clinic', 'birthplan.revoke', { coupleId: coupleOf(s.id)?.id, personId: s.id });
  }
  if (r.subject.kind === 'brief') s.briefShared = undefined;
  await savePerson(s);
}

export const HOSPITAL = { en: 'Corniche Hospital, maternity', ar: 'مستشفى الكورنيش، قسم الولادة' };

export async function setBirthPlan(s: PersonState, on: boolean, conditionIds: string[], genes: string[]): Promise<void> {
  if (on && !s.birthPlan?.active) {
    const c = coupleOf(s.id);
    const expires = c?.pregnancyDue ? new Date(new Date(c.pregnancyDue).getTime() + 42 * 864e5).toISOString() : undefined;
    const seq = receipt(s, 'share', { kind: 'birth-plan', gene: genes.join(',') }, 'Corniche Hospital maternity', `${genes.join(', ')} only, this pregnancy`, { expires });
    s.birthPlan = { active: true, hospital: HOSPITAL.en, seq };
    await send(owner(s.id), 'clinic', 'birthplan.notify', { coupleId: c?.id, personId: s.id, conditionIds, genes, due: c?.pregnancyDue, hospital: HOSPITAL.en, seq });
  } else if (!on && s.birthPlan?.active) {
    await revoke(s, s.birthPlan.seq);
    return;
  }
  await savePerson(s);
}

export async function shareBrief(s: PersonState): Promise<void> {
  const c = coupleOf(s.id);
  const seq = receipt(s, 'share', { kind: 'brief' }, 'Genetic counsellor', 'teach-back results and questions asked in Silah');
  s.briefShared = new Date().toISOString();
  await send(owner(s.id), 'clinic', 'brief.packet', {
    coupleId: c?.id,
    personId: s.id,
    seq,
    teachback: s.teachback,
    questions: s.questions.map(q => ({ at: q.at, q: q.q, route: q.route })),
    sharing: activeGrants(s.ledger, new Date()).map(g => ({ kind: g.subject.kind, gene: g.subject.gene, recipient: g.recipient })),
    lang: s.lang,
  });
  await savePerson(s);
}

export async function requestBooking(s: PersonState): Promise<void> {
  s.booking = { at: new Date().toISOString(), status: 'requested' };
  await send(owner(s.id), 'clinic', 'booking', { coupleId: coupleOf(s.id)?.id, personId: s.id });
  await savePerson(s);
}

export async function escalate(s: PersonState, route: Route): Promise<void> {
  await send(owner(s.id), 'clinic', 'escalate', { coupleId: coupleOf(s.id)?.id, personId: s.id, route });
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

export async function setDigits(s: PersonState, d: 'latn' | 'arab'): Promise<void> {
  s.digits = d;
  await savePerson(s);
}
