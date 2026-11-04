# Revision of review 3 (R03/R11): tTest's interval and Welch standard error

## Plan
- Intent: tTest formed every interval about the estimate (estimate ± q stdErr) and Welch's standard error as
  sqrt(sx + sy). R forms the ends as mu + (t ± q) stdErr and the standard error as sqrt(stderrx^2 + stderry^2). R's
  forms are as accurate as ours in the usual range (both within a few ulp of the exact ends), so by criterion K2 the
  results should be R's bits there; R's interval only cancels where mu or t stdErr is far larger than the interval.
- Decision: D13 (session 14, `prep/rbits.md` question 1, recommended option 1).
- Form (K3, a fallback): the end is R's muS + (t ± q) stdErr (in the 2^-k coordinates, exact powers of 2); where it is
  not finite, or max(abs(mu), abs(t stdErr)) exceeds 16 times abs(estimate) + q stdErr (R's error can then exceed some
  16 ulp), the estimate-centred end as before. One-sample, pooled and paired standard errors were already R's form;
  Welch's is now sqrt(sqrt(sx)^2 + sqrt(sy)^2) (sqrt of the scaled variances is exact, the scale being 2^-2k).

## Original decision
- Review 3, R03/R11 (no user decision): "the CI is centred on the estimate, not formed from mu", to avoid R's
  `t.test(x, mu = 1e100)` = [0, 0].

## Gap with the current criteria
- K2: the usual-range ends differed from R's in their last bits although R's form is not wrong there; K3: the
  alternative path is needed only where R's form cancels.

## Reproduction (R 4.5.2, Linux, test/fixtures/tTest.json)
| call | R | before | now |
|---|---|---|---|
| `t.test(x5, mu = -2)` (fixture case 128) | -1.0387803853619273, 0.18140559407702828 | 1 to 3 ulp off | R's bits |
| `t.test(c(1.2, 3.4, 2.2, 5.1), c(2, 4, 6, 9, 11, 3), var.equal = TRUE)` | -7.3015332224039717, 1.5848665557373058 | ulp off | R's bits |
| fixture case 255 (Welch, 200 and 150 values) stdErr | 0.27572044497681003 | 1 ulp off | R's bits |
| `t.test(1:4, mu = 1e6)` | 0.44573974329978228, 4.5542602567002177 (1.4e-10 off) | 0.44573974323947896, 4.5542602567605215 | unchanged (fallback) |
| `t.test(1:3, mu = -1e300)`, `mu = Inf` | [0, 0], NaN | the interval about the mean | unchanged (fallback) |

Fixture (768 cases without an error, 911 finite ends): ends with R's bits 335 before, 460 now (one-sample 151 to 204,
paired 19 to 26, pooled 71 to 97, Welch 94 to 133); Welch stdErr 132 to 165 of 176. Ends beyond the fixture's
tolerance (1e-12 relative, floored by mu): 7 pooled and 12 Welch, the same as before (the substitute scale cases); no
knownDifference or substitute changed.

## Fix
- `src/htest/tTest.ts`: the ends and Welch's standard error.
- Docs (en, ja): the `t.test(x, mu = 1e100)` row now gives the condition of the fallback.
- `test/ttest.test.ts`: the comment of the knownDifference (no change of what is recorded).

## Tests
- `test/rev3.test.ts`: the rows above. The first two tests fail with src stashed.
- ttest, htest-basic, issue 08, 210, 270, 304, 313, 314, 316, 321, 393, 414, 58, reviews 32, 58, 60, scaleInvariance,
  scaleInvarianceAll, formulaTests, rNames, docExamples, errors, guide, dataRows, jstat-replacement, pwr, powerStats,
  thresholds, mcompPMCMR pass.

## Out of scope (recorded)
- The remaining ends that differ from R come mostly from qt (local R 4.5.2: qt(0.975, df) differs in 25 of 46 df,
  qt(0.95, df) in 37) and from the last bit of `variance` (1 to 2 ulp from R's var in 21 of 60 synthetic cases). Not
  checked which is right; separate roots.
- Welch's degrees of freedom: revision of review 2 (C-02/C-03).
