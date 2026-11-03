# Issue #439 log: pivotWider with a column named twice in idCols, namesFrom or valuesFrom

GitHub Issue #439. Session 13, group A2 (pivotWider's column selection, as tidyr).

## Plan

- Intent: a name repeated in `idCols` gave "duplicate column name 'id'", in `namesFrom` the names `x_x`, in `valuesFrom` "duplicate column name 'value_x'". tidyr (tidyselect) selects a repeated column once.
- Method: remove repeats from the three selections, keeping the first place (`new Set`), as pivotLonger's `cols` already does. The issue names idCols; namesFrom and valuesFrom had the same cause and are included (triage).

## Check (main `01f8027`, R 4.5.2, tidyr 1.3.2)

| call (`{ id: ["a","b"], name: ["x","y"], value: [1,2] }`) | before | after | tidyr |
|---|---|---|---|
| `idCols: ["id","id"]` | "duplicate column name 'id'" | `{ id, x: [1, null], y: [null, 2] }` | the same as `id_cols = id` |
| `namesFrom: ["name","name"]` | columns `x_x`, `y_y` | `x`, `y` | `x`, `y` |
| `valuesFrom: ["value","value"]` | "duplicate column name 'value_x'" | `x`, `y` | `x`, `y` |
| `namesFrom: ["b","a","b"]` (a = p, q; b = r, s) | `r_p_r`, `s_q_s` | `r_p`, `s_q` | `r_p`, `s_q` |
| `idCols: ["k","id","k"]` | "duplicate column name 'k'" | columns `k`, `id`, `p`, `q` | the same |

## Fix

- `src/descriptive/pivot.ts`, `pivotWider`: the selections without repeats, in the order of first appearance.

## Tests

- `test/issue439.test.ts`: the calls above. With `src/` stashed, both fail.
- The pivot tests (`pivot`, `guide`, `issue39`, `issue255`, `issue256`, `issue436`, `issue440`) and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope

- None.

## close comment

Fixed in <commit of #439, see git log --grep='#439'>. pivotWider now selects a column named more than once in `idCols`, `namesFrom` or `valuesFrom` once, at its first place, as tidyselect in tidyr 1.3.2: `idCols: ["id", "id"]` gives the result of `idCols: "id"` instead of "duplicate column name 'id'", `namesFrom: ["name", "name"]` gives the columns x and y instead of x_x and y_y, and a repeated `valuesFrom` no longer fails. A test has been added. (Not pushed yet.)
