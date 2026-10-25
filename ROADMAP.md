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
| Special functions | `gamma`, `lgamma`, `beta`, `lbeta`, `choose`, `lchoose`, `factorial`, `lfactorial`, `digamma`, `trigamma`, `psigamma`, `besselI`, `besselK`, `besselJ`, `besselY`, and `erf`, `erfc`, `erfinv`, `erfcinv`, `gammainc`, `perm` (not in R), and the log1p-type functions of R's C API `log1pmx`, `lgamma1p`, `log1mexp`, `log1pexp` |
| Distributions | d/p/q with `lowerTail` and `logP` for all 20 distributions in R's `stats` (including the studentized range), the non-central chi-squared, t, F and beta, and inverse gamma, Kumaraswamy, Pareto, triangular, Laplace (extraDistr) and arcsine; `distSummary` for 23 of them (all but the Wilcoxon signed rank and rank sum distributions and the studentized range) |
| Random numbers | R's default Mersenne-Twister with `set.seed()`-compatible streams, and `RNGkind` with `"L'Ecuyer-CMRG"` (with `parallel`'s `nextRNGStream` and `nextRNGSubStream`) and `sample.kind = "Rounding"`; 26 `r*` functions including `rmultinom` (extraDistr's streams for the extra distributions), `sample`, `sampleInt`, `r2dtable` |
| Descriptive statistics | R's summaries (`mean`, `variance`, `quantile` with all nine types, `rank`, `cov`/`cor` matrices, `table`, `cut`, `hist`, `ecdf`, `scale`, ...) and e1071's and DescTools' (`skewness`, `kurtosis`, `geometricMean`, `modes`, `meanAD`, `cv`) |
| Hypothesis tests | R's `htest` functions: `tTest`, `chisqTest` (including simulated p-values and two factor vectors), `fisherTest` (including r × c and simulated p-values), `wilcoxTest`, `corTest`, `binomTest`, `poissonTest`, `propTest`, `mcnemarTest`, `varTest`, `bartlettTest`, `kruskalTest`, `friedmanTest`, `quadeTest`, `flignerTest`, `moodTest`, `onewayTest`, `shapiroTest`, `mantelhaenTest`, `ansariTest` (with its confidence interval), `ksTest`, the `pairwise*` helpers, `pAdjust`; `aov` (one way), `TukeyHSD`, `zTest` (BSDA), `brunnerMunzelTest` (lawstat) |
| Linear models | `lm` with a matrix interface and `summary.lm`'s quantities, `confint`, `predict`; `glm` with a matrix interface for every family and link of R's stats, with `summary.glm`'s quantities, the four kinds of residuals, `hatvalues`/`rstandard`/`cooks.distance`, `predict` with standard errors, profile likelihood `confint` (solved exactly) and `anova` |
| Linear algebra | the matrix functions of R's `base`, with `Matrix::lu`, `prcomp` (`stats`) and `MASS::ginv`: matrix arithmetic, `crossprod`, `norm`, `backsolve`, `chol`, `qr` (R's pivoting and LAPACK), `solve`, `det`, `rcond`, `kappa`, `svd`, `eigen` (symmetric and general), `lu`, `prcomp`, `ginv` |
| Numerical methods | `integrate`, `optimize`, `uniroot`, `approx`, `spline`/`splinefun`/`splinefunH`, Lagrange (pracma) and Hermite interpolation, fixed-step `ode` (deSolve), `grad`/`jacobian`/`hessian` (numDeriv) |
| jStat | every jStat function has a replacement ([docs/migrating-from-jstat.md](docs/migrating-from-jstat.md)), checked against jStat |

The full list is in the [README](README.md#what-is-included); known differences from R are in
[docs/differences-from-r.md](docs/differences-from-r.md).

## Remaining

In order of priority.

1. **Speed:** done for now: the incomplete beta function with both parameters large uses Temme's
   uniform asymptotic expansion (constant time instead of a continued fraction of length √(a + b)),
   with one parameter large and the other small DiDonato and Morris's expansion (`pt` and `pf` with
   large degrees of freedom, `pbeta(x, 1e6, 10)`, `pbinom` with x near 0 or n: about the time of a
   typical `pbeta` instead of up to 30 times more), and the main d/p functions leave out the
   double-double steps that an error bound shows to be unnecessary (see
   [docs/performance.md](docs/performance.md)). Remaining: the continued fraction, which stays in
   double-double and is still used where neither expansion applies (moderate parameters, such as
   a = 30 and b = 20, where it is short, and the far tails).

Possible later, each a sizeable project of its own:

- **Linear algebra beyond `base`:** Schur and the matrix exponential, checked against the
  recommended package `Matrix` and the `expm` package.
- **Optimisation:** `optim`.

Out of scope: the parts of SciPy with no counterpart in R (most of `scipy.special` and the
distributions that only `scipy.stats` has). Also out of scope: recycling distribution parameters as
vectors (`rnorm(3, mean = c(0, 10, 100))`), since `map` does the same with R's results and random
stream (see [docs/differences-from-r.md](docs/differences-from-r.md#general)). The other RNG kinds
(Wichmann-Hill, Marsaglia-Multicarry, Super-Duper, Knuth-TAOCP) and normal kinds
(Kinderman-Ramberg, Ahrens-Dieter, Box-Muller) are out of scope too: they serve only to reproduce
old code.

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
