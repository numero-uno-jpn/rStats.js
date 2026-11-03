# Issue #458 log: qrX and the range of ncol

GitHub Issue #458. Session 13, group B (user decision).

## Plan

- User decision (2026-11-03): `ncol > max(nrow, ncol of x)` is a RangeError; `ncol` 0 stays an empty matrix as in R; one line in the docs (option b of the prep).
- Intent: R's `qr.X` does not check `ncol`; above max(n, p) it pads all-zero columns, which are neither columns of x nor of an orthogonal completion. The issue's bound `ncol <= nrow` would reject a meaningful call: for a wide x, `ncol = p > n` returns the whole x (R too; 4 fixture cases). `ncol` 0 is the default for a decomposition with 0 columns (min(n, 0)), so it stays valid (as #55: length 0 follows R). The bound also caps the allocation (session 12 policy) without a separate limit.

## Check (main `df27eab`, R 4.5.2)

| call | before | after | R `qr.X` |
|---|---|---|---|
| `qrX(qr([[1],[2]]), { ncol: 3 })` | `[[1, -0.894, 0], [2, 0.447, 0]]` | RangeError | same as before (zero column) |
| `qrX(qr([[1,3],[2,4]]), { ncol: 3 })` | third column 0 | RangeError | third column 0 |
| `qrX(qr([[1,3,5],[2,4,7]]), { ncol: 3 })` | the whole x | unchanged | the whole x |
| `qrX(qr([[1,3,5],[2,4,7]]), { ncol: 4 })` | fourth column 0 | RangeError | fourth column 0 |
| pivoted 3x3, `ncol: 4` | fourth column 0 | RangeError | fourth column 0 |
| `qrX(qr([[1],[2]]), { ncol: 0 })` | 2 x 0 | unchanged | 2 x 0 |

## Fix

- `src/linalg/qr.ts`, `qrX`: after the integer check, `ncol > max(n, p)` throws "ncol must be at most max(nrow, ncol of x) = m (got k)". The JSDoc states the range.
- `docs/differences-from-r.md` and `docs/ja/`: the `qrX` item.

## Tests

- `test/issue458.test.ts`: the errors (tall, square, wide, pivoted) and the values kept (ncol 1, 2, the whole wide x, ncol 0). With `src/` stashed, the first test fails.
- `test/qr.test.ts` (fixtures: 60 of 174 `qr.X` cases give `ncol`, none above max(n, p)) and `npx tsc --noEmit -p .`: pass.

## Out of scope (recorded)

- A non-integer `ncol` (1.5) is still an error; R truncates it. An earlier difference, unchanged.

## close comment

Fixed in <commit of #458, see git log --grep='#458'>. `qrX` now throws a RangeError when `ncol` exceeds max(nrow, ncol of x): `qrX(qr([[1],[2]]), { ncol: 3 })` is "ncol must be at most max(nrow, ncol of x) = 2 (got 3)" instead of a zero column (R 4.5.2 pads the zero column; this is recorded in the docs). The bound is max(nrow, ncol) rather than nrow, because for a wide matrix `ncol` = ncol of x returns the whole x, in R as well. `ncol: 0` stays a 2 x 0 matrix as in R: it is the default for a decomposition with no columns. A test has been added. (Not pushed yet.)
