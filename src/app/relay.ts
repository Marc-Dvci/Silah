import { open, seal, type PairMessage, type PairSecret } from '../core/crypto/pairing';

// The relay that carries paired phones' encrypted messages, and the opt-in explanation service.
// Source in relay/. It stores ciphertext only and deletes a room after 30 days or when a partner ends it.

// One setting, also read by vite.config.ts to allow this origin (and only it) in the page's CSP.
import RELAY from './relay-url.json';
export const RELAY_URL: string = (import.meta as any).env?.VITE_RELAY_URL ?? RELAY.url;

const j = async (r: Response) => {
  if (!r.ok) throw new Error(`relay ${r.status}`);
  return r.json();
};

export async function relayPost(p: PairSecret, from: string, m: PairMessage): Promise<number> {
  const s = await seal(p, m);
  const r = await fetch(`${RELAY_URL}/v1/rooms/${p.room}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ from, ...s }),
  });
  return (await j(r)).seq;
}

/** New messages after `after`, decrypted; anything that does not decrypt is dropped. */
export async function relayPoll(p: PairSecret, after: number): Promise<{ last: number; closed: boolean; messages: (PairMessage & { seq: number })[] }> {
  const r = await fetch(`${RELAY_URL}/v1/rooms/${p.room}/messages?after=${after}`, { signal: AbortSignal.timeout(6000) });
  const body = await j(r) as { messages: { seq: number; ct: string; iv: string }[]; last?: number; closed?: boolean };
  const out: (PairMessage & { seq: number })[] = [];
  let last = after;
  for (const x of body.messages ?? []) {
    last = Math.max(last, x.seq);
    const m = await open(p, { ct: x.ct, iv: x.iv });
    if (m) out.push({ ...m, seq: x.seq });
  }
  return { last, closed: !!body.closed, messages: out };
}

export async function relayDelete(p: PairSecret): Promise<void> {
  await fetch(`${RELAY_URL}/v1/rooms/${p.room}`, { method: 'DELETE' }).catch(() => undefined);
}

export async function relayHealth(): Promise<boolean> {
  try { return (await fetch(`${RELAY_URL}/v1/health`, { signal: AbortSignal.timeout(3000) })).ok; } catch { return false; }
}
