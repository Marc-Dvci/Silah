import { b64url, fromB64url } from './sign';

// Pairing two partners' phones. One phone makes a room id and a 256-bit key and shows them as a link or QR
// code; the key travels only in the link's #fragment, which browsers never send to a server. Every message
// is encrypted with AES-GCM under that key before it reaches the relay, so the relay stores ciphertext only.
// The room id is the AAD, so a message cannot be moved from one room to another.

export interface PairSecret { room: string; key: string }

export type PairKind = 'hello' | 'share.finding' | 'share.revoke' | 'booking.shared' | 'bye';
export interface PairMessage { kind: PairKind; from: string; at: string; body: unknown }
export interface Sealed { iv: string; ct: string }

const enc = new TextEncoder();
const dec = new TextDecoder();

export function newPairSecret(): PairSecret {
  return { room: b64url(crypto.getRandomValues(new Uint8Array(16))), key: b64url(crypto.getRandomValues(new Uint8Array(32))) };
}

/** A short random id for this phone inside the room; it is not linked to the person. */
export const newPairId = () => b64url(crypto.getRandomValues(new Uint8Array(6)));

export const ROOM_RE = /^[A-Za-z0-9_-]{22,64}$/;
export const KEY_RE = /^[A-Za-z0-9_-]{43}$/;

/** The part of the link after "#/pair/". */
export const pairToken = (p: PairSecret) => `${p.room}.${p.key}`;

export function parsePairToken(tok: string): PairSecret | null {
  const [room, key] = tok.split('.');
  return room && key && ROOM_RE.test(room) && KEY_RE.test(key) ? { room, key } : null;
}

async function aesKey(key: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', fromB64url(key), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function seal(p: PairSecret, m: PairMessage): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(p.room) }, await aesKey(p.key), enc.encode(JSON.stringify(m)));
  return { iv: b64url(iv), ct: b64url(new Uint8Array(ct)) };
}

/** Returns null for anything that does not decrypt under this room's key (tampered, wrong room, wrong key). */
export async function open(p: PairSecret, s: Sealed): Promise<PairMessage | null> {
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64url(s.iv), additionalData: enc.encode(p.room) }, await aesKey(p.key), fromB64url(s.ct));
    const m = JSON.parse(dec.decode(pt)) as PairMessage;
    return m && typeof m.kind === 'string' && typeof m.from === 'string' ? m : null;
  } catch {
    return null;
  }
}
