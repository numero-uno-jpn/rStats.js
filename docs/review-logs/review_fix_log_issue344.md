# Issue #344 log: lm's R-squared and F under a common rescaling of the weights

GitHub Issue #344. Session 12, judging of the issues classified C. Verdict: not planned (not reproduced). No code changed.

## Plan

- Intent: run the issue's example on the current main through the public API (matrix and formula lm) and compare with R 4.5.2.
- Why: classified C (not reproduced); the verdict needs the values.

## Check (main `7033ff3`, R 4.5.2)

x = 1..5, y = 2, 3, 5, 4, 7.

| fit | rSquared | F | sigma |
|---|---|---|---|
| matrix, no weights | 0.8175675675675677 | 13.444444444444446 | 0.9486832980505138 |
| matrix, weights 4 | 0.8175675675675677 | 13.444444444444446 | 1.8973665961010275 |
| matrix, weights 0.25 | 0.8175675675675677 | 13.444444444444446 | 0.4743416490252569 |
| formula, no weights / 4 / 0.25 | 0.8175675675675675 | 13.444444444444443 | as above |

- R-squared and F are the same in all bits under weights of 4 and 0.25. sigma scales by sqrt(4), as in R (`summary(lm(y ~ x, weights = rep(4, 5)))$sigma` 0x1.e5b9d136c6d98p+0 = 1.8973665961010275).
- R's R-squared and F also do not change with weights 4 or 0.25 (0x1.a2983759f2297p-1, 0x1.ae38e38e38e35p+3).
- The weights are divided by an even power of 2 before the sums of squares are formed, and the dimensionless statistics are taken in those units (both sums in the same scaled units); `core.rss` is scaled back only for the outputs with units.

## Fix

- None.

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: not reproduced. With x = 1..5, y = 2, 3, 5, 4, 7, lm with weights of 4 (or 0.25) gives the same rSquared (0.8175675675675677) and F (13.444444444444446) as the unweighted fit, in all bits, for both the matrix and the formula interface; only sigma scales, by sqrt(4), as in R (1.8973665961010275). The model and residual sums of squares are combined in the same scaled weight units before the statistics are formed. (Not pushed yet.)
