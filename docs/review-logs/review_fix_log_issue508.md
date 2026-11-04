# Issue #508 log: aovEz scaled the response by an id it later removed

GitHub Issue #508. Session 15, group A1. Fixed: `aovEz` chose the power of 2 that scales the response from all rows, including the ids it then removes as incomplete; an extreme response of such an id pushed the kept responses into the subnormals and the table came out with MSE 0 and F, ges, p NaN.

## Plan

- Intent: the scale should come from the data that are analysed.
- Method: find the ids removed in step 6 (a within cell without rows, or a missing response) before the scaling, from the cells seen per id and the NaN responses, and take the exponent k of `scaleToUnit` from the rows of the kept ids only; scale all rows by 2^-k with `ldexp`. Step 6 uses the set found earlier.
- Why: the condition is the same as before (the old check looked for a cell count of 0 or a NaN sum; a sum of the scaled kept responses cannot overflow, so it is NaN only from a NaN response). k is a power of 2, so where no id is removed, or the removed ids do not set the scale, every value keeps its bits. A removed id's scaled responses may now overflow, but they are never used.

## Reproduction (main `53ee5d7`, R 4.5.2, afex)

Data: ids s1, s2, s3 with W = a, b and y = (1, 2), (2, 4), (3, 5); id "incomplete" with y = 1e308 (a) and null (b).

| | afex `aov_ez` | rStats.js before | after |
|---|---|---|---|
| MSE | 0.16667 | 0 | 0.16666666666666666 |
| F | 25 | NaN | 25.000000000000004 |
| ges | 0.38462 | NaN | 0.3846153846153847 |
| Pr(>F) | 0.03775 | NaN | 0.03774955135062373 |

afex gives the same values with and without the incomplete id; rStats.js now gives the same table as without it.

## Fix

- `src/models/aovEz.ts`: the removed ids are found after step 4; `dvExp` is `scaleToUnit` of the kept rows; the length check of step 1 uses the unscaled response. No docs change (afex gives the same value).

## Tests

- `test/issue508.test.ts`: the issue's data give the same table as without the incomplete id (to the bit) and afex's values; the warning about the removed id is kept. With `src/` stashed it fails (MSE 0, NaN).
- `test/aovEz.test.ts` (afex fixtures), `etaSquaredRm`, `guide`, `issue295`, `issue296`, `numberLevels`, `review34`, `review42`, `scaleInvariance`, `scaleInvarianceAll`, `scaleInvarianceModels` pass.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #508, see git log --grep='#508'>. aovEz now takes the power-of-2 scale of the response from the ids it keeps: the ids removed as incomplete are found first, so a removed id with response 1e308 no longer scales the others into the subnormals. The issue's example gives MSE 0.16667, F 25, ges 0.38462, p 0.03775, as afex's aov_ez and as the same data without the incomplete id (before: MSE 0 and NaN). Data with no removed id keep their values. A test was added: test/issue508.test.ts. (Not pushed yet.)
