// Bessel functions J and Y of real order: besselJ, besselY.
//
// Ported from Boost.Math include/boost/math/special_functions/detail/bessel_jy.hpp, detail/bessel_jy_series.hpp and
// detail/bessel_jy_asym.hpp (Boost.Math commit 0a0fb4e).
// Copyright (c) 2006 Xiaogang Zhang, (c) 2007 John Maddock. Boost Software License 1.0. See THIRD_PARTY_NOTICES.md.
//
// Changes from Boost
// - Integer orders go through the same algorithm (Boost dispatches them to bessel_jn / bessel_yn).
// - The series prefix (x/2)^v / Gamma(v + 1) uses Loader's Poisson term for large v, as in besselIK.ts.
// - Negative orders follow R's documentation (A&S 9.1.2):
//     J_-v = cos(pi v) J_v - sin(pi v) Y_v,   Y_-v = sin(pi v) J_v + cos(pi v) Y_v.
import { gamma, lgamma, lgamma1p, lgammaSign, sinpi } from "./gamma.js";
import { seriesTimesPrefix } from "./besselSeries.js";
import { ddDiv, ddMul, ddSub, twoSum } from "./dd.js";
const EPS = Number.EPSILON;
/** Multiply by 2^e without overflow in the intermediate power */
function ldexp(m, e) {
    if (!Number.isFinite(e))
        return e > 0 ? m * Infinity : m * 0;
    while (e > 1000) {
        m *= 2 ** 1000;
        e -= 1000;
    }
    while (e < -1000) {
        m *= 2 ** -1000;
        e += 1000;
    }
    return m * 2 ** e;
}
/** Forward recurrence Y_(u+k+1) = 2 (u + k) / x Y_(u+k) - Y_(u+k-1) for k = 1..n, rescaling by powers of 2 (exact) */
function yForward(u, x, n, y0, y1) {
    let prev = y0;
    let current = y1;
    let e2 = 0;
    for (let k = 1; k <= n; k++) {
        const fact = (2 * (u + k)) / x;
        // the factor itself can be huge (2e300 at x = 1e-300), so look at the size of the product
        const lg = Math.log2(Math.abs(current)) + Math.log2(fact);
        if (lg > 900 && Number.isFinite(lg)) {
            const s = Math.ceil(lg - 800);
            prev = ldexp(prev, -s);
            current = ldexp(current, -s);
            e2 += s;
        }
        const next = fact * current - prev;
        prev = current;
        current = next;
    }
    return { y: prev, y1: current, e2 };
}
const MAX_ITER = 1_000_000;
const TINY = Math.sqrt(2.2250738585072014e-308);
const DBL_MAX = Number.MAX_VALUE;
function tgamma1pm1(v) {
    return Math.expm1(lgamma1p(v));
}
/** cos(pi x), exact at half-integers */
function cospi(x) {
    return sinpi(0.5 - Math.abs(x % 2));
}
/** J_v(x) by its power series (x small compared to v) */
function jSmallZ(v, x) {
    const mult = -(x / 2) * (x / 2);
    let term = 1;
    let sum = 0;
    for (let n = 1; n < MAX_ITER; n++) {
        sum += term;
        term *= mult / (n * (n + v));
        if (Math.abs(term) <= EPS * Math.abs(sum))
            break;
    }
    return seriesTimesPrefix(v, x, sum + term);
}
/**
 * Y_v(x) by its power series for x small compared to v (non-integer v), as m 2^e2 (the prefix can overflow while
 * the reflection formula still multiplies it by a small factor)
 */
function ySmallZ(v, x) {
    let p = Math.log(x / 2);
    let e2 = 0;
    const needLogs = v >= 170 || 709.78 / v < Math.abs(p);
    let prefix;
    if (!needLogs) {
        let gam = gamma(v);
        p = Math.pow(x / 2, v);
        if (DBL_MAX * p < gam) {
            gam *= 2 ** -1000;
            e2 = 1000;
        }
        prefix = -gam / (Math.PI * p);
    }
    else {
        const gam = lgamma(v);
        p = v * p;
        prefix = gam - Math.log(Math.PI) - p;
        if (709.78 < prefix) {
            const k = Math.ceil((prefix - 700) / Math.LN2);
            prefix -= k * Math.LN2;
            e2 = k;
        }
        prefix = -Math.exp(prefix);
    }
    const mult = -(x / 2) * (x / 2);
    let term = 1;
    let sum = 0;
    for (let n = 1; n < MAX_ITER; n++) {
        sum += term;
        term *= mult / (n * (n - v));
        if (Math.abs(term) <= EPS * Math.abs(sum))
            break;
    }
    let result = (sum + term) * prefix;
    let prefix2;
    if (!needLogs) {
        prefix2 = (gamma(-v) * cospi(v) * p) / Math.PI;
    }
    else {
        const lg = lgammaSign(-v);
        prefix2 = (Math.exp(lg.value + p) * lg.sign) / Math.PI;
    }
    term = 1;
    let b = 0;
    for (let n = 1; n < MAX_ITER; n++) {
        b += term;
        term *= mult / (n * (n + v));
        if (Math.abs(term) <= EPS * Math.abs(b))
            break;
    }
    b += term;
    result -= ldexp(prefix2 * b, -e2);
    return { m: result, e2 };
}
/** Hankel's asymptotic series P and Q (A&S 9.2.9, 9.2.10); false if it does not converge */
function hankelPQ(v, x) {
    let p = 1;
    let q = 0;
    let k = 1;
    const z8 = 8 * x;
    let sq = 1;
    const mu = 4 * v * v;
    let term = 1;
    let ok = true;
    do {
        term *= (mu - sq * sq) / (k * z8);
        q += term;
        k += 1;
        sq += 2;
        const mult = (sq * sq - mu) / (k * z8);
        ok = Math.abs(mult) < 0.5;
        term *= mult;
        p += term;
        k += 1;
        sq += 2;
    } while (Math.abs(term) > 2 * EPS * p && ok);
    return ok ? { p, q } : undefined;
}
/** Y_u(x) and Y_(u+1)(x) by Temme's series (|u| <= 1/2, x <= 2) */
function temmeJY(u, x) {
    const gp = tgamma1pm1(u);
    const gm = tgamma1pm1(-u);
    const spv = sinpi(u);
    const spv2 = sinpi(u / 2);
    const xp = Math.pow(x / 2, u);
    const a = Math.log(x / 2);
    const sigma = -a * u;
    const d = Math.abs(sigma) < EPS ? 1 : Math.sinh(sigma) / sigma;
    const e = Math.abs(u) < EPS ? (u * Math.PI * Math.PI) / 2 : (2 * spv2 * spv2) / u;
    const g1 = u === 0 ? -0.5772156649015329 : (gp - gm) / ((1 + gp) * (1 + gm) * 2 * u);
    const g2 = (2 + gp + gm) / ((1 + gp) * (1 + gm) * 2);
    const vspv = Math.abs(u) < EPS ? 1 / Math.PI : u / spv;
    let f = (g1 * Math.cosh(sigma) - g2 * a * d) * 2 * vspv;
    let p = vspv / (xp * (1 + gm));
    let q = (vspv * xp) / (1 + gp);
    let g = f + e * q;
    let h = p;
    let coef = 1;
    let sum = coef * g;
    let sum1 = coef * h;
    const v2 = u * u;
    const coefMult = (-x * x) / 4;
    for (let k = 1; k < MAX_ITER; k++) {
        f = (k * f + p + q) / (k * k - v2);
        p /= k - u;
        q /= k + u;
        g = f + e * q;
        h = p - k * g;
        coef *= coefMult / k;
        sum += coef * g;
        sum1 += coef * h;
        if (Math.abs(coef * g) < Math.abs(sum) * EPS)
            break;
    }
    return [-sum, (-2 * sum1) / x];
}
/**
 * cf1JY in double-double, with b_k = 2 (v + k) / x formed from the exact v + k. For x ≫ v the continued fraction
 * needs about x terms in the region where it oscillates, and the rounding of v + k (which repeats with k) and of the
 * Lentz steps add up to 3e-13 relative at v = 575, x = 2211 even in double precision with exact b_k
 */
function cf1JYDD(v, x) {
    let C = [TINY, 0];
    let f = [TINY, 0];
    let D = [0, 0];
    let s = 1;
    const xd = [x, 0];
    for (let k = 1; k < MAX_ITER * 100; k++) {
        const vk = twoSum(v, k);
        const b = ddDiv([2 * vk[0], 2 * vk[1]], xd);
        C = ddSub(b, ddDiv([1, 0], C));
        D = ddSub(b, D);
        if (C[0] === 0)
            C = [TINY, 0];
        if (D[0] === 0)
            D = [TINY, 0];
        D = ddDiv([1, 0], D);
        const delta = ddMul(C, D);
        f = ddMul(f, delta);
        if (D[0] < 0)
            s = -s;
        if (Math.abs(delta[0] - 1 + delta[1]) < EPS * EPS)
            break;
    }
    return { fv: -(f[0] + f[1]), sign: s };
}
/** fv = J_(v+1) / J_v by continued fraction (A&S 9.1.73, modified Lentz), and the sign of the denominator */
function cf1JY(v, x) {
    if (x > 30)
        return cf1JYDD(v, x);
    let C = TINY;
    let f = TINY;
    let D = 0;
    let s = 1;
    for (let k = 1; k < MAX_ITER * 100; k++) {
        const b = (2 * (v + k)) / x;
        C = b - 1 / C;
        D = b - D;
        if (C === 0)
            C = TINY;
        if (D === 0)
            D = TINY;
        D = 1 / D;
        const delta = C * D;
        f *= delta;
        if (D < 0)
            s = -s;
        if (Math.abs(delta - 1) < 2 * EPS)
            break;
    }
    return { fv: -f, sign: s };
}
/** p + iq = (J' + iY') / (J + iY) by Steed's complex continued fraction, in real arithmetic (x > 1) */
function cf2JY(v, x) {
    let fr = -0.5 / x;
    let fi = 1;
    let Cr = fr;
    let Ci = fi;
    const v2 = v * v;
    let a = (0.25 - v2) / x;
    const br = 2 * x;
    let bi = 2;
    let temp = Cr * Cr + 1;
    Ci = bi + (a * Cr) / temp;
    Cr = br + a / temp;
    let Dr = br;
    let Di = bi;
    if (Math.abs(Cr) + Math.abs(Ci) < TINY)
        Cr = TINY;
    if (Math.abs(Dr) + Math.abs(Di) < TINY)
        Dr = TINY;
    temp = Dr * Dr + Di * Di;
    Dr = Dr / temp;
    Di = -Di / temp;
    let dr = Cr * Dr - Ci * Di;
    let di = Ci * Dr + Cr * Di;
    temp = fr;
    fr = temp * dr - fi * di;
    fi = temp * di + fi * dr;
    for (let k = 2; k < MAX_ITER; k++) {
        a = k - 0.5;
        a *= a;
        a -= v2;
        bi += 2;
        temp = Cr * Cr + Ci * Ci;
        Cr = br + (a * Cr) / temp;
        Ci = bi - (a * Ci) / temp;
        Dr = br + a * Dr;
        Di = bi + a * Di;
        if (Math.abs(Cr) + Math.abs(Ci) < TINY)
            Cr = TINY;
        if (Math.abs(Dr) + Math.abs(Di) < TINY)
            Dr = TINY;
        temp = Dr * Dr + Di * Di;
        Dr = Dr / temp;
        Di = -Di / temp;
        dr = Cr * Dr - Ci * Di;
        di = Ci * Dr + Cr * Di;
        temp = fr;
        fr = temp * dr - fi * di;
        fi = temp * di + fi * dr;
        if (Math.abs(dr - 1) + Math.abs(di) < 2 * EPS)
            break;
    }
    return { p: fr, q: fi };
}
/** Amplitude of J and Y for large x (A&S 9.2.28) */
function asymAmplitude(v, x) {
    let s = 1;
    const mu = 4 * v * v;
    let txq = 2 * x;
    txq *= txq;
    s += (mu - 1) / (2 * txq);
    s += (3 * (mu - 1) * (mu - 9)) / (txq * txq * 8);
    s += (15 * (mu - 1) * (mu - 9) * (mu - 25)) / (txq * txq * txq * 8 * 6);
    return Math.sqrt((s * 2) / (Math.PI * x));
}
/** Phase of J and Y for large x less (x - pi (v/2 + 1/4)) (A&S 9.2.29) */
function asymPhaseMx(v, x) {
    const mu = 4 * v * v;
    let denom = 4 * x;
    const denomMult = denom * denom;
    let s = 0;
    s += (mu - 1) / (2 * denom);
    denom *= denomMult;
    s += ((mu - 1) * (mu - 25)) / (6 * denom);
    denom *= denomMult;
    s += ((mu - 1) * (mu * mu - 114 * mu + 1073)) / (5 * denom);
    denom *= denomMult;
    s += ((mu - 1) * (5 * mu * mu * mu - 1535 * mu * mu + 54703 * mu - 375733)) / (14 * denom);
    return s;
}
/** J_v and Y_v for large x (A&S 9.2.19), with the phase factored by addition formulas */
function asymJY(v, x) {
    const ampl = asymAmplitude(v, x);
    const phase = asymPhaseMx(v, x);
    const cx = Math.cos(x);
    const sx = Math.sin(x);
    const ci = cospi(v / 2 + 0.25);
    const si = sinpi(v / 2 + 0.25);
    const sp = Math.sin(phase);
    const cp = Math.cos(phase);
    const y = (sp * (cx * ci + sx * si) + cp * (sx * ci - cx * si)) * ampl;
    const j = (cp * (cx * ci + sx * si) - sp * (sx * ci - cx * si)) * ampl;
    return { j, y };
}
/**
 * J_v(x) and Y_v(x) for v >= 0, x > 0 (Boost's bessel_jy without the reflection). Y is returned as y / yScale.
 * needY: whether Y is wanted (J alone allows a cheaper series)
 */
function besselJYPos(v, x, needY) {
    const n = Math.round(v);
    const u = v - n; // -1/2 < u <= 1/2
    const W = 2 / (x * Math.PI); // Wronskian
    if (!needY && (x < 5 || v > (x * x) / 4))
        return { j: jSmallZ(v, x), y: { m: NaN, e2: 0 } };
    if (x < 1 && u !== 0 && Math.log(EPS / 2) > v * Math.log(((x / 2) * (x / 2)) / v)) {
        return { j: jSmallZ(v, x), y: ySmallZ(v, x) };
    }
    if (Math.max(v, 1) < x * 0.011048543456039806) {
        // sqrt(forth root of epsilon)
        const a = asymJY(v, x);
        return { j: a.j, y: { m: a.y, e2: 0 } };
    }
    if (x > 8) {
        const pq = hankelPQ(v, x);
        if (pq !== undefined) {
            const modV = (v / 2 + 0.25) % 2;
            const sx = Math.sin(x);
            const cx = Math.cos(x);
            const sv = sinpi(modV);
            const cv = cospi(modV);
            const sc = sx * cv - sv * cx; // sin(chi)
            const cc = cx * cv + sx * sv; // cos(chi)
            const chi = Math.SQRT2 / (Math.sqrt(Math.PI) * Math.sqrt(x));
            return { j: chi * (pq.p * cc - pq.q * sc), y: { m: chi * (pq.p * sc + pq.q * cc), e2: 0 } };
        }
    }
    if (x <= 2) {
        const [yu, yu1] = temmeJY(u, x);
        const r = yForward(u, x, n, yu, yu1);
        const { fv } = cf1JY(v, x);
        // Wronskian: J_v = W / (Y_v fv - Y_(v+1))
        const j = ldexp(W / (r.y * fv - r.y1), -r.e2);
        return { j, y: { m: r.y, e2: r.e2 } };
    }
    // x > 2: backward recurrence for J from CF1, then CF2 for the normalisation and Y_u
    const { fv, sign: s } = cf1JY(v, x);
    if (x >= v && v > 2) {
        // Beyond the turning point CF2 converges at order v itself, so Steed's method is applied there directly. Boost
        // goes down to u = v - round(v) and back up by recurrence, whose error grows with the number of steps
        // (1.2e-13 relative to the amplitude for Y at v = 575, x = 2211)
        const { p, q } = cf2JY(v, x);
        const t = v / x - fv; // J_v' / J_v
        let g = (p - t) / q;
        if (g === 0)
            g = (v * EPS) / x;
        const jv = s * Math.sqrt(W / (q + g * (p - t)));
        return { j: jv, y: { m: g * jv, e2: 0 } };
    }
    // Boost stops this recurrence when it would overflow (large v) and then guesses J_u' / J_u and the sign of J_u,
    // which gives Y the wrong sign (Y(5, 500) came out +Infinity); here it is rescaled by powers of 2 instead
    const init = TINY;
    let prev = fv * s * init;
    let current = s * init;
    let e2 = 0;
    for (let k = n; k > 0; k--) {
        const t = (2 * (u + k)) / x;
        if (Math.abs(current) > 2 ** 900) {
            prev *= 2 ** -900;
            current *= 2 ** -900;
            e2 += 900;
        }
        let next = t * current - prev;
        if (next === 0)
            next = (prev * EPS) / 2;
        prev = current;
        current = next;
    }
    const ratio = ldexp((s * init) / current, -e2); // J_v / J_u
    const fu = prev / current;
    const { p, q } = cf2JY(u, x);
    const t = u / x - fu; // J'/J
    let g = (p - t) / q;
    if (g === 0)
        g = (u * EPS) / x;
    const ju = Math.sign(current) * Math.sqrt(W / (q + g * (p - t)));
    const jv = ju * ratio;
    const yu = g * ju;
    const yu1 = yu * (u / x - p - q / g);
    if (!needY)
        return { j: jv, y: { m: NaN, e2: 0 } };
    const r = yForward(u, x, n, yu, yu1);
    return { j: jv, y: { m: r.y, e2: r.e2 } };
}
/**
 * Bessel function of the first kind. Equivalent to R's `besselJ(x, nu)` for single numbers.
 *
 * @param x - Argument, `x >= 0` (`NaN` for negative `x`).
 * @param nu - Order, any real number. For `nu < 0`, `J(x, -nu) = cos(pi nu) J(x, nu) - sin(pi nu) Y(x, nu)`
 *   (A&S 9.1.2, as in R).
 * @returns J_nu(x).
 *
 * For `x` much larger than `nu` but below the range of the asymptotic expansion (`x < nu / 0.011`), the time grows
 * with `x` (a continued fraction of about `x` terms): about 15 ms at `x = 5e4`, `nu = 1000`.
 *
 * @example
 * ```ts
 * besselJ(1, 0);     // 0.7651976865579666
 * besselJ(10, 2.5);  // 0.1966584835818184
 * ```
 */
export function besselJ(x, nu) {
    if (Number.isNaN(x) || Number.isNaN(nu) || x < 0 || !Number.isFinite(nu))
        return NaN;
    const v = Math.abs(nu);
    const reflect = nu < 0 && nu !== Math.floor(nu);
    if (x === 0) {
        if (nu === 0)
            return 1;
        if (!reflect)
            return 0;
        // J_-v(0) = -sin(pi v) Y_v(0) with Y_v(0) = -Infinity
        return sinpi(v) > 0 ? Infinity : -Infinity;
    }
    if (x === Infinity)
        return 0;
    if (!reflect) {
        const j = besselJYPos(v, x, false).j;
        return nu < 0 && v % 2 === 1 ? -j : j; // J_-n = (-1)^n J_n
    }
    const r = besselJYPos(v, x, true);
    return cospi(v) * r.j - ldexp(sinpi(v) * r.y.m, r.y.e2);
}
/**
 * Bessel function of the second kind. Equivalent to R's `besselY(x, nu)` for single numbers.
 *
 * @param x - Argument, `x >= 0` (`NaN` for negative `x`; `-Infinity` at 0).
 * @param nu - Order, any real number. For `nu < 0`, `Y(x, -nu) = sin(pi nu) J(x, nu) + cos(pi nu) Y(x, nu)`
 *   (A&S 9.1.2, as in R).
 * @returns Y_nu(x).
 *
 * @example
 * ```ts
 * besselY(1, 0);  // 0.08825696421567694
 * ```
 */
export function besselY(x, nu) {
    if (Number.isNaN(x) || Number.isNaN(nu) || x < 0 || !Number.isFinite(nu))
        return NaN;
    const v = Math.abs(nu);
    const reflect = nu < 0;
    if (x === 0) {
        if (!reflect)
            return -Infinity;
        // Y_-v(0) = sin(pi v) J_v(0) + cos(pi v) Y_v(0)
        const cp = cospi(v);
        if (cp === 0)
            return 0;
        return cp > 0 ? -Infinity : Infinity;
    }
    if (x === Infinity)
        return 0;
    const r = besselJYPos(v, x, true);
    if (!reflect)
        return ldexp(r.y.m, r.y.e2);
    const cp = cospi(v);
    const sp = sinpi(v);
    return (sp !== 0 ? sp * r.j : 0) + (cp === 0 ? 0 : ldexp(cp * r.y.m, r.y.e2));
}
