# Issue #356 log: jacobian with a changing output length

GitHub Issue #356. Session 12, group A2.

## Plan

- Intent: `jacobian` takes the number of rows from `func(x)` and indexes the shifted evaluations without checking their lengths. A shorter result gives NaN entries, a longer one is cut silently.
- Method: every shifted evaluation must return as many values as `func(x)`; otherwise a RangeError. numDeriv also stops with an error, so this is not a difference from R. Results for a constant length are untouched (same bits).

## Check (main `513d6f0`)

| call | R numDeriv 2016.8-1.1 | before | after |
|---|---|---|---|
| `f = x[1] == 1 ? [1] : []`, Richardson and simple | error "replacement has length zero" | `[[NaN]]` | RangeError "func returned 0 values at a shifted x, but 1 at x" |
| `g = x[1] == 1 ? [1] : [x[1], 99]`, Richardson and simple | error "number of items to replace is not a multiple of replacement length" | `[[0.99999999999671]]` (second value dropped) | RangeError "func returned 2 values at a shifted x, but 1 at x" |

## Fix

- `src/numerics/deriv.ts`, `jacobian`: the shifted evaluations go through a length check against `f0`.

## Tests

- `test/issue356.test.ts`: both cases for both methods, and a constant-length case. With `src/` stashed, the two rejection tests fail.
- `test/numerics.test.ts`, `test/issue213.test.ts`, `test/issue246.test.ts` pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- None.

## close comment

Fixed in <commit of #356, see git log --grep='#356'>: `jacobian` now checks that every shifted evaluation of `func` returns as many values as `func(x)`, and throws a RangeError otherwise ("func returned 0 values at a shifted x, but 1 at x"). The issue's shorter case returned `[[NaN]]` and the longer one dropped the extra value; numDeriv stops with an error in both. Results for functions with a constant output length are unchanged.

Test: test/issue356.test.ts. (Not pushed yet.)
