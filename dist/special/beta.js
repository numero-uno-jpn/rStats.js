// Ported from xsf include/xsf/cephes/beta.h (xsf commit c6a3afe).
// Cephes Math Library Release 2.8, Copyright 1984, 1995, 2000 by Stephen L. Moshier.
// xsf Copyright (c) 2024, SciPy. BSD-3-Clause. See THIRD_PARTY_NOTICES.md.
import { MAXGAM } from "./constants.js";
import { gamma, lgamma, lgammaSign } from "./gamma.js";
import { lgammaDiff, lgammaDiffDD } from "./lgammaDiff.js";
import { ddAdd, ddLog, ddMulNum, ddSub, twoSum } from "./dd.js";
import { stirlerr } from "./loader.js";
const ASYMP_FACTOR = 1e6;
/* Asymptotic expansion for ln(|B(a, b)|) for a > ASYMP_FACTOR*max(|b|, 1) */
function lbetaAsymp(a, b) {
    const { value: lg, sign } = lgammaSign(b);
    let r = lg;
    r -= b * Math.log(a);
    r += (b * (1 - b)) / (2 * a);
    r += (b * (1 - b) * (1 - 2 * b)) / (12 * a * a);
    r += (-b * b * (1 - b) * (1 - b)) / (12 * a * a * a);
    return { value: r, sign };
}
/**
 * Beta function B(a, b). Equivalent to R's `beta()`. Takes single numbers.
 *
 * @param a - First argument.
 * @param b - Second argument.
 * @returns B(a, b).
 *
 * @example
 * ```ts
 * beta(2, 3);  // 0.08333333333333333
 * ```
 *
 * @category Special functions
 */
export function beta(a, b) {
    if (Number.isNaN(a) || Number.isNaN(b))
        return NaN;
    // 0 if one is +Inf and the other positive (as in R)
    if ((a === Infinity && b > 0) || (b === Infinity && a > 0))
        return 0;
    // For large parameters use the double-double log (xsf's sum and difference of lgamma is off by 1e-10 relative at a = 1e5)
    if (a > 0 && b > 0 && Math.max(a, b) > 15) {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        // Smaller one below 1: B = Gamma(lo) Gamma(hi)/Gamma(lo + hi) = Gamma(lo) exp(-[lgamma(hi+lo) - lgamma(hi)])
        if (lo < 1) {
            const d = lgammaDiffDD(lo, hi);
            return gamma(lo) * Math.exp(-d[0]) * (1 - d[1]);
        }
        const e = hi >= HUGE ? lbetaHuge(hi, lo) : lbetaDD(a, b);
        return Math.exp(e[0]) * (1 + e[1]);
    }
    let sign = 1;
    if (a <= 0 && a === Math.floor(a))
        return betaNegint(a, b);
    if (b <= 0 && b === Math.floor(b))
        return betaNegint(b, a);
    if (Math.abs(a) < Math.abs(b))
        [a, b] = [b, a];
    if (Math.abs(a) > ASYMP_FACTOR * Math.abs(b) && a > ASYMP_FACTOR) {
        /* Avoid loss of precision in lgam(a + b) - lgam(a) */
        const r = lbetaAsymp(a, b);
        return r.sign * Math.exp(r.value);
    }
    let y = a + b;
    if (Math.abs(y) > MAXGAM || Math.abs(a) > MAXGAM || Math.abs(b) > MAXGAM) {
        const ly = lgammaSign(y);
        sign *= ly.sign;
        const lb = lgammaSign(b);
        sign *= lb.sign;
        const la = lgammaSign(a);
        sign *= la.sign;
        const v = la.value + (lb.value - ly.value);
        return sign * Math.exp(v);
    }
    y = 1 / gamma(y);
    const ga = gamma(a);
    const gb = gamma(b);
    if (!Number.isFinite(y))
        return sign * Infinity;
    if (Math.abs(Math.abs(ga * y) - 1) > Math.abs(Math.abs(gb * y) - 1))
        return gb * y * ga;
    return ga * y * gb;
}
function betaNegint(a, b) {
    if (b === Math.floor(b) && 1 - a - b > 0) {
        const sgn = b % 2 === 0 ? 1 : -1;
        return sgn * beta(1 - a - b, b);
    }
    return Infinity;
}
/**
 * Natural logarithm of the absolute value of the beta function, log|B(a, b)|.
 * Equivalent to R's `lbeta()`. Takes single numbers.
 *
 * For a, b > 0 with the larger argument above 15, it is computed as
 * lgamma(small) - [lgamma(large + small) - lgamma(large)] with the bracketed difference
 * evaluated without cancellation, so accuracy is kept for large arguments.
 *
 * @param a - First argument.
 * @param b - Second argument.
 * @returns log|B(a, b)|.
 *
 * @example
 * ```ts
 * lbeta(1000, 1000);  // -1388.4826016359023
 * ```
 *
 * @category Special functions
 */
export function lbeta(a, b) {
    if (Number.isNaN(a) || Number.isNaN(b))
        return NaN;
    if ((a === Infinity && b > 0) || (b === Infinity && a > 0))
        return -Infinity;
    if (a > 0 && b > 0 && Number.isFinite(a) && Number.isFinite(b) && Math.max(a, b) > 15) {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        // If the smaller one is below 1, lgamma(lo) is small and the difference form is accurate enough
        if (lo < 1)
            return lgamma(lo) - lgammaDiff(lo, hi);
        const e = hi >= HUGE ? lbetaHuge(hi, lo) : lbetaDD(a, b);
        return e[0] + e[1];
    }
    if (a <= 0 && a === Math.floor(a))
        return lbetaNegint(a, b);
    if (b <= 0 && b === Math.floor(b))
        return lbetaNegint(b, a);
    if (Math.abs(a) < Math.abs(b))
        [a, b] = [b, a];
    if (Math.abs(a) > ASYMP_FACTOR * Math.abs(b) && a > ASYMP_FACTOR)
        return lbetaAsymp(a, b).value;
    let y = a + b;
    if (Math.abs(y) > MAXGAM || Math.abs(a) > MAXGAM || Math.abs(b) > MAXGAM) {
        return lgammaSign(a).value + (lgammaSign(b).value - lgammaSign(y).value);
    }
    y = 1 / gamma(y);
    const ga = gamma(a);
    const gb = gamma(b);
    if (!Number.isFinite(y))
        return Infinity;
    const v = Math.abs(Math.abs(ga * y) - 1) > Math.abs(Math.abs(gb * y) - 1) ? gb * y * ga : ga * y * gb;
    return Math.log(Math.abs(v));
}
function lbetaNegint(a, b) {
    if (b === Math.floor(b) && 1 - a - b > 0)
        return lbeta(1 - a - b, b);
    return Infinity;
}
const LS2PI_DD = [0.91893853320467278, -3.8782941580672414e-17];
/** From here on lbetaDD is not used: it rounds a - 1/2 (off by 20 in log B(1e17, 31)) and its terms of size a log a lose all digits */
const HUGE = 2 ** 52;
/**
 * log B(a, b) for a >= 2^52, a >= b >= 1, in double-double. Writing log(a + b) = log a + log1p(b/a) in the Stirling
 * form of lbetaDD gives
 *   log B = b log(b/a) - log(b)/2 - (a + b - 1/2) log1p(b/a) + log sqrt(2 pi) + stirlerr(a) + stirlerr(b) - stirlerr(a + b)
 * whose terms are all of the size of b log(a/b) or smaller, so nothing cancels. The leading b log(b/a) (hundreds) is
 * formed in double-double, as exp would turn its rounding into a relative error of 1e-13 (beta(3.05e19, 11.96)); the
 * rest is at most about b and rounds well below that
 */
function lbetaHuge(a, b) {
    const lead = ddMulNum(ddSub(ddLog([b, 0]), ddLog([a, 0])), b);
    const rest = -0.5 * Math.log(b) - (a + b - 0.5) * Math.log1p(b / a) + (stirlerr(a) + stirlerr(b) - stirlerr(a + b));
    return ddAdd(ddAdd(lead, LS2PI_DD), [rest, 0]);
}
/**
 * log B(a, b) in double-double (a, b > 0).
 * Adding and subtracting three instances of lgamma(z) = (z - 1/2) log z - z + log sqrt(2 pi) + stirlerr(z) gives
 *   log B = (a - 1/2) log a + (b - 1/2) log b - (a + b - 1/2) log(a + b) + log sqrt(2 pi)
 *           + stirlerr(a) + stirlerr(b) - stirlerr(a + b)
 * The log terms are computed in double-double (avoids subtracting large values such as lgamma(170) ≈ 701).
 */
export function lbetaDD(a, b) {
    const ab = twoSum(a, b);
    const la = ddMulNum(ddLog([a, 0]), a - 0.5);
    const lb = ddMulNum(ddLog([b, 0]), b - 0.5);
    const lab = ddMul2(ddLog(ab), ddAdd(ab, [-0.5, 0]));
    let e = ddSub(ddAdd(la, lb), lab);
    e = ddAdd(e, LS2PI_DD);
    return ddAdd(e, twoSum(stirlerr(a) + stirlerr(b), -stirlerr(ab[0])));
}
function ddMul2(x, y) {
    return ddAdd(ddMulNum(x, y[0]), ddMulNum(x, y[1]));
}
