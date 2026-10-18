import { describe, it, expect } from 'vitest';
import { appendReceipt, activeGrants, verifyLedger, type LedgerEntry, type Receipt } from '../src/core/crypto/receipts';
import { canonicalJson, generateKeyPair, sha256Hex, signPayload, type KeyPair } from '../src/core/crypto/sign';

const AT = '2026-10-01T10:00:00Z';
const coupleCheck = { kind: 'couple-check' as const };

/** consent -> share (HBB) -> revoke of the share */
function build(kp: KeyPair): LedgerEntry[] {
  let L: LedgerEntry[] = [];
  L = appendReceipt(L, { at: AT, actor: 'person', action: 'consent', subject: coupleCheck, recipient: 'clinic', scope: 'couple-check' }, kp);
  L = appendReceipt(L, { at: AT, actor: 'person', action: 'share', subject: { kind: 'couple-check', gene: 'HBB' }, recipient: 'partner', scope: 'HBB', expires: '2026-12-31T00:00:00Z' }, kp);
  L = appendReceipt(L, { at: AT, actor: 'person', action: 'revoke', subject: { kind: 'couple-check', gene: 'HBB' }, recipient: 'partner', scope: 'HBB', ref: 1 }, kp);
  return L;
}

describe('appendReceipt / verifyLedger', () => {
  it('builds a chained ledger that verifies', () => {
    const kp = generateKeyPair();
    const L = build(kp);
    expect(L.map(e => e.payload.seq)).toEqual([0, 1, 2]);
    expect(L[0].payload.prevHash).toBe('0'.repeat(64));
    expect(L[1].payload.prevHash).toBe(sha256Hex(canonicalJson(L[0])));
    expect(verifyLedger(L, kp.publicKey)).toEqual({ ok: true });
  });

  it('returns a new array and leaves the input unchanged', () => {
    const kp = generateKeyPair();
    const before = build(kp);
    const after = appendReceipt(before, { at: AT, actor: 'person', action: 'consent', subject: coupleCheck, recipient: 'clinic', scope: 'x' }, kp);
    expect(before).toHaveLength(3);
    expect(after).toHaveLength(4);
    expect(after).not.toBe(before);
  });

  it.each([0, 1, 2])('tampering entry %i breaks the chain at that index', index => {
    const kp = generateKeyPair();
    const L = build(kp);
    const bad = structuredClone(L);
    bad[index].payload.scope = 'everything';
    expect(verifyLedger(bad, kp.publicKey)).toEqual({ ok: false, brokenAt: index });
  });

  it('a re-signed earlier entry breaks the chain at the next entry', () => {
    const kp = generateKeyPair();
    const L = build(kp);
    const bad = [...L];
    bad[1] = signPayload({ ...L[1].payload, scope: 'everything' }, kp);
    expect(verifyLedger(bad, kp.publicKey)).toEqual({ ok: false, brokenAt: 2 });
  });

  it('a removed entry breaks sequence continuity', () => {
    const kp = generateKeyPair();
    const L = build(kp);
    expect(verifyLedger([L[0], L[2]], kp.publicKey)).toEqual({ ok: false, brokenAt: 1 });
  });

  it('fails at entry 0 under a different key', () => {
    const kp = generateKeyPair();
    const other = generateKeyPair();
    expect(verifyLedger(build(kp), other.publicKey)).toEqual({ ok: false, brokenAt: 0 });
  });

  it('the verifier rejects a double revoke even when it is validly signed', () => {
    const kp = generateKeyPair();
    const L = build(kp);
    const again: Receipt = {
      seq: 3, at: AT, actor: 'person', action: 'revoke', subject: { kind: 'couple-check', gene: 'HBB' },
      recipient: 'partner', scope: 'HBB', ref: 1, prevHash: sha256Hex(canonicalJson(L[2])),
    };
    expect(verifyLedger([...L, signPayload(again, kp)], kp.publicKey)).toEqual({ ok: false, brokenAt: 3 });
  });

  it('accepts an empty ledger', () => {
    expect(verifyLedger([], generateKeyPair().publicKey)).toEqual({ ok: true });
  });
});

describe('appendReceipt rules', () => {
  it('a second revoke of the same ref throws', () => {
    const kp = generateKeyPair();
    const L = build(kp);
    expect(() => appendReceipt(L, { at: AT, actor: 'person', action: 'revoke', subject: { kind: 'couple-check', gene: 'HBB' }, recipient: 'partner', scope: 'HBB', ref: 1 }, kp))
      .toThrow(/already cancelled/);
  });

  it('a revoke of a non-existent ref throws', () => {
    const kp = generateKeyPair();
    const L = appendReceipt([], { at: AT, actor: 'person', action: 'consent', subject: coupleCheck, recipient: 'clinic', scope: 'x' }, kp);
    expect(() => appendReceipt(L, { at: AT, actor: 'person', action: 'revoke', subject: coupleCheck, recipient: 'clinic', scope: 'x', ref: 7 }, kp))
      .toThrow(/not an earlier receipt/);
  });

  it('a revoke without ref throws', () => {
    const kp = generateKeyPair();
    const L = build(kp);
    expect(() => appendReceipt(L, { at: AT, actor: 'person', action: 'withdraw', subject: coupleCheck, recipient: 'clinic', scope: 'x' }, kp))
      .toThrow(/needs ref/);
  });

  it('a revoke must target a share or consent of the same subject kind', () => {
    const kp = generateKeyPair();
    const L = build(kp);
    expect(() => appendReceipt(L, { at: AT, actor: 'person', action: 'revoke', subject: { kind: 'finding' }, recipient: 'clinic', scope: 'x', ref: 1 }, kp))
      .toThrow(/different subject kind/);
    expect(() => appendReceipt(L, { at: AT, actor: 'person', action: 'revoke', subject: { kind: 'couple-check', gene: 'HBB' }, recipient: 'clinic', scope: 'x', ref: 2 }, kp))
      .toThrow(/not a share or consent/);
  });

  it('a share or consent cannot carry ref', () => {
    const kp = generateKeyPair();
    expect(() => appendReceipt([], { at: AT, actor: 'person', action: 'consent', subject: coupleCheck, recipient: 'clinic', scope: 'x', ref: 0 }, kp))
      .toThrow(/only applies to revoke or withdraw/);
  });
});

describe('activeGrants', () => {
  it('excludes revoked, withdrawn and expired grants', () => {
    const kp = generateKeyPair();
    const base = { at: AT, actor: 'person', recipient: 'x', scope: 'x' };
    let L: LedgerEntry[] = [];
    L = appendReceipt(L, { ...base, action: 'consent', subject: coupleCheck }, kp); // 0, withdrawn at 5
    L = appendReceipt(L, { ...base, action: 'share', subject: { kind: 'couple-check', gene: 'HBB' }, expires: '2026-06-01T00:00:00Z' }, kp); // 1, expired
    L = appendReceipt(L, { ...base, action: 'share', subject: { kind: 'couple-check', gene: 'CFTR' }, expires: '2027-01-01T00:00:00Z' }, kp); // 2, active
    L = appendReceipt(L, { ...base, action: 'share', subject: { kind: 'couple-check', gene: 'SMN1' } }, kp); // 3, revoked at 4
    L = appendReceipt(L, { ...base, action: 'revoke', subject: { kind: 'couple-check', gene: 'SMN1' }, ref: 3 }, kp); // 4
    L = appendReceipt(L, { ...base, action: 'withdraw', subject: coupleCheck, ref: 0 }, kp); // 5

    const active = activeGrants(L, new Date('2026-10-18T00:00:00Z'));
    expect(active.map(r => r.seq)).toEqual([2]);
    expect(active[0].scope).toBe('x');
  });

  it('keeps a consent with no expiry and no cancel', () => {
    const kp = generateKeyPair();
    const L = appendReceipt([], { at: AT, actor: 'person', action: 'consent', subject: coupleCheck, recipient: 'clinic', scope: 'x' }, kp);
    expect(activeGrants(L, new Date('2030-01-01T00:00:00Z'))).toHaveLength(1);
  });
});
