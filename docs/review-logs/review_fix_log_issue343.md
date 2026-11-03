# Issue #343 log: lu of a matrix with NaN or Inf

GitHub Issue #343. Session 12.

## Plan

- Intent: `lu` returned factors with NaN or Inf for a matrix with a non-finite entry, as if the decomposition had succeeded; `svd`, `qr`, `eigen`, `schur` and `expm` throw "the matrix contains NaN or infinite values".
- The factors are bit-identical to `Matrix::lu` (LAPACK's dgetrf), so an error differs from R; put to the user (prep: nonfinite_lin.md).
- User decision (2026-11-03): a matrix with NaN or ±Inf is a RangeError with the same message as svd; the difference from `Matrix::lu` goes in the docs.

## Check (main `7255164`, R 4.5.2, `Matrix::expand(Matrix::lu(x))`)

| matrix (rows) | Matrix::lu U | before | after |
|---|---|---|---|
| [[1, Inf], [0, 1]] | [[1, Inf], [0, NaN]] | the same | RangeError |
| [[Inf, 2], [1, 3]] | [[Inf, 2], [0, 3]], L21 = 0; P L U has NaN where x has 1 | the same | RangeError |
| [[1, 2], [NaN, 3]], [[1, 3], [2, NaN]] | NaN in L or U | the same | RangeError |
| finite (lu.json, 9 cases) | | | unchanged |

## Fix

- `src/linalg/lu.ts`: each row is checked while the working copy is made; a non-finite entry is a RangeError. The doc comment says so. The NaN rule of the pivot search is kept: a finite matrix can still produce Inf and NaN by overflow in the updates.
- Docs (en, ja), Linear algebra under Deliberate differences: `lu` throws where `Matrix::lu` returns factors.

## Tests

- `test/issue343.test.ts`: the four matrices above throw (fail with `src/` stashed); the doc example is unchanged.
- `matrix-ops` (lu.json), `jstat-replacement`, `thresholds` tests pass.

## Out of scope (recorded)

- `chol(crossprod(A))` with Inf or NaN in A: R stops with "the leading minor of order k is not positive"; rStats.js returns factors with NaN or Inf (from the prep notes, not checked further).

## close comment

Fixed in <commit of #343, see git log --grep='#343'>. `lu` now throws "the matrix contains NaN or infinite values" for a matrix with NaN or ±Inf, as `svd`, `qr` and `eigen` do. Before, it returned factors with NaN (bit-identical to `Matrix::lu`), which need not give back the matrix: for [[Inf, 2], [1, 3]], P L U has NaN where the matrix has 1. The difference from `Matrix::lu` is recorded in docs/differences-from-r.md. Finite matrices are unchanged. (Not pushed yet.)
