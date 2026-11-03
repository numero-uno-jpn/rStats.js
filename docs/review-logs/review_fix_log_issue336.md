# Issue #336 log: r2dtable allows a grand total that needs a multi-gigabyte factorial table

GitHub Issue #336. Session 12, group B4 (allocation limits, part R2: the table of log factorials; with #285 and #286).

## Plan

- User decision (2026-11-03, items 1 and 3): lower r2dtable's grand total to 2^24 (the same number as #232 and #381), record the difference from R in docs.
- Intent: `logFactorialTable(total)` allocates total + 1 doubles; r2dtable accepted any total up to 2147483647 (16 GB), so `r2dtable(1, [5e8, 5e8], [5e8, 5e8])` asked for 8 GB to return 4 cells.
- Choice: a shared constant `MAX_TABLE_TOTAL = 2^24` in `src/random/r2dtable.ts`, checked just before the table is built (128 MB, about 0.2 s at the limit). Largest total in the fixtures: 3e5. The existing check against 2147483647 (R's integer-sum overflow) stays before `n = 0`'s early return, and the new check comes after it: `r2dtable(0, ...)` builds no table (#219) and keeps R's result for totals up to 2147483647. So the existing test of the 2147483647 message (`test/locationScaleExtremes.test.ts`) did not need a change (the prep expected one message change; keeping n = 0 as R made it unnecessary).

## Check (main `943a1e4`, R 4.5.2)

- `r2dtable(1, [5e8, 5e8], [5e8, 5e8])`: before, `new Float64Array(1e9 + 1)` (code reading; not run). R builds the same table (not run).
- `set.seed(1); r2dtable(1, c(3, 2), c(2, 3))` is R's table before and after.

## Fix

- `src/random/r2dtable.ts`: `MAX_TABLE_TOTAL`; in `r2dtable`, a total above it is RangeError "the sum of 'r' must be at most 16777216 (2^24) to generate tables" when n >= 1. JSDoc @throws updated.
- Docs (en, ja): one item for r2dtable and the simulations of chisqTest and fisherTest (#285, #286).

## Tests

- `test/issue336.test.ts`: total 2^24 + 1 is the error (fails with src stashed); the issue's 1e9 (excluded from the stash run); n = 0 with a total of 1e9 is `[]`, and totals beyond 2147483647 keep the old message; a total of 2^24 generates a table; R's small table after `setSeed(1)`.
- Test files using r2dtable, chisqTest and fisherTest pass; tsc no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #336, see git log --grep='#336'>: r2dtable now generates tables only for a grand total up to 2^24 (16777216), the same limit as the exact supports of fisherTest and mantelhaenTest; above it, RangeError "the sum of 'r' must be at most 16777216 (2^24) to generate tables" before the table of log factorials (total + 1 doubles, 128 MB at the limit) is built. The issue's r2dtable(1, [5e8, 5e8], [5e8, 5e8]) is this error. r2dtable(0, ...) builds no table and still accepts totals up to 2147483647, and tables at or below the limit are unchanged. R builds the table for any total up to 2147483647; the difference is recorded in docs/differences-from-r.md. The simulations of chisqTest and fisherTest use the same limit (#285, #286). A test was added: test/issue336.test.ts. (Not pushed yet.)
