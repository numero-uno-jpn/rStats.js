# Issue #157 log: qchisq with ncp where df + ncp overflows

GitHub Issue #157. Prepared overnight (decisions_linalg_misc.md, Q3); on the morning of 2026-11-03 the user chose option A (the distribution function is not evaluated at Infinity, and the search is bounded by the largest double). The plan was approved.

## Plan

- Intent: `qchisq(0.5, 1e308, ncp = 1e308)` threw `RangeError: Maximum call stack size exceeded`. Patnaik's parameters are NaN when df + ncp overflows, so the start fell back to x0 = df + ncp = Infinity, and the bracket's upper end was Infinity (or reached it by doubling). `pnchisqBoth(Infinity)` then takes the Hankel path (nu^2 <= z/100 holds for z = Infinity) and `sqrtDD(Infinity)` recurses without end.
- Method: `pnchisqBoth` returns the end point (lower tail 1, upper tail 0) for x = Infinity. In `qnchisq1`, the start x0 and the bracket's upper end are capped at Number.MAX_VALUE. If the target is not passed at Number.MAX_VALUE, the quantile is beyond the doubles and is Infinity.
- Why: user decision (option A). The values are correct: Infinity where the mean (2e308) exceeds the largest double by about 4e153 standard deviations, and the finite double where the distribution function steps from 0 to 1. Option B (NaN whenever df + ncp overflows, as R) would also give NaN where the quantile is finite. Both changes act only where Infinity was reached, so ordinary inputs keep their bits.

## Check (main `dc870c4`, R 4.5.2)

| Call | R 4.5.2 | Before | After |
|---|---|---|---|
| `qchisq(0.5, 1e308, ncp = 1e308)` (also upper tail, p = 1e-300 either tail, log p = -1e5 upper) | NaN (warning) | RangeError | Infinity |
| `qchisq(0.5, 1.7e308, ncp = 1e307)` (mean 1.8e308) | NaN | RangeError | Infinity |
| `qchisq(0.5, 1e308, ncp = 7e307)` (also p = 1e-300 either tail, log p = -1e5) | NaN | RangeError | 1.7000000000000001e308 |
| `qchisq(0.999, 8e307, ncp = 8e307)` | NaN | RangeError | 1.6000000000000002e308 (one double above the mean 1.6e308) |
| `qchisq(0.5, 5e307, ncp = 5e307)` | NaN | 1e308 | 1e308 (unchanged) |
| `qchisq(0.5, 1.7e308, ncp = 1e306)` | — | 1.71e308 | 1.71e308 (unchanged) |

- For df = 1e308 and ncp = 7e307 the standard deviation (about 2.2e154) is far below the spacing of the doubles there (about 2e292). `pchisq` is 0 at 1.7e308 and 1 at 1.7000000000000001e308, so the latter is the quantile for every p in (0, 1).
- Ordinary inputs (df 3 to 1e10, ncp 2 to 1e12, 1e300 and 1e300, 1 and 1e308) give the same values as before. The whole test suite with its noncentral chi-squared fixtures passes unchanged.
- R gives NaN, so the new values differ from R. Recorded in docs/differences-from-r.md (and docs/ja).

## Fix

- `src/distributions/nchisq.ts`: `pnchisqBoth` returns the end point at x = Infinity; `qnchisq1` caps x0 and the bracket at Number.MAX_VALUE and returns Infinity when the target is not passed there.
- docs (English and Japanese): a row in "Where R fails and rStats.js returns a value".

## Tests

- `test/issue157.test.ts`: the issue's example in both tails and with p = 1e-300 and log p, the quantile 1.7000000000000001e308 with pchisq on each side of it, and unchanged values. With src stashed, 2 of the 3 tests fail (RangeError; no call hangs).
- Whole suite `npx vitest run`: 274 files, 2567 passed / 38 skipped, 0 failed. `npx tsc --noEmit -p .`: no errors.

## Recorded as out of scope

- `pchisq(1.79e308, 1e308, ncp = 1e308, log = TRUE)` is -Inf. A normal approximation gives about -3.7e305, which is finite. R gives NaN. The Chernoff test judges the lower tail negligible, and its log is computed as -Inf. (Found while preparing; not changed.)

## close comment

Fixed in <commit of #157, see git log --grep='#157'>: qchisq with ncp no longer evaluates the distribution function at Infinity. The start and the bracket are capped at the largest double, and when the target is not reached there the quantile is beyond the doubles and is Infinity. The internal distribution function also returns its end point for x = Infinity, where the asymptotic path recursed without end. qchisq(0.5, 1e308, ncp = 1e308) is now Infinity (was RangeError: Maximum call stack size exceeded; R gives NaN), as the mean 2e308 exceeds the largest double by about 4e153 standard deviations, and the same holds in the upper tail and for p = 1e-300. Where the quantile is finite, the right double is returned: qchisq(0.5, 1e308, ncp = 7e307) is 1.7000000000000001e308, where pchisq steps from 0 to 1 (also a RangeError before; R gives NaN). Inputs whose bracket stays finite are unchanged. Recorded in docs/differences-from-r.md. Test: test/issue157.test.ts. (Not pushed yet.)
