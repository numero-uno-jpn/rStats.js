# Issue #421 log: noncentral rf with df1 = 0

GitHub Issue #421. Session 13, judging of the issues classified C. Verdict: not planned (an intentional, documented difference). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2, and compare with the documented difference.
- Why: classified C (reproduced, but documented as intended).

## Check (main `cf2ee38`, R 4.5.2)

- `setSeed(1); rf(1, 0, 5, { ncp: 10 })`: NaN; the next uniform is 0.66079779248684645.
- R: `set.seed(1); rf(1, 0, 5, ncp = 10)`: Inf; the next uniform is the same, 0.66079779248684645.
- The value differs as reported; the stream is R's. The F distribution needs df1 > 0 (df here gives NaN for df1 = 0, and R's central `rf(n, 0, 5)` is NaN too); R's Inf or NaN is the division by df1 = 0 in its wrapper.

## Earlier decision

- `docs/differences-from-r.md`, "Where R fails" table: the row "`rf(n, 0, 10, ncp = 2)` (noncentral, df1 = 0)": R Inf or NaN depending on the draw (division by df1 = 0; the central `rf` gives NaN); rStats.js NaN, "F needs df1, df2 > 0; the same variates are drawn as in R, so the stream after the call is R's".
- Tests: `test/locationScaleExtremes.test.ts`.

## Fix

- None.

## Tests

- None (test/locationScaleExtremes.test.ts).

## Out of scope

- None.

## close comment

Not planned: this is an intentional, documented difference. The F distribution is not defined for df1 = 0, so the noncentral rf returns NaN there, as the central rf (and R's central rf) do; R's noncentral wrapper divides by df1 = 0 and returns Inf or NaN depending on the draw. The same variates are drawn as in R, so the stream after the call is R's (setSeed(1); rf(1, 0, 5, { ncp: 10 }) followed by runif(1) matches R 4.5.2). It is listed in docs/differences-from-r.md (the rf(n, 0, 10, ncp = 2) row of "Where R fails"). (Not pushed yet.)
