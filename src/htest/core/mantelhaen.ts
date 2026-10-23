// Exact conditional distribution for the Mantel-Haenszel test on 2 x 2 x K tables (mantelhaen.test with
// exact = TRUE).
//
// Written for rStats.js from the textbook construction (no ported code). With all margins fixed, the (1, 1) cell of
// stratum k follows a noncentral hypergeometric distribution with noncentrality psi, the common odds ratio, so their
// sum S follows the convolution of the K central hypergeometric distributions reweighted by psi^s and renormalised.
// The conditional MLE of psi is the noncentrality whose mean equals the observed S, and the confidence limits are the
// noncentralities at which a one-sided probability equals alpha, found with uniroot as for fisher.test's 2 x 2 tables
// (src/htest/fisherTest.ts).

import { dhyper1 } from "../../distributions/hypergeometric.js";
import { uniroot } from "../../internal/uniroot.js";
import { ddAdd, type DD } from "../../special/dd.js";

/** One 2 x 2 stratum as [[a, b], [c, d]] counts */
export type Stratum = readonly [readonly [number, number], readonly [number, number]];

function sumDD(d: Float64Array, from: number, to: number): number {
  let s: DD = [0, 0];
  for (let i = Math.max(0, from); i < Math.min(to, d.length); i++) s = ddAdd(s, [d[i]!, 0]);
  return s[0];
}

/**
 * The distribution of S = sum of the (1, 1) cells of K 2 x 2 tables with fixed margins, as a function of the common
 * odds ratio (noncentrality).
 */
export class ConvolvedNoncentralHyper {
  /** Smallest and largest value of S */
  readonly lo: number;
  readonly hi: number;
  /** log P(S = lo + i) under psi = 1 */
  private readonly logd0: Float64Array;

  constructor(strata: readonly Stratum[]) {
    let probs = new Float64Array([1]);
    let lo = 0;
    for (const [[a, b], [c, d]] of strata) {
      const m = a + c; // first column
      const n = b + d; // second column
      const k = a + b; // first row
      const slo = Math.max(0, k - n);
      const shi = Math.min(k, m);
      const p = new Float64Array(shi - slo + 1);
      for (let x = slo; x <= shi; x++) p[x - slo] = dhyper1(x, m, n, k, false);
      // convolution (all terms positive)
      const q = new Float64Array(probs.length + p.length - 1);
      for (let i = 0; i < probs.length; i++) {
        const v = probs[i]!;
        if (v === 0) continue;
        for (let j = 0; j < p.length; j++) q[i + j]! += v * p[j]!;
      }
      probs = q;
      lo += slo;
    }
    this.lo = lo;
    this.hi = lo + probs.length - 1;
    this.logd0 = probs.map((v) => Math.log(v));
  }

  /** P(S = lo + i) for psi (0 < psi < infinity), in support order */
  density(psi: number): Float64Array {
    const lc = Math.log(psi);
    const d = new Float64Array(this.logd0.length);
    let max = -Infinity;
    for (let i = 0; i < d.length; i++) {
      d[i] = this.logd0[i]! + lc * (this.lo + i);
      if (d[i]! > max) max = d[i]!;
    }
    for (let i = 0; i < d.length; i++) d[i] = d[i]! - max < -760 ? 0 : Math.exp(d[i]! - max);
    const s = sumDD(d, 0, d.length);
    for (let i = 0; i < d.length; i++) d[i] = d[i]! / s;
    return d;
  }

  mean(psi: number): number {
    if (psi === 0) return this.lo;
    if (psi === Infinity) return this.hi;
    const d = this.density(psi);
    let s: DD = [0, 0];
    for (let i = 0; i < d.length; i++) s = ddAdd(s, [(this.lo + i) * d[i]!, 0]);
    return s[0];
  }

  /** P(S <= q), or P(S >= q) if upper */
  cdf(q: number, psi: number, upper: boolean): number {
    if (psi === 0) return Number(upper ? q <= this.lo : q >= this.lo);
    if (psi === Infinity) return Number(upper ? q <= this.hi : q >= this.hi);
    const d = this.density(psi);
    const i = q - this.lo;
    return upper ? sumDD(d, i, d.length) : sumDD(d, 0, i + 1);
  }
}

function rootBelowOne(f: (psi: number) => number): number {
  return uniroot(f, 0, 1);
}
function rootAboveOne(f: (psi: number) => number): number {
  return 1 / uniroot((t) => f(1 / t), Number.EPSILON, 1);
}

/** The conditional maximum likelihood estimate of the common odds ratio given the observed sum s */
export function conditionalMLE(h: ConvolvedNoncentralHyper, s: number): number {
  if (s === h.lo) return 0;
  if (s === h.hi) return Infinity;
  const mu = h.mean(1);
  const f = (psi: number): number => h.mean(psi) - s;
  return mu > s ? rootBelowOne(f) : mu < s ? rootAboveOne(f) : 1;
}

/** Upper confidence limit: the psi with P(S <= s; psi) = alpha */
export function upperLimit(h: ConvolvedNoncentralHyper, s: number, alpha: number): number {
  if (s === h.hi) return Infinity;
  const p = h.cdf(s, 1, false);
  const f = (psi: number): number => alpha - h.cdf(s, psi, false);
  return p < alpha ? rootBelowOne(f) : p > alpha ? rootAboveOne(f) : 1;
}

/** Lower confidence limit: the psi with P(S >= s; psi) = alpha */
export function lowerLimit(h: ConvolvedNoncentralHyper, s: number, alpha: number): number {
  if (s === h.lo) return 0;
  const p = h.cdf(s, 1, true);
  const f = (psi: number): number => h.cdf(s, psi, true) - alpha;
  return p > alpha ? rootBelowOne(f) : p < alpha ? rootAboveOne(f) : 1;
}
