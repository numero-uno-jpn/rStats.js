# Issue #310 log: cronbachAlpha with one subject

GitHub Issue #310. Session 12.

## Plan

- Intent: `cronbachAlpha` checked for 2 items but not for 2 subjects. With one row the sample covariances and correlations divide by n - 1 = 0, so every value is NaN.
- Method: a RangeError for fewer than 2 rows, after the check of the items (the item message stays first). Two or more rows take the old code (the same bits).

## Check (main `b0ace13`, R 4.5.2, psych)

| call | psych's `alpha` | before |
|---|---|---|
| `cronbachAlpha([[1, 2]])` (the issue's example) | error ("dim(X) must have a positive length", after warnings that the items have no variance) | rawAlpha, stdAlpha, G6, averageR and alphaDrop all NaN |

The issue expected a possible error from `solve`; there was none (the NaN matrix passes through).

## Fix

- `src/htest/agreement.ts`, `cronbachAlpha`: "'x' needs at least two subjects"; the parameter doc says so. No docs entry (psych stops with an error too).

## Tests

- `test/issue310.test.ts`: the error for one row (2 and 3 items), and the item check still first. With `src/` stashed, the first test fails.
- `test/agreement.test.ts`, `test/review48.test.ts`, `test/scaleInvarianceAll.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- With 2 or more rows, items with no variance still give NaN (psych drops them with a warning and here stops with the same error for `rbind(c(1, 2, 3), c(1, 2, 4))`). Not this issue.

## close comment

Fixed in <commit of #310, see git log --grep='#310'>. `cronbachAlpha` now throws a RangeError ("'x' needs at least two subjects") for a single row; before, every value was NaN (the sample covariances divide by n - 1 = 0). psych's `alpha` stops with an error for this input too. Two or more rows give the same values as before. (Not pushed yet.)
