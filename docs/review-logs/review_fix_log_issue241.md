# Issue #241 log: distSummary("beta") sd 0 where a shape ratio underflows

GitHub Issue #241. Session 11, group A3 (distSummary, simple overflows).

## Plan

- Intent: where the beta variance is outside the normal range, `make()` takes the direct sd sqrt(a / s) sqrt(b / s) / sqrt(s + 1) (s = a + b). For beta(1e-308, 1e154), a / s is about 1e-462 and underflows to 0, so the sd is 0, while the true sd sqrt(a) / b^1.5 is about 1e-308 (a subnormal, but representable).
- Method: only where a / s or b / s is below 2^-1022 (0 or subnormal), take the square roots first: (sqrt(a) / sqrt(s)) (sqrt(b) / sqrt(s)) / sqrt(s + 1). Each factor is at most 1, so nothing overflows, and a factor underflows only when the sd itself does. Where both ratios are normal, the old expression is kept (the same bits).
- Why not the form sqrt(a) sqrt(b) / s / sqrt(s + 1) suggested in the triage: for two tiny shapes (beta(1e-320, 1e-300)) sqrt(a) sqrt(b) is subnormal and loses digits before the division by s; the per-shape ratios do not.

## Check (main `abf3213`)

distSummary is not an R function. References: Rmpfr at 400 bits, sqrt(a b / (s^2 (s + 1))) on the exact doubles.

| a, b | before | after | Rmpfr |
|---|---|---|---|
| 1e-308, 1e154 (the issue) | 0 | 1e-308 | 1e-308 |
| 1e154, 1e-308 | 0 | 1e-308 | 1e-308 |
| 3e-300, 2e100 | 0 | 8.660254037844387e-251 | the same |
| 1e-310, 1e10 | 9.999944335258493e-166 (5.6e-6 off: a / s subnormal) | 9.999999999499986e-166 | 9.999999999499985e-166 |
| 1e-320, 1e-300; 5e-324, 1; 2, 3 | 9.999944335758489e-11; 1.5717277847026285e-162; 0.2 | unchanged | equal or within 1.1e-16 |

The variance (0 for the issue's case, about 1e-616) and the mean (about 1e-462) round to 0 correctly.

## Fix

- `src/distributions/summary.ts`, `case "beta"` (finite a + b): the conditional direct sd above.

## Tests

- `test/issue241.test.ts`: the issue's call and its mirror, two more cases against Rmpfr (relative 3e-16), unchanged values where the ratios are normal. With `src/` stashed, the first two fail.
- distSummary tests and `npx tsc --noEmit -p .`: pass, no errors.

## close comment

Fixed in <commit of #241, see git log --grep='#241'>: where a / (a + b) or b / (a + b) is below the normal range, `distSummary("beta")` now forms the direct sd from the square roots first, (sqrt(a) / sqrt(s)) (sqrt(b) / sqrt(s)) / sqrt(s + 1). `distSummary("beta", { shape1: 1e-308, shape2: 1e154 }).sd` is now 1e-308 (Rmpfr: 1e-308; the variance still rounds to 0), and beta(1e-310, 1e10) no longer loses 6 digits. Where both ratios are normal the old expression is kept, so ordinary values are unchanged.

Test: test/issue241.test.ts. (Not pushed yet.)
