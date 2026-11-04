# Issue #510 log: survdiff's generalized inverse for a singular variance matrix

GitHub Issue #510. Session 15, judging of the issues classified C. Verdict: not planned (deliberate, a user's decision, already documented and tested). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2 (survival 3.8.3), and check it against the earlier decision.
- Why: classified C. The generalized inverse was the user's decision in the external review of 2026-10-31, round 15 (`docs/review-logs/review_fix_log_20261031_15.md`, "the statistically correct direction"; commit `97860c7`), and `docs/differences-from-r.md` (line 430) lists this very example.

## Check (main `53ee5d7`, R 4.5.2, survival 3.8.3)

| Call | R | rStats.js |
|---|---|---|
| `survdiff(Surv(c(1, 1), c(1, 1)) ~ c("a", "b"))` | error "Lapack routine dgesv: system is exactly singular: U[1,1] = 0" | obs [1, 1], exp [1, 1], chisq 0, df 0, p NaN |

The issue reproduces as described, and the result is the documented one: with every subject failing at once the data carry no information on the groups, the variance matrix has rank 0, and the test has 0 degrees of freedom. The `df` field of the result reports rank(V).

## Fix

- None.

## Tests

- None added: `test/review15.test.ts` ("a singular variance matrix: the generalized inverse on rank(V) degrees of freedom") already checks this call (chisq 0, df 0, p NaN) and a full-rank case (df 2).

## Out of scope (recorded)

- `oracle/survival-behaviour.md` line 14 says the statistic is "solved with the variance matrix (not a generalized inverse of the full matrix)". It means that the first group is dropped rather than the full k × k matrix being pseudo-inverted; it does not cover the singular case, which the issue read as a ban. Adding a sentence there for the singular case (the generalized inverse on rank(V) degrees of freedom, as in docs/differences-from-r.md) would remove the ambiguity. Not changed here.

## close comment

Not planned: this is deliberate. In R 4.5.2 (survival 3.8.3), survdiff(Surv(c(1, 1), c(1, 1)) ~ c("a", "b")) stops with "system is exactly singular". rStats.js uses a generalized inverse of the variance submatrix on rank(V) degrees of freedom, reported in the result's df: when everyone fails at once there is no information on the groups, so chisq 0, df 0 and p NaN. This was decided in an earlier review (docs/review-logs/review_fix_log_20261031_15.md) and is listed with this example in docs/differences-from-r.md; test/review15.test.ts covers it. The oracle sentence "not a generalized inverse of the full matrix" refers to dropping the first group, not to the singular case; its wording is recorded in the log. (Not pushed yet.)
