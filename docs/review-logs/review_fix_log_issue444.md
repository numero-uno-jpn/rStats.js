# Issue #444 log: pivotLonger's namesTransform and the ".value" part

GitHub Issue #444. Session 13, group A3 (pivotLonger and merge).

## Plan

- Intent: the loop that applies `namesTransform` skipped the `".value"` part, so a transform given for `".value"` was never called and the value columns kept the parsed names.
- Method: apply the own transform of `".value"` to each parsed `.value` part before grouping the columns by value-column name, as tidyr's `build_longer_spec()` (it transforms every column of the names table). The lookup of own transforms (#436) is shared by both places. A transform must return strings (tidyr: "`spec$.value` must be a character vector"). Names that give one value column twice for one key stay an error (tidyr makes a row for each); this difference was there before for `namesPattern` and is now in the docs.

## Check (main `6e1696d`, R 4.5.2, tidyr 1.3.2)

| call (`namesTo: [".value", "group"]`, `namesSep: "_"`) | before | after | tidyr |
|---|---|---|---|
| `{ mean_x: [1], sd_x: [2] }`, `.value: toUpperCase` | columns `group`, `mean`, `sd` | `group: ["x"]`, `MEAN: [1]`, `SD: [2]` | `group x, MEAN 1, SD 2` |
| `{ mean_x: [1], MEAN_x: [2] }`, `.value: toUpperCase` | columns `mean`, `MEAN` | error "the names give the value column 'MEAN' twice for one key" | two rows of group x, MEAN 1 and 2 |
| `{ mean_x: [1], sd_x: [2] }`, `.value: (x) => x.length` | columns `mean`, `sd` | error "the transform of `.value` must give strings, not number" | error "`spec$.value` must be a character vector, not an integer vector." |
| `{ id: [1, 2], mean_x1: [1, 2], mean_x2: [3, 4] }`, `namesPattern: "(mean)_(x)\\d"`, no transform | error "twice for one key" (unchanged) | same | four rows, group x |

## Fix

- `src/descriptive/pivot.ts`, `pivotLonger`: the `.value` part goes through its own transform (`ownTransform`, shared with the other parts); a missing part is not transformed; a result that is not a string or null is an error. The doc comment of `namesTransform` says so.
- `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`: the error for one `.value` column given twice for one key (tidyr makes a row for each).

## Tests

- `test/issue444.test.ts`: the transformed names, the error after the transform, the error for a number. With `src/` stashed, all three fail.
- `test/pivot.test.ts`, `test/issue436.test.ts`, `test/issue442.test.ts` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- A `.value` transform that returns NA: tidyr drops that value column; rStats.js names it "NA", as a missing `.value` part. Not changed.

## close comment

Fixed in <commit of #444, see git log --grep='#444'>. pivotLonger now applies `namesTransform[".value"]` to the `.value` part before naming the value columns, as tidyr's `build_longer_spec()`: with `namesTo: [".value", "group"]`, `namesSep: "_"` and `toUpperCase`, `{ mean_x: [1], sd_x: [2] }` gives columns `group`, `MEAN`, `SD` (tidyr 1.3.2: the same). The transform must return strings (tidyr also stops). Names that give one value column twice for one key after the transform are still an error; tidyr makes a row for each, and docs/differences-from-r.md now says so. A test has been added. (Not pushed yet.)
