# Issue #214 log: hessian where the squared step overflows

GitHub Issue #214. Session 11, group A5 (overflowing differences in the numerical methods).

## Plan

- Intent: `hessian` divides the second difference by `h ** 2` (diagonal) and the cross difference by `2 * hi * hj`, less `diag * h ** 2` terms (off-diagonal). For steps beyond about 1.34e154 these overflow although the curvature is representable: the diagonal quotient becomes 0, the off-diagonal one NaN (Inf - Inf).
- Method: only where `h ** 2` is not finite, divide the difference by h twice; for the off-diagonal entry, only where `2 hi hj`, `hi ** 2` or `hj ** 2` is not finite, divide every term by `hi hj` first: `(num / hi / hj - D_i (hi / hj) - D_j (hj / hi)) / 2`.
- Why this form: it is the same quotient with the scaling moved into the terms; where the denominators are finite the old expression is used, so the bits do not change.

## Check (main `172c6bc`; R 4.5.2 with numDeriv)

The issue's function `x[0] * x[0] / 1e200` itself overflows at x - h = -2e154 (the square is 4e308), so its result is NaN from the function, not from the denominator. With a function that does not overflow, `q(v) = (v / 1e100)^2`, at x = 1e100 and d = 2e54 (h = 2e154):

| call | numDeriv | Before | After | Exact |
|---|---|---|---|---|
| `hessian(q(x1), 1e100, d = 2e54)` (r = 4) | 2.000705e-200 | 2.000705467372134e-200 | 2.0000000000000003e-200 | 2e-200 |
| the same, r = 1 | error "subscript out of bounds" | 0 | 2.0000000000000003e-200 | 2e-200 |
| `q(x1) + x1/1e100 * x2/1e100` at (1e100, 1e100) | diagonal 2.000705e-200, 0; off-diagonal NaN | the same | 2.0000000000000003e-200, 0; 1.0000000000000001e-200 | 2e-200, 0; 1e-200 |
| d = 2e53 (h² finite) | | 1.9999999999999997e-200 | the same bits | |

## Fix

- `src/numerics/deriv.ts` (`hessian`): the two fallbacks above.
- `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`: a row after the `ode` row (#211).

## Tests

- `test/issue214.test.ts`: the diagonal (r = 1 and 4) and the off-diagonal entries within 1e-14 of the exact values; values with finite squared steps keep the old bits. With src stashed the two overflow tests fail.
- The test files that mention `hessian`: 79 passed. Full run and tsc: see the log of #216.

## Out of scope

- A step whose square falls below the normal range (h below about 1.5e-154, only with a user's tiny `eps` or `d`) loses precision in `h ** 2` the same way, but the second difference itself (about f'' h²) then also underflows, so dividing differently would not recover the curvature. Not changed.

## close comment

Fixed in <commit of #214, see git log --grep='#214'>: where the squared step overflows (h beyond about 1.34e154), `hessian` now divides the second difference by h twice, and for the off-diagonal entries divides every term by h_i h_j before combining them. Note that the issue's function `x[0] * x[0] / 1e200` itself overflows at x - h (the square is 4e308), so that call stays NaN from the function; with `(x[0] / 1e100) ** 2` at 1e100 and d = 2e54 the diagonal is now 2e-200 within 1 ulp (it was 0 for r = 1 and 2.0007e-200 for r = 4, numDeriv the same) and an off-diagonal 1e-200 is no longer NaN. Steps whose square is finite are unchanged. Documented in docs/differences-from-r.md.

Test: test/issue214.test.ts. (Not pushed yet.)
