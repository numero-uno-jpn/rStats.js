# Issue #201 log: weightedMean returns 0 where only the sum of the weights overflows

GitHub Issue #201. Session 11, group A2.

## Plan

- Intent: `weightedMean` computes `sum(x w) / sum(w)` (R's order) and falls back to a rescaled computation only where that quotient is not finite. With `x = (1e-308, 2e-308, 1e308)`, `w = (1e308, 1e308, 0)` the numerator is 3 but the sum of the weights overflows, so the quotient is a finite 0 and the fallback was not reached. The true mean is 1.5e-308.
- Method: also take the fallback where the sum of the weights is not finite (all inputs finite). The fallback itself also had to change: it divided the values and the weights by their largest absolute values, which turned 1e-308 / 1e308 into 0 (the largest value had weight 0 here) and so also gave 0. It now divides the values of nonzero weight and the weights by powers of 2 that bring their largest absolute values into [1, 2) (`scaleToUnit`), forms the mean there and multiplies it back by the power of 2 of the values (`ldexp`).
- Why: the plain quotient is kept wherever it and the sum of the weights are finite, so those values keep their bits (R's values). The power-of-2 scaling adds no rounding, so the fallback is at least as accurate as the old one; the values of the old fallback that are covered by tests are unchanged.

## Check (main after #197; R 4.5.2)

| x, w | R 4.5.2 | Before | After |
|---|---|---|---|
| (1e-308, 2e-308, 1e308), (1e308, 1e308, 0) | 0 | 0 | 1.5e-308 (= (x1 + x2) / 2 rounded once) |
| (1e-308, 2e-308), (1e308, 1e308) | 0 | 0 | 1.5e-308 |
| (0, 0), (1e308, 1e308) | | 0 | 0 |
| (1, 2), (1e308, 1e308) | | 1.5 | 1.5 |
| (1, 2, 3), (1e308, 1e308, 1e308) | NaN | 2 | 2 |
| (1e308, 1e308), (1, 1) | Inf | 1e308 | 1e308 |
| (1e308, -1e308, 3), (1, 1, 1) | | 1 | 1 |
| (1.5e308, 1.7e308), (3, 1) | | 1.55e308 | 1.55e308 |
| (1e300, 2e300, 3e300), (1, 2, 1e300) | | 3e300 | 3e300 |
| (1, 2, 3), (3, 1, 1) | 1.6 | 1.6 | 1.6 |

(Windows R reads `1e308` and `1e-308` a few ulps off; R's 0 comes from 3 / Inf whatever the exact doubles.)

## Fix

- `src/descriptive/basic.ts` (`weightedMean`): the fallback condition and the power-of-2 fallback; the unused import of `maxOf` removed.
- Docs: the existing row for `weighted.mean` in "Where R fails and rStats.js returns a value" (English and Japanese) now also names the case where only the sum of the weights overflows.

## Tests

- `test/issue201.test.ts`: the issue's example against `(1e-308 + 2e-308) / 2`, an all-zero numerator; the values above that did not change. With src stashed the first test fails.
- `test/descriptive.test.ts` (the R fixtures of `weighted.mean`, with the `overflow(1e300)` known differences) and `test/issue168.test.ts`: 40 passed.

## Out of scope

- Where the products `x w` fall below the normal range while the result does not (`weightedMean([1e-300, 2e-300], [1e-300, 1e-300])`), the numerator underflows to 0 and the result is 0 (R too; true 1.5e-300). The quotient is finite and the sum of the weights is finite, so this fallback is not reached. Not reported; not changed.

## close comment

Fixed in <commit of #201, see git log --grep='#201'>: `weightedMean` now takes its rescaled fallback also where the sum of the (finite) weights overflows, and the fallback divides the values and the weights by powers of 2 instead of by their largest values (which turned 1e-308 / 1e308 into 0). The issue's example `weightedMean([1e-308, 2e-308, 1e308], [1e308, 1e308, 0])` is 1.5e-308 (was 0; R 4.5.2 also gives 0, recorded in docs/differences-from-r.md). Means whose quotient and sum of weights are finite are unchanged. Test: test/issue201.test.ts. (Not pushed yet.)
