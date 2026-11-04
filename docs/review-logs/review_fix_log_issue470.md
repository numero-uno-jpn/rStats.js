# Issue #470 log: uniroot's estimPrec for a root at an endpoint

GitHub Issue #470. Session 13, judging of the issues classified C. Verdict: not planned (the claim about R is wrong; rStats.js does as R). No code changed.

## Plan

- Intent: run the issue's calls on the current main and in R 4.5.2.
- Why: classified C (the issue says R's `uniroot` gives `estim.prec = NA` for an endpoint root, citing the help page).

## Check (main `c7fcff4`, R 4.5.2)

- `uniroot((x) => x, 0, 1)`: root 0, iter 0, estimPrec 0; `uniroot((x) => x - 1, 0, 1)`: root 1, iter 0, estimPrec 0.
- R: `uniroot(function(x) x, c(0, 1))` and `uniroot(function(x) x - 1, c(0, 1))`: iter 0, `estim.prec` **0** (not NA). R's C routine zeroin2 (whose third value `uniroot` returns as `estim.prec`) returns before the Brent loop with a precision of 0 when f is 0 at an end; the NA of the help page is not what R 4.5.2 returns here.

## Fix

- None.

## Tests

- `test/issue470.test.ts`: both endpoint roots give R's iter 0 and estimPrec 0.

## Out of scope

- None.

## close comment

Not planned: rStats.js does as R here. R 4.5.2's uniroot(function(x) x, c(0, 1)) returns root 0, iter 0 and estim.prec 0 (not NA), and uniroot(function(x) x - 1, c(0, 1)) the same at 1: R returns before the Brent iterations with an estimated precision of 0 when f is 0 at an end. rStats.js gives the same values. Added test/issue470.test.ts. (Not pushed yet.)
