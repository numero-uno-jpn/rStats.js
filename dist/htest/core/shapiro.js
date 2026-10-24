// Shapiro-Wilk W statistic and its p-value, for shapiro.test.
//
// Written for rStats.js from the published approximations (no ported code): Royston, "Approximating the
// Shapiro-Wilk W-test for non-normality", Statistics and Computing 2, 1992, and Royston, "Remark AS R94: A remark on
// Algorithm AS 181: The W-test for normality", Applied Statistics 44, 1995.
//
// Coefficients: m_i = qnorm((i - 3/8) / (n + 1/4)) and, with u = 1/sqrt(n), polynomial corrections for the two
// largest coefficients; the others are m_i / sqrt(phi) so that sum a_i^2 = 1.
// p-value: n = 3 exactly; 4 <= n <= 11: -log(gamma - log(1 - W)) is normal; n >= 12: log(1 - W) is normal, with
// means and standard deviations given as polynomials in n or log(n).
// Beyond the range of Royston's approximation for 4 <= n <= 11 the p-value is 1e-99: 1e-99 is the value R reports
// here (observed behaviour).
import { pnorm, qnorm } from "../../distributions/normal.js";
/** Polynomial c[0] + c[1] x + c[2] x^2 + ... */
function poly(c, x) {
    let s = 0;
    for (let i = c.length - 1; i >= 0; i--)
        s = s * x + c[i];
    return s;
}
const C1 = [0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056];
const C2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];
const C3 = [0.544, -0.39978, 0.025054, -6.714e-4];
const C4 = [1.3822, -0.77857, 0.062767, -0.0020322];
const C5 = [-1.5861, -0.31082, -0.083751, 0.0038915];
const C6 = [-0.4803, -0.082676, 0.0030302];
const G = [-2.273, 0.459];
/**
 * The Shapiro-Wilk coefficients a_1..a_n for a sample of size n (3 <= n <= 5000), antisymmetric
 * (a_i = -a_(n+1-i)) with sum a_i^2 = 1.
 */
export function swilkCoefficients(n) {
    if (!(n >= 3) || n !== Math.floor(n))
        throw new RangeError("n must be an integer of at least 3");
    const a = new Float64Array(n);
    if (n === 3) {
        a[0] = -Math.SQRT1_2;
        a[2] = Math.SQRT1_2;
        return a;
    }
    const half = Math.floor(n / 2);
    const m = new Float64Array(half); // m for the upper half, m[0] the largest
    let summ2 = 0;
    for (let i = 0; i < half; i++) {
        // upper half: i-th largest expected normal order statistic
        m[i] = -qnorm((i + 1 - 0.375) / (n + 0.25));
        summ2 += m[i] * m[i];
    }
    summ2 *= 2;
    const ssumm2 = Math.sqrt(summ2);
    const rsn = 1 / Math.sqrt(n);
    // the two largest coefficients a_n and a_(n-1), corrected by polynomials in u = 1/sqrt(n)
    const an = m[0] / ssumm2 + poly(C1, rsn);
    const up = new Float64Array(half);
    up[0] = an;
    let first;
    let fac;
    if (n > 5) {
        const an1 = m[1] / ssumm2 + poly(C2, rsn);
        up[1] = an1;
        first = 2;
        fac = Math.sqrt((summ2 - 2 * m[0] * m[0] - 2 * m[1] * m[1]) / (1 - 2 * an * an - 2 * an1 * an1));
    }
    else {
        first = 1;
        fac = Math.sqrt((summ2 - 2 * m[0] * m[0]) / (1 - 2 * an * an));
    }
    for (let i = first; i < half; i++)
        up[i] = m[i] / fac;
    // a_n, a_(n-1), ... positive for the largest observations
    for (let i = 0; i < half; i++) {
        a[n - 1 - i] = up[i];
        a[i] = -up[i];
    }
    return a;
}
/**
 * 1 - W for a sample sorted in increasing order, formed as (r + c)(r - c) / r^2 from c = sum a_i (x_i - mean) and
 * r^2 = sum a_i^2 sum (x_i - mean)^2, so that it keeps its relative accuracy when W is close to 1 (the p-value
 * depends on log(1 - W)). The data are scaled by their range first.
 */
export function swilkOneMinusW(sorted) {
    const n = sorted.length;
    const a = swilkCoefficients(n);
    const range = sorted[n - 1] - sorted[0];
    let mean = 0;
    for (const v of sorted)
        mean += v / range;
    mean /= n;
    let ssa = 0;
    let ssx = 0;
    let sax = 0;
    for (let i = 0; i < n; i++) {
        const d = sorted[i] / range - mean;
        ssa += a[i] * a[i];
        ssx += d * d;
        sax += a[i] * d;
    }
    const r = Math.sqrt(ssa * ssx);
    return ((r - sax) * (r + sax)) / (ssa * ssx);
}
/**
 * The W statistic of a sample sorted in increasing order:
 * W = (sum a_i x_(i))^2 / sum (x_i - mean)^2.
 */
export function swilkW(sorted) {
    return 1 - swilkOneMinusW(sorted);
}
/**
 * The p-value P(W' <= W) of the Shapiro-Wilk test for a sample of size n (Royston's approximations), from W.
 */
export function swilkPValue(w, n) {
    return swilkPValueFromOneMinusW(1 - w, n);
}
/** 6/pi and asin(sqrt(3/4)) to 15 digits, the values R's swilk uses for n = 3 */
const PI6 = 1.90985931710274;
const STQR = 1.0471975511966;
/**
 * The p-value P(W' <= W) of the Shapiro-Wilk test for a sample of size n, from w1 = 1 - W (see swilkOneMinusW).
 */
export function swilkPValueFromOneMinusW(w1, n) {
    if (Number.isNaN(w1) || !(n >= 3))
        return NaN;
    if (n === 3) {
        // exact: 6/pi (asin(sqrt(W)) - asin(sqrt(3/4))), W >= 3/4
        const p = PI6 * (Math.asin(Math.sqrt(1 - w1)) - STQR);
        return Math.max(p, 0);
    }
    const y = Math.log(w1);
    if (n <= 11) {
        const gamma = poly(G, n);
        if (y >= gamma)
            return 1e-99; // beyond the range of the approximation; 1e-99 is the value R reports here
        const mu = poly(C3, n);
        const sigma = Math.exp(poly(C4, n));
        return pnorm(-Math.log(gamma - y), { mean: mu, sd: sigma, lowerTail: false });
    }
    const xx = Math.log(n);
    const mu = poly(C5, xx);
    const sigma = Math.exp(poly(C6, xx));
    return pnorm(y, { mean: mu, sd: sigma, lowerTail: false });
}
