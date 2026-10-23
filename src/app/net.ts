import { dbAll, dbPut } from './db';

// The demo network. In the prototype the person's phone, the partner's phone and the clinic run
// in one browser, so messages go through IndexedDB and a BroadcastChannel. In a deployment the
// same messages would travel as QR codes, files or an HTTPS API; each one is already self-contained.

export type MsgKind =
  | 'invite.couple-check'      // clinic → person: an invitation to a couple check on existing genomes
  | 'consent.couple-check'     // person → clinic
  | 'result.bundle'            // clinic/lab → person: a signed result bundle
  | 'share.finding'            // person → partner: a finding the person chose to share
  | 'share.revoke'             // person → recipient
  | 'brief.packet'             // person → clinic: teach-back results and questions, with consent
  | 'brief.revoke'             // person → clinic: delete the summary
  | 'consent.withdraw'         // person → clinic: withdraw consent to the couple check
  | 'birthplan.notify'         // person → clinic (delivery hospital)
  | 'birthplan.revoke'
  | 'invite.request'           // person → clinic: blinded invitation requests
  | 'invite.issued'            // clinic → person: blind signatures
  | 'invite.redeem'            // relative → clinic
  | 'escalate'                 // person → clinic: a hard route or the person asked for a human
  | 'escalate.received'        // clinic → person: the request reached the clinic's list
  | 'escalate.seen'            // clinic → person: a counsellor marked it seen
  | 'booking'                  // person → clinic: counselling appointment request
  | 'pathway.update';          // clinic → person

export interface Msg<B = unknown> { id: string; kind: MsgKind; from: string; to: string; at: string; body: B; done?: boolean }

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('silah-net') : null;
const listeners = new Set<() => void>();
channel?.addEventListener('message', () => listeners.forEach(f => f()));

export function onNet(f: () => void): () => void {
  listeners.add(f);
  return () => listeners.delete(f);
}

const uid = () => crypto.randomUUID();

export async function send<B>(from: string, to: string, kind: MsgKind, body: B): Promise<Msg<B>> {
  const m: Msg<B> = { id: uid(), kind, from, to, at: new Date().toISOString(), body };
  await dbPut('net', m.id, m);
  channel?.postMessage(m.id);
  listeners.forEach(f => f());
  return m;
}

export async function inbox(to: string, kind?: MsgKind): Promise<Msg[]> {
  const all = await dbAll<Msg>('net');
  return all.filter(m => m.to === to && (!kind || m.kind === kind)).sort((a, b) => a.at.localeCompare(b.at));
}

export async function markDone(m: Msg): Promise<void> {
  await dbPut('net', m.id, { ...m, done: true });
}

export async function allMessages(): Promise<Msg[]> {
  return (await dbAll<Msg>('net')).sort((a, b) => a.at.localeCompare(b.at));
}
