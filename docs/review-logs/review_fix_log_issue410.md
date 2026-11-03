# Issue #410 log: rhyper at the integer limit of m + n

GitHub Issue #410. Session 13, judging of the issues classified C. Verdict: not planned (the values are right and the condition is R 4.5.2's; R's value at m + n = 2^31 is an integer overflow). No code changed.

## Plan

- Intent: run the issue's calls on the current main and in R 4.5.2, and read R 4.5.2's documented condition.
- Why: classified C (the report asks for a later R's condition; R was not run).

## Check (main `cf2ee38`, R 4.5.2)

- R 4.5.2's `?rhyper`: "if one of m, n, k exceeds .Machine$integer.max, currently the equivalent of qhyper(runif(nn), m,n,k) is used". `src/random/hyper.ts` uses that condition (`m >= INT_MAX || n >= INT_MAX || k >= INT_MAX`).
- `rhyper(1, 2^30, 2^30, 18)` after seed 1: rStats.js 8, one uniform drawn; `qhyper(u, 2^30, 2^30, 18)` for that uniform is also 8. R 4.5.2: 0 with the warning "rhyper.c: afc(i), i=-2147483648 < 0 -- SHOULD NOT HAPPEN!" (its int m + n overflows), one uniform drawn. rStats.js is right; R is wrong.
- `rhyper(1, 2^30 - 1, 2^30 - 1, 18)`: 8 after one uniform in both.
- `rhyper(1, 2147483647, 0, 2)`: 2 after one uniform in both. The report's "R returns 2 without a draw" does not hold for R 4.5.2.

## Fix

- None.

## Tests

- `test/issue410.test.ts`: the three calls (values and the next uniform). They pass on the current main.

## Out of scope (recorded)

- A later R (the report cites R 4.6.1) switches on m + n > INT_MAX. Following a later R is recorded only (HANDOFF policy "将来の R への追従は記録だけ"). With that condition, rhyper(1, 2147483647, 0, 2) would stay on R's ordinary path; R 4.5.2 draws there.

## close comment

Not planned: the current values are right and follow R 4.5.2. R 4.5.2 switches to qhyper(runif) when one of m, n, k is at least .Machine$integer.max, as rStats.js. For rhyper(1, 2^30, 2^30, 18) after set.seed(1), rStats.js returns 8 (the quantile of the uniform drawn), while R 4.5.2 returns 0 with "afc(i), i=-2147483648 < 0 -- SHOULD NOT HAPPEN!" because its integer m + n overflows. rhyper(1, 2147483647, 0, 2) is 2 after one uniform in both R 4.5.2 and rStats.js, so the stream is R's there. Tests of these calls have been added. (Not pushed yet.)
