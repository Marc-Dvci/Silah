// Synthetic consanguineous population for comparing outreach strategies.
// Founder couples, three generations of random mating (first-cousin marriages in
// generation 2), recessive inheritance per gene. Pure TypeScript, no dependencies,
// seeded throughout, so it runs the same in Node and in a Web Worker.

import type { Relationship } from './types';

export interface GeneFreq { gene: string; carrier: number }   // carrier frequency, e.g. 0.02; allele frequency = carrier/2
export interface SimConfig {
  seed: number;
  families: number;           // number of founder couples (generation 0)
  genes: GeneFreq[];
  cousinMarriage: number;     // probability a generation-2 marriage is between first cousins when one is available (e.g. 0.35)
  declareRate: number;        // probability a related couple declares it when invited (e.g. 0.8)
  childrenMin: number;        // children per couple, uniform integer (e.g. 2..6)
  childrenMax: number;
}
export interface Person {
  id: number;
  family: number;             // founder family index; -1 for spouses brought in from outside
  gen: 0 | 1 | 2 | 3;
  sex: 'F' | 'M';
  father?: number;
  mother?: number;
  spouse?: number;
  alleles: Uint8Array;        // alleles[g] = count of pathogenic alleles (0, 1, 2) for gene index g
}
export interface Couple {
  id: number;                 // index in population.couples
  a: number;                  // female partner (person id)
  b: number;                  // male partner (person id)
  gen: 0 | 1 | 2;             // generation of the partners
  relationship: Relationship;
  declared: boolean;
  atRiskGenes: number[];      // gene indices where both partners carry a pathogenic allele
  affectedChild: boolean;     // a generation-3 child is homozygous (only generation-2 couples have one)
}
export interface Population { cfg: SimConfig; people: Person[]; couples: Couple[] }

export type Strategy = 'random' | 'consanguinity-first' | 'cascade';
export interface YieldPoint { tested: number; found: number }

type Rng = () => number;

/** mulberry32: small seeded PRNG, floats in [0, 1). Math.random is never used. */
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-place Fisher-Yates shuffle with the seeded RNG. */
function shuffle<T>(xs: T[], rng: Rng): T[] {
  for (let i = xs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [xs[i], xs[j]] = [xs[j], xs[i]];
  }
  return xs;
}

const opposite = (sex: 'F' | 'M'): 'F' | 'M' => (sex === 'F' ? 'M' : 'F');

/** Build a population from cfg. Same config, same population. */
export function simulate(cfg: SimConfig): Population {
  const rng = mulberry32(cfg.seed);
  const nGenes = cfg.genes.length;
  const people: Person[] = [];
  const couples: Couple[] = [];

  // Two independent draws per gene, each pathogenic with probability carrier/2.
  const founder = (): Uint8Array => {
    const alleles = new Uint8Array(nGenes);
    for (let g = 0; g < nGenes; g++) {
      const q = cfg.genes[g].carrier / 2;
      alleles[g] = (rng() < q ? 1 : 0) + (rng() < q ? 1 : 0);
    }
    return alleles;
  };

  const add = (gen: Person['gen'], sex: 'F' | 'M', family: number, alleles: Uint8Array, father?: Person, mother?: Person): Person => {
    const p: Person = { id: people.length, family, gen, sex, alleles };
    if (father && mother) { p.father = father.id; p.mother = mother.id; }
    people.push(p);
    return p;
  };

  const couple = (gen: Couple['gen'], x: Person, y: Person, relationship: Relationship): Couple => {
    const [a, b] = x.sex === 'F' ? [x, y] : [y, x];
    x.spouse = y.id;
    y.spouse = x.id;
    const atRiskGenes: number[] = [];
    for (let g = 0; g < nGenes; g++) if (a.alleles[g] >= 1 && b.alleles[g] >= 1) atRiskGenes.push(g);
    const declared = relationship !== 'unrelated' && rng() < cfg.declareRate;
    const c: Couple = { id: couples.length, a: a.id, b: b.id, gen, relationship, declared, atRiskGenes, affectedChild: false };
    couples.push(c);
    return c;
  };

  // Uniform child count, 50/50 sex, one allele from each parent per gene.
  // A parent with count c passes a pathogenic allele with probability c/2.
  const children = (gen: Person['gen'], c: Couple): Person[] => {
    const father = people[c.b];
    const mother = people[c.a];
    const n = cfg.childrenMin + Math.floor(rng() * (cfg.childrenMax - cfg.childrenMin + 1));
    const out: Person[] = [];
    for (let k = 0; k < n; k++) {
      const sex = rng() < 0.5 ? 'F' : 'M';
      const alleles = new Uint8Array(nGenes);
      for (let g = 0; g < nGenes; g++) {
        alleles[g] = (rng() < father.alleles[g] / 2 ? 1 : 0) + (rng() < mother.alleles[g] / 2 ? 1 : 0);
      }
      out.push(add(gen, sex, Math.max(father.family, mother.family), alleles, father, mother));
    }
    return out;
  };

  // Generations 0-2. Generation-2 children of one family are siblings (same gen-1 parent)
  // or first cousins (gen-1 parents are siblings).
  const gen2: Person[] = [];
  const gen2ByFamily: Person[][] = Array.from({ length: cfg.families }, (): Person[] => []);
  for (let f = 0; f < cfg.families; f++) {
    const father = add(0, 'M', f, founder());
    const mother = add(0, 'F', f, founder());
    const c0 = couple(0, father, mother, 'unrelated');
    for (const x of children(1, c0)) {
      const spouse = add(1, opposite(x.sex), -1, founder());
      const c1 = couple(1, x, spouse, 'unrelated');
      for (const y of children(2, c1)) {
        gen2.push(y);
        gen2ByFamily[f].push(y);
      }
    }
  }

  // Generation-2 marriages, random order. Cousin marriage happens with probability
  // cousinMarriage when an unmarried opposite-sex first cousin exists; otherwise a new founder.
  const sameParents = (p: Person, q: Person): boolean => p.father === q.father && p.mother === q.mother;
  for (const p of shuffle(gen2.slice(), rng)) {
    if (p.spouse !== undefined) continue;
    const wantCousin = rng() < cfg.cousinMarriage;
    const cousins = wantCousin
      ? gen2ByFamily[p.family].filter(q => q.spouse === undefined && q.sex !== p.sex && !sameParents(p, q))
      : [];
    if (cousins.length > 0) {
      couple(2, p, cousins[Math.floor(rng() * cousins.length)], 'first-cousins');
    } else {
      couple(2, p, add(2, opposite(p.sex), -1, founder()), 'unrelated');
    }
  }

  // Generation 3: children of each generation-2 couple. Homozygous child = affected.
  for (const c of couples) {
    if (c.gen !== 2) continue;
    c.affectedChild = children(3, c).some(k => k.alleles.some(v => v === 2));
  }

  return { cfg, people, couples };
}

/** Realistic test config: 20 placeholder genes, carrier frequencies spread geometrically from 0.10 down to 0.005. */
export function realisticConfig(seed: number): SimConfig {
  const genes: GeneFreq[] = Array.from({ length: 20 }, (_, i) => ({
    gene: `G${String(i + 1).padStart(2, '0')}`,
    carrier: 0.1 * 0.05 ** (i / 19),
  }));
  return { seed, families: 3000, genes, cousinMarriage: 0.35, declareRate: 0.8, childrenMin: 2, childrenMax: 6 };
}

/** Target couples: generation 2 with no affected child. Index couples are already known to the health system. */
const isTarget = (c: Couple): boolean => c.gen === 2 && !c.affectedChild;

/**
 * Test order for a strategy: each target couple at most once, or the first maxTests of them.
 * Siblings and first cousins are gen-2 persons in the same founder family.
 */
export function testOrder(pop: Population, strategy: Strategy, maxTests = Infinity): Couple[] {
  const { people, couples } = pop;
  // Own RNG stream, shared by all strategies so their random orders are comparable.
  const rng = mulberry32((pop.cfg.seed ^ 0x5bd1e995) >>> 0);
  const targets = couples.filter(isTarget);

  // Families with a known index couple: a partner there is a sibling or first cousin of an index partner.
  const indexFamilies = new Set<number>();
  for (const c of couples) {
    if (c.gen !== 2 || !c.affectedChild) continue;
    for (const id of [c.a, c.b]) if (people[id].family >= 0) indexFamilies.add(people[id].family);
  }
  const familyHistory = (c: Couple): boolean => [c.a, c.b].some(id => indexFamilies.has(people[id].family));

  // Consanguinity-first: declared related couples, then family history, then the rest.
  const consanguinity = [
    ...shuffle(targets.filter(c => c.declared), rng),
    ...shuffle(targets.filter(c => !c.declared && familyHistory(c)), rng),
    ...shuffle(targets.filter(c => !c.declared && !familyHistory(c)), rng),
  ];

  if (strategy === 'random') return shuffle(targets.slice(), rng).slice(0, maxTests);
  if (strategy === 'consanguinity-first') return consanguinity.slice(0, maxTests);

  // Cascade: a FIFO queue seeded with family-history targets, in consanguinity-first order
  // (declared before undeclared). A carrier couple enqueues the untested target couples
  // holding a sibling or first cousin of either partner.
  const coupleOf = new Int32Array(people.length).fill(-1);
  for (const c of couples) { coupleOf[c.a] = c.id; coupleOf[c.b] = c.id; }
  const byFamily = new Map<number, Person[]>();
  for (const p of people) {
    if (p.gen !== 2 || p.family < 0) continue;
    let list = byFamily.get(p.family);
    if (!list) byFamily.set(p.family, list = []);
    list.push(p);
  }

  const tested = new Uint8Array(couples.length);
  const queued = new Uint8Array(couples.length);
  const queue: Couple[] = [];
  for (const c of consanguinity.filter(familyHistory)) { queued[c.id] = 1; queue.push(c); }
  let head = 0;
  let fallback = 0;
  const pick = (): Couple | undefined => {
    if (head < queue.length) return queue[head++];
    while (fallback < consanguinity.length && tested[consanguinity[fallback].id]) fallback++;
    return fallback < consanguinity.length ? consanguinity[fallback++] : undefined;
  };

  const out: Couple[] = [];
  while (out.length < maxTests) {
    const c = pick();
    if (!c) break;
    tested[c.id] = 1;
    out.push(c);
    if (c.atRiskGenes.length === 0) continue;
    for (const id of [c.a, c.b]) {
      for (const r of byFamily.get(people[id].family) ?? []) {
        if (r.id === id) continue;
        const rc = couples[coupleOf[r.id]];
        if (isTarget(rc) && !tested[rc.id] && !queued[rc.id]) { queued[rc.id] = 1; queue.push(rc); }
      }
    }
  }
  return out;
}

/** Cumulative yield, one point per test. */
export function outreach(pop: Population, strategy: Strategy, maxTests?: number): YieldPoint[] {
  const points: YieldPoint[] = [];
  let found = 0;
  for (const c of testOrder(pop, strategy, maxTests)) {
    if (c.atRiskGenes.length > 0) found++;
    points.push({ tested: points.length + 1, found });
  }
  return points;
}

/**
 * Carriers found per 100 tests, for a budget of `tests`. If the points run out first,
 * the rest of the budget finds nothing more.
 */
export function foundPer100(points: YieldPoint[], tests: number): number {
  if (!(tests > 0)) throw new RangeError('tests must be positive');
  const n = Math.min(tests, points.length);
  const found = n === 0 ? 0 : points[n - 1].found;
  return (found * 100) / tests;
}

/**
 * Rates are over generation-2 couples (index couples included). A rate is NaN when its group is empty.
 */
export function summary(pop: Population): { couples: number; atRiskRate: number; atRiskRateRelated: number; atRiskRateUnrelated: number; knownIndex: number } {
  const g2 = pop.couples.filter(c => c.gen === 2);
  const rate = (cs: Couple[]): number =>
    cs.length === 0 ? NaN : cs.filter(c => c.atRiskGenes.length > 0).length / cs.length;
  return {
    couples: g2.length,
    atRiskRate: rate(g2),
    atRiskRateRelated: rate(g2.filter(c => c.relationship !== 'unrelated')),
    atRiskRateUnrelated: rate(g2.filter(c => c.relationship === 'unrelated')),
    knownIndex: g2.filter(c => c.affectedChild).length,
  };
}
