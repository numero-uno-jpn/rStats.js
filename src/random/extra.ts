// Random variates of the distributions outside base R: rinvgamma, rkumar, rpareto, rtriang, rlaplace (as extraDistr
// draws them, so the same seed gives the same numbers) and rarcsine.
//
// Written for rStats.js (no ported code); the ways of drawing were taken from extraDistr's output and documentation:
// rinvgamma is 1 / rgamma(alpha, rate = beta); rkumar and rpareto invert the distribution function at 1 - u; rtriang
// mixes the minimum and maximum of two uniforms; rlaplace draws an exponential and then a uniform for the sign.
// Invalid parameters give NaN without drawing. rarcsine (not in extraDistr) inverts the distribution function at u.

import { qarcsine1 } from "../distributions/arcsine.js";
import { qkumar1 } from "../distributions/kumaraswamy.js";
import { qpareto1 } from "../distributions/pareto.js";
import { generate } from "./common.js";
import { rgamma1 } from "./gamma.js";
import { expRand, unifRand } from "./rng.js";
import { midpoint } from "../internal/extremes.js";

/**
 * Random numbers from the inverse gamma distribution. Equivalent to `extraDistr::rinvgamma(n, alpha, beta = 1)` in R.
 *
 * @param n Number of values to generate.
 * @param alpha Shape.
 * @param options.beta Scale. Default `1`.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rinvgamma(2, 3, { beta: 2 }); // [1.24409, 0.3964566]
 * ```
 *
 * @category Random numbers
 */
export function rinvgamma(n: number, alpha: number, options: { beta?: number } = {}): number[] {
  const { beta = 1 } = options;
  return generate(n, () => (alpha > 0 && beta > 0 && Number.isFinite(alpha) && Number.isFinite(beta) ? 1 / rgamma1(alpha, 1 / beta) : NaN));
}

/**
 * Random numbers from the Kumaraswamy distribution. Equivalent to `extraDistr::rkumar(n, a, b)` in R.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rkumar(2, 2, 3); // [0.5977236, 0.5298335]
 * ```
 *
 * @category Random numbers
 */
export function rkumar(n: number, a: number, b: number): number[] {
  return generate(n, () => (a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b) ? qkumar1(1 - unifRand(), a, b, true, false) : NaN));
}

/**
 * Random numbers from the Pareto distribution. Equivalent to `extraDistr::rpareto(n, a = 1, b = 1)` in R.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rpareto(2, { a: 3, b: 1 }); // [1.555872, 1.390286]
 * ```
 *
 * @category Random numbers
 */
export function rpareto(n: number, options: { a?: number; b?: number } = {}): number[] {
  const { a = 1, b = 1 } = options;
  return generate(n, () => (a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b) ? qpareto1(1 - unifRand(), a, b, true, false) : NaN));
}

/**
 * Random numbers from the triangular distribution.
 * Equivalent to `extraDistr::rtriang(n, a = -1, b = 1, c = (a + b)/2)` in R.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rtriang(2, { a: 0, b: 2, c: 1 }); // [0.6376326, 1.481061]
 * ```
 *
 * @category Random numbers
 */
export function rtriang(n: number, options: { a?: number; b?: number; c?: number } = {}): number[] {
  const { a = -1, b = 1 } = options;
  const c = options.c ?? midpoint(a, b);
  return generate(n, () => {
    if (!(Number.isFinite(a) && Number.isFinite(b) && a < b && a <= c && c <= b)) return NaN;
    const u = unifRand();
    const v = unifRand();
    const cc = (c - a) / (b - a);
    return a + (b - a) * ((1 - cc) * Math.min(u, v) + cc * Math.max(u, v));
  });
}

/**
 * Random numbers from the Laplace distribution. Equivalent to `extraDistr::rlaplace(n, mu = 0, sigma = 1)` in R.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rlaplace(2, { mu: 0, sigma: 1 }); // [-0.7551818, 0.1457067]
 * ```
 *
 * @category Random numbers
 */
export function rlaplace(n: number, options: { mu?: number; sigma?: number } = {}): number[] {
  const { mu = 0, sigma = 1 } = options;
  return generate(n, () => {
    if (!(Number.isFinite(mu) && sigma > 0 && Number.isFinite(sigma))) return NaN;
    const e = expRand();
    const s = unifRand() > 0.5 ? 1 : -1;
    return mu + sigma * s * e;
  });
}

/**
 * Random numbers from the arcsine distribution on (a, b), by inversion: `qarcsine(runif(n), a, b)`.
 * Not an R function. The arcsine distribution is neither in base R nor in extraDistr.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rarcsine(2, { a: 0, b: 1 }); // [0.1640851, 0.3044923]
 * ```
 *
 * @category Random numbers
 */
export function rarcsine(n: number, options: { a?: number; b?: number } = {}): number[] {
  const { a = 0, b = 1 } = options;
  return generate(n, () => (Number.isFinite(a) && Number.isFinite(b) && a < b ? qarcsine1(unifRand(), a, b, true, false) : NaN));
}
