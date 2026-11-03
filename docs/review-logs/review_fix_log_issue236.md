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

## close comment

Fixed in <commits of #236, see git log --grep='#236'>: where size + mu overflows, `distSummary("nbinom")` now forms p = size / (size + mu) from the halved parameters (exact at these magnitudes), so `distSummary("nbinom", { size: 1e308, mu: 1e308 })` is the summary for prob = 1/2: mean 1e308, mode 1e308, sd 1.414e154, variance Infinity (2e308 overflows). The median stays NaN, as `qnbinom` returns NaN for quantiles beyond 2^53 (the same for `prob: 0.5`). Values where the sum is finite are unchanged. A follow-up fixes `distSummary("nbinom", { size: 1e100, mu: 1e30 })`, which did not end: with mu far below size, q = 1 - p rounded to 0 and the mode search walked up from 0 one step at a time; it now starts at floor((size - 1) / size mu), so the mode and median are 1e30 (R's qnbinom also gives 1e30). Modes the search reached before are unchanged. The mean for such parameters is still formed from the rounded q (0 here), as noted in the log.

Test: test/issue236.test.ts. (Not pushed yet.)
