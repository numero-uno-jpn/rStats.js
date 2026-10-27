// Building block that sums a Poisson-weighted mixture Σ_j w_j F_j (w_j = μ^j e^-μ / j!) using positive terms only.
// Used by the distribution functions and densities of the noncentral χ² and noncentral beta (noncentral F).
//
// Noncentral distributions are Poisson mixtures of the central ones (Johnson, Kotz & Balakrishnan 1995, chapters 29 and 30).
//   P_nc = Σ_j w_j P_j,  Q_nc = 1 - P_nc = Σ_j w_j Q_j
// P_j (lower) and Q_j (upper) are both non-negative, so either tail can be computed directly without subtraction.
// The components are linked by P_j = P_{j+1} + d_j and Q_{j+1} = Q_j + d_j (d_j >= 0), so the recurrence
// runs in the direction where only additions occur (decreasing j for P, increasing j for Q).
//
// The starting index is chosen where the sum of the remaining terms is bounded by a Poisson tail:
//   lower: sum of terms j > J <= P_J Pois(> J), while the total >= P_J Pois(<= J)
//   upper: sum of terms j < J <= Q_J Pois(< J), while the total >= Q_J Pois(>= J)
// so choosing J at a Poisson tail (relative < 1e-20) gives a truncation error below 1e-20 relative, regardless of x.
// The terms w_j F_j are log-concave in j (both the Poisson weights and F_j are log-concave), so once past the peak and
// decreasing, the rest is bounded by a geometric series.
// The idea of recursing from near the peak is due to Ding (1992) and Benton & Krishnamoorthy (2003)
// (Boost.Math include/boost/math/distributions/non_central_chi_squared.hpp was also consulted;
//  BSL-1.0, see THIRD_PARTY_NOTICES.md; no code was ported).
// Computing each tail as a sum of positive terms, and the number representation below, are our own.
//
// Number representation: w_j, d_j and P_j are held as a double-double mantissa paired with an exponent 2^(500 k).
// The recurrences (w_{j+1} = w_j μ/(j+1), d_j = d_{j-1} × (ratio)) are computed in double-double, so
// rounding errors do not accumulate over thousands of steps. Since the exponent is held separately, the log answer
// (logP) is returned with good relative accuracy even when the tail falls below 1e-300.

import { ddAdd, ddDiv, ddDivNum, ddLog, ddMul, type DD } from "../special/dd.js";
import { lgamma1p } from "../special/gamma.js";
import { bd0dd, dpoisRaw, stirlerr } from "../special/loader.js";

export interface MixtureKernel {
  /** Distribution function of component j: P_j if lower, otherwise Q_j; log if log */
  cdf(j: number, lower: boolean, log: boolean): number;
  /** Increment d_j = P_j - P_{j+1} = Q_{j+1} - Q_j (>= 0); log if log */
  inc(j: number, log: boolean): number;
  /** Ratio d_j / d_{j-1} (j >= 1) as double-double. With ratioK, the value is ratio × 2^(500 ratioK) */
  ratio(j: number): DD;
  /** Exponent used when the ratio is returned scaled by 2^(-500 ratioK) to avoid underflow */
  ratioK?: number;
  /**
   * log d_j as double-double (optional). Used when d_j underflows in double, to build the mantissa more
   * accurately than from the double log (error eps × |log d_j|)
   */
  incLogDD?(j: number): DD | number;
}

/** Relative truncation error */
const TOL = 1e-17;
const LOG_TOL = Math.log(TOL);
/** Iteration limit (a safety valve for extreme parameters) */
const MAX_TERMS = 20_000_000;

// ---- Double-double with a separate exponent: value = (h + l) 2^(E k) ----
const E = 500;
const UP = 2 ** E;
const DOWN = 2 ** -E;
const HI = 2 ** 250;
const LO = 2 ** -250;
const LN_UNIT = E * Math.LN2;

interface Scaled {
  h: number;
  l: number;
  k: number;
  /**
   * Approximation built from a logarithm (relative error about eps × |log|). Advancing by recurrence would carry that error
   * into all later terms, so recompute directly once the magnitude becomes representable on the linear scale
   */
  approx?: boolean;
}

const ZERO: Scaled = { h: 0, l: 0, k: 0 };

function norm(h: number, l: number, k: number, approx = false): Scaled {
  if (h === 0) return ZERO;
  if (!Number.isFinite(h)) return { h, l: 0, k };
  while (Math.abs(h) > HI) {
    h *= DOWN;
    l *= DOWN;
    k++;
  }
  while (Math.abs(h) < LO) {
    h *= UP;
    l *= UP;
    k--;
  }
  return approx ? { h, l, k, approx } : { h, l, k };
}

/** 500 log 2 as double-double */
const LN_UNIT_DD: DD = [346.5735902799727, -2.2599635089223323e-14];

/**
 * Built from the linear value (or from the log if it underflows). If the log is available as double-double, the
 * mantissa keeps full accuracy. If built from a double log, it is flagged as approximate
 */
function fromValue(lin: number, logv: () => number | DD): Scaled {
  if (lin > 1e-305 || Number.isNaN(lin)) return norm(lin, 0, 0);
  const lv = logv();
  const [hi, lo] = typeof lv === "number" ? [lv, 0] : lv;
  if (hi === -Infinity) return ZERO;
  if (Number.isNaN(hi)) return { h: NaN, l: 0, k: 0 };
  const k = Math.round(hi / LN_UNIT);
  // Beyond 2^50 units the exponent k is not resolved to the integer (the log of the value, about -1e18 or less, is known
  // only to a few units itself), so the remainder would be meaningless: keep the exponent alone
  if (Math.abs(k) > 2 ** 50) return norm(1, 0, k, true);
  const r = ddAdd([hi, lo], ddMul(LN_UNIT_DD, [-k, 0]));
  const m = Math.exp(r[0]);
  return typeof lv === "number" ? norm(m, 0, k, true) : norm(m, m * r[1], k);
}

/** log Pois(x; λ) = log(λ^x e^-λ / Gamma(x + 1)) as double-double (x >= 0, λ > 0) */
export function dpoisLogDD(x: number, lambda: number): DD {
  if (x === 0) return [-lambda, 0];
  const DBL_MIN = 2.2250738585072014e-308;
  if (x <= lambda * DBL_MIN || lambda < x * DBL_MIN || !Number.isFinite(x)) {
    const l = ddAdd(ddMul(ddLog([lambda, 0]), [x, 0]), [-lambda - lgamma1p(x), 0]);
    return l;
  }
  // Loader: -stirlerr(x) - bd0(x, λ) - log(2 pi x)/2
  const e = ddAdd(bd0dd(x, [lambda, 0]), [stirlerr(x), 0]);
  return ddAdd([-e[0], -e[1]], [-0.5 * (LN_2PI + Math.log(x)), 0]);
}
const LN_2PI = 1.837877066409345483560659472811;

/** If still approximate and now representable on the linear scale, recompute directly */
function refresh(x: Scaled, direct: () => Scaled): Scaled {
  return x.approx === true && logOf(x) > -700 ? direct() : x;
}

function mulDD(a: Scaled, r: DD): Scaled {
  // The ratio can be 1e-300 or 1e300, so split off the exponent before multiplying (mantissa products do not overflow)
  return mul(a, norm(r[0], r[1], 0));
}

function divDD(a: Scaled, r: DD): Scaled {
  if (a.h === 0) return ZERO;
  const b = norm(r[0], r[1], 0);
  const q = ddDiv([a.h, a.l], [b.h, b.l]);
  return norm(q[0], q[1], a.k - b.k, a.approx);
}

/** d × (kernel ratio j) */
function mulRatio(d: Scaled, k: MixtureKernel, j: number): Scaled {
  const r = mulDD(d, k.ratio(j));
  return k.ratioK ? { ...r, k: r.k + k.ratioK } : r;
}

/** d ÷ (kernel ratio j) */
function divRatio(d: Scaled, k: MixtureKernel, j: number): Scaled {
  const r = divDD(d, k.ratio(j));
  return k.ratioK ? { ...r, k: r.k - k.ratioK } : r;
}

function mul(a: Scaled, b: Scaled): Scaled {
  if (a.h === 0 || b.h === 0) return ZERO;
  const p = ddMul([a.h, a.l], [b.h, b.l]);
  return norm(p[0], p[1], a.k + b.k, a.approx === true || b.approx === true);
}

/**
 * Multiply by 2^(E (from - to)) to align to exponent to (to >= from). The mantissa is below 2^1024, so from three
 * steps on the result is 0 (the exponents can differ by 1e40 when a term is e^-1e42)
 */
function shift(h: number, l: number, from: number, to: number): DD {
  if (to - from >= 3) return [0, 0];
  for (let i = from; i < to && h !== 0; i++) {
    h *= DOWN;
    l *= DOWN;
  }
  return [h, l];
}

function add(a: Scaled, b: Scaled): Scaled {
  if (a.h === 0) return b;
  if (b.h === 0) return a;
  const k = Math.max(a.k, b.k);
  const s = ddAdd(shift(a.h, a.l, a.k, k), shift(b.h, b.l, b.k, k));
  return norm(s[0], s[1], k);
}

function logOf(a: Scaled): number {
  if (a.h === 0) return -Infinity;
  return Math.log(a.h) + a.l / a.h + a.k * LN_UNIT;
}

/** Compensated sum (Neumaier), kept with aligned exponents */
class ScaledSum {
  private s = 0;
  private c = 0;
  private k = 0;
  add(t: Scaled): void {
    if (t.h === 0) return;
    if (this.s === 0 && this.c === 0) {
      this.s = t.h;
      this.c = t.l;
      this.k = t.k;
      return;
    }
    if (t.k > this.k) {
      [this.s, this.c] = shift(this.s, this.c, this.k, t.k);
      this.k = t.k;
    }
    const [h, l] = shift(t.h, t.l, t.k, this.k);
    this.addNum(h);
    this.addNum(l);
  }
  private addNum(x: number): void {
    const t = this.s + x;
    if (Math.abs(this.s) >= Math.abs(x)) this.c += this.s - t + x;
    else this.c += x - t + this.s;
    this.s = t;
  }
  get positive(): boolean {
    return this.s + this.c > 0;
  }
  /** The sum as a Scaled value (not normalised) */
  get scaled(): Scaled {
    return { h: this.s + this.c, l: 0, k: this.k };
  }
  get log(): number {
    const v = this.s + this.c;
    if (Number.isNaN(v)) return NaN;
    return v > 0 ? Math.log(v) + this.k * LN_UNIT : -Infinity;
  }
  get linear(): number {
    let v = this.s + this.c;
    // From five steps on the value has overflowed or underflowed (the exponent can be of order 1e40)
    for (let i = 0; i < Math.min(this.k, 5); i++) v *= UP;
    for (let i = 0; i > Math.max(this.k, -5) && v !== 0; i--) v *= DOWN;
    return v;
  }
  value(log: boolean): number {
    return log ? this.log : this.linear;
  }
  /** Divide the sum by x (x positive; the exponent is divided separately, so subnormals do not overflow) */
  divideBy(x: number): void {
    const b = norm(x, 0, 0);
    this.s /= b.h;
    this.c /= b.h;
    this.k -= b.k;
  }
}

/** Above this mean the starts are searched for on the log scale (the walk below takes about 10 sqrt(mu) steps) */
const WALK_START = 1e8;

/** Start of the lower sum: J such that Pois(> J) <= 3e-21 Pois(mode) */
function upperStart(mu: number): number {
  if (mu > WALK_START) return startSearch(mu, 1);
  let j = Math.floor(mu);
  let r = 1;
  for (;;) {
    r *= mu / (j + 1); // pmf(j+1) / pmf(mode)
    if (r / (1 - mu / (j + 2)) < 3e-21) return j;
    j++;
  }
}

/** Start of the upper sum: J such that Pois(< J) <= 3e-21 Pois(mode) */
function lowerStart(mu: number): number {
  if (mu > WALK_START) return startSearch(mu, -1);
  let j = Math.floor(mu);
  let r = 1;
  while (j > 0) {
    r *= j / mu; // pmf(j-1) / pmf(mode)
    if (r / (1 - (j - 1) / mu) < 3e-21) return j;
    j--;
  }
  return 0;
}

/**
 * The starts of upperStart (dir = 1) and lowerStart (dir = -1) for a large mean, by bisection on the log of the pmf
 * relative to the mode: the first J beyond which the Poisson tail, bounded by the geometric series of the pmf ratio, is
 * below 3e-21 of the mode. The ratio pmf(j ± 1)/pmf(j) is at most mu/(j + 1) (dir = 1) or j/mu (dir = -1) there.
 */
function startSearch(mu: number, dir: 1 | -1): number {
  const mode = Math.floor(mu);
  const lm = dpoisRaw(mode, mu, true);
  const ok = (j: number): boolean => {
    const next = j + dir;
    if (next < 0) return true;
    const r = dir > 0 ? mu / (j + 2) : (j - 1) / mu;
    return dpoisRaw(next, mu, true) - lm - Math.log1p(-r) < Math.log(3e-21);
  };
  // About 10 standard deviations; double the offset until it is far enough, then bisect
  let lo = 0;
  let hi = Math.ceil(10 * Math.sqrt(mu));
  while (!ok(mode + dir * hi)) {
    lo = hi;
    hi *= 2;
  }
  for (let i = 0; i < 200 && hi - lo > 1; i++) {
    const m = Math.floor((lo + hi) / 2);
    if (m <= lo || m >= hi) break;
    if (ok(mode + dir * m)) hi = m;
    else lo = m;
  }
  return Math.max(0, mode + dir * hi);
}

/**
 * Whether, after the peak (terms have started decreasing), the sum of the remaining terms is within relative TOL.
 * By log-concavity the rest is bounded by the geometric series term r/(1-r) with ratio r = term/prev (compared on the log scale).
 * prev is ZERO before the first term
 */
function negligible(t: Scaled, prev: Scaled, sum: ScaledSum): boolean {
  const lr = logRatio(t, prev);
  if (!(lr < 0) || !sum.positive) return false;
  return logRatio(t, sum.scaled) + lr - Math.log(-Math.expm1(lr)) <= LOG_TOL;
}

/**
 * log(a/b), from the mantissas and the difference of the exponents: the logs themselves lose their fraction when a term
 * is as small as e^-1e34 (then every term would compare equal to the previous one)
 */
function logRatio(a: Scaled, b: Scaled): number {
  if (a.h === 0) return b.h === 0 ? NaN : -Infinity;
  if (b.h === 0) return Infinity;
  return Math.log(a.h / b.h) + (a.l / a.h - b.l / b.h) + (a.k - b.k) * LN_UNIT;
}

function weight(j: number, mu: number): Scaled {
  return fromValue(dpoisRaw(j, mu, false), () => dpoisLogDD(j, mu));
}

function increment(k: MixtureKernel, j: number): Scaled {
  return fromValue(k.inc(j, false), () => (k.incLogDD ? k.incLogDD(j) : k.inc(j, true)));
}

/** Σ_j w_j P_j (lower) or Σ_j w_j Q_j (!lower). Returned as a log if log */
export function mixtureCdf(mu: number, kernel: MixtureKernel, lower: boolean, log: boolean): number {
  return (lower ? sumLower(mu, kernel) : sumUpper(mu, kernel)).value(log);
}

/**
 * Linear value and log of mixtureCdf, with the larger tail taken as 1 - (smaller): summed directly it can exceed 1 by
 * a few ulps (the weights' rounding errors add up, while every P_j or Q_j is near 1), and its errors need not follow
 * x, so it could also step back. lowerSmaller guesses which tail is the smaller (summed first; when the guess is wrong
 * the other is summed too)
 */
export function mixtureTail(mu: number, kernel: MixtureKernel, lower: boolean, lowerSmaller: boolean): { lin: number; log: number } {
  let side = lowerSmaller;
  let s = side ? sumLower(mu, kernel) : sumUpper(mu, kernel);
  if (s.linear > 0.5) {
    side = !side;
    s = side ? sumLower(mu, kernel) : sumUpper(mu, kernel);
  }
  if (side === lower) return { lin: s.linear, log: s.log };
  const other = s.linear;
  return { lin: 1 - other, log: Math.log1p(-other) };
}

/** Compute the log of the term w_j F_j directly (to locate the starting index) */
function logTerm(k: MixtureKernel, mu: number, j: number, lower: boolean): number {
  return dpoisRaw(j, mu, true) + k.cdf(j, lower, true);
}

/** Maximiser of a unimodal f on [lo, hi] (integer ternary search) */
function argmax(f: (j: number) => number, lo: number, hi: number): number {
  // (beyond 2^53 the thirds may round to the ends, so the iterations are bounded)
  for (let i = 0; i < 3000 && hi - lo > 2; i++) {
    const m1 = Math.floor(lo + (hi - lo) / 3);
    const m2 = Math.ceil(hi - (hi - lo) / 3);
    if (f(m1) < f(m2)) lo = m1;
    else hi = m2;
  }
  if (hi - lo > 2) return Math.round((lo + hi) / 2);
  let best = lo;
  for (let j = lo + 1; j <= hi; j++) if (f(j) > f(best)) best = j;
  return best;
}

/**
 * From the peak jm in direction dir, search by doubling for the position where the term is e^-SKIP below the peak (stopping at limit).
 * By log-concavity, the sum of terms beyond it is at most e^-SKIP × (distance / SKIP) times the peak term (negligible)
 */
const SKIP = 60;
function farEdge(f: (j: number) => number, jm: number, dir: 1 | -1, limit: number): number {
  const target = f(jm) - SKIP;
  for (let step = 1; ; step *= 2) {
    const j = jm + dir * step;
    if (dir > 0 ? j >= limit : j <= limit) return limit;
    if (f(j) < target) return j;
  }
}

/** If the walk looks longer than this, locate the peak first and start closer to it */
const LONG_WALK = 3000;

function sumLower(mu: number, k: MixtureKernel): ScaledSum {
  let J = upperStart(mu);
  if (J > LONG_WALK) {
    // Locate the peak (P_j may be small, pushing the terms towards small j) and walk from slightly above it
    const f = (j: number): number => logTerm(k, mu, j, true);
    J = farEdge(f, argmax(f, 0, J), 1, J);
  }
  let p = fromValue(k.cdf(J, true, false), () => k.cdf(J, true, true));
  let w = weight(J, mu);
  let d = J > 0 ? increment(k, J - 1) : ZERO;
  const sum = new ScaledSum();
  let prev: Scaled = ZERO;
  for (let j = J; j >= 0; j--) {
    const t = mul(w, p);
    sum.add(t);
    // (a NaN term, from a component out of its range, ends the sum: the result is NaN, not a loop to MAX_TERMS)
    if (negligible(t, prev, sum) || Number.isNaN(t.h)) break;
    prev = t;
    if (j === 0) break;
    // P_{j-1} = P_j + d_{j-1}, w_{j-1} = w_j j/μ, d_{j-2} = d_{j-1} / (d_{j-1}/d_{j-2})
    p = add(p, d);
    w = refresh(mulDD(w, ddDivNum([j, 0], mu)), () => weight(j - 1, mu));
    if (j >= 2) d = d.h === 0 ? increment(k, j - 2) : refresh(divRatio(d, k, j - 1), () => increment(k, j - 2));
  }
  return sum;
}

function sumUpper(mu: number, k: MixtureKernel): ScaledSum {
  let J = lowerStart(mu);
  let searched = false;
  for (;;) {
    let q = fromValue(k.cdf(J, false, false), () => k.cdf(J, false, true));
    let w = weight(J, mu);
    let d = increment(k, J);
    const sum = new ScaledSum();
    let prev: Scaled = ZERO;
    let restart = -1;
    for (let j = J; j < J + MAX_TERMS; j++) {
      const t = mul(w, q);
      sum.add(t);
      if (negligible(t, prev, sum) || Number.isNaN(t.h)) break;
      if (t.h === 0 && j > mu + 50 && j > J + 50) break; // all later terms are 0 too
      if (!searched && j - J >= LONG_WALK && !(logRatio(t, prev) < 0)) {
        // Not past the peak yet (Q_j grows rapidly with j: x far to the right of the mean).
        // Find an upper bound bracketing the peak by doubling and restart from slightly below the peak
        const f = (i: number): number => logTerm(k, mu, i, false);
        const fj = f(j);
        let hi = j + 1;
        for (let step = 1; f(hi) >= fj && step < 2 ** 60; step *= 2) hi = j + step;
        const r = farEdge(f, argmax(f, j, hi), -1, j);
        searched = true;
        if (r > j) {
          restart = r;
          break;
        }
      }
      prev = t;
      // Q_{j+1} = Q_j + d_j, w_{j+1} = w_j μ/(j+1), d_{j+1} = d_j (d_{j+1}/d_j)
      q = add(q, d);
      w = refresh(mulDD(w, ddDivNum([mu, 0], j + 1)), () => weight(j + 1, mu));
      d = d.h === 0 ? increment(k, j + 1) : refresh(mulRatio(d, k, j + 1), () => increment(k, j + 1));
    }
    if (restart < 0) return sum;
    // Terms below j are at least e^-SKIP smaller than the peak and, by log-concavity, negligible
    J = restart;
  }
}

/**
 * Mixture of densities Σ_j w_j c_j d_j, where c_j is a coefficient (when component j's density can be written c_j d_j).
 * jStar is a guess for the location of the peak of the terms. Sums outward from the peak on both sides until the terms are negligible.
 * Returns the sum divided by divisor (as a log if log).
 */
export function mixtureDensity(
  mu: number,
  kernel: MixtureKernel,
  coef: (j: number) => number,
  jStar: number,
  divisor: number,
  log: boolean,
): number {
  const j0 = Number.isFinite(jStar) ? Math.max(0, Math.round(jStar)) : 0;
  const sum = new ScaledSum();
  const w0 = weight(j0, mu);
  const d0 = increment(kernel, j0);
  // Upward
  let w = w0;
  let d = d0;
  let prev: Scaled = ZERO;
  for (let j = j0; j < j0 + MAX_TERMS; j++) {
    const t = mulDD(mul(w, d), [coef(j), 0]);
    sum.add(t);
    if (negligible(t, prev, sum) || Number.isNaN(t.h)) break;
    if (t.h === 0 && j > mu + 50 && j > j0 + 50) break; // all later terms are 0 too
    prev = t;
    w = refresh(mulDD(w, ddDivNum([mu, 0], j + 1)), () => weight(j + 1, mu));
    d = d.h === 0 ? increment(kernel, j + 1) : refresh(mulRatio(d, kernel, j + 1), () => increment(kernel, j + 1));
  }
  // Downward
  w = w0;
  d = d0;
  prev = ZERO;
  for (let j = j0 - 1; j >= 0; j--) {
    w = refresh(mulDD(w, ddDivNum([j + 1, 0], mu)), () => weight(j, mu));
    d = d.h === 0 ? increment(kernel, j) : refresh(divRatio(d, kernel, j + 1), () => increment(kernel, j));
    const t = mulDD(mul(w, d), [coef(j), 0]);
    sum.add(t);
    if (negligible(t, prev, sum) || Number.isNaN(t.h)) break;
    prev = t;
  }
  sum.divideBy(divisor);
  return sum.value(log);
}
