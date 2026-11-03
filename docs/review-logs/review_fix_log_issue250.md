# Issue #250 log: rcond with an invalid uplo

GitHub Issue #250. Session 11, group A1 (input checks).

## Plan

- Intent: with `triangular: true`, `rcond` compared `uplo` with `"U"` only, so any other value (`"X"`, `"u"`, `"Upper"`) silently used the lower triangle. On the issue's matrix that is the identity, so the estimate was 1 instead of 9.8e-5.
- Method: as R's `switch(uplo, U = ..., L = ..., stop("'uplo' must be \"U\" or \"L\""))`: in the square triangular branch, `uplo` (default `"U"`) must be exactly `"U"` or `"L"`, otherwise a RangeError with R's message.
- Where R does not look at `uplo`, neither does rStats.js: without `triangular`, and for a non-square matrix (R calls itself on the R factor of the QR decomposition with `uplo = "U"`). So the check is in the triangular branch, after the non-square branch, as in R.
- Expected effect: `"U"`, `"L"` and the default keep their bits.

## Check (main `1d790f9`; R 4.5.2)

`m <- matrix(c(1, 0, 100, 1), 2)` (the issue's matrix):

| call | R 4.5.2 | Before | After |
|---|---|---|---|
| `rcond(m, triangular = TRUE, uplo = "X")` | error `'uplo' must be "U" or "L"` | 1 | the same error |
| `uplo = "u"`, `""`, `"Upper"` | the same error | 1 | the same error |
| `uplo = "U"` / default | 0x1.9b2a7c9fe8b62p-14 | the same bits | the same bits |
| `uplo = "L"` (also `norm = "I"`) | 1 | 1 | 1 |
| `rcond(m, uplo = "X")` (not triangular) | 0x1.9b2a7c9fe8b62p-14 | the same | the same |
| `rcond(matrix(1:6, 2), triangular = TRUE, uplo = "X")` | 0.04438608 | 0.04438608 | the same (uplo not used) |

Non-string values: R's `switch` with the number 1 picks the first case (`"U"`), and `NA` returns NULL; rStats.js throws the RangeError for any value other than the two strings (`null` and `undefined` mean the default `"U"`, as for the other options). Not a difference worth a docs entry: these are not valid arguments of R's documented interface.

## Fix

- `src/linalg/solve.ts`: the check in the triangular branch of `rcond`; the option's doc comment says so.
- No docs change (the results are R's).

## Out of scope

- The non-square example differs from R by 8 ulp (rStats.js 0x1.6b9c5a863e1f4p-5, R 0x1.6b9c5a863e1ecp-5): from the QR factor, not from `uplo`, and not changed here.

## Tests

- `test/issue250.test.ts`: the invalid values throw R's message; `"U"`, `"L"`, the default keep R's values; `uplo` is not used without `triangular` or for a non-square matrix. With src stashed the first test fails.
- Full `npx vitest run`: 295 files passed (2647 tests, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #250, see git log --grep='#250'>: with `triangular: true`, `rcond` now accepts only `uplo: "U"` or `"L"` for a square matrix, and anything else (the issue's `"X"`, also `"u"` or `"Upper"`) throws R's error `'uplo' must be "U" or "L"`. Before, every value other than `"U"` used the lower triangle (the issue's example gave 1). As in R, `uplo` is still not used without `triangular` or for a non-square matrix (which uses the R factor of its QR decomposition). Test: test/issue250.test.ts. (Not pushed yet.)
