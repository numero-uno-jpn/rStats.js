# Issue #209 log: the exact ansariTest estimate overflows at the midpoint

GitHub Issue #209. Session 11, group A1.

## Plan

- Intent: the exact estimate of the ratio of scales is the midpoint of the two candidate ratios around the median of the statistic, computed as `(above + below) / 2`. With candidates near the largest double the sum overflows and the estimate was Infinity, though the midpoint is finite.
- Method: keep `(above + below) / 2`; only where it is Infinity (both candidates are finite there, so only the sum overflowed) take `above / 2 + below / 2`. Halving these candidates is exact (they are about 1e308), so the result is the correctly rounded midpoint.
- Why: R's `mean(c(sle, sgr))` (long double sum) gives the finite midpoint; this is an rStats.js error where R is right. The fallback branch is reached only where the result was Infinity, so every other estimate keeps its bits.

## Check (main `c2a515a` with #203, #219, #221, #225; R 4.5.2)

R was given the same doubles as hex literals (Windows R misrounds `1e308`).

| x, y | R 4.5.2 estimate | Before | After |
|---|---|---|---|
| 1e308 (0x1.1ccf385ebc8ap+1023), (1, 1.01) | 0x1.1b66460816da7p+1023 (9.950495e307) | Infinity | 0x1.1b66460816da7p+1023 |
| .Machine$double.xmax, (1, 1.01) | 0x1.fd7720f353a4bp+1023 | (not run before) | 0x1.fd7720f353a4bp+1023 |
| 1e300, (1, 1.01) | 9.950495e299 | 9.950495049504952e+299 | unchanged |

The confidence interval is NaN in these cases, as R's NA (R warns "samples differ in location: cannot compute confidence set, returning NA"). R's estimate in the exact branch is `mean(c(sle, sgr))` (checked in `stats:::ansari.test.default`).

## Fix

- `src/htest/ansariTest.ts` (`exactInterval`): the fallback from the halves.
- No docs change (the value is R's).

## Tests

- `test/issue209.test.ts`: the issue's example and the largest double, against R's bits; an estimate without overflow unchanged. With src stashed the first test fails.
- The test files that mention `ansari`: 85 passed. `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #209, see git log --grep='#209'>: where the sum of the two candidate ratios overflows, the exact estimate of `ansariTest` is now formed from their halves. The issue's example `ansariTest([1e308], [1, 1.01], { confInt: true, exact: true }).estimate` is 9.95049504950495e+307 (was Infinity), the same bits as R 4.5.2's `mean(c(sle, sgr))` with the same doubles; the interval stays NaN, as R's NA. Estimates whose sum does not overflow are unchanged. Test: test/issue209.test.ts. (Not pushed yet.)
