# Roadmap

English | [日本語](ROADMAP.ja.md)

## Goal

Cover the numerical core of R's `stats` package (and the related parts of `base`) in plain
TypeScript, with R's function names, defaults and numerical results: distributions, descriptive
statistics, hypothesis tests, linear models, special functions, numerical methods and the basics
of linear algebra. R is the oracle: every function is tested against R's output, and against
high-precision reference values where R itself is inaccurate (see [docs/accuracy.md](docs/accuracy.md)).

The point is to fill a gap. JavaScript has libraries for distributions and special functions
(such as [stdlib-js](https://github.com/stdlib-js/stdlib), which is accurate and broad) and for
descriptive statistics, and R itself can run in the browser through WebAssembly (webR), at the
cost of a download of tens of megabytes. What is missing is a light library whose results can
be trusted to match R, from the distributions up to the hypothesis tests, including R's
`set.seed()` random streams.

SciPy (`scipy.stats`, `scipy.special`, `scipy.linalg`) is a source of ported code and a guide
to what is useful, but not a target: functions that have no counterpart in R cannot be checked
against R and are not a priority.

## Done

| Area | Status |
|---|---|
| Special functions | `gamma`, `lgamma`, `beta`, `lbeta`, `choose`, `lchoose`, `factorial`, `lfactorial`, `digamma`, `trigamma`, `psigamma`, `besselI`, `besselK`, `besselJ`, `besselY`, and `erf`, `erfc`, `erfinv`, `erfcinv`, `gammainc`, `perm` (not in R) exported; log1p-type functions are implemented internally |
| Distributions | d/p/q with `lowerTail` and `logP` for all 20 distributions in R's `stats` (including the studentized range), the non-central chi-squared, t, F and beta, and inverse gamma, Kumaraswamy, Pareto, triangular, Laplace (extraDistr) and arcsine; `distSummary` for all of them |
| Random numbers | R's default Mersenne-Twister with `set.seed()`-compatible streams, 26 `r*` functions (extraDistr's streams for the extra distributions), `rmultinom`, `sample`, `sampleInt` |
| Descriptive statistics | R's summaries (`mean`, `variance`, `quantile` with all nine types, `rank`, `cov`/`cor` matrices, `table`, `cut`, `hist`, `ecdf`, `scale`, ...) and e1071's and DescTools' (`skewness`, `kurtosis`, `geometricMean`, `modes`, `meanAD`, `cv`) |
| Hypothesis tests | R's `htest` functions: `tTest`, `chisqTest`, `fisherTest` (including r × c), `wilcoxTest`, `corTest`, `binomTest`, `poissonTest`, `propTest`, `mcnemarTest`, `varTest`, `bartlettTest`, `kruskalTest`, `friedmanTest`, `quadeTest`, `flignerTest`, `moodTest`, `onewayTest`, `shapiroTest`, `mantelhaenTest`, `ansariTest`, `ksTest`, the `pairwise*` helpers, `pAdjust`; `aov` (one way), `TukeyHSD`, `zTest` (BSDA) |
| Linear models | `lm` with a matrix interface and `summary.lm`'s quantities, `confint`, `predict` |
| Linear algebra | the matrix functions of R's `base` and `MASS::ginv`: matrix arithmetic, `crossprod`, `norm`, `backsolve`, `chol`, `qr` (R's pivoting and LAPACK), `solve`, `det`, `rcond`, `kappa`, `svd`, `eigen` (symmetric and general), `lu`, `prcomp`, `ginv` |
| Numerical methods | `integrate`, `optimize`, `uniroot`, `approx`, `spline`/`splinefun`/`splinefunH`, Lagrange (pracma) and Hermite interpolation, fixed-step `ode` (deSolve), `grad`/`jacobian`/`hessian` (numDeriv) |
| jStat | every jStat function has a replacement ([docs/migrating-from-jstat.md](docs/migrating-from-jstat.md)), checked against jStat |

The full list is in the [README](README.md#what-is-included); known differences from R are in
[docs/differences-from-r.md](docs/differences-from-r.md).

## Remaining

In order of priority.

1. **Hypothesis tests:** `ansari.test`'s confidence interval, `simulate.p.value` for `chisqTest`
   and `fisherTest`, and passing two factor vectors to `chisqTest`.
2. **Special functions:** the log1p-type functions that rStats.js implements internally may follow
   as extras.
3. **Distributions:** recycling of distribution parameters as vectors. To decide first: which
   arguments are vectorised (R recycles every numeric argument), whether lengths that do not divide
   are recycled silently as in R or rejected with a RangeError, the return type (`number[]` as soon
   as one argument is an array? and `Float64Array`), and for the r* functions (`rnorm(n, mean =
   vector)`) the order in which the random stream is consumed, which must match R. Proposal:
   recycle to the longest length, as R does.
4. **Speed:** a fast double-precision path that switches to double-double only where needed, and
   an asymptotic expansion for the incomplete beta function with large parameters (see
   [docs/performance.md](docs/performance.md)).
5. **Random numbers:** RNG kinds other than R's default.

Possible later, each a sizeable project of its own:

- **Linear models beyond `lm`:** `glm` with a matrix interface (there is no formula or data frame
  in JavaScript).
- **Linear algebra beyond `base`:** Schur and the matrix exponential, checked against the
  recommended package `Matrix` and the `expm` package.
- **Optimisation:** `optim`.

Out of scope: the parts of SciPy with no counterpart in R (most of `scipy.special` and the
distributions that only `scipy.stats` has).

## Size

Users of a bundler only get the functions they import (`pnorm` alone is 1.2 KB gzipped), so
adding functions costs them nothing. For CDN use there is one file per area
(`dist/distributions.js`, `dist/tests.js`, `dist/linalg.js`, `dist/descriptive.js`,
`dist/numerics.js`, `dist/special.js`), built with esbuild's code splitting so that shared code is
not duplicated, and `dist/rstats.js` with everything. The same areas are subpath exports of the
package (`@numero-uno-jpn/rstats/linalg`, ...). `npm run size` reports the sizes. After
publishing to npm, CDNs that bundle per export (such as esm.sh with `?exports=`) are a further
option.

## Sources for ported code

- Port only from permissively licensed sources: SciPy and xsf (BSD-3), Boost.Math (BSL-1.0),
  statsmodels (BSD-3), lifelines (MIT), the LAPACK reference implementation (modified BSD),
  public-domain code (LINPACK, EISPACK, Cephes as distributed with xsf), and published papers.
- R is the oracle that results are checked against. R's source may be read to find out how R
  behaves, but R's code and GPL packages are never copied or translated, so that rStats.js can stay
  MIT licensed.
- Each ported file names its source, and the source is listed in
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). See also [CONTRIBUTING.md](CONTRIBUTING.md).
