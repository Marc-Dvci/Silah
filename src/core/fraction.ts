// Exact rational arithmetic. Every risk Silah shows is a fraction computed here,
// so the same number can be checked by hand, by the tests and by the verifier.

export type QLike = { n: string; d: string };

const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};

export class Q {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint | number, d: bigint | number = 1n) {
    let nn = BigInt(n);
    let dd = BigInt(d);
    if (dd === 0n) throw new Error('zero denominator');
    if (dd < 0n) { nn = -nn; dd = -dd; }
    const g = gcd(nn, dd) || 1n;
    this.n = nn / g;
    this.d = dd / g;
  }

  static of(n: number | bigint, d: number | bigint = 1): Q { return new Q(BigInt(n), BigInt(d)); }
  static zero = new Q(0n);
  static one = new Q(1n);

  /** Parse "1/4", "0.106" or "3". Decimals become exact fractions. */
  static parse(s: string): Q {
    const t = s.trim();
    if (t.includes('/')) {
      const [a, b] = t.split('/');
      return new Q(BigInt(a.trim()), BigInt(b.trim()));
    }
    if (t.includes('.')) {
      const [i, f] = t.split('.');
      const scale = 10n ** BigInt(f.length);
      const sign = i.startsWith('-') ? -1n : 1n;
      return new Q(BigInt(i) * scale + sign * BigInt(f), scale);
    }
    return new Q(BigInt(t));
  }

  static from(x: QLike): Q { return new Q(BigInt(x.n), BigInt(x.d)); }
  toJSON(): QLike { return { n: this.n.toString(), d: this.d.toString() }; }

  add(o: Q): Q { return new Q(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o: Q): Q { return new Q(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o: Q): Q { return new Q(this.n * o.n, this.d * o.d); }
  div(o: Q): Q { return new Q(this.n * o.d, this.d * o.n); }
  cmp(o: Q): number { const x = this.n * o.d - o.n * this.d; return x < 0n ? -1 : x > 0n ? 1 : 0; }
  eq(o: Q): boolean { return this.n === o.n && this.d === o.d; }
  isZero(): boolean { return this.n === 0n; }
  toNumber(): number { return Number(this.n) / Number(this.d); }
  toString(): string { return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`; }

  /** "1 in N" with N rounded to two significant figures (exact when the numerator is 1 and N is small). */
  oneIn(): number {
    if (this.n === 0n) return Infinity;
    if (this.n === 1n && this.d <= 100n) return Number(this.d);
    const x = Number(this.d) / Number(this.n);
    return roundSig(x, 2);
  }
}

export function roundSig(x: number, sig: number): number {
  if (!isFinite(x) || x === 0) return x;
  const p = Math.pow(10, sig - Math.ceil(Math.log10(Math.abs(x))));
  return Math.round(x * p) / p;
}

/** Sum of fractions. */
export const qsum = (xs: Q[]): Q => xs.reduce((a, b) => a.add(b), Q.zero);
