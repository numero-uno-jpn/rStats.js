# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

While the version is 0.x, a minor release (0.y.0) may contain breaking changes;
they are listed under **Breaking** for each release. From 1.0.0 the project follows
[Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- `choose`, `lchoose`, `factorial` and `lfactorial`, for any real `n` (and `x`). Checked against
  mpmath so far; `oracle/choose.R` is ready for the comparison with R.
- `digamma`, `trigamma` and `psigamma` (derivatives up to 100, negative arguments by
  reflection). Checked against mpmath so far; `oracle/psigamma.R` is ready.
- `besselI`, `besselK` (with `exponScaled`, R's `expon.scaled`), `besselJ` and `besselY` for any
  real order, ported from Boost.Math. Checked against mpmath so far; `oracle/bessel.R` is ready.
- `erf` and `erfc`, which R lacks (checked against mpmath). `erfc` is now accurate in the far tail:
  it forms exp(-x^2) from an exact x^2 and no longer flushes subnormal results to 0.
- `dmultinom`, as a product of binomial probabilities (accurate for large counts). Checked against
  mpmath so far; `oracle/multinom.R` is ready.

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
