# Issue #464 log: mean with trim = NaN

GitHub Issue #464. Session 13, judging of the issues classified C. Verdict: not planned (the claim about R is wrong; R also stops). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2.
- Why: classified C (the issue says R's `mean(c(1, 2, 3), trim = NaN)` returns 2; it was a static reading, R was not run).

## Check (main `f575c6f`, R 4.5.2)

- R: `mean(c(1, 2, 3), trim = NaN)`, `trim = NA_real_`, and `mean(c(NA, 1), trim = NaN, na.rm = TRUE)`: "missing value where TRUE/FALSE needed". `mean.default` tests `if (trim > 0 && n)`; `NaN > 0` is NA and `NA && n` is NA for n > 0, so `if` stops. It does not take the no-trimming branch.
- R: `mean(numeric(0), trim = NaN)` and `mean(NA_real_, trim = NaN, na.rm = TRUE)`: NaN (`NA && 0` is FALSE).
- rStats.js: the nonempty cases throw RangeError "'trim' must be numeric of length one"; the empty cases return NaN (the `n === 0` return comes before the trim check). The message differs from R's, but both are errors (policy: a meaningless input is an error).

## Fix

- None.

## Tests

- `test/issue464.test.ts`: trim = NaN throws for a nonempty x (also after `naRm`); an empty x gives NaN.

## Out of scope (recorded)

- `mean([1, NaN], { trim: NaN })` (x with a missing value, no `naRm`) returns NaN, since `values()` returns early before the trim check; R 4.5.2's `mean(c(1, NA), trim = NaN)` stops with the same error as above. Not changed here; moving the check before the early return would match R.

## close comment

Not planned: R does not return the ordinary mean here. R 4.5.2's mean(c(1, 2, 3), trim = NaN) stops with "missing value where TRUE/FALSE needed", since mean.default tests `trim > 0 && n` and `NaN > 0 && 3` is NA (also for trim = NA_real_ and after na.rm = TRUE); only an empty x gives NaN (`NA && 0` is FALSE). rStats.js also stops (RangeError "'trim' must be numeric of length one") and returns NaN for an empty x. Added test/issue464.test.ts. (Not pushed yet.)
