# Issue #230 log: hist's Scott rule fails for finite data whose range and width overflow

GitHub Issue #230. Session 11, group A4 (hist: #228, #230, #231, #258, #259).

## Plan

- Intent: Scott's rule computes r = max - min and h = 3.5 sd n^(-1/3) and returns ceil(r / h). For `hist([-1e308, 1e308], { breaks: "Scott" })` both r and h overflow (sd = 1.414e308 is finite, 3.5 sd is not), r / h is NaN and `hist` throws "invalid number of 'breaks'". The ratio is scale free and about 0.509, so one cell is suggested.
- Method: where r or h is not finite (the data are finite), compute both from the data divided by a power of 2 (`scaleToUnit`, exact), then the same ceil formula. The test is on r and h, not on the ratio: if only h overflows, r / h is a finite 0 and the count would be wrong without an error.
- Why: where r and h are finite nothing changes, so those counts keep their bits (R's where R's sd is finite). The power-of-2 scaling adds no rounding (up to values far below the largest, which are negligible here).

## Check (main after #228; R 4.5.2)

| x (breaks "Scott") | R 4.5.2 | Before | After |
|---|---|---|---|
| (-1e308, 1e308) | error "invalid number of 'breaks'" | same error | breaks (-1e308, 0, 1e308); R's nclass.scott of x 2^-1024 is 1, and R's `hist(x, breaks = 1)` gives these breaks |
| (-1.7e308, -1e308, 0, 1e308, 1.7e308) | same error | same error | (-1.7e308, 0, 1.7e308) (nclass.scott of x 2^-1024 is 2) |
| (-1.7e308, -1.6e308, -1.5e308, 1.7e308) | same error | same error | (-1.7e308, 0, 1.7e308) (nclass.scott of x 2^-1024 is 1) |
| (1, 2, 2, 3, 3, 3, 4, 10, 11.5) | (0, 5, 10, 15) | same | same |
| (1e300, 2e300, 2e300, 5e300) | (0, 5e300) | (0, 2e300, 4e300, 6e300) | same as before |
| (1.7, 1.6, 1.5, 1, 0.9)e308 | (0, 1.7e308) | (5e307, 1.1e308, 1.7e308) | same as before |

The last two rows differ from R already before this fix: R's `sd` overflows there (the variance is above the double range, so h = Inf and the count is 1), while rStats.js's `sd` is finite (scaled standard deviation, see the existing `sd` rows of docs/differences-from-r.md). Not touched.

## Fix

- `src/descriptive/hist.ts` (`classCount`, Scott): the fallback above.
- Docs: a row for `hist(..., breaks = "Scott")` in "Where R fails and rStats.js returns a value" (English and Japanese).

## Tests

- `test/issue230.test.ts`: the three overflowing cases (breaks equal to those of the count from R's nclass.scott on the scaled data), and the unchanged breaks (values before the fix). With src stashed the first test fails.

## Out of scope

- The counts of these histograms are still wrong at this commit ([2, 0] for the first case): the counting fuzz uses the overflowing data range. That is #258.

## close comment

Fixed in <commit of #230, see git log --grep='#230'>: where the range or the Scott width of finite data overflows, `hist` now takes both from the data divided by a power of 2 (the ratio is scale free). `hist([-1e308, 1e308], { breaks: "Scott" })` now has breaks (-1e308, 0, 1e308) (one suggested cell, ratio 0.509) instead of the error "invalid number of 'breaks'" (R 4.5.2 gives the same error, recorded in docs/differences-from-r.md). Counts where the range and width are finite are unchanged. Test: test/issue230.test.ts. (Not pushed yet.)
