// Weibull distribution dweibull / pweibull / qweibull.
//
// With u = x / scale and t = u^shape, P[X > x] = exp(-t) and
// f(x) = (shape / scale) exp((shape - 1) log u - t).
// t is formed in double-double (the relative error of exp(-t) equals the absolute error of t, and the rounding
// of t^shape is amplified shape times). For infinite parameters the defining formula is evaluated as is, to match
// R's output (where Inf and NaN appear).

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { ddExp, expNeg, log1mExp, logOneMinusExpNeg, standardizeDD } from "../internal/ddexp.js";
import { ddLog, ddMulNum, ddSub, type DD } from "../special/dd.js";

/** Parameters of the Weibull distribution (besides the positional `shape`). */
export interface WeibullParams {
  /** Scale. Default `1`. */
  scale?: number;
}

/** 1^y = 1, as with C's pow (JS Math.pow(1, Infinity) is NaN) */
function cpow(a: number, b: number): number {
  return a === 1 ? 1 : Math.pow(a, b);
}

/** log u (u = x / scale) in double-double. x > 0, finite parameters */
function logU(x: number, scale: number): DD {
  return ddLog(scale === 1 ? [x, 0] : standardizeDD(x, 0, scale));
}

function allFinite(...v: number[]): boolean {
  return v.every(Number.isFinite);
}

export function dweibull1(x: number, shape: number, scale: number, log: boolean): number {
  if (Number.isNaN(x) || Number.isNaN(shape) || Number.isNaN(scale)) return NaN;
  if (!(shape > 0) || !(scale > 0)) return NaN;
  if (x < 0 || x === Infinity) return d0(log);
  if (x === 0 && shape < 1) return Infinity;
  if (!allFinite(shape, scale)) {
    // The defining formula as is
    const t1 = cpow(x / scale, shape - 1);
    const t2 = t1 * (x / scale);
    return log ? -t2 + Math.log((shape * t1) / scale) : (shape * t1 * Math.exp(-t2)) / scale;
  }
  if (x === 0) {
    if (shape > 1) return d0(log);
    return log ? -Math.log(scale) : 1 / scale;
  }
  const lu = logU(x, scale);
  const t = ddExp(ddMulNum(lu, shape));
  if (t[0] === Infinity) return d0(log);
  // E = (shape - 1) log u - t
  const e = ddSub(shape === 1 ? [0, 0] : ddMulNum(lu, shape - 1), t);
  if (log) return Math.log(shape / scale) + e[0] + e[1];
  return (shape / scale) * Math.exp(e[0]) * (1 + e[1]);
}

export function pweibull1(q: number, shape: number, scale: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(q) || Number.isNaN(shape) || Number.isNaN(scale)) return NaN;
  if (!(shape > 0) || !(scale > 0)) return NaN;
  if (q <= 0) return dt0(lowerTail, logP);
  let t: DD;
  if (!allFinite(q, shape, scale)) {
    t = [cpow(q / scale, shape), 0];
    if (Number.isNaN(t[0])) return NaN;
  } else {
    t = ddExp(ddMulNum(logU(q, scale), shape));
  }
  if (!lowerTail) return logP ? -t[0] - t[1] : expNeg(t);
  const s = t[0] + t[1];
  return logP ? logOneMinusExpNeg(t) : -Math.expm1(-s);
}

export function qweibull1(p: number, shape: number, scale: number, lowerTail: boolean, logP: boolean): number {
  if (Number.isNaN(p) || Number.isNaN(shape) || Number.isNaN(scale)) return NaN;
  if (!(shape > 0) || !(scale > 0)) return NaN;
  const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
  if (b !== undefined) return b;
  // -log P[X > x] = t
  let lu: number;
  if (logP) lu = lowerTail ? log1mExp(p) : p;
  else lu = lowerTail ? Math.log1p(-p) : Math.log(p);
  return scale * cpow(-lu, 1 / shape);
}

/**
 * Density of the Weibull distribution. Equivalent to R's `dweibull(x, shape, scale = 1, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `scale` (see {@link WeibullParams}) and `log` (see {@link DensityOptions}).
 * @returns The density (or log density).
 *
 * @example
 * ```ts
 * dweibull(1, 2);               // 0.7357588823428847
 * dweibull(1, 2, { scale: 3 }); // 0.1988531815143044
 * ```
 */
export function dweibull<T extends Vectorizable>(
  x: T,
  shape: number,
  options: WeibullParams & DensityOptions = {},
): VectorResult<T> {
  const { scale = 1, log = false } = options;
  return vectorize(x, (v) => dweibull1(v, shape, scale, log));
}

/**
 * Distribution function of the Weibull distribution. Equivalent to R's `pweibull(q, shape, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `scale` (see {@link WeibullParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * pweibull(1, 2);               // 0.6321205588285577
 * pweibull(2, 1.5, { scale: 3 }); // 0.41977020402532716
 * ```
 */
export function pweibull<T extends Vectorizable>(
  q: T,
  shape: number,
  options: WeibullParams & TailOptions = {},
): VectorResult<T> {
  const { scale = 1, lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => pweibull1(v, shape, scale, lowerTail, logP));
}

/**
 * Quantile function of the Weibull distribution. Equivalent to R's `qweibull(p, shape, scale = 1, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param shape - Shape parameter.
 * @param options - `scale` (see {@link WeibullParams}), `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qweibull(0.5, 2);               // 0.8325546111576977
 * qweibull(0.9, 1.5, { scale: 3 }); // 5.231164540789235
 * ```
 */
export function qweibull<T extends Vectorizable>(
  p: T,
  shape: number,
  options: WeibullParams & TailOptions = {},
): VectorResult<T> {
  const { scale = 1, lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qweibull1(v, shape, scale, lowerTail, logP));
}
