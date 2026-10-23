# Roadmap

English | [日本語](ROADMAP.ja.md)

## Goal

Cover the numerical core of R's `stats` package (and the related parts of `base`) in plain
TypeScript, with R's function names, defaults and numerical results: distributions, hypothesis
tests, special functions and the basics of linear algebra. R is the oracle: every function is
tested against R's output, and against high-precision reference values where R itself is
inaccurate (see [docs/accuracy.md](docs/accuracy.md)).

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
| Special functions | `gamma`, `lgamma`, `beta`, `lbeta` exported; the incomplete gamma and beta functions, erf/erfc and log1p-type functions are implemented internally |
| Distributions | d/p/q with `lowerTail` and `logP` for all 20 distributions in R's `stats` (including the studentized range), plus the non-central chi-squared, t, F and beta |
| Random numbers | R's default Mersenne-Twister with `set.seed()`-compatible streams, 20 `r*` functions, `rmultinom`, `sample`, `sampleInt` |
| Hypothesis tests | `tTest`, `chisqTest`, `fisherTest` (including r × c), `wilcoxTest` (exact and approximate, with intervals), `cor`, `corTest`, `pAdjust`, returning all of R's `htest` fields |
| Linear algebra | the matrix functions of R's `base` and `MASS::ginv`: `crossprod`, `norm`, `backsolve`, `chol`, `qr` (R's pivoting and LAPACK), `solve`, `det`, `rcond`, `kappa`, `svd`, `eigen` (symmetric and general), `ginv` |

The full list is in the [README](README.md#what-is-included); known differences from R are in
[docs/differences-from-r.md](docs/differences-from-r.md).

## Remaining

In order of priority.

1. **Hypothesis tests:** the rest of the tests in R's `stats`, which is where the gap in
   JavaScript is widest: `binom.test`, `prop.test`, `poisson.test`, `mcnemar.test`,
   `mantelhaen.test`, `ks.test`, `shapiro.test`, `kruskal.test`, `friedman.test`,
   `quade.test`, `var.test`, `bartlett.test`, `fligner.test`, `ansari.test`, `mood.test`,
   `oneway.test` and the `pairwise.*` helpers. Also `simulate.p.value` for `chisqTest` and
   `fisherTest`, and passing two factor vectors to `chisqTest`.
2. **Special functions:** the rest of what R's `base` has: `digamma`, `trigamma`, `psigamma`,
   `choose`, `lchoose`, `factorial`, `lfactorial`, and the Bessel functions (`besselI`,
   `besselJ`, `besselK`, `besselY`). Functions that R lacks but rStats.js already implements
   internally (erf/erfc, log1p-type functions) may be exported as extras.
3. **Distributions:** recycling of distribution parameters as vectors; `dmultinom`.
4. **Accuracy:** 15 `pnbinom` cases where the shared incomplete beta function falls short of R
   (see [docs/accuracy.md](docs/accuracy.md#known-accuracy-problems)).
5. **Speed:** a fast double-precision path that switches to double-double only where needed, and
   an asymptotic expansion for the incomplete beta function with large parameters (see
   [docs/performance.md](docs/performance.md)).
6. **Random numbers:** RNG kinds other than R's default.

Possible later, each a sizeable project of its own:

- **Linear models:** `lm` and `glm` with a matrix interface (there is no formula or data frame
  in JavaScript).
- **Linear algebra beyond `base`:** LU, Schur and the matrix exponential, checked against the
  recommended package `Matrix` and the `expm` package.
- **Optimisation:** `optim`, `optimize`, `uniroot`, `integrate`.

Out of scope: the parts of SciPy with no counterpart in R (most of `scipy.special` and the
distributions that only `scipy.stats` has).

## Size

Users of a bundler only get the functions they import (`pnorm` alone is 1.2 KB gzipped), so
adding functions costs them nothing. The single-file CDN build `dist/rstats.js` includes
everything (72 KB gzipped in 0.5.0). Once it passes about 100 KB gzipped, add one entry file per
area (`dist/distributions.js`, `dist/tests.js`, `dist/linalg.js`, …) with esbuild's code
splitting, so that shared code is not duplicated, and keep `dist/rstats.js` as the build with
everything. After publishing to npm, CDNs that bundle per export (such as esm.sh with
`?exports=`) are a further option.

## Sources for ported code

- Port only from permissively licensed sources: SciPy and xsf (BSD-3), Boost.Math (BSL-1.0),
  statsmodels (BSD-3), lifelines (MIT), the LAPACK reference implementation (modified BSD),
  public-domain code (LINPACK, EISPACK, Cephes as distributed with xsf), and published papers.
- R is used only as an oracle, to observe what it returns. R's source code and GPL packages are
  never read, copied or translated, so that rStats.js can stay MIT licensed.
- Each ported file names its source, and the source is listed in
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). See also [CONTRIBUTING.md](CONTRIBUTING.md).
