# Issue #382 log: chisqTest standardized residuals lose small margins

GitHub Issue #382. Session 12, group B (user decision 13).

## Plan

- Intent: the contingency-table `stdres` used V = E (1 - sr / n)(1 - sc / n) in doubles. For [[2^52, 0], [0, 0.1]], sr / n rounds to 1, the complement is 0 and the off-diagonal cells are -Infinity; also O - E in cell (1,1) is 0 because E rounds to 2^52 (true O - E is about 0.1), so that cell is 0 / 0 = NaN.
- User decision (2026-11-03): always in double-double. The complements are the sums of the other rows and columns (prefix and suffix sums of the double-double margins, O(rows + columns)), over n; E = sr (sc / n), O - E and V = E (cr / n)(cc / n) in double-double, rounded once. `residuals`, `expected` and the statistic are unchanged.
- Why always and not only where a complement is 0: a fallback only there would turn cell (1,1) from NaN into a wrong 0 (O - E still lost), and ordinary integer tables were also off: [[1e15, 7], [3, 11]] by 8e-4 relative in cell (1,1).
- Details added within the plan: a variance below the normal range divides by sqrt(E), sqrt(cr / n), sqrt(cc / n) in turn (the single sqrt would be of 0); a total beyond the double range keeps the old formula (that case was not part of the issue).

## Reproduction (main `e05eb7e`, R 4.5.2)

| call | before | R | after |
|---|---|---|---|
| `[[2^52, 0], [0, 0.1]]` (either correct) | NaN, -Inf, -Inf, 67108864 | the same | 67108864 in absolute value in all four (exact: 67108864.0000000007) |
| `[[1e15, 7], [3, 11]]`, correct false | (1,1) 21930052.709566876, others 21921286.86 and 21912524.504463963 | (1,1) 0x1.4e5bcc8124954p+24, others 0x1.4e5bcc81248cep+24 (2.3e-14) | 0x1.4e5bcc81248cep+24 in all four (exact 21912524.50446396208531, rounded) |
| `[[1e15, 1], [2, 3]]` | (1,1) 21230172.24 | 21213203.4356 (6.5e-15) | 21213203.43559644 in all four |

For a 2 x 2 table the four true values have the same absolute value (ad - bc) sqrt(n) / sqrt(r1 r2 c1 c2).

## Fix

- `src/htest/chisqTest.ts`: `contingencyStdres` (double-double margins, complements from the other margins); the doc comment of `stdres`.
- docs (en, ja): a row in "Where R is inaccurate" (R's formula c r (n - r)(n - c) / n^3 gives NaN and -Inf on the issue's example and loses digits in large tables).

## Tests

- `test/issue382.test.ts`: the issue's table (both correct values) and [[1e15, 7], [3, 11]] against the exact value. With `src/` stashed, both fail.
- `test/chisq.test.ts` (R fixtures, tolerance 1e-12): pass. Of the 328 stdres cells of `chisqTest.json`, 212 change, by at most 8.7e-14 relative (the same bits as the prototype of the prep); no test recorded these cells bit for bit.
- `issue141`, `errors`, `guide`, `issue278`, `issue285`, `issue287`, `issue303`, `issue336`, `issue42`, `review15`, `review58`, `review59`, `scaleInvariance`, `scaleInvarianceAll`: pass.

## Out of scope (recorded)

- `residuals` (O - E) / sqrt(E) in cell (1,1) of the issue's table is 0 (true about 1.49e-9; R also 0): O - E there is the rounded E subtracted from 2^52. The issue is about `stdres` only.
- A table whose total overflows keeps the old `stdres` formula (NaN or Infinity, as before).

## close comment

Fixed in <commit of #382, see git log --grep='#382'>: the standardized residuals of a contingency table are now computed in double-double, with the complements 1 - row proportion and 1 - column proportion formed from the sums of the other rows and columns. `chisqTest([[2 ** 52, 0], [0, 0.1]]).stdres` was NaN, -Infinity, -Infinity, 67108864 (R gives the same); it is now 67108864 in absolute value in all four cells, the correctly rounded value. The double computation also lost digits in ordinary integer tables ([[1e15, 7], [3, 11]] was off by 8e-4 relative in one cell, R by 2.3e-14); that table now gives the exact value rounded. Other tables may change in the last bits (the R fixtures by at most 8.7e-14 relative); residuals, expected counts and the statistic are unchanged. Recorded in docs/differences-from-r.md.

Test: test/issue382.test.ts. (Not pushed yet.)
