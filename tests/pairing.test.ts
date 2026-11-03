import { describe, it, expect } from 'vitest';
import { newPairSecret, open, pairToken, parsePairToken, seal, type PairMessage } from '../src/core/crypto/pairing';

const msg: PairMessage = { kind: 'share.finding', from: 'abc', at: '2026-11-03T08:00:00Z', body: { gene: 'CYP21A2', seq: 3 } };

describe('pairing two phones', () => {
  it('makes a 128-bit room and a 256-bit key that survive the link', () => {
    const p = newPairSecret();
    expect(p.room).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(p.key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(parsePairToken(pairToken(p))).toEqual(p);
    expect(parsePairToken('short.key')).toBeNull();
    expect(parsePairToken(p.room)).toBeNull();
  });
  it('encrypts so the relay sees no gene name, and decrypts with the key', async () => {
    const p = newPairSecret();
    const s = await seal(p, msg);
    expect(s.iv).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(s.ct).not.toContain('CYP21A2');
    expect(atob(s.ct.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.ct.length / 4) * 4, '='))).not.toContain('CYP21A2');
    expect(await open(p, s)).toEqual(msg);
  });
  it('rejects the wrong key, another room, and any changed byte', async () => {
    const p = newPairSecret();
    const s = await seal(p, msg);
    expect(await open({ ...p, key: newPairSecret().key }, s)).toBeNull();
    expect(await open({ ...p, room: newPairSecret().room }, s)).toBeNull();
    const flipped = s.ct.slice(0, 5) + (s.ct[5] === 'A' ? 'B' : 'A') + s.ct.slice(6);
    expect(await open(p, { ...s, ct: flipped })).toBeNull();
  });
  it('uses a fresh IV for every message', async () => {
    const p = newPairSecret();
    const a = await seal(p, msg), b = await seal(p, msg);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });
});
