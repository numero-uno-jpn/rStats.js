# Fix log: eigen of graded matrices beyond 2^256 (no issue number)

Found while checking #129 (recorded out of scope in review_fix_log_issue129.md) and left for a decision in review_fix_log_issue131.md, since bringing matrices down to 2^256 (#131) did not fix it. User decision (2026-11-03): option A, eigen alone brings a large matrix down to 2^459.

## Plan

- Intent: eigen([[1, 1e200], [1e-200, 2]]) gave 2, 1 (R and the truth: 2.618034, 0.381966). Dividing the matrix by the power of 2 of its largest entry put 1e-200 at 0, and the matrix became triangular before the balancing (gebal) could equalise it. With the 2^256 target of #131 it is subnormal instead (a few bits), and the values became 2.60897, 0.39103.
- Method: eigen calls `decompositionExponent(data, 459)`: a matrix beyond 2^459 is brought down to 2^459, LAPACK dgeev's bound, so entries down to 2^-1481 of the largest stay normal. svd and schur keep 2^256 (schur changed bits in 371 of 1500 random matrices at 2^459 in the overnight trial; eigen did not).
- [[0, 1e200], [1e-200, 0]] also gave zero eigenvectors at either target. Cause: gebak scales the first component of the eigenvector of the balanced matrix by 7.65e199, and `normalizeVectors` summed the squares directly (Inf), so every component was divided by Inf. Where the sum of squares is not in [2^-1022, Inf), the norm is now taken relative to the largest modulus. Elsewhere the sum is as before (same bits). This is the overflow #129 described; its example did not reach it, this matrix does.

## Check (HEAD `9de95ea`, R 4.5.2)

| Matrix | R 4.5.2 | Before (2^256, #131) | After |
|---|---|---|---|
| [1, 1e200; 1e-200, 2] | 2.618034, 0.381966; vectors (1, 1.618034e-200), (-1, 6.18034e-201) | 2.60897030279115, 0.39102969720884984 | 2.618033988749895, 0.3819660112501051; (1, 1.6180339887498954e-200), (1, -6.1803398874989476e-201) |
| [0, 1e200; 1e-200, 0] | 1, -1; (1, 1e-200), (-1, 1e-200) | 0.98986, -0.98986, zero vectors | 1, -1; (1, 9.999999999999998e-201), (1, -1e-200) |
| [1, 1e300; 1e-300, 2] | 2, 1 (wrong) | 2, 1 | 2, 1 (ratio 1e-600 is beyond one scale, as in R) |

The values agree with R (eigenvector signs differ, as allowed), so docs only update the description of the scaling (the Algorithms note, English and ja).

### Sweeps

- Same sweep as #131 (scratchpad `la3.ts`: 4200 random matrices at scales 2^-1060 to 2^1015, 18 calls, 75600 results): identical to HEAD in every result.
- Graded matrices 2^E D A D^-1 with D = diag(2^d_i) (scratchpad `le3.ts`, `le4.ts`, 3000 each), eigenvalues compared with 2^E eigen(A):
  - spreads of d up to 600: identical to HEAD in all 3000 results.
  - spreads 500 to 900: 226 results differ from HEAD; in all of them the result before was wrong (223, error > 1e-10 of the largest modulus) or an error "did not converge" (3). After: 181 of those are right; the 46 still wrong all have spread 800 or 900 (entry ratios up to 2^1600, beyond 2^-1481). No eigenvector is off unit length after (4 before).

## Change

- `src/linalg/matrix.ts`: `decompositionExponent(data, top = 256)`.
- `src/linalg/eigen.ts`: eigen passes 459; `normalizeVectors` falls back to the scaled sum of squares where the plain one is not in [2^-1022, Inf).
- docs/differences-from-r.md and docs/ja/differences-from-r.md: the Algorithms note on the scaling.

## Tests

- `test/eigenScaling.test.ts`: the two matrices above (values exact, vector components within 1e-14), [1, 1e300; 1e-300, 2] stays 2, 1 as R, and bits of other matrices (values of the implementation before the change: [[1, 2], [3, 4]], [1, 1e100; 1e-100, 2], a 3 x 3 near 1e300). With src stashed, 2 of 4 fail.
- Full `npx vitest run`: 272 files, 2559 passed / 38 skipped, 0 failed. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- schur does not balance (as R's Matrix::Schur, dgees with permutation only): `schur([[1, 1e100], [1e-100, 2]])` gives 1, 2.
- `eigen([[0, 1], [1, 0]])` (symmetric path) gives -0.9999999999999998 for -1; unchanged by this fix, not compared with R here.
