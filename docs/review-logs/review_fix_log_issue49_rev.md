# Revision of issue 49: two-sample wilcox with every value tied kept at p = 1 (an exception to K1)

## Plan
- Intent: record that the issue 49 result departs from criterion K1 (a degenerate test is an error), and why it stays.
- Decision: D16 (session 14, user decision of 2026-11-04, `prep/errors.md` question 2, recommended option 1: the
  zero within-group variance of pairwiseTTest and onewayTest becomes an error, wilcox stays at p = 1).

## Original decision
- Issue 49 (2026-11-02, 2a62353): the normal approximation of the two-sample rank-sum test returns p = 1 where x - mu
  and y are all the same value, whatever the alternative and the continuity correction (W always equals its mean).
  p = 1, against R 4.5.2's NaN, was a user decision at the time.

## Gap with the current criteria
- K1: a degenerate test (zero standard error) should be an error, as the signed rank test with every difference 0
  (review 59, a RangeError) and the zero variance of tukey, dunnett and tTest.

## Reproduction (R 4.5.2)
| call | R 4.5.2 | rStats.js |
|---|---|---|
| `wilcoxTest([1, 1], [1, 1], { exact: false })` | W 2, p NaN | 2, 1 |
| `wilcoxTest([1], [1])` | 0.5, NaN | 0.5, 1 |
| the same as the first, alternative "less" (corrected) | 3, 1 | 3, 1 |
| `wilcoxTest([3, 3], [1, 1], { mu: 2, exact: false })` | 2, NaN | 2, 1 |

## Decision (2026-11-04)
- Kept as an exception to K1. R 4.6 returns p = 1 here (`.wilcox_test_two_pval_asymp`, according to the issue's
  description; not checked locally, as only R 4.5.2 is installed), and R 4.5.2 itself returns 1 for the one-sided
  "less" test, so an error would refuse inputs to which R gives a value. The interval with every value tied stays an
  error, as in R.

## Changes
- None in src, tests or docs (the docs row from issue 49 stays; the fixture case x = [1, 1], y = [1, 1] stays a
  knownDifference). R fixtures affected: 0.

## Out of scope (recorded)
- kruskalTest, moodTest and flignerTest return NaN for every value tied, as R (`tie.ts`); not reviewed here.
