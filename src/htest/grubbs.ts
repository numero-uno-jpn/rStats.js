// Grubbs' single-outlier test, type 10 (Grubbs 1950; Pearson & Sekar 1936).
// Implemented from the published statistic and the independently checked Pearson–Sekar transform;
// no package implementation or R source is used.

import { groupMoments, standardize } from "../internal/summary.js";
import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { pt } from "../distributions/t.js";
import type { Sample } from "./types.js";

/**
 * Options for {@link grubbsTest}.
 *
 * @category Hypothesis tests
 */
export interface GrubbsTestOptions {
  /** Grubbs test type. Only 10 is supported in 1.9.0. Default 10. */
  type?: 10 | 11 | 20;
  /** Test the lowest rather than the highest observation. Default false. */
  opposite?: boolean;
  /** Use a two-sided p-value. Default false. */
  twoSided?: boolean;
}

/**
 * Result of Grubbs' test for one outlier.
 *
 * @category Hypothesis tests
 */
export interface GrubbsTestResult {
  method: string;
  statistic: [number, number];
  statisticName: ["G", "U"];
  pValue: number;
  alternative: string;
  warnings: string[];
}

/** Pearson–Sekar CDF of the type-10 Grubbs statistic. */
function pgrubbs10(q: number, n: number): number {
  if (Number.isNaN(q) || Number.isNaN(n)) return NaN;
  if (!Number.isInteger(n) || n < 3) return NaN;
  if (q <= 0) return 0;
  const den = (n - 1) ** 2 - n * q * q;
  if (den <= 0) return 1;
  const t = q * Math.sqrt((n * (n - 2)) / den);
  const p = 1 - n * pt(-t, n - 2);
  return Math.max(0, Math.min(1, p));
}

/**
 * Cumulative distribution of the type-10 Grubbs statistic. Vectorised over q.
 * Equivalent to the public R helper `outliers::pgrubbs()` for type 10.
 *
 * @param q Statistic value(s).
 * @param n Sample size.
 * @param type Only 10 is supported; 11 and 20 are intentionally deferred.
 *
 * @category Distributions
 */
export function pgrubbs<T extends Vectorizable>(q: T, n: number, type: number = 10): VectorResult<T> {
  if (type !== 10) throw new RangeError(`Grubbs type ${type} is not supported in rStats.js 1.9.0 (type 10 only)`);
  return vectorize(q, (v) => pgrubbs10(v, n));
}

/** Invert the monotone type-10 CDF by bisection on the bounded Grubbs statistic. */
function qgrubbs10(p: number, n: number): number {
  if (Number.isNaN(p) || Number.isNaN(n)) return NaN;
  if (!Number.isInteger(n) || n < 3 || p < 0 || p > 1) return NaN;
  if (p === 1) return (n - 1) / Math.sqrt(n);
  let lo = 0;
  let hi = (n - 1) / Math.sqrt(n);
  for (let i = 0; i < 80; i++) {
    const mid = lo + (hi - lo) / 2;
    if (pgrubbs10(mid, n) < p) lo = mid;
    else hi = mid;
  }
  return lo + (hi - lo) / 2;
}

/**
 * Quantile of the type-10 Grubbs statistic. Vectorised over p.
 * Equivalent to the public R helper `outliers::qgrubbs()` for type 10.
 *
 * @param p Probability value(s).
 * @param n Sample size.
 * @param type Only 10 is supported; 11 and 20 are intentionally deferred.
 *
 * @category Distributions
 */
export function qgrubbs<T extends Vectorizable>(p: T, n: number, type: number = 10): VectorResult<T> {
  if (type !== 10) throw new RangeError(`Grubbs type ${type} is not supported in rStats.js 1.9.0 (type 10 only)`);
  return vectorize(p, (v) => qgrubbs10(v, n));
}

/**
 * Grubbs' test for one outlier. Type 10 selects the highest or lowest observation and reports G and U.
 * NaN observations are omitted; infinities are rejected. A constant sample has undefined statistics and p = NaN.
 *
 * Equivalent to the public R function `outliers::grubbs.test()` for type 10.
 *
 * @param x Numeric sample.
 * @param options Type, tail and sidedness.
 *
 * @category Hypothesis tests
 */
export function grubbsTest(x: Sample, options: GrubbsTestOptions = {}): GrubbsTestResult {
  const type = options.type ?? 10;
  if (type !== 10) throw new RangeError(`Grubbs type ${type} is not supported in rStats.js 1.9.0 (type 10 only)`);
  const values = Array.from(x).filter((v) => !Number.isNaN(v));
  if (values.some((v) => !Number.isFinite(v))) throw new RangeError("x must contain finite values");
  const n = values.length;
  if (n < 3) throw new RangeError("sample size must be at least 3");
  const opposite = options.opposite ?? false;
  const twoSided = options.twoSided ?? false;
  let extreme = values[0]!;
  for (let i = 1; i < values.length; i++) {
    if (opposite ? values[i]! < extreme : values[i]! > extreme) extreme = values[i]!;
  }
  const z = standardize(values);
  const index = values.indexOf(extreme);
  const G = Math.abs(z[index]!);
  const rest = values.slice();
  rest.splice(index, 1);
  const moments = groupMoments([values, rest]);
  const U = ((n - 2) * moments.variance[1]!) / ((n - 1) * moments.variance[0]!);
  const cdf = pgrubbs10(G, n);
  const pValue = Number.isNaN(G) ? NaN : twoSided ? 2 * Math.min(cdf, 1 - cdf) : 1 - cdf;
  const direction = opposite ? "lowest" : "highest";
  return {
    method: "Grubbs test for one outlier",
    statistic: [G, U],
    statisticName: ["G", "U"],
    pValue,
    alternative: `${direction} value ${String(extreme)} is an outlier`,
    warnings: [],
  };
}
