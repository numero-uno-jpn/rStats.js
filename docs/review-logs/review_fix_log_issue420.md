# Issue #420 log: noncentral rf with an infinite df

GitHub Issue #420. Session 13, group A (stream only; with issue 424).

## Plan

- The issue asks for R's NaN for `rf(n, Inf, df2, ncp)` and `rf(n, df1, Inf, ncp)`. The limits (the chi-squared over its infinite df is 1: X / df1, df2 / Y or 1) are an intended difference already in docs/differences-from-r.md, so the values are not changed.
- The triage found a real mismatch in the stream: with df1 = Inf and ncp > 0, R's `rchisq(n, Inf, ncp)` draws the Poisson mixture (and the chi-squared of 2 × Poisson degrees of freedom), while rStats.js drew nothing for X. The docs sentence "the same variates are drawn as in R, so the stream after the call is R's" and the comment in `src/random/gamma.ts` were wrong for this case.
- Method: for df1 = Inf, draw X with `rchisq(n, Inf, { ncp })` (since issue 424 this follows R's rnchisq: Inf after the draws, NaN without a draw for an invalid ncp) and use 1 for each non-NaN value. df2 = Inf already matched R (the central rchisq(Inf) draws nothing). Finite df: the same code and bits.

## Check (main `0fa1d60`)

R 4.5.2, `set.seed(1)`, uniforms drawn from the next `runif(1)`:

| call | R | before | after |
|---|---|---|---|
| `rf(1, Inf, 5, ncp = 2)` | NaN, 4 drawn | 2.0624142, 3 drawn | 1.5971957, 4 drawn |
| `rf(3, Inf, 5, ncp = 2)` | NaN x3, 14 drawn | 7 drawn | 0.5946355, 0.9507969, 0.4726526 (1 / (Y / 5) with R's Y), 14 drawn |
| `rf(2, Inf, 5, ncp = 20)` | NaN x2, 16 drawn | 5 drawn | 16 drawn |
| `rf(2, Inf, Inf, ncp = 2)` | NaN x2, 4 drawn | 1, 1; 0 drawn | 1, 1; 4 drawn |
| `rf(1, Inf, 5, ncp = 0)`, `rf(1, 5, Inf, ncp = 2)` | NaN, 3 and 4 drawn | the same draws | the same |
| `rf(1, Inf, 5, ncp = Inf)` | NaN, 3 drawn | NaN, 3 drawn | the same |

## Fix

- `src/random/gamma.ts`, `rf`: the df1 = Inf branch draws `rchisq(n, Inf, { ncp })` and maps it to 1 (NaN stays NaN); the comment is corrected. The docs row (limits, stream as R) is now accurate and is unchanged.

## Tests

- `test/issue420.test.ts`: the rows above. With `src/` stashed, 1 of 2 tests fails.
- `test/locationScaleExtremes.test.ts`: the `rf(3, Infinity, 10, { ncp: 2 })` expectation encoded the old stream (Y drawn right after the seed); it now draws `rchisq(3, Infinity, { ncp: 2 })` before Y, as R.
- `test/random.test.ts`, `test/issue424.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- None.

## close comment

Thanks. The values are kept: for the noncentral F, rStats.js takes the chi-squared over an infinite df as its limit 1 (X / df1, df2 / Y or 1) where R gives NaN; this is an intended difference recorded in docs/differences-from-r.md. Checking it found a real stream mismatch, fixed in <commit of #420, see git log --grep='#420'>: with df1 = Inf and ncp > 0, R's `rchisq(n, Inf, ncp)` draws its Poisson mixture, which rStats.js skipped (`rf(1, Inf, 5, ncp = 2)` drew 3 uniforms, R 4). It now draws the same variates, so the stream after the call is R's, as the docs state. df2 = Inf already matched.

Test: test/issue420.test.ts. (Not pushed yet.)
