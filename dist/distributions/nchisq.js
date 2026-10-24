// Density, distribution function and quantile of the noncentral χ² distribution (ncp = λ).
//
// The noncentral χ² with k degrees of freedom and noncentrality λ is a mixture of central χ²_{k+2j} with
// weights Pois(j; λ/2) (Johnson, Kotz & Balakrishnan 1995, ch. 29). With y = x/2 and a = k/2,
//   P[X <= x] = Σ_j w_j P(a + j, y),  P[X > x] = Σ_j w_j Q(a + j, y)
//   f(x) = Σ_j w_j y^(a+j-1) e^-y / Gamma(a + j) / 2
// Consecutive components are linked by P(a+j, y) - P(a+j+1, y) = y^(a+j) e^-y / Gamma(a+j+1) = dpois(a + j; y)
// (src/internal/poissonMixture.ts). The density components can be written dpois(a + j; y) (a + j) / y.
// Quantiles use Newton's method starting from Patnaik's (1949) approximation (c χ²_ν, c = (k + 2λ)/(k + λ),
// ν = (k + λ)^2/(k + 2λ)).
import { dt0, dt1, quantileBoundaries, smallerTail } from "../internal/dpq.js";
import { invertContinuous } from "../internal/invert.js";
import { dpoisLogDD, mixtureCdf, mixtureCdfBoth, mixtureDensity } from "../internal/poissonMixture.js";
import { gammaInc } from "../special/igam.js";
import { dpoisRaw } from "../special/loader.js";
import { ddAdd, ddDiv, twoSum } from "../special/dd.js";
import { digamma } from "../special/psigamma.js";
import { dgamma1, qgamma1 } from "./gamma.js";
function gammaKernel(a, y) {
    // For very small y the ratio y/(a+j) underflows, so keep it scaled by 2^500
    const tiny = y < 1e-250;
    const ys = tiny ? y * 2 ** 500 : y;
    return {
        ratioK: tiny ? -1 : 0,
        cdf: (j, lower, log) => gammaInc(a + j, y, lower, log),
        inc: (j, log) => {
            const [s, corr] = incCorrection(a, j, y);
            return log ? dpoisRaw(s, y, true) + corr : dpoisRaw(s, y, false) * (1 + corr);
        },
        // d_j / d_{j-1} = y / (a + j)
        ratio: (j) => ddDiv([ys, 0], twoSum(a, j)),
        incLogDD: (j) => {
            const [s, corr] = incCorrection(a, j, y);
            return ddAdd(dpoisLogDD(s, y), [corr, 0]);
        },
    };
}
/**
 * The shape a + j rounded to double, s, and the first-order change in log d_j from s to the exact a + j:
 * δ ∂log d/∂s with δ the rounding and ∂log dpois(s; y)/∂s = log y - ψ(s + 1). Far in a tail |log y - ψ(s + 1)| is
 * large (above 1 at s = 1130, y = 331), and since the recurrences carry d_j to every other term, the rounding of
 * s (1e-13 there) would otherwise reach the result in full
 */
function incCorrection(a, j, y) {
    const [s, delta] = twoSum(a, j);
    return [s, delta === 0 ? 0 : delta * (Math.log(y) - digamma(s + 1))];
}
/** Whether the parameters are valid for the noncentral χ² (R gives NaN for df = Inf or ncp = Inf) */
function validParams(df, ncp) {
    return df >= 0 && ncp >= 0 && Number.isFinite(df) && Number.isFinite(ncp);
}
/**
 * Linear value and log of P[X <= x] (lower) / P[X > x] (x > 0 finite, ncp > 0).
 * The log of a value near 1 is built with log1p from the small value of the other side
 */
function pnchisqBoth(x, df, ncp, lower) {
    const mu = ncp / 2;
    if (mu * (x / 2) > 1e18) {
        // x λ is very large (far in the right tail): the peak of the series is too far away, so build the tail from the density (besselAsymptotic)
        const lq = upperTailAsymptotic(x, df, ncp);
        if (lower)
            return { lin: -Math.expm1(lq), log: Math.log1p(-Math.exp(lq)) };
        return { lin: Math.exp(lq), log: lq };
    }
    // x so small that x/2 underflows to 0 (the smallest subnormal) is approximated by the smallest positive number
    const kernel = gammaKernel(df / 2, Math.max(x / 2, Number.MIN_VALUE));
    const own = mixtureCdfBoth(mu, kernel, lower);
    if (own.lin > 0.5) {
        // The log of a value near 1 is built with log1p from the small value of the other side (computed only when the log is needed)
        let lg;
        return {
            lin: own.lin,
            get log() {
                lg ??= Math.log1p(-mixtureCdf(mu, kernel, !lower, false));
                return lg;
            },
        };
    }
    return own;
}
/**
 * log P[X > x] for very large x. Using the log-derivative of the density f, -(log f)' = s(x),
 * P[X > x] = f(x)/s(x) (1 + O(x^-3/2)),  s(x) = 1/2 - sqrt(λ/x)/2 - (k - 3)/(4x)
 * (f in the form of besselAsymptotic. Used for x λ > 1e18, so the correction is negligible)
 */
function upperTailAsymptotic(x, df, ncp) {
    const s = 0.5 - Math.sqrt(ncp / x) / 2 - (df - 3) / (4 * x);
    return besselAsymptotic(x, df, ncp, true) - Math.log(s);
}
function pnchisqRaw(x, df, ncp, lower, log) {
    const v = pnchisqBoth(x, df, ncp, lower);
    return log ? v.log : v.lin;
}
/** Quantile iterations ask for the linear value and the log at the same x in succession, so cache the last result */
function memoCdf(df, ncp) {
    let lastX = NaN;
    let lastLower = true;
    let last = { lin: NaN, log: NaN };
    return (x, lower) => {
        if (x !== lastX || lower !== lastLower) {
            last = pnchisqBoth(x, df, ncp, lower);
            lastX = x;
            lastLower = lower;
        }
        return last;
    };
}
/** Core of the log density (x > 0 finite, ncp > 0) */
function dnchisqRaw(x, df, ncp, log) {
    const a = df / 2;
    const y = x / 2;
    const mu = ncp / 2;
    // The ratio of terms w_j g_j is mu y / (j (a + j - 1)); the peak is at the j where it equals 1
    const jStar = (-(a - 1) + Math.sqrt((a - 1) * (a - 1) + 4 * mu * y)) / 2;
    if (mu * y > 1e18)
        return besselAsymptotic(x, df, ncp, log);
    // Component density y^(a+j-1) e^-y / Gamma(a+j) = d_j (a + j) / y
    return mixtureDensity(mu, gammaKernel(a, y), (j) => a + j, jStar, x, log);
}
/**
 * Density for very large x λ. Apply to f(x) = exp(-(x+λ)/2) (x/λ)^(ν/2) I_ν(sqrt(λ x)) / 2 (ν = k/2 - 1) the
 * large-z asymptotic expansion of I_ν(z), e^z / sqrt(2 pi z) Σ_m (-1)^m a_m(ν) / z^m.
 * (The series cannot be summed because its peak j ≈ sqrt(λ x / 4) is too far out. z > 1e9, so the expansion converges in a few terms)
 */
function besselAsymptotic(x, df, ncp, log) {
    const nu = df / 2 - 1;
    const z = Math.sqrt(ncp * x);
    const mu4 = 4 * nu * nu;
    let term = 1;
    let s = 1;
    for (let m = 1; m < 30; m++) {
        term *= -(mu4 - (2 * m - 1) * (2 * m - 1)) / (8 * m * z);
        s += term;
        if (Math.abs(term) < 1e-17 * Math.abs(s))
            break;
    }
    // -(x + λ)/2 + z = -(sqrt(x) - sqrt(λ))^2 / 2
    const d = Math.sqrt(x) - Math.sqrt(ncp);
    const lv = -Math.LN2 - (d * d) / 2 + (nu / 2) * Math.log(x / ncp) - 0.5 * Math.log(2 * Math.PI * z) + Math.log(s);
    return log ? lv : Math.exp(lv);
}
export function dnchisq1(x, df, ncp, log) {
    if (Number.isNaN(x) || Number.isNaN(df) || Number.isNaN(ncp))
        return NaN;
    if (!validParams(df, ncp))
        return NaN;
    if (ncp === 0)
        return dgamma1(x, df / 2, 2, log);
    if (x < 0 || x === Infinity)
        return log ? -Infinity : 0;
    if (x === 0) {
        // Diverges for df < 2; exp(-λ/2)/2 for df = 2; 0 for larger df
        if (df < 2)
            return Infinity;
        if (df === 2)
            return log ? -ncp / 2 - Math.LN2 : Math.exp(-ncp / 2) / 2;
        return log ? -Infinity : 0;
    }
    return dnchisqRaw(x, df, ncp, log);
}
export function pnchisq1(q, df, ncp, lowerTail, logP) {
    if (Number.isNaN(q) || Number.isNaN(df) || Number.isNaN(ncp))
        return NaN;
    if (!validParams(df, ncp))
        return NaN;
    if (q < 0)
        return dt0(lowerTail, logP);
    if (q === 0) {
        // With 0 degrees of freedom there is a point mass exp(-λ/2) at 0
        if (df > 0)
            return dt0(lowerTail, logP);
        const lm = -ncp / 2;
        if (lowerTail)
            return logP ? lm : Math.exp(lm);
        return logP ? (lm < -Math.LN2 ? Math.log1p(-Math.exp(lm)) : Math.log(-Math.expm1(lm))) : -Math.expm1(lm);
    }
    if (ncp === 0) {
        // Central distribution. q so small that q/2 underflows to 0 is approximated by the smallest positive number
        return q === Infinity ? dt1(lowerTail, logP) : gammaInc(df / 2, Math.max(q / 2, Number.MIN_VALUE), lowerTail, logP);
    }
    if (q === Infinity)
        return dt1(lowerTail, logP);
    return pnchisqRaw(q, df, ncp, lowerTail, logP);
}
export function qnchisq1(p, df, ncp, lowerTail, logP) {
    if (Number.isNaN(p) || Number.isNaN(df) || Number.isNaN(ncp))
        return NaN;
    // R returns an answer for ncp = Inf at the endpoints (p = 0, 1) only
    if (!(df >= 0 && ncp >= 0 && Number.isFinite(df)))
        return NaN;
    const b = quantileBoundaries(p, 0, Infinity, lowerTail, logP);
    if (b !== undefined)
        return b;
    if (!Number.isFinite(ncp)) {
        // For ncp = Inf, R returns the endpoint value only when log p rounds to 1 (exp(p) == 1)
        if (logP && Math.exp(p) === 1)
            return lowerTail ? Infinity : 0;
        return NaN;
    }
    if (ncp === 0)
        return qgamma1(p, df / 2, 2, lowerTail, logP);
    const { lower, logTarget, linearTarget } = smallerTail(p, lowerTail, logP);
    const cdf = memoCdf(df, ncp);
    // If the distribution function at the smallest positive number already passes the target, the answer is 0 (includes the point mass for df = 0)
    const atMin = pnchisqRaw(Number.MIN_VALUE, df, ncp, lower, true);
    if (lower ? atMin >= logTarget : atMin <= logTarget)
        return 0;
    // Patnaik's approximation as the starting value
    const c = (df + 2 * ncp) / (df + ncp);
    const nu = ((df + ncp) * (df + ncp)) / (df + 2 * ncp);
    let x0 = c * qgamma1(logTarget, nu / 2, 2, lower, true);
    if (!(x0 > 0) || !Number.isFinite(x0))
        x0 = df + ncp;
    // Bracket by doubling the upper end (the distribution function is expensive for very large x)
    let hi = Math.max(x0, df + ncp, 1);
    for (let i = 0; i < 2000; i++) {
        const v = pnchisqRaw(hi, df, ncp, lower, true);
        if (lower ? v >= logTarget : v <= logTarget)
            break;
        hi *= 2;
    }
    return invertContinuous({
        logTarget,
        ...(linearTarget !== undefined && { linearTarget }),
        lower,
        cdf: (x, l) => cdf(x, l).lin,
        cdfLog: (x, l) => cdf(x, l).log,
        pdfLog: (x) => dnchisqRaw(x, df, ncp, true),
        x0: Math.min(x0, hi),
        lo: 0,
        hi,
        positive: true,
    });
}
