import { RSABSSA } from '@cloudflare/blindrsa-ts';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, randomBytes } from '@noble/hashes/utils.js';
import { b64url, fromB64url, sha256Hex } from './sign';

// RFC 9474 RSABSSA-SHA384-PSS-Randomized. prepare() adds 32 random bytes to each 32-byte invite message.
const suite = RSABSSA.SHA384.PSS.Randomized();
const PUBLIC_EXPONENT = Uint8Array.from([1, 0, 1]);

export type PendingInvite = { prepared: Uint8Array; inv: Uint8Array };

export async function clinicKeygen(): Promise<{ publicKey: CryptoKey; privateKey: CryptoKey }> {
  const { publicKey, privateKey } = await suite.generateKey({ publicExponent: PUBLIC_EXPONENT, modulusLength: 2048 });
  return { publicKey, privateKey };
}

export async function exportPublicKey(pk: CryptoKey): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.exportKey('spki', pk)));
}

export async function importPublicKey(s: string): Promise<CryptoKey> {
  // blindrsa needs an extractable key with this exact algorithm and hash
  return crypto.subtle.importKey('spki', fromB64url(s), { name: 'RSA-PSS', hash: 'SHA-384' }, true, ['verify']);
}

/** Client side: blind n fresh invite messages. Keep `pending` secret; send only `blinded`. */
export async function requestInvites(pk: CryptoKey, n: number): Promise<{ pending: PendingInvite[]; blinded: string[] }> {
  const pending: PendingInvite[] = [];
  const blinded: string[] = [];
  for (let i = 0; i < n; i++) {
    const prepared = suite.prepare(randomBytes(32));
    const out = await suite.blind(pk, prepared);
    pending.push({ prepared, inv: out.inv });
    blinded.push(b64url(out.blindedMsg));
  }
  return { pending, blinded };
}

export class InviteIssuer {
  readonly log: { at: string; requester: string; count: number; blinded: string[] }[] = [];
  private readonly issued = new Map<string, number>();
  private readonly keys: { publicKey: CryptoKey; privateKey: CryptoKey };
  private readonly opts: { maxPerRequester: number };

  constructor(keys: { publicKey: CryptoKey; privateKey: CryptoKey }, opts: { maxPerRequester: number }) {
    this.keys = keys;
    this.opts = opts;
  }

  /** Rebuild an issuer from its persisted log (the per-requester counts follow from it). */
  static restore(keys: { publicKey: CryptoKey; privateKey: CryptoKey }, opts: { maxPerRequester: number }, log: InviteIssuer['log']): InviteIssuer {
    const i = new InviteIssuer(keys, opts);
    for (const e of log) {
      i.log.push(e);
      i.issued.set(e.requester, (i.issued.get(e.requester) ?? 0) + e.count);
    }
    return i;
  }

  /** The issuer sees only the requester's pseudonym and blinded values, never the invite messages. */
  async issue(requesterPseudonym: string, blinded: string[]): Promise<string[]> {
    const used = this.issued.get(requesterPseudonym) ?? 0;
    if (used + blinded.length > this.opts.maxPerRequester) {
      throw new Error(`invite cap exceeded: ${used} issued, ${blinded.length} requested, max ${this.opts.maxPerRequester}`);
    }
    const bytes = blinded.map(fromB64url);
    const sigs: string[] = [];
    for (const m of bytes) sigs.push(b64url(await suite.blindSign(this.keys.privateKey, m)));
    this.issued.set(requesterPseudonym, used + blinded.length);
    this.log.push({ at: new Date().toISOString(), requester: requesterPseudonym, count: blinded.length, blinded: [...blinded] });
    return sigs;
  }
}

/** Client side: unblind. Throws if a blind signature does not verify under pk. */
export async function finalizeInvites(pk: CryptoKey, pending: PendingInvite[], blindSigs: string[]): Promise<string[]> {
  if (pending.length !== blindSigs.length) throw new Error('finalizeInvites: count mismatch');
  const tokens: string[] = [];
  for (let i = 0; i < pending.length; i++) {
    const { prepared, inv } = pending[i];
    const sig = await suite.finalize(pk, prepared, fromB64url(blindSigs[i]), inv);
    tokens.push(`${b64url(prepared)}.${b64url(sig)}`);
  }
  return tokens;
}

type ParsedToken = { prepared: Uint8Array; sig: Uint8Array };

function parseToken(token: string): ParsedToken | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    return { prepared: fromB64url(parts[0]), sig: fromB64url(parts[1]) };
  } catch {
    return null;
  }
}

async function verifyToken(pk: CryptoKey, t: ParsedToken): Promise<boolean> {
  try {
    return await suite.verify(pk, t.sig, t.prepared);
  } catch {
    return false;
  }
}

export class InviteRedeemer {
  readonly log: { at: string; tokenHash: string; outcome: string }[] = [];
  private readonly pk: CryptoKey;
  private readonly spent = new Set<string>();

  constructor(pk: CryptoKey) {
    this.pk = pk;
  }

  /** Rebuild a redeemer from its persisted log: every 'ok' redemption is spent. */
  static restore(pk: CryptoKey, log: InviteRedeemer['log']): InviteRedeemer {
    const r = new InviteRedeemer(pk);
    for (const e of log) {
      r.log.push(e);
      if (e.outcome === 'ok') r.spent.add(e.tokenHash);
    }
    return r;
  }

  /** Spent is keyed on the prepared message, so a re-encoded signature cannot reuse an invite. */
  async redeem(token: string): Promise<'ok' | 'invalid' | 'spent'> {
    const parsed = parseToken(token);
    const tokenHash = parsed ? bytesToHex(sha256(parsed.prepared)) : sha256Hex(token);
    let outcome: 'ok' | 'invalid' | 'spent';
    if (!parsed || !(await verifyToken(this.pk, parsed))) outcome = 'invalid';
    else if (this.spent.has(tokenHash)) outcome = 'spent';
    else {
      this.spent.add(tokenHash);
      outcome = 'ok';
    }
    this.log.push({ at: new Date().toISOString(), tokenHash, outcome });
    return outcome;
  }
}

/** True if a redeemed token's hash, or its prepared bytes, appear in the issuance log. */
export function linkable(
  issuerLog: readonly { blinded: readonly string[] }[],
  redeemerLog: readonly { tokenHash: string }[],
): boolean {
  const seen = new Set<string>();
  for (const e of issuerLog) {
    for (const b of e.blinded) {
      seen.add(b);
      seen.add(bytesToHex(sha256(fromB64url(b))));
    }
  }
  return redeemerLog.some(r => seen.has(r.tokenHash));
}
