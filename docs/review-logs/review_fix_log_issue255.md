# Issue #255 log: pivotLonger with one namesTo and the wrong number of capture groups

GitHub Issue #255. Session 11, group A2 (pivot checks).

## Plan

- Intent: with one `namesTo` column, `nameParts` took `re.exec(name)?.[1]` without counting the capture groups, so a pattern without a group gave `null` for every name, and a pattern with two groups silently used the first. With two or more `namesTo` columns, `captures` already checked the count with tidyr's message.
- Method: use `captures(names, namesPattern, 1)` for one column too. It counts the groups (`new RegExp(pattern + "|").exec("")`, which also handles non-capturing groups) and throws tidyr's "`regex` should define 1 groups; N found."; with one group its result is the same as before (`m[1] ?? null`, `null` when the name does not match).
- Expected effect: patterns with exactly one capture group keep their results.

## Check (main `7fadfcc`; R 4.5.2, tidyr 1.3.2)

`d <- data.frame(id = 1, x1 = 10, x2 = 20)`, `pivot_longer(d, c(x1, x2), names_to = "time", names_pattern = p)`:

| p | tidyr 1.3.2 | Before | After |
|---|---|---|---|
| `"x[0-9]+"` | error `` `regex` should define 1 groups; 0 found. `` | time null, null | the same error |
| `"(x)([0-9]+)"` | error `...; 2 found.` | time "x", "x" (first group) | the same error |
| `"x([0-9]+)"` | time "1", "2" | the same | the same |
| `"(?:x)([0-9]+)"` | time "1", "2" | the same | the same |
| `"x(1)"` | time "1", NA | "1", null | the same |

## Fix

- `src/descriptive/pivot.ts`: `nameParts` calls `captures` with a count of 1 for one `namesTo` column.
- No docs change (the results are tidyr's).

## Tests

- `test/issue255.test.ts`: 0 and 2 groups throw tidyr's message; one group, a non-capturing group and a name that does not match keep their results. With src stashed the first test fails. `test/pivot.test.ts` passes.
- Full `npx vitest run`: 297 files passed (2651 tests, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #255, see git log --grep='#255'>: with a single `namesTo` column, `pivotLonger` now requires `namesPattern` to have exactly one capture group, as with several columns and as tidyr: the issue's `"x[0-9]+"` throws "`regex` should define 1 groups; 0 found." and `"(x)([0-9]+)"` "...; 2 found." (tidyr 1.3.2 gives the same errors). Before, they gave `null` parts and the first group only. Patterns with one group are unchanged. Test: test/issue255.test.ts. (Not pushed yet.)
