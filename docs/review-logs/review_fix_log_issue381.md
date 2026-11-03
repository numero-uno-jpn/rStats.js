# Issue #381 log: fisherTest allocating the support of a 2 x 2 table with counts of 1e9

GitHub Issue #381. Session 12, judging of the issues classified C. Verdict: completed (already fixed by e3279e1 for issue 232). No code changed.

## Plan

- Intent: re-check the report on the current main through the public API without allocating 16 GB.
- Why: classified C (already fixed); the verdict needs the behaviour confirmed by running it.

## Check (main `7033ff3`)

- `fisherTest([[1e9, 1e9], [1e9, 1e9]], { confInt: false })`, with Float64Array replaced by a proxy that throws on any length above 1e6: RangeError "the exact distribution of the 2 x 2 table has 2000000001 values, more than 2^24", thrown before any allocation (the proxy did not fire).
- e3279e1 (issue 232) checks the support size of the 2 x 2 table (and of mantelhaenTest's exact test) before anything is allocated.
- R was not run with this table (fisher.test would allocate and compute at any size the memory allows).

## Fix

- None (fixed by e3279e1).

## Tests

- None (test/issue232.test.ts).

## Out of scope

- None.

## close comment

Completed: this was fixed in e3279e1 (#232). fisherTest now checks the size of the conditional distribution's support before anything is allocated and throws for more than 2^24 values: fisherTest([[1e9, 1e9], [1e9, 1e9]], { confInt: false }) gives the RangeError "the exact distribution of the 2 x 2 table has 2000000001 values, more than 2^24" without allocating. (Not pushed yet.)
