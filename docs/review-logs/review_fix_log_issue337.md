# Issue #337 log: dmultinom with a total count above 2^53

GitHub Issue #337. Session 12, judging of the issues classified C. Verdict: not planned (the value is correct). No code changed.

## Plan

- Intent: re-check the report on the current main through the public API and compare with R 4.5.2 and an Rmpfr reference.
- Why: classified C (the reported loss of log N does not happen); the verdict needs the value checked.

## Check (main `7033ff3`, R 4.5.2)

- `dmultinom([2^53, 1], [0.5, 0.5], { size: 2^53, log: true })`: -6243314768165323 (-0x1.62e42fefa39cbp52). Without `size` the same.
- Rmpfr, N = 2^53 + 1 exactly: log(N) - N log 2 = -6243314768165323.165. The double nearest to it is -6243314768165323 (the spacing there is 1), so the result is the correctly rounded value: the log N term is not lost.
- R: `dmultinom(c(2^53, 1), 2^53 + 1, c(0.5, 0.5), log = TRUE)` stops ("missing value where TRUE/FALSE needed", after "NAs introduced by coercion to integer range").
- The sum of the counts rounds to 2^53, so a `size` of 2^53 is accepted; at this magnitude log N contributes about 36.7 to a value of 6.2e15, far below its spacing, so the rounding does not change the result.

## Fix

- None.

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: the value is correct. dmultinom([2^53, 1], [0.5, 0.5], { size: 2^53, log: true }) returns -6243314768165323 on the current main, and the exact log(2^53 + 1) - (2^53 + 1) log 2 is -6243314768165323.165 (Rmpfr), whose nearest double is that value; log N (about 36.7) is far below the spacing of doubles there (1), so the rounded total does not change the result. R's dmultinom stops on this input (the counts are coerced to integer and become NA). (Not pushed yet.)
