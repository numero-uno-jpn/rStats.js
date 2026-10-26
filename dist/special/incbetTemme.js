// Uniform asymptotic expansion of the incomplete beta function I_x(a, b) for large a and b.
//
// Written from the method of N. M. Temme, "Incomplete Laplace integrals: uniform asymptotic expansion with
// application to the incomplete beta function", SIAM J. Math. Anal. 18 (1987) 1638-1663, and Temme, "Special
// Functions: An Introduction to the Classical Functions of Mathematical Physics" (Wiley, 1996), section 11.3.3.
// The coefficients are not taken from a table: their Taylor series are generated at run time from the
// differential equation of the change of variable (below). The derivation is summarised here.
//
// With r = a + b, p = a/r, q = b/r and m = a b / r = r p q,
//   I_x(a, b) = sqrt(r/(2 pi)) e^-D ∫_{-∞}^{η} e^{-r ζ²/2} g(ζ) dζ,   D = stirlerr(a) + stirlerr(b) - stirlerr(r),
// where ½ ζ² = p log(p/t) + q log(q/(1-t)) (sign of t - p), g = sqrt(pq) ζ / (t - p), and r η²/2 = E is the
// deviance bd0(a, r x) + bd0(b, r (1 - x)) of Loader's binomial density. Integrating by parts repeatedly
// (g_0 = g, h_k = (g_k - g_k(0))/ζ, g_{k+1} = h_k') gives
//   I_x(a, b) = ½ erfc(-η sqrt(r/2)) - e^{-E} e^{-D} / sqrt(2 pi r) Σ_k h_k(η) r^-k.
// In the scaled variable τ = η / sqrt(pq) (= ± sqrt(2E/m)) the k-th term is of order m^-k, uniformly in p, and
// the Taylor coefficients of g in τ follow from w = (t - p)/(pq), which satisfies
//   τ dτ/dw = w / ((1 + q w)(1 - p w)),  i.e.  ½ (w²)' = τ (1 + (q - p) w - pq w²),
// with g = τ / w. They are bounded (the series in τ converges for |τ| up to about 3.5), so for |τ| <= 1 thirty
// terms suffice.
//
// In the tails the two terms above nearly cancel (the result is smaller than ½ erfc by a factor of about 2E),
// so for E >= 2.25 the smaller tail is computed from the equivalent form
//   e^{-E} [F(y) + e^{-D} Σ_k g_k(τ) m^-k / (|τ| sqrt(2 pi m))],  y = sqrt(E),  F(y) = ½ erfcx(y) - 1/(2 sqrt(pi) y),
// which uses e^{-D} Σ_k g_k(0) r^-k = 1 (both sides of the identity have the same asymptotic expansion), with
// g_0 = m τ / (r x - a) in closed form and F(y) = -e^z Γ(-½, z) / (4 sqrt(pi)), z = y², from Legendre's
// continued fraction. Its two terms have opposite signs but differ by a factor of about 1 + 1/y².
//
// Both forms were checked against mpmath (scripts/mpmath/largebeta.py): within 1e-15 for m >= 20 and |τ| <= 1.
// The cost is about 2 µs whatever the size of a and b.
import { erfc } from "./erf.js";
import { bd0dd, stirlerr } from "./loader.js";
import { ddAdd, ddMul, ddSub, twoSum } from "./dd.js";
/**
 * Smallest m = ab/(a+b) for which the expansion is used. Measured against mpmath with |τ| <= 1: within 9e-16 from
 * m = 20 on (as accurate as the continued fraction), 7e-15 for m in 15-20 and 5e-14 for m in 10-15 (the series
 * in 1/m no longer converges far enough). It is faster than the continued fraction from m = 10 on (2 µs against 8)
 */
export const TEMME_MIN_M = 25;
/** Largest |τ| = sqrt(2E/m) (the Taylor series in τ, with at most NMAX terms, is accurate to 1e-16 up to here) */
const TAU_MAX = 1;
/** Number of Taylor coefficients of g (the series converges like (|τ|/3.5)^n) */
const NMAX = 30;
/** Largest number of terms of the expansion in 1/m */
const KMAX = 12;
/** Below this y = sqrt(E) the first form is used, above it the tail form */
const Y_SWITCH = 1.5;
const SQRT_PI = 1.7724538509055160273;
const TWO_PI = 6.283185307179586477;
// Work arrays: Taylor coefficients of w = Σ wc[n] τ^n, of w², and of g and its successors
const wc = new Float64Array(NMAX + 2);
const w2 = new Float64Array(NMAX + 3);
const gc = new Float64Array(NMAX);
/** Horner evaluation of Σ_{n<len} c[n] τ^n */
function poly(c, len, tau) {
    let s = 0;
    for (let n = len - 1; n >= 0; n--)
        s = s * tau + c[n];
    return s;
}
/**
 * Fill gc[0..n) with the Taylor coefficients of g(τ) = τ / w(τ) for the given p, q (p + q = 1).
 * w = Σ_{n>=1} wc[n] τ^n with wc[1] = 1 from ½ (w²)' = τ (1 + δ w - pq w²), δ = q - p:
 * the coefficient of τ^(j-1) gives (w²)_j = (2/j) (δ wc[j-2] - pq (w²)_{j-2}) for j >= 3, and
 * (w²)_j = 2 wc[j-1] + Σ_{i=2}^{j-2} wc[i] wc[j-i] then gives wc[j-1]
 */
function gCoefficients(p, q, n) {
    const delta = q - p;
    const pq = p * q;
    wc[1] = 1;
    w2[1] = 0;
    w2[2] = 1;
    for (let j = 3; j <= n + 1; j++) {
        const v = (2 / j) * (delta * wc[j - 2] - pq * w2[j - 2]);
        let s = 0;
        for (let i = 2; i <= j - 2; i++)
            s += wc[i] * wc[j - i];
        wc[j - 1] = (v - s) / 2;
        w2[j] = v;
    }
    // g = 1 / (w/τ), where w/τ = Σ_n wc[n + 1] τ^n
    gc[0] = 1;
    for (let k = 1; k < n; k++) {
        let s = 0;
        for (let i = 1; i <= k; i++)
            s += wc[i + 1] * gc[k - i];
        gc[k] = -s;
    }
}
/**
 * Sum the expansion in 1/m. With tail false: Σ_{k>=0} ĥ_k(τ) m^-k (the scaled h_k); with tail true:
 * Σ_{k>=1} ĝ_k(τ) m^-k (the scaled g_k without g_0). In τ, ĥ_k = (ĝ_k - ĝ_k(0))/τ and ĝ_{k+1} = dĥ_k/dτ, so each
 * step drops the constant coefficient, shifts, and differentiates (in place in gc)
 */
function expansionSum(tau, m, n, tail) {
    let len = n;
    let mk = 1;
    let sum = 0;
    for (let k = 0; k < KMAX && len > 1; k++) {
        let term;
        if (tail) {
            term = k === 0 ? 0 : mk * poly(gc, len, tau);
        }
        else {
            // ĥ_k: coefficients gc[1..len)
            let s = 0;
            for (let i = len - 1; i >= 1; i--)
                s = s * tau + gc[i];
            term = mk * s;
        }
        sum += term;
        if (k > 1 && Math.abs(term) <= 1e-17 * Math.abs(sum))
            break;
        // ĝ_{k+1}[i] = (i + 1) ĥ_k[i + 1] = (i + 1) gc[i + 2]
        for (let i = 0; i + 2 < len; i++)
            gc[i] = (i + 1) * gc[i + 2];
        len -= 2;
        mk /= m;
    }
    return sum;
}
// Gauss-Legendre nodes and weights (8 points, symmetric pairs) and erfc(1), computed with mpmath
const GL_X = [0.9602898564975363, 0.7966664774136267, 0.525532409916329, 0.1834346424956498];
const GL_W = [0.10122853629037626, 0.22238103445337448, 0.31370664587788727, 0.362683783378362];
const ERFC1 = 0.15729920705028513;
/**
 * ½ erfc(y) to a few ulp. erfc in erf.ts forms 1 - erf(y) below 1, which loses a factor of up to 6 near y = 1, so
 * for 0.5 <= y < 1 use erfc(y) = erfc(1) + (2/sqrt(pi)) ∫_y^1 e^(-t²) dt (both terms positive), with the integral
 * by 8-point Gauss-Legendre quadrature (3e-16 relative on this interval)
 */
export function halfErfc(y) {
    if (y < 0.5 || y >= 1)
        return 0.5 * erfc(y);
    const c = (1 + y) / 2;
    const h = (1 - y) / 2;
    let s = 0;
    for (let i = 0; i < 4; i++) {
        const t1 = c + h * GL_X[i];
        const t2 = c - h * GL_X[i];
        s += GL_W[i] * (Math.exp(-t1 * t1) + Math.exp(-t2 * t2));
    }
    return 0.5 * ERFC1 + (h * s) / SQRT_PI;
}
/**
 * F(y) = ½ erfcx(y) - 1/(2 sqrt(pi) y) for y >= 1.5, without cancellation:
 * F = -e^z Γ(-½, z) / (4 sqrt(pi)) with e^z Γ(-½, z) = z^-½ / (z + 3/2 - 1·(3/2)/(z + 7/2 - 2·(5/2)/(z + 11/2 - ...))),
 * evaluated backwards with a fixed number of terms (enough for 1e-16 from y = 1.5 on)
 */
function erfcxMinusLeading(y) {
    const z = y * y;
    const n = Math.ceil(4 + 120 / z);
    let t = 0;
    for (let k = n; k >= 1; k--)
        t = (-k * (k + 0.5)) / (z + 2 * k + 1.5 + t);
    return -1 / (4 * SQRT_PI * y * (z + 1.5 + t));
}
/**
 * I_x(a, b) (lower) or 1 - I_x(a, b) by the uniform asymptotic expansion, as [log, linear] (log NaN unless
 * wantLog). x and 1 - x are given in double-double. Returns undefined outside the region where the expansion is
 * used (m >= TEMME_MIN_M and |τ| <= TAU_MAX); the caller then uses the series or continued fractions
 */
export function betaIncTemme(a, b, xd, xcd, lower, wantLog) {
    const rr = twoSum(a, b);
    const r = rr[0];
    const m = (a * b) / r;
    if (!(m >= TEMME_MIN_M) || !Number.isFinite(r))
        return undefined;
    const p = a / r;
    const q = b / r;
    const pq = m / r;
    // Cheap filter: |τ| <= 1 needs |w| = |x - p| / pq below about 1.6
    const x = xd[0];
    if (Math.abs(x - p) > 2 * pq)
        return undefined;
    // r x - a exactly enough (sign of x - p, and g_0 in the tail form)
    const rx = ddMul(rr, xd);
    const dx = ddSub(rx, [a, 0]);
    const d = dx[0] + dx[1];
    // E = bd0(a, r x) + bd0(b, r (1 - x)) in double-double
    const e = ddAdd(bd0dd(a, rx), bd0dd(b, ddMul(rr, xcd)));
    const E = e[0] + e[1];
    const tau2 = (2 * E) / m;
    if (!(tau2 <= TAU_MAX * TAU_MAX))
        return undefined;
    const absTau = Math.sqrt(tau2);
    const tau = d < 0 ? -absTau : absTau;
    const n = absTau <= 0.5 ? 20 : absTau <= 0.75 ? 24 : NMAX;
    gCoefficients(p, q, n);
    const eD = Math.exp(-(stirlerr(a) + stirlerr(b) - stirlerr(r)));
    const y = Math.sqrt(E);
    // The smaller tail is the lower one when x < p
    const smallIsLower = d < 0;
    if (y < Y_SWITCH) {
        // ½ erfc(∓y) ∓ R with R = e^-E e^-D Σ ĥ_k m^-k / sqrt(2 pi m)
        const R = (Math.exp(-e[0]) * (1 - e[1]) * eD * expansionSum(tau, m, n, false)) / Math.sqrt(TWO_PI * m);
        const sy = d < 0 ? y : -y; // -η sqrt(r/2)
        const lowerV = (sy >= 0 ? halfErfc(sy) : 1 - halfErfc(-sy)) - R;
        const upperV = (sy <= 0 ? halfErfc(-sy) : 1 - halfErfc(sy)) + R;
        const v = lower ? lowerV : upperV;
        if (!wantLog)
            return [NaN, v];
        const small = smallIsLower ? lowerV : upperV;
        return [lower === smallIsLower ? Math.log(v) : Math.log1p(-small), v];
    }
    // Tail form: smaller tail = e^-E B
    // The k = 0 term g_0 / (|τ| sqrt(2 pi m)) with g_0 = m τ / (r x - a) is sqrt(m / (2 pi)) / |r x - a| (τ cancels)
    const B = erfcxMinusLeading(y) +
        eD * (Math.sqrt(m / TWO_PI) / Math.abs(d) + expansionSum(tau, m, n, true) / (absTau * Math.sqrt(TWO_PI * m)));
    let small;
    if (e[0] < 700)
        small = Math.exp(-e[0]) * (1 - e[1]) * B;
    else
        small = Math.exp(700 - e[0]) * (1 - e[1]) * B * Math.exp(-700);
    if (lower === smallIsLower)
        return [wantLog ? -e[0] - e[1] + Math.log(B) : NaN, small];
    return [wantLog ? Math.log1p(-small) : NaN, 1 - small];
}
