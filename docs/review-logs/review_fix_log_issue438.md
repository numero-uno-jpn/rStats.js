# Issue #438 log: pivotWider with idCols overlapping namesFrom or valuesFrom

GitHub Issue #438. Session 13, group A2 (pivotWider's column selection, as tidyr).

## Plan

- Intent: a given `idCols` was only checked to exist, so a column could both identify the rows and be pivoted (`idCols: ["value"]` kept `value` as an id column and filled `x`, `y` from it). tidyr rejects this; the selection contradicts itself (policy: meaningless input is an error).
- Method: after the existence check of `idCols` (and after the repeats are removed, #439), the first id column that is in `namesFrom` (checked first) or `valuesFrom` is an error with tidyr's message. The default `idCols` already leaves those columns out.

## Check (main `1b827bb`, R 4.5.2, tidyr 1.3.2)

| call (`{ id: ["a","b"], name: ["x","y"], value: [1,2] }`) | before | after (and tidyr) |
|---|---|---|
| `idCols: ["value"]` | `{ value, x, y }` | "`id_cols` can't select a column already selected by `values_from`." + column `value` |
| `idCols: ["name"]`, `["id","name"]` | `{ name, x, y }` | the same for `names_from`, column `name` |
| `idCols: ["value","name"]` | `{ value, name, x, y }` | `values_from`, column `value` (the first id column) |
| `idCols: "name"`, `namesFrom: "name"`, `valuesFrom: "name"` | a result | `names_from` |
| `idCols: ["zz","value"]` | "Column `zz` doesn't exist." | the same (the missing column first) |

tidyr's message has two lines ("ℹ Column `value` has already been selected."); here they are one sentence each on one line.

## Fix

- `src/descriptive/pivot.ts`, `pivotWider`: the overlap check; the `idCols` doc says it.

## Tests

- `test/issue438.test.ts`: the calls above and a disjoint `idCols`. With `src/` stashed, the first fails.
- The pivot tests (`pivot`, `guide`, `issue39`, `issue255`, `issue256`, `issue436`, `issue439`, `issue440`) and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope

- None.

## close comment

Fixed in <commit of #438, see git log --grep='#438'>. pivotWider now rejects an `idCols` column that is also in `namesFrom` or `valuesFrom`, with tidyr's message: `idCols: ["value"]` is "`id_cols` can't select a column already selected by `values_from`. Column `value` has already been selected." (and the same for `names_from`), as tidyr 1.3.2, instead of returning a result that both keeps and pivots the column. A missing column is still reported first. A test has been added. (Not pushed yet.)
