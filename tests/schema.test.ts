import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020';
import schema from '../schema/result-bundle.schema.json';
import { labCouple } from '../src/core/kernel';
import { generateKeyPair, signPayload } from '../src/core/crypto/sign';
import { PANEL_VERSION } from '../src/core/data/panel';
import { PERSONAS, demoCouples } from '../src/app/demo';
import type { PersonResult, ResultBundle } from '../src/core/types';

// Every bundle the simulated lab issues must match the published integration schema.

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(schema);
const lab = generateKeyPair();

const result = (id: string): PersonResult => {
  const p = PERSONAS.find(x => x.id === id)!;
  return { personId: id, displayName: p.name.en, sex: p.sex, findings: p.genome, panelVersion: PANEL_VERSION, testedAt: '2026-02-11', method: 'premarital' };
};

describe('result bundle schema', () => {
  for (const c of demoCouples()) {
    it(`bundles for ${c.a} and ${c.b} validate`, () => {
      const [fa, fb] = labCouple(result(c.a), result(c.b), c.rel, c.id);
      for (const [pid, couple] of [[c.a, fa], [c.b, fb]] as const) {
        const bundle: ResultBundle = { v: 1, kind: 'silah.result', person: result(pid), couple, issuer: 'Test lab', issuedAt: '2026-02-11T10:00:00.000Z' };
        const ok = validate(signPayload(bundle, lab));
        expect(validate.errors ?? []).toEqual([]);
        expect(ok).toBe(true);
      }
    });
  }

  it('rejects a bundle that carries the partner’s findings', () => {
    const [fa] = labCouple(result('mariam'), result('saeed'), 'first-cousins', 'x');
    const leaky = { ...fa, partnerFindings: result('saeed').findings };
    const bundle = { v: 1, kind: 'silah.result', person: result('mariam'), couple: leaky, issuer: 'Test lab', issuedAt: '2026-02-11T10:00:00.000Z' };
    expect(validate(signPayload(bundle, lab))).toBe(false);
  });
});
