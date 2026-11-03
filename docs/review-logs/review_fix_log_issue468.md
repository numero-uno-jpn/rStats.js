# Issue #468 log: cronbachAlpha with a singular item correlation matrix

GitHub Issue #468. Session 13, group B (user decisions).

## Plan

- User decision (2026-11-03): option (b) of the preparation. Only where the correlation matrix is singular (`solve` throws), the SMC of each item is the R^2 of lm(x_i ~ x_-i) with R's QR (limited pivoting, tol 1e-7). This differs from psych, so record it in docs (en, ja), and record that with at least as many items as subjects G6 is always 1.
- Why (b) and not psych's pseudo-inverse: the SMC is an R^2 and is defined for a singular matrix. psych's `Pinv` with the clamp to [0, 1] gives an item that the others predict exactly an SMC of 0 (true value 1), so G6 is 0.5 for two copies of one item. rStats.js already returns the true SMC for nonsingular but ill-conditioned items (b = a + 1e-5: 0.96701, psych 0.72175 since `Pinv` drops small singular values); the R^2 continues that to the singular case without a jump. Nonsingular input keeps `solve` and the same bits (as #59 and #83: the package's values where it is right).

## Reproduction (main `29f9122`, R 4.5.2, psych 2.6.9)

| data | psych G6 | before | after | lm R^2 G6 (R) |
|---|---|---|---|---|
| `[[1, 1], [2, 2], [3, 3]]` (issue) | 0.5 | Error "exactly singular" | 1 (raw, std, average_r 1) | 1 |
| a = b = 1:5, c = (2, 1, 4, 3, 5) | 0.71219512195121935 | Error "exactly singular" | 0.9560975609756097 | 0x1.e9859e9859e98p-1 (the same) |
| a = 1:6, c = (2, 1, 4, 3, 6, 5), a + c | 0.80430491414020135 | Error "computationally singular" | 1 | 1 |
| 4 subjects, 6 items (integers) | -5.7123395970359869 | Error "computationally singular" | 1 | 1 |
| `@example` (nonsingular) | 0.981680477517221 | 0.981680477517221 | the same | |

Raw alpha, standardized alpha, average_r and alpha.drop are returned for the singular cases; they agree with psych to about 1e-14 (the last bits differ as before for nonsingular input).

## Cause

`cronbachAlpha` called `solve(R)` for the SMC unconditionally, so a singular R threw before any value was returned.

## Fix

- `src/htest/agreement.ts` `cronbachAlpha`: `solve` in a try; where it throws and R is finite, each SMC is 1 - RSS / TSS of the QR least-squares fit of item i on an intercept and the other items, on the data scaled by one power of 2 (`scaleToUnit`, exact). A non-finite R (a constant item) rethrows as before.
- docs (en, ja): a row in "Where R is inaccurate" next to psych's omega, with the note on k >= n.

## Tests

- `test/issue468.test.ts`: the issue's call (all four values 1), a = b with c (G6 from R's lm R^2, bit for bit), the sum item and 4 x 6 (G6 1), the `@example` (unchanged). With `src/` stashed the first three fail.
- `agreement`, `issue310`, `scaleInvarianceAll`: pass.

## Out of scope (recorded)

- Two items: `alphaDrop` is [NaN, NaN] (alpha of one item has k - 1 = 0); psych special-cases it (C12 / C22 and C12 / C11). Not changed.
- A constant item (variance 0): `cor` gives NaN; unchanged (G6 NaN, no error).

## close comment

Fixed in <commit of #468, see git log --grep='#468'>: where the item correlation matrix is singular, cronbachAlpha no longer throws; raw and standardized alpha, average_r and alpha.drop are returned, and each squared multiple correlation for G6 is the R^2 of the item regressed on the others (R's lm with its QR, tol 1e-7). `cronbachAlpha([[1, 1], [2, 2], [3, 3]])` gives raw 1, std 1, G6 1, average_r 1. This differs from psych, whose pseudo-inverse and clamp give a duplicated item an SMC of 0 (G6 0.5) where the R^2 is 1; recorded in docs/differences-from-r.md, with the note that with at least as many items as subjects G6 is always 1. Nonsingular input is unchanged. Test: test/issue468.test.ts. (Not pushed yet.)
