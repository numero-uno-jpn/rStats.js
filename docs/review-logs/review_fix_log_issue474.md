# Issue #474 log: the signed rank wilcoxTest with only zero differences

GitHub Issue #474. Session 13, judging of the issues classified C. Verdict: not planned (an intentional, documented difference). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2, and check the earlier decision.
- Why: classified C (the issue asks for R's NaN p-value instead of the error).

## Check (main `c7fcff4`, R 4.5.2)

- `wilcoxTest([0, 0, 0], { exact: false })` and the paired `wilcoxTest([1, 2], [1, 2], { paired: true, exact: false })`: RangeError "no non-zero differences for the signed rank test".
- R: `wilcox.test(c(0, 0, 0), exact = FALSE)` and the paired call: V = 0, p-value NaN. The difference the issue describes is real.

## Earlier decision

- Review 59 (user decision): inputs where R returns NaN because the test carries no information are errors; this case is listed in docs/differences-from-r.md (the paragraph on errors for meaningless input: "only zero differences in the signed rank `wilcoxTest`"). `test/review59.test.ts` and the fixture of `test/wilcox.test.ts` (`knownDifference`, "R returns NaN") record it. Issue #49 asked the same for related cases.
- The source comment "(R returns a p-value of NaN)" describes R's value next to the error, not the intended behavior.

## Fix

- None.

## Tests

- None added (`test/review59.test.ts` covers the error).

## Out of scope

- None.

## close comment

Not planned: this is an intentional, documented difference. A signed rank test where every difference is zero has nothing to rank, and rStats.js treats such inputs, where R returns NaN (V = 0, p-value NaN for wilcox.test(c(0, 0, 0), exact = FALSE) in R 4.5.2), as errors (decided in an earlier review): wilcoxTest([0, 0, 0]) throws "no non-zero differences for the signed rank test", also for paired data. It is listed in docs/differences-from-r.md; the comment in signedRank() describes R's value, not the intended behavior. (Not pushed yet.)
