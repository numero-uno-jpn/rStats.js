# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

While the version is 0.x, a minor release (0.y.0) may contain breaking changes;
they are listed under **Breaking** for each release. From 1.0.0 the project follows
[Semantic Versioning](https://semver.org/).

## 0.6.0 - 2026-10-24

### Added

- Everything jStat offers, with R's names and defaults, and a migration guide
  ([docs/migrating-from-jstat.md](docs/migrating-from-jstat.md)) whose replacements are checked
  against jStat itself (`test/jstat-replacement.test.ts`):
  - descriptive statistics (`rStats.js/descriptive`): `sum`, `prod`, `mean` (with `trim`),
    `weightedMean`, `variance` (R's `var`), `sd`, `median`, `range`, `cumsum`, `cumprod`, `cummax`,
    `cummin`, `diff`, `quantile` (all nine types), `IQR`, `fivenum`, `mad`, `rank`, `cov` and `cor`
    for vectors and matrices (Pearson, Kendall, Spearman, with `use`), `tabulate`, `table`, `unique`,
    `cut`, `findInterval`, `pretty`, `hist`, `ecdf`, `scale`, and `skewness`, `kurtosis` (e1071),
    `geometricMean`, `modes`, `meanAD`, `cv` (DescTools); sums in double-double;
  - matrix arithmetic: `matMul`, `add`, `subtract`, `multiply`, `divide`, `outer`, `t`, `diag`,
    `cbind`, `rbind`, `matrix`, `kronecker`, `seq`, and `lu` (`Matrix::lu`) and `prcomp`;
  - hypothesis tests: `binomTest`, `poissonTest`, `propTest`, `mcnemarTest`, `varTest`,
    `bartlettTest`, `kruskalTest`, `friedmanTest`, `quadeTest`, `flignerTest`, `moodTest`,
    `onewayTest`, `shapiroTest`, `mantelhaenTest`, `ansariTest`, `ksTest`, `pairwiseTTest`,
    `pairwiseWilcoxTest`, `pairwisePropTest`, `aov` (one way), `TukeyHSD` and `zTest` (BSDA);
  - linear models: `lm` with a matrix interface and the quantities of `summary.lm`, `confint`,
    `predict`;
  - numerical methods (`rStats.js/numerics`): `integrate`, `optimize`, `uniroot` (with
    `extendInt`), `approx`, `spline`, `splinefun`, `splinefunH`, `barylag` (pracma),
    `hermiteInterp`, `ode` (fixed-step, deSolve), `grad`, `jacobian`, `hessian` (numDeriv);
  - distributions outside base R with extraDistr's names: `invgamma`, `kumar`, `pareto`, `triang`,
    `laplace`, and `arcsine` (d/p/q/r), and `distSummary` (mean, variance, sd, median, mode,
    skewness, kurtosis) for all 23 distributions;
  - special functions: `gammainc`, `erfinv`, `erfcinv`, `perm`.
- Subpath exports and per-area CDN files: `rStats.js/distributions`, `/tests`, `/linalg`,
  `/descriptive`, `/numerics`, `/special` (`dist/<area>.js`, with shared code split out).
- `choose`, `lchoose`, `factorial` and `lfactorial`, for any real `n` (and `x`).
- `digamma`, `trigamma` and `psigamma` (derivatives up to 100, negative arguments by
  reflection; unlike R, also for x < 0 with deriv ≥ 6).
- `besselI`, `besselK` (with `exponScaled`, R's `expon.scaled`), `besselJ` and `besselY` for any
  real order, ported from Boost.Math.
- The option `rCompatible` of `choose`, `lchoose`, `trigamma` and `psigamma` (type
  `RCompatibleOptions`): by default they follow R at its edge cases (n near an integer in
  `choose`, infinite arguments); `rCompatible: false` returns the mathematical values there.
- `erf` and `erfc`, which R lacks (checked against mpmath). `erfc` is now accurate in the far tail:
  it forms exp(-x^2) from an exact x^2 and no longer flushes subnormal results to 0.
- `dmultinom`, as a product of binomial probabilities (accurate for large counts).
- The new functions are checked against R 4.5.2, and against mpmath (100 to 800 digits) where R
  is inaccurate or fails (docs/differences-from-r.md).

### Fixed

- `lbeta` and `beta` with an argument of 2^52 or more: `lbeta(1e17, 31)` was off by 20 and
  `lbeta(1e100, 31)` returned 0.92 instead of -7063.

- Accuracy of the incomplete beta function behind `pbeta`, `pt`, `pf`, `pbinom` and `pnbinom`
  (checked against mpmath). The 15 `pnbinom` cases that were excluded as known accuracy
  problems now pass:
  - results near 1e-308 kept their exponent only to double precision (up to 1.2e-13 relative);
  - the continued fraction rounded a + b, losing the digits of a small b (up to 6e-11 relative,
    e.g. `pnbinom(1e8, 0.01, mu = 1e4)`).
- With parameters of 2^52 or more the continued fraction stopped advancing its coefficients, and
  a result could pass through a subnormal intermediate: `pnbinom` with q around 1e17 was off by
  up to 1e-3 relative, and returned NaN in some cases.
- `pgamma` and `ppois` with a shape (or lambda) above about 1e6, 5 to 40 standard deviations below
  the mean (lower tail of `pgamma`, upper tail of `ppois`): off by up to 2e-14 relative, now 2.7e-15.
  The series is summed in double-double there, which makes those calls about 9 times slower.
- `pchisq` and `pbeta` with `ncp` around 1000 in the far tails: off by up to 1.4e-13 relative, now
  below 5e-15 (the terms of the Poisson mixture are corrected to the exact shape a + j).

## 0.5.0 - 2026-10-21

First public version.

### Included

- Special functions: `gamma`, `lgamma`, `beta`, `lbeta`.
- d/p/q functions with `lowerTail` and `logP` for the normal, t, chi-squared, F, beta, gamma,
  binomial, Poisson, uniform, exponential, log-normal, logistic, Cauchy, Weibull, geometric,
  negative binomial, hypergeometric, Wilcoxon signed rank and rank sum, and studentized range
  distributions, and the non-central chi-squared, t, F and beta (`ncp`).
- Random numbers that reproduce R's `set.seed()` streams: `setSeed`, `getRandomSeed`,
  `setRandomSeed`, 20 `r*` functions, `sample` and `sampleInt`.
- Hypothesis tests returning R's `htest` fields as plain objects: `tTest`, `chisqTest`,
  `fisherTest` (including r × c tables), `wilcoxTest` (exact and normal approximation, with
  confidence intervals), `cor`, `corTest` and `pAdjust`.
- Linear algebra on matrices given as arrays of rows: `crossprod`, `tcrossprod`, `norm`,
  `backsolve`, `forwardsolve`, `chol`, `chol2inv`, `qr` (R's default limited pivoting and the
  LAPACK variant) with `qrQ`, `qrR`, `qrX`, `qrCoef`, `qrQy`, `qrQty`, `qrResid`, `qrFitted`,
  `qrSolve`, `solve`, `det`, `determinant`, `rcond`, `kappa`, `svd`, `eigen` (symmetric and
  general, including complex eigenvalues) and `ginv`.

### Conventions

- Indices are 0-based, matching JavaScript arrays: `sampleInt(n)` returns integers in `0..n-1`
  (R's `sample.int()` minus 1, from the same random stream), and the `pivot` of `qr()` and of
  `chol(x, { pivot: true })` is 0-based.
- Errors are thrown with English messages, and the class tells the kind of problem: `TypeError`
  for wrong types or shapes, `RangeError` for values out of range, and `Error` for numerical
  failures (singular matrix, not positive definite, no convergence, data essentially constant).
- A single-file minified ES module, `dist/rstats.js`, for loading from a CDN; release tags contain
  the build output so that jsDelivr can serve it from GitHub.
- ESM only, no dependencies, tree-shakable. Requires Node.js 22 or later (or another ES2022
  environment).
