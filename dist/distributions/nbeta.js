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
//
// The noncentral F is computed from the fact that X = m F / (n + m F) follows the noncentral beta (m/2, n/2, λ).
// Its density is f_F(q) = Σ_j w_j e_j (a + j) / q (dx/dq and x (1 - x) cancel).
// x and 1 - x are formed as a double-double pair (rounding is amplified by the parameters, as for the central distribution).
import { dt0, dt1, quantileBoundaries, smallerTail } from "../internal/dpq.js";
import { invertContinuous } from "../internal/invert.js";
import { mixtureCdf, mixtureDensity } from "../internal/poissonMixture.js";
import { ddAdd, ddDiv, ddLog, ddMul, ddMulNum, ddNeg, twoProd, twoSum } from "../special/dd.js";
import { lbeta, lbetaDD } from "../special/beta.js";
import { digamma } from "../special/psigamma.js";
import { betaIncDD } from "../special/incbet.js";
import { dbinomExponent, dbinomRawDD } from "../special/loader.js";
import { dbeta1, pbeta1, qbeta1 } from "./beta.js";
import { dfDensity1, pf1, qf1 } from "./f.js";
import { dnchisq1, pnchisq1, qnchisq1 } from "./nchisq.js";
function betaKernel(a, b, xd, xcd) {
    const ab = twoSum(a, b);
    // For very small x the ratio underflows, so keep it scaled by 2^500
    const tiny = xd[0] < 1e-250;
    const xs = tiny ? [xd[0] * 2 ** 500, xd[1] * 2 ** 500] : xd;
    return {
        ratioK: tiny ? -1 : 0,
        cdf: (j, lower, log) => betaIncDD(a + j, b, xd, xcd, lower, log),
        inc: (j, log) => {
            const [s, corr] = incCorrection(a, b, j, xd);
            const c = b / (s + b);
            return log
                ? dbinomRawDD(s, b, xd, xcd, true) + Math.log(c) + corr
                : dbinomRawDD(s, b, xd, xcd, false) * c * (1 + corr);
        },
        // e_j / e_{j-1} = x (a + b + j - 1) / (a + j)
        ratio: (j) => ddDiv(ddMul(xs, ddAdd(ab, [j - 1, 0])), twoSum(a, j)),
        incLogDD: (j) => {
            // log e_j = log dbinom(a + j; a + b + j, x) + log(b / (a + b + j))
            // Near subnormal x the binomial-probability helpers break down, so build it from the log of the beta function
            const [s, corr] = incCorrection(a, b, j, xd);
            if (!(xd[0] > 1e-305 && xcd[0] > 1e-305)) {
                const l = betaKernelIncLog(s, b, xd, xcd);
                return typeof l === "number" ? l + corr : ddAdd(l, [corr, 0]);
            }
            const { e, logDenom } = dbinomExponent(s, b, xd, xcd);
            return ddAdd([-e[0], -e[1]], [-0.5 * logDenom + Math.log(b / (s + b)) + corr, 0]);
        },
    };
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
 * log e_j = -log B(s, b) - log(s) + s log x + b log(1 - x)
 */
function betaKernelIncLog(s, b, xd, xcd) {
    if (!(xd[0] > 0 && xcd[0] > 0))
        return -Infinity;
    const l = ddAdd(ddMulNum(ddLog(xd), s), ddMulNum(ddLog(xcd), b));
    return ddAdd(ddAdd(l, ddNeg(lbetaDD(s, b))), [-Math.log(s), 0]);
}
/** Form x and 1 - x as a double-double pair, based on the smaller of the two */
function pair(x) {
    return x <= 0.5 ? [[x, 0], twoSum(1, -x)] : [twoSum(1, -(1 - x)), [1 - x, 0]];
}
/** One-sided probability (P[X <= x] if lower). 0 < x < 1 */
function pnbetaRaw(a, b, ncp, xd, xcd, lower, log) {
    const kernel = betaKernel(a, b, xd, xcd);
    const mu = ncp / 2;
    const v = mixtureCdf(mu, kernel, lower, false);
    if (!log)
        return v;
    // The log of a value near 1 is built with log1p from the small value of the other side
    if (v > 0.5)
        return Math.log1p(-mixtureCdf(mu, kernel, !lower, false));
    return v >= 1e-280 ? Math.log(v) : mixtureCdf(mu, kernel, lower, true);
}
/** Σ_j w_j e_j (a + j) / divisor. For the density, divisor = x (1 - x) (beta) or q (F) */
function densitySum(a, b, ncp, xd, xcd, divisor, log) {
    const mu = ncp / 2;
    const x = xd[0];
    // The peak is at the j where the term ratio mu x (a + b + j - 1) / (j (a + j - 1)) equals 1
    const c = mu * x;
    const p = a - 1 - c;
    const jStar = (-p + Math.sqrt(Math.max(0, p * p + 4 * c * (a + b - 1)))) / 2;
    return mixtureDensity(mu, betaKernel(a, b, xd, xcd), (j) => a + j, jStar, divisor, log);
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
    const cdfAt = (x, l, log) => {
        const [xd, xcd] = pair(x);
        return pnbetaRaw(a, b, ncp, xd, xcd, l, log);
    };
    // If the target is already passed at an end point, the answer is not representable (0 or 1)
    const atMin = cdfAt(Number.MIN_VALUE, lower, true);
    if (lower ? atMin >= logTarget : atMin <= logTarget)
        return 0;
    const atMax = cdfAt(1 - Number.EPSILON / 2, lower, true);
    if (lower ? atMax < logTarget : atMax > logTarget)
        return 1;
    // Starting value: quantile of the approximation Beta(a + λ/2, b) (rather than a mean-matched central beta)
    let x0 = qbeta1(logTarget, a + ncp / 2, b, lower, true);
    if (!(x0 > 0 && x0 < 1))
        x0 = 0.5;
    return invertContinuous({
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
    });
}
// ---- Noncentral F ----
/** x = m q/(n + m q) and 1 - x = n/(n + m q) in double-double */
function fPair(q, m, n) {
    const mq = twoProd(m, q);
    if (Number.isFinite(mq[0]) && Number.isFinite(mq[1]) && Math.abs(mq[0]) < 1e290) {
        const d = ddAdd(mq, [n, 0]);
        return [ddDiv(mq, d), ddDiv([n, 0], d)];
    }
    const zc = n / m / q;
    return [twoSum(1, -zc), [zc, 0]];
}
function dnfCore(q, m, n, ncp, log) {
    if ((m / n) * q < 1e-306) {
        // First term of the series: f(q) ≈ exp(-λ/2) (m q / n)^a / (B(a, b) q)
        const a = m / 2;
        const l = -ncp / 2 + a * (Math.log(m / n) + Math.log(q)) - lbeta(a, n / 2) - Math.log(q);
        return log ? l : Math.exp(l);
    }
    const [xd, xcd] = fPair(q, m, n);
    return densitySum(m / 2, n / 2, ncp, xd, xcd, q, log);
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
    return log ? -Math.exp(l) : -Math.expm1(l);
}
export function pnfRaw(q, m, n, ncp, lower, log) {
    if ((m / n) * q < 1e-306)
        return pnfTiny(q, m, n, ncp, lower, log);
    const [xd, xcd] = fPair(q, m, n);
    return pnbetaRaw(m / 2, n / 2, ncp, xd, xcd, lower, log);
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
    return pnfRaw(q, m, n, ncp, lowerTail, logP);
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
    const atMin = pnfRaw(Number.MIN_VALUE, m, n, ncp, lower, true);
    if (lower ? atMin >= logTarget : atMin <= logTarget)
        return 0;
    const atMax = pnfRaw(Number.MAX_VALUE, m, n, ncp, lower, true);
    if (lower ? atMax < logTarget : atMax > logTarget)
        return Infinity;
    // Starting value: Patnaik's approximation (m + λ)/m F(ν, n), ν = (m + λ)^2/(m + 2λ)
    const nu = ((m + ncp) * (m + ncp)) / (m + 2 * ncp);
    let x0 = ((m + ncp) / m) * qf1(logTarget, nu, n, lower, true);
    if (!(x0 > 0) || !Number.isFinite(x0))
        x0 = 1;
    return invertContinuous({
        logTarget,
        ...(linearTarget !== undefined && { linearTarget }),
        lower,
        cdf: (x, l) => pnfRaw(x, m, n, ncp, l, false),
        cdfLog: (x, l) => pnfRaw(x, m, n, ncp, l, true),
        pdfLog: (x) => dnfCore(x, m, n, ncp, true),
        x0,
        lo: 0,
        hi: Infinity,
        positive: true,
    });
}
