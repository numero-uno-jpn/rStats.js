# Issue #440 log: pivotWider with an empty namesFrom or valuesFrom

GitHub Issue #440. Session 13, group A2 (pivotWider's column selection, as tidyr).

## Plan

- Intent: `namesFrom: []` made one value column named `""`, and `valuesFrom: []` returned the id columns with no value column. tidyr rejects both ("Must select at least one item."); an empty selection has no meaning (policy: meaningless input is an error).
- Method: select `namesFrom`, then `valuesFrom`, each checked to exist and to be non-empty (tidyr's order), then `idCols`. An empty `idCols` stays allowed (one row), as tidyr.

## Check (main `0def6ac`, R 4.5.2, tidyr 1.3.2)

| call (`{ id: ["a","b"], name: ["x","y"], value: [1,2] }`) | before | after | tidyr |
|---|---|---|---|
| `namesFrom: []` | column `""` = [1, 2] | "`names_from` must select at least one column." | "Must select at least one item." |
| `valuesFrom: []` | `{ id, value }`, no value column | "`values_from` must select at least one column." | the same error |
| `namesFrom: [], valuesFrom: "zz"` | "Column `zz` doesn't exist." | the `names_from` error | the empty error (names_from first) |
| `namesFrom: "zz", valuesFrom: []` | "Column `zz` doesn't exist." | the same | "Column `zz` doesn't exist." |
| `idCols: []` | `{ x: [1], y: [2] }` | the same | the same |

The message names the argument (as pivotLonger's "`cols` must select at least one column."); tidyr's text has no argument name.

## Fix

- `src/descriptive/pivot.ts`, `pivotWider`: the selections of `namesFrom` and `valuesFrom` must not be empty; the existence checks in tidyr's order (names, values, ids). The option docs say "at least one".

## Tests

- `test/issue440.test.ts`: the errors above and the empty `idCols`. With `src/` stashed, the first fails.
- The pivot tests (`pivot`, `guide`, `issue39`, `issue255`, `issue256`, `issue436`) and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope

- None.

## close comment

Fixed in <commit of #440, see git log --grep='#440'>. pivotWider now rejects an empty `namesFrom` ("`names_from` must select at least one column.") and an empty `valuesFrom` (the same for `values_from`), as tidyr 1.3.2 ("Must select at least one item."), checking names_from before values_from as tidyr. Before, `namesFrom: []` made a column named "" and `valuesFrom: []` dropped the values. An empty `idCols` still gives one row, as tidyr. A test has been added. (Not pushed yet.)
