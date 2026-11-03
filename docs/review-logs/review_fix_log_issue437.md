# Issue #437 log: pivotWider, the type of valuesFill

GitHub Issue #437. Session 13, group B (user decision). Fixed together with #445 (same root: the type of a pivotWider output column); see `review_fix_log_issue445.md` for the valuesFn side.

## Plan

- User decision (2026-11-03): match tidyr. The cells of one value column after `valuesFn`, over all its new columns, take one common type, and `valuesFill` is cast to that type (option a of the prep).
- Intent: `columnOf` put the fill into the cells as given, so a numeric column with `valuesFill: "missing"` became the mixed array `[1, "missing"]`, and with `true` `[1, true]`. tidyr casts the fill with vctrs' `vec_cast` after the summary.
- Why this option: tidyr matches in all 20 cases of the prep, pivotLonger already uses the same type rule (`commonType`), and a mixed column is a meaningless result (policy: meaningless input is an error). No fixture case or existing test changes.

## Check (main `393186a`, tidyr 1.3.2 on R 4.5.2)

`d <- data.frame(id = c("a", "b"), name = c("x", "y"), value = ...)`, `pivot_wider(d, values_fill = ...)`:

| value column, fill | before | after = tidyr |
|---|---|---|
| numeric, `"missing"` | `[1, "missing"]` | error "Can't convert \`fill\` \<character\> to \<double\>." |
| numeric, `true` | `x [1, true]` | x 1 1, y 1 2 (Float64Array if the source is) |
| numeric, 0 / null / NaN | unchanged | unchanged |
| boolean, 0 / 1 | `[true, 0]` / `[true, 1]` | x TRUE FALSE, y FALSE FALSE / x TRUE TRUE, y TRUE FALSE |
| boolean, 2 or 0.5 | `[true, 2]` | error "Can't convert from \`fill\` \<double\> to \<logical\> due to loss of precision." |
| boolean, NaN | `[true, NaN]` | `[true, null]` (NA) |
| boolean, `"z"` | `[true, "z"]` | error (character to logical) |
| string, 0 / `true` | `["u", 0]` / `["u", true]` | error (double / logical to character) |
| string, null | `["u", null]` | unchanged |
| `valuesFrom: ["v1", "v2"]` (number, string), fill `{ v1: "-", v2: "-" }` or 0 | mixed columns | error |
| `valuesFn: length` on strings, fill `"z"` | `[1, "z"]` | error (tidyr: to \<integer\>; here \<double\>) |
| no valuesFn, value column `[1, true]` (JS only) | mixed | error "column 'value' mixes double and logical values" (as pivotLonger) |

## Fix

- `src/descriptive/pivot.ts`, `pivotWider`: after the "not uniquely identified" check (same error order as before), each value column gets its cells and type first: without `valuesFn` `columnType` of the column; with it, the summaries in order of first appearance of the cell (as tidyr's groups) and their common type (#445). `castFill` casts the fill (vctrs rules). A Float64Array source gives a Float64Array when the type is double (or none), as before. The JSDoc of `valuesFill` and `valuesFn` states the rule.
- `oracle/pivot-behaviour.md`: the type rules in pivotWider step 4.
- No entry in `docs/differences-from-r.md` (the results are tidyr's).

## Tests

- `test/issue437.test.ts` (this issue) and `test/issue445.test.ts`: the cases of the tables. With `src/` stashed, all 9 tests fail.
- `test/pivot.test.ts` (fixtures: 12 pivotWider cases, all numeric value columns, as arrays and as Float64Array), `guide`, `issue39`, `issue256`, `issue436`, `issue438`, `issue439`, `issue440`, `issue452`, `issue454`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- When every cell of a value column is missing, a JavaScript null has no type, so the fill is kept as given (`valuesFn: () => null, valuesFill: 0` gives 0). tidyr's NA is logical, so it gives FALSE (and fill 3 is an error). Unchanged from before; not in the docs.
- tidyr names an integer type for `length` (\<integer\>); JS numbers are double, so the error says \<double\>.

## close comment

Fixed in <commit of #437, see git log --grep='#437'> (together with #445). `valuesFill` is now cast to the type of its value column, as tidyr's `vec_cast`: a numeric column with `valuesFill: "missing"` is the error "Can't convert `fill` <character> to <double>." instead of `[1, "missing"]`; `valuesFill: true` gives 1 (the column stays numeric); in a boolean column 0 and 1 become false and true, NaN missing, and any other number is tidyr's "loss of precision" error; strings never mix with numbers or booleans (tidyr 1.3.2 on R 4.5.2: the same in every case checked). Tests have been added. (Not pushed yet.)
