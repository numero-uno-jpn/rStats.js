// Quantile search for discrete distributions (integer support).
//
// The quantile is "the smallest integer y with P[X <= y] >= p" (upper tail: "the smallest y with P[X > y] <= p").
// So that floating-point rounding does not miss the boundary integer, the probability gets a relative slack of 64 ε,
// e.g. so that qpois(ppois(3, λ), λ) returns 3.
// The slack is applied to p on the scale the user supplied (lowerTail, logP). Its size is 8 ε on the linear scale
// and 2 ε on the log scale, both chosen by comparison with R's answers (for p ≈ 1, converting to the smaller tail
// before testing gives answers off by 1; the slack must be larger than 1.8 ε and smaller than 49 ε).
const FUZZ_LINEAR = 8 * Number.EPSILON;
const FUZZ_LOG = 2 * Number.EPSILON;
/** Probabilities below this are near subnormal with few significant digits, so compare on the log scale */
const TINY = 1e-290;
export function discreteQuantile(problem) {
    const { p, lowerTail, logP, cdf, lo, hi } = problem;
    let ok;
    if (logP || p < TINY) {
        let t;
        if (logP)
            t = lowerTail ? p * (1 + FUZZ_LOG) : p * (1 - FUZZ_LOG);
        else
            t = Math.log(p) + Math.log1p(lowerTail ? -FUZZ_LINEAR : FUZZ_LINEAR);
        ok = lowerTail ? (y) => cdf(y, true, true) >= t : (y) => cdf(y, false, true) <= t;
    }
    else {
        let t;
        if (lowerTail)
            t = p * (1 - FUZZ_LINEAR);
        else
            t = 1 - p > 4 * FUZZ_LINEAR ? p * (1 + FUZZ_LINEAR) : p;
        if (t > 0.5) {
            // Comparing probabilities close to 1 shifts the decision by a few units through the rounding of 1 - (small value).
            // Compare the small complementary probabilities instead: F >= t ⇔ 1 - F <= 1 - t (1 - t is exact)
            const c = 1 - t;
            ok = lowerTail ? (y) => cdf(y, false, false) <= c : (y) => cdf(y, true, false) >= c;
        }
        else {
            ok = lowerTail ? (y) => cdf(y, true, false) >= t : (y) => cdf(y, false, false) <= t;
        }
    }
    let y = Math.round(problem.y0);
    if (!Number.isFinite(y))
        y = lo;
    y = Math.min(Math.max(y, lo), hi);
    if (ok(y)) {
        // y satisfies the condition. Find a lower point that does not, then bisect
        let step = 1;
        let bad = y - step;
        while (bad >= lo && ok(bad)) {
            y = bad;
            step *= 2;
            bad = y - step;
        }
        if (bad < lo) {
            if (y === lo)
                return lo;
            bad = lo - 1;
        }
        return bisect(bad, y, ok);
    }
    // y does not satisfy it. Find an upper point that does, then bisect
    let step = 1;
    let good = y + step;
    while (good <= hi && !ok(good)) {
        y = good;
        step *= 2;
        good = y + step;
    }
    if (good > hi)
        good = hi;
    return bisect(y, good, ok);
}
/** bad does not satisfy the condition, good does (bad < good). Returns the smallest integer that satisfies it */
function bisect(bad, good, ok) {
    while (good - bad > 1) {
        const mid = Math.floor(bad + (good - bad) / 2);
        // Beyond 2^53 neighbouring integers are not representable and the midpoint equals an end (stop there)
        if (mid === bad || mid === good)
            break;
        if (ok(mid))
            good = mid;
        else
            bad = mid;
    }
    return good;
}
