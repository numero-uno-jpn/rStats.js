# Issue #505 log: merge's numeric key text keeps no trailing zeros

GitHub Issue #505. Session 15, judging of the issues classified C. Verdict: not planned (does not reproduce; rStats.js does as R). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2.
- Why: classified C. `numberText` (`src/descriptive/dataFrames.ts`) formats `Number(x.toPrecision(15)).toExponential()`: `Number()` drops the trailing zeros of `toPrecision(15)` before the digits are taken, so 1 becomes "1", not "1.00000000000000". The issue traced `toPrecision(15)` alone.

## Check (main `53ee5d7`, R 4.5.2)

| Call | R 4.5.2 | rStats.js |
|---|---|---|
| `merge({id: [1], x: [10]}, {id: ["1"], y: [20]})` | 1 row, id num 1, x 10, y 20 | `{id: [1], x: [10], y: [20]}` |
| the same with 1.5 and "1.5" | 1 row, id num 1.5 | `{id: [1.5], x: [10], y: [20]}` |
| two keys (`id`, `k`) with 1 and "1" | 1 row | 1 row |
| 1e5 against "1e+05"; 0.1 + 0.2 against "0.3"; 123456.7 against "123456.7" | 1 row each | 1 row each |

The issue expected `id: ["1"]`; R keeps x's numeric key in the matched rows (the user's decision in #82), as rStats.js does.

## Fix

- None.

## Tests

- `test/issue505.test.ts`: the issue's call, 1.5, two keys and 1e5 against "1e+05" each give one matched row with the numeric key, as R.

## Out of scope (recorded)

- None.

## close comment

Not planned: this does not reproduce. merge({id: [1], x: [10]}, {id: ["1"], y: [20]}) gives one matched row, {id: [1], x: [10], y: [20]}, as R 4.5.2's merge (id num 1); 1.5 against "1.5", two keys, 1e5 against "1e+05" and 0.1 + 0.2 against "0.3" also match, as in R. numberText formats Number(x.toPrecision(15)).toExponential(): Number() drops the trailing zeros of toPrecision(15) before the digits are taken, so 1 is "1". The matched key keeps x's numeric type, as R (not "1"). Added test/issue505.test.ts. (Not pushed yet.)
