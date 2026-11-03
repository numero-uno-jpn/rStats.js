# Issue #273 log: svd's nu and nv checked after the dimension cut

GitHub Issue #273. Session 12.

## Plan

- Intent: `svd` reduced `nu` and `nv` to the dimensions with `Math.min` before checking that they are non-negative integers, so whether a fraction or Infinity was accepted depended on the matrix shape.
- The issue asks for integers only; R accepts fractions (truncated) and Infinity. Put to the user (prep: r_accepts.md).
- User decision (2026-11-03): follow R. A non-negative value is truncated toward zero, then reduced to the dimension (Infinity is the dimension); negative values (-0.5 included) and NaN are errors. The same as the earlier as.integer-style decisions (#76 optim maxit, #93 r2dtable n).

## Check (main `e73cb78`, R 4.5.2; m3 = 3 x 2, m2 = 2 x 2; sizes of u and v)

| nu or nv | R | before | after |
|---|---|---|---|
| 1.5 | truncated to 1 (u 3x1) | error "nu must be a non-negative integer" | as R |
| 2.5 (nu, m3) | 2 (u 3x2) | error | as R |
| 2.5 (nu, m2) | 2 | accepted (min gives 2) | as R |
| 0.5, 1e-9 | 0 (no u) | error | as R |
| Inf | the dimension (nu: u 3x3, nv: v 2x2) | accepted | as R |
| -0.5, -1 | error "argument must be coercible to non-negative integer" | error | error "nu must be a non-negative number" |
| NaN, NA | error "missing value where TRUE/FALSE needed" | error | error "nu must be a non-negative number" |
| 3, 2147483648 | the dimension | the dimension | the same |

## Cause

`src/linalg/svd.ts`: `Math.min(options.nu ?? k, a.nrow)` ran before `Number.isInteger`, so an oversized fraction or Infinity became the integer dimension.

## Fix

- `src/linalg/svd.ts`, `svdScaled`: NaN or a negative value is a RangeError; otherwise `Math.min(Math.trunc(v), dim)`. The doc comments of `nu` and `nv` say so. The decomposition is the same for the same truncated counts; svd.json uses integer nu and nv only (no change). No docs entry (the behavior is R's).

## Tests

- `test/issue273.test.ts`: the sizes in the table, the errors for -0.5, -1, -Infinity and NaN on both shapes, and the same result as the truncated counts. With `src/` stashed all three fail.
- `svd`, `errors`, `issue131`, `issue56`, `linalg-invariants` tests pass.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #273, see git log --grep='#273'>. `nu` and `nv` are now checked before they are reduced to the dimensions, so the result no longer depends on the matrix shape. Following R (`seq_len`), a non-negative value is truncated toward zero and then reduced to the row or column count (`nu: 1.5` gives one vector, `nv: Infinity` all of them), while negative values (including -0.5) and NaN throw "nu must be a non-negative number". Integer requests are unchanged. (Not pushed yet.)
