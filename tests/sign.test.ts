import { describe, it, expect } from 'vitest';
import {
  b64url, canonicalJson, fromB64url, generateKeyPair, keyIdOf, sha256Hex, signPayload, verifySigned,
} from '../src/core/crypto/sign';

describe('canonicalJson', () => {
  it('sorts keys recursively and drops whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: [3, 1], c: 'x' } })).toBe('{"a":{"c":"x","d":[3,1]},"b":1}');
  });

  it('is independent of key insertion order', () => {
    expect(canonicalJson({ a: { c: 'x', d: 2 }, b: 1 })).toBe(canonicalJson({ b: 1, a: { d: 2, c: 'x' } }));
  });

  it('keeps array order', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('omits undefined object properties', () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('rejects values JSON cannot carry faithfully', () => {
    expect(() => canonicalJson({ n: 1n })).toThrow();
    expect(() => canonicalJson({ f: () => 1 })).toThrow();
    expect(() => canonicalJson([1, undefined])).toThrow();
    expect(() => canonicalJson([1, , 2])).toThrow();
    expect(() => canonicalJson({ n: NaN })).toThrow();
    expect(() => canonicalJson({ n: Infinity })).toThrow();
    expect(() => canonicalJson({ d: new Date(0) })).toThrow();
  });
});

describe('signPayload / verifySigned', () => {
  it('verifies a payload under its own key', () => {
    const kp = generateKeyPair();
    const s = signPayload({ gene: 'HBB', n: 1 }, kp);
    expect(s.keyId).toBe(keyIdOf(kp.publicKey));
    expect(verifySigned(s, { [kp.keyId]: kp.publicKey })).toBe(true);
  });

  it('signs the canonical form, so key order does not change the signature', () => {
    const kp = generateKeyPair();
    const a = signPayload({ a: 1, b: 2 }, kp);
    const b = signPayload({ b: 2, a: 1 }, kp);
    expect(a.sig).toBe(b.sig);
    expect(verifySigned(a, { [kp.keyId]: kp.publicKey })).toBe(true);
  });

  it('fails when the payload is tampered', () => {
    const kp = generateKeyPair();
    const s = signPayload({ gene: 'HBB', n: 1 }, kp);
    expect(verifySigned({ ...s, payload: { gene: 'HBB', n: 2 } }, { [kp.keyId]: kp.publicKey })).toBe(false);
  });

  it('fails for an unknown key, including prototype names', () => {
    const kp = generateKeyPair();
    const other = generateKeyPair();
    const s = signPayload({ x: 1 }, kp);
    expect(verifySigned(s, {})).toBe(false);
    expect(verifySigned(s, { [other.keyId]: other.publicKey })).toBe(false);
    expect(verifySigned({ ...s, keyId: 'constructor' }, {})).toBe(false);
  });

  it('fails on a flipped signature bit', () => {
    const kp = generateKeyPair();
    const s = signPayload({ x: 1 }, kp);
    const sig = fromB64url(s.sig);
    sig[0] ^= 0x01;
    expect(verifySigned({ ...s, sig: b64url(sig) }, { [kp.keyId]: kp.publicKey })).toBe(false);
  });

  it('returns false instead of throwing on malformed input', () => {
    const kp = generateKeyPair();
    const trusted = { [kp.keyId]: kp.publicKey };
    const s = signPayload({ x: 1 }, kp);
    expect(verifySigned({ ...s, sig: 'not base64!' }, trusted)).toBe(false);
    expect(verifySigned({ ...s, sig: '' }, trusted)).toBe(false);
    expect(verifySigned({ ...s, sig: 'AAAA' }, trusted)).toBe(false);
    expect(verifySigned({ ...s, payload: { n: 1n } } as never, trusted)).toBe(false);
    expect(verifySigned(null as never, trusted)).toBe(false);
  });
});

describe('keys and hashes', () => {
  it('keyId is 16 hex characters and differs per key', () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    expect(a.keyId).toMatch(/^[0-9a-f]{16}$/);
    expect(a.keyId).not.toBe(b.keyId);
  });

  it('sha256Hex matches the NIST vector for "abc"', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('b64url', () => {
  it('round-trips arbitrary bytes', () => {
    for (let n = 0; n < 40; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n * 11) & 255);
      expect(fromB64url(b64url(bytes))).toEqual(bytes);
    }
  });

  it('uses the url alphabet without padding', () => {
    expect(b64url(Uint8Array.from([251, 255]))).toBe('-_8');
    expect(b64url(Uint8Array.from([0]))).toBe('AA');
  });

  it('rejects padding, the standard alphabet and non-canonical encodings', () => {
    expect(() => fromB64url('AA==')).toThrow();
    expect(() => fromB64url('+/8')).toThrow();
    expect(() => fromB64url('AB')).toThrow();
  });
});
