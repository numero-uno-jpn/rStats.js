// lgamma(b + a) - lgamma(b), keeping relative accuracy even when a is small compared with b.
//
// Direct subtraction loses as many digits as the magnitude of lgamma (1e-5 relative at a = 1e-10, b = 100).
// Subtraction is avoided in two ways (both derived from properties of the gamma function).
// 1. From the recurrence Gamma(b + 1) = b Gamma(b), use
//      D(a, b) = D(a, b + 1) - log1p(a / b)
//    to push b above 15
// 2. For B > 15, from lgamma(z) = (z - 1/2) log z - z + log sqrt(2 pi) + stirlerr(z), write
//      D(a, B) = (B - 1/2) log1p(a/B) + a log(B + a) - a + [stirlerr(B + a) - stirlerr(B)]
//    and compute the stirlerr difference with expm1 from the differences of the Stirling series terms,
//    B^-k ((1 + a/B)^-k - 1)
import { ddAdd, ddLog, ddMulNum, twoSum } from "./dd.js";
const S = [1 / 12, -1 / 360, 1 / 1260, -1 / 1680, 1 / 1188, -691 / 360360, 1 / 156];
/** lgamma(b + a) - lgamma(b). a >= 0, b > 0 */
export function lgammaDiff(a, b) {
    const d = lgammaDiffDD(a, b);
    return d[0] + d[1];
}
/**
 * lgammaDiff in double-double: the term a log(B + a), which reaches hundreds for large b (exp of it would turn its
 * rounding into a relative error of 1e-14 at B(0.5, 1e300)), is formed in double-double; the others are of the size
 * of a or less and stay in double precision
 */
export function lgammaDiffDD(a, b) {
    if (a === 0)
        return [0, 0];
    let acc = 0;
    let B = b;
    while (B <= 15) {
        acc -= Math.log1p(a / B);
        B += 1;
    }
    const l1p = Math.log1p(a / B);
    const lead0 = a * Math.log(B + a);
    // (in double precision where it is small: its rounding is then below the others', and incbet calls this often)
    const lead = Math.abs(lead0) > 2 && Number.isFinite(lead0) && a < 1e300 ? ddMulNum(ddLog(twoSum(B, a)), a) : [lead0, 0];
    let d = (B - 0.5) * l1p - a;
    // stirlerr(B + a) - stirlerr(B) = Σ S_k [ (B + a)^-(2k+1) - B^-(2k+1) ]
    let pw = 1 / B;
    const inv2 = 1 / (B * B);
    for (let k = 0; k < S.length; k++) {
        const m = 2 * k + 1;
        d += S[k] * pw * Math.expm1(-m * l1p);
        pw *= inv2;
    }
    return ddAdd(lead, [acc + d, 0]);
}
