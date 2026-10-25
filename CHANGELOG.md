# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

While the version is 0.x, a minor release (0.y.0) may contain breaking changes;
they are listed under **Breaking** for each release. From 1.0.0 the project follows
[Semantic Versioning](https://semver.org/).

## Unreleased

### Added

- `RNGkind({ kind, sampleKind })` (R's `RNGkind()`): the `"L'Ecuyer-CMRG"` generator (L'Ecuyer's
  MRG32k3a) besides R's default Mersenne-Twister, and `sampleKind: "Rounding"`, the `sample` of R
  before 3.6.0 (affects `sample`, `sampleInt` and `rwilcox`), with R's streams after the same seed.
  As in R, changing the kind in the middle of a stream seeds the new generator from the next
  uniform, and the call returns the previous kinds. R's `set.seed(seed, kind, sample.kind)` is
  `RNGkind({ kind, sampleKind })` followed by `setSeed(seed)`.
- `nextRNGStream` and `nextRNGSubStream` (R's `parallel::nextRNGStream()` and
  `nextRNGSubStream()`): the L'Ecuyer-CMRG state advanced by 2^127 or 2^76 steps, for independent
  streams in parallel work.
- `getRandomSeed` and `setRandomSeed` handle every supported combination in R's `.Random.seed`
  format (kind code `10403`, `403` with Rounding, `10407` for L'Ecuyer-CMRG with 6 seeds).
- `brunnerMunzelTest` (`lawstat::brunner.munzel.test()`): the Brunner-Munzel test for the relative
  effect P(X < Y) + P(X = Y)/2 of two samples, with its interval. The interval is set with
  `confLevel` (lawstat's `alpha = 1 - confLevel`); small p-values are computed from the upper tail
  directly, where lawstat's 1 − P loses them. It adds 0.4 KB gzipped to everything (121.8 → 122.2
  KB with the speed-up below).

### Changed

- `sampleInt` accepts n up to 4.5e15, as R (before: less than 2^31), when sampling with
  replacement or with a size of at most n / 2 (`sampleInt(1e10, { size: 3 })`); weighted sampling and
  sampling more than half without replacement still need n < 2^31. Uniform integers above 2^47 are
  built from random bits without rounding.
- Bundle size: `setSeed` with `rnorm` is unchanged (1.7 KB gzipped); `sampleInt` grows from 1.9 to
  2.1 KB and `getRandomSeed` with `setRandomSeed` from 1.0 to 1.5 KB (they read L'Ecuyer-CMRG
  states). The new generator is only included with `RNGkind`, `setRandomSeed` or the stream
  functions. Everything together grows from 119.6 to 120.9 KB.

- Speed: the incomplete beta function with both parameters large (ab/(a + b) >= 25, x near the
  mean) uses Temme's uniform asymptotic expansion, in constant time (about 1 µs):
  `pbeta(0.5, 1e6, 1e6)` becomes about 245 times faster and `pbinom(n/2, n, 0.5)` with n = 1e6
  about 170 times. The continued fraction of the incomplete beta function runs without array
  allocations (bit-identical results, about twice as fast), and Loader's deviance, `dbeta` and the
  prefactors leave out double-double steps whose rounding an error bound shows to be negligible.
  On typical inputs (`npm run bench`, Apple M1): `pbeta` 1.6, `dbeta` 2.0, `pt` 1.7, `dbinom` 2.1,
  `pf` 1.7, `qbeta` 1.8 and `qgamma` 1.3 times faster (see [docs/performance.md](docs/performance.md)).
  Accuracy is unchanged: all tests pass with the same tolerances, and new mpmath fixtures cover
  the large-parameter region.
- Bundle size: the expansion and the allocation-free loop add about 3.6 KB gzipped to everything
  that uses the incomplete beta function (`qbeta` 18.5 → 22.1 KB, `pt` and `qt` 25.5 → 29.4 KB,
  `tTest` 16.7 → 20.3 KB, everything 115.4 → 119.6 KB).
- Speed: the incomplete beta function with one parameter large and the other small (a >= 15,
  b <= 40, x in the bulk) uses DiDonato and Morris's asymptotic expansion (TOMS 708, eq. 9, in the
  form of Boost.Math's `beta_small_b_large_a_series`) where it used the continued fraction, whose
  length stops growing with a but which took 30 to 170 double-double steps there. This covers `pt`
  and `pf` with large degrees of freedom, `pbeta(x, 1e6, 10)` and `pbinom` with x near 0 or n:
  `pt(1.5, 1e6)` becomes 12 times faster, `pbeta(1 - b/(a + b), 1e10, 0.5)` 31 times,
  `pf(3, 1, 1e5)` 14 times, `pbeta(1 - b/(a + b), 1e6, 10)` 1.4 times, and `pt` over t ~ N(0, 3²)
  takes about the same time for every df from 1e5 to 1e15 (5 to 9 times faster); `qt`, `qbeta`,
  `qf` and `qbinom` there become about 2 times faster (see [docs/performance.md](docs/performance.md)).
  Its cases are within 1.2e-15 of mpmath and Rmpfr references, as the continued fraction was; new
  mpmath fixtures cover a from 15 to 1e10 and b from 0.1 to 40.
- Bundle size: the expansion adds 0.8 to 1.1 KB gzipped (`pt` and `qt` 29.4 → 30.3 KB, `qbeta`
  22.1 → 23.2 KB, `tTest` 20.3 → 21.4 KB, everything 120.9 → 121.8 KB).

### Fixed

- Weighted sampling with replacement by Walker's alias method (more than 200 likely candidates)
  compares in the same way as R (t + u against q[t] + t), so that rounding cannot pick a different
  candidate in rare cases.
- The log of the larger tail of the incomplete beta function for x (or 1 − x) in the subnormal
  range: `pbeta(1e-308, 1, 1e8, lowerTail: false, logP: true)` was off by 4.7e-14, as R's value
  still is (now 1.8e-15).
- `pt` and `pf` with degrees of freedom above about 1e21 (the continued fraction in the frame of the
  large parameter, now replaced by the expansion for large a): `pt(0.001, 1e22, lowerTail: false)`
  was 1.19 and `pt(0.01, 1e25)` off by 2.6e-4; with degrees of freedom from about 1e153 on, `pt` and
  `pf` returned NaN (`pt(1, 1e160)`, `pf(2, 3, 1e160)`). `pt` now agrees with its normal limit to
  5e-16 for |t| up to 31.6 (beyond, where the tail is below 1e-218, the NaN remains for df from
  1e153 on).

## 0.7.0 - 2026-10-25

### Added

- `ansariTest`: `confInt` and `confLevel` (R's `conf.int = TRUE`), the confidence interval for the
  ratio of scales and its estimate, exact and by the normal approximation.
- `chisqTest` and `fisherTest`: `simulatePValue` and `B` (R's `simulate.p.value`, default 2000),
  with Monte Carlo p-values from the random stream of `setSeed`, the same as R's after `set.seed()`.
- `chisqTest(x, y, options)` with two factor vectors (arrays of labels; `null` for missing values):
  the test of independence in their table, with the levels in `rowLevels` and `colLevels`.
- `r2dtable` (random two-way tables with given margins, Patefield's algorithm), with R's random
  stream.
- `log1pmx`, `lgamma1p`, `log1mexp` and `log1pexp`, the log1p-type functions of R's C API
  (Rmath.h), checked against correctly rounded values.

### Changed

- With ties and `exact` unset, R's `ansari.test(conf.int = TRUE)` fails ("object 'cint' not
  found"); `ansariTest` returns the normal-approximation interval there (see
  [docs/differences-from-r.md](docs/differences-from-r.md)).
- Bundle size: `chisqTest` now includes the random number generator, `sample` and `r2dtable`;
  the `tests` entry grows from 59.4 KB to 65.2 KB gzipped, `fisherTest` alone from 13.8 KB to
  15.4 KB, and everything from 112.4 KB to 115.4 KB.

## 0.6.1 - 2026-10-24

The first release of the 0.6 series on npm. A `v0.6.0` tag was pushed to GitHub earlier the same
day but never published to npm and has been withdrawn; use 0.6.1.

### Added

- Everything jStat offers, with R's names and defaults, and a migration guide
  ([docs/migrating-from-jstat.md](docs/migrating-from-jstat.md)) whose replacements are checked
  against jStat itself (`test/jstat-replacement.test.ts`):
  - descriptive statistics (`@numero-uno-jpn/rstats/descriptive`): `sum`, `prod`, `mean` (with `trim`),
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
  - numerical methods (`@numero-uno-jpn/rstats/numerics`): `integrate`, `optimize`, `uniroot` (with
    `extendInt`), `approx`, `spline`, `splinefun`, `splinefunH`, `barylag` (pracma),
    `hermiteInterp`, `ode` (fixed-step, deSolve), `grad`, `jacobian`, `hessian` (numDeriv);
  - distributions outside base R with extraDistr's names: `invgamma`, `kumar`, `pareto`, `triang`,
    `laplace`, and `arcsine` (d/p/q/r), and `distSummary` (mean, variance, sd, median, mode,
    skewness, kurtosis) for 23 distributions (all but signrank, wilcox and tukey);
  - special functions: `gammainc`, `erfinv`, `erfcinv`, `perm`.
- Subpath exports and per-area CDN files: `@numero-uno-jpn/rstats/distributions`, `/tests`, `/linalg`,
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

### Changed

- Code that followed the GPL sources of R (and of BSDA, for `zTest`) too closely was re-implemented independently, so that the
  package stays MIT licensed: `propTest`, the two-sided p-values of `poissonTest` and `binomTest`,
  the exact 2 × 2 parts of `mantelhaenTest` and `fisherTest`, the intervals of `wilcoxTest`,
  `zTest`, `approx`, `spline`, `splinefun`, `splinefunH`, `uniroot`, `seq`, `pretty`, `hist` and
  `quantile`.
- `uniroot`'s zero finder is now a port of netlib's `zeroin.f` (public domain).
- **Type change:** `fStatistic` and `fPValue` of `lm`'s result are optional; they are absent for a
  model with nothing beyond the intercept, as `summary.lm` has no `fstatistic` there.
- The error messages of `grad`, `jacobian`, `hessian` and `zTest` are worded differently.

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
- Fixed since the withdrawn `v0.6.0` tag:
  - `propTest` with missing groups and with `p`; `pairwisePropTest` with missing groups (dropped and
    the rest renumbered, as in R);
  - `uniroot` when `f` returns a non-finite value;
  - default number of points and range of `spline`, now taken from the regularized x;
  - the third derivative of `splinefunH` and of `splinefun` with `method: "monoH.FC"` is now the
    exact one; R returns h times it on an interval of width h (see docs/differences-from-r.md);
  - `lm` with weights of 0 (those rows are left out of the fit, all zero is an error) and with an
    intercept-only model (R² = 0 and no F test, as in R);
  - `optimize` with `lower >= upper` is now an error, as in R;
  - a non-integer `deriv` (`splinefun`, `splinefunH`) is truncated and non-integer lengths (`n`)
    are rounded up, as in R;
  - `barylag` with duplicate nodes; `lu` forms its multipliers as LAPACK does;
  - `TukeyHSD` comparison names (labels, or positions in the list; groups without data left out);
  - `kruskalTest` and `flignerTest` with an empty group, `mcnemarTest` with different numbers of
    levels in x and y, `bartlettTest` with infinite values, `poissonTest` with zero counts and
    zero `T` or `r`, all now as in R;
  - accuracy of `besselK` and `besselI` for orders near 2.5, the arcsine distribution near its
    upper end, `gammainc` for large a, `perm` (overflow and non-integer k), the `distSummary` kurtosis of
    `lnorm` for small sdlog, `psigamma` for large x, `beta` for huge a, and `choose` for
    non-integer n;
  - `pretty` no longer overflows for huge ranges.

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
