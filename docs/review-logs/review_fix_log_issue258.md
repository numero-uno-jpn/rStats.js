# Issue #258 log: hist's counting fuzz overflows for finite data spanning both signs

GitHub Issue #258. Session 11, group A4 (hist: #228, #230, #231, #258, #259).

## Plan

- Intent: with at most 3 breaks, `hist` moves the breaks by tau = 1e-7 (max(x) - min(x)) before counting (R's `diddle`). For finite data such as (-1e308, 1e308) the range overflows, tau is Infinity, the middle break moves to Infinity and every value is counted in the first cell: `hist([-1e308, 1e308], { breaks: [-1e308, 0, 1e308] }).counts` is (2, 0) instead of (1, 1).
- Method: the fuzz is now computed by one helper `fuzz(br, lo, hi)` (it replaces `fuzzScale`, which returned the reference size). In the at-most-3-breaks branch, where hi - lo is Infinity, tau = 2 (1e-7 (hi / 2 - lo / 2)) (the halving is exact for a range this large, and the doubling is exact).
- Why: where the range is finite, and in the other branches (median or smallest width, which cannot overflow all together), tau is the same expression as before, so the counts are unchanged. Half the range times 1e-7 is the true fuzz up to one rounding, like R's.

## Check (main after #231; R 4.5.2)

| call | R 4.5.2 | Before | After | R with x and breaks times 2^-1024 |
|---|---|---|---|---|
| `hist([-1e308, 1e308], breaks [-1e308, 0, 1e308])` counts | (2, 0) | (2, 0) | (1, 1) | (1, 1) |
| `hist([-1e308, 0, 1e308], breaks [-1e308, 0, 1e308])` | | (3, 0) | (2, 1) | (2, 1) |
| same, `right: false` | | (0, 3) | (1, 2) | (1, 2) |
| `hist([-1e308, 1e308], breaks "Scott")` (breaks of #230) | error | (2, 0) | (1, 1) | |
| `hist([-1.7e308, -1e308, 0, 1e308, 1.7e308], breaks "FD")` (breaks (-1.7e308, 0, 1.7e308)) | error | (5, 0) | (3, 2) | (3, 2) |
| the same data, breaks [-1.7e308, 1.7e308] | | (5) | (5) | |
| `hist([0, 1, 1, 2], breaks [0, 1, 2])`, also `right: false` | | (3, 1), (1, 3) | same | |
| `hist([-1e300, 0, 1e300, 1e300], breaks [-1e300, 0, 1e300])` | | (2, 2) | same | |

## Fix

- `src/descriptive/hist.ts`: `fuzz` (above) in place of `fuzzScale`.
- Docs: a row for `hist(...)$counts` in "Where R fails and rStats.js returns a value" (English and Japanese).

## Tests

- `test/issue258.test.ts`: the overflowing cases against R's counts on the scaled data (and the Scott and FD breaks of #230 and #231), and the unchanged counts (values before the fix). With src stashed the first test fails.

## Out of scope

- A moved break can still round to Infinity when it lies within about tau of `Number.MAX_VALUE` (for example a last break at `Number.MAX_VALUE` plus a tau of 1e301). For the last break this is harmless (the data are finite); an interior break that close to the largest double would need a later break beyond it, so it does not arise with increasing finite breaks except within rounding. Not changed.

## close comment

Fixed in <commit of #258, see git log --grep='#258'>: where the range of finite data overflows and there are at most 3 breaks, `hist` now computes the counting fuzz from half the range and doubles it, instead of 1e-7 times an infinite range. `hist([-1e308, 1e308], { breaks: [-1e308, 0, 1e308] }).counts` is (1, 1) (was (2, 0); R 4.5.2 also gives (2, 0), recorded in docs/differences-from-r.md). Counts where the data range is finite are unchanged. Test: test/issue258.test.ts. (Not pushed yet.)
