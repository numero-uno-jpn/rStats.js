# Issue #379 log: distSummary for pois lambda = 0 and nbinom size = 0

GitHub Issue #379. Session 12, group B3 (distSummary). Also the pending item of the 45th review log (distSummary pois lambda = 0).

## Plan

- User decision (2026-11-03): pois lambda = 0 and nbinom size = 0 (with prob or with mu) are the point mass at 0: mean, variance, sd, median and mode 0, skewness and kurtosis NaN (as binom size 0, geom prob 1 and the other point masses).
- Intent: distSummary returned NaN throughout for these, although dpois/ppois/qpois and dnbinom/pnbinom/qnbinom (rStats.js and R alike) treat them as the point mass at 0, and R's documentation says so.
- Method: an early return before the existing checks. For nbinom, size = 0 is decided before p = size / (size + mu) is formed (0 for mu > 0, 0/0 for mu = 0); it is the point mass where prob is in (0, 1] or mu is finite and >= 0, NaN otherwise (dnbinom with prob = 0 is NaN in R too). Positive parameters do not reach the new code.

## Check (main `c2d8ac6`)

| call | before | after |
|---|---|---|
| `pois(lambda 0)` | NaN throughout | {0, 0, 0, 0, 0, NaN, NaN} |
| `nbinom(size 0, prob 0.5)`, `(size 0, mu 5)`, `(size 0, mu 0)` | NaN throughout | the same point mass |
| `nbinom(size 0, prob 0)`, `(size 0, mu -1)`, `(size 0, mu Infinity)`, `pois(lambda -1)` | NaN | NaN |

R 4.5.2 (from the prep notes): dpois(0, 0) = 1, ppois(0, 0) = 1, qpois(0.5, 0) = 0; dnbinom(0, 0, 0.5) = 1, qnbinom(0.5, 0, 0.5) = 0; dnbinom(0, size = 0, mu = 5) = 1; dnbinom(0, 0, prob = 0) = NaN. rStats.js gives the same. distSummary is not an R function; no docs entry.

## Fix

- `src/distributions/summary.ts`: a constant `POINT_AT_0`; `case "pois"` returns it for lambda = 0, `case "nbinom"` for size = 0 with a valid prob or mu.

## Tests

- `test/issue379.test.ts`: the point masses (fail with `src/` stashed), invalid parameters still NaN, a positive lambda unchanged.
- The distSummary test files and `npx tsc --noEmit -p .` pass.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #379, see git log --grep='#379'>. distSummary now returns the point mass at 0 for pois with lambda = 0 and nbinom with size = 0 (with a prob in (0, 1] or a finite mu >= 0): mean, variance, sd, median and mode 0, skewness and kurtosis NaN, as for binom size 0 and the other point masses, and in agreement with dpois/qpois and dnbinom/qnbinom (R the same). Invalid parameters still give NaN, and positive parameters are unchanged. (Not pushed yet.)
