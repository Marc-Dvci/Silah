import type { Signed } from '../types';
import { canonicalJson, keyIdOf, sha256Hex, signPayload, verifySigned, type KeyPair } from './sign';

export type ReceiptAction = 'consent' | 'withdraw' | 'share' | 'revoke';

export type ReceiptSubject = {
  kind: 'couple-check' | 'finding' | 'birth-plan' | 'teachback' | 'brief' | 'invitation';
  gene?: string;
  note?: string;
};

export type Receipt = {
  seq: number;
  at: string;
  actor: string;
  action: ReceiptAction;
  subject: ReceiptSubject;
  recipient: string;
  scope: string;
  expires?: string;
  /** seq of the receipt a revoke or withdraw cancels. */
  ref?: number;
  prevHash: string;
};

export type LedgerEntry = Signed<Receipt>;

const ZERO_HASH = '0'.repeat(64);

const isCancel = (a: ReceiptAction) => a === 'revoke' || a === 'withdraw';
const isGrant = (a: ReceiptAction) => a === 'share' || a === 'consent';

/** Why this receipt cannot follow the given prefix of a ledger, or null if it can. */
function ruleError(prefix: readonly LedgerEntry[], r: Pick<Receipt, 'action' | 'subject' | 'ref'>): string | null {
  if (!isCancel(r.action)) return r.ref === undefined ? null : 'ref only applies to revoke or withdraw';
  if (r.ref === undefined) return 'revoke or withdraw needs ref';
  if (!Number.isInteger(r.ref) || r.ref < 0 || r.ref >= prefix.length) return `ref ${r.ref} is not an earlier receipt`;
  const target = prefix[r.ref].payload;
  if (!isGrant(target.action)) return `ref ${r.ref} is not a share or consent`;
  if (target.subject.kind !== r.subject.kind) return `ref ${r.ref} has a different subject kind`;
  if (prefix.some(e => isCancel(e.payload.action) && e.payload.ref === r.ref)) return `ref ${r.ref} is already cancelled`;
  return null;
}

export function appendReceipt(ledger: LedgerEntry[], r: Omit<Receipt, 'seq' | 'prevHash'>, kp: KeyPair): LedgerEntry[] {
  const err = ruleError(ledger, r);
  if (err) throw new Error(`appendReceipt: ${err}`);
  const prev = ledger.at(-1);
  const full: Receipt = {
    ...r,
    seq: ledger.length,
    prevHash: prev ? sha256Hex(canonicalJson(prev)) : ZERO_HASH,
  };
  return [...ledger, signPayload(full, kp)];
}

/** Checks signatures, seq, the hash chain and cancel rules. brokenAt is the first index that fails. */
export function verifyLedger(ledger: readonly LedgerEntry[], publicKey: Uint8Array): { ok: boolean; brokenAt?: number } {
  const trusted = { [keyIdOf(publicKey)]: publicKey };
  let prevHash = ZERO_HASH;
  for (let i = 0; i < ledger.length; i++) {
    const e = ledger[i];
    if (!verifySigned(e, trusted)) return { ok: false, brokenAt: i };
    const r = e.payload;
    if (r.seq !== i || r.prevHash !== prevHash || ruleError(ledger.slice(0, i), r)) return { ok: false, brokenAt: i };
    prevHash = sha256Hex(canonicalJson(e));
  }
  return { ok: true };
}

/** Share or consent receipts that are neither cancelled nor expired. Run verifyLedger first. */
export function activeGrants(ledger: readonly LedgerEntry[], now: Date): Receipt[] {
  const receipts = ledger.map(e => e.payload);
  const cancelled = new Set(receipts.filter(r => isCancel(r.action)).map(r => r.ref));
  return receipts.filter(r =>
    isGrant(r.action) &&
    !cancelled.has(r.seq) &&
    (r.expires === undefined || Date.parse(r.expires) > now.getTime()),
  );
}
