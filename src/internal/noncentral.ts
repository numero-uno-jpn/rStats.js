// Options for noncentral distributions (dchisq / pchisq / qchisq, dt / pt / qt, df / pf / qf, dbeta / pbeta / qbeta),
// and numerical helpers shared by their implementations (src/distributions/nchisq.ts, nbeta.ts).

/**
 * Noncentrality option accepted by the chi-squared, t, F and beta distribution functions.
 *
 * @category Distributions
 */
export interface NoncentralOption {
  /**
   * Noncentrality parameter. If omitted, the central distribution is used.
   * As in R, an explicit `ncp: 0` describes the same distribution as the central one. R then uses
   * the noncentral algorithm, so its values can differ slightly from the central values;
   * rStats.js returns values of the same accuracy in both cases.
   */
  ncp?: number;
}

const VIEW = new DataView(new ArrayBuffer(8));

/** Position of x in the ordered set of doubles (a signed integer; -0 and 0 share 0) */
function doubleKey(x: number): bigint {
  VIEW.setFloat64(0, Math.abs(x));
  const k = VIEW.getBigInt64(0);
  return x < 0 ? -k : k;
}

/** The double at position k (inverse of doubleKey) */
function keyDouble(k: bigint): number {
  VIEW.setBigInt64(0, k < 0n ? -k : k);
  const x = VIEW.getFloat64(0);
  return k < 0n ? -x : x;
}

/**
 * The smallest double in (lo, hi] at which `passes` holds, given that it fails at lo and holds at hi and changes once
 * in between: searched from x outwards over the doubles themselves by steps of 1, 2, 4, ... and then bisected, so that
 * it takes about 2 log2(d) steps for an x d doubles away (at most about 130). The last resort of the noncentral
 * quantiles, for distribution functions too steep for the Newton iteration (a spread below the spacing of the
 * doubles, where the function steps from 0 to 1/2 at one double, or a slope at which one double changes log p by
 * more than its tolerance); x is then the Newton iteration's result, usually within a few doubles.
 */
export function searchDoubles(x: number, lo: number, hi: number, passes: (x: number) => boolean): number {
  let a = doubleKey(lo);
  let b = doubleKey(hi);
  const k = doubleKey(Math.min(Math.max(x, lo), hi));
  if (k > a && k < b) {
    if (passes(keyDouble(k))) {
      b = k;
      for (let step = 1n; b - step > a; step *= 2n) {
        if (!passes(keyDouble(b - step))) {
          a = b - step;
          break;
        }
        b -= step;
      }
    } else {
      a = k;
      for (let step = 1n; a + step < b; step *= 2n) {
        if (passes(keyDouble(a + step))) {
          b = a + step;
          break;
        }
        a += step;
      }
    }
  }
  while (b - a > 1n) {
    const m = a + (b - a) / 2n;
    if (passes(keyDouble(m))) b = m;
    else a = m;
  }
  return keyDouble(b);
}

/**
 * The quantile of a distribution whose relative spread is below about 1e-10, so that its distribution function steps
 * within a few doubles of the start x0 (where the Newton iteration only wanders): searched for directly when the step
 * lies within x0 (1 ± 1e-12), otherwise undefined. hi caps the upper end of that interval
 */
export function narrowQuantile(x0: number, hi: number, passes: (x: number) => boolean): number | undefined {
  const a = x0 * (1 - 1e-12);
  const b = Math.min(x0 * (1 + 1e-12), hi);
  return a < b && !passes(a) && passes(b) ? searchDoubles(x0, a, b, passes) : undefined;
}

// Gauss-Kronrod 7-15 rule (QUADPACK, public domain; as in src/integrate/quadpack.ts): Kronrod nodes, from the end of
// [-1, 1] to the centre, their weights, and the Gauss weights of the odd-numbered nodes
const GK15_X = [
  0.991455371120812639206854697526329, 0.949107912342758524526189684047851, 0.864864423359769072789712788640926,
  0.741531185599394439863864773280788, 0.58608723546769113029414483825873, 0.405845151377397166906606412076961,
  0.207784955007898467600689403773245, 0,
];
const GK15_WK = [
  0.02293532201052922496373200805897, 0.063092092629978553290700663189204, 0.104790010322250183839876322541518,
  0.140653259715525918745189590510238, 0.16900472663926790282658342659855, 0.190350578064785409913256402421014,
  0.204432940075298892414161999234649, 0.209482141084727828012999174891714,
];
const GK15_WG = [
  0.129484966168869693270611432679082, 0.27970539148927666790146777142378, 0.381830050505118944950369775488975,
  0.417959183673469387755102040816327,
];

/** Accuracy goal and limit of one adaptive integral (kronrodAdaptive) */
export interface QuadratureControl {
  /** Relative tolerance on the difference between the Kronrod and Gauss values (of the total) */
  tol: number;
  /** Bisections allowed in all; past them the parts are taken as they are */
  maxBisections: number;
  /** Bisections made so far */
  bisections: number;
}

/** Control for an integrand accurate to about the rounding (tolerance 1e-15, 4000 bisections) */
export function quadratureControl(tol = 1e-15, maxBisections = 4000): QuadratureControl {
  return { tol, maxBisections, bisections: 0 };
}

/**
 * Integral of f over [a, b] by the 15-point Kronrod rule, bisecting while it differs from the 7-point Gauss rule by
 * more than tol of the total (`total`, the integral accumulated so far, or this part's own value). The difference
 * overestimates the error of the Kronrod value by far, so with tol = 1e-15 the result is good to about the rounding of
 * the sum. The bisections are counted over the whole integral: an integrand with rounding noise above the tolerance
 * would otherwise be bisected to the full depth (2^40 intervals)
 */
export function kronrodAdaptive(
  f: (u: number) => number,
  a: number,
  b: number,
  total: number,
  depth: number,
  control: QuadratureControl,
): number {
  const m = (a + b) / 2;
  const h = (b - a) / 2;
  const fc = f(m);
  let k = GK15_WK[7]! * fc;
  let g = GK15_WG[3]! * fc;
  for (let j = 0; j < 7; j++) {
    const fs = f(m - h * GK15_X[j]!) + f(m + h * GK15_X[j]!);
    k += GK15_WK[j]! * fs;
    if (j % 2 === 1) g += GK15_WG[(j - 1) / 2]! * fs;
  }
  k *= h;
  g *= h;
  if (Math.abs(k - g) <= control.tol * Math.max(Math.abs(k), total) || depth >= 40 || !Number.isFinite(k)) return k;
  if (++control.bisections > control.maxBisections) return k;
  return kronrodAdaptive(f, a, m, total, depth + 1, control) + kronrodAdaptive(f, m, b, total, depth + 1, control);
}

/**
 * Whether a noncentral density equals the central one to the double: it is e^-μ Σ_j μ^j/j! f_j, and f_1/f_0 is r
 * (x (a + b)/a for the beta, x/k for χ² with k df), with the ratios of later terms smaller still, so the terms from
 * j = 1 on and the factor e^-μ change it by less than 2 μ max(1, r) relative. Below 1e-20 that is the central density
 * itself (at a tiny or subnormal λ the mixture's weights were NaN: dbeta(1.05e-231, 0.19, 141, { ncp: 1.4e-303 }))
 */
export function negligibleNcp(mu: number, r: number): boolean {
  return mu * Math.max(1, r) < 1e-20;
}
