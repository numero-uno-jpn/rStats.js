# Issue #429 log: mcnemarTest on a table without discordant pairs

GitHub Issue #429. Session 13, judging of the issues classified C. Verdict: not planned (an intentional difference decided in review 59, documented). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2, and compare with the earlier decision.
- Why: classified C (reproduced, but the behaviour is the decision of review 59).

## Check (main `cf2ee38`, R 4.5.2)

- `mcnemarTest([[10, 0], [0, 5]])`: RangeError "the table has no discordant pairs".
- R: `mcnemar.test(matrix(c(10, 0, 0, 5), 2, 2))`: statistic NaN, df 1, p-value NaN.
- The report reproduces. The test has no information without discordant pairs.

## Earlier decision

- Review 59 (user decision; `docs/review-logs/review_fix_log_20261031_59.md`): inputs on which a test is not defined and R returns NaN are errors, among them "a table without discordant pairs in `mcnemarTest`"; applied again in issue 45's log.
- `docs/differences-from-r.md`, the list of inputs without meaning that are errors: "a table without discordant pairs in `mcnemarTest`". An r x r table where only some pairs have no discordant counts is not an error: those pairs add 0 and df is unchanged (the `mcnemar.test` row of "Where R fails").
- Tests: `test/review59.test.ts`, `test/issue45.test.ts`.

## Fix

- None.

## Tests

- None (test/review59.test.ts).

## Out of scope

- None.

## close comment

Not planned: this is an intentional, documented difference. A table without any discordant pair carries no information for McNemar's test, and rStats.js treats such inputs, where R returns NaN, as errors (decided in an earlier review): mcnemarTest([[10, 0], [0, 5]]) throws "the table has no discordant pairs". A larger table where only some pairs have no discordant counts still gives a result (those pairs add 0, df unchanged). Both are listed in docs/differences-from-r.md. (Not pushed yet.)
