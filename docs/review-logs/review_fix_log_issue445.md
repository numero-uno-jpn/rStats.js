# Issue #445 log: pivotWider, the type of the valuesFn results

GitHub Issue #445. Session 13, group B (user decision). Same root as #437 (the type of a pivotWider output column) and fixed in the same commit; the plan, the fill side and the shared tests are in `review_fix_log_issue437.md`.

## Plan

- User decision (2026-11-03): match tidyr. The results of `valuesFn` for one value column, over all its new columns, take one common type (numbers absorb booleans, strings combine with neither); `valuesFill` is then cast to it (#437).
- Intent: the results went into the cells as returned, so `true` and `2` gave the mixed column `[true, 2]`. tidyr combines the summaries with `list_unchop` (a common type) before it fills.

## Check (main `393186a`, tidyr 1.3.2 on R 4.5.2)

`d2 <- data.frame(id = c("a", "b"), name = c("x", "x"), value = c(1, 2))`, `pivot_wider(d2, values_fn = f)`:

| f returns | before | after = tidyr |
|---|---|---|
| TRUE, 2 | `[true, 2]` | x 1 2 (double) |
| "a", 2 | `["a", 2]` | error "Can't combine \`x[[1]]\` \<character\> and \`x[[2]]\` \<double\>." |
| TRUE, "b" | `[true, "b"]` | error "Can't combine \`x[[1]]\` \<logical\> and \`x[[2]]\` \<character\>." |
| NaN (NA), TRUE / null, 2 | `[NaN, true]` / unchanged | NaN 1 / NaN 2 |
| TRUE, FALSE | unchanged | TRUE FALSE |
| TRUE in column x, 2 in column y (names x, y) | `x [true, null]` | x 1 NA, y NA 2: one type over all new columns |
| `x > 1` with fill 0 / 5 | `[false, 0]` / `[false, 5]` | x FALSE FALSE, y FALSE TRUE / error (loss of precision) |

The cell numbers in the error are tidyr's: the cells in order of first appearance in the data, the first being the one that set the type (a boolean followed by a number: the number). Checked with `id = c("b", "a")` (`x[[1]]` \<character\> and `x[[2]]` \<double\>) and with TRUE, 2, "s" (`x[[2]]` \<double\> and `x[[3]]` \<character\>). tidyr's message always says `x`, whatever the column.

## Fix

See `review_fix_log_issue437.md`: `src/descriptive/pivot.ts`, `pivotWider` computes the summaries of each value column in order of first appearance of the cell, finds their common type, and turns booleans into 0 and 1 when the type is double. `valuesFn` is now called in that order (before: by new column, then by row).

## Tests

- `test/issue445.test.ts`: the cases of the table and the cell numbers of the error. With `src/` stashed, all 3 tests fail. Other tests: see the #437 log.

## Out of scope (recorded)

- None beyond the #437 log.

## close comment

Fixed in <commit of #445, see git log --grep='#445'> (together with #437). The `valuesFn` results of one value column now take one common type over all its new columns, as tidyr: `true` and `2` give `[1, 2]` (a numeric column) instead of `[true, 2]`, and a string mixed with a number or a boolean is tidyr's error "Can't combine `x[[1]]` <character> and `x[[2]]` <double>." (tidyr 1.3.2 on R 4.5.2: the same, including the cell numbers). `valuesFill` is then cast to that type (#437). A test has been added. (Not pushed yet.)
