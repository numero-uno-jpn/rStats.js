# Revision of review 13: qr with tol = Inf

## Plan
- Intent: `qr(x, { tol: Infinity })` returned rank 0, against criterion K1 (a non-finite tolerance is an error) and
  R, which stops.
- Decision: D15 (session 14, `prep/errors.md` question 1, recommended option (a)).
- Form: the existing tol check of the LINPACK path becomes `tol >= 0 && tol < Infinity`. Finite tolerances are
  unchanged (1e300 still gives rank 0, as R). The LAPACK path ignores tol, as R.

## Original decision
- Review 13 (`review_fix_log_20261031_13.md`): "`qr(tol = Inf)` | error | rank 0 | the mathematically correct side
  (user decision): rank 0 kept, recorded in the docs".

## Gap with the current criteria
- K1: non-finite tolerances are errors (as `integrate`, `optimize`, `uniroot`).

## Reproduction (R 4.5.2)
| call | R | rStats.js before | now |
|---|---|---|---|
| `qr(matrix(1:4, 2), tol = Inf)` | "NA/NaN/Inf in foreign function call (arg 5)" | rank 0 | RangeError "'tol' must be a non-negative finite number" |
| `qr.solve(matrix(1:4, 2), c(1, 2), tol = Inf)` | same error | solved with rank 0 | RangeError |
| `tol = 1e300` | rank 0 | 0 | 0 |
| `tol = 0` | rank 2 | 2 | 2 |

## Fix
- `src/linalg/qr.ts`: the tol check.
- Docs (en, ja): the `qr(x, tol = Inf)` row of "Where R fails" and "`tol: Infinity` gives rank 0" of the deliberate
  differences removed; the list of non-finite tolerances that are errors already names `qr`.

## Tests
- `test/rev13.test.ts`: qr and qrSolve throw for tol Infinity; tol 1e300 and 0 give R's ranks. Fails with src stashed.
- `test/locationScaleExtremes.test.ts`: the rank 0 test now expects the error.
- qr, linalg, linalg-invariants pass; no fixture uses tol Infinity.

## Out of scope (recorded)
- None.
