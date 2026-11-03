# Issue #192 log: zTest's estimate underflows in the scaling set by sigma

GitHub Issue #192. Session 11, group A2.

## Plan

- Intent: `zTest` divides the data, the known standard deviations and mu by one power of 2 (`scaleToUnit`) so that the squared standard deviations stay in range, and scales the estimate and interval back. The power is set by the largest of them, here sigma = 1e308, so data around 1e-308 underflow to 0 and the reported mean was 0 instead of 2e-308.
- Method: where the common scale divides (k > 0) a nonzero value of a sample below the normal range, report that sample's mean from the sample in its own power-of-2 scale, but never scaled up: data whose largest value is below 2 are averaged as they are (`meanDD`), so that a subnormal mean is rounded once (averaging in the scaled-up coordinates and scaling back rounds twice, to 53 bits and then to the subnormal grid, and gave one unit of 2^-1074 too much for (1, 1, 2)e-308). Everywhere else the estimate is computed exactly as before. The statistic, p-value and interval keep the common scale: there the underflowed data are below the rounding of the half width (the interval ±1.13e308 is right, as the triage noted).
- Why: the fallback is reached only where the common scaling lost a value, so all other estimates keep their bits by construction. The new value is R's `mean(x)`, so no docs change.
- A first version took every estimate from the sample's own scale (a sweep of 175732 random samples whose common scaling stays normal showed the same bits), but it changed subnormal means for the worse (the double rounding above, e.g. `zTest([1e-308, 1e-308, 2e-308], { sigmaX: 1 })` 1.333333333333333e-308 became 1.3333333333333335e-308), so it was restricted to the fallback.

## Check (main after #223; R 4.5.2)

R has no `z.test` in base and BSDA is not installed; the estimate of BSDA's `z.test` (and of the fixtures' reference) is `mean(x)`. R was given the doubles as mantissa times a power of 2 (hex literals with subnormal exponents parsed to 0 in Windows R).

| Call | R `mean(x)` | Before | After |
|---|---|---|---|
| `zTest([1e-308, 2e-308, 3e-308], { sigmaX: 1e308 })` (the issue) | 0x1.cc359e067a348p-1023 (= 2e-308; Rmpfr the same) | 0 | 2e-308 |
| two-sample, x = (2, 4, 6)e-308, y = (1, 2, 3)e-308, sigma 1e308 and 1 | | [0, 0] | [4e-308, 2e-308] |
| `zTest([1e-308, 1e-308, 2e-308], { sigmaX: 1e308 })` (a subnormal mean) | 0x1.32ce6959a6cdap-1023 (0x996734acd366d × 2^-1074; exact mean 1/3 unit above) | 0 | 0x996734acd366d × 2^-1074 |
| `zTest([1e-308, 1e-308, 2e-308], { sigmaX: 1 })` (no scaling) | the same | 0x996734acd366d × 2^-1074 | unchanged |
| `zTest([1, 2, 3.5, 4], { sigmaX: 2 })` | | 2.625 | unchanged |
| `zTest([1e200, 2e200, 3.5e200], { sigmaX: 1e-100 })` | | 2.1666666666666665e200 | unchanged |

The interval of the issue's example, ±1.1315857340761718e308, and the statistic 0 are unchanged (R's own interval from `mean(x) ± qnorm(0.975) sigma / sqrt(n)` overflows to ±Inf).

## Fix

- `src/htest/aov.ts` (`zTest`): `reported`, the fallback for the estimate.

## Tests

- `test/issue192.test.ts`: the issue's example (with the unchanged interval and statistic), a two-sample case and a subnormal mean against R's `mean`; estimates without underflow unchanged. With src stashed the first test fails.
- The test files that mention `zTest` (the R fixtures, the scale-invariance tests): 328 passed.

## close comment

Fixed in <commit of #192, see git log --grep='#192'>: where the power-of-2 scaling set by sigma would underflow a sample's values, `zTest` now reports that sample's mean from the sample in its own scale (never scaled up, so a subnormal mean is rounded once). The issue's example `zTest([1e-308, 2e-308, 3e-308], { sigmaX: 1e308 }).estimate` is 2e-308 (was 0), R's `mean(x)`; the statistic, p-value and interval are unchanged, and estimates whose scaling does not underflow keep their bits. Test: test/issue192.test.ts. (Not pushed yet.)
