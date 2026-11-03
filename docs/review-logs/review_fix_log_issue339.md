# Issue #339 log: tabulate with an inferred nbins of 2^31

GitHub Issue #339. Session 12, judging of the issues classified C. Verdict: completed (already fixed by 02721ef for #225; the same report as #262). No code changed.

## Plan

- Intent: re-check the report on the current main through the public API and compare with R 4.5.2.
- Why: classified C (already fixed); the verdict needs the behaviour confirmed by running it.

## Check (main `7033ff3`, R 4.5.2)

- `tabulate([2^31])`: [0]. No allocation: since 02721ef bins are taken as R's as.integer, so a value beyond the integer range is NA, is not counted and does not set the default nbins.
- `tabulate([2^31], 2^31)`: RangeError "attempt to make a table with >= 2^31 elements".
- R: `tabulate(2^31)` gives 0 (with "NAs introduced by coercion to integer range"). The same.
- The same report was judged for issue 262 (log daaf057).

## Fix

- None (fixed by 02721ef).

## Tests

- None (test/issue225.test.ts).

## Out of scope

- None.

## close comment

Completed: this was fixed in 02721ef (#225). tabulate now takes the bins as R's as.integer does, so a value of 2^31 is NA, is not counted and does not set the inferred nbins: tabulate([2 ** 31]) returns [0] without allocating, the same as R's tabulate(2^31). An explicit nbins of 2^31 is still the RangeError. (Not pushed yet.)
