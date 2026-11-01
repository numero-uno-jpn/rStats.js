// Univariate root finding for internal callers (the confidence limits and estimates of fisherTest, wilcoxTest and
// mantelhaenTest): a thin wrapper around the public uniroot (src/numerics/integrate.ts, Brent's method with R's
// conventions), returning just the root, and the root of an odds ratio on the log scale (logScaleRoot).

import { uniroot as unirootFull } from "../numerics/integrate.js";

export interface UnirootOptions {
  /** Tolerance (interval width). Default is .Machine$double.eps^0.25, as in R's uniroot */
  tol?: number;
  maxIter?: number;
  /** Pass the endpoint values if known (saves calls to f) */
  fLower?: number;
  fUpper?: number;
}

export const UNIROOT_TOL = Math.pow(Number.EPSILON, 0.25);

/** f(lower) and f(upper) must differ in sign. Returns one root */
export function uniroot(f: (x: number) => number, lower: number, upper: number, opts: UnirootOptions = {}): number {
  const options: Parameters<typeof unirootFull>[3] = { tol: opts.tol ?? UNIROOT_TOL, maxiter: opts.maxIter ?? 1000 };
  if (opts.fLower !== undefined) options.fLower = opts.fLower;
  if (opts.fUpper !== undefined) options.fUpper = opts.fUpper;
  return unirootFull(f, lower, upper, options).root;
}

/**
 * Root in psi > 0 of a function monotone in psi (an odds ratio), given whether it lies below 1: solved in u = log psi
 * to the precision of the doubles, from a bracket widened from u = 0 by doubling. 0 or Infinity when f does not change
 * sign within the doubles. (R's fisher.test solves on psi in [0, 1] or 1/psi in [eps, 1] with the absolute tolerance
 * eps^0.25, which leaves its estimates 1e-6 off and its limits up to several percent, or at the end 1/eps)
 */
export function logScaleRoot(f: (psi: number) => number, belowOne: boolean): number {
  const g = (u: number): number => f(Math.exp(u));
  let a = 0;
  let ga = g(0);
  let b = belowOne ? -1 : 1;
  let gb = g(b);
  while (gb !== 0 && Math.sign(gb) === Math.sign(ga)) {
    if (Math.abs(b) > 745) return belowOne ? 0 : Infinity;
    a = b;
    ga = gb;
    b *= 2;
    gb = g(b);
  }
  if (gb === 0) return Math.exp(b);
  const root = a < b ? uniroot(g, a, b, { tol: 2 ** -50, fLower: ga, fUpper: gb }) : uniroot(g, b, a, { tol: 2 ** -50, fLower: gb, fUpper: ga });
  return Math.exp(root);
}

