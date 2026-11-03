# Issue #351 log: contr.poly with many levels

GitHub Issue #351. Session 12, group B (user decisions).

## Plan

- User decision (2026-11-03): from about 16 levels only, build contr.poly by the three-term recurrence with re-orthogonalisation; fewer levels keep the QR; the range that differs from R in docs (option B of the prep notes).
- Intent: `polyContrasts` takes Q of the QR of the Vandermonde matrix of the centred scores (as R's `contr.poly`). That QR is too ill-conditioned in doubles for many levels: the error grows from 2e-12 at k = 16 to 7e-10 at k = 22, and from k = 23 the high-degree columns are other vectors altogether (also in R). The issue's diagnosis (undo the pivot order) is not enough: at k = 23 the pivots do not move and the last column is still wrong, and from k = 24 the numerical rank drops (22 at k = 24), so there are not enough columns to reorder.
- Method: for k >= 16, P_0 = 1/sqrt(k), P_d from x P_(d-1) orthogonalised twice against all earlier columns, normalised (the Stieltjes recurrence spans the same space; the full re-orthogonalisation keeps the rounding from accumulating). The leading coefficient stays positive, the convention of the QR version. O(k^3): 47 ms at k = 200.
- User decision (2026-11-03, second commit): the premise of the first decision (15 levels or fewer keep R's bits) was wrong (see below), so the recurrence for every k (option A); the QR branch and the threshold are removed.
- Threshold of the first commit: measured against exact rational Gram-Schmidt (BigInt). The QR's maximum element error is at most 2.75e-13 up to k = 15 (k = 14) and 2.4e-12 at k = 16, 1.5e-11 at 17; the recurrence is within 6e-16 for every k from 2 to 26. So 16, as proposed.

## Check (main `3380a46`, R 4.5.2)

Maximum absolute element error against the exact values (columns are unit vectors, so 0.9 is a different vector):

| k | before (= QR) | R `contr.poly` | after |
|---|---|---|---|
| 10 | 8.1e-15 | | 2.2e-16 |
| 14 | 2.8e-13 | | 2.2e-16 |
| 15 | 5.0e-14 | | 3.1e-16 |
| 16 | 2.4e-12 | 1.3e-12 | 2.8e-16 |
| 20 | 1.4e-10 | 5.6e-11 | 3.6e-16 |
| 22 | 6.6e-10 | 1.7e-10 | 3.5e-16 |
| 23 | 0.89 | 0.89 | 3.3e-16 |
| 24 | 0.96 | 0.96 | 3.5e-16 |

(R's column: maximum difference between R's `sprintf("%a")` values and the new, exact-to-1e-15 values.)

## Fix

- First commit `06a043c`: `src/models/modelMatrix.ts` `polyRecurrence`, used from 16 levels (`POLY_RECURRENCE_LEVELS`).
- Second commit: `polyContrasts` uses `polyRecurrence` for every k; the QR of the powers (and the `qr` import) is removed. Against the exact BigInt values, the maximum element error is at most 5.8e-16 for every k from 2 to 26 ("after" column above).
- docs (en, ja): a row under "Where R is inaccurate", for every k.

## Tests

- `test/issue351.test.ts`: the degree k - 1 column for k = 16, 20, 23, 24, 40 against the exact (-1)^(k-1-i) choose(k - 1, i), normalised (fails with `src/` stashed); orthonormality at k = 60; the degree k - 1 column for k = 3 to 15 within 2e-15 (fails with the first commit's `src/` stashed: the QR) and k = 3's values.
- `test/lmerTest.test.ts` (the two contr.poly fixture cases), `test/lmer.test.ts`, `test/lmerTerms.test.ts`: pass.

## Out of scope (recorded)

- (Resolved by the second commit.) The prep notes and the first decision assumed 15 levels or fewer keep R's bits. They did not: the QR version was Q with the sign of diag(R), while R normalises qr.qy(QR, diag(diag(R))), so the last bits already differed from R's for every k (k = 3: 3 of 6 elements by 1 ulp; k = 10: 81 of 90 elements, up to 6.9e-15; k = 15: up to 7.4e-13). Decision: the recurrence for every k.
- The issue's label mismatch: with the recurrence there is no pivoting, so the labels `.L`, `.Q`, `.C`, `^4`, ... are the degrees for every k.

## close comment

Fixed in <commits of #351, see git log --grep='#351'>: undoing the pivot order is not enough, as the QR of the Vandermonde matrix of the scores is itself too ill-conditioned in doubles: at 23 levels no pivot moves and the last column is still a different vector (error 0.89), and from 24 levels the numerical rank drops (22 at k = 24). R's `contr.poly` has the same errors (1.3e-12 at 16 levels, 5.6e-11 at 20, 0.89 at 23). contr.poly is now built by the three-term (Stieltjes) recurrence with full re-orthogonalisation for every number of levels, within 6e-16 of exact rational values for every k from 2 to 26 (the QR was off by up to 3e-13 already at 14 levels), with no pivoting, so each column is its degree. Recorded in docs/differences-from-r.md.

Test: test/issue351.test.ts. (Not pushed yet.)
