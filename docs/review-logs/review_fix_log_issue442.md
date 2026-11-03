# Issue #442 log: pivotLonger with an empty namesTo

GitHub Issue #442. Session 13, group A3 (pivotLonger and merge).

## Plan

- Intent: `nameParts` had a branch for one name only, so `namesTo: []` fell through to the check for several names and was an error with or without `namesSep` / `namesPattern`.
- Method: return no parts for each name when `namesTo` is empty, before any parsing, as tidyr's `build_longer_spec()` (its `n_names_to == 0` branch). Each selected column is then one key, so the result has one row per input row and column, and only the value column.

## Check (main `cf605f3`, R 4.5.2, tidyr 1.3.2)

| call | before | after | tidyr (`names_to = character(0)`) |
|---|---|---|---|
| `{ a_b: [1] }`, `namesPattern: "(a)_(b)"` | error (pattern has 2 groups) | `value: [1]` | `value 1` |
| `{ a_b: [1] }`, `namesSep: "_"` | error | `value: [1]` | `value 1` |
| `{ id: [1, 2], a_b: [1, 2], c_d: [3, 4] }`, no option | error ("you must also supply one of ...") | `id: 1 1 2 2`, `value: 1 3 2 4` | same |
| same, `valuesTo: "v"`, `colsVary: "slowest"` | error | `id: 1 2 1 2`, `v: 1 2 3 4` | same |

## Fix

- `src/descriptive/pivot.ts`, `nameParts`: an empty `namesTo` gives no parts, and `namesSep` / `namesPattern` are not used. The doc comment of `namesTo` says so.

## Tests

- `test/issue442.test.ts`: the four calls above. With `src/` stashed, both tests fail.
- `test/pivot.test.ts` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- tidyr also accepts a `names_transform` entry for a column that is not in `names_to` (with `names_to = character(0)`); rStats.js ignores unknown keys too. No change.

## close comment

Fixed in <commit of #442, see git log --grep='#442'>. pivotLonger with `namesTo: []` now makes no columns from the names and does not use `namesSep` or `namesPattern`, as tidyr's `build_longer_spec()`: `pivotLonger({ a_b: [1] }, { cols: ["a_b"], namesTo: [], namesPattern: "(a)_(b)" })` gives `{ value: [1] }` (tidyr 1.3.2: value 1) instead of an error, and the same without any parsing option (one row per input row and column). A test has been added. (Not pushed yet.)
