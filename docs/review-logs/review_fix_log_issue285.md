# Issue #285 log: the simulation of chisqTest allocates an unbounded factorial table

GitHub Issue #285. Session 12, group B4 (allocation limits, part R2: the table of log factorials; with #286 and #336).

## Plan

- User decision (2026-11-03, items 1 and 3): the simulations need a grand total of at most 2^24, as r2dtable (#336); the same number as #232 and #381.
- Intent: `simulateTables` built `logFactorialTable(total)` (total + 1 doubles) for any total; `chisqTest([[1e9, 1e9], [1e9, 1e9]], { simulatePValue: true, B: 1 })` asks for 32 GB.
- Choice: check the total against `MAX_TABLE_TOTAL` (`src/random/r2dtable.ts`) just before the table is built. Totals at or below it are unchanged (largest in the fixtures: 3013 for chisqTest, 631 for fisherTest).

## Check (main `943a1e4`, R 4.5.2)

- `chisqTest([[1e9, 1e9], [1e9, 1e9]], { simulatePValue: true, B: 1 })`: before, the allocation of the table (code reading; not run). R builds the table up to its integer range (not run).
- `set.seed(1); chisq.test(matrix(c(12, 5, 7, 9), 2), simulate.p.value = TRUE)` is 0.17641179410294852 in R and in rStats.js before and after.

## Fix

- `src/htest/chisqTest.ts` (`simulateTables`): a total above 2^24 is RangeError "the simulation needs a total count of at most 16777216 (2^24)".
- Docs (en, ja): the item added with #336 covers this.

## Tests

- `test/issue285.test.ts`: total 2^24 + 1 is the error (fails with src stashed); the issue's call (excluded from the stash run); a total of 2^24 runs; R's p-value above after `setSeed(1)`.
- Test files using r2dtable, chisqTest and fisherTest pass; tsc no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #285, see git log --grep='#285'>: the simulated p-value of chisqTest now needs a grand total of at most 2^24 (16777216), the same limit as r2dtable and the exact supports of fisherTest and mantelhaenTest; above it, RangeError "the simulation needs a total count of at most 16777216 (2^24)" before the table of log factorials (total + 1 doubles, 128 MB at the limit) is built. The issue's call is this error. Tables at or below the limit are unchanged (set.seed(1); chisq.test(matrix(c(12, 5, 7, 9), 2), simulate.p.value = TRUE) is still R's 0.17641179410294852). R builds the table for any total in its integer range; the difference is recorded in docs/differences-from-r.md. A test was added: test/issue285.test.ts. (Not pushed yet.)
