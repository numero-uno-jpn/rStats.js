# Issue #256 log: pivotLonger colsVary and pivotWider namesVary with an invalid value

GitHub Issue #256. Session 11, group A2 (pivot checks).

## Plan

- Intent: `pivotLonger` compared `colsVary` and `pivotWider` compared `namesVary` with `"slowest"` only, so a typo (`"slwest"`) or any other value silently gave the fastest order.
- Method: a small helper `varyArg` checks the option at the start of each function, as tidyr's `arg_match`: exactly `"fastest"` or `"slowest"` (no prefixes, no other case; `arg_match` does not partially match), `undefined`/`null` mean the default `"fastest"` (as for the other options), a non-string is tidyr's "`cols_vary` must be a string or character vector.", and any other string tidyr's "`cols_vary` must be one of "fastest" or "slowest", not "slwest"." (tidyr's extra line "Did you mean ...?" is not given). Errors use tidyr's argument names, as the other errors in pivot.ts.
- Expected effect: `"fastest"`, `"slowest"` and the default keep their results.

## Check (main `b027aef`; R 4.5.2, tidyr 1.3.2)

| call | tidyr 1.3.2 | Before | After |
|---|---|---|---|
| `pivot_longer(d, c(a, b), cols_vary = "slwest")` | error `` `cols_vary` must be one of "fastest" or "slowest", not "slwest". `` (and "Did you mean "slowest"?") | fastest order | the same error (first line) |
| `cols_vary = "slow"` | the same error (no partial match) | fastest | the same error |
| `cols_vary = NA` | `` `cols_vary` must be a string or character vector. `` | fastest | (a number gives this error) |
| `pivot_wider(..., names_vary = "slwest")`, `"Slowest"` | `` `names_vary` must be one of ... `` | fastest | the same error |
| `names_vary = 1` | `` `names_vary` must be a string or character vector. `` | fastest | the same error |
| `cols_vary = "slowest"` / `"fastest"` on `d <- data.frame(id = 1:2, a = 10:11, b = 20:21)` | rows (1 a, 2 a, 1 b, 2 b) / (1 a, 1 b, 2 a, 2 b) | the same | the same |
| `names_vary = "slowest"` / `"fastest"` with two value columns | v1_a v2_a v1_b v2_b / v1_a v1_b v2_a v2_b | the same | the same |

## Fix

- `src/descriptive/pivot.ts`: `varyArg`, called at the start of `pivotLonger` and `pivotWider`; the doc comments of `colsVary` and `namesVary` say other values are an error.
- No docs change (the results are tidyr's).

## Tests

- `test/issue256.test.ts`: invalid strings and non-strings throw tidyr's messages in both functions; the two orders and the default keep tidyr's results. With src stashed the first test fails. `test/pivot.test.ts` passes.
- Full `npx vitest run`: 298 files passed (2653 tests, 38 skipped). `npx tsc --noEmit -p .`: no errors (after a type fix in the new test).

## close comment

Fixed in <commit of #256, see git log --grep='#256'>: `pivotLonger`'s `colsVary` and `pivotWider`'s `namesVary` are now checked as tidyr's `arg_match`: only `"fastest"` and `"slowest"` are accepted, and anything else, such as the issue's `"slwest"`, throws tidyr's error "`cols_vary` must be one of "fastest" or "slowest", not "slwest"." (`names_vary` for pivotWider; a non-string gives "must be a string or character vector."). Before, every other value silently gave the fastest order. tidyr 1.3.2 gives the same errors, and the valid orders are unchanged. Test: test/issue256.test.ts. (Not pushed yet.)
