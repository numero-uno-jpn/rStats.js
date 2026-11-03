# Issue #330 log: pretty with an invalid shrinkSml

GitHub Issue #330. Session 12.

## Plan

- Intent: `pretty` did not check `shrinkSml`, `highUBias` or `u5Bias`. R's `.Internal(pretty)` rejects a shrink.sml that is not finite and positive and biases that are not finite and non-negative, before computing.
- Method: the same three checks, with R's messages, after the checks of n and min.n (R's order). Valid arguments take the old code (the same bits).

## Check (main `869e1f2`, R 4.5.2)

| call | R | before |
|---|---|---|
| `pretty([0, 0], { shrinkSml: 0 })` (the issue's example) | error "invalid 'shrink.sml' argument" | `[-2e-314, 0]` (the cell is raised to the floor 2^-20 DBL_MIN, so it did not loop) |
| `pretty([0, 0], { shrinkSml: NaN })` | same error | did not end (stopped by `timeout` after 20 s) |
| `shrinkSml` -1, Infinity; `[1, 5]` with shrinkSml 0 | same error | break points |
| `highUBias` / `u5Bias` -1, NaN, Infinity | "invalid 'high.u.bias' argument" / "invalid 'u5.bias' argument" | break points (NaN gave 41 and 21 points for `[1, 5]`) |
| `highUBias: 0`, `u5Bias: 0`, `shrinkSml` 0.5 and 0.25 | values | the same values (unchanged) |

The issue's trace is not quite right (a cell of 0 is raised to the floor), but a NaN shrinkSml makes the unit NaN and `while (!Number.isFinite(s * u)) s++` never ends.

## Fix

- `src/descriptive/hist.ts`, `pretty`: the checks of `shrinkSml`, `highUBias` and `u5Bias`; the option docs say so.

## Tests

- `test/issue330.test.ts`: the errors for invalid values and R's values for valid ones. With `src/` stashed (the NaN shrinkSml test left out with `-t`, as it did not end), the error test fails.
- `test/pretty.test.ts`: passes.

## Out of scope (recorded)

- `pretty([0, 0], { shrinkSml: 1e-300 })` gives `[-1e-300, 0]`; R gives -0x1.56e1fc2f8f355p-997 (4 ulps from 1e-300, with shrink.sml the exact double 1e-300). Likely the power of ten in R's C code (pow on Windows); not checked further.
- A node process from the run of the old code with `shrinkSml: NaN` (`npx tsx`, stopped by `timeout`) was left running (PID 50148).

## close comment

Fixed in <commit of #330, see git log --grep='#330'>. `pretty` now checks `shrinkSml` (finite and positive), `highUBias` and `u5Bias` (finite and non-negative) with R's messages ("invalid 'shrink.sml' argument" and so on). The example with `shrinkSml: 0` returned `[-2e-314, 0]` rather than looping (the cell is raised to a floor), but a NaN `shrinkSml` did loop; both are errors now, as in R. Valid arguments give the same values as before. (Not pushed yet.)
