# Issue #261 log: omega with one variable

GitHub Issue #261. Session 11, group A1 (input checks).

## Plan

- Intent: `omega` checked only `nfactors <= number of variables`, so one variable with `nfactors: 1` ran through minres and Schmid-Leiman and returned `omegaLim` Infinity (`null` in JSON), `alpha` NaN and `omegaTot` 0. Reliability of a single item is not defined.
- Method: after the correlation matrix is built (from the data or `covmat`), throw a RangeError when it has fewer than 2 variables, before the `nfactors` check. This follows the policy "meaningless input is an error", and psych::omega also stops on one variable.
- Why 2 is the bound: psych::omega returns values for 2 variables, and rStats.js returns the same values (below), so only p < 2 changes.
- Expected effect: every input with 2 or more variables keeps its bits.

## Check (main `daaf057`; R 4.5.2, psych)

| call | psych::omega | Before | After |
|---|---|---|---|
| `omega([[1], [2], [3]], { nfactors: 1 })` | error `'x' must be an array of at least two dimensions` | omegaH 1e-30, omegaLim Infinity, alpha NaN, omegaTot 0 | RangeError `omega needs at least 2 variables (got 1)` |
| `omega(null, { covmat: [[1]], nfactors: 1 })` | the same error | the same values | the same RangeError |
| `omega([[1], [2], [3]])` (nfactors 3) | the same error | RangeError on nfactors (3) > 1 | the RangeError on the number of variables |
| covmat `[[1, 0.5], [0.5, 1]]`, nfactors 1 | omega_h 0x1.5555555555554p-1, omega.lim 0x1.ffffffffffffep-1, alpha 0x1.5555555555555p-1, omega.tot 0x1.5555555555555p-1 | 0.6666666666666664, 0.9999999999999998, 0.6666666666666666, 0.6666666666666665 | unchanged |

## Fix

- `src/descriptive/omega.ts`: the check `p < 2` in `omega`; the doc of `x` says "At least 2 variables".
- No docs change (psych also stops).

## Out of scope

- For 2 variables, `omegaH` and `omegaTot` are 1 ulp below psych's (0x1.5555555555553p-1 against 0x1.5555555555554p-1, and 0x1.5555555555554p-1 against 0x1.5555555555555p-1); `omegaLim` and `alpha` are the same bits. Rounding in the factor solution, not changed here.

## Tests

- `test/issue261.test.ts`: one variable (data, covmat, default nfactors) throws; 2 variables keep the values from before the fix. With src stashed the first test fails.
- Full `npx vitest run`: 296 files passed (2649 tests, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #261, see git log --grep='#261'>: `omega` now throws a RangeError ("omega needs at least 2 variables") when the data or `covmat` has a single variable, instead of returning `omegaLim` Infinity, `alpha` NaN and `omegaTot` 0. psych::omega also stops on one variable ("'x' must be an array of at least two dimensions"). Inputs with 2 or more variables are unchanged (for 2 variables they agree with psych to 1 ulp). Test: test/issue261.test.ts. (Not pushed yet.)
