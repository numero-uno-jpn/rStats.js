# Issue #308 log: ansariTest exact: true permits DP allocations that grow as O(m (m+n)^2)

GitHub Issue #308. Session 12, group B4 (resource limits, part R3: exact computations; with #307, #316, #321 and #391).

## Plan

- User decision (2026-11-03, items 1 and 2): one allocation at most 2^24 doubles and about 10 s on this PC, a limit per function; beyond it a RangeError with the hint "use exact: false" (as `mantelhaenTest` in #232).
- Intent: `exact: true` bypasses the default m, n < 50; `ansariDist` keeps two layers of (m + 1) rows of maxSum + 1 doubles (maxSum = floor((N + 1)^2 / 4), N = m + n) and makes N passes over one layer.
- Choice (the prep's limits): 2 (m + 1) (maxSum + 1) <= 2^24 doubles and N (m + 1) (maxSum + 1) <= 2^32 steps, checked in ansariTest before the exact branch (p-value and interval use the same distribution). Balanced samples hit the allocation limit first (m = n = 202), a small first sample the step limit (m = 1, n = 2046).

## Check (main `2c9aae4`, R 4.5.2)

- The issue's m = n = 1000: each layer 1001 x 1001001 doubles (8 GB), two of them (code reading; not run). R's C code (`cansari`) builds a comparable memoised table (not run).
- Timing at the limit (once, on this PC): `ansariTest` with m = n = 202, no ties, `exact: true`: 5.25 s.

## Fix

- `src/htest/core/ansari.ts`: `checkAnsariExactSize(m, n)`: RangeError "the exact distribution for m = M and n = N is too large to compute: use exact: false".
- `src/htest/ansariTest.ts`: the check at the start of the exact branch; the `exact` option's JSDoc.
- Docs (en, ja): added to the item of #307.

## Tests

- `test/issue308.test.ts`: boundaries m = n = 202 / 203 and m = 1 with n = 2046 / 2047 (fails with src stashed); the issue's m = n = 1000 is the RangeError (excluded from the stash run) and `exact: false` still computes.
- `test/htest-core/ansari.test.ts`, `test/issue209.test.ts`, `test/htest-basic.test.ts` pass; tsc no errors.

## Out of scope (recorded)

- The distributions are cached per (m, n) without eviction (`cache` in `src/htest/core/ansari.ts`); within the limit each kept array is at most about 41000 doubles, so this is not a resource problem now.

## close comment

Fixed in <commit of #308, see git log --grep='#308'>: the exact ansariTest now checks the size of its dynamic programme before allocating: the two layers hold 2 (m + 1) (floor((N + 1)^2 / 4) + 1) doubles (N = m + n), at most 2^24 (128 MB), and the N passes take at most 2^32 steps (m = n = 202 takes 5.3 s on the development machine); beyond either, a RangeError "the exact distribution for m = ... and n = ... is too large to compute: use exact: false". The issue's m = n = 1000 now fails at once; samples within the limit are unchanged. R computes these however large; the difference is recorded in docs/differences-from-r.md. A test was added: test/issue308.test.ts. (Not pushed yet.)
