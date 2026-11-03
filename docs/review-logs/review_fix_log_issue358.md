# Issue #358 log: Richardson extrapolation with r = 513

GitHub Issue #358. Session 12, judging of the issues classified C. Verdict: not planned (the decision of issue 123: a large r is recorded only, as numDeriv). No code changed.

## Plan

- Intent: run the issue's call on the current main and in numDeriv (R 4.5.2), and check it against the earlier decision on large r.
- Why: classified C (an earlier decision); the verdict needs the value checked.

## Check (main `7033ff3`, R 4.5.2, numDeriv)

- `grad(x => x[0], [1], { r: 513 })`: [NaN].
- numDeriv: `grad(function(x) x, 1, method.args = list(r = 513))`: NaN. The same.
- Issue 123 (log review_fix_log_issue123.md, commit 478f53d) found that a large Richardson depth r degrades the result long before 4^m overflows (r = 30 already gives a Hessian of -774.5, r = 41 a gradient of 0.329), in numDeriv as here, and the user decided to record it only and keep numDeriv's values. r = 513 is far beyond that range; NaN there is no worse than the wrong finite values at r = 30 to 60.

## Fix

- None.

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: grad(x => x[0], [1], { r: 513 }) is NaN, the same as numDeriv's grad with r = 513. A large Richardson depth was reviewed in #123: the step halves r times, so the method already gives wrong finite values from r of about 30 (numDeriv the same), long before 4^m overflows at r = 513; the decision there was to keep numDeriv's behaviour and record it. Avoiding the overflow would only replace NaN with a meaningless value. (Not pushed yet.)
