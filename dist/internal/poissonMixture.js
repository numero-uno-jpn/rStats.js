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
import { ddAdd, ddDiv, ddDivNum, ddLog, ddMul } from "../special/dd.js";
import { lgamma1p } from "../special/gamma.js";
import { bd0dd, dpoisRaw, stirlerr } from "../special/loader.js";
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
const ZERO = { h: 0, l: 0, k: 0 };
function norm(h, l, k, approx = false) {
    if (h === 0)
        return ZERO;
    if (!Number.isFinite(h))
        return { h, l: 0, k };
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
const LN_UNIT_DD = [346.5735902799727, -2.2599635089223323e-14];
/**
 * Built from the linear value (or from the log if it underflows). If the log is available as double-double, the
 * mantissa keeps full accuracy. If built from a double log, it is flagged as approximate
 */
function fromValue(lin, logv) {
    if (lin > 1e-305 || Number.isNaN(lin))
        return norm(lin, 0, 0);
    const lv = logv();
    const [hi, lo] = typeof lv === "number" ? [lv, 0] : lv;
    if (hi === -Infinity)
        return ZERO;
    if (Number.isNaN(hi))
        return { h: NaN, l: 0, k: 0 };
    const k = Math.round(hi / LN_UNIT);
    const r = ddAdd([hi, lo], ddMul(LN_UNIT_DD, [-k, 0]));
    const m = Math.exp(r[0]);
    return typeof lv === "number" ? norm(m, 0, k, true) : norm(m, m * r[1], k);
}
/** log Pois(x; λ) = log(λ^x e^-λ / Gamma(x + 1)) as double-double (x >= 0, λ > 0) */
export function dpoisLogDD(x, lambda) {
    if (x === 0)
        return [-lambda, 0];
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
function refresh(x, direct) {
    return x.approx === true && logOf(x) > -700 ? direct() : x;
}
function mulDD(a, r) {
    // The ratio can be 1e-300 or 1e300, so split off the exponent before multiplying (mantissa products do not overflow)
    return mul(a, norm(r[0], r[1], 0));
}
function divDD(a, r) {
    if (a.h === 0)
        return ZERO;
    const b = norm(r[0], r[1], 0);
    const q = ddDiv([a.h, a.l], [b.h, b.l]);
    return norm(q[0], q[1], a.k - b.k, a.approx);
}
/** d × (kernel ratio j) */
function mulRatio(d, k, j) {
    const r = mulDD(d, k.ratio(j));
    return k.ratioK ? { ...r, k: r.k + k.ratioK } : r;
}
/** d ÷ (kernel ratio j) */
function divRatio(d, k, j) {
    const r = divDD(d, k.ratio(j));
    return k.ratioK ? { ...r, k: r.k - k.ratioK } : r;
}
function mul(a, b) {
    if (a.h === 0 || b.h === 0)
        return ZERO;
    const p = ddMul([a.h, a.l], [b.h, b.l]);
    return norm(p[0], p[1], a.k + b.k, a.approx === true || b.approx === true);
}
/** Multiply by 2^(E (from - to)) to align to exponent to (to >= from) */
function shift(h, l, from, to) {
    for (let i = from; i < to && h !== 0; i++) {
        h *= DOWN;
        l *= DOWN;
    }
    return [h, l];
}
function add(a, b) {
    if (a.h === 0)
        return b;
    if (b.h === 0)
        return a;
    const k = Math.max(a.k, b.k);
    const s = ddAdd(shift(a.h, a.l, a.k, k), shift(b.h, b.l, b.k, k));
    return norm(s[0], s[1], k);
}
function logOf(a) {
    if (a.h === 0)
        return -Infinity;
    return Math.log(a.h) + a.l / a.h + a.k * LN_UNIT;
}
/** Compensated sum (Neumaier), kept with aligned exponents */
class ScaledSum {
    s = 0;
    c = 0;
    k = 0;
    add(t) {
        if (t.h === 0)
            return;
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
    addNum(x) {
        const t = this.s + x;
        if (Math.abs(this.s) >= Math.abs(x))
            this.c += this.s - t + x;
        else
            this.c += x - t + this.s;
        this.s = t;
    }
    get log() {
        const v = this.s + this.c;
        if (Number.isNaN(v))
            return NaN;
        return v > 0 ? Math.log(v) + this.k * LN_UNIT : -Infinity;
    }
    get linear() {
        let v = this.s + this.c;
        for (let i = 0; i < this.k; i++)
            v *= UP;
        for (let i = 0; i > this.k && v !== 0; i--)
            v *= DOWN;
        return v;
    }
    value(log) {
        return log ? this.log : this.linear;
    }
    /** Divide the sum by x (x positive; the exponent is divided separately, so subnormals do not overflow) */
    divideBy(x) {
        const b = norm(x, 0, 0);
        this.s /= b.h;
        this.c /= b.h;
        this.k -= b.k;
    }
}
/** Start of the lower sum: J such that Pois(> J) <= 3e-21 Pois(mode) */
function upperStart(mu) {
    let j = Math.floor(mu);
    let r = 1;
    for (;;) {
        r *= mu / (j + 1); // pmf(j+1) / pmf(mode)
        if (r / (1 - mu / (j + 2)) < 3e-21)
            return j;
        j++;
    }
}
/** Start of the upper sum: J such that Pois(< J) <= 3e-21 Pois(mode) */
function lowerStart(mu) {
    let j = Math.floor(mu);
    let r = 1;
    while (j > 0) {
        r *= j / mu; // pmf(j-1) / pmf(mode)
        if (r / (1 - (j - 1) / mu) < 3e-21)
            return j;
        j--;
    }
    return 0;
}
/**
 * Whether, after the peak (terms have started decreasing), the sum of the remaining terms is within relative TOL.
 * By log-concavity the rest is bounded by the geometric series term r/(1-r) with ratio r = term/prev (compared on the log scale).
 */
function negligible(lt, lprev, lsum) {
    if (lsum === -Infinity || !(lt < lprev))
        return false;
    const lr = lt - lprev;
    return lt + lr - Math.log(-Math.expm1(lr)) <= LOG_TOL + lsum;
}
function weight(j, mu) {
    return fromValue(dpoisRaw(j, mu, false), () => dpoisLogDD(j, mu));
}
function increment(k, j) {
    return fromValue(k.inc(j, false), () => (k.incLogDD ? k.incLogDD(j) : k.inc(j, true)));
}
/** Σ_j w_j P_j (lower) or Σ_j w_j Q_j (!lower). Returned as a log if log */
export function mixtureCdf(mu, kernel, lower, log) {
    return (lower ? sumLower(mu, kernel) : sumUpper(mu, kernel)).value(log);
}
/** Return both the linear value and the log of mixtureCdf from a single summation */
export function mixtureCdfBoth(mu, kernel, lower) {
    const s = lower ? sumLower(mu, kernel) : sumUpper(mu, kernel);
    return { lin: s.linear, log: s.log };
}
/** Compute the log of the term w_j F_j directly (to locate the starting index) */
function logTerm(k, mu, j, lower) {
    return dpoisRaw(j, mu, true) + k.cdf(j, lower, true);
}
/** Maximiser of a unimodal f on [lo, hi] (integer ternary search) */
function argmax(f, lo, hi) {
    while (hi - lo > 2) {
        const m1 = Math.floor(lo + (hi - lo) / 3);
        const m2 = Math.ceil(hi - (hi - lo) / 3);
        if (f(m1) < f(m2))
            lo = m1;
        else
            hi = m2;
    }
    let best = lo;
    for (let j = lo + 1; j <= hi; j++)
        if (f(j) > f(best))
            best = j;
    return best;
}
/**
 * From the peak jm in direction dir, search by doubling for the position where the term is e^-SKIP below the peak (stopping at limit).
 * By log-concavity, the sum of terms beyond it is at most e^-SKIP × (distance / SKIP) times the peak term (negligible)
 */
const SKIP = 60;
function farEdge(f, jm, dir, limit) {
    const target = f(jm) - SKIP;
    for (let step = 1;; step *= 2) {
        const j = jm + dir * step;
        if (dir > 0 ? j >= limit : j <= limit)
            return limit;
        if (f(j) < target)
            return j;
    }
}
/** If the walk looks longer than this, locate the peak first and start closer to it */
const LONG_WALK = 3000;
function sumLower(mu, k) {
    let J = upperStart(mu);
    if (J > LONG_WALK) {
        // Locate the peak (P_j may be small, pushing the terms towards small j) and walk from slightly above it
        const f = (j) => logTerm(k, mu, j, true);
        J = farEdge(f, argmax(f, 0, J), 1, J);
    }
    let p = fromValue(k.cdf(J, true, false), () => k.cdf(J, true, true));
    let w = weight(J, mu);
    let d = J > 0 ? increment(k, J - 1) : ZERO;
    const sum = new ScaledSum();
    let prev = -Infinity;
    for (let j = J; j >= 0; j--) {
        const t = mul(w, p);
        const lt = logOf(t);
        sum.add(t);
        if (negligible(lt, prev, sum.log))
            break;
        prev = lt;
        if (j === 0)
            break;
        // P_{j-1} = P_j + d_{j-1}, w_{j-1} = w_j j/μ, d_{j-2} = d_{j-1} / (d_{j-1}/d_{j-2})
        p = add(p, d);
        w = refresh(mulDD(w, ddDivNum([j, 0], mu)), () => weight(j - 1, mu));
        if (j >= 2)
            d = d.h === 0 ? increment(k, j - 2) : refresh(divRatio(d, k, j - 1), () => increment(k, j - 2));
    }
    return sum;
}
function sumUpper(mu, k) {
    let J = lowerStart(mu);
    let searched = false;
    for (;;) {
        let q = fromValue(k.cdf(J, false, false), () => k.cdf(J, false, true));
        let w = weight(J, mu);
        let d = increment(k, J);
        const sum = new ScaledSum();
        let prev = -Infinity;
        let restart = -1;
        for (let j = J; j < J + MAX_TERMS; j++) {
            const t = mul(w, q);
            const lt = logOf(t);
            sum.add(t);
            if (negligible(lt, prev, sum.log))
                break;
            if (lt === -Infinity && j > mu + 50 && j > J + 50)
                break; // all later terms are 0 too
            if (!searched && j - J >= LONG_WALK && lt >= prev) {
                // Not past the peak yet (Q_j grows rapidly with j: x far to the right of the mean).
                // Find an upper bound bracketing the peak by doubling and restart from slightly below the peak
                const f = (i) => logTerm(k, mu, i, false);
                const fj = f(j);
                let hi = j + 1;
                for (let step = 1; f(hi) >= fj; step *= 2)
                    hi = j + step;
                const r = farEdge(f, argmax(f, j, hi), -1, j);
                searched = true;
                if (r > j) {
                    restart = r;
                    break;
                }
            }
            prev = lt;
            // Q_{j+1} = Q_j + d_j, w_{j+1} = w_j μ/(j+1), d_{j+1} = d_j (d_{j+1}/d_j)
            q = add(q, d);
            w = refresh(mulDD(w, ddDivNum([mu, 0], j + 1)), () => weight(j + 1, mu));
            d = d.h === 0 ? increment(k, j + 1) : refresh(mulRatio(d, k, j + 1), () => increment(k, j + 1));
        }
        if (restart < 0)
            return sum;
        // Terms below j are at least e^-SKIP smaller than the peak and, by log-concavity, negligible
        J = restart;
    }
}
/**
 * Mixture of densities Σ_j w_j c_j d_j, where c_j is a coefficient (when component j's density can be written c_j d_j).
 * jStar is a guess for the location of the peak of the terms. Sums outward from the peak on both sides until the terms are negligible.
 * Returns the sum divided by divisor (as a log if log).
 */
export function mixtureDensity(mu, kernel, coef, jStar, divisor, log) {
    const j0 = Number.isFinite(jStar) ? Math.max(0, Math.round(jStar)) : 0;
    const sum = new ScaledSum();
    const w0 = weight(j0, mu);
    const d0 = increment(kernel, j0);
    // Upward
    let w = w0;
    let d = d0;
    let prev = -Infinity;
    for (let j = j0; j < j0 + MAX_TERMS; j++) {
        const t = mulDD(mul(w, d), [coef(j), 0]);
        const lt = logOf(t);
        sum.add(t);
        if (negligible(lt, prev, sum.log))
            break;
        if (lt === -Infinity && j > mu + 50 && j > j0 + 50)
            break; // all later terms are 0 too
        prev = lt;
        w = refresh(mulDD(w, ddDivNum([mu, 0], j + 1)), () => weight(j + 1, mu));
        d = d.h === 0 ? increment(kernel, j + 1) : refresh(mulRatio(d, kernel, j + 1), () => increment(kernel, j + 1));
    }
    // Downward
    w = w0;
    d = d0;
    prev = -Infinity;
    for (let j = j0 - 1; j >= 0; j--) {
        w = refresh(mulDD(w, ddDivNum([j + 1, 0], mu)), () => weight(j, mu));
        d = d.h === 0 ? increment(kernel, j) : refresh(divRatio(d, kernel, j + 1), () => increment(kernel, j));
        const t = mulDD(mul(w, d), [coef(j), 0]);
        const lt = logOf(t);
        sum.add(t);
        if (negligible(lt, prev, sum.log))
            break;
        prev = lt;
    }
    sum.divideBy(divisor);
    return sum.value(log);
}
