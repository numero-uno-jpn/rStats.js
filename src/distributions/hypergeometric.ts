// Hypergeometric distribution dhyper / phyper / qhyper (same arguments as R: k balls drawn from m white and n black).
//
// Probabilities use Loader's (2000) decomposition into binomial probabilities:
//   p(x) = b(x; m, p) b(k - x; n, p) / b(k; m + n, p),   p = k / (m + n)
// The exponents of the three binomial probabilities are added and subtracted in double-double before taking exp.
// The distribution function sums the tail far from the mean directly as p(x) × Σ (products of ratios of adjacent
// probabilities) (products and sums in double-double). Quantiles use an integer search on the distribution function.

import { vectorize, type Vectorizable, type VectorResult } from "../internal/vectorize.js";
import { d0, dt0, dt1, quantileBoundaries, type DensityOptions, type TailOptions } from "../internal/dpq.js";
import { discreteQuantile } from "../internal/discrete.js";
import { countAtMost, nonInt, roundHalfEven } from "../internal/integer.js";
import { bd0dd, dbinomExponent } from "../special/loader.js";
import { ddAdd, ddDiv, ddLog, ddMul, ddNeg, ddSub, twoProd, twoSum, type DD } from "../special/dd.js";
import { qnorm } from "./normal.js";
import { dbinom1, pbinom1, qbinom1 } from "./binomial.js";

/** A probability held in the form exp(-e) / sqrt(denom) (e is double-double) */
interface ExpForm {
  e: DD;
  logDenom: number;
}

/**
 * Binomial probability b(x; x + nmx, p) as an ExpForm (0 <= x, 0 <= nmx, 0 < p < 1).
 * At the ends (x = 0 or nmx = 0), q^n / p^n is represented by the exponent alone.
 */
function binomForm(x: number, nmx: number, p: DD, q: DD): ExpForm {
  if (x === 0 && nmx === 0) return { e: [0, 0], logDenom: 0 };
  if (x === 0 || nmx === 0) {
    // q^n (x = 0) or p^n (nmx = 0)
    const n = x + nmx;
    const [a, b] = x === 0 ? [q, p] : [p, q];
    // When the base is close to 1 (the other side b is small), avoid cancellation with n log a = -bd0(n, n a) - n b
    const e = b[0] < 0.1 ? ddAdd(bd0dd(n, ddMul([n, 0], a)), ddMul([n, 0], b)) : ddNeg(ddMul([n, 0], ddLog(a)));
    return { e, logDenom: 0 };
  }
  return dbinomExponent(x, nmx, p, q);
}

/** ExpForm of p(x) (x an integer in the support, 0 < k < m + n) */
function hyperForm(x: number, m: number, n: number, k: number): ExpForm {
  const N = m + n;
  const p = ddDiv([k, 0], [N, 0]);
  const q = ddDiv([N - k, 0], [N, 0]);
  const f1 = binomForm(x, m - x, p, q);
  const f2 = binomForm(k - x, n - k + x, p, q);
  const f3 = binomForm(k, N - k, p, q);
  return {
    e: ddSub(ddAdd(f1.e, f2.e), f3.e),
    logDenom: f1.logDenom + f2.logDenom - f3.logDenom,
  };
}

/** exp(-e) / sqrt(exp(logDenom)) × s. Rounding happens once at the end even for results near subnormal */
function evalForm(f: ExpForm, s: number): number {
  const [eh, el] = f.e;
  const scale = s * Math.exp(-0.5 * f.logDenom);
  if (eh < 700) return Math.exp(-eh) * (1 - el) * scale;
  return Math.exp(700 - eh) * (1 - el) * scale * Math.exp(-700);
}

function logForm(f: ExpForm): number {
  return -f.e[0] - f.e[1] - 0.5 * f.logDenom;
}

/**
 * Whether m + n is exact in double precision. Beyond 2^53 it may round (1 + 1e16 to 1e16: k = 1e16 was taken for the
 * whole population and dhyper(0, 1, 1e16, 1e16) was 1 for 1e-16; issue #118), and the probabilities inside the support
 * are then NaN, as for the other integers beyond 2^53 (the ends, 0 and 1, and the binomial limit still answer)
 */
function exactTotal(m: number, n: number): boolean {
  return twoSum(m, n)[1] === 0;
}

/** Support [lo, hi] */
function support(m: number, n: number, k: number): [number, number] {
  return [Math.max(0, k - n), Math.min(k, m)];
}

export function dhyper1(x: number, m: number, n: number, k: number, log: boolean): number {
  if ([x, m, n, k].some(Number.isNaN)) return NaN;
  if (![m, n, k].every(Number.isFinite) || nonInt(m) || nonInt(n) || nonInt(k)) return NaN;
  m = roundHalfEven(m);
  n = roundHalfEven(n);
  k = roundHalfEven(k);
  if (m < 0 || n < 0 || k < 0 || k > m + n) return NaN;
  if (binomialLimit(m, n, k)) return dbinom1(x, k, whiteFraction(m, n), log);
  if (nonInt(x)) return d0(log);
  x = roundHalfEven(x);
  const [lo, hi] = support(m, n, k);
  if (x < lo || x > hi) return d0(log);
  if (k === 0) return log ? 0 : 1;
  if (!exactTotal(m, n)) return NaN;
  if (k === m + n) return log ? 0 : 1;
  const f = hyperForm(x, m, n, k);
  return log ? logForm(f) : evalForm(f, 1);
}

/** a b / (c d) in double-double (a..d integers) */
function ratio(a: number, b: number, c: number, d: number): DD {
  return ddDiv(twoProd(a, b), twoProd(c, d));
}

/**
 * Sum of the tail far from the mean. If lower, P[X <= x] = p(x) Σ_{j>=0} p(x-j)/p(x);
 * otherwise P[X >= x] = p(x) Σ p(x+j)/p(x). Returns the sum S = Σ p(x∓j)/p(x).
 */
function tailSum(x: number, m: number, n: number, k: number, lower: boolean, lo: number, hi: number): number {
  let t: DD = [1, 0];
  let s: DD = [1, 0];
  let y = x;
  for (;;) {
    if (lower ? y <= lo : y >= hi) break;
    // Ratio p(y-1)/p(y) = y (n - k + y) / ((m - y + 1)(k - y + 1))
    //    p(y+1)/p(y) = (m - y)(k - y) / ((y + 1)(n - k + y + 1))
    const r = lower ? ratio(y, n - k + y, m - y + 1, k - y + 1) : ratio(m - y, k - y, y + 1, n - k + y + 1);
    t = ddMul(t, r);
    s = ddAdd(s, t);
    y += lower ? -1 : 1;
    // Moving away from the mean, the ratio decreases monotonically. The remaining sum is bounded by t r / (1 - r)
    const rr = r[0];
    if (rr < 1 && (t[0] * rr) / (1 - rr) < s[0] * 2 ** -60) break;
  }
  return s[0] + s[1];
}

/** P[X <= x] (lowerTail) / P[X > x] at an integer x inside the support (lo <= x < hi) */
function phyperRaw(x: number, m: number, n: number, k: number, lowerTail: boolean, logP: boolean): number {
  const [lo, hi] = support(m, n, k);
  const N = m + n;
  // Below the mean k m / N sum the lower tail directly; otherwise the upper tail P[X >= x + 1]
  let lowerSide = x * N < k * m;
  let tail = directTail(x, m, n, k, lowerSide, lo, hi);
  if (tail.value > 0.5) {
    // When the mean is near an end of the support, even the side far from the mean can exceed 1/2. Sum the other
    // side directly too and use the smaller (so that the log of a value near 1 is formed from 1 - (other side))
    const other = directTail(x, m, n, k, !lowerSide, lo, hi);
    if (other.value < tail.value) {
      tail = other;
      lowerSide = !lowerSide;
    }
  }
  if (lowerSide === lowerTail) {
    if (!logP) return tail.value;
    return tail.value > 1e-300 ? Math.log(tail.value) : logForm(tail.form) + Math.log(tail.sum);
  }
  return logP ? Math.log1p(-tail.value) : 1 - tail.value;
}

/** P[X <= x] (lowerSide) or P[X >= x + 1], computed directly as the probability at the tail's end × the sum of ratios */
function directTail(x: number, m: number, n: number, k: number, lowerSide: boolean, lo: number, hi: number) {
  const start = lowerSide ? x : x + 1;
  const form = hyperForm(start, m, n, k);
  const sum = tailSum(start, m, n, k, lowerSide, lo, hi);
  return { form, sum, value: evalForm(form, sum) };
}

/** Check and round the parameters of phyper / qhyper. undefined if invalid */
/** m / (m + n) without forming m + n, which may overflow */
export function whiteFraction(m: number, n: number): number {
  return m >= n ? 1 / (1 + n / m) : n / m === Infinity ? 0 : m / n / (1 + m / n);
}

/**
 * Whether k draws from m + n differ from k independent draws by less than double precision: k / (m + n) < 2^-60 (the
 * hypergeometric and Bin(k, m / (m + n)) probabilities differ by a relative k / (m + n) or so). Always so when m + n
 * overflows with k below 2^290, where the exact computation (which forms m + n) gave NaN
 */
function binomialLimit(m: number, n: number, k: number): boolean {
  return k > 0 && k < m * 2 ** -60 + n * 2 ** -60;
}

function hyperParams(m: number, n: number, k: number): [number, number, number] | undefined {
  if (![m, n, k].every(Number.isFinite)) return undefined;
  m = roundHalfEven(m);
  n = roundHalfEven(n);
  k = roundHalfEven(k);
  if (m < 0 || n < 0 || k < 0 || k > m + n) return undefined;
  return [m, n, k];
}

export function phyper1(q: number, m: number, n: number, k: number, lowerTail: boolean, logP: boolean): number {
  if ([q, m, n, k].some(Number.isNaN)) return NaN;
  const params = hyperParams(m, n, k);
  if (params === undefined) return NaN;
  [m, n, k] = params;
  if (binomialLimit(m, n, k)) return pbinom1(q, k, whiteFraction(m, n), lowerTail, logP);
  const x = countAtMost(q);
  const [lo, hi] = support(m, n, k);
  if (x < lo) return dt0(lowerTail, logP);
  if (x >= hi) return dt1(lowerTail, logP);
  if (hi > MAX_EXACT || !exactTotal(m, n)) return NaN;
  const terms = phyperTerms(x, m, n, k, lo, hi);
  if (terms > MAX_TERMS) {
    throw new RangeError(
      `phyper: m = ${m}, n = ${n}, k = ${k} needs about ${Math.round(terms)} terms at q = ${q} (at most 2^26)`,
    );
  }
  return phyperRaw(x, m, n, k, lowerTail, logP);
}

/** Variance of the hypergeometric distribution (N = m + n) */
function hyperVariance(m: number, n: number, k: number, N: number): number {
  return (((k * m) / N) * (n / N) * (N - k)) / Math.max(N - 1, 1);
}

/**
 * Estimated number of terms of tailSum from start (lower: downwards), from the normal approximation: the terms fall
 * below 2^-60 of the sum about where (v^2 - u^2) / (2 sigma^2) = 60 ln 2 (u, v: signed distances of start and of the
 * last term past the mean in the direction of the sum), so about sqrt(u^2 + 83 sigma^2) - u terms, and at most the
 * distance to the end of the support. (Counted with a copy of the loop for sigma up to 4e4: at most 1.02 times this.)
 */
function tailTerms(start: number, lower: boolean, mu: number, variance: number, lo: number, hi: number): number {
  const u = lower ? mu - start : start - mu;
  const w = Math.sqrt(u * u + 83 * variance);
  return Math.min(u >= 0 ? (83 * variance) / (w + u) : w - u, lower ? start - lo : hi - start);
}

/**
 * Estimated number of terms phyperRaw sums at x: the tail away from the mean, and the other one as well where the
 * first may exceed 1/2, which needs x within 1 of the mean (the median of the distribution is that close to it)
 */
function phyperTerms(x: number, m: number, n: number, k: number, lo: number, hi: number): number {
  const N = m + n;
  const mu = (k * m) / N;
  const variance = hyperVariance(m, n, k, N);
  const lowerSide = x * N < k * m;
  const start = lowerSide ? x : x + 1;
  const far = tailTerms(start, lowerSide, mu, variance, lo, hi);
  if (Math.abs(start - mu) >= 1) return far;
  return far + tailTerms(lowerSide ? x + 1 : x, !lowerSide, mu, variance, lo, hi);
}

/**
 * Bounds on the time of phyper and qhyper (the tail sums take about 80 to 170 ns per term on the development machine):
 * phyper's estimated number of terms at most 2^26 (about 10 s; sigma about 7e6 at the center), qhyper's standard
 * deviation at most 2^21 (its search calls the distribution function a few times, about 2.5 times 9.1 sigma terms)
 */
const MAX_TERMS = 2 ** 26;
const MAX_QHYPER_SIGMA = 2 ** 21;

/**
 * Largest upper end of the support for phyper and qhyper: the tail sums step through the integers one by one, which
 * beyond 2^53 no longer move (phyper(5e16, 1e17, 1e17, 1e17) did not return), so the answer is NaN there, as for
 * other integers beyond 2^53. Below it the time grows as the standard deviation, bounded by MAX_TERMS and
 * MAX_QHYPER_SIGMA
 */
const MAX_EXACT = 2 ** 53;

/** (limitTime false: without the bound on sigma, for rhyper's inversion, which is unchanged) */
export function qhyper1(
  p: number,
  m: number,
  n: number,
  k: number,
  lowerTail: boolean,
  logP: boolean,
  limitTime = true,
): number {
  if ([p, m, n, k].some(Number.isNaN)) return NaN;
  const params = hyperParams(m, n, k);
  if (params === undefined) return NaN;
  [m, n, k] = params;
  if (binomialLimit(m, n, k)) return qbinom1(p, k, whiteFraction(m, n), lowerTail, logP);
  const [lo, hi] = support(m, n, k);
  const b = quantileBoundaries(p, lo, hi, lowerTail, logP);
  if (b !== undefined) return b;
  if (lo === hi) return lo;
  if (hi > MAX_EXACT || !exactTotal(m, n)) return NaN;
  const N = m + n;
  const mu = (k * m) / N;
  const sigma = Math.sqrt(hyperVariance(m, n, k, N));
  if (limitTime && sigma > MAX_QHYPER_SIGMA) {
    throw new RangeError(
      `qhyper: m = ${m}, n = ${n}, k = ${k} has a standard deviation of about ${sigma.toPrecision(3)} (at most 2^21)`,
    );
  }
  const z = qnorm(p, { lowerTail, logP });
  const y0 = mu + sigma * z;
  return discreteQuantile({
    p,
    lowerTail,
    logP,
    cdf: (y, l, lg) => (y < lo ? dt0(l, lg) : y >= hi ? dt1(l, lg) : phyperRaw(y, m, n, k, l, lg)),
    y0: Number.isFinite(y0) ? y0 : mu,
    lo,
    hi,
  });
}

/**
 * Probability mass function of the hypergeometric distribution (number of white balls among `k` drawn without replacement from an urn of `m` white and `n` black balls). Equivalent to R's `dhyper(x, m, n, k, log = FALSE)`.
 *
 * @param x - Value(s) at which to evaluate: a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Number of white balls in the urn.
 * @param n - Number of black balls in the urn.
 * @param k - Number of balls drawn.
 * @param options - `log` (see {@link DensityOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * dhyper(2, 10, 7, 8);          // 0.012957630604689432
 * dhyper([0, 1], 10, 7, 8);     // [0, 0.00041135335252982303]
 * ```
 *
 * @category Distributions
 */
export function dhyper<T extends Vectorizable>(
  x: T,
  m: number,
  n: number,
  k: number,
  options: DensityOptions = {},
): VectorResult<T> {
  const log = options.log ?? false;
  return vectorize(x, (v) => dhyper1(v, m, n, k, log));
}

/**
 * Distribution function of the hypergeometric distribution (number of white balls among `k` drawn without replacement from an urn of `m` white and `n` black balls). Equivalent to R's `phyper(q, m, n, k, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param q - Quantile(s): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Number of white balls in the urn.
 * @param n - Number of black balls in the urn.
 * @param k - Number of balls drawn.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The probability (or log probability).
 *
 * @example
 * ```ts
 * phyper(2, 10, 7, 8);                       // 0.013368983957219256
 * phyper(5, 10, 7, 8, { lowerTail: false }); // 0.21781160016454126
 * ```
 *
 * @category Distributions
 */
export function phyper<T extends Vectorizable>(
  q: T,
  m: number,
  n: number,
  k: number,
  options: TailOptions = {},
): VectorResult<T> {
  const { lowerTail = true, logP = false } = options;
  return vectorize(q, (v) => phyper1(v, m, n, k, lowerTail, logP));
}

/**
 * Quantile function of the hypergeometric distribution (number of white balls among `k` drawn without replacement from an urn of `m` white and `n` black balls). Equivalent to R's `qhyper(p, m, n, k, lower.tail = TRUE, log.p = FALSE)`.
 *
 * @param p - Probability (or log probability with `logP`): a number, `number[]` or `Float64Array`. The result has the same shape.
 * @param m - Number of white balls in the urn.
 * @param n - Number of black balls in the urn.
 * @param k - Number of balls drawn.
 * @param options - `lowerTail` and `logP` (see {@link TailOptions}).
 * @returns The quantile(s).
 *
 * @example
 * ```ts
 * qhyper(0.5, 10, 7, 8);          // 5
 * qhyper([0.05, 0.95], 10, 7, 8); // [3, 6]
 * ```
 *
 * @category Distributions
 */
export function qhyper<T extends Vectorizable>(
  p: T,
  m: number,
  n: number,
  k: number,
  options: TailOptions = {},
): VectorResult<T> {
  const { lowerTail = true, logP = false } = options;
  return vectorize(p, (v) => qhyper1(v, m, n, k, lowerTail, logP));
}
