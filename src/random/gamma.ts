// Gamma random variates, and the χ², t and F variates built from them.
//
// For shape >= 1, algorithm GD from Ahrens & Dieter (1982) "Generating gamma variates by a modified rejection
// technique" (Comm. ACM 25(1)); for shape < 1, algorithm GS from Ahrens & Dieter (1974)
// "Computer methods for sampling from gamma, beta, Poisson and binomial distributions"
// (Computing 12). These are the algorithms cited in R's ?rgamma, with the constants from the paper.
// The order in which uniforms are consumed and the parameter handling follow observed R output.

import { expRand, normRand, unifRand } from "./rng.js";
import { gammaScale } from "../distributions/gamma.js";
import { generate } from "./common.js";
import { rpois1 } from "./poisson.js";
import { rnorm1 } from "./continuous.js";

const SQRT32 = 5.656854;
const EXP_M1 = 0.36787944117144233; // exp(-1)

// q_k and a_k of algorithm GD (tables in the paper)
const Q1 = 0.04166669, Q2 = 0.02083148, Q3 = 0.00801191, Q4 = 0.00144121;
const Q5 = -7.388e-5, Q6 = 2.4511e-4, Q7 = 2.424e-4;
const A1 = 0.3333333, A2 = -0.250003, A3 = 0.2000062, A4 = -0.1662921;
const A5 = 0.1423657, A6 = -0.1367177, A7 = 0.1233795;

// Constants recomputed only when the parameters change
let aa = 0, aaa = 0;
let s = 0, s2 = 0, d = 0;
let q0 = 0, b = 0, si = 0, c = 0;

/** q(t) = log(f(x) / normal density) (steps 7 and 10 of algorithm GD) */
function qOf(t: number): number {
  const v = t / (s + s);
  if (Math.abs(v) <= 0.25) {
    return q0 + 0.5 * t * t * ((((((A7 * v + A6) * v + A5) * v + A4) * v + A3) * v + A2) * v + A1) * v;
  }
  return q0 - s * t + 0.25 * t * t + (s2 + s2) * Math.log(1 + v);
}

/** One gamma variate (shape a, scale) */
export function rgamma1(a: number, scale: number): number {
  if (Number.isNaN(a) || Number.isNaN(scale)) return NaN;
  if (a <= 0 || scale <= 0) return scale === 0 || a === 0 ? 0 : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(scale)) return Infinity;

  if (a < 1) {
    // Algorithm GS
    const e = 1 + EXP_M1 * a;
    let x: number;
    for (;;) {
      const p = e * unifRand();
      if (p >= 1) {
        x = -Math.log((e - p) / a);
        if (expRand() >= (1 - a) * Math.log(x)) break;
      } else {
        x = Math.exp(Math.log(p) / a);
        if (expRand() >= x) break;
      }
    }
    return scale * x;
  }

  // Algorithm GD. Step 1: rebuild s and d if the parameters changed
  if (a !== aa) {
    aa = a;
    s2 = a - 0.5;
    s = Math.sqrt(s2);
    d = SQRT32 - s * 12;
  }
  // Step 2: x = s + t/2 from a normal variate; if t >= 0, accept x^2 immediately
  let t = normRand();
  let x = s + 0.5 * t;
  const ret = x * x;
  if (t >= 0) return scale * ret;
  // Step 3: squeeze acceptance
  let u = unifRand();
  if (d * u <= t * t * t) return scale * ret;
  // Step 4: rebuild q0, b, si and c
  if (a !== aaa) {
    aaa = a;
    const r = 1 / a;
    q0 = ((((((Q7 * r + Q6) * r + Q5) * r + Q4) * r + Q3) * r + Q2) * r + Q1) * r;
    if (a <= 3.686) {
      b = 0.463 + s + 0.178 * s2;
      si = 1.235;
      c = 0.195 / s - 0.079 + 0.16 * s;
    } else if (a <= 13.022) {
      b = 1.654 + 0.0076 * s2;
      si = 1.68 / s + 0.275;
      c = 0.062 / s + 0.024;
    } else {
      b = 1.77;
      si = 0.75;
      c = 0.1515 / s;
    }
  }
  // Steps 5-7: quotient acceptance
  if (x > 0) {
    const q = qOf(t);
    if (Math.log(1 - u) <= q) return scale * ret;
  }
  // Steps 8-11: rejection using the double exponential distribution
  for (;;) {
    const e = expRand();
    u = unifRand();
    u = u + u - 1;
    t = u < 0 ? b - si * e : b + si * e;
    if (t >= -0.71874483771719) {
      const q = qOf(t);
      if (q > 0) {
        const w = Math.expm1(q);
        if (c * Math.abs(u) <= w * Math.exp(e - 0.5 * t * t)) break;
      }
    }
  }
  x = s + 0.5 * t;
  return scale * x * x;
}


/**
 * Random numbers from the gamma distribution. Equivalent to R's `rgamma()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param shape Shape parameter.
 * @param options.rate Rate. Default `1`. Give either `rate` or `scale`.
 * @param options.scale Scale (`1 / rate`). Default `1`. Giving both is an error unless `scale = 1 / rate`.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rgamma(2, 2, { rate: 1 }); // [0.830865, 3.570756]
 * ```
 */
export function rgamma(n: number, shape: number, options: { rate?: number; scale?: number } = {}): number[] {
  const scale = gammaScale(options);
  return generate(n, () => rgamma1(shape, scale));
}

export function rchisq1(df: number): number {
  if (!Number.isFinite(df) || df < 0) return NaN;
  return rgamma1(df / 2, 2);
}

/** One noncentral χ² variate: Poisson mixture (χ² with df + 2 × Poisson(ncp/2) degrees of freedom) */
export function rnchisq1(df: number, ncp: number): number {
  if (!Number.isFinite(df) || !Number.isFinite(ncp) || df < 0 || ncp < 0) return NaN;
  if (ncp === 0) return df === 0 ? 0 : rgamma1(df / 2, 2);
  let r = rpois1(ncp / 2);
  if (r > 0) r = rchisq1(2 * r);
  if (df > 0) r += rgamma1(df / 2, 2);
  return r;
}

/**
 * Random numbers from the chi-squared distribution. Equivalent to R's `rchisq()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param df Degrees of freedom.
 * @param options.ncp Non-centrality parameter. If omitted, the central distribution is used.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rchisq(2, 3); // [0.9433146, 5.543782]
 * rchisq(2, 3, { ncp: 1 });
 * ```
 */
export function rchisq(n: number, df: number, options: { ncp?: number } = {}): number[] {
  const { ncp } = options;
  if (ncp === undefined) return generate(n, () => rchisq1(df));
  return generate(n, () => rnchisq1(df, ncp));
}

/**
 * Random numbers from Student's t distribution. Equivalent to R's `rt()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param df Degrees of freedom (may be `Infinity`).
 * @param options.ncp Non-centrality parameter. If omitted, the central distribution is used.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rt(2, 5); // [-0.6576941, -0.5973472]
 * ```
 */
export function rt(n: number, df: number, options: { ncp?: number } = {}): number[] {
  const { ncp } = options;
  if (ncp === undefined) {
    return generate(n, () => {
      if (Number.isNaN(df) || df <= 0) return NaN;
      if (!Number.isFinite(df)) return normRand();
      const num = normRand();
      return num / Math.sqrt(rchisq1(df) / df);
    });
  }
  // Noncentral t: as in R, generate n normal variates first, then n χ² variates
  if (Number.isNaN(ncp)) return generate(n, () => NaN);
  const z = generate(n, () => rnorm1(ncp, 1));
  const v = rchisq(n, df);
  return z.map((zi, i) => zi / Math.sqrt(v[i]! / df));
}

/**
 * Random numbers from the F distribution. Equivalent to R's `rf()`.
 *
 * @param n Number of values to generate (fractions are truncated, as in R).
 * @param df1 Numerator degrees of freedom.
 * @param df2 Denominator degrees of freedom.
 * @param options.ncp Non-centrality parameter. If omitted, the central distribution is used.
 * @returns An array of `n` values; `NaN` for invalid parameters.
 *
 * @example
 * ```ts
 * setSeed(1);
 * rf(2, 3, 10); // [0.2025231, 1.645713]
 * ```
 */
export function rf(n: number, df1: number, df2: number, options: { ncp?: number } = {}): number[] {
  const { ncp } = options;
  if (ncp === undefined) {
    return generate(n, () => {
      if (Number.isNaN(df1) || Number.isNaN(df2) || df1 <= 0 || df2 <= 0) return NaN;
      const a = Number.isFinite(df1) ? rchisq1(df1) / df1 : 1;
      const b = Number.isFinite(df2) ? rchisq1(df2) / df2 : 1;
      return a / b;
    });
  }
  // Noncentral F: as in R, generate n noncentral χ² variates first, then n χ² variates
  const x = rchisq(n, df1, { ncp });
  const y = rchisq(n, df2);
  return x.map((xi, i) => xi / df1 / (y[i]! / df2));
}
