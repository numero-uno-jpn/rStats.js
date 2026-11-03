# Issue #449 log: merge's key column and Float64Array

GitHub Issue #449. Session 13, group A3 (pivotLonger and merge).

## Plan

- Intent: `merge` built each key column with `gather([cx, cy], ...)`, which keeps a Float64Array only when every listed source is one. With x's key a Float64Array and y's an array, the key became an array even when every value came from x.
- Method: list only the columns the values come from: x's key, and y's key only when rows only in y are kept (y's alone when every row is only in y). Storage only; the values are unchanged.

## Check (main `e0e34a7`, R 4.5.2)

| call (`x = { id: Float64Array [1, 2], x: ["a", "b"] }`) | before | after | R `merge` |
|---|---|---|---|
| `y = { id: [2, 1], y: [20, 10] }` | `id` an array [1, 2] | Float64Array [1, 2] | id 1 2, y 10 20 |
| same, `allY: true` | an array | Float64Array | same |
| `y = { id: [2, 1, 3], ... }`, `allY: true` (a row only in y) | an array [1, 2, 3] | an array (unchanged) | id 1 2 3 |

## Fix

- `src/descriptive/dataFrames.ts`, `merge`: the sources of each key column are the columns its values come from.

## Tests

- `test/issue449.test.ts`: the three calls. With `src/` stashed, the first test fails.
- `test/dataFrames.test.ts`, `test/issue82.test.ts` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- `rbindFrames` also lists every frame's column, so a frame with no rows and an array column makes the result an array. Not part of this issue; not changed.

## close comment

Fixed in <commit of #449, see git log --grep='#449'>. merge now decides whether a key column is a Float64Array from the columns its values come from: with x's key a Float64Array and y's an array, `merge({ id: new Float64Array([1, 2]), x: ["a", "b"] }, { id: [2, 1], y: [20, 10] })` (also with `allY: true` and no row only in y) gives `id` as a Float64Array [1, 2]. Rows only in y still bring y's column in. The values are unchanged (R: id 1 2). A test has been added. (Not pushed yet.)
