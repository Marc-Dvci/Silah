import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { Signed } from '../types';

/** Sorted keys, no whitespace. These are the bytes that get signed, so every party must produce the same string. */
export function canonicalJson(x: unknown): string {
  if (x === null) return 'null';
  if (typeof x === 'string') return JSON.stringify(x);
  if (typeof x === 'boolean') return x ? 'true' : 'false';
  if (typeof x === 'number') {
    if (!Number.isFinite(x)) throw new Error('canonicalJson: non-finite number');
    return JSON.stringify(x);
  }
  if (Array.isArray(x)) {
    // Array.from visits holes as undefined, so sparse arrays fail loudly
    return '[' + Array.from(x, v => {
      if (v === undefined) throw new Error('canonicalJson: undefined in array');
      return canonicalJson(v);
    }).join(',') + ']';
  }
  if (typeof x === 'object') {
    // Dates, Maps and typed arrays would silently become {}
    const proto = Object.getPrototypeOf(x);
    if (proto !== Object.prototype && proto !== null) throw new Error('canonicalJson: not a plain object');
    const o = x as Record<string, unknown>;
    const keys = Object.keys(o).filter(k => o[k] !== undefined).sort();
    return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalJson(o[k])).join(',') + '}';
  }
  throw new Error(`canonicalJson: ${typeof x} not allowed`);
}

/** base64url without padding. */
export function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Strict decoder: rejects padding, standard-alphabet characters and non-canonical encodings. */
export function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('fromB64url: bad character');
  const std = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const out = Uint8Array.from(atob(std), c => c.charCodeAt(0));
  if (b64url(out) !== s) throw new Error('fromB64url: not canonical');
  return out;
}

export type KeyPair = { secretKey: Uint8Array; publicKey: Uint8Array; keyId: string };

export function sha256Hex(s: string): string {
  return bytesToHex(sha256(utf8ToBytes(s)));
}

export function keyIdOf(pub: Uint8Array): string {
  return bytesToHex(sha256(pub)).slice(0, 16);
}

export function generateKeyPair(): KeyPair {
  const secretKey = ed25519.utils.randomSecretKey();
  const publicKey = ed25519.getPublicKey(secretKey);
  return { secretKey, publicKey, keyId: keyIdOf(publicKey) };
}

export function signPayload<T>(payload: T, kp: KeyPair): Signed<T> {
  const msg = utf8ToBytes(canonicalJson(payload));
  return { payload, keyId: kp.keyId, sig: b64url(ed25519.sign(msg, kp.secretKey)) };
}

/** Never throws: any malformed input, unknown key or bad signature is false. */
export function verifySigned<T>(s: Signed<T>, trusted: Record<string, Uint8Array>): boolean {
  try {
    if (!Object.hasOwn(trusted, s.keyId)) return false;
    const msg = utf8ToBytes(canonicalJson(s.payload));
    return ed25519.verify(fromB64url(s.sig), msg, trusted[s.keyId], { zip215: false });
  } catch {
    return false;
  }
}
