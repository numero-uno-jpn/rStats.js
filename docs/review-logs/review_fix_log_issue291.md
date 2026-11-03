# Issue #291 log: chisqTest rejects an infinite count in the goodness-of-fit path

GitHub Issue #291. Session 12, judging of the issues classified C. Verdict: not planned (existing policy, recorded in docs). The outdated file comment is corrected; no behaviour changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `chisqTest([Infinity, 1])`, `chisqTest([[Infinity, 1]])`, `chisqTest([[1], [Infinity]])`: RangeError "all entries of 'x' must be non-negative and finite".
- R: `chisq.test(c(Inf, 1))` and `chisq.test(matrix(c(Inf, 1), 1))`: statistic NaN, p NaN.
- An infinite count has no meaning; docs/differences-from-r.md ("Inputs without meaning") lists "an infinite count in `chisqTest` (R returns NaN)". The comment at the check says so, but the file's header comment (lines 11 and 12) still said that a vector lets Inf through.

## Fix

- src/htest/chisqTest.ts: the header now says that negative, NaN and Inf counts are errors in every shape (R lets Inf through in a vector or a 1-row or 1-column matrix and returns NaN). Comment only.

## Tests

- None (covered by the existing chisqTest tests).

## Out of scope

- None.

## close comment

Not planned: the error is deliberate. R returns NaN for chisq.test(c(Inf, 1)); an infinite count has no meaning, and docs/differences-from-r.md lists it under "Inputs without meaning". The file comment that described the earlier behaviour (Inf let through for vectors) was outdated and now matches the code. (Not pushed yet.)
