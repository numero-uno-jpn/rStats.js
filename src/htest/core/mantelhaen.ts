// Exact conditional distribution for the Mantel-Haenszel test on 2 x 2 x K tables (mantelhaen.test with
// exact = TRUE).
//
// Written for rStats.js from the textbook construction and R's behaviour. With all margins fixed, the
// (1, 1) cell of stratum k follows Fisher's noncentral hypergeometric distribution with noncentrality psi, the common
// odds ratio (Mantel and Haenszel, JNCI 22, 1959; Birch, JRSS B 26, 1964), so their sum S has the density
// d0(s) psi^s / sum_t d0(t) psi^t, where d0 is the convolution of the K central hypergeometric densities. The
// conditional MLE of psi is the noncentrality whose mean equals the observed S, and the confidence limits are the
// noncentralities at which a one-sided probability equals alpha; the roots are found with uniroot on psi in [0, 1] or
// on 1/psi in [eps, 1], as for fisher.test's 2 x 2 tables (src/htest/fisherTest.ts).

import { dhyper1 } from "../../distributions/hypergeometric.js";
import { uniroot } from "../../internal/uniroot.js";
import { ddAdd, type DD } from "../../special/dd.js";

/** One 2 x 2 stratum as [[a, b], [c, d]] counts */
export type Stratum = readonly [readonly [number, number], readonly [number, number]];

/** Compensated (double-double) sum of v[from..to) */
function sumRange(v: Float64Array, from: number, to: number): number {
  let acc: DD = [0, 0];
  for (let i = Math.max(0, from); i < Math.min(to, v.length); i++) acc = ddAdd(acc, [v[i]!, 0]);
  return acc[0];
}

/** Central hypergeometric density of the (1, 1) cell of one stratum, with its support start */
function stratumDensity([[a, b], [c, d]]: Stratum): { lo: number; d: Float64Array } {
  const m = a + c; // first column
  const n = b + d; // second column
  const k = a + b; // first row
  const lo = Math.max(0, k - n);
  const hi = Math.min(k, m);
  const dens = new Float64Array(hi - lo + 1);
  for (let x = lo; x <= hi; x++) dens[x - lo] = dhyper1(x, m, n, k, false);
  return { lo, d: dens };
}

/** Discrete convolution of two densities on consecutive integers */
function convolve(p: Float64Array, q: Float64Array): Float64Array {
  const out = new Float64Array(p.length + q.length - 1);
  for (let i = 0; i < p.length; i++) {
    const pi = p[i]!;
    if (pi === 0) continue;
    for (let j = 0; j < q.length; j++) out[i + j]! += pi * q[j]!;
  }
  return out;
}

/**
 * The distribution of S = sum of the (1, 1) cells of K 2 x 2 tables with fixed margins, as a function of the common
 * odds ratio (noncentrality).
 */
export class ConvolvedNoncentralHyper {
  /** Smallest and largest attainable S */
  readonly lo: number;
  readonly hi: number;
  /** log d0(s) for s = lo..hi (d0: the null, psi = 1, density) */
  private readonly logNull: Float64Array;

  constructor(strata: readonly Stratum[]) {
    let lo = 0;
    let d0: Float64Array = new Float64Array([1]);
    for (const t of strata) {
      const s = stratumDensity(t);
      lo += s.lo;
      d0 = convolve(d0, s.d);
    }
    this.lo = lo;
    this.hi = lo + d0.length - 1;
    this.logNull = d0.map(Math.log);
  }

  /** P(S = s; psi) for s = lo..hi, for 0 < psi < Infinity (psi = 0 and Infinity give the point masses at lo and hi) */
  density(psi: number): Float64Array {
    const len = this.logNull.length;
    const out = new Float64Array(len);
    if (psi === 0 || psi === Infinity) {
      out[psi === 0 ? 0 : len - 1] = 1;
      return out;
    }
    const lp = Math.log(psi);
    let top = -Infinity;
    for (let i = 0; i < len; i++) {
      // exp(s log psi): the exponent is formed from the support value itself (lo + i)
      const v = this.logNull[i]! + (this.lo + i) * lp;
      out[i] = v;
      if (v > top) top = v;
    }
    for (let i = 0; i < len; i++) out[i] = Math.exp(out[i]! - top);
    const total = sumRange(out, 0, len);
    for (let i = 0; i < len; i++) out[i] = out[i]! / total;
    return out;
  }

  /** E[S; psi] */
  mean(psi: number): number {
    if (psi === 0) return this.lo;
    if (psi === Infinity) return this.hi;
    const d = this.density(psi);
    let acc: DD = [0, 0];
    for (let i = 0; i < d.length; i++) acc = ddAdd(acc, [(this.lo + i) * d[i]!, 0]);
    return acc[0];
  }

  /** P(S <= q; psi), or P(S >= q; psi) when upper */
  cdf(q: number, psi: number, upper: boolean): number {
    const d = this.density(psi);
    const i = q - this.lo;
    return upper ? sumRange(d, i, d.length) : sumRange(d, 0, i + 1);
  }
}

/**
 * Root in psi of a function that is monotone in psi, given whether the root lies below 1: search psi in [0, 1], or
 * t = 1/psi in [eps, 1]
 */
function oddsRoot(f: (psi: number) => number, belowOne: boolean): number {
  return belowOne ? uniroot(f, 0, 1) : 1 / uniroot((t) => f(1 / t), Number.EPSILON, 1);
}

/** The conditional maximum likelihood estimate of the common odds ratio given the observed sum s */
export function conditionalMLE(h: ConvolvedNoncentralHyper, s: number): number {
  if (s === h.lo) return 0;
  if (s === h.hi) return Infinity;
  const atOne = h.mean(1);
  if (atOne === s) return 1;
  return oddsRoot((psi) => h.mean(psi) - s, atOne > s);
}

/** Upper confidence limit: the psi with P(S <= s; psi) = alpha */
export function upperLimit(h: ConvolvedNoncentralHyper, s: number, alpha: number): number {
  if (s === h.hi) return Infinity;
  const atOne = h.cdf(s, 1, false);
  if (atOne === alpha) return 1;
  return oddsRoot((psi) => alpha - h.cdf(s, psi, false), atOne < alpha);
}

/** Lower confidence limit: the psi with P(S >= s; psi) = alpha */
export function lowerLimit(h: ConvolvedNoncentralHyper, s: number, alpha: number): number {
  if (s === h.lo) return 0;
  const atOne = h.cdf(s, 1, true);
  if (atOne === alpha) return 1;
  return oddsRoot((psi) => h.cdf(s, psi, true) - alpha, atOne > alpha);
}
