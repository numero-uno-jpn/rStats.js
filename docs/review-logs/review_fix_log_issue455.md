# Issue #455 log: lm's matrix form, negative weights and dropped rows

GitHub Issue #455. Session 13, group A4 (model formulas and lm).

## Plan

- Intent: the matrix form of `lm` checked every weight for a negative value before dropping the rows with a missing value, so a negative weight on a row dropped for a missing x or y was the error "missing or negative weights not allowed". R (and the formula form of rStats.js) drops the rows first and checks the weights kept.
- Method: build the mask of the rows kept first, then check the weights of those rows. The check of a complete row is unchanged.

## Check (main `6255b4a`, R 4.5.2)

| call | before | after | R |
|---|---|---|---|
| `lm([[1],[2],[4],[NaN]], [2, 3, 5, 9], { weights: [1, 2, 1, -1] })` | error | coefficients 1, 1 | `lm(c(2,3,5,9) ~ c(1,2,4,NA), weights = c(1,2,1,-1))`: `0x1p+0 0x1p+0` (also with x a one-column matrix) |
| `lm([1, 2, 4, 8], [2, 3, 5, NaN], { weights: [1, 2, 1, -1] })` | error | 1, 1 | `0x1p+0 0x1p+0` |
| `lm([[1], [NaN]], [2, NaN], { weights: [1, -1] })` | error | 2, NaN | `0x1p+1 NA` |
| `lm([1, 2, 4, 8], [2, 3, 5, 9], { weights: [1, 2, 1, -1] })` | error | error (unchanged) | "missing or negative weights not allowed" |

## Fix

- `src/models/lm.ts`, `lmMatrix`: the negative-weight check runs on the weights of the rows kept.

## Tests

- `test/issue455.test.ts`: the rows dropped for a missing x, y or weight, the one-row fit, and the error on a complete row. With `src/` stashed, the first test fails.
- `test/lm.test.ts` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- The triage note gave coefficients (1, 1) for the issue's two-row example; R gives (2, NA) (one row kept). The test uses R's value.

## close comment

Fixed in <commit of #455, see git log --grep='#455'>. The matrix form of lm now drops the rows with a missing x, y or weight before it checks for negative weights, as R and the formula form: `lm([[1],[2],[4],[NaN]], [2, 3, 5, 9], { weights: [1, 2, 1, -1] })` gives coefficients 1, 1 (R 4.5.2: the same) instead of "missing or negative weights not allowed", and the issue's example gives 2, NaN (R: 2, NA). A negative weight on a complete row is still the error. A test has been added. (Not pushed yet.)
