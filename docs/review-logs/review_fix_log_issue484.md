# Issue #484 log: mcnemarTest on a table without discordant pairs

GitHub Issue #484. Session 13, judging of the issues classified C. Verdict: not planned (an intentional, documented difference; the same request as #429). No code changed.

## Plan

- Intent: run the issue's calls on the current main and in R 4.5.2, and check the earlier decision.
- Why: classified C (the issue asks for R's NaN statistic and p-value instead of the error).

## Check (main `c7fcff4`, R 4.5.2)

- `mcnemarTest([[1, 0], [0, 1]])` and the 3 × 3 identity: RangeError "the table has no discordant pairs".
- R: `mcnemar.test(matrix(c(1, 0, 0, 1), 2))`: statistic NaN, df 1, p NaN; `mcnemar.test(diag(3))`: NaN, df 3, NaN. The difference the issue describes is real.

## Earlier decision

- Review 59 (user decision): inputs where R returns NaN because the test carries no information are errors; listed in docs/differences-from-r.md ("a table without discordant pairs in `mcnemarTest`"), with the row for an r × r table where only some pairs have no discordant counts (those pairs add 0). `test/review59.test.ts` and `test/issue45.test.ts` check it. Issue #429 asked the same and was closed as not planned.
- The issue's alternative ("document this as a deliberate compatibility difference") is what the docs already do.

## Fix

- None.

## Tests

- None added (`test/review59.test.ts` covers the error).

## Out of scope

- None.

## close comment

Not planned: this is an intentional, documented difference (as in #429). A table without any discordant pair carries no information for McNemar's test, and rStats.js treats such inputs, where R returns NaN (R 4.5.2: statistic NaN, df 1, p-value NaN for matrix(c(1, 0, 0, 1), 2)), as errors (decided in an earlier review): mcnemarTest([[1, 0], [0, 1]]) throws "the table has no discordant pairs", also for larger diagonal tables. It is listed in docs/differences-from-r.md. (Not pushed yet.)
