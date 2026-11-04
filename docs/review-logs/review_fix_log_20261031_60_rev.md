# Revision of review 60: pooled within-group variance 0 in pairwiseTTest and onewayTest

## Plan
- Intent: with every group constant, `pairwiseTTest` (pooled SD) and `onewayTest` (`varEqual: true`) returned p 0
  (t, F infinite), while `tukeyTest`, `dunnettTest` and `glhtDunnett` reject the same pooled variance of 0 (review 60).
  Criterion K1: no test without a residual variance, also where R returns values.
- Decision: D16 (session 14, `prep/errors.md` question 2, recommended option (a)). The all-tied two-sample wilcoxTest
  (p = 1) is kept by the same decision.
- Form: the checks of `pooled()` (`src/htest/multipleComparisons.ts`) move to an exported `checkPooledVariance(df,
  ssWithin)`, which `pooled()`, `pairwiseTTest` and `onewayTest` call: the same messages ("no residual degrees of
  freedom", "the pooled within-group variance is 0"), the same exact test on the double-double sum of squares.

## Original decision
- Review 60: the user's decision (HTEST-032, error) covered the three functions of the finding; the log recorded
  pairwiseTTest (pooled) and onewayTest (equal variances) as out of scope.

## Gap with the current criteria
- K1, and the same degenerate input treated differently by functions using the same pooled variance.

## Reproduction (x = [1, 1, 2, 2, 3, 3], 3 groups; R 4.5.2)
| call | R | rStats.js before | now |
|---|---|---|---|
| `pairwise.t.test(x, g)` | p 0, 0, 0 | 0, 0, 0 | RangeError "the pooled within-group variance is 0" |
| same, x = [1, 1, 1, 1, 3, 3] | NaN, 0, 0 | NaN, 0, 0 | RangeError |
| `oneway.test(y ~ g, var.equal = TRUE)` | F Inf, p 0 | F Inf, p 0 | RangeError |
| `pairwise.t.test(c(1, 2, 3), c("a", "b", "c"))` | NaN | NaN | RangeError "no residual degrees of freedom" |

## Fix
- `src/htest/multipleComparisons.ts`: `checkPooledVariance`. `src/htest/pairwise.ts`, `src/htest/onewayTest.ts`: call it
  in the pooled branches. The Welch branch of onewayTest is unchanged (one constant group: the limit, issue 313).
- Docs (en, ja): the two functions added to the review 60 item of the errors list.
- Own judgment: the df 0 case of pairwiseTTest (every group a single observation) also has a pooled sum of squares of
  0; it gets pooled()'s first message, "no residual degrees of freedom", rather than the variance message.

## Tests
- `test/rev60.test.ts`: the cases above throw; a tiny nonzero variance and the Welch test with one constant group still
  return. Fails with src stashed.
- htest-basic, formulaTests, issue313, issue393, issue44, scaleInvariance, scaleInvarianceAll, review60 pass; the
  pairwise and oneway fixtures have no data with every group constant.

## Out of scope (recorded)
- None.
