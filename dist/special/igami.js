// Ported from xsf include/xsf/cephes/igami.h (find_inverse_gamma) (xsf commit c6a3afe).
// Cephes Math Library Release 2.8, Copyright 1984, 1995, 2000 by Stephen L. Moshier.
// xsf Copyright (c) 2024, SciPy. BSD-3-Clause. See THIRD_PARTY_NOTICES.md.
//
// Starting value for the inverse of the incomplete gamma function (DiDonato & Morris 1986, ACM TOMS 12(4)).
// xsf follows this with three Halley steps, but this library finishes with Newton's method in
// src/internal/invert.ts, so only the starting value is returned here.
import { EULER } from "./constants.js";
import { gamma, lgamma } from "./gamma.js";
import { polevl } from "./polevl.js";
function findInverseS(p, q) {
    /* DiDonato & Morris Eq 32 */
    const a = [0.213623493715853, 4.28342155967104, 11.6616720288968, 3.31125922108741];
    const b = [0.3611708101884203e-1, 1.27364489782223, 6.40691597760039, 6.61053765625462, 1];
    const t = p < 0.5 ? Math.sqrt(-2 * Math.log(p)) : Math.sqrt(-2 * Math.log(q));
    const s = t - polevl(t, a) / polevl(t, b);
    return p < 0.5 ? -s : s;
}
function didonatoSN(a, x, N, tolerance) {
    /* DiDonato & Morris Eq 34 */
    let sum = 1;
    if (N >= 1) {
        let partial = x / (a + 1);
        sum += partial;
        for (let i = 2; i <= N; ++i) {
            partial *= x / (a + i);
            sum += partial;
            if (partial < tolerance)
                break;
        }
    }
    return sum;
}
/* DiDonato & Morris Eq 25 */
function eq25(a, y) {
    const c1 = (a - 1) * Math.log(y);
    const c1_2 = c1 * c1;
    const c1_3 = c1_2 * c1;
    const c1_4 = c1_2 * c1_2;
    const a_2 = a * a;
    const a_3 = a_2 * a;
    const c2 = (a - 1) * (1 + c1);
    const c3 = (a - 1) * (-(c1_2 / 2) + (a - 2) * c1 + (3 * a - 5) / 2);
    const c4 = (a - 1) * (c1_3 / 3 - ((3 * a - 5) * c1_2) / 2 + (a_2 - 6 * a + 7) * c1 + (11 * a_2 - 46 * a + 47) / 6);
    const c5 = (a - 1) *
        (-(c1_4 / 4) +
            ((11 * a - 17) * c1_3) / 6 +
            (-3 * a_2 + 13 * a - 13) * c1_2 +
            ((2 * a_3 - 25 * a_2 + 72 * a - 61) * c1) / 2 +
            (25 * a_3 - 195 * a_2 + 477 * a - 379) / 12);
    const y_2 = y * y;
    const y_3 = y_2 * y;
    const y_4 = y_2 * y_2;
    return y + c1 + c2 / y + c3 / y_2 + c4 / y_3 + c5 / y_4;
}
/** Approximate x with P(a, x) = p (Q = q = 1 - p) */
export function findInverseGamma(a, p, q) {
    if (a === 1)
        return q > 0.9 ? -Math.log1p(-p) : -Math.log(q);
    if (a < 1) {
        const g = gamma(a);
        const b = q * g;
        if (b > 0.6 || (b >= 0.45 && a >= 0.3)) {
            /* DiDonato & Morris Eq 21 */
            const u = b * q > 1e-8 && q > 1e-5 ? Math.pow(p * g * a, 1 / a) : Math.exp(-q / a - EULER);
            return u / (1 - u / (a + 1));
        }
        if (a < 0.3 && b >= 0.35) {
            /* DiDonato & Morris Eq 22 */
            const t = Math.exp(-EULER - b);
            const u = t * Math.exp(t);
            return t * Math.exp(u);
        }
        if (b > 0.15 || a >= 0.3) {
            /* DiDonato & Morris Eq 23 */
            const y = -Math.log(b);
            const u = y - (1 - a) * Math.log(y);
            return y - (1 - a) * Math.log(u) - Math.log(1 + (1 - a) / (1 + u));
        }
        if (b > 0.1) {
            /* DiDonato & Morris Eq 24 */
            const y = -Math.log(b);
            const u = y - (1 - a) * Math.log(y);
            return (y -
                (1 - a) * Math.log(u) -
                Math.log((u * u + 2 * (3 - a) * u + (2 - a) * (3 - a)) / (u * u + (5 - a) * u + 2)));
        }
        return eq25(a, -Math.log(b));
    }
    /* DiDonato and Morris Eq 31 */
    let s = findInverseS(p, q);
    const s_2 = s * s;
    const s_3 = s_2 * s;
    const s_4 = s_2 * s_2;
    const s_5 = s_4 * s;
    const ra = Math.sqrt(a);
    let w = a + s * ra + (s_2 - 1) / 3;
    w += (s_3 - 7 * s) / (36 * ra);
    w -= (3 * s_4 + 7 * s_2 - 16) / (810 * a);
    w += (9 * s_5 + 256 * s_3 - 433 * s) / (38880 * a * ra);
    if (a >= 500 && Math.abs(1 - w / a) < 1e-6)
        return w;
    if (p > 0.5) {
        if (w < 3 * a)
            return w;
        const D = Math.max(2, a * (a - 1));
        const lb = Math.log(q) + lgamma(a);
        if (lb < -D * 2.3)
            return eq25(a, -lb);
        /* DiDonato and Morris Eq 33 */
        const u = -lb + (a - 1) * Math.log(w) - Math.log(1 + (1 - a) / (1 + w));
        return -lb + (a - 1) * Math.log(u) - Math.log(1 + (1 - a) / (1 + u));
    }
    let z = w;
    const ap1 = a + 1;
    const ap2 = a + 2;
    if (w < 0.15 * ap1) {
        /* DiDonato and Morris Eq 35 */
        const v = Math.log(p) + lgamma(ap1);
        z = Math.exp((v + w) / a);
        s = Math.log1p((z / ap1) * (1 + z / ap2));
        z = Math.exp((v + z - s) / a);
        s = Math.log1p((z / ap1) * (1 + z / ap2));
        z = Math.exp((v + z - s) / a);
        s = Math.log1p((z / ap1) * (1 + (z / ap2) * (1 + z / (a + 3))));
        z = Math.exp((v + z - s) / a);
    }
    if (z <= 0.01 * ap1 || z > 0.7 * ap1)
        return z;
    /* DiDonato and Morris Eq 36 */
    const ls = Math.log(didonatoSN(a, z, 100, 1e-4));
    const v = Math.log(p) + lgamma(ap1);
    z = Math.exp((v + z - ls) / a);
    return z * (1 - (a * Math.log(z) - z - v + ls) / (a - z));
}
