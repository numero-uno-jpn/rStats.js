// log1p-type functions of R's C API (Rmath.h: log1pmx, lgamma1p, log1mexp, log1pexp), which R does not export to R
// code; the definitions are those of Rmath and the DPQ package. The kernels are the ones rStats.js uses internally
// (log1pmx: xsf's series, src/special/log1pmx.ts; lgamma1p: src/special/gamma.ts; log(1 - exp(x)):
// src/internal/ddexp.ts); this file adds the special values and domains. log1pexp follows the switching points of
// Maechler (2012), "Accurately computing log(1 - exp(-|a|))", the Rmpfr package vignette.

import { log1mExp } from "../internal/ddexp.js";
import { lgamma1p as lgamma1pKernel } from "./gamma.js";
import { log1pmx as log1pmxKernel } from "./log1pmx.js";

/**
 * log(1 + x) - x, accurate for small |x| (where log1p(x) - x would cancel). As `log1pmx` in R's C API (Rmath.h).
 *
 * @param x A number >= -1.
 * @returns log(1 + x) - x; `-Infinity` at x = -1 and x = Infinity, `NaN` for x < -1.
 *
 * @example
 * ```ts
 * log1pmx(1e-5); // -4.9999666669166655e-11
 * ```
 */
export function log1pmx(x: number): number {
  if (Number.isNaN(x) || x < -1) return NaN;
  if (x === -1 || x === Infinity) return -Infinity;
  return log1pmxKernel(x);
}

/**
 * lgamma(1 + x) = log|Gamma(1 + x)|, accurate near x = 0 and x = 1, where it is near 0. As `lgamma1p` in R's C
 * API (Rmath.h).
 *
 * @param x A number.
 * @returns log|Gamma(1 + x)|; `Infinity` at the poles (x a negative integer) and at x = Infinity, `NaN` for
 *   x = -Infinity.
 *
 * @example
 * ```ts
 * lgamma1p(1e-10); // -5.7721566481928616e-11 (lgamma(1 + 1e-10) keeps only about 6 digits)
 * ```
 */
export function lgamma1p(x: number): number {
  if (Number.isNaN(x) || x === -Infinity) return NaN;
  if (x === Infinity) return Infinity;
  if (x <= -1 && x === Math.floor(x)) return Infinity;
  return lgamma1pKernel(x);
}

/**
 * log(1 - exp(-x)) for x >= 0, accurate for both small and large x. As `log1mexp` in R's C API (Rmath.h) and the DPQ
 * package; note the sign of the argument.
 *
 * @param x A number >= 0.
 * @returns log(1 - exp(-x)); `-Infinity` at x = 0, 0 at x = Infinity, `NaN` for x < 0.
 *
 * @example
 * ```ts
 * log1mexp(1e-10); // -23.025850929990458
 * ```
 */
export function log1mexp(x: number): number {
  if (Number.isNaN(x) || x < 0) return NaN;
  if (x === 0) return -Infinity;
  if (x === Infinity) return 0;
  return log1mExp(-x);
}

/**
 * log(1 + exp(x)), without overflow for large x and accurate for very negative x. As `log1pexp` in R's C API
 * (Rmath.h) and the DPQ package.
 *
 * @param x A number.
 * @returns log(1 + exp(x)); 0 at x = -Infinity, `Infinity` at x = Infinity.
 *
 * @example
 * ```ts
 * log1pexp(800); // 800
 * log1pexp(-40); // 4.248354255291589e-18
 * ```
 */
export function log1pexp(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x <= -37) return Math.exp(x); // log1p(e) = e to double precision
  if (x <= 18) return Math.log1p(Math.exp(x));
  if (x <= 33.3) return x + Math.exp(-x);
  return x;
}
