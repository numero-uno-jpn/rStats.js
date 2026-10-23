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

## To do at the merge (shared files)

- `THIRD_PARTY_NOTICES.md`: add SciPy's C translation of QUADPACK (`scipy/integrate/__quadpack.c`, SciPy commit
  5ccd743, BSD-3-Clause; QUADPACK itself public domain) for `src/integrate/quadpack.ts`.
- `src/index.ts`, `README*.md`, `ROADMAP*.md`, `CHANGELOG.md`: only once the R-facing functions (ks.test, integrate, ...)
  are built on these cores and checked against R.

## Fixes to existing files (approved; separate commits)

- `src/special/igam.ts`: pgamma's lower tail for shape above about 1e6, 5 to 40 standard deviations below the mean,
  and ppois's upper tail for lambda around 6e6 were off by up to 2e-14 (audit). The series ratios x / (a + n) were
  rounded with correlated errors over thousands of terms, and the stopping rule left out a tail of up to
  c (a + n) / (a + n - x). Now summed in double-double for a > 1000 and x > 0.97 a: worst error 2.7e-15.
  `npm run bench` unchanged; inside that region the series costs about 9 times more (pgamma at a = 7e6, 11 standard
  deviations below the mean: 11 µs to 100 µs per call).

## Waiting for a decision

- `src/distributions/nchisq.ts`, `src/distributions/nbeta.ts` (existing files): pchisq / pbeta with ncp are off by up
  to 1.4e-13 at ncp around 1000 (audit). Cause: the kernels form the component shape `a + j` in double, so a
  starting component such as P(96.2595 + 1034, 331) is evaluated at a shape rounded by 1e-13, which the far tail
  amplifies by |log(y / (a + j))|. The recurrences themselves already use the exact `twoSum(a, j)`. Proposed fix: correct
  the starting values (and refreshes) to the exact shape with a first-order factor exp(δ · ∂log F/∂a), δ the low part
  of twoSum(a, j). Confirmed for the χ² case; the beta case has the same construction.

## Audit of the distribution functions (`scripts/mpmath/audit.py`, `test/audit.test.ts`)

Random parameters beyond the R fixture grids, both tails and the log scale, against mpmath (references kept only where
40 and 90 digits agree). Results so far are recorded in the commit messages. `test/audit.test.ts` holds pgamma,
ppois, pnchisq and pnbeta at their current accuracy (`pending`) until the two fixes above are decided.

Quantiles (`scripts/mpmath/audit_q.py`, `test/audit_q.test.ts`) are measured relative to max(|x|, P / f(x)), the
change in x that the rounding of the probability argument alone causes, so that ill-conditioned quantiles (qgamma
with a tiny shape) are judged against their condition.
