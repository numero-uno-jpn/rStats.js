# Issue #419 log: noncentral rt with df = Inf

GitHub Issue #419. Session 13, judging of the issues classified C. Verdict: not planned (an intentional, documented difference). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2, and compare with the documented difference.
- Why: classified C (reproduced, but documented as intended).

## Check (main `cf2ee38`, R 4.5.2)

- `setSeed(1); rt(2, Infinity, { ncp: 1 })`: [0.37354618925766758, 1.1836433242220823] (N(1, 1) variates); the next uniform is 0.20168193103745580.
- R: `set.seed(1); rt(2, Inf, ncp = 1)`: NaN NaN with "NAs produced"; the next uniform is the same, 0.2016819310374558.
- The value differs as reported; the stream is R's. N(ncp, 1) is the limit of the noncentral t as df goes to infinity (R's central `rt(n, Inf)` gives the normal limit as well); R's NaN comes from `rchisq(n, Inf)` inside its wrapper.

## Earlier decision

- `docs/differences-from-r.md`, "Where R fails" table: the row "`rt(n, Inf, ncp = 1)`, `rf(n, Inf, 10, ncp = 2)`, `rf(n, 10, Inf, ncp = 2)`": R NaN; rStats.js "the limits: N(ncp, 1) for t ... The same variates are drawn as in R, so the stream after the call is R's".
- Tests: `test/locationScaleExtremes.test.ts`.

## Fix

- None.

## Tests

- None (test/locationScaleExtremes.test.ts).

## Out of scope

- None.

## close comment

Not planned: this is an intentional, documented difference. As df goes to infinity the noncentral t tends to N(ncp, 1), which rt returns for df = Inf (as R's central rt(n, Inf) returns the normal limit); R's noncentral wrapper gives NaN because rchisq(n, Inf) is NaN. The same variates are drawn as in R, so the stream after the call is R's (setSeed(1); rt(2, Infinity, { ncp: 1 }) followed by runif(1) matches R 4.5.2). It is listed in docs/differences-from-r.md (the rt(n, Inf, ncp = 1) row of "Where R fails"). (Not pushed yet.)
