# Issue #191 log: rcond where the norm of the inverse overflows

GitHub Issue #191. Session 11, group A6 (linear algebra).

## Plan

- Intent: `gecon` (and `trcon`) return 0 whenever the lacn2 estimate of the norm of the inverse is not finite. For `diag(1, 1e-310)` the norm of the inverse (1e310) overflows while the reciprocal condition number 1e-310 is representable, so `rcond` gives 0 for a nonsingular matrix.
- First attempt (rejected): multiply the triangular factor U by 2^k so that the norm of the inverse shrinks. The products `U_ij x_j` in the substitution do not change under that scaling (U grows by 2^k, x shrinks by 2^-k), so `[[1, 2], [3e, 4e]]` with e = 2^-1030 still overflowed in `x_1 -= U_12 x_2` and gave 0.
- Method: lacn2 is homogeneous in the operator, so the estimate is repeated for 2^-m A^-1: every vector is multiplied by 2^-m (exact) before each solve, and the reciprocal condition number is scaled back by 2^-m at the end (`ldexp`, one rounding into the subnormal range). With the matrix norm in [2^e, 2^(e + 1)), m = 563 - e keeps the scaled inverse norm at most 2^512 for any reciprocal condition number of at least 2^-1075, and the intermediate products far from overflow. If the repeated estimate overflows again (overflow in the factorisation, or a value below the doubles), the result is 0 as before.
- Trigger: not only a non-finite estimate but any non-finite vector after a solve. While checking I found that the overflow can leave a finite but wrong estimate: a 3 x 3 matrix with its last row times 2^-1040 gave rcond 0.282 (the true value is about 0.407 x 2^-1040; LAPACK's `dgecon`, scaling in `dlatrs`, gives 0 in R). The final alternating-sign step of lacn2 returned the estimate of the unit-vector step after NaN comparisons.
- Also `trcon` (`rcond(..., triangular = TRUE)` and non-square matrices through R of the QR), which had the same `return 0`. The order of the final divisions of each (`1 / ainvnm / anorm` for gecon, `1 / anorm / ainvnm` for trcon) is kept, so values without overflow keep their bits.
- R gives 0 (R 4.5.2: `rcond(diag(c(1, 1e-310)))` is `0x0p+0`, also with norm "I"), so the new value is recorded in docs/differences-from-r.md and docs/ja, and the note on `dlatrs` is extended.

## Check (main `41ede52` for the before values)

| call | R 4.5.2 | Before | After | Exact |
|---|---|---|---|---|
| `rcond(diag(c(1, 1e-310)))` (also norm "I", triangular "U"/"L", with a zero row added) | 0 | 0 | 1e-310 (the bits of 1e-310) | 1e-310 |
| `rcond([[1, 2], [3e, 4e]])`, e = 2^-1000 | 2^-1000 / 3 | 2^-1000 / 3 | (no overflow, unchanged) | 2^-1000 / 3 |
| the same, e = 2^-1030 (also "I") | 0 | 0 | 2^-1030 / 3 (`0x55555555555` in the subnormal range) | 2^-1030 / 3 |
| `rcond([[1, 2], [0, 2^-1060]], triangular)` | | 0 | 2^-1060 / 6 | 2^-1060 / 6 |
| `[[4, 3, 2], [1, 5, 2], 2^-1040 [2, 1, 6]]`, "O" / "I" | 0 / 0 | 0.282 / 0 | 2^-1040 x 0.40740740741603 / 0.57516339869471 | the same matrix at 2^-40: 0.40740740740736 / 0.57516339869247 (subnormal resolution about 1e-10) |
| `solve(diag(1, 1e-310), c(1, 1))` | computationally singular, rcond 0 | rcond 0 | rcond 1.00000e-310 (still an error with the default tol) | |
| `rcond(diag(c(1e200, 1e-200)))` | 0 | 0 | 0 (1e-400 is below the doubles) | |
| matrices whose estimate does not overflow (`[[1, 2], [3, 4]]`, near-singular `[[1, 1], [1, 1 + 2^-52]]`, triangular, non-square) | | | the same bits | |

## Fix

- `src/linalg/solve.ts`: `gecon` and `trcon` call a shared `condition(n, reciprocal, anorm, solve)`, which runs lacn2 as before and, only where a solve gave a non-finite vector, repeats it with the vectors divided by 2^m and scales the result back.

## Tests

- `test/issue191.test.ts`: the issue's matrix (all norms and the triangular and non-square paths), the exact 2 x 2 and triangular values where the substitution overflows, the 3 x 3 case that gave 0.282, `solve`'s message and a solve with `tol = 1e-320`, and unchanged bits where nothing overflows. With `src/linalg/solve.ts` stashed four of the five tests fail.
- `npx vitest run` (with #206 and this fix): 319 files passed (2710 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- `kappa` (`src/linalg/kappa.ts`) does not use these estimators; `kappa(diag(1, 1e-310))` is Infinity, which is right (1e310 overflows).

## close comment

Fixed in <commit of #191, see git log --grep='#191'>: where a solve in the condition estimate overflows, `rcond` now repeats the estimate with every vector divided by a power of 2 (the estimator is homogeneous, so this estimates 2^-m times the norm of the inverse), and scales the reciprocal condition number back once at the end. `rcond([[1, 0], [0, 1e-310]])` is now 1e-310 (it was 0, as in R), also with norm "I", `triangular: true` and for non-square matrices, and `solve`'s check reports that value. The check also catches an overflow that left a finite but wrong estimate (a 3 x 3 matrix with a row near 2^-1040 gave 0.282 instead of about 3.5e-314). Only 0 is returned where the repeated estimate overflows too. Estimates without overflow are unchanged.

Test: test/issue191.test.ts. (Not pushed yet.)
