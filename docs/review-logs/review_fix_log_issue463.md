# Issue #463 log: lm and glm matrix forms, ragged rows hidden by missing values

GitHub Issue #463. Session 13, group A (#463, #465, #466).

## Plan

- Intent: the matrix forms of `lm` and `glm` dropped the rows with a missing value before checking that the rows have the same length, so a ragged matrix whose odd row had a missing value was fitted as a smaller rectangular matrix.
- Method: check the lengths of all the rows given, against the first row, right after the rows are read and before the mask of the rows kept (the messages are the existing ones: lm "all rows of the matrix must have the same length" as `toMat`, glm "all rows of x must have the same length"). The check in glm after the filter becomes redundant and is removed. This is the opposite direction to #455 (weights are checked on the rows kept, as R), without conflict: the shape is a property of the structure given, the weights are values R checks after dropping rows. An R matrix cannot be ragged, so there is no R value.

## Check (main `15b01bd`)

| call | before | after |
|---|---|---|
| `lm([[1], [2, NaN], [3]], [1, NaN, 3])` | coefficients 0, 1 | TypeError "all rows of the matrix must have the same length" |
| `glm([[1], [2, NaN], [3]], [1, NaN, 3])` | coefficients 0, 1 | TypeError "all rows of x must have the same length" |
| `lm([[1, 1], [NaN], [3, 2], [4, 7]], [1, 2, 3, 4])` | fitted | TypeError |
| `lm([[1], [2, 5], [3]], [1, 2, 3])` (complete, ragged) | TypeError | TypeError (unchanged) |

The issue's "control" (the same `x` with a complete `y`) also drops the second row, since its `x` has the NaN; the real control is a ragged matrix without missing values.

## Fix

- `src/models/lm.ts`, `lmMatrix`; `src/models/glm.ts`, `glm`: the row-length check before the missing-value mask.

## Tests

- `test/issue463.test.ts`: the ragged matrices with a dropped odd row (fail with `src/` stashed), the complete ragged matrix, and a rectangular row with NaN still dropped.
- `test/lm.test.ts`, `test/glm.test.ts`, `test/issue455.test.ts` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- The shape of the two-column response matrix of a binomial `glm` was not examined (not in the issue).

## close comment

Fixed in <commit of #463, see git log --grep='#463'>. The matrix forms of lm and glm now check that all the rows given have the same length before dropping the rows with a missing value: `lm([[1], [2, NaN], [3]], [1, NaN, 3])` is the TypeError "all rows of the matrix must have the same length" (glm: "all rows of x must have the same length") instead of coefficients 0, 1. (The issue's control with a complete `y` drops the same row, because its `x` has the NaN; a complete ragged matrix was already the error.) Rectangular rows with a missing value are still dropped as before. A test has been added. (Not pushed yet.)
