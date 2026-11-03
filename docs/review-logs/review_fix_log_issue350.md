# Issue #350 log: anova / car's Anova scale taken from rows of weight 0

GitHub Issue #350. Session 12, group A6 (lm and anova weights).

## Plan

- Intent: `responseScale()` (`src/models/anovaSequential.ts`), used by `anova` (sequential and comparisons) and car's `Anova`, chose the power of 2 k from the fitted values and residuals of every row. A residual of 1e308 in a row of weight 0 (not in the fit) set k near 1023, so the sums of squares of the other rows underflowed to 0.
- Method: take k from the rows of positive weight only. k is a power of 2, so where the old k already came from a used row the result is the same bits; only fits with weight-0 rows dominating the scale change.

## Reproduction (main `9469dcd`, R 4.5.2)

`lm("y ~ x", { y: [1, 2, 4, 3, 1e308], x: [0, 1, 2, 3, 4] }, { weights: [1, 1, 1, 1, 0] })`

| call | R | before | after |
|---|---|---|---|
| `anova` | error "missing value where TRUE/FALSE needed" | SS 0 and 0, F NaN | SS 3.1999999999999997 and 1.8, F 3.5555555555555554, p 0.2 (the four-row fit, the same bits) |
| `Anova` (type 2) | car: NaN throughout | error "residual sum of squares is 0" | 3.2, 1.8, F 3.555555555555556 (the four-row fit) |

R on the first four rows: SS 3.2 and 1.8, F 3.5556, p 0.2.

## Fix

- `src/models/anovaSequential.ts`: `responseScale` filters out rows with `weights[i] === 0`.
- docs (en, ja): a row in "Where R fails and rStats.js returns a value".

## Tests

- `test/issue350.test.ts`: `anova` and `Anova` (types 2 and 3) equal the tables of the four-row fit. Fail with `src/` stashed.
- The 33 test files that call `anova`, `Anova`, `aovSummary` or effect sizes: pass.

## Out of scope

- None.

## close comment

Fixed in <commit of #350, see git log --grep='#350'>: the response scale of `anova` and car's `Anova` is now taken from the rows of positive weight only. With a response of 1e308 in a row of weight 0, the tables are those of the fit without that row (Sum Sq 3.2 and 1.8, F 3.56, p 0.2); before, the sums of squares underflowed to 0 (`anova`) or `Anova` threw "residual sum of squares is 0". R's `anova` errors there and car's `Anova` gives NaN (recorded in docs/differences-from-r.md). Fits without weight-0 rows are unchanged. Test: test/issue350.test.ts. (Not pushed yet.)
