# claude/cloud-numerics: notes for merging

Work done in the cloud session without R, on new files only (agreed with the R session on the Mac mini, which works
on `claude/laughing-einstein-ejtcoz`). Shared files are left untouched until the merge; this list says what to do then.

## New code (not exported yet)

| File | What | Checked against |
|---|---|---|
| `src/htest/core/kolmogorov.ts` | exact and limiting Kolmogorov distribution, one-sided exact (Birnbaum-Tingey) | exact rationals, SciPy `kstwo` |
| `src/htest/core/smirnov.ts` | exact two-sample Smirnov distribution with ties | exact path counts, brute force |
| `src/htest/core/ansari.ts` | exact Ansari-Bradley distribution | exact counts, brute force |
| `src/htest/core/shapiro.ts` | Shapiro-Wilk coefficients, W and p-value (Royston AS R94) | SciPy `shapiro` (9e-12) |
| `src/htest/core/mantelhaen.ts` | exact conditional distribution for 2 x 2 x K, conditional MLE and limits | exact rationals |
| `src/integrate/quadpack.ts` | QUADPACK dqagse / dqagie (R's integrate) | SciPy QUADPACK (counts exact) |
| `src/optim/localmin.ts` | Brent's localmin (R's optimize) | SciPy's bounded minimiser with R's sqrt(eps) (iterates exact) |

## Hypothesis tests (not exported yet; R fixtures to generate on the Mac)

R's remaining tests, each checked against SciPy / statsmodels / exact arithmetic in `test/htest-basic.test.ts`
(references from `scripts/mpmath/htest_scipy.py`), which also compares with the R fixtures once they exist.
Run `npm run oracle -- binomtest vartest ranktests proptest mantelhaen ansari kstest pairwise` to write them.

| File | Functions (R) | R fixture(s) |
|---|---|---|
| `src/htest/binomTest.ts` | binomTest (binom.test) | binomTest |
| `src/htest/poissonTest.ts` | poissonTest (poisson.test) | poissonTest |
| `src/htest/mcnemarTest.ts` | mcnemarTest (mcnemar.test) | mcnemarTest |
| `src/htest/varTest.ts` | varTest, bartlettTest (var.test, bartlett.test) | varTest, bartlettTest |
| `src/htest/rankTests.ts` | kruskalTest, friedmanTest, quadeTest, flignerTest, moodTest | kruskalTest, friedmanTest, quadeTest, flignerTest, moodTest |
| `src/htest/onewayTest.ts` | onewayTest, shapiroTest (oneway.test, shapiro.test) | onewayTest, shapiroTest |
| `src/htest/propTest.ts` | propTest (prop.test) | propTest |
| `src/htest/mantelhaenTest.ts` | mantelhaenTest (mantelhaen.test: 2 x 2 x K, exact, I x J x K) | mantelhaenTest |
| `src/htest/ansariTest.ts` | ansariTest (ansari.test without conf.int) | ansariTest |
| `src/htest/ksTest.ts` | ksTest (ks.test, distribution given as a function) | ksTest |
| `src/htest/pairwise.ts` | pairwiseTTest, pairwiseWilcoxTest, pairwisePropTest | pairwise |

Points where R's behaviour was inferred and the R fixtures will settle it: error messages and which inputs R rejects;
varTest computes both tails directly (R may form 1 - P); flignerTest uses the non-cancelling form of the statistic;
propTest gives exactly 0 when the continuity correction is reduced to |O - E|; mcnemarTest's correction when
|n12 - n21| < 1; the ansari normal approximation with ties straddling the middle; ks.test's exact one-sided one-sample
p-value (Birnbaum-Tingey). Not yet done: ansari.test's conf.int, simulate.p.value for chisqTest / fisherTest.

## To do at the merge (shared files)

- `THIRD_PARTY_NOTICES.md`: add SciPy's C translation of QUADPACK (`scipy/integrate/__quadpack.c`, SciPy commit
  5ccd743, BSD-3-Clause; QUADPACK itself public domain) for `src/integrate/quadpack.ts`.
- `src/index.ts`, `README*.md`, `ROADMAP*.md`, `CHANGELOG.md`: export and document the hypothesis tests above once
  their R fixtures pass (and integrate / optimize once built on the cores and checked against R).

## Fixes to existing files (approved; separate commits)

- `src/special/igam.ts`: pgamma's lower tail for shape above about 1e6, 5 to 40 standard deviations below the mean,
  and ppois's upper tail for lambda around 6e6 were off by up to 2e-14 (audit). The series ratios x / (a + n) were
  rounded with correlated errors over thousands of terms, and the stopping rule left out a tail of up to
  c (a + n) / (a + n - x). Now summed in double-double for a > 1000 and x > 0.97 a: worst error 2.7e-15.
  `npm run bench` unchanged; inside that region the series costs about 9 times more (pgamma at a = 7e6, 11 standard
  deviations below the mean: 11 µs to 100 µs per call).
- `src/distributions/nchisq.ts`, `src/distributions/nbeta.ts`: pchisq / pbeta with ncp were off by up to 1.4e-13 at ncp
  around 1000 (audit). The kernels formed the component shape `a + j` in double, so a starting increment such as
  dpois(96.2595 + 1034; 331) was evaluated at a shape rounded by 1e-13, which the far tail amplifies by
  |log(y / (a + j))| and the recurrences carry to every term. The increments are now corrected to the exact shape
  with the first-order factor δ ∂log d/∂s (δ the low part of twoSum(a, j); the derivative from digamma): worst
  error 4.9e-15 (pnchisq) and 3.9e-15 (pnbeta). The starting P_J / Q_J are left as they are: their share of the sum
  falls off geometrically away from J. No measurable speed change. Still to be checked against R on the Mac mini.

## Audit of the distribution functions (`scripts/mpmath/audit.py`, `test/audit.test.ts`)

Random parameters beyond the R fixture grids, both tails and the log scale, against mpmath (references kept only where
40 and 90 digits agree). All pass at 1e-14 after the two fixes above.

Quantiles (`scripts/mpmath/audit_q.py`, `test/audit_q.test.ts`) are measured relative to max(|x|, P / f(x)), the
change in x that the rounding of the probability argument alone causes, so that ill-conditioned quantiles (qgamma
with a tiny shape) are judged against their condition.
