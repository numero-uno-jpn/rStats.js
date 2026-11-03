# Issue #427 log: rhyper with k = 1 and m + n overflowing

GitHub Issue #427. Session 13, judging of the issues classified C. Verdict: not planned (an intentional, documented difference). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2, and compare with the documented difference.
- Why: classified C (reproduced; the value is documented as intended, and the extra uniform follows from it).

## Check (main `cf2ee38`, R 4.5.2)

- `setSeed(1); rhyper(1, 1e308, 1e308, 1)`: 0; the next uniform is the 2nd of seed 1 (0.3721): one uniform drawn.
- R: `set.seed(1); rhyper(1, 1e308, 1e308, 1)`: 0; the next uniform is the 1st (0.2655): R's p = m / (m + n) is 1e308 / Inf = 0, and rbinom(1, 0) draws nothing.
- The report reproduces. With k = 1 the variate is Bernoulli(m / (m + n)) = Bernoulli(1/2) here; R's 0 is the result of the overflow of m + n, and it returns 0 for every seed. A correct Bernoulli(1/2) draw needs a uniform.

## Earlier decision

- `docs/differences-from-r.md`, "Where R fails" table: the row "`dhyper(1, 1e308, 1e308, 1)`, `phyper`, `qhyper`, `rhyper(n, 1e308, 1e308, 1)` (m + n overflows)": R NaN, rhyper 0 throughout; rStats.js the binomial Bin(k, m / (m + n)) with m / (m + n) formed without the sum (commit 579e44c).
- The extra draw is the same kind as rexp's (review 48, user decision: the variate needs a draw R does not make).

## Fix

- None.

## Tests

- None (test/review18.test.ts).

## Out of scope (recorded)

- The docs row does not say that rhyper draws a uniform there where R draws none (the rexp and rbeta rows say it). A clause such as "one uniform is drawn there, where R draws none" could be added to that row in `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`; not done here (logs and tests only).

## close comment

Not planned: this is an intentional, documented difference. When m + n overflows, R forms m / (m + n) as 0 and returns 0 for every seed without drawing, although the variate for k = 1 is Bernoulli(m / (m + n)), Bernoulli(1/2) for rhyper(1, 1e308, 1e308, 1). rStats.js forms the fraction without the sum (as dhyper, phyper and qhyper do) and draws the Bernoulli variate, which takes one uniform where R takes none. This is listed in docs/differences-from-r.md (the rhyper(n, 1e308, 1e308, 1) row of "Where R fails"). (Not pushed yet.)
