# Issue #413 log: r2dtable with fractional and negative fractional margins

GitHub Issue #413. Session 13, judging of the issues classified C. Verdict: not planned (not reproduced against R: R 4.5.2 does the same). No code changed.

## Plan

- Intent: run the issue's four calls on the current main and in R 4.5.2, and read R's r2dtable.
- Why: classified C (the report says R checks the raw margins; it was not run).

## Check (main `cf2ee38`, R 4.5.2)

- R 4.5.2's `r2dtable` coerces first: `length(r <- as.integer(r)) <= 1L || any(r < 0) || anyNA(r)`, the same for c, then `sum(r) != sum(c)` on the integers.
- `r2dtable(1, c(-0.5, 1.5), c(0, 1))`, `(c(0.5, 1), c(0, 1))`, `(c(0, 1), c(-0.5, 1.5))`, `(c(0, 1), c(0.5, 1))` after `set.seed(1)`: all accepted, `matrix(c(0, 0, 0, 1), 2)`.
- rStats.js after `setSeed(1)`: all four accepted, `[[[0, 0], [0, 1]]]`. The same.
- Rejections after truncation agree: `r2dtable(1, c(0, 1), c(-1, 2))` is "invalid argument 'c'" and `r2dtable(1, c(0.5, 1), c(0, 2))` "arguments 'r' and 'c' must have the same sums" in both.

## Fix

- None.

## Tests

- `test/issue413.test.ts`: the four calls give R's table; the two rejections. They pass on the current main.

## Out of scope

- The report cites R 4.6.1; this was not checked. Following a later R is recorded only (HANDOFF policy).

## close comment

Not planned: not reproduced against R. R 4.5.2's r2dtable truncates the margins with as.integer before checking them (length(r <- as.integer(r)) <= 1L || any(r < 0) ..., then sum(r) != sum(c) on the integers), so r2dtable(1, c(-0.5, 1.5), c(0, 1)), r2dtable(1, c(0.5, 1), c(0, 1)) and the two column versions are accepted in R and give the table matrix(c(0, 0, 0, 1), 2), as rStats.js does. A test of these calls has been added. (Not pushed yet.)
