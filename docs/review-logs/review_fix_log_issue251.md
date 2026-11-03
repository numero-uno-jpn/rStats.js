# Issue #251 log: rcond with triangular: true on a non-square matrix

GitHub Issue #251. Session 11, judging of the issues classified C. Verdict: not planned (the claim is wrong: a non-square matrix never reaches the triangular estimator, as in R). No code changed; a test added.

## Plan

- Intent: check the claim that `rcond(x, { triangular: true })` passes a rectangular matrix to `trcon` and ignores columns.
- Method: read the order of the branches in `rcond` (src/linalg/solve.ts); run the issue's 2x3 example, its transpose and the 2x2 part in rStats.js and R 4.5.2.
- Why: the issue traced the code statically.

## Check (main `1eb9b0a`, R 4.5.2)

`rcond` tests `A.nrow !== A.ncol` first and, for a non-square matrix, returns the estimate on the triangular factor R of the QR decomposition (of the transpose if wide); the `triangular` branch comes after and is reached only for a square matrix. This is R's order: `rcond()` with a non-square x calls `qr.R(qr(x))` (of t(x) if wide) whatever `triangular` is.

| Call | R 4.5.2 | rStats.js |
|---|---|---|
| `rcond(A)`, A = [[1, 0, 100], [0, 1, 0]] | 0x1.47a9e2d196518p-7 (0.009999500037496875) | 0.009999500037496877 |
| `rcond(A, triangular = TRUE, uplo = "U")` (the issue) | the same 0x1.47a9e2d196518p-7 | 0.009999500037496877 |
| `rcond(A, triangular = TRUE, uplo = "L")` | the same | 0.009999500037496877 |
| `rcond(t(A), triangular = TRUE)` | the same | 0.009999500037496877 |
| `rcond([[1, 0], [0, 1]], triangular = TRUE)` (the first two columns only) | 1 | 1 |

The third column is used (with it the estimate is 0.01, without it 1). The value differs from R's by 2 ulp (relative 2e-16), from the rounding of the QR factor.

## Fix

- None (not planned).

## Tests

- `test/issue251.test.ts`: the 2x3 example gives the same value with and without `triangular` and either `uplo` (within 1e-15 of R's), the 3x2 transpose too, and the 2x2 part gives 1.

## close comment

Not planned: a non-square matrix does not reach the triangular estimator. rcond checks whether the matrix is square first and, if not, estimates on the triangular factor R of its QR decomposition (of the transpose for a wide matrix); the triangular option is looked at only for a square matrix. This is also R's order: R's rcond uses qr.R(qr(x)) for a non-square x whatever triangular is. For the issue's [[1, 0, 100], [0, 1, 0]], R 4.5.2 gives 0.0099995 (0x1.47a9e2d196518p-7) with and without triangular = TRUE and for either uplo, and rcond gives 0.009999500037496877 in every case (2 ulp from R's); the third column is used, since the 2x2 part alone gives 1. A test was added: test/issue251.test.ts. (Not pushed yet.)
