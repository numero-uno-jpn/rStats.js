# Issue #494 log: the exact Mantel-Haenszel test does not return for counts from 2^53 on

GitHub Issue #494. Session 14, group A1. Fixed: the exact 2 x 2 x K test throws a RangeError, pointing to `exact: false`, when the total of the counts reaches 2^53, before any support is allocated or looped over.

## Plan

- Intent: `stratumDensity()` (src/htest/core/mantelhaen.ts) loops `for (x = lo; x <= hi; x++)`; at 1e16 (and at 2^53) `x + 1` rounds to `x` and the loop does not end. The bound on the support (2^24 values) passes, since the width is 0.
- Method: in `mantelhaenTest`, next to the check of fractional counts for the exact test (review 58), throw when the sum of the stratum totals exceeds `Number.MAX_SAFE_INTEGER`. The total bounds every cell, margin, support end and the sum S over the strata, so all of them are exact integers below 2^53 and every `x++` advances.
- Why: counts from 2^53 on are not exact integers, so the exact conditional distribution is not defined on them (K7); the error form is that of review 58 and the other exact tests ("use exact: false"). The asymptotic test is unchanged.
- Own choice: the check is on the total rather than on each cell and margin; it also covers strata that are each below 2^53 but whose sum S is not (S is then not exact). Totals below 2^53 are unchanged.

## Reproduction (main `6ec0e64`, R 4.5.2)

- Not run in rStats.js (it does not return). A copy of the loop with a cap of 1e6 iterations (scratchpad a1/t494.ts) reaches the cap for the strata [[1e16, 0], [1e16, 0]] and [[2^53, 0], [0, 0]], and runs once for [[2^53 - 1, 0], [0, 0]] and [[2^52, 0], [2^52, 0]].
- R: `mantelhaen.test(array(c(1e16, 1e16, 0, 0, 1, 1, 0, 0), c(2, 2, 2)), exact = TRUE)` is an error "cannot allocate memory block of size 134217728 Tb", the same for 2^52 in place of 1e16. So R gives no result either, and no docs entry is needed.

## Fix

- `src/htest/mantelhaenTest.ts`: with `exact: true` on 2 x 2 x K tables, a total above 2^53 - 1 throws `RangeError("the exact test needs counts with a total below 2^53: use exact: false")`.

## Tests

- `test/issue494.test.ts`: the issue's table and a total of 2^53 + 2 (strata [[2^52, 0], [2^52, 0]] and [[1, 0], [1, 0]]) throw; a total below 2^53 is computed (S = 2^52 + 1) and the asymptotic test of the issue's table does not throw. With `src/` stashed (the issue's table left out with `-t`, as it does not return), the 2^53 test fails.
- `test/htest-basic.test.ts`, `issue224.test.ts`, `issue226.test.ts`, `issue232.test.ts`, `review58.test.ts` pass.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #494, see git log --grep='#494'>. The exact 2 x 2 x K test now throws RangeError "the exact test needs counts with a total below 2^53: use exact: false" before the strata's supports are built, when the total of the counts reaches 2^53. From there the counts are not exact integers, and the loop over a stratum's support did not advance (1e16 + 1 rounds to 1e16). The total bounds every cell, margin and the sum over the strata. R stops with "cannot allocate memory block of size 134217728 Tb" for the issue's table. The asymptotic test and totals below 2^53 are unchanged. A test was added: test/issue494.test.ts. (Not pushed yet.)
