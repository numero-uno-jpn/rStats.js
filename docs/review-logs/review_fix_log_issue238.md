# Issue #238 log: distSummary("invgamma") variance, sd and kurtosis overflow for large parameters

GitHub Issue #238. Session 11, group A3 (distSummary, simple overflows).

## Plan

- Intent: the inverse-gamma summary forms the variance b^2 / ((a - 1)^2 (a - 2)), the direct sd b / ((a - 1) sqrt(a - 2)) and the kurtosis (30 a - 66) / ((a - 3)(a - 4)) from products that leave the double range for large alpha or beta, although the moments themselves are representable. alpha = beta = 1e308 gave variance NaN (Inf / Inf), sd 0 and kurtosis NaN; alpha = 1e200 already gave kurtosis 0 (the denominator overflows while 30 a - 66 does not).
- Method: keep each closed form where its parts are in range (the same bits), and otherwise use ratios with r = b / (a - 1) (the mean):
  - variance: b^2 / vDen where b^2 is in [2^-1022, Inf) and vDen = (a - 1)^2 (a - 2) is finite; otherwise r (r / (a - 2)). (The test on b^2 also catches a subnormal b^2, which has lost bits.)
  - sd (used where the variance is outside the normal range): b / ((a - 1) sqrt(a - 2)) where that denominator is finite; otherwise r / sqrt(a - 2).
  - kurtosis: the closed form where it is positive and finite (it is always positive for a > 4, so 0 or Inf/NaN means an overflow); otherwise ((30 - 66 / a) / (a - 3)) (a / (a - 4)).
- Why conditional: the ratio forms round differently (an ulp) from the closed forms, and the closed forms are kept bit for bit in the ordinary range.

## Check (main `d6e4fa4`)

distSummary is not an R function. References: Rmpfr at 400 bits on the exact doubles (passed as mantissa and exponent, printed with `%a`).

| alpha, beta | before (variance, sd, kurtosis) | after | Rmpfr |
|---|---|---|---|
| 1e308, 1e308 | NaN, 0, NaN | 1e-308, 1e-154, 3e-307 | the same, bit for bit |
| 1e200, 1e200 | NaN, 1e-100, 0 | 1e-200, 1e-100, 3.0000000000000003e-199 | the same |
| 1e110, 1e150 | 0, 9.999999999999999e-16, 3e-109 (the variance denominator overflows) | 9.999999999999997e-31, 9.999999999999999e-16, 3e-109 | 9.999999999999999e-31, the same, 2.9999999999999997e-109 (within 2.2e-16) |
| 1e200, 1 | 0, 1e-300, 0 | 0, 1e-300, 3.0000000000000003e-199 | the same |
| 1.7e308, 1.7e308 | NaN, 0, NaN | 5.88235294117647e-309, 7.669649888473705e-155, 1.7647058823529413e-307 | the same |
| 10, 1e300 | Inf, 3.9283710065919305e298, 5.5714 | unchanged (closed forms) | Inf, 3.928371006591931e298 |

The skewness 4 sqrt(a - 2) / (a - 3) did not overflow and is unchanged.

## Fix

- `src/distributions/summary.ts`, `case "invgamma"`: the conditional ratio forms above.

## Tests

- `test/issue238.test.ts`: the issue's call, four further cases against Rmpfr (relative 3e-16), and unchanged values where the products are in range. With `src/` stashed, the first two fail.
- distSummary tests and `npx tsc --noEmit -p .`: pass, no errors.

## close comment

Fixed in <commit of #238, see git log --grep='#238'>: where b^2, (a - 1)^2 (a - 2), (a - 1) sqrt(a - 2) or (a - 3)(a - 4) leave the double range, `distSummary("invgamma")` now forms the variance, the direct sd and the kurtosis from r = b / (a - 1) and ratios of a. alpha = beta = 1e308 gives variance 1e-308, sd 1e-154, skewness 4e-154 and kurtosis 3e-307, equal to Rmpfr's values on the exact doubles; alpha = 1e200 no longer gives kurtosis 0. The closed forms are kept where their parts are in range, so ordinary values are unchanged.

Test: test/issue238.test.ts. (Not pushed yet.)
