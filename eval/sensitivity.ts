// How much the numbers a person sees depend on what DoH does not publish: the share of a gene's disease-causing
// changes the panel detects, whether the partner was checked for the family's exact change, and the carrier
// frequency used for panel genes with no Emirati figure. The arithmetic is the kernel's own functions; at the
// baseline the result must equal the kernel's cards, which `sensitivity()` checks before returning.
import { Q } from '../src/core/fraction';
import { atLeastOne, bothNegative, coupleView, INBREEDING, labCouple, partnerResidual, SIMULATED_LAB } from '../src/core/kernel';
import { CARRIER_FREQS, DEFAULT_CARRIER } from '../src/core/frequencies';
import { PANEL_GENES } from '../src/core/data/panel';
import type { PersonResult } from '../src/core/types';
import { cardsFor } from './bakeoff';

const published = new Map(CARRIER_FREQS.map(f => [f.gene, f.carrier]));
const F = INBREEDING['first-cousins'];

/** Fatima carries CYP21A2; Ahmed, her first cousin, tested negative for it. Per pregnancy, for that gene. */
const ownGene = (d: Q, dx: Q) => partnerResidual(published.get('CYP21A2')!, 'first-cousins', d, dx).residual.mul(Q.of(1, 4));

/** Every other panel gene, both partners negative, first cousins. */
function restOfPanel(exclude: string[], d: Q, assumed: Q): Q {
  const genes = PANEL_GENES.filter(g => !exclude.includes(g));
  const nAssumed = genes.filter(g => !published.has(g)).length;
  const known = genes.filter(g => published.has(g)).map(g => bothNegative(published.get(g)!, d, F));
  return known.reduce((a, b) => a.add(b), bothNegative(assumed, d, F).mul(Q.of(nAssumed)));
}

/** For an untested first-cousin couple, the panel's share of the added chance: F·Σq, q = p/2, per 100 births. */
const untestedPer100 = (assumed: Q) => PANEL_GENES.reduce((a, g) => a.add((published.get(g) ?? assumed).mul(Q.of(1, 2))), Q.zero).mul(F).toNumber() * 100;

const person = (id: string, gene: string): PersonResult =>
  ({ personId: id, displayName: id, sex: id === 'fatima' ? 'F' : 'M', findings: [{ gene, variant: 'x', classification: 'P' }], panelVersion: 't', testedAt: '2026-01-01', method: 'premarital' });

export interface Cell { d: string; assumed: string; untested: number; fatimaGene: number; fatimaGeneUnchecked: number; fatimaRest: number; fatimaPanel: number; mariamRest: number }

export function sensitivity() {
  const fatima = cardsFor('fatima'), mariam = cardsFor('mariam');
  const kernel = (cards: typeof fatima, id: string) => Q.from(cards.find(c => c.id === id)!.numbers.affected);
  const mariamOwn = ['SMN1', 'MEFV'];
  const d0 = SIMULATED_LAB.panel, dx0 = SIMULATED_LAB.exactChange;
  // Baseline check: the same arithmetic gives the kernel's own numbers, including the panel figure on Fatima's screen.
  const base = {
    fatimaGene: ownGene(d0, dx0),
    fatimaRest: restOfPanel(['CYP21A2'], d0, DEFAULT_CARRIER),
    mariamRest: restOfPanel(mariamOwn, d0, DEFAULT_CARRIER),
  };
  const fatimaPanel = atLeastOne([base.fatimaGene, base.fatimaRest]);
  const f = person('fatima', 'CYP21A2'), a = person('ahmed', 'GJB2');
  const view = coupleView(f, labCouple(f, a, 'first-cousins', 'x', SIMULATED_LAB)[0]);
  const same = base.fatimaGene.eq(kernel(fatima, 'residual:CYP21A2'))
    && base.fatimaRest.eq(kernel(fatima, 'panel-residual'))
    && base.mariamRest.eq(kernel(mariam, 'panel-residual'))
    && fatimaPanel.eq(view.panelRisk);
  if (!same) throw new Error('sensitivity arithmetic does not reproduce the kernel at the baseline');

  const ds = [Q.of(80, 100), Q.of(90, 100), Q.of(95, 100), Q.of(99, 100)];
  const ps = [Q.of(1, 200), Q.of(1, 500), Q.of(1, 1000), Q.of(1, 2000)];
  const cells: Cell[] = [];
  for (const d of ds) for (const p of ps) {
    const gene = ownGene(d, dx0), rest = restOfPanel(['CYP21A2'], d, p);
    cells.push({
      d: `${Math.round(d.toNumber() * 100)}%`, assumed: `1 in ${p.oneIn()}`,
      untested: Math.round(untestedPer100(p) * 10) / 10,
      fatimaGene: gene.oneIn(),
      fatimaGeneUnchecked: ownGene(d, d).oneIn(),
      fatimaRest: rest.oneIn(),
      fatimaPanel: atLeastOne([gene, rest]).oneIn(),
      mariamRest: restOfPanel(mariamOwn, d, p).oneIn(),
    });
  }
  const assumedGenes = PANEL_GENES.filter(g => !published.has(g)).length;
  return {
    cells, panel: PANEL_GENES.length, assumedGenes,
    base: { fatimaGene: base.fatimaGene.oneIn(), fatimaRest: base.fatimaRest.oneIn(), fatimaPanel: fatimaPanel.oneIn(), mariamRest: base.mariamRest.oneIn() },
  };
}
