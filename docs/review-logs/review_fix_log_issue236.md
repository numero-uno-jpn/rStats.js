# Issue #236 log: distSummary("nbinom") with size + mu overflowing

GitHub Issue #236. Session 11, group A3 (distSummary, simple overflows).

## Plan

- Intent: with the mu parameterization, `distSummary("nbinom")` forms p = size / (size + mu). For size = mu = 1e308 the sum overflows, p is 0, the check `p > 0` fails and every moment is NaN, although the distribution is the one with prob = 1/2.
- Method: only where size + mu is not finite, form p as (size / 2) / (size / 2 + mu / 2). Halving is exact for these magnitudes (the larger parameter is above 8.9e307), so p is the correctly rounded ratio as before; the rest of the summary is unchanged. Where the sum is finite the expression is the old one (the same bits). mu = Infinity still gives p = 0 and NaN throughout.
- Why not the double-double route of `fromMu` (negbinomial.ts): that would change the bits of p in the ordinary range; the issue is only the overflow.

## Check (main `6ec8f78`)

distSummary is not an R function (no R value to compare); the references are the closed forms and the equivalent prob parameterization.

| call | before | after |
|---|---|---|
| `nbinom(size 1e308, mu 1e308)` | NaN throughout | mean 1e308, variance Infinity (2e308), sd 1.4142135623730953e154, mode 1e308, skewness 2.1213e-154, kurtosis 6.5e-308, median NaN; identical to `prob: 0.5` |
| `nbinom(size 1.5e308, mu 1.7e308)` | NaN throughout | mean 1.7e308, mode 1.7e308; mean, skewness and kurtosis exactly the values for the parameters divided by 2^10, rescaled; sd within an ulp (from the factors, as the variance overflows) |
| `nbinom(size 1e200, mu 1e200)`, `nbinom(size 1, mu 1e308)` | finite | unchanged |

The median stays NaN: qnbinom returns NaN for quantiles beyond 2^53 (the policy for integers beyond 2^53), as it already did for `prob: 0.5`. The issue asked for a non-NaN median; that would contradict the policy.

## Fix

- `src/distributions/summary.ts`, `case "nbinom"`: p from the halved parameters where size + mu overflows.

## Tests

- `test/issue236.test.ts`: the issue's call (equal to the prob = 1/2 summary), a scale check against the parameters divided by 2^10, and unchanged values where the sum is finite. With `src/` stashed, the first two fail.
- distSummary tests and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope

- With mu much smaller than size, q = 1 - p loses digits, so the mean (r q / p) is not mu: `nbinom(size 1e308, mu 1)` has mean 0 and variance 0, `nbinom(size 1e308, mu 1e300)` mean 1.0000000039e300. negbinomial.ts forms p and q in double-double for this reason; distSummary does not. A fix (taking q = mu / (size + mu) directly, or the mean as mu) changes the bits of ordinary values, so it is left as a note.

## Follow-up (session 11, user decision 5)

### Plan

- Intent: `distSummary("nbinom", { size: 1e100, mu: 1e30 })` did not end (before #236 as well). Located with a copy of summary.ts whose mode search throws after 1e6 steps and whose qnbinom is a counted copy: the mode search passed 1e6 steps; qnbinom was not reached. p = size / (size + mu) rounds to 1, q = 1 - p to 0, the guess (r - 1) q / p is 0, and the search walked up from 0 toward 1e30 one step at a time (beyond 2^53 it could never end, as mode + 1 = mode). The same happens wherever mu is far below size, for example size 1e30 or 1e100 with mu 1e10.
- Method: with mu given and the old guess below 2^53, start from floor(((r - 1) / r) mu) instead (no overflow, a few ulps from the boundary). The search for the last x with x r <= (r - 1) mu ends at the same mode from any start, so every mode the old search reached is unchanged; where the new guess is 2^53 or more, it is the mode (the existing rule beyond 2^53). Guesses of 2^53 or more from q are kept as they were.
- qnbinom itself is fine: `qnbinom(0.5, 1e100, { mu: 1e30 })` = 1e30 in 3 evaluations of the distribution function, and R's `qnbinom(0.5, size = 1e100, mu = 1e30)` is also 1e30 (0x1.93e5939a08ceap+99). No docs entry (distSummary is not an R function, qnbinom agrees with R).

### Check

| call | Before | After |
|---|---|---|
| `nbinom(size 1e100, mu 1e30)` | does not end (search past 1e6 steps) | mode 1e30, median 1e30 (R 1e30) |
| `nbinom(size 1e30, mu 1e10)`, `(size 1e100, mu 1e10)` | does not end | mode 1e10, median 1e10, 3 steps |
| `nbinom(size 1e100, mu 1e10 + 0.5)`, `(size 1e30, mu 123456.5)` | | mode and median 1e10 and 123456 (R's qnbinom the same) |
| 20000 random (size, mu) from 1e-4 to 1e20 and small integers, all ending before | | all seven values the same bits (counted copies of both versions) |

### Fix

- `src/distributions/summary.ts`, `case "nbinom"`: the start of the mode search from (r - 1) / r mu with mu.

### Tests

- `test/issue236.test.ts`: the two follow-up blocks (the calls above, and values that were already reached). The calls that did not end before are left out of the stash check (`-t` on the unchanged block, which passes there); their old behavior was checked with the counted copy.
- `npx vitest run`: 355 files passed (2822 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

### Out of scope

- The other values for these parameters come from q = 1 - p as before: for size 1e100, mu 1e30 the mean, variance and sd are 0 and skewness and kurtosis NaN (the mean should be mu = 1e30). This is the note above (q losing its digits for mu much smaller than size), still left for a decision.
- The mode test x r <= (r - 1) mu rounds r - 1 to r for size beyond 2^53, so for an integer mu (size 1e30, mu 1e10) the mode is mu, while floor(mu - mu / size) is mu - 1 (a tie only in exact arithmetic would make both modes). The same before the fix where the search ended (size 1e20, mu 1e10 gives 1e10); unchanged here.

## Follow-up 2 (session 11, user decision: nbinom moments with mu far below size)

### Plan

- Intent: with mu given and mu much smaller than size, the moments came from q = 1 - p with p = size / (size + mu) rounded near 1, so q kept only the rounding of p: size 1e10, mu 1 gave a mean of 1.0000000828 (8.3e-8 off), and from size 2^53 with mu 1 (size 1e20, 1e308; size 1e100 with mu 1e30) q is 0, so mean, variance and sd were 0 and skewness and kurtosis NaN. This is the Out of scope note above.
- Method (the user's decision): only where 0 < mu / size < 2^-26, form the moments directly in mu and t = mu / size: mean mu, variance mu + mu^2 / size = mu + mu t, sd its square root, skewness (size + 2 mu) / sqrt(size mu (size + mu)) = (1 + 2t) / sd, and excess kurtosis 6 / size + size / (mu (size + mu)) = 6 / size + 1 / variance. distSummary's kurtosis is the excess kurtosis (6 / r + p^2 / (r q)); the forms are the same functions (p = size / (size + mu), q = mu / (size + mu)), so they agree with the existing code where both are accurate: at mu = size the same bits (size = mu = 1, 2 and 1e200: skewness 2.1213203435596424, 1.5 and 2.1213203435596425e-100, kurtosis 6.5, 3.25 and 6.5e-200), and within 1.2e-9 relative in 5000 random cases with mu / size from 1e-7 to 1e3 (the difference is the old q's rounding, largest at the small ratios).
- Why these forms and not the products of the closed forms: size mu (size + mu) overflows for size 1e308, mu 1 and underflows for size 1e300, mu 1e-300; the forms in t do not leave the range, and size + mu is not formed, so the halved parameters of the first fix are not needed here (size + mu overflows only for size near 1.8e308, where t is still formed without overflow). The skewness divides by the reported sd (sqrt of the variance; sqrt(mu) sqrt(1 + t) where the variance is subnormal): in the sweep below this was at most 2.4 ulp off, against 4.0 ulp for (1 + 2t) / (sqrt(mu) sqrt(1 + t)).
- mu = 0 stays the point mass at 0 (mean 0, skewness and kurtosis NaN): the condition requires mu > 0. The mode and median are those of the first follow-up (unchanged). With mu / size at or above 2^-26 the code is the old one (the same bits).

### Check

References: the closed forms in Rmpfr at 240 bits from the exact doubles (passed as integer mantissa and exponent), errors in ulps of the reference rounded to double.

| call | Before | After | Rmpfr |
|---|---|---|---|
| `nbinom(size 1e10, mu 1)` | mean 1.000000082840371 (8.3e-8 off, 3.7e8 ulp), variance 1.000000082940371, sd 1.0000000414701846, skewness 0.999999958729817, kurtosis 0.99999991765963596 | mean 1, variance 1.0000000001, sd 1.00000000005, skewness 1.00000000015, kurtosis 1.0000000005 | the same (new: at most 0.19 ulp) |
| `nbinom(size 1e20, mu 1)` | mean, variance, sd 0; skewness, kurtosis NaN | all 1 | 1 + 1e-20, 1 + 5e-21, 1 + 1.5e-20, 1 + 5e-20: 1 in double |
| `nbinom(size 1e100, mu 1e30)` | mean, variance, sd 0; skewness, kurtosis NaN | mean 1e30, variance 1e30, sd 1e15, skewness 1e-15, kurtosis 9.999999999999999e-31 | the same (skewness 0.44 ulp, kurtosis 0.41 ulp) |
| `nbinom(size 1e308, mu 1)` | mean, variance, sd 0; skewness, kurtosis NaN | all 1 | 1 (0 ulp) |
| `nbinom(size 1e20, mu 1e10)` | mean 10000011930.633959 (1.2e-6 off) | mean 1e10, variance 10000000001, sd 100000.000005, skewness 1.0000000001500001e-5, kurtosis 1.0000000005e-10 | at most 0.77 ulp |
| `nbinom(size 1e8, mu 1)`, `(size 2^26, mu 0.99)` | mean 3.9e-9 and 5.7e-9 off | at most 0.87 ulp | |
| `nbinom(size 1e300, mu 1e-300)`, `(size 1, mu 1e-300)` | mean, variance, sd 0; skewness, kurtosis NaN | mean 1e-300, sd 1e-150, skewness 1e150, kurtosis 9.999999999999999e299 | at most 0.48 ulp |
| `nbinom(size 1.7976931348623157e308, mu 2^970)` (size + mu overflows: the halved parameters) | mean 2^971 (twice mu) | mean 2^970 | at most 0.75 ulp |
| `nbinom(size 1e-300, mu 1e-320)` (subnormal mu) | mean, variance, sd 0; skewness, kurtosis NaN | mean mu, sd 9.9999443357584941e-161, skewness 1.0000055664551359e160, kurtosis Infinity | sd 0.09 ulp, skewness 0.01 ulp; kurtosis 1.00001e320 overflows |

Sweep (scratchpad `fix22_sweep.mts`): 26109 (size, mu) pairs, 20000 log-uniform from 1e-6 to 1e308, 6000 with mu / size from 2^-40 to 2^-10, the boundary mu = size 2^-26 and 2 ulps either side for 12 sizes, and small values with mu = 0. 31 pairs were left out because the mode search does not end there (Out of scope below).

- mu / size at or above 2^-26 or mu = 0 (13827 pairs): all seven values the same bits as before the fix.
- Below 2^-26 (12251 pairs): mode and median the same bits. Rmpfr errors, before / after: mean more than 1 ulp in 12234 / 0 (after exact: mu); variance at most 9.0e15 ulp / 0.50 ulp; sd 9.0e15 / 0.84 ulp; skewness NaN or more than 1e6 ulp in 12209 / at most 2.4 ulp (more than 2 ulp in 13); kurtosis NaN or more than 1e6 ulp in 12216 / at most 1.75 ulp.

### Fix

- `src/distributions/summary.ts`, `case "nbinom"`: with 0 < mu / size < 2^-26, mean, variance, sd, skewness and kurtosis from mu and t = mu / size; the mode and median as before.

### Tests

- `test/issue236.test.ts`: a follow-up 2 block (size 1e10 with mu 1; size 1e20 and 1e308 with mu 1, size 1e100 with mu 1e30 and size 1e300 with mu 1e-300; unchanged values at size 1e10 with mu 150 and size 2^26 with mu 1, and mu = 0). The first follow-up's "unchanged" case size 1e20, mu 1e10 has mu / size = 1e-10, so its moments now are the Rmpfr ones (mode and median unchanged). With `src/` stashed, three tests fail (that case and the first two of the new block).
- `npx vitest run`: 369 files passed (2853 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

### Out of scope

- Just above 2^-26 the old forms remain, with an error up to about 2^-53 / t relative: for size 1e100 with mu one ulp above size 2^-26, the mean is 3.8e7 ulp (8.5e-9) off, while just below it is exact. The threshold is the decision's; the step at it is this rounding of q.
- The mode search does not end where (size - 1) mu overflows and the start floor((size - 1) / size mu) is below 2^53, for example `distSummary("nbinom", { size: 4.3258831225385124e305, mu: 180497287704.3662 })`: the bound (r - 1) mu of the test x r <= (r - 1) mu is Infinity, so every step passes. qnbinom is fine there (180497287704 at once). 31 of the 26109 sweep pairs, from about size mu > 1.8e308 with mu below 2^53; before this follow-up as well. The mode was to stay as in the first follow-up, so this is left as a note.

## close comment

Fixed in <commits of #236, see git log --grep='#236'>: where size + mu overflows, `distSummary("nbinom")` now forms p = size / (size + mu) from the halved parameters (exact at these magnitudes), so `distSummary("nbinom", { size: 1e308, mu: 1e308 })` is the summary for prob = 1/2: mean 1e308, mode 1e308, sd 1.414e154, variance Infinity (2e308 overflows). The median stays NaN, as `qnbinom` returns NaN for quantiles beyond 2^53 (the same for `prob: 0.5`). Values where the sum is finite are unchanged. A follow-up fixes `distSummary("nbinom", { size: 1e100, mu: 1e30 })`, which did not end: with mu far below size, q = 1 - p rounded to 0 and the mode search walked up from 0 one step at a time; it now starts at floor((size - 1) / size mu), so the mode and median are 1e30 (R's qnbinom also gives 1e30). Modes the search reached before are unchanged. A second follow-up forms the moments directly where mu / size < 2^-26, as the rounded q gave them wrong there: mean mu, variance mu + mu^2 / size, sd its square root, skewness (size + 2 mu) / sqrt(size mu (size + mu)) and excess kurtosis 6 / size + size / (mu (size + mu)), in t = mu / size so that nothing overflows. `distSummary("nbinom", { size: 1e10, mu: 1 })` had a mean of 1.0000000828; it is now 1. For size 1e20 and 1e308 with mu 1, and for size 1e100 with mu 1e30, the mean, variance and sd were 0 and the skewness and kurtosis NaN. The mean is now mu, and the other values are within 2.4 ulp of Rmpfr in a 12251-case sweep. Values with mu / size at or above 2^-26 have the same bits as before.

Test: test/issue236.test.ts. (Not pushed yet.)
