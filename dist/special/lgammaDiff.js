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
const S = [1 / 12, -1 / 360, 1 / 1260, -1 / 1680, 1 / 1188, -691 / 360360, 1 / 156];
/** lgamma(b + a) - lgamma(b). a >= 0, b > 0 */
export function lgammaDiff(a, b) {
    if (a === 0)
        return 0;
    let acc = 0;
    let B = b;
    while (B <= 15) {
        acc -= Math.log1p(a / B);
        B += 1;
    }
    const l1p = Math.log1p(a / B);
    let d = (B - 0.5) * l1p + a * Math.log(B + a) - a;
    // stirlerr(B + a) - stirlerr(B) = Σ S_k [ (B + a)^-(2k+1) - B^-(2k+1) ]
    let pw = 1 / B;
    const inv2 = 1 / (B * B);
    for (let k = 0; k < S.length; k++) {
        const m = 2 * k + 1;
        d += S[k] * pw * Math.expm1(-m * l1p);
        pw *= inv2;
    }
    return acc + d;
}
