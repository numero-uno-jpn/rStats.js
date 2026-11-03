# Issue #237 log: distSummary("hyper") mean, variance and mode overflow for large counts

GitHub Issue #237. Session 11, group A4 (distSummary, F and hypergeometric).

## Plan

- Intent: the hypergeometric summary forms the mean k m / N, the variance mean (n / N)(N - k) / (N - 1) and the mode floor((k + 1)(m + 1) / (N + 2)) with products that overflow for large finite counts (N = m + n finite). m = n = k = 1e200 gave mean, variance and mode Infinity (sd Infinity with them).
- Method, each only where the plain form overflows (otherwise the same bits):
  - mean: k (m / N) where k m overflows.
  - variance: mean (n / N) ((N - k) / (N - 1)) where the plain product is not finite.
  - mode: where (k + 1)(m + 1) overflows, the floor of the exact quotient in integers, (k + 1)(m + 1) div (m + n + 2) with BigInt (the counts are integers, so this is exact), converted to the nearest double. Beyond 2^53 this is the rounded value, as the nbinom mode (the precedent named in the triage). A ratio such as (k + 1)((m + 1) / (N + 2)) would not do: for a point mass n = 0, m = 1e308, k = 10, the ratio rounds to 1 and the floor gives 11 instead of 10.
- The median stays NaN: qhyper returns NaN where the support is beyond 2^53 (the policy for integers beyond 2^53).
- The kurtosis is #244 (next commit); the skewness is left as it is (see Out of scope).

## Check (main `020294d`)

distSummary is not an R function. References: exact rationals with Python's `fractions` on the exact integer values of the doubles, rounded once.

| m, n, k | before (mean, variance, mode) | after | exact |
|---|---|---|---|
| 1e200, 1e200, 1e200 (the issue) | Inf, Inf, Inf | 5e199, 1.25e199, 5e199 | the same |
| 1e200, 3e200, 1e200 | Inf, Inf, Inf | 2.5e199, 1.40625e199, 2.5e199 | the same |
| 3e200, 1e200, 2e199 | Inf, Inf, Inf | 1.5e199, 3.5624999999999997e198, 1.5e199 | 1.5e199, 3.5625e198 (1 ulp), 1.5e199 |
| 1e200, 1e100, 1e150 | Inf, Inf, Inf | 1e150, 1e50, 1e150 | the same |
| 1e308, 0, 10 (point mass) | 10, 0, Inf | 10, 0, 10 | 10 |
| 1e150, 1e150, 1e150; 1e300, 1e300, 7; 10, 7, 8 | finite | unchanged | |

The issue's expected values (mean 5e199, variance about 1.25e199, mode near 5e199, skewness 0) are met.

Unchanged bits: the sweep of the hypergeometric summary over m in {0, 1, 2, 5, 10, 100, 1e6, 1e15}, n in {0, 1, 3, 7, 50, 1e6, 1e15}, k in {0, 1, 2, 5, 40, 1e6, 1e15} (k <= m + n), and of the other families, is identical to main before this group (the sweep also corrects the count of changed F pairs in the #235 log: 27, all previously NaN or 0).

## Fix

- `src/distributions/summary.ts`, `case "hyper"`: the conditional forms above.

## Tests

- `test/issue237.test.ts`: the issue's call, three cases against exact rationals, the point mass with an overflowing product, and unchanged values where the products are finite. With `src/` stashed, the first three fail.
- distSummary tests and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope

- The skewness (N - 2m) sqrt(N - 1)(N - 2k) / (sqrt(k m n (N - k)) (N - 2)) overflows the same way (m = 1e200, n = 3e200, k = 1e200: NaN; the issue's symmetric case is 0 only because N - 2m = 0). Not part of #237 or #244; it would take the same ratio treatment.
- Where (k + 1)(m + 1) is finite but above 2^53, the plain mode floors a rounded quotient and can be off by one (the binomial mode uses an exact product for this, `floorProduct`). Not an overflow; left as it is.
- N = m + n itself overflowing (m = n = 1e308) passes the parameter check and gives a mean of 0; not part of this issue.
- Where k m is finite, the mean k m / N rounds twice (m = n = 1e300, k = 7: 3.4999999999999996 for 3.5); the closed form is kept for its bits.

## close comment

Fixed in <commit of #237, see git log --grep='#237'>: where k m overflows, `distSummary("hyper")` now takes the mean as k (m / N), the variance from mean (n / N) ((N - k) / (N - 1)) where its plain product overflows, and the mode, where (k + 1)(m + 1) overflows, as the floor of the exact integer quotient (BigInt), rounded to a double (beyond 2^53 a rounded value, as the nbinom mode). `distSummary("hyper", { m: 1e200, n: 1e200, k: 1e200 })` now gives mean 5e199, variance 1.25e199 and mode 5e199, equal to the exact values; the median stays NaN, as `qhyper` returns NaN beyond 2^53. Values where the products are finite are unchanged. The kurtosis is fixed under #244.

Test: test/issue237.test.ts. (Not pushed yet.)
