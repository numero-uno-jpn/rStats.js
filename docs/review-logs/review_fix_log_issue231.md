# Issue #231 log: hist's Freedman-Diaconis rule fails for finite data whose range and width overflow

GitHub Issue #231. Session 11, group A4 (hist: #228, #230, #231, #258, #259).

## Plan

- Intent: the Freedman-Diaconis rule computes the range r and h = 2 IQR (of the data rounded to 5 significant digits, with R's fallbacks when the IQR is 0) and returns ceil(r / h n^(1/3)). For `hist([-1e308, 1e308], { breaks: "FD" })` both r and 2 IQR overflow, the ratio is NaN and `hist` throws "invalid number of 'breaks'". The scale-free ratio is 1.26, so two cells are suggested.
- Method: the same treatment as Scott's rule (#230). Where r or h is not finite, compute both from the data and the rounded data divided by the same power of 2 (the exponent of the largest absolute value of the data, `scaleToUnit`, exact). The rounding to 5 decimal digits is done before the scaling, because it is not scale invariant under powers of 2. The test is on r and h, not on the ratio (h alone can overflow, giving a finite ratio 0).
- Why: where r and h are finite nothing changes, so those counts keep their bits (R's).

## Check (main after #230; R 4.5.2)

| x (breaks "FD") | R 4.5.2 | Before | After |
|---|---|---|---|
| (-1e308, 1e308) | error "invalid number of 'breaks'" | same error | breaks (-1e308, 0, 1e308); R's ratio on the data times 2^-1024 is 1.26 (2 cells), and R's `hist(x, breaks = 2)` gives these breaks |
| (-1.7e308, -1e308, 0, 1e308, 1.7e308) | same error | same error | (-1.7e308, 0, 1.7e308) (ratio 1.453, 2 cells) |
| (-1.7e308, -1.6e308, -1.5e308, 1.7e308) | same error | same error | (-1.7e308, 0, 1.7e308) (ratio 2.917, 3 cells; R's `hist(x, breaks = 3)` gives the same breaks) |
| (1, 2, 2, 3, 3, 3, 4, 10, 11.5) | (0, 2, ..., 12) | same | same |
| (1e300, 2e300, 2e300, 5e300) | (1, 2, 3, 4, 5)e300 | same | same |
| (1.7, 1.6, 1.5, 1, 0.9)e308 | (5e307, 1.1e308, 1.7e308) | same | same |

## Fix

- `src/descriptive/hist.ts` (`classCount`, FD): the computation of r and h moved into a local function of the data and the rounded data, called again on the scaled data where r or h is not finite. The range computed at the top of `classCount` (used only by FD) is gone.
- Docs: the row for `hist(..., breaks = "Scott")` added in #230 now also names `breaks = "FD"` (English and Japanese).

## Tests

- `test/issue231.test.ts`: the three overflowing cases (breaks equal to those of the count from R's ratio on the scaled data, also via the name "Freedman-Diaconis"), and the unchanged breaks (values before the fix, equal to R's). With src stashed the first test fails.

## Out of scope

- `hist([0, 1, Number.MAX_VALUE], { breaks: "FD" })` is still the error "invalid number of 'breaks'": the rounding to 5 significant digits (`round5`, `Number(v.toPrecision(5))`) turns `Number.MAX_VALUE` into 1.7977e308 = Infinity, while R's `signif(.Machine$double.xmax, 5)` is 1.7976e+308 and R returns the breaks (0, 1.797693e308). A separate defect of `round5`, not of the overflowing range; not reported, not changed.
- The counts of the histograms above are still wrong at this commit (the counting fuzz, #258).

## close comment

Fixed in <commit of #231, see git log --grep='#231'>: where the range or the Freedman-Diaconis width of finite data overflows, `hist` now takes both from the data (rounded to 5 digits first) divided by a power of 2, as for Scott's rule (#230). `hist([-1e308, 1e308], { breaks: "FD" })` now has breaks (-1e308, 0, 1e308) (two suggested cells, ratio 1.26) instead of the error "invalid number of 'breaks'" (R 4.5.2 gives the same error, recorded in docs/differences-from-r.md). Counts where the range and width are finite are unchanged. Test: test/issue231.test.ts. (Not pushed yet.)
