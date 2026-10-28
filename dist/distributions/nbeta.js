// Density, distribution function and quantile of the noncentral beta distribution (ncp = λ) and of the
// noncentral F distribution built on it.
//
// The noncentral beta is a mixture of central Beta(a + j, b) with weights Pois(j; λ/2)
// (Johnson, Kotz & Balakrishnan 1995, ch. 30).
//   P[X <= x] = Σ_j w_j I_x(a + j, b),  P[X > x] = Σ_j w_j (1 - I_x(a + j, b))
// Consecutive components are linked by I_x(a+j, b) - I_x(a+j+1, b) = e_j, where
//   e_j = Gamma(a+b+j) / (Gamma(a+j+1) Gamma(b)) x^(a+j) (1-x)^b
//       = dbinom(a + j; a + b + j, x) b / (a + b + j)
// The density of component j is e_j (a + j) / (x (1 - x)). The sums are done in src/internal/poissonMixture.ts.
// For a huge λ or extreme shapes the distribution is computed from X = Y / (Y + W) instead (see "Extreme parameters").
//
// The noncentral F is computed from the fact that X = m F / (n + m F) follows the noncentral beta (m/2, n/2, λ).
// Its density is f_F(q) = Σ_j w_j e_j (a + j) / q (dx/dq and x (1 - x) cancel).
// x and 1 - x are formed as a double-double pair (rounding is amplified by the parameters, as for the central distribution).
import { dt0, dt1, quantileBoundaries, smallerTail } from "../internal/dpq.js";
import { invertContinuous } from "../internal/invert.js";
import { kronrodAdaptive, narrowQuantile, quadratureControl, searchDoubles } from "../internal/noncentral.js";
import { gammaInc } from "../special/igam.js";
import { mixtureDensity, mixtureTail } from "../internal/poissonMixture.js";
import { ddAdd, ddDiv, ddLog, ddMul, ddMulNum, ddNeg, twoProd, twoSum } from "../special/dd.js";
import { lbeta, lbetaDD } from "../special/beta.js";
import { lgamma, lgamma1p } from "../special/gamma.js";
import { log1pmx } from "../special/log1pmx.js";
import { digamma } from "../special/psigamma.js";
import { betaIncDD } from "../special/incbet.js";
import { dbinomExponent, dbinomRawDD } from "../special/loader.js";
import { dbeta1, pbeta1, qbeta1 } from "./beta.js";
import { dfDensity1, pf1, qf1 } from "./f.js";
import { confirmQuantile, dnchisq1, dnchisqLogNear, gammaTailNear, negligibleTail, pnchisq1, qnchisq1 } from "./nchisq.js";
import { dgamma1 } from "./gamma.js";
function betaKernel(a, b, xd, xcd) {
    const ab = twoSum(a, b);
    // For very small x the ratio underflows, so keep it scaled by 2^(500 K) (also where a + b is tiny: the ratio at j = 1
    // is x (a + b)/(a + 1), down to 1e-504), K units enough to bring x min(1, a + b) above 1e-250
    const low = Math.log2(xd[0]) + Math.log2(Math.min(1, a + b));
    const K = low < -830 ? Math.ceil((-830 - low) / 500) : 0;
    let xs = xd;
    for (let i = 0; i < K; i++)
        xs = [xs[0] * 2 ** 500, xs[1] * 2 ** 500];
    return {
        ratioK: -K,
        cdf: (j, lower, log) => betaIncDD(a + j, b, xd, xcd, lower, log),
        inc: (j, log) => {
            const [s, corr] = incCorrection(a, b, j, xd);
            if (!binomialHelpersApply(s, b, xd, xcd)) {
                // Near subnormal x or for a tiny shape the binomial-probability helpers break down, as in incLogDD
                const l = betaKernelIncLog(s, b, xd, xcd);
                const lv = (typeof l === "number" ? l : l[0] + l[1]) + corr;
                return log ? lv : Math.exp(lv);
            }
            const c = b / (s + b);
            return log
                ? dbinomRawDD(s, b, xd, xcd, true) + Math.log(c) + corr
                : dbinomRawDD(s, b, xd, xcd, false) * c * (1 + corr);
        },
        // e_j / e_{j-1} = x (a + b + j - 1) / (a + j)
        ratio: (j) => ddDiv(ddMul(xs, ddAdd(ab, [j - 1, 0])), twoSum(a, j)),
        incLogDD: (j) => {
            // log e_j = log dbinom(a + j; a + b + j, x) + log(b / (a + b + j))
            // Near subnormal x (n x underflows) or for a tiny shape (b = 1e-264: NaN) the binomial-probability helpers
            // break down, so build it from the log of the beta function
            const [s, corr] = incCorrection(a, b, j, xd);
            if (!binomialHelpersApply(s, b, xd, xcd)) {
                const l = betaKernelIncLog(s, b, xd, xcd);
                return typeof l === "number" ? l + corr : ddAdd(l, [corr, 0]);
            }
            const { e, logDenom } = dbinomExponent(s, b, xd, xcd);
            return ddAdd([-e[0], -e[1]], [-0.5 * logDenom + Math.log(b / (s + b)) + corr, 0]);
        },
    };
}
/** Whether e_j can be taken from the binomial-probability helpers (dbinomRawDD, dbinomExponent) */
function binomialHelpersApply(s, b, xd, xcd) {
    return xd[0] > 1e-305 && xcd[0] > 1e-305 && s > 1e-10 && b > 1e-10;
}
/**
 * The shape a + j rounded to double, s, and the first-order change in log e_j from s to the exact a + j:
 * δ ∂log e/∂s with δ the rounding and ∂log e_j/∂s = log x + ψ(s + b) - ψ(s + 1) (e_j = x^s (1 - x)^b / (s B(s, b))).
 * Far in a tail this derivative is large, and the recurrences carry e_j to every other term, so the rounding of s
 * would otherwise reach the result in full (as in nchisq.ts)
 */
function incCorrection(a, b, j, xd) {
    const [s, delta] = twoSum(a, j);
    if (delta === 0)
        return [s, 0];
    return [s, delta * (Math.log(xd[0]) + xd[1] / xd[0] + digamma(s + b) - digamma(s + 1))];
}
/**
 * log e_j in double-double when x (or 1 - x) is near subnormal, for the shape s = a + j:
 * log e_j = -log B(s, b) - log(s) + s log x + b log(1 - x).
 * For s, b < 1, log(s B(s, b)) = log Γ(1 + s) + log Γ(1 + b) - log Γ(1 + s + b) + log(1 + s/b), whose terms are small:
 * log B(s, b) and log s are each about -log s (523 at s = 3e-228), and their difference would keep an error of 1e-13
 */
function betaKernelIncLog(s, b, xd, xcd) {
    if (!(xd[0] > 0 && xcd[0] > 0))
        return -Infinity;
    const l = ddAdd(ddMulNum(ddLog(xd), s), ddMulNum(ddLog(xcd), b));
    if (s < 1 && b < 1)
        return ddAdd(l, [-(lgamma1p(s) + lgamma1p(b) - lgamma1p(s + b) + Math.log1p(s / b)), 0]);
    return ddAdd(ddAdd(l, ddNeg(lbetaDD(s, b))), [-Math.log(s), 0]);
}
/** Form x and 1 - x as a double-double pair, based on the smaller of the two */
function pair(x) {
    return x <= 0.5 ? [[x, 0], twoSum(1, -x)] : [twoSum(1, -(1 - x)), [1 - x, 0]];
}
/** One-sided probability (P[X <= x] if lower). 0 < x < 1 */
function pnbetaRaw(a, b, ncp, xd, xcd, lower, log, o = odds(xd, xcd)) {
    const m = method(a, b, ncp);
    if (m !== "mixture") {
        const left = leftTailLog(a, b, ncp, xd, xcd);
        if (left !== undefined) {
            if (lower)
                return log ? left : Math.exp(left);
            return log ? Math.log1p(-Math.exp(left)) : -Math.expm1(left);
        }
        return extremeTail(m, a, b, ncp, o, lower, log);
    }
    // A value near 1, and its log, are built from the small value of the other side (the lower tail is likely the smaller
    // below the mean of Beta(a + λ/2, b))
    const v = mixtureTail(ncp / 2, betaKernel(a, b, xd, xcd), lower, xd[0] < (a + ncp / 2) / (a + ncp / 2 + b));
    return log ? v.log : v.lin;
}
/**
 * log P[X <= x] far in the left tail for a large λ, as -λ/2 + log S, S = Σ_j (λ/2)^j / j! I_x(a + j, b) (the mixture
 * with e^(-λ/2) taken out of the weights). The terms fall by factors of about r/(j + 1) once j > r, with
 * r = (λ/2) ρ, ρ = x max(1, (a + b)/(a + 1)) (bounding I_x(s + 1, b)/I_x(s, b)), so for r <= 100 the sum takes at most a
 * few hundred terms. Beyond that, S lies between its first term I_x(a, b) and I_x(a, b) e^r: where ρ <= 1e-16 the
 * first term alone gives log P to 1e-16 of λ/2 (and so of |log P|). Undefined otherwise, or for shapes out of the
 * central incomplete beta function's range. (The integral, at log P near -λ/2 = -1e27, cannot place its mode on values
 * that are all -λ/2 to the double)
 */
function leftTailLog(a, b, ncp, xd, xcd) {
    const mu = ncp / 2;
    const rho = xd[0] * Math.max(1, (a + b) / (a + 1));
    if (a > 1e15 || b > 1e15)
        return undefined;
    if (mu * rho > 100)
        return rho <= 1e-16 ? -mu + betaIncDD(a, b, xd, xcd, true, true) : undefined;
    const lmu = Math.log(mu);
    let max = -Infinity;
    const terms = [];
    for (let j = 0; j < 1000; j++) {
        const t = j * lmu - lgamma1p(j) + betaIncDD(a + j, b, xd, xcd, true, true);
        terms.push(t);
        if (t > max)
            max = t;
        else if (t < max + LOG_TOL_SERIES && j > mu * rho)
            break;
    }
    let sum = 0;
    for (const t of terms)
        sum += Math.exp(t - max);
    return -mu + max + Math.log(sum);
}
/** Below this, relative to the largest term, the terms of leftTailLog are negligible (they fall faster than 1/2) */
const LOG_TOL_SERIES = Math.log(1e-18);
/** Σ_j w_j e_j (a + j) / divisor. For the density, divisor = x (1 - x) (beta) or q (F) */
function densitySum(a, b, ncp, xd, xcd, divisor, log, o = odds(xd, xcd)) {
    const m = method(a, b, ncp);
    if (m !== "mixture") {
        // The sum is f(x) x (1 - x) / divisor
        // (log x (1 - x) from log(1 - x) where 1 - x is below the double range)
        const xx = ddMul(xd, xcd);
        const lxx = xcd[0] > 1e-300 ? Math.log(xx[0] + xx[1]) : Math.log(xd[0] + xd[1]) + o.l1mx;
        const l = extremeDensityLog(m, a, b, ncp, xd, o) + lxx - Math.log(divisor);
        return log ? l : Math.exp(l);
    }
    const mu = ncp / 2;
    const x = xd[0];
    // The peak is at the j where the term ratio mu x (a + b + j - 1) / (j (a + j - 1)) equals 1
    const c = mu * x;
    const p = a - 1 - c;
    const jStar = (-p + Math.sqrt(Math.max(0, p * p + 4 * c * (a + b - 1)))) / 2;
    return mixtureDensity(mu, betaKernel(a, b, xd, xcd), (j) => a + j, jStar, divisor, log);
}
// ---- Extreme parameters ----
// X = Y / (Y + W) with Y ~ χ²(2a, λ) and W ~ χ²(2b) independent. Where the mixture would need too many terms (a huge
// λ, or a huge b against a + λ: its peak is near j = sqrt(λ x b / 2)), and where the central incomplete beta function
// of its components is out of its range (huge shapes), the distribution is computed from that of Y and W instead.
// Far in the left tail of a large λ the mixture is summed with e^(-λ/2) taken out of its weights (leftTailLog), and for
// a λ so large that log P = -(λ/2)(1 - x) to the double, that is the answer (farLeftLog).
/** Above this mean of the Poisson weights the mixture (at least 10 sqrt(λ/2) terms) is replaced by an integral */
const MU_MIXTURE = 1e6;
/**
 * How the distribution is computed:
 * - "chisq": b > 1e20 (a + j)² over the Poisson range of j. Then I_x(a + j, b) = P(a + j, -b log(1 - x)) to
 *   O((a + j)²/b) (in t = -b log(1 - X) the density of Beta(s, b) is (1 - e^(-t/b))^(s-1) e^-t up to a constant), so
 *   P[X <= x] = P[Y <= -2b log(1 - x)]
 * - "gamma": Y is nearly constant on the scale of the gamma function below (its relative spread 2 sqrt(a + λ)/(2a + λ)
 *   is below 1e-4 / S, S = 40 sqrt(b) + 750 bounding |d log P(b, t)/d log t| where P is above the double range), so
 *   P[X > x] = P[W < Y k] = E P(b, T), T = Y k/2, k = (1 - x)/x, is P(b, t0) plus its expansion in the cumulants of T
 *   about t0 = E T (gammaExpansion)
 * - "w": W is nearly constant on the scale of the distribution function F of Y (its relative spread 1/sqrt(b) is below
 *   1e-5 / S, S = 40 m/σ + 750 bounding |d log F/d log y| likewise, m = 2a + λ, σ = 2 sqrt(a + λ)), so
 *   P[X <= x] = P[Y <= W/k] = E F(W/k) = F(y0) + (2b/k²) F''(y0) + ..., y0 = E W/k = 2b/k (the next term, with the
 *   third cumulant of W, is below 1e-15 of F)
 * - "integral": a large λ or a huge shape otherwise (integralLog)
 */
function method(a, b, ncp) {
    const mu = ncp / 2;
    const s = a + mu + 10 * Math.sqrt(mu) + 10;
    if (b > 1e20 * s * s)
        return "chisq";
    if (2 * Math.sqrt(a + ncp) * (40 * Math.sqrt(b) + 750) < 1e-4 * (2 * a + ncp))
        return "gamma";
    if ((40 * (2 * a + ncp)) / (2 * Math.sqrt(a + ncp)) + 750 < 1e-5 * Math.sqrt(b))
        return "w";
    // (shapes above 1e15 are out of the range of the central incomplete beta function: it does not return for
    // a = 1.7e32, b = 6e-35 at a tiny x)
    return mu > MU_MIXTURE || a > 1e15 || b > 1e15 ? "integral" : "mixture";
}
/** -log(1 - x) from the pair (x, 1 - x) */
function minusLog1mx(xd, xcd) {
    return xd[0] <= 0.5 ? -Math.log1p(-(xd[0] + xd[1])) : -(Math.log(xcd[0]) + xcd[1] / xcd[0]);
}
/** (1 - x)/x from the pair */
function oddsInverse(xd, xcd) {
    const r = ddDiv(xcd, xd);
    return r[0] + r[1];
}
function odds(xd, xcd) {
    const k = oddsInverse(xd, xcd);
    const lk = k > 1e-300 && k < 1e300 ? Math.log(k) : Math.log(xcd[0]) - Math.log(xd[0]);
    return { k, lk, l1mx: -minusLog1mx(xd, xcd) };
}
/** c k, also where k is out of the double range */
function timesK(c, o) {
    return o.k > 1e-300 && o.k < 1e300 ? c * o.k : Math.exp(Math.log(c) + o.lk);
}
/**
 * log g_b(t), the Gamma(b, 1) density, at t = t0 e^v (v = 0 but for the integrals over log y, where the offset is
 * exact; log t0 given where t0 underflows). For b > 1e4 as
 *   b (log(1 + d) - d) - log t + log(b/(2 pi))/2 - 1/(12b) + 1/(360b³),  d = t/b - 1,
 * with t - b = (t0 - b) + t0 (e^v - 1) (Stirling's series for log Γ(b), whose next term is below 1e-23): the density's
 * helpers overflow for b or t near 1e300 and break down where t/b underflows, and the rounding of t would carry an
 * error of eps sqrt(b) into the log near the mode. For smaller b the log is dominated by -t or -log Γ(b) where t/b or
 * b/t is beyond 1e300 (or t underflows), and is taken from (b - 1) log t - t - log Γ(b) directly; for a tiny b as
 * log b + (b - 1) log t - t - log Γ(1 + b) (dgamma1 is Infinity at b = 1.9e-199)
 */
function gammaDensityLog(t0, b, v = 0, logT0 = Math.log(t0)) {
    const logT = logT0 + v;
    const t = v === 0 ? t0 : Math.exp(logT);
    if (b > 1e4) {
        const d = (t0 - b + t0 * Math.expm1(v)) / b;
        return b * log1pmx(d) - logT + 0.5 * Math.log(b / (2 * Math.PI)) - 1 / (12 * b) + 1 / (360 * b * b * b);
    }
    if (b < 1e-10)
        return Math.log(b) + (b - 1) * logT - t - lgamma1p(b);
    if (!(t > 1e-300) || t > 1e300 * b || b > 1e300 * t)
        return (b - 1) * logT - t - lgamma(b);
    return dgamma1(t, b, 1, true);
}
/**
 * P(b, t) (lower) or Q(b, t), the distribution function of W/2 (its log if log), at t = t0 e^v (as gammaDensityLog).
 * Below t = 1e-300 (where t may have underflowed) from the first term of the series, P(b, t) = t^b / Γ(1 + b) (1 + O(t))
 */
function gammaTail(b, t0, lower, log, v = 0, logT0 = Math.log(t0)) {
    const logT = logT0 + v;
    const t = v === 0 ? t0 : Math.exp(logT);
    if (t < 1e-300) {
        const lp = b * logT - lgamma1p(b);
        if (lower)
            return log ? lp : Math.exp(lp);
        // (for a tiny b, P is near 1 and Q = -expm1(lp) small)
        return log ? (lp > -Math.LN2 ? Math.log(-Math.expm1(lp)) : Math.log1p(-Math.exp(lp))) : -Math.expm1(lp);
    }
    // (gammaInc takes 40 ms at b = 1e12, t < b, and 0.1 s at b = 1e37)
    if (b > 1e4)
        return gammaTailNear(b, t0, v, lower, log);
    // Both tails, and the log, from the linear value of the small tail, so that they are consistent (gammaInc's log of
    // a tail can differ from the log of its linear value by 4e-14 relative at a tiny t). The lower tail is the small one
    // below about the median, which is far below b for a tiny b (P(1e-9, 1e-14) = 1 - 3e-8), so it is tried first
    const lowerP = gammaInc(b, t, true, false);
    const small = lowerP <= 0.5;
    const p = small ? lowerP : gammaInc(b, t, false, false);
    if (small !== lower)
        return log ? Math.log1p(-p) : 1 - p;
    if (!log)
        return p;
    return p > 1e-300 ? Math.log(p) : gammaInc(b, t, lower, true);
}
/** P[X <= x] (lower) / P[X > x] (its log if log) by the method (not "mixture") */
function extremeTail(m, a, b, ncp, o, lower, log) {
    if (m === "chisq")
        return pnchisq1(-2 * b * o.l1mx, 2 * a, ncp, lower, log);
    const far = farLeftLog(a, b, ncp, o);
    if (far !== undefined) {
        if (lower)
            return log ? far : 0;
        return log ? -0 : 1;
    }
    const expansion = m === "gamma" ? gammaExpansion(a, b, ncp, o, !lower, log) : m === "w" ? wExpansion(a, b, ncp, o, lower, log) : undefined;
    if (expansion !== undefined)
        return expansion;
    const l = integralTailLog(a, b, ncp, o.lk, lower);
    if (l > -Math.LN2) {
        // The integral is accurate relative to itself: a value near 1 is built from the small value of the other side
        // (unless that integral fails, as it can for a tiny shape, where the integrand is flat towards y = 0)
        const other = Math.exp(integralTailLog(a, b, ncp, o.lk, !lower));
        if (other <= 0.5)
            return log ? Math.log1p(-other) : 1 - other;
    }
    return log ? l : Math.exp(l);
}
/**
 * log P[X <= x] for a λ so large that its leading term -(λ/2)(1 - x) is all of it to the double: undefined otherwise.
 * X <= x is Y <= W x/(1 - x); with log P[Y <= y] = -(sqrt(λ) - sqrt(y))²/2 and log f_W(w) = -w/2 to leading order,
 * the largest term over w is -(λ/2)(1 - x) (at w = λ x (1 - x)), and the rest, from the powers of y and w and the
 * width of the maximum, is of order (a + b + 1) log λ. (The integral cannot place its mode on values that are all
 * -1e295 to the double, and the expansions in the cumulants of Y fail this far out)
 */
function farLeftLog(a, b, ncp, o) {
    const mu = ncp / 2;
    if (!(mu > 1e18))
        return undefined;
    // (λ/2)(1 - x): from log(1 - x) where it is near 0, else as (λ/2) k/(1 + k) (k is then below e)
    const lead = o.l1mx > -1 ? mu * Math.exp(o.l1mx) : timesK(mu, o) / (1 + o.k);
    return lead >= 1e17 * (a + b + 1) * (Math.log(mu) + 50) ? -lead : undefined;
}
/** log P[X <= x] (lower) / log P[X > x] by integralLog, for log k = log((1 - x)/x) */
function integralTailLog(a, b, ncp, logK, lower) {
    // X <= x is W >= Y k
    // (towards y = 0 the integrand goes as y^a, or y^(a + b) where P[W < y k] ~ (y k/2)^b / Γ(b + 1))
    const lk = logK - Math.LN2;
    const h = (u0, v) => gammaTail(b, Math.exp(u0 + lk), !lower, true, v, u0 + lk) + u0 + v;
    return integralLog(a, ncp, h, b, lower ? a : a + b);
}
/** log f(x) by the method (not "mixture") */
function extremeDensityLog(m, a, b, ncp, xd, o) {
    const x = xd[0] + xd[1];
    if (m === "chisq") {
        // f(x) = f_Y(2t) 2b/(1 - x), t = -b log(1 - x)
        return dnchisq1(-2 * b * o.l1mx, 2 * a, ncp, true) + Math.log(2 * b) - o.l1mx;
    }
    // f(x) = E[g_b(T) T] / (k x²), g_b the Gamma(b, 1) density (the derivative of E P(b, T) with dk/dx = -1/x²),
    // expanded to second order about t0
    if (m === "gamma") {
        const t0 = timesK(a + ncp / 2, o);
        // v (h² + h' + 2h/t) with h = (b - 1)/t - 1, written as in gammaExpansion (H = b - 1 - t0)
        const H = b - 1 - t0;
        const c = ((a + ncp) / (a + ncp / 2) / (a + ncp / 2)) * (H * H - (b - 1) + 2 * H);
        if (Math.abs(c) < 1e-3)
            return gammaDensityLog(t0, b) + Math.log(a + ncp / 2) + Math.log1p(c / 2) - 2 * Math.log(x);
    }
    // f(x) = E[f_Y(W/k) W] / (k² x²), to zeroth order f_Y(y0) y0 / (k x²) (relative error below 1e-10)
    if (m === "w") {
        const y0 = timesK(2 * b, { k: 1 / o.k, lk: -o.lk, l1mx: NaN });
        return dnchisq1(y0, 2 * a, ncp, true) + Math.log(y0) - o.lk - 2 * Math.log(x);
    }
    // f(x) = ∫ f_Y(y) f_W(y k) y/x² dy
    const lk = o.lk - Math.LN2;
    const h = (u0, v) => gammaDensityLog(Math.exp(u0 + lk), b, v, u0 + lk) - Math.LN2 + 2 * (u0 + v);
    return integralLog(a, ncp, h, b, a + b) - 2 * Math.log(x);
}
/**
 * E P(b, T) (lower) or E Q(b, T) for T = Y k/2 (its log if log), by the expansion about t0 = E T = (a + λ/2) k in the
 * cumulants of T (variance v = (a + λ) k², third and fourth cumulants (2a + 3λ) k³ and 6 (a + 2λ) k⁴, from those of
 * the noncentral χ²: 2(n + 2λ), 8(n + 3λ), 48(n + 4λ) with n = 2a):
 *   E P(b, T) = P(t0) + v P''/2 + κ3 P'''/6 + (κ4 + 3v²) P''''/24 + ...,
 * with P' = g, P'' = g h, P''' = g (h² - (b - 1)/t²), P'''' = g (h³ - 3h (b - 1)/t² + 2(b - 1)/t³), h = (b - 1)/t - 1.
 * The terms fall by factors of the relative spread of Y times |d log P/d log t| (below 1e-4 by "gamma"), so the
 * error is below 1e-20. Undefined where the correction is not small (|d log P/d log t| larger in a far tail)
 */
function gammaExpansion(a, b, ncp, o, lower, log) {
    const t0 = timesK(a + ncp / 2, o);
    const base = gammaTail(b, t0, lower, log);
    // The choice of the method bounds |d log G/d log t| by 40 sqrt(b) + 750 where G is in the double range; on the log
    // scale G goes beyond, into the tail of G where that is about |t0 - b| (log Q(b, t) is about -t for t >> b)
    const farTail = (lower ? t0 < b : t0 > b) && Math.abs(t0 - b) > 40 * Math.sqrt(b) + 750;
    if (log) {
        // On the log scale the correction is about (v/2) (L'² + L'') (v = (a + λ) k² the variance of T, L = log G), with
        // |L'| at most 1 but far in the tail of G, where log G is nearly linear in t: L' = b/t - 1 for P (t << b),
        // (b - 1)/t - 1 for Q (t >> b). Where that is below 1e-16 of |log G| (its rounding), log G(b, t0) is the answer;
        // far in the tail it is added while the next term, κ3 L'³/6 (κ3 = (2a + 3λ) k³), is below that. (The terms below
        // could not be formed from logs as large as 1e110)
        const c = lower ? b : b - 1;
        const l1 = farTail ? c / t0 - 1 : 1;
        const v = timesK(timesK(a + ncp, o), o);
        if ((v * Math.max(1, l1 * l1)) / 2 <= 1e-16 * Math.abs(base))
            return base;
        const k3 = timesK(timesK(timesK(2 * a + 3 * ncp, o), o), o);
        if (farTail && (k3 * Math.abs(l1 * l1 * l1)) / 6 <= 1e-16 * Math.abs(base))
            return base + (v / 2) * (l1 * l1 - c / t0 / t0);
    }
    // Far enough out (beyond the bound above) the expansion no longer holds, but for the linear value the log above may
    const spreadT = (2 * Math.sqrt(a + ncp)) / (2 * a + ncp);
    if (farTail && !(spreadT * Math.abs(t0 - b) < 1e-4)) {
        const l = log ? undefined : gammaExpansion(a, b, ncp, o, lower, true);
        return l === undefined ? undefined : Math.exp(l);
    }
    // (t0 times the ratio of the density to the tail, d log G/d log t, which stays of order b where t0 underflows and the
    // ratio itself overflows; 0 far in the other tail, where the moments below can overflow)
    const lgt = gammaDensityLog(t0, b) + Math.log(t0);
    const ratio = log ? Math.exp(lgt - base) : base > 0 ? Math.exp(lgt) / base : 0;
    if (!(t0 > 0 && t0 < Infinity) || ratio === 0)
        return base;
    // In terms of H = h t0 = b - 1 - t0, B = b - 1 and the cumulants relative to A^n (A = a + λ/2, t0 = A k), which do
    // not underflow or overflow where the cumulants themselves do: v h/2 = (w/2) t0 H, w = (a + λ)/A², and so on
    const A = a + ncp / 2;
    const w = (a + ncp) / A / A;
    const u3 = (2 * a + 3 * ncp) / A / A / A;
    const u4 = (6 * (a + 2 * ncp)) / A / A / A / A;
    const H = b - 1 - t0;
    const B = b - 1;
    const series = (w / 2) * H + (u3 / 6) * (H * H - B) + ((u4 + 3 * w * w) / 24) * (H * H * H - 3 * H * B + 2 * B);
    // The correction relative to the tail (P or Q = 1 - P, whose derivatives are those of P negated)
    const rel = (lower ? 1 : -1) * ratio * series;
    if (!(Math.abs(rel) < 1e-3))
        return undefined;
    return log ? base + Math.log1p(rel) : base * (1 + rel);
}
/**
 * E F(W/k) (lower) or E (1 - F(W/k)) (its log if log) for the method "w": F(y0) plus (2b/k²) f'(y0) (Var W = 4b, the
 * second derivative of F is f'), with f' from a central difference of log f. Undefined where the correction is not
 * small
 */
function wExpansion(a, b, ncp, o, lower, log) {
    const y0 = timesK(2 * b, { k: 1 / o.k, lk: -o.lk, l1mx: NaN });
    const base = pnchisq1(y0, 2 * a, ncp, lower, log);
    if (!(y0 > 0 && y0 < Infinity))
        return base;
    const h = 1e-6;
    const dlogf = (dnchisq1(y0 * (1 + h), 2 * a, ncp, true) - dnchisq1(y0 * (1 - h), 2 * a, ncp, true)) / (2 * h * y0);
    const lf = dnchisq1(y0, 2 * a, ncp, true);
    const ratio = log ? Math.exp(lf - base) : base > 0 ? Math.exp(lf) / base : 0;
    const rel = (lower ? 1 : -1) * timesK(y0, { k: 1 / o.k, lk: -o.lk, l1mx: NaN }) * ratio * dlogf;
    if (!(Math.abs(rel) < 1e-3))
        return undefined;
    return log ? base + Math.log1p(rel) : base * (1 + rel);
}
/** Ends of the integrals in u = log y: the logs of the smallest and the largest positive doubles */
const U_MIN = -744;
const U_MAX = 709.78;
/**
 * log ∫ exp(L(u)) du over u = log y, L(u) = log f_Y(y) + h(u) (Y ~ χ²(2a, λ)), for an h that makes the integrand
 * unimodal (the log of a distribution function of W at y k, or of its density, plus u or 2u) and that goes as
 * e^(leftSlope u) as y -> 0; h(u0, v) is taken at u0 + v with the offset v exact (as dnchisqLogNear does for f_Y), so
 * that the integrand keeps its accuracy however narrow its peak is in u. The mode is found by a golden-section search,
 * then the integral of exp(L(u) - L(mode)) is taken outwards from it on both sides over intervals of doubling width,
 * each by the adaptive Kronrod rule: upwards until the integrand is below 1e-17 of the sum relative to the rate at
 * which it falls (the secant over the last interval, which overestimates the rest for a log-concave integrand),
 * downwards the same for leftSlope > 1/2, otherwise to the smallest double and the exponential tail beyond. The
 * relative accuracy is that of L(u) - L(mode), about 1e-16 |L(mode)|.
 */
function integralLog(a, ncp, h, b, leftSlope) {
    // L at u0 + v, with the density of Y and h taken at the exact offset v from y0 = e^u0 (dnchisqLogNear)
    const near = (u0, v) => {
        const l = dnchisqLogNear(Math.exp(u0), v, 2 * a, ncp) + h(u0, v);
        // (the density of Y is infinite at y = 0 for 2a < 2, where y underflows; the integrand y f_Y(y) is not)
        return Number.isNaN(l) || l === Infinity ? -Infinity : l;
    };
    const L = (u) => near(u, 0);
    // Golden-section search for the mode. Far from the mode of Y (about log(2a + λ)) L can be constant to the double
    // (-λ/2 + O(sqrt(λ y)) for y << λ = 1e22); equal values there send the search towards it
    const uy = Math.log(2 * a + ncp);
    const g = (3 - Math.sqrt(5)) / 2;
    let lo = U_MIN;
    let hi = U_MAX;
    let c = lo + g * (hi - lo);
    let d = hi - g * (hi - lo);
    let fc = L(c);
    let fd = L(d);
    // (where L is beyond 1e18 only L(mode) is wanted, to its rounding of 1e-16 |L|: a u to 1e-8 gives that)
    const tol = () => (Math.abs(fc) > 1e18 ? 1e-8 : 1e-14) * Math.max(1, Math.abs(c));
    for (let i = 0; i < 300 && hi - lo > tol(); i++) {
        if (fc > fd || (fc === fd && d > uy)) {
            hi = d;
            d = c;
            fd = fc;
            c = lo + g * (hi - lo);
            fc = L(c);
        }
        else {
            lo = c;
            c = d;
            fc = fd;
            d = hi - g * (hi - lo);
            fd = L(d);
        }
    }
    const [um, lm] = fc >= fd ? [c, fc] : [d, fd];
    // Beyond 1e18 the rounding of L(mode) alone exceeds any log of the integral of exp(L - L(mode)) (the log of a width)
    if (!Number.isFinite(lm) || Math.abs(lm) > 1e18)
        return lm;
    // The integrand at u = mode + t
    const f = (t) => {
        const v = Math.exp(near(um, t) - lm);
        return Number.isFinite(v) ? v : 0;
    };
    // First width: from the curvature at the mode, measured over a step where L falls by about 1 (starting from the
    // spread of log Y or of log W)
    const m = 2 * a + ncp;
    let h0 = Math.min(0.1, (2 * Math.sqrt(a + ncp)) / m, 1 / Math.sqrt(b));
    let fall = 0;
    for (let i = 0; i < 30; i++) {
        fall = 2 * lm - near(um, h0) - near(um, -h0);
        if (fall < 0.01 && h0 < 1)
            h0 *= 10;
        else if (fall > 100)
            h0 /= 10;
        else
            break;
    }
    const w0 = fall > 0 && Number.isFinite(fall) ? h0 / Math.sqrt(fall) : h0;
    let sum = 0;
    // The integrand is known to about eps |L(mode)| (its rounding noise), and costs a density of Y and a gamma function
    const control = quadratureControl(Math.max(1e-15, 4 * Number.EPSILON * Math.abs(lm)), 300);
    // L at the smallest double (computed when needed)
    let lEnd;
    for (const dir of [1, -1]) {
        const end = dir > 0 ? U_MAX - um : um - U_MIN;
        let s0 = 0;
        let w = w0;
        let prev = lm;
        for (let i = 0; i < 200 && s0 < end; i++) {
            const s1 = Math.min(s0 + w, end);
            sum += kronrodAdaptive((t) => f(dir * t), s0, s1, sum, 0, control);
            const l1 = near(um, dir * s1);
            const rate = (prev - l1) / (s1 - s0);
            const rest = rate > 0 ? Math.exp(l1 - lm) / rate : Infinity;
            // For a small leftSlope the integrand can have a second, flat part towards y = 0 (for a = 1e-20 Y has nearly an
            // atom e^(-λ/2) at 0), which the fall of the bulk would hide: there the integral goes on until L follows the
            // power law e^(leftSlope u) down to the smallest double, and the rest is that of the power law
            if ((dir > 0 || leftSlope > 0.5) && rest <= 1e-17 * sum)
                break;
            if (dir < 0 && s1 < end) {
                lEnd ??= near(um, -end);
                // (no flat part where even the power law from the smallest double would be negligible)
                if (rest <= 1e-17 * sum && Math.exp(lEnd - lm) / leftSlope <= 1e-17 * sum)
                    break;
                const predicted = l1 - leftSlope * (end - s1);
                if (Number.isFinite(lEnd) && Math.abs(lEnd - predicted) <= 1e-9 * Math.max(1, Math.abs(lEnd))) {
                    sum += Math.exp(l1 - lm) / leftSlope;
                    break;
                }
            }
            // At the lower end of the range (y below the smallest double) add the rest of the tail, exp(L) falling as
            // e^(leftSlope u) (for a shape of 1e-20 L is constant to the double there, and the rest is most of the integral)
            if (s1 === end && dir < 0)
                sum += Math.exp(l1 - lm) / leftSlope;
            prev = l1;
            s0 = s1;
            w *= 2;
        }
    }
    // (a sum that overflows: the mode was not found, as where L is flat to the double for a tiny shape; -Infinity, the
    // log of the integral from the mode alone being no better)
    return Number.isFinite(sum) ? lm + Math.log(sum) : -Infinity;
}
function validBeta(a, b, ncp) {
    return a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b) && ncp >= 0 && Number.isFinite(ncp);
}
// ---- Noncentral beta ----
function dnbetaCore(x, a, b, ncp, log) {
    const [xd, xcd] = pair(x);
    const xx = ddMul(xd, xcd);
    return densitySum(a, b, ncp, xd, xcd, xx[0] + xx[1], log);
}
export function dnbeta1(x, a, b, ncp, log) {
    if (Number.isNaN(x) || Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(ncp))
        return NaN;
    if (!validBeta(a, b, ncp))
        return NaN;
    if (ncp === 0)
        return dbeta1(x, a, b, log);
    if (x < 0 || x > 1)
        return log ? -Infinity : 0;
    const mu = ncp / 2;
    if (x === 0) {
        // Only the j = 0 component matters: diverges for a < 1, b exp(-λ/2) for a = 1
        if (a > 1)
            return log ? -Infinity : 0;
        if (a < 1)
            return Infinity;
        return log ? Math.log(b) - mu : b * Math.exp(-mu);
    }
    if (x === 1) {
        // The density of component j at x = 1 is a + j when b = 1; averaging over the weights gives a + λ/2
        if (b > 1)
            return log ? -Infinity : 0;
        if (b < 1)
            return Infinity;
        return log ? Math.log(a + mu) : a + mu;
    }
    return dnbetaCore(x, a, b, ncp, log);
}
export function pnbeta1(q, a, b, ncp, lowerTail, logP) {
    if (Number.isNaN(q) || Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(ncp))
        return NaN;
    if (q <= 0)
        return dt0(lowerTail, logP);
    if (q >= 1)
        return dt1(lowerTail, logP);
    if (!validBeta(a, b, ncp))
        return NaN;
    if (ncp === 0)
        return pbeta1(q, a, b, lowerTail, logP);
    const [xd, xcd] = pair(q);
    return pnbetaRaw(a, b, ncp, xd, xcd, lowerTail, logP);
}
/** The larger of the relative spreads of Y and W, 2 sqrt(a + λ)/(2a + λ) and 1/sqrt(b) */
function relativeSpread(a, b, ncp) {
    return Math.max((2 * Math.sqrt(a + ncp)) / (2 * a + ncp), 1 / Math.sqrt(b));
}
/** The distribution function of a quantile search, remembering its values: the searches come back to the same x */
function memoCdf(f) {
    const cache = new Map();
    return (x, lower, log) => {
        const key = `${x} ${lower} ${log}`;
        let v = cache.get(key);
        if (v === undefined) {
            v = f(x, lower, log);
            cache.set(key, v);
        }
        return v;
    };
}
/** Whether a shape or df is in the range where the central quantile serves as a starting value */
function inCentralRange(s) {
    return s >= 1e-10 && s <= 1e15;
}
export function qnbeta1(p, a, b, ncp, lowerTail, logP) {
    if (Number.isNaN(p) || Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(ncp))
        return NaN;
    if (!(a > 0 && b > 0 && ncp >= 0))
        return NaN;
    // R returns an answer at the endpoints (p = 0, 1) even for infinite parameters
    const bd = quantileBoundaries(p, 0, 1, lowerTail, logP);
    if (bd !== undefined)
        return bd;
    if (!validBeta(a, b, ncp))
        return NaN;
    if (ncp === 0)
        return qbeta1(p, a, b, lowerTail, logP);
    const { lower, logTarget, linearTarget } = smallerTail(p, lowerTail, logP);
    const cdfAt = memoCdf((x, l, log) => {
        const [xd, xcd] = pair(x);
        return pnbetaRaw(a, b, ncp, xd, xcd, l, log);
    });
    // If the target is already passed at an end point, the answer is not representable (0 or 1)
    const atMin = cdfAt(Number.MIN_VALUE, lower, true);
    if (lower ? atMin >= logTarget : atMin <= logTarget)
        return 0;
    const atMax = cdfAt(1 - Number.EPSILON / 2, lower, true);
    if (lower ? atMax < logTarget : atMax > logTarget)
        return 1;
    // Starting value: quantile of the approximation Beta(a + λ/2, b) (rather than a mean-matched central beta); its
    // mean where the shapes are out of the central quantile's range
    const central = method(a, b, ncp) === "mixture" && inCentralRange(a) && inCentralRange(b);
    let x0 = central ? qbeta1(logTarget, a + ncp / 2, b, lower, true) : (a + ncp / 2) / (a + ncp / 2 + b);
    if (!(x0 > 0 && x0 < 1))
        x0 = 0.5;
    const passes = (x) => (lower ? cdfAt(x, true, true) >= logTarget : cdfAt(x, false, true) <= logTarget);
    const narrow = relativeSpread(a, b, ncp) < 1e-10 ? narrowQuantile(x0, 1 - Number.EPSILON / 2, passes) : undefined;
    if (narrow !== undefined)
        return narrow;
    const x = invertContinuous({
        logTarget,
        ...(linearTarget !== undefined && { linearTarget }),
        lower,
        cdf: (x, l) => cdfAt(x, l, false),
        cdfLog: (x, l) => cdfAt(x, l, true),
        pdfLog: (x) => dnbetaCore(x, a, b, ncp, true),
        x0,
        lo: 0,
        hi: 1,
        positive: true,
        maxIter: 60,
    });
    const search = () => searchDoubles(x, Number.MIN_VALUE, 1 - Number.EPSILON / 2, passes);
    return confirmQuantile(x, cdfAt(x, lower, true), logTarget, search, passes);
}
// ---- Noncentral F ----
/** x = m q/(n + m q) and 1 - x = n/(n + m q) in double-double */
function fPair(q, m, n) {
    const mq = twoProd(m, q);
    if (mq[0] < 1e-290) {
        // m q underflows (a tiny m) where m q/n need not: x = r/(1 + r), 1 - x = 1/(1 + r), r = (m/n) q
        const r = ddMul(ddDiv([m, 0], [n, 0]), [q, 0]);
        const d = ddAdd(r, [1, 0]);
        return [ddDiv(r, d), ddDiv([1, 0], d)];
    }
    if (Number.isFinite(mq[0]) && Number.isFinite(mq[1]) && Math.abs(mq[0]) < 1e290) {
        const d = ddAdd(mq, [n, 0]);
        return [ddDiv(mq, d), ddDiv([n, 0], d)];
    }
    const zc = n / m / q;
    return [twoSum(1, -zc), [zc, 0]];
}
/** The Odds of x = m q/(n + m q): k = n/(m q), from its logs where it is out of the double range */
function fOdds(q, m, n, xd, xcd) {
    const o = odds(xd, xcd);
    if (!(o.k < 1e-300))
        return o;
    const k = n / m / q;
    const lk = Math.log(n) - Math.log(m) - Math.log(q);
    return { k, lk, l1mx: lk - Math.log1p(k) };
}
function dnfCore(q, m, n, ncp, log) {
    if ((m / n) * q < 1e-306) {
        // First term of the series: f(q) ≈ exp(-λ/2) (m q / n)^a / (B(a, b) q)
        const a = m / 2;
        const l = -ncp / 2 + a * (Math.log(m / n) + Math.log(q)) - lbeta(a, n / 2) - Math.log(q);
        return log ? l : Math.exp(l);
    }
    const [xd, xcd] = fPair(q, m, n);
    return densitySum(m / 2, n / 2, ncp, xd, xcd, q, log, fOdds(q, m, n, xd, xcd));
}
/**
 * q so small that x = m q/(n + m q) underflows: first term of the series
 * P[F <= q] ≈ exp(-λ/2) x^a / (a B(a, b)), x ≈ m q / n (relative error about x)
 */
function pnfTiny(q, m, n, ncp, lower, log) {
    const a = m / 2;
    const l = -ncp / 2 + a * (Math.log(m / n) + Math.log(q)) - Math.log(a) - lbeta(a, n / 2);
    if (lower)
        return log ? l : Math.exp(l);
    return log ? Math.log1p(-Math.exp(l)) : -Math.expm1(l);
}
export function pnfRaw(q, m, n, ncp, lower, log) {
    if ((m / n) * q < 1e-306)
        return pnfTiny(q, m, n, ncp, lower, log);
    const [xd, xcd] = fPair(q, m, n);
    return pnbetaRaw(m / 2, n / 2, ncp, xd, xcd, lower, log, fOdds(q, m, n, xd, xcd));
}
export function dnf1(x, m, n, ncp, log) {
    if (Number.isNaN(x) || Number.isNaN(m) || Number.isNaN(n) || Number.isNaN(ncp))
        return NaN;
    if (!(m > 0 && n > 0 && ncp >= 0))
        return NaN;
    if (x < 0)
        return log ? -Infinity : 0;
    if (!Number.isFinite(ncp))
        return NaN;
    if (m === Infinity) {
        // For df1 = Inf, R ignores ncp and returns the density of the central n / χ²_n (NaN at x = 0)
        if (n === Infinity)
            return x === 1 ? Infinity : log ? -Infinity : 0;
        return x === 0 ? NaN : dfDensity1(x, m, n, log);
    }
    if (n === Infinity) {
        // F = χ²_m(ncp) / m
        const v = dnchisq1(x * m, m, ncp, log);
        return log ? v + Math.log(m) : v * m;
    }
    if (x === Infinity)
        return NaN; // R gives NaN at x = Inf when df2 is finite
    if (x === 0) {
        if (m < 2)
            return Infinity;
        if (m > 2)
            return log ? -Infinity : 0;
        return log ? -ncp / 2 : Math.exp(-ncp / 2);
    }
    if (ncp === 0)
        return dfDensity1(x, m, n, log);
    return dnfCore(x, m, n, ncp, log);
}
export function pnf1(q, m, n, ncp, lowerTail, logP) {
    if (Number.isNaN(q) || Number.isNaN(m) || Number.isNaN(n) || Number.isNaN(ncp))
        return NaN;
    if (!(m > 0 && n > 0 && ncp >= 0) || !Number.isFinite(ncp))
        return NaN;
    if (m === Infinity && n === Infinity)
        return NaN;
    if (q <= 0)
        return dt0(lowerTail, logP);
    if (q === Infinity)
        return dt1(lowerTail, logP);
    if (m === Infinity)
        return NaN;
    if (n === Infinity)
        return pnchisq1(q * m, m, ncp, lowerTail, logP);
    if ((m / n) * q < 1e-306)
        return pnfTiny(q, m, n, ncp, lowerTail, logP);
    if (ncp === 0)
        return pf1(q, m, n, lowerTail, logP);
    const neg = negligibleTail(fTailBound(q, m, n, ncp), lowerTail, logP);
    if (neg !== undefined)
        return neg;
    return pnfRaw(q, m, n, ncp, lowerTail, logP);
}
/** Below this log a probability rounds to 0 in double precision (as in src/distributions/nchisq.ts) */
const LOG_NEGLIGIBLE = -746;
/**
 * Chernoff bounds of the noncentral F = (X/m)/(V/n), X ~ χ²(m, λ), V ~ χ²(n) independent. With c = q m/n,
 * F <= q is X - cV <= 0, and E[e^(-s(X - cV))] = (1 + 2s)^(-m/2) e^(-λs/(1 + 2s)) (1 - 2cs)^(-n/2) for 0 < s < 1/(2c)
 * bounds P[F <= q]; E[e^(s(X - cV))] = (1 - 2s)^(-m/2) e^(λs/(1 - 2s)) (1 + 2cs)^(-n/2) for 0 < s < 1/2 bounds
 * P[F >= q]. Every s in range gives a valid bound; the smallest over a grid of s is taken. Returns the tail whose
 * bound is below the double range.
 */
function fTailBound(q, m, n, ncp) {
    const c = (q * m) / n;
    if (!(c > 0 && Number.isFinite(c)))
        return undefined;
    // (c s formed first: 2c overflows for q near the largest double)
    const lower = (s) => -(m / 2) * Math.log1p(2 * s) - (ncp * s) / (1 + 2 * s) - (n / 2) * Math.log1p(-2 * (c * s));
    const upper = (s) => -(m / 2) * Math.log1p(-2 * s) + (ncp * s) / (1 - 2 * s) - (n / 2) * Math.log1p(2 * (c * s));
    const best = (f, sMax) => {
        let b = Infinity;
        for (let i = 1; i <= 60; i++) {
            const v = Math.min(f(sMax * 2 ** -i), f(sMax * (1 - 2 ** -i)));
            if (v < b)
                b = v;
        }
        return b;
    };
    if (best(lower, 1 / (2 * c)) < LOG_NEGLIGIBLE)
        return "lower";
    if (best(upper, 0.5) < LOG_NEGLIGIBLE)
        return "upper";
    return undefined;
}
export function qnf1(p, m, n, ncp, lowerTail, logP) {
    if (Number.isNaN(p) || Number.isNaN(m) || Number.isNaN(n) || Number.isNaN(ncp))
        return NaN;
    if (!(m > 0 && n > 0 && ncp >= 0) || !Number.isFinite(ncp))
        return NaN;
    const bd = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
    if (bd !== undefined)
        return bd;
    if (m === Infinity)
        return NaN;
    if (n === Infinity)
        return qnchisq1(p, m, ncp, lowerTail, logP) / m;
    if (ncp === 0)
        return qf1(p, m, n, lowerTail, logP);
    return qnfRaw(p, m, n, ncp, lowerTail, logP);
}
function qnfRaw(p, m, n, ncp, lowerTail, logP) {
    const { lower, logTarget, linearTarget } = smallerTail(p, lowerTail, logP);
    const cdfAt = memoCdf((x, l, log) => pnfRaw(x, m, n, ncp, l, log));
    const atMin = cdfAt(Number.MIN_VALUE, lower, true);
    if (lower ? atMin >= logTarget : atMin <= logTarget)
        return 0;
    const atMax = cdfAt(Number.MAX_VALUE, lower, true);
    if (lower ? atMax < logTarget : atMax > logTarget)
        return Infinity;
    // Starting value: Patnaik's approximation (m + λ)/m F(ν, n), ν = (m + λ)^2/(m + 2λ); (m + λ)/m (the ratio of the
    // means of the χ² variables per degree of freedom) where the parameters are out of the central quantile's range
    const nu = (m + ncp) * ((m + ncp) / (m + 2 * ncp));
    const central = method(m / 2, n / 2, ncp) === "mixture" && inCentralRange(m) && inCentralRange(n);
    let x0 = ((m + ncp) / m) * (central ? qf1(logTarget, nu, n, lower, true) : 1);
    if (!(x0 > 0) || !Number.isFinite(x0))
        x0 = 1;
    const passes = (x) => (lower ? cdfAt(x, true, true) >= logTarget : cdfAt(x, false, true) <= logTarget);
    const narrow = relativeSpread(m / 2, n / 2, ncp) < 1e-10 ? narrowQuantile(x0, Number.MAX_VALUE, passes) : undefined;
    if (narrow !== undefined)
        return narrow;
    const x = invertContinuous({
        logTarget,
        ...(linearTarget !== undefined && { linearTarget }),
        lower,
        cdf: (x, l) => cdfAt(x, l, false),
        cdfLog: (x, l) => cdfAt(x, l, true),
        pdfLog: (x) => dnfCore(x, m, n, ncp, true),
        x0,
        lo: 0,
        hi: Infinity,
        positive: true,
        maxIter: 60,
    });
    const search = () => searchDoubles(x, Number.MIN_VALUE, Number.MAX_VALUE, passes);
    return confirmQuantile(x, cdfAt(x, lower, true), logTarget, search, passes);
}
