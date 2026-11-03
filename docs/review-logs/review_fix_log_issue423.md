# Issue #423 log: rnbinom with size = Inf

GitHub Issue #423. Session 13, judging of the issues classified C. Verdict: not planned (an intentional, documented difference). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2, and compare with the documented difference.
- Why: classified C (reproduced, but documented as intended).

## Check (main `cf2ee38`, R 4.5.2)

- `setSeed(1); rnbinom(1, Infinity, { prob: 0.5 })`: Infinity; the next uniform is the 6th of seed 1 (0.8984).
- R: `set.seed(1); rnbinom(1, Inf, prob = 0.5)`: 8.9884656743115734e307 (the draw for size = DBL_MAX / 2); the next uniform is also the 6th (0.8984).
- The value differs as reported; the stream is R's. R's finite value is an artefact of replacing size = Inf by DBL_MAX / 2; for size = Inf and p < 1 all the probability is at infinity, and `dnbinom` and `qnbinom` here say the same.

## Earlier decision

- `docs/differences-from-r.md`, "Where R fails" table: the row "`rgeom(n, 5e-324)` ..., `rnbinom(n, Inf, prob = p)` with p < 1": R about 9e307 (the draw for size = MAX / 2) or NA; rStats.js Infinity, "for rnbinom all the probability is at infinity, as dnbinom and qnbinom say. The same variates are drawn, so the stream is R's".
- Tests: `test/review21.test.ts`.

## Fix

- None.

## Tests

- None (test/review21.test.ts).

## Out of scope

- None.

## close comment

Not planned: this is an intentional, documented difference. With size = Inf and prob < 1 the negative binomial has all its probability at infinity (dnbinom and qnbinom here agree), so rnbinom returns Infinity; R's finite value (about 9e307 for prob = 0.5) is the draw for its substitute size DBL_MAX / 2. The same variates are drawn as in R, so the stream after the call is R's (checked with set.seed(1) in R 4.5.2). It is listed in docs/differences-from-r.md (the rnbinom(n, Inf, prob = p) row of "Where R fails"). (Not pushed yet.)
