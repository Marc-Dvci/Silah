import type { PersonResult, ResultBundle, Signed } from '../core/types';
import { b64url, fromB64url, generateKeyPair, signPayload, type KeyPair } from '../core/crypto/sign';
import { clinicKeygen, exportPublicKey, InviteIssuer, InviteRedeemer } from '../core/crypto/invites';
import { labCouple, SIMULATED_LAB } from '../core/kernel';
import { PANEL_VERSION } from '../core/data/panel';
import { dbGet, dbPut } from './db';
import { allMessages, send, type Msg } from './net';
import { BACKGROUND_CASES, demoCouples, OUTREACH_REGISTER, personaById, type DemoCouple } from './demo';
import type { PathState, Teachback } from './person';
import type { PhysicianSummary } from '../core/summary-types';
import { parseSlotId } from '../core/booking';

// The simulated health-system side: the genomics lab, the counselling service, the delivery
// hospital and the invitation service. Labelled "simulated" everywhere it appears in the UI.

export const PATH: PathState[] = ['result-issued', 'notified', 'understood', 'counselling-booked', 'counselled', 'confirmatory', 'referred', 'closed'];

export const PATH_OWNER: Record<PathState, string> = {
  'result-issued': 'Genomics lab',
  'notified': 'Premarital screening centre',
  'understood': 'Silah (teach-back)',
  'counselling-booked': 'Genetic counselling clinic',
  'counselled': 'Genetic counsellor',
  'confirmatory': 'Clinical geneticist',
  'referred': 'Reproductive genomics / hospital',
  'closed': 'Genetic counsellor',
};

/** Who holds the case at a step. An EGP re-check result reaches a married couple through Silah, not a premarital centre. */
export const pathOwner = (k: Pick<Case, 'source'>, s: PathState): string =>
  s === 'notified' && k.source === 'egp-recheck' ? 'DoH genomics service, via Silah' : PATH_OWNER[s];

export type Referral = 'pgt' | 'prenatal' | 'birth-plan' | 'committee' | 'no-action-chosen';

export interface BriefPacket {
  personId: string;
  at: string;
  teachback?: Teachback;
  questions: { at: string; q: string; route: string }[];
  sharing: { kind: string; gene?: string; recipient: string }[];
  lang: string;
}

export interface Case {
  id: string;
  names: [string, string];
  personIds?: [string, string];
  status: 'at-risk' | 'compatible';
  genes: string[];
  source: 'premarital' | 'egp-recheck' | 'self-upload';
  state: PathState;
  /** Pre-counselling summaries the couple chose to send (one per person, newest kept). */
  summaries?: { personId: string; at: string; summary: PhysicianSummary }[];
  /** For a self-upload: how the result reached Silah (PDF, FHIR file, typed). Not verified by a lab. */
  origin?: string;
  /** The condition for each shared gene, when the phone knows the allele classes (HbS with beta-plus, for example). */
  conditionIds?: string[];
  events: { at: string; state: PathState; by: string; note?: string }[];
  flags: string[];
  due?: string;
  planning?: boolean;
  briefs: BriefPacket[];
  referral?: Referral;
  closeReason?: string;
  demo?: boolean;
  createdAt: string;
}

export interface Birth {
  coupleId: string; personId: string; name: string; genes: string[]; conditionIds: string[]; due?: string; at: string; active: boolean;
  /** The targeted newborn test. Only affected / not affected is reported; a child's carrier status is not. */
  outcome?: { at: string; born?: string; affected: boolean; note: string };
}

export interface ClinicState {
  lab: { sk: string; pk: string; keyId: string };
  rsaSpki: string;
  cases: Case[];
  outreach: { sent: string[]; consents: Record<string, string[]>; at?: string };
  issuerLog: InviteIssuer['log'];
  redeemLog: InviteRedeemer['log'];
  births: Birth[];
  /** Requests for a person, from any phone, whether or not the couple has a case. */
  escalations?: EscalationEntry[];
  /** Counselling appointments booked directly from a phone. */
  appointments?: Appointment[];
  seen: string[];
}

export interface Appointment {
  slotId: string; siteId: string; counsellorId: string; start: string; format: string; lang: string;
  coupleId?: string; personId: string; name: string; withSummary: boolean; urgent: boolean; at: string;
  status: 'booked' | 'cancelled';
}

export interface EscalationEntry { ref: string; from: string; personId: string; name: string; coupleId?: string; route: string; at: string; seenAt?: string }

const daysAgo = (d: number) => new Date(Date.now() - d * 864e5).toISOString();

export async function loadClinic(): Promise<ClinicState | undefined> {
  return dbGet<ClinicState>('clinic', 'state');
}
export const saveClinic = (c: ClinicState) => dbPut('clinic', 'state', c);
const rsaKeys = () => dbGet<{ publicKey: CryptoKey; privateKey: CryptoKey }>('clinic', 'rsa');

const labKp = (c: ClinicState): KeyPair => ({ secretKey: fromB64url(c.lab.sk), publicKey: fromB64url(c.lab.pk), keyId: c.lab.keyId });

function personResult(id: string, method: PersonResult['method'], testedAt: string): PersonResult {
  const p = personaById(id)!;
  return { personId: id, displayName: p.name.en, sex: p.sex, findings: p.genome, panelVersion: PANEL_VERSION, testedAt, method };
}

/** Run the couple check and send each partner a signed bundle. Used for premarital results and EGP re-checks. */
async function issueCouple(c: ClinicState, dc: DemoCouple, method: PersonResult['method'], testedAt: string): Promise<Case> {
  const a = personResult(dc.a, method, testedAt);
  const b = personResult(dc.b, method, testedAt);
  const [forA, forB] = labCouple(a, b, dc.rel, dc.id, SIMULATED_LAB);
  const issuer = method === 'premarital' ? 'Simulated premarital genomics lab' : 'Simulated EGP genomics service';
  for (const [person, couple, to] of [[a, forA, dc.a], [b, forB, dc.b]] as const) {
    const bundle: ResultBundle = { v: 1, kind: 'silah.result', person, couple, issuer, issuedAt: testedAt };
    const signed: Signed<ResultBundle> = signPayload(bundle, labKp(c));
    await send('lab', `p:${to}`, 'result.bundle', signed);
  }
  const shared = forA.shared.map(s => s.gene);
  const kase: Case = {
    id: dc.id,
    names: [personaById(dc.a)!.name.en, personaById(dc.b)!.name.en],
    personIds: [dc.a, dc.b],
    status: forA.status,
    genes: shared,
    source: method,
    state: 'result-issued',
    events: [{ at: testedAt, state: 'result-issued', by: PATH_OWNER['result-issued'] }],
    flags: [...(forA.vusGenes.length ? ['vus'] : []), ...(dc.pregnancyDue ? ['pregnancy'] : []), ...(dc.planningPregnancy ? ['planning'] : [])],
    due: dc.pregnancyDue,
    planning: dc.planningPregnancy,
    briefs: [],
    demo: true,
    createdAt: testedAt,
  };
  return kase;
}

export function advance(k: Case, state: PathState, by = PATH_OWNER[state], note?: string, at = new Date().toISOString()) {
  if (PATH.indexOf(state) <= PATH.indexOf(k.state) && state !== k.state) return;
  if (k.events.some(e => e.state === state)) return;
  k.state = state;
  k.events.push({ at, state, by, note });
}

/** Fresh demo world: keys, background cases, premarital results already issued. */
export async function seedClinic(): Promise<ClinicState> {
  const lab = generateKeyPair();
  const rsa = await clinicKeygen();
  await dbPut('clinic', 'rsa', rsa);
  const rsaSpki = await exportPublicKey(rsa.publicKey);
  await dbPut('keys', 'trust:lab', { keyId: lab.keyId, pk: b64url(lab.publicKey) });
  await dbPut('keys', 'trust:clinic-rsa', { spki: rsaSpki });

  const c: ClinicState = {
    lab: { sk: b64url(lab.secretKey), pk: b64url(lab.publicKey), keyId: lab.keyId },
    rsaSpki,
    cases: [],
    outreach: { sent: [], consents: {} },
    issuerLog: [],
    redeemLog: [],
    births: [],
    seen: [],
  };

  // Background cases, so the queue reflects a working week.
  BACKGROUND_CASES.forEach((b, i) => {
    const created = daysAgo(b.waitingDays);
    const k: Case = {
      id: `C-2026-${String(100 + i * 37).padStart(4, '0')}`,
      names: b.names,
      status: b.status,
      genes: b.gene ? [b.gene] : [],
      source: 'premarital',
      state: 'result-issued',
      events: [{ at: created, state: 'result-issued', by: PATH_OWNER['result-issued'] }],
      flags: b.flags,
      briefs: [],
      createdAt: created,
    };
    const target = PATH.indexOf(b.state as PathState);
    for (let s = 1; s <= target; s++) advance(k, PATH[s], undefined, undefined, daysAgo(Math.max(0, b.waitingDays - s * 2)));
    if (b.state === 'referred') k.referral = 'pgt';
    if (b.state === 'closed') { k.referral = 'prenatal'; k.closeReason = 'Referral completed'; }
    c.cases.push(k);
  });

  // Premarital couples tested in 2026.
  for (const dc of demoCouples().filter(d => d.source === 'premarital')) {
    const testedAt = dc.a === 'noura' ? '2026-02-11' : '2026-09-28';
    const k = await issueCouple(c, dc, 'premarital', testedAt);
    if (k.status === 'at-risk') {
      // Noura and Khalid were counselled before their wedding and chose a natural pregnancy.
      advance(k, 'notified', undefined, undefined, '2026-02-12');
      advance(k, 'counselling-booked', undefined, undefined, '2026-02-15');
      advance(k, 'counselled', undefined, 'Options discussed; couple chose a natural pregnancy', '2026-02-24');
      c.cases.push(k);
    }
  }
  await saveClinic(c);
  return c;
}

// ---------- the service loop ----------

export async function syncClinic(c: ClinicState): Promise<boolean> {
  const msgs = (await allMessages()).filter(m => m.to === 'clinic' && !c.seen.includes(m.id));
  if (!msgs.length) return false;
  for (const m of msgs) {
    c.seen.push(m.id);
    await handle(c, m);
  }
  await saveClinic(c);
  return true;
}

const findCase = (c: ClinicState, id?: string) => c.cases.find(k => k.id === id);

/** Someone who brought their own result has no case until their phone first contacts the clinic. */
function ownCaseFor(c: ClinicState, b: any): Case | undefined {
  const o = b?.own;
  if (!o || !b.coupleId || typeof b.coupleId !== 'string' || !b.coupleId.startsWith('own-')) return undefined;
  let k = findCase(c, b.coupleId);
  const now = new Date().toISOString();
  if (!k) {
    k = {
      id: b.coupleId,
      names: [String(o.names?.[0] ?? 'Self-referred'), String(o.names?.[1] ?? 'partner')],
      personIds: [b.personId, b.personId],
      status: o.status === 'at-risk' ? 'at-risk' : 'compatible',
      genes: Array.isArray(o.genes) ? o.genes.map(String) : [],
      conditionIds: Array.isArray(o.conditionIds) ? o.conditionIds.map(String) : undefined,
      source: 'self-upload',
      origin: String(o.origin ?? 'manual'),
      state: 'result-issued',
      events: [{ at: now, state: 'result-issued', by: 'The person, through Silah', note: `Result brought by the person (${o.origin ?? 'typed'}); the original report is to be checked at the visit` }],
      flags: Array.isArray(o.flags) ? o.flags.map(String) : [],
      briefs: [],
      createdAt: now,
    };
    c.cases.push(k);
  } else {
    // The person may have re-entered the result or told Silah about a pregnancy since.
    k.status = o.status === 'at-risk' ? 'at-risk' : 'compatible';
    k.genes = Array.isArray(o.genes) ? o.genes.map(String) : k.genes;
    if (Array.isArray(o.conditionIds)) k.conditionIds = o.conditionIds.map(String);
    for (const f of o.flags ?? []) if (!k.flags.includes(f)) k.flags.push(f);
  }
  return k;
}
const caseOf = (c: ClinicState, id?: string, b?: any) => findCase(c, id) ?? (b ? ownCaseFor(c, b) : undefined);

async function handle(c: ClinicState, m: Msg): Promise<void> {
  const b = m.body as any;
  if (b?.own) ownCaseFor(c, b);
  switch (m.kind) {
    case 'consent.couple-check': {
      const list = (c.outreach.consents[b.coupleId] ??= []);
      if (!list.includes(b.personId)) list.push(b.personId);
      const dc = demoCouples().find(d => d.id === b.coupleId);
      if (dc && list.includes(dc.a) && list.includes(dc.b) && !caseOf(c, dc.id)) {
        const k = await issueCouple(c, dc, 'egp-recheck', new Date().toISOString());
        if (k.status === 'at-risk') c.cases.push(k);
      }
      break;
    }
    case 'pathway.update': {
      const k = caseOf(c, b.coupleId);
      if (k && b.state === 'notified') advance(k, 'notified', `${personaById(b.personId)?.name.en} opened the result in Silah`);
      break;
    }
    case 'brief.packet': {
      const k = caseOf(c, b.coupleId);
      if (!k) break;
      k.briefs = k.briefs.filter(x => x.personId !== b.personId);
      k.briefs.push({ personId: b.personId, at: m.at, teachback: b.teachback, questions: b.questions, sharing: b.sharing, lang: b.lang });
      if (b.teachback && b.teachback.correct === b.teachback.total) advance(k, 'understood', 'Silah (teach-back)', 'All key points explained back correctly');
      break;
    }
    case 'booking': {
      const k = caseOf(c, b.coupleId);
      const list = (c.appointments ??= []);
      if (b.slotId) {
        // Direct booking: the slot must exist in the timetable and still be free.
        const s = parseSlotId(String(b.slotId));
        const taken = list.some(a => a.slotId === b.slotId && a.status === 'booked' && a.personId !== b.personId);
        if (!s || taken || new Date(s.start).getTime() < Date.now()) {
          await send('clinic', m.from, 'booking.declined', { slotId: b.slotId, reason: taken ? 'taken' : 'unavailable' });
          break;
        }
        for (const a of list) if (a.personId === b.personId && a.status === 'booked') a.status = 'cancelled';
        list.push({
          slotId: s.id, siteId: s.siteId, counsellorId: s.counsellorId, start: s.start, format: String(b.format ?? 'in-person'), lang: String(b.lang ?? 'ar'),
          coupleId: b.coupleId, personId: b.personId, name: personaById(b.personId)?.name.en ?? k?.names[0] ?? b.personId,
          withSummary: !!b.withSummary, urgent: !!b.urgent, at: m.at, status: 'booked',
        });
        if (k) advance(k, 'counselling-booked', undefined, `Booked by the person: ${s.start.slice(0, 16).replace('T', ' ')} UTC, ${b.format ?? 'in person'}`);
        await send('clinic', m.from, 'pathway.update', { state: 'counselling-booked', slot: s.start, slotId: s.id, booking: { siteId: s.siteId, counsellorId: s.counsellorId, format: b.format, lang: b.lang } });
        break;
      }
      if (!k) break;
      advance(k, 'counselling-booked');
      const slot = nextSlot(k);
      list.push({ slotId: `auto-${k.id}-${slot}`, siteId: 'corniche-fmu', counsellorId: 'fmu-1', start: slot, format: 'in-person', lang: 'ar', coupleId: k.id, personId: b.personId, name: personaById(b.personId)?.name.en ?? b.personId, withSummary: false, urgent: false, at: m.at, status: 'booked' });
      await send('clinic', m.from, 'pathway.update', { state: 'counselling-booked', slot, booking: { siteId: 'corniche-fmu', format: 'in-person' } });
      break;
    }
    case 'booking.cancel': {
      for (const a of c.appointments ?? []) if (a.slotId === b.slotId && a.personId === b.personId) a.status = 'cancelled';
      break;
    }
    case 'summary.packet': {
      const k = caseOf(c, b.coupleId);
      if (!k || !b.summary) break;
      k.summaries = [...(k.summaries ?? []).filter(x => x.personId !== b.personId), { personId: b.personId, at: m.at, summary: b.summary as PhysicianSummary }];
      if (!k.flags.includes('summary')) k.flags.push('summary');
      break;
    }
    case 'summary.revoke': {
      const k = caseOf(c, b.coupleId);
      if (k) k.summaries = (k.summaries ?? []).filter(x => x.personId !== b.personId);
      break;
    }
    case 'escalate': {
      // Every request is kept and acknowledged, including from a couple with no open case.
      (c.escalations ??= []).push({ ref: b.ref, from: m.from, personId: b.personId, name: personaById(b.personId)?.name.en ?? b.personId, coupleId: b.coupleId, route: b.route, at: m.at });
      if (b.ref) await send('clinic', m.from, 'escalate.received', { ref: b.ref });
      const k = caseOf(c, b.coupleId);
      if (!k) break;
      const flag = b.route === 'distress' ? 'distress' : 'asked-for-human';
      if (!k.flags.includes(flag)) k.flags.push(flag);
      break;
    }
    case 'birthplan.notify': {
      c.births = c.births.filter(x => !(x.coupleId === b.coupleId && x.personId === b.personId));
      c.births.push({ coupleId: b.coupleId, personId: b.personId, name: personaById(b.personId)?.name.en ?? b.personId, genes: b.genes, conditionIds: b.conditionIds, due: b.due, at: m.at, active: true });
      const k = caseOf(c, b.coupleId);
      if (k) {
        k.referral = 'birth-plan';
        if (!k.flags.includes('birth-plan')) k.flags.push('birth-plan');
        advance(k, 'referred', 'Corniche Hospital maternity', 'Birth plan shared by the couple: targeted newborn test');
      }
      break;
    }
    case 'brief.revoke': {
      const k = caseOf(c, b.coupleId);
      if (k) k.briefs = k.briefs.filter(x => x.personId !== b.personId);
      break;
    }
    case 'consent.withdraw': {
      c.outreach.consents[b.coupleId] = (c.outreach.consents[b.coupleId] ?? []).filter(x => x !== b.personId);
      const k = caseOf(c, b.coupleId);
      if (k && !k.flags.includes('consent-withdrawn')) k.flags.push('consent-withdrawn');
      break;
    }
    case 'birthplan.revoke':
      c.births = c.births.map(x => (x.coupleId === b.coupleId && x.personId === b.personId ? { ...x, active: false } : x));
      break;
    case 'invite.request': {
      const keys = await rsaKeys();
      if (!keys) break;
      const issuer = InviteIssuer.restore(keys, { maxPerRequester: 10 }, c.issuerLog);
      try {
        const blindSigs = await issuer.issue(b.pseudonym, b.blinded);
        c.issuerLog = issuer.log;
        await send('clinic', m.from, 'invite.issued', { blindSigs, publicKey: c.rsaSpki });
      } catch {
        await send('clinic', m.from, 'invite.issued', { error: 'cap', blindSigs: [], publicKey: c.rsaSpki });
      }
      break;
    }
    case 'invite.redeem': {
      const keys = await rsaKeys();
      if (!keys) break;
      const r = InviteRedeemer.restore(keys.publicKey, c.redeemLog);
      const outcome = await r.redeem(b.token);
      c.redeemLog = r.log;
      await send('clinic', m.from, 'pathway.update', { state: 'invite', outcome });
      break;
    }
  }
}

function nextSlot(k: Case): string {
  // The counselling clinic offers the next free morning; urgent cases get the next day.
  const urgent = k.flags.some(f => f === 'distress' || f === 'pregnancy');
  const d = new Date(Date.now() + (urgent ? 1 : 3) * 864e5);
  d.setHours(urgent ? 9 : 10, 30, 0, 0);
  return d.toISOString();
}

// ---------- counsellor actions ----------

/** A counsellor has seen a request for a person. Only this makes the phone say so. */
export async function markEscalationSeen(c: ClinicState, ref: string): Promise<void> {
  const e = c.escalations?.find(x => x.ref === ref);
  if (!e || e.seenAt) return;
  e.seenAt = new Date().toISOString();
  await send('clinic', e.from, 'escalate.seen', { ref });
  await saveClinic(c);
}

export async function counsellorAdvance(c: ClinicState, caseId: string, state: PathState, extra: { referral?: Referral; note?: string; closeReason?: string } = {}): Promise<void> {
  const k = caseOf(c, caseId);
  if (!k) return;
  advance(k, state, undefined, extra.note);
  if (extra.referral) k.referral = extra.referral;
  if (extra.closeReason) k.closeReason = extra.closeReason;
  for (const pid of k.personIds ?? []) await send('clinic', `p:${pid}`, 'pathway.update', { state, note: extra.note });
  await saveClinic(c);
}

/** Maternity records the targeted newborn test; the pathway closes or moves to treatment, and the parents are told. */
export async function recordNewborn(c: ClinicState, coupleId: string, affected: boolean): Promise<void> {
  const b = c.births.find(x => x.coupleId === coupleId && x.active);
  const k = caseOf(c, coupleId);
  if (!b) return;
  const genes = b.genes.join(', ');
  const note = affected
    ? `Newborn test on day 2 confirmed ${genes}. Referred the same week to the treating team, before any symptoms.`
    : `Newborn test on day 2: not affected for ${genes}. Carrier status of the child is not tested or reported.`;
  // The demo moves the clock to the birth: a pregnancy still due is born on its due date, tested on day 2.
  const born = b.due && new Date(b.due).getTime() > Date.now() ? new Date(b.due) : new Date();
  const at = new Date(born.getTime() + 864e5).toISOString();
  b.outcome = { at, born: born.toISOString(), affected, note };
  if (k) {
    if (affected) { k.events.push({ at, state: 'referred', by: 'Corniche Hospital maternity', note }); if (!k.flags.includes('newborn-treatment')) k.flags.push('newborn-treatment'); }
    else { advance(k, 'closed', 'Corniche Hospital maternity', note, at); k.closeReason = 'Newborn not affected; pathway complete'; }
  }
  for (const pid of k?.personIds ?? [b.personId]) {
    await send('clinic', `p:${pid}`, 'pathway.update', { state: affected ? 'referred' : 'closed', note, birth: { at, affected, genes: b.genes, note } });
  }
  await saveClinic(c);
}

export async function sendOutreach(c: ClinicState, ids: string[]): Promise<void> {
  for (const id of ids) {
    if (c.outreach.sent.includes(id)) continue;
    c.outreach.sent.push(id);
    const dc = demoCouples().find(d => d.id === id);
    if (!dc) continue;   // register-only couples have no device in the demo
    for (const [me, other] of [[dc.a, dc.b], [dc.b, dc.a]]) {
      await send('clinic', `p:${me}`, 'invite.couple-check', { coupleId: dc.id, partner: personaById(other)?.name.en });
    }
  }
  c.outreach.at = new Date().toISOString();
  await saveClinic(c);
}

/** Urgency score for the queue: pregnancy and distress first, then waiting time. */
export function urgency(k: Case, births: Birth[]): number {
  let s = 0;
  if (k.flags.includes('distress')) s += 100;
  if (k.flags.includes('asked-for-human')) s += 40;
  if (k.due) {
    const weeks = (new Date(k.due).getTime() - Date.now()) / (7 * 864e5);
    s += Math.max(0, 60 - weeks * 4);
  }
  if (k.flags.includes('pregnancy')) s += 20;
  if (k.flags.includes('wedding-date')) s += 25;
  if (k.flags.includes('planning')) s += 15;
  if (k.flags.includes('vus')) s += 10;
  if (births.some(b => b.coupleId === k.id && b.active)) s += 10;
  s += Math.min(30, (Date.now() - new Date(k.createdAt).getTime()) / 864e5);
  if (k.state === 'closed') s -= 1000;
  if (k.state === 'referred') s -= 200;
  return s;
}

export function referralKpi(c: ClinicState): { referred: number; total: number } {
  const atRisk = c.cases.filter(k => k.status === 'at-risk');
  const ref = atRisk.filter(k => PATH.indexOf(k.state) >= PATH.indexOf('counselling-booked'));
  return { referred: ref.length, total: atRisk.length };
}

export { OUTREACH_REGISTER };
