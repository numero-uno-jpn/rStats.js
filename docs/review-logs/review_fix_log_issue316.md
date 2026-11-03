# Issue #316 log: corTest exact Kendall mode allocates a quadratic inversion table

GitHub Issue #316. Session 12, group B4 (resource limits, part R3: exact computations; with #307, #308, #321 and #391).

## Plan

- User decision (2026-11-03, items 1 and 2): one allocation at most 2^24 doubles and about 10 s on this PC, a limit per function; beyond it a RangeError with the hint "use exact: false" (as `mantelhaenTest` in #232).
- Intent: `exact: true` without ties bypasses the default n < 50. `kendallCdf` runs twice, for q and for total - q (the issue's "only the smaller one" is not what the code does), each with arrays of c + 1 doubles and n passes, so the work is about n (total + 2), n^3 / 2, whatever q is.
- Choice (the prep's limit): n <= 1290, the same number as the Spearman exact limit; checked in corTest before `kendallCdf`. Arrays at the limit: 3 x 831406 doubles (20 MB). Tied data still take the normal approximation (no limit).

## Check (main `2e218f7`, R 4.5.2)

- The issue's n = 1e4: two runs with arrays of about 2.5e7 doubles and 1e4 passes each, about 5e11 steps (code reading; not run). R's `cor.test(exact = TRUE)` uses its C `ckendall` recursion (not run).
- Timing at the limit (once, on this PC): n = 1290, a rotated permutation, `exact: true`: 4.91 s.

## Fix

- `src/htest/cor.ts`: `MAX_KENDALL_EXACT_N = 1290`; RangeError "the exact distribution of T for n = N takes too long (at most 1290): use exact: false"; the `exact` option's JSDoc.
- Docs (en, ja): added to the item of #307.

## Tests

- `test/issue316.test.ts`: n = 1291 is the RangeError (fails with src stashed: it computes); the issue's n = 1e4 is the RangeError (excluded from the stash run); `exact: false` and tied data still compute; n = 60 keeps the exact test.
- `test/cor.test.ts` passes; tsc no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #316, see git log --grep='#316'>: Kendall's exact corTest (no ties) now accepts n up to 1290 (the same number as the Spearman exact limit; 4.9 s on the development machine); above it, a RangeError "the exact distribution of T for n = ... takes too long (at most 1290): use exact: false" before any table is allocated. Note that the code computes both P(T <= q) and P(T <= total - q), so the work is about n^3 / 2 whatever q is. The issue's n = 1e4 now fails at once; n <= 1290, tied data and exact: false are unchanged. R computes these however long it takes; the difference is recorded in docs/differences-from-r.md. A test was added: test/issue316.test.ts. (Not pushed yet.)
