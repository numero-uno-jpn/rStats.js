# Issue #244 log: distSummary("hyper") kurtosis NaN for large balanced counts

GitHub Issue #244. Session 11, group A4 (distSummary, F and hypergeometric).

## Plan

- Intent: the hypergeometric excess kurtosis ((N - 1) N^2 (N (N + 1) - 6 m n - 6 k (N - k)) + 6 k m n (N - k)(5 N - 6)) / (k m n (N - k)(N - 2)(N - 3)) forms products of degree 6 in the counts. For m = n = k = 1e150 both the numerator and the denominator overflow (NaN), while the kurtosis is about -1e-150.
- Method: keep the closed form where its numerator and denominator are finite (they are integers' products, so they cannot underflow; the same bits as before). Otherwise divide both by N^5 and write them in p = m / N, q = n / N, f = k / N, g = (N - k) / N:
  - numerator / N^5 = (1 - 1/N)(1 + 1/N - 6 p q - 6 f g) + 6 p q f g (5 - 6/N)
  - denominator / N^5 = N p q f g (1 - 2/N)(1 - 3/N) = k p q g (1 - 2/N)(1 - 3/N)
  The numerator is O(1) (-1/8 for the balanced case), so no large terms cancel.

## Check (main `a3c2178`)

distSummary is not an R function. References: exact rationals with Python's `fractions` on the exact integer values of the doubles, rounded once.

| m, n, k | before | after | exact |
|---|---|---|---|
| 1e150, 1e150, 1e150 (the issue) | NaN | -1e-150 | -1e-150 |
| 1e200, 1e200, 1e200 | NaN | -1e-200 | -1e-200 |
| 1e200, 3e200, 1e200 | NaN | -1.388888888888889e-200 | the same |
| 3e200, 1e200, 2e199 | NaN | -4.008771929824562e-200 | -4.008771929824561e-200 |
| 1e200, 1e100, 1e150 | NaN | 9.999999999999999e-51 | 1e-50 |
| 1e100, 1e100, 1e100; 1e80, 3e79, 5e79 | NaN | -1e-100; -4.11474358974359e-80 | the same |
| 1e150, 2e150, 3e149 | NaN | -4.555555555555556e-150 | -4.555555555555555e-150 |
| 1e300, 1e300, 7 | NaN | -0.2857142857142857 | the same |

All within 2.2e-16. The hypergeometric sweep (m, n, k over the grids of #237, up to 1e15) gives the same bits as before this group.

## Fix

- `src/distributions/summary.ts`, `case "hyper"` (N > 3): the scaled form above where the closed form's products overflow.

## Tests

- `test/issue244.test.ts`: the issue's call (and skewness 0), eight cases against exact rationals (relative 5e-16), unchanged values of the closed form. With `src/` stashed, the first two fail.
- Full `npx vitest run`: 341 files passed, 1 failed: `distributionProperties.test.ts > signrank`, a known intermittent timing failure; it passes alone (33 tests). 2774 tests passed, 38 skipped. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- The skewness overflows the same way for asymmetric large counts (see the #237 log).

## close comment

Fixed in <commit of #244, see git log --grep='#244'>: where the products of the closed form overflow, `distSummary("hyper")` now divides the kurtosis's numerator and denominator by N^5 and forms them in m / N, n / N, k / N and (N - k) / N. `distSummary("hyper", { m: 1e150, n: 1e150, k: 1e150 }).kurtosis` is now -1e-150, and eight further large cases agree with exact rational values within 2.2e-16. Where the products are finite the closed form is kept, so ordinary values are unchanged.

Test: test/issue244.test.ts. (Not pushed yet.)
