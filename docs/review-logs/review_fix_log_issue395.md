# Issue #395 log: inner products whose products underflow

GitHub Issue #395. Session 13, group B (user decision).

## Plan

- User decision (2026-11-03): take the exact inner product (`rescaledDot`, BigInt, from #208) also where |s| < 2^-969 and a product of nonzero factors fell below 2^-1022; at all 6 call sites (matMul, crossprod, tcrossprod, and the 3 inner products of lm and glm); skip the scan by the smallest nonzero |entry| of each column (the recommended option of the preparation).
- Intent: each 1e-162 * 1e-162 rounds to 0, the finite sum 0 did not enter the fallback, and `crossprod(rep(1e-162, 100))` was 0 for 1e-322 (R too).
- Why this condition: the additions are exact in the subnormal range, so only the products lose (up to 2^-1075 each). Above |s| = 2^-969 = 2^-1022 2^53 that loss is below the rounding of s. "s = 0" alone is not a usable condition: `crossprod(c(1e16, 1, -1e16), c(1, 1, 1))` cancels to 0 in the normal range (exactly 1), and its plain value (R's) must keep its bits. The minimum per column bounds every nonzero product from below, so the per-entry scan runs only where an underflow is possible; a sparse matrix (many s = 0) keeps its speed.

## Check (main `8ac623d`)

| call | R 4.5.2 | before | after | exact (rounded once) |
|---|---|---|---|---|
| `crossprod(rep(1e-162, 100))`, `tcrossprod`, `%*%` | 0x0p+0 | 0 | 1e-322 | 1e-322 |
| `crossprod(rep(1e-160, 3), rep(3e-161, 3))` | 0x1.c74p-1064 (8.997e-321) | 8.997e-321 | 9e-321 | 9e-321 |
| `predict` (lm, I3, y = 0.1) at x = (1e-321, 1e-321, 1e-321) | | 60 2^-1074 | 61 2^-1074 | 60.6 2^-1074 |
| `glmPredict` (poisson, I3, y = 1) at x = 2^-1040 (3 times) | | 3 2^-1074 | 2 2^-1074 | 2.41 2^-1074 |
| `crossprod(c(1e16, 1, -1e16), c(1, 1, 1))`, `crossprod(c(1, 1e-200), c(1, 1e-200))` | 0, 1 | 0, 1 | 0, 1 (unchanged) | |

R's lm `predict` for the 3e-161 row also gives 0x1.c74p-1064.

Speed (400 x 400, mean of 3, before / after): crossprod of the identity 204 / 204 ms, tcrossprod 213 / 206 ms, matMul 170 / 165 ms; a dense random matrix: crossprod 61 / 62 ms, matMul 151 / 148 ms.

## Fix

- `src/linalg/dot.ts`: `checkDot(s, minProduct)` (s not finite, or |s| < 2^-969 with the bound below 2^-1022) and `checkedDot(u, v, s)` (the exact inner product where s is not finite or a nonzero product underflowed; otherwise s).
- `src/linalg/basic.ts` (crossprod, tcrossprod: the smallest nonzero |entry| per column or row), `src/linalg/ops.ts` (matMul: per row of x and column of y), `src/models/lm.ts` (rows of weight 0, `predict`), `src/models/glm.ts` (`glmPredict` with new data): these single inner products pass 0 as the bound (always scanned when the sum is tiny).
- `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`: a row after the #174 row.

## Tests

- `test/issue395.test.ts`: the rows of the table. With `src/` stashed, 2 of 3 tests fail (the third is the unchanged cases).
- The 70-odd test files that use `crossprod`, `tcrossprod`, `matMul`, `predict`, `glmPredict` or weights (1292 tests, fixtures included): pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- `glmPredict` for gaussian (and other families fitted on the scaled response, `scaledView`) computes x'b in the scaled units and brings it back with `ldexp`, which rounds again when the result is subnormal (`ldexp` multiplies in two steps, so even twice): lm on I3 with y = 0.1 at x = 1e-321 gives 60 2^-1074 through glm (exact 60.6). A rounding of the scaling back of subnormal results, not of the inner product.
- The rows of weight 0 in lm enter `zeroWeightRows` only where the fitted value is not finite; the change there is inert for an underflow (the fitted value of the scaled fit already came out right in the case tried: 9e-321).

## close comment

Fixed in <commit of #395, see git log --grep='#395'>: the inner products of `matMul`, `crossprod`, `tcrossprod`, and of `predict` for lm and `glmPredict` with new data, now take the exact inner product of #208 (each product as an integer times a power of 2, summed in BigInt, rounded once) also where the plain sum is below 2^-969 in magnitude and a product of nonzero factors fell below 2^-1022. `crossprod(Array(100).fill(1e-162))` is now [[1e-322]] instead of [[0]]. Sums that cancel in the normal range keep their plain value (`crossprod([1e16, 1, -1e16], [1, 1, 1])` stays 0), other values keep their bits, and a precomputed smallest |entry| per column keeps the speed (a 400 x 400 identity unchanged). R 4.5.2 gives 0, so this is recorded in docs/differences-from-r.md.

Test: test/issue395.test.ts. (Not pushed yet.)
