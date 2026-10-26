// Cauchy distribution dcauchy / pcauchy / qcauchy.
//
// With z = (x - location) / scale, f(x) = 1 / (π scale (1 + z^2)) and
// P[X <= x] = 1/2 + atan(z)/π. For |z| > 1 the smaller tail is computed directly as atan(1/|z|)/π,
// avoiding subtraction from 1/2 and overflow of z^2. Quantiles compute tan(π (p - 1/2)) as
// -1/tan(π p) for p < 1/4 and -tan(π (1/2 - p)) for 1/4 <= p <= 1/2.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { type DensityOptions, type TailOptions } from "../internal/dpq.js";
import type { LocationScaleParams } from "./logistic.js";
import { locationScale } from "../internal/ddexp.js";

const LOG_PI = 1.1447298858494002;

export function dcauchy1(x: number, location: number, scale: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(location) || Number.isNaN(scale)) return NaN;
  if (!(scale > 0)) return NaN;
  const z = (x - location) / scale;
  if (Number.isNaN(z)) return NaN;
  const az = Math.abs(z);
  if (az <= 1) {
    if (log) return -(LOG_PI + Math.log(scale)) - Math.log1p(z * z);
    return 1 / (Math.PI * scale * (1 + z * z));
  }
  // With y = 1/z, f = y^2 / (π scale (1 + y^2))
  const y = 1 / az;
  if (log) return -(LOG_PI + Math.log(scale)) - 2 * Math.log(az) - Math.log1p(y * y);
  return (y / (Math.PI * scale)) * (y / (1 + y * y));
}

/**
 * P[X <= q] (lower) / P[X > q] (!lower). For |z| > 1 the smaller tail atan(1/|z|)/π is computed without forming z,
 * using 1/|z| = scale / |q - location| (so the log value survives even if z overflows)
 */
export function pcauchy1(q: number, location: number, scale: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(location) || Number.isNaN(scale)) return NaN;
  if (!(scale > 0)) return NaN;
  const d = q - location;
  if (Number.isNaN(d)) return NaN;
  if (!(Math.abs(d) > scale)) {
    const z = d / scale;
    const v = 0.5 + Math.atan(lowerTail ? z : -z) / Math.PI;
    return logP ? Math.log(v) : v;
  }
  // Probability of the smaller side v = atan(w)/π (w = 1/|z|)
  const w = scale / Math.abs(d);
  const v = Math.atan(w) / Math.PI;
  const small = lowerTail === d < 0;
  if (small) {
    if (!logP) return v;
    // atan(w) = w (1 - w^2/3 + ...). For small w use log w directly (survives even if w underflows)
    return w < 1e-150 ? Math.log(scale) - Math.log(Math.abs(d)) - LOG_PI : Math.log(v);
  }
  return logP ? Math.log1p(-v) : 1 - v;
}

const TINY = 1e-200;
const TINY_LOG = -460;

/**
 * scale |T| = scale / tan(π s) ≈ scale / (π s) when the probability on that side is tiny.
 * When π s is subnormal, 1 / (π s) overflows and loses accuracy, so change the order of division.
 * With logP (s is a log), multiply by e^-s split into two halves (taking log and exp back would amplify the rounding of the exponent)
 */
function tinyTail(scale: number, s: number, logP: boolean): number {
  if (!logP) return scale / s / Math.PI;
  const h = Math.exp(-s / 2);
  return h * (scale / Math.PI) * h;
}

/** Quantile tan(π (s - 1/2)) of the standard Cauchy for lower probability s (0 < s <= 1/2) */
function quantileSmall(s: number): number {
  if (s <= 0.25) return -1 / Math.tan(Math.PI * s);
  return -Math.tan(Math.PI * (0.5 - s));
}

export function qcauchy1(p: number, location: number, scale: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(location) || Number.isNaN(scale)) return NaN;
  if (logP ? p > 0 : p < 0 || p > 1) return NaN;
  if (!(scale > 0) || !Number.isFinite(scale)) return scale === 0 ? location : NaN;
  // Standard quantile T for the probability p on that side (x = location + scale T for the lower tail)
  let t: number;
  if (logP) {
    if (p === 0) t = Infinity;
    else if (p === -Infinity) t = -Infinity;
    else if (p < TINY_LOG) return location + (lowerTail ? -1 : 1) * tinyTail(scale, p, true);
    else t = p < -Math.LN2 ? quantileSmall(Math.exp(p)) : -quantileSmall(-Math.expm1(p));
  } else if (p === 0) t = -Infinity;
  else if (p === 1) t = Infinity;
  else if (p < TINY) return location + (lowerTail ? -1 : 1) * tinyTail(scale, p, false);
  else t = p <= 0.5 ? quantileSmall(p) : -quantileSmall(1 - p);
  return locationScale(location, scale, lowerTail ? t : -t);
}

/**
 * Density of the Cauchy distribution. Equivalent to R's `dcauchy(x, location = 0, scale = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `location` and `scale` (see {@link LocationScaleParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dcauchy(0);                             // 0.3183098861837907
 * dcauchy(1, { location: 1, scale: 2 });  // 0.15915494309189535
 * ```
 *
 * @category Distributions
 */
export function dcauchy<T extends Vectorizable>(x: T, options: LocationScaleParams & DensityOptions = {}): VectorResult<T> {
  const { location = 0, scale = 1, log = false } = options;
  return vectorize(x, (v) => dcauchy1(v, location, scale, log));
}

/**
 * Distribution function of the Cauchy distribution. Equivalent to R's `pcauchy(q, location = 0, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `location` and `scale` (see {@link LocationScaleParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pcauchy(1);                             // 0.75
 * pcauchy(3, { location: 1, scale: 2 });  // 0.75
 * ```
 *
 * @category Distributions
 */
export function pcauchy<T extends Vectorizable>(q: T, options: LocationScaleParams & TailOptions = {}): VectorResult<T> {
  const { location = 0, scale = 1, lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => pcauchy1(v, location, scale, lowerTail, logP));
}

/**
 * Quantile function of the Cauchy distribution. Equivalent to R's `qcauchy(p, location = 0, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param options - `location` and `scale` (see {@link LocationScaleParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qcauchy(0.75);                          // 1.0000000000000002
 * qcauchy(0.975, { scale: 2 });           // 25.41240947234939
 * ```
 *
 * @category Distributions
 */
export function qcauchy<T extends Vectorizable>(p: T, options: LocationScaleParams & TailOptions = {}): VectorResult<T> {
  const { location = 0, scale = 1, lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qcauchy1(v, location, scale, lowerTail, logP));
}
