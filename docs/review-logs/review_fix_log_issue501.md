# Issue #501 log: merge with only rows from y keeps y's key type

GitHub Issue #501. Session 14, judging of the issues classified C. Verdict: not planned (the expected result is not R's; rStats.js does as R). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2.
- Why: classified C (the branch for results with only rows from y follows R deliberately: the user's decision in #82 and its implementation in #449).

## Check (main `10323ab`, R 4.5.2)

- `merge({id: ["unmatched-x"]}, {id: [1], value: ["from-y"]}, {by: "id", allY: true})`: `{id: [1], value: ["from-y"]}` (numeric key).
- R: `merge(data.frame(id = "unmatched-x"), data.frame(id = 1, value = "from-y"), by = "id", all.y = TRUE)` has `id: num 1`. R builds the result from x's rows (none) bound with y's rows, so the key keeps y's type. The same.
- With rows from x as well (`allX: true, allY: true`): `{id: ["1", "unmatched-x"], value: ["from-y", null]}`; R (`all = TRUE`) `id: chr "1" "unmatched-x"`. The same.

## Fix

- None.

## Tests

- `test/issue501.test.ts`: the issue's call keeps the numeric key, and with `allX` the key is text, as R.

## Out of scope (recorded)

- `oracle/dataframes-behaviour.md` line 40 says the result's key column has "the common type when rows only in y are kept (`all.y`)". That holds when the result also has rows from x; with only rows from y the key has y's type (R's rbind of an empty x part), as the comment in `src/descriptive/dataFrames.ts` (#449) says. The wording is imprecise; the issue read it literally. Not changed here.

## close comment

Not planned: rStats.js does as R here. In R 4.5.2, merge(data.frame(id = "unmatched-x"), data.frame(id = 1, value = "from-y"), by = "id", all.y = TRUE) gives id as numeric 1: the result binds x's matched rows (none) with y's rows, so the key keeps y's type, and it becomes text only when rows from x are also present (all = TRUE gives "1", "unmatched-x"). rStats.js returns the same in both cases (#449). The sentence in oracle/dataframes-behaviour.md that suggested otherwise is imprecise and is recorded in the log. Added test/issue501.test.ts. (Not pushed yet.)
