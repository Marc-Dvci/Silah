import { describe, it, expect, beforeAll } from 'vitest';
import {
  clinicKeygen, exportPublicKey, importPublicKey, requestInvites, finalizeInvites,
  InviteIssuer, InviteRedeemer, linkable,
} from '../src/core/crypto/invites';
import { b64url, fromB64url } from '../src/core/crypto/sign';

type Keys = { publicKey: CryptoKey; privateKey: CryptoKey };
let clinic: Keys;
let other: Keys;

const T = 30_000; // blind signing is pure-JS bignum, slow enough to exceed the default timeout

/** Flip the low bit of one byte in the prepared (part 0) or signature (part 1) half of a token. */
function flip(token: string, part: 0 | 1, at: number): string {
  const parts = token.split('.');
  const bytes = fromB64url(parts[part]);
  bytes[at] ^= 0x01;
  parts[part] = b64url(bytes);
  return parts.join('.');
}

/** A signer refuses a blinded value at or above its own modulus (about 1 in 8 across two keys), so retry until one is accepted. */
async function blindedForSigner(signer: Keys, pk: CryptoKey) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const req = await requestInvites(pk, 1);
    try {
      return { req, sigs: await new InviteIssuer(signer, { maxPerRequester: 5 }).issue('req-w', req.blinded) };
    } catch (e) {
      if (!String(e).includes('signature representative out of range')) throw e;
    }
  }
  throw new Error('no blinded value was accepted by the signer');
}

beforeAll(async () => {
  clinic = await clinicKeygen();
  other = await clinicKeygen();
}, 120_000);

describe('invites', () => {
  it('issues, finalizes and redeems three invites once each', async () => {
    const issuer = new InviteIssuer(clinic, { maxPerRequester: 5 });
    const req = await requestInvites(clinic.publicKey, 3);
    const tokens = await finalizeInvites(clinic.publicKey, req.pending, await issuer.issue('req-1', req.blinded));
    expect(tokens).toHaveLength(3);

    const redeemer = new InviteRedeemer(clinic.publicKey);
    const outcomes: string[] = [];
    for (const t of tokens) outcomes.push(await redeemer.redeem(t));
    expect(outcomes).toEqual(['ok', 'ok', 'ok']);
    expect(await redeemer.redeem(tokens[0])).toBe('spent');
  }, T);

  it('a token with a flipped byte is invalid and does not burn the real invite', async () => {
    const issuer = new InviteIssuer(clinic, { maxPerRequester: 5 });
    const req = await requestInvites(clinic.publicKey, 1);
    const [token] = await finalizeInvites(clinic.publicKey, req.pending, await issuer.issue('req-2', req.blinded));
    const redeemer = new InviteRedeemer(clinic.publicKey);

    expect(await redeemer.redeem(flip(token, 1, 10))).toBe('invalid');
    expect(await redeemer.redeem(flip(token, 0, 3))).toBe('invalid');
    expect(await redeemer.redeem(token)).toBe('ok');
  }, T);

  it('malformed tokens are invalid', async () => {
    const redeemer = new InviteRedeemer(clinic.publicKey);
    for (const t of ['nonsense', 'a.b.c', '.', 'x.y', '']) {
      expect(await redeemer.redeem(t)).toBe('invalid');
    }
  }, T);

  it('enforces the per-requester cap and logs nothing for a refused request', async () => {
    const issuer = new InviteIssuer(clinic, { maxPerRequester: 2 });
    const big = await requestInvites(clinic.publicKey, 3);
    await expect(issuer.issue('req-x', big.blinded)).rejects.toThrow(/cap exceeded/);
    expect(issuer.log).toHaveLength(0);

    const two = await requestInvites(clinic.publicKey, 2);
    await issuer.issue('req-x', two.blinded.slice(0, 1));
    await expect(issuer.issue('req-x', two.blinded)).rejects.toThrow(/cap exceeded/);
    await issuer.issue('req-y', two.blinded);
    expect(issuer.log.map(e => [e.requester, e.count])).toEqual([['req-x', 1], ['req-y', 2]]);
  }, T);

  it('the issuance log and redemption log are not linkable', async () => {
    const issuer = new InviteIssuer(clinic, { maxPerRequester: 10 });
    const req = await requestInvites(clinic.publicKey, 3);
    const tokens = await finalizeInvites(clinic.publicKey, req.pending, await issuer.issue('req-1', req.blinded));
    const redeemer = new InviteRedeemer(clinic.publicKey);
    for (const t of tokens) expect(await redeemer.redeem(t)).toBe('ok');

    expect(issuer.log.flatMap(e => e.blinded)).not.toContain(b64url(req.pending[0].prepared));
    expect(linkable(issuer.log, redeemer.log)).toBe(false);

    // positive controls: the same check must fire when the issuer did see the prepared bytes or the hash
    const seenPrepared = [{ blinded: [b64url(req.pending[0].prepared)] }];
    expect(linkable(seenPrepared, redeemer.log)).toBe(true);
    expect(linkable([{ blinded: [redeemer.log[0].tokenHash] }], redeemer.log)).toBe(true);
  }, T);

  it('tokens from a different clinic key are invalid', async () => {
    const otherIssuer = new InviteIssuer(other, { maxPerRequester: 5 });
    const req = await requestInvites(other.publicKey, 1);
    const [token] = await finalizeInvites(other.publicKey, req.pending, await otherIssuer.issue('req-o', req.blinded));
    expect(await new InviteRedeemer(clinic.publicKey).redeem(token)).toBe('invalid');
  }, T);

  it('the client rejects blind signatures made under the wrong clinic key', async () => {
    const { req, sigs } = await blindedForSigner(other, clinic.publicKey);
    await expect(finalizeInvites(clinic.publicKey, req.pending, sigs)).rejects.toThrow('invalid signature');
  }, T);

  it('a clinic key survives export and import', async () => {
    const s = await exportPublicKey(clinic.publicKey);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    const pk = await importPublicKey(s);

    const issuer = new InviteIssuer(clinic, { maxPerRequester: 5 });
    const req = await requestInvites(pk, 1);
    const [token] = await finalizeInvites(pk, req.pending, await issuer.issue('req-e', req.blinded));
    expect(await new InviteRedeemer(pk).redeem(token)).toBe('ok');
  }, T);
});
