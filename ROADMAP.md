# Roadmap

## Goal

Cover the scope of SciPy's `scipy.stats`, `scipy.special` and `scipy.linalg` in plain
TypeScript, with R's function names, defaults and numerical results. R is the oracle: every
function is tested against R's output, and against high-precision reference values where R
itself is inaccurate (see [docs/accuracy.md](docs/accuracy.md)).

Compared with other JavaScript libraries such as [stdlib-js](https://github.com/stdlib-js/stdlib),
which covers distributions and special functions with high accuracy, rStats.js aims at R's names,
defaults and results, guarantees agreement with R by testing every function, and extends to the
hypothesis-test layer.

## Done

| Area | Status |
|---|---|
| Special functions | `gamma`, `lgamma`, `beta`, `lbeta` exported; the incomplete gamma and beta functions, erf/erfc and log1p-type functions are implemented internally |
| Distributions | d/p/q with `lowerTail` and `logP` for 20 distributions (including the studentized range), plus the non-central chi-squared, t, F and beta |
| Random numbers | R's default Mersenne-Twister with `set.seed()`-compatible streams, 20 `r*` functions, `sample`, `sampleInt` |
| Hypothesis tests | `tTest`, `chisqTest`, `fisherTest` (including r × c), `wilcoxTest` (exact and approximate, with intervals), `cor`, `corTest`, `pAdjust`, returning all of R's `htest` fields |
| Linear algebra | the core of `scipy.linalg` that has a counterpart in R (base and MASS): `crossprod`, `norm`, `backsolve`, `chol`, `qr` (R's pivoting and LAPACK), `solve`, `det`, `rcond`, `kappa`, `svd`, `eigen` (symmetric and general), `ginv` |

The full list is in the [README](README.md#what-is-included); known differences from R are in
[docs/differences-from-r.md](docs/differences-from-r.md).

## Remaining within the scope

- **Special functions:** export the functions already used internally (incomplete gamma and
  beta, erf/erfc, log1p/expm1-type functions) and add the rest of `scipy.special`, starting
  with digamma and binomial coefficients.
- **Distributions:** recycling of distribution parameters as vectors; further distributions in
  `scipy.stats` that have an R counterpart.
- **Hypothesis tests:** further tests in `scipy.stats` with an R counterpart; `simulate.p.value`
  for `chisqTest` and `fisherTest`; passing two factor vectors to `chisqTest`.
- **Linear algebra:** decompositions not yet included, such as LU, Schur and the matrix
  exponential.
- **Random numbers:** RNG kinds other than R's default.
- **Accuracy:** 15 `pnbinom` cases where the shared incomplete beta function falls short of R
  (see [docs/accuracy.md](docs/accuracy.md#known-accuracy-problems)).
- **Speed:** a fast double-precision path that switches to double-double only where needed, and
  an asymptotic expansion for the incomplete beta function with large parameters (see
  [docs/performance.md](docs/performance.md)).

Things outside SciPy's scope, such as linear and generalised linear models (`lm`, `glm`) and
`optim`, may be added later.

## Sources for ported code

- Port only from permissively licensed sources: SciPy and xsf (BSD-3), Boost.Math (BSL-1.0),
  statsmodels (BSD-3), lifelines (MIT), the LAPACK reference implementation (modified BSD),
  public-domain code (LINPACK, EISPACK, Cephes as distributed with xsf), and published papers.
- R is used only as an oracle, to observe what it returns. R's source code and GPL packages are
  never read, copied or translated, so that rStats.js can stay MIT licensed.
- Each ported file names its source, and the source is listed in
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). See also [CONTRIBUTING.md](CONTRIBUTING.md).
