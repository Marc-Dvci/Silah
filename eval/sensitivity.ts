// How much the numbers a person sees depend on the two assumptions DoH does not publish: the share
// of a gene's disease-causing changes the panel detects (90%), and the carrier frequency used for
// panel genes with no Emirati figure (1 in 200). The arithmetic is the kernel's; at the baseline the
// result must equal the kernel's own cards, which `sensitivity()` checks before returning.
import { Q, qsum } from '../src/core/fraction';
import { residualCarrier } from '../src/core/kernel';
import { CARRIER_FREQS, DETECTION_FAMILIAL, DETECTION_GENE, DEFAULT_CARRIER } from '../src/core/frequencies';
import { PANEL_GENES } from '../src/core/data/panel';
import { cardsFor } from './bakeoff';

const published = new Map(CARRIER_FREQS.map(f => [f.gene, f.carrier]));

/** Fatima carries CYP21A2; Ahmed, her first cousin, tested negative for it. Per pregnancy, for that gene. */
function ownGene(gene: string, d: Q): Q {
  const r = Q.of(1, 8), p = published.get(gene)!;
  const num = r.mul(Q.one.sub(DETECTION_FAMILIAL)).add(p.mul(Q.one.sub(d)));
  const den = Q.one.sub(r.mul(DETECTION_FAMILIAL)).sub(p.mul(d));
  return num.div(den).mul(Q.of(1, 4));
}

/** Every other panel gene, both partners negative. */
function restOfPanel(exclude: string[], d: Q, assumed: Q): Q {
  return qsum(PANEL_GENES.filter(g => !exclude.includes(g)).map(g => {
    const r = residualCarrier(published.get(g) ?? assumed, d);
    return r.mul(r).mul(Q.of(1, 4));
  }));
}

export interface Cell { d: string; assumed: string; fatimaGene: number; fatimaRest: number; mariamRest: number }

export function sensitivity() {
  const fatima = cardsFor('fatima'), mariam = cardsFor('mariam');
  const kernel = (cards: typeof fatima, id: string) => Q.from(cards.find(c => c.id === id)!.numbers.affected);
  const mariamOwn = ['SMN1', 'MEFV'];
  // Baseline check: the same arithmetic gives the kernel's own numbers.
  const base = {
    fatimaGene: ownGene('CYP21A2', DETECTION_GENE),
    fatimaRest: restOfPanel(['CYP21A2'], DETECTION_GENE, DEFAULT_CARRIER),
    mariamRest: restOfPanel(mariamOwn, DETECTION_GENE, DEFAULT_CARRIER),
  };
  const same = base.fatimaGene.eq(kernel(fatima, 'residual:CYP21A2'))
    && base.fatimaRest.eq(kernel(fatima, 'panel-residual'))
    && base.mariamRest.eq(kernel(mariam, 'panel-residual'));
  if (!same) throw new Error('sensitivity arithmetic does not reproduce the kernel at the baseline');

  const ds = [Q.of(80, 100), Q.of(90, 100), Q.of(95, 100), Q.of(99, 100)];
  const ps = [Q.of(1, 100), Q.of(1, 200), Q.of(1, 500), Q.of(1, 1000)];
  const cells: Cell[] = [];
  for (const d of ds) for (const p of ps) cells.push({
    d: `${Math.round(d.toNumber() * 100)}%`, assumed: `1 in ${p.oneIn()}`,
    fatimaGene: ownGene('CYP21A2', d).oneIn(),
    fatimaRest: restOfPanel(['CYP21A2'], d, p).oneIn(),
    mariamRest: restOfPanel(mariamOwn, d, p).oneIn(),
  });
  const assumedGenes = PANEL_GENES.filter(g => !published.has(g)).length;
  return { cells, panel: PANEL_GENES.length, assumedGenes, base: { fatimaGene: base.fatimaGene.oneIn(), fatimaRest: base.fatimaRest.oneIn(), mariamRest: base.mariamRest.oneIn() } };
}
