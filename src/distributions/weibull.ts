// Weibull distribution dweibull / pweibull / qweibull.
//
// With u = x / scale and t = u^shape, P[X > x] = exp(-t) and
// f(x) = (shape / scale) exp((shape - 1) log u - t).
// t is formed in double-double (the relative error of exp(-t) equals the absolute error of t, and the rounding
// of t^shape is amplified shape times). For infinite parameters the defining formula is evaluated as is, to match
// R's output (where Inf and NaN appear).

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { ddExp, expNeg, expNegOver, log1mExp, logOneMinusExpNeg, standardizeDD } from "../internal/ddexp.js";
import { ddDivNum, ddLog, ddMulNum, ddSub, type DD } from "../special/dd.js";

/**
 * Parameters of the Weibull distribution (besides the positional `shape`).
 *
 * @category Distributions
 */
export interface WeibullParams {
  /** Scale. Default `1`. */
  scale?: number;
}

/** 1^y = 1, as with C's pow (JS Math.pow(1, Infinity) is NaN) */
function cpow(a: number, b: number): number {
  return a === 1 ? 1 : Math.pow(a, b);
}

const MIN_NORMAL = 2 ** -1022;
const LOG_MIN_NORMAL = -1022 * Math.LN2;

/**
 * log u (u = x / scale) in double-double. x > 0, finite parameters. When x / scale is subnormal, 0 or overflows,
 * log x - log scale instead; also for x above 1e300, where the exact remainder in standardizeDD overflows
 */
function logU(x: number, scale: number): DD {
  if (scale === 1) return ddLog([x, 0]);
  const u = x / scale;
  if (u >= MIN_NORMAL && u < Infinity && x < 1e300) return ddLog(standardizeDD(x, 0, scale));
  return ddSub(ddLog([x, 0]), ddLog([scale, 0]));
}

/** a s in double-double; only the double product when s is beyond the range of Veltkamp splitting or it overflows */
function mulLarge(a: DD, s: number): DD {
  const p = a[0] * s;
  return s < 1e300 && Number.isFinite(p) ? ddMulNum(a, s) : [p, 0];
}

/** log(a / b) for positive finite a, b, also when a / b over- or underflows */
function logRatio(a: number, b: number): number {
  const r = a / b;
  return r >= MIN_NORMAL && r < Infinity ? Math.log(r) : Math.log(a) - Math.log(b);
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
  const t = ddExp(mulLarge(lu, shape));
  if (t[0] === Infinity) return d0(log);
  // E = (shape - 1) log u - t
  const m: DD = shape === 1 ? [0, 0] : mulLarge(lu, shape - 1);
  // (-Infinity where (shape - 1) log u overflows, which the double-double difference made NaN: dweibull(1.9e-255,
  // 6.6e306, scale 98.6) was NaN)
  const e = m[0] === -Infinity ? m : ddSub(m, t);
  const r = shape / scale;
  if (log) return logRatio(shape, scale) + e[0] + e[1];
  // |log(shape / scale)| < 1455, so the density underflows; for a huge shape e[1] can exceed 1 and flip the sign below
  if (e[0] < -2500) return 0;
  if (r >= MIN_NORMAL && r < Infinity && e[0] > -708) return r * Math.exp(e[0]) * (1 + e[1]);
  // shape / scale over- or underflows, or exp(E) is subnormal: fold it into the exponent
  return Math.exp(logRatio(shape, scale) + e[0]) * (1 + e[1]);
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
    const l = mulLarge(logU(q, scale), shape);
    t = ddExp(l);
    // log(1 - exp(-t)) = log t - t / 2 + ...: below e^-700 it is log t, which stays exact where t is subnormal. Where
    // t underflows to 0 the result is -Infinity, as in R (pweibull(1e-5, 1000, log.p = TRUE) is -Inf)
    if (lowerTail && logP && l[0] < -700) return t[0] === 0 ? -Infinity : l[0] + l[1];
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
  // (an infinite shape or scale is left to the forms below, which give R's NaN for Infinity times 0)
  if (logP && lowerTail && p < LOG_MIN_NORMAL && allFinite(shape, scale)) {
    // -log(1 - P) is P = exp(p) to the double, but rounded on the subnormal grid there: x = scale exp(p / shape), with
    // p / shape in double-double (qweibull(-720.6, 1, { scale: 1.36e257, logP: true }) was 5e-15 off)
    // (in double where the shape or the quotient is beyond the range of Veltkamp splitting)
    const q: DD = shape < 1e300 && Math.abs(p / shape) < 1e300 ? ddDivNum([p, 0], shape) : [p / shape, 0];
    const e = ddExp(q);
    const v = e[0] + e[1];
    if (v >= MIN_NORMAL && v < Infinity) return scale * v;
    // (exp(p / shape) itself below the normal range: divided by 1 / scale without rounding it there)
    const r = 1 / scale;
    if (r >= MIN_NORMAL && r < Infinity && q[0] < 0) return expNegOver([-q[0], -q[1]], r);
    return Math.exp(Math.log(scale) + q[0]);
  }
  let lu: number;
  if (logP) lu = lowerTail ? log1mExp(p) : p;
  else lu = lowerTail ? Math.log1p(-p) : Math.log(p);
  const v = cpow(-lu, 1 / shape);
  if ((v >= MIN_NORMAL && v < Infinity) || !allFinite(shape, scale) || v === 1) return scale * v;
  // (-lu)^(1 / shape) is subnormal, 0 or overflows although scale times it may not be: in logs
  return Math.exp(Math.log(scale) + Math.log(-lu) / shape);
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
 *
 * @category Distributions
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
 *
 * @category Distributions
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
 *
 * @category Distributions
 */
export function qweibull<T extends Vectorizable>(
  p: T,
  shape: number,
  options: WeibullParams & TailOptions = {},
): VectorResult<T> {
  const { scale = 1, lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qweibull1(v, shape, scale, lowerTail, logP));
}
