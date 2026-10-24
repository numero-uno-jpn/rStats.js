# Migrating from jStat

English | [日本語](ja/migrating-from-jstat.md)

rStats.js covers every function of [jStat](https://github.com/jstat/jstat) 1.9.6. The names and defaults are
R's, not jStat's, so most calls change shape. This page lists every jStat function with its replacement, the
defaults that differ, and the bugs in jStat that the replacement does not reproduce. Rows marked *(planned)* are not
in rStats.js yet.

rStats.js works on plain arrays (a matrix is an array of rows) and returns plain objects; there is no `jStat(...)`
wrapper, method chaining or callback. Everything can be imported from the package root or from one area
(`@numero-uno-jpn/rstats/descriptive`, `/distributions`, `/tests`, `/linalg`, `/numerics`, `/special`).

## Defaults that differ

| | jStat | rStats.js (R) |
|---|---|---|
| `variance`, `stdev` | population (n) unless `flag` is true | sample (n − 1): `variance`, `sd` |
| `quantiles` | (α, β) = (3/8, 3/8), R's type 9 | `quantile` type 7 (pass `{ type: 9 }`) |
| `percentile` | type 7 (exclusive: type 6) | `quantile` type 7 |
| `range` | max − min | `[min, max]` |
| `coeffvar` | population standard deviation | sample standard deviation |
| `meddev` | median absolute deviation | `mad` multiplies by 1.4826 (pass `{ constant: 1 }`) |
| `skewness`, `kurtosis` | biased (e1071 type 1) | `skewness`, `kurtosis` default to e1071's type 3 |
| `gamma` | (shape, scale) | `(shape, { rate })` by default; pass `{ scale }` |
| `weibull` | (scale, shape) | `(shape, { scale })` |
| `pareto` | (scale, shape) | extraDistr's `{ a: shape, b: scale }` |
| `hypgeom` | (N, m, n): population, successes, draws | `(m, n, k)`: successes, failures, draws |
| `negbin` | (r, p) | `(size, { prob })` (same meaning) |
| `cholesky` | lower triangle | `chol` returns the upper triangle |
| `multiply` | matrix product for two matrices | `matMul`; `multiply` is element-wise |
| one-sided tests (`sides = 1`) | direction of the effect ignored | `alternative: "less"` or `"greater"` |
| random numbers | `Math.random` (or `setRandom`) | R's Mersenne-Twister: `setSeed(n)` reproduces R's `set.seed(n)` |

## Core: arrays and matrices

| jStat | rStats.js | Notes |
|---|---|---|
| `jStat` | JS: arrays (`[1, 2, 3]`, arrays of rows for matrices) | rStats.js works on plain arrays; there is no wrapper object or method chaining. |
| `jStat.utils.calcRdx` | — | Internal helper of jStat's `seq`. |
| `jStat.utils.isArray` | JS: `Array.isArray(x)` |  |
| `jStat.utils.isFunction` | JS: `typeof f === "function"` |  |
| `jStat.utils.isNumber` | JS: `Number.isFinite(x)` | jStat's `isNumber` is true only for finite numbers. |
| `jStat.utils.toVector` | JS: `x.flat()` |  |
| `jStat.setRandom` | `setSeed(seed)` | rStats.js uses R's Mersenne-Twister, so `setSeed(42)` gives the same numbers as R's `set.seed(42)`. A custom generator cannot be plugged in. |
| `jStat.extend` | JS: `Object.assign(target, source)` |  |
| `jStat.rows` | JS: `a.length` |  |
| `jStat.cols` | JS: `a[0].length` |  |
| `jStat.dimensions` | JS: `({ rows: a.length, cols: a[0].length })` |  |
| `jStat.row` | JS: `a[i]` |  |
| `jStat.rowa` | JS: `a[i]` |  |
| `jStat.col` | JS: `a.map((r) => [r[j]])` | jStat returns an n × 1 matrix. |
| `jStat.cola` | JS: `a.map((r) => r[j])` |  |
| `jStat.diag` | `diag(a)` | R's `diag` of a matrix returns its diagonal as a flat array (jStat: an n × 1 matrix). |
| `jStat.antidiag` | JS: `a.map((r, i) => r[r.length - 1 - i])` |  |
| `jStat.diagonal` | `diag(v)` | `diag` of a vector of length ≥ 2 builds the diagonal matrix, as in R. |
| `jStat.transpose` | `t(a)` | `t` always returns a matrix (jStat flattens a 1-row result). |
| `jStat.map` | JS: `a.map((r) => r.map(f))` |  |
| `jStat.cumreduce` | JS: `a.map((r) => { let s = 0; return r.map((v) => (s += v)); })` | For running sums use `cumsum(x)`. |
| `jStat.alter` | JS: `a.forEach((r) => r.forEach((v, j) => (r[j] = f(v))))` |  |
| `jStat.create` | `matrix(data, nrow, ncol)` | Or build the array of rows in JavaScript. |
| `jStat.zeros` | `matrix(0, nrow, ncol)` |  |
| `jStat.ones` | `matrix(1, nrow, ncol)` |  |
| `jStat.rand` | `matrix(runif(nrow * ncol), nrow, ncol)` | Reproducible with `setSeed`. |
| `jStat.identity` | `diag(n)` |  |
| `jStat.symmetric` | JS: `a.every((r, i) => r.every((v, j) => v === a[j][i]))` |  |
| `jStat.clear` | JS: `a.forEach((r) => r.fill(0))` |  |
| `jStat.seq` | `seq(from, to, { lengthOut })` | R's `seq(length.out = n)` hits both ends exactly. |
| `jStat.arange` | `seq(from, to, { by })` | R's `seq` includes `to` when it is reached; `arange` stops before `end`. |
| `jStat.slice` | JS: `a.slice(r0, r1).map((r) => r.slice(c0, c1))` |  |
| `jStat.sliceAssign` | JS: assign to `a[i][j]` in a loop | jStat's version has a bug when the row is an integer (it bounds the columns by the number of rows). |
| `jStat.copy` | JS: `a.map((r) => [...r])` |  |

## Descriptive statistics

| jStat | rStats.js | Notes |
|---|---|---|
| `jStat.sum` | `sum(x)` | Summed in double-double, as R sums in long double. |
| `jStat.sumsqrd` | `sum(x.map((v) => v * v))` |  |
| `jStat.sumsqerr` | `variance(x) * (x.length - 1)` |  |
| `jStat.sumrow` | `sum(x)` |  |
| `jStat.product` | `prod(x)` |  |
| `jStat.min` | `range(x)[0]` | Or `Math.min(...x)` for short arrays. |
| `jStat.max` | `range(x)[1]` | Or `Math.max(...x)` for short arrays. |
| `jStat.unique` | `unique(x)` | jStat compares object keys, so `1` and `"1"` collide. |
| `jStat.mean` | `mean(x)` | Accurate to the last bit (double-double sum and R's correction step); `trim` as in R. |
| `jStat.meansqerr` | `variance(x) * (x.length - 1) / x.length` |  |
| `jStat.geomean` | `geometricMean(x)` | As `DescTools::Gmean`: NaN with a negative value, 0 with a zero. |
| `jStat.median` | `median(x)` |  |
| `jStat.cumsum` | `cumsum(x)` |  |
| `jStat.cumprod` | `cumprod(x)` |  |
| `jStat.diff` | `diff(x)` | Also `lag` and `differences`, as in R. |
| `jStat.rank` | `rank(x)` | Ties get the average rank by default (`tiesMethod` as in R). |
| `jStat.mode` | `modes(x)` | As `DescTools::Mode`: all most frequent values in increasing order, and NaN when every value occurs once (jStat then returns the whole sorted array). |
| `jStat.range` | `range(x)` | R's `range` returns `[min, max]`; jStat returns `max - min` (`diff(range(x))`). |
| `jStat.variance` | `variance(x)` | **Default differs:** `variance` (R's `var`) is the sample variance (n − 1), jStat's default is the population variance. `jStat.variance(x, true)` is `variance(x)`. |
| `jStat.stdev` | `sd(x)` | **Default differs:** sample standard deviation (n − 1). |
| `jStat.pooledvariance` | `aov(groups).meanSq[1]` | The residual mean square of a one-way ANOVA. |
| `jStat.pooledstdev` | `Math.sqrt(aov(groups).meanSq[1])` |  |
| `jStat.deviation` | JS: `x.map((v) => v - m)` with `m = mean(x)` |  |
| `jStat.meandev` | `meanAD(x)` | As `DescTools::MeanAD`. |
| `jStat.meddev` | `mad(x, { constant: 1 })` | R's `mad` multiplies by 1.4826 by default; jStat does not. |
| `jStat.coeffvar` | `cv(x)` | **Differs:** `cv` (`DescTools::CoefVar`) uses the sample standard deviation; jStat uses the population one. |
| `jStat.quartiles` | `quantile(x, [0.25, 0.5, 0.75])` | jStat picks order statistics without interpolation (and its middle value is not the median for even n). Pass `type` for other definitions. |
| `jStat.quantiles` | `quantile(x, p, { type: 9 })` | jStat's default (α, β) = (3/8, 3/8) is R's type 9; R's default is type 7. |
| `jStat.percentile` | `quantile(x, p)` | Inclusive is R's type 7, `exclusive = true` is type 6 (`{ type: 6 }`). jStat is wrong for p close to 1 (`[1, 2, 3, 4]`, 0.9 gives 3 instead of 3.7) and returns NaN for small p when exclusive. |
| `jStat.percentileOfScore` | `ecdf(x)(score)` | The fraction of values ≤ score (jStat's default `'weak'`); for `'strict'` use `x.filter((v) => v < score).length / x.length`. |
| `jStat.histogram` | `hist(x, { breaks })` | R chooses breaks with `pretty` (Sturges by default) and counts right-closed intervals; `hist(x, { breaks: seq(min, max, { lengthOut: bins + 1 }) }).counts` gives jStat's equal-width bins. |
| `jStat.covariance` | `cov(x, y)` |  |
| `jStat.corrcoeff` | `cor(x, y)` |  |
| `jStat.spearmancoeff` | `cor(x, y, { method: "spearman" })` |  |
| `jStat.stanMoment` | `skewness(x)` / `kurtosis(x)` | jStat's standardized moments with the population standard deviation; for other orders compute `mean(x.map((v) => ((v - m) / s) ** k))`. |
| `jStat.skewness` | `skewness(x, { type: 1 })` | jStat's skewness is e1071's type 1; e1071's default is type 3. |
| `jStat.kurtosis` | `kurtosis(x, { type: 1 })` | Excess kurtosis, e1071's type 1 (e1071's default is type 3). |

## Special functions and random numbers

| jStat | rStats.js | Notes |
|---|---|---|
| `jStat.gammaln` | `lgamma(x)` |  |
| `jStat.loggam` | `lgamma(x)` |  |
| `jStat.gammafn` | `gamma(x)` |  |
| `jStat.gammap` | `gammainc(x, a).lower` *(planned)* | The non-regularized lower incomplete gamma function. |
| `jStat.lowRegGamma` | `pgamma(x, a)` | Note the argument order: R's `pgamma(q, shape)`. |
| `jStat.gammapinv` | `qgamma(p, a)` |  |
| `jStat.factorialln` | `lfactorial(n)` |  |
| `jStat.factorial` | `factorial(n)` |  |
| `jStat.combination` | `choose(n, k)` | R's `choose` rounds to an integer for integer arguments. |
| `jStat.combinationln` | `lchoose(n, k)` |  |
| `jStat.permutation` | `perm(n, k)` *(planned)* |  |
| `jStat.betafn` | `beta(a, b)` |  |
| `jStat.betaln` | `lbeta(a, b)` |  |
| `jStat.betacf` | `pbeta(x, a, b)` | jStat's continued fraction stops at a relative change of 3e-7, which limits its incomplete beta function to about 7 digits. |
| `jStat.ibeta` | `pbeta(x, a, b)` | jStat returns `false` outside [0, 1]; R returns 0 or 1. |
| `jStat.ibetainv` | `qbeta(p, a, b)` |  |
| `jStat.erf` | `erf(x)` |  |
| `jStat.erfc` | `erfc(x)` | jStat computes 1 − erf(x), which loses the tail; `erfc` keeps full relative accuracy. |
| `jStat.erfcinv` | `erfcinv(p)` *(planned)* |  |
| `jStat.randn` | `rnorm(n)` | For a matrix: `matrix(rnorm(n * m), n, m)`. |
| `jStat.randg` | `rgamma(n, shape)` | jStat's matrix form throws a TypeError. |

## Distributions

Every distribution has d/p/q/r functions with R's names (`dnorm`, `pnorm`, `qnorm`, `rnorm`, ...), with `log`, `lowerTail` and `logP` options. `distSummary(distribution, params)` returns the mean, variance, sd, median, mode, skewness and (excess) kurtosis of any of them.

| jStat | rStats.js | Notes |
|---|---|---|
| `jStat.normal.pdf` | `dnorm(x, { mean, sd })` | Takes the standard deviation, as jStat. |
| `jStat.normal.cdf` | `pnorm(q, { mean, sd })` |  |
| `jStat.normal.inv` | `qnorm(p, { mean, sd })` |  |
| `jStat.normal.mean` | `distSummary("norm", { mean, sd }).mean` |  |
| `jStat.normal.median` | `distSummary("norm", { mean, sd }).median` |  |
| `jStat.normal.mode` | `distSummary("norm", { mean, sd }).mode` |  |
| `jStat.normal.sample` | `rnorm(n, { mean, sd })` |  |
| `jStat.normal.variance` | `distSummary("norm", { mean, sd }).variance` |  |
| `jStat.studentt.pdf` | `dt(x, df)` |  |
| `jStat.studentt.cdf` | `pt(q, df)` |  |
| `jStat.studentt.inv` | `qt(p, df)` |  |
| `jStat.studentt.mean` | `distSummary("t", { df }).mean` |  |
| `jStat.studentt.median` | `distSummary("t", { df }).median` |  |
| `jStat.studentt.mode` | `distSummary("t", { df }).mode` |  |
| `jStat.studentt.sample` | `rt(n, df)` |  |
| `jStat.studentt.variance` | `distSummary("t", { df }).variance` |  |
| `jStat.centralF.pdf` | `df(x, df1, df2)` |  |
| `jStat.centralF.cdf` | `pf(q, df1, df2)` |  |
| `jStat.centralF.inv` | `qf(p, df1, df2)` |  |
| `jStat.centralF.mean` | `distSummary("f", { df1, df2 }).mean` |  |
| `jStat.centralF.mode` | `distSummary("f", { df1, df2 }).mode` |  |
| `jStat.centralF.sample` | `rf(n, df1, df2)` |  |
| `jStat.centralF.variance` | `distSummary("f", { df1, df2 }).variance` |  |
| `jStat.chisquare.pdf` | `dchisq(x, df)` | jStat's median is the Wilson-Hilferty approximation; `distSummary` gives `qchisq(0.5, df)`. |
| `jStat.chisquare.cdf` | `pchisq(q, df)` |  |
| `jStat.chisquare.inv` | `qchisq(p, df)` |  |
| `jStat.chisquare.mean` | `distSummary("chisq", { df }).mean` |  |
| `jStat.chisquare.median` | `distSummary("chisq", { df }).median` |  |
| `jStat.chisquare.mode` | `distSummary("chisq", { df }).mode` |  |
| `jStat.chisquare.sample` | `rchisq(n, df)` |  |
| `jStat.chisquare.variance` | `distSummary("chisq", { df }).variance` |  |
| `jStat.beta.pdf` | `dbeta(x, a, b)` |  |
| `jStat.beta.cdf` | `pbeta(q, a, b)` |  |
| `jStat.beta.inv` | `qbeta(p, a, b)` |  |
| `jStat.beta.mean` | `distSummary("beta", { shape1: a, shape2: b }).mean` |  |
| `jStat.beta.median` | `distSummary("beta", { shape1: a, shape2: b }).median` |  |
| `jStat.beta.mode` | `distSummary("beta", { shape1: a, shape2: b }).mode` |  |
| `jStat.beta.sample` | `rbeta(n, a, b)` |  |
| `jStat.beta.variance` | `distSummary("beta", { shape1: a, shape2: b }).variance` |  |
| `jStat.gamma.pdf` | `dgamma(x, shape, { scale })` | **Parameter:** jStat's second parameter is the scale; R's default is the rate, so pass `{ scale }`. |
| `jStat.gamma.cdf` | `pgamma(q, shape, { scale })` |  |
| `jStat.gamma.inv` | `qgamma(p, shape, { scale })` |  |
| `jStat.gamma.mean` | `distSummary("gamma", { shape, scale }).mean` |  |
| `jStat.gamma.mode` | `distSummary("gamma", { shape, scale }).mode` |  |
| `jStat.gamma.sample` | `rgamma(n, shape, { scale })` |  |
| `jStat.gamma.variance` | `distSummary("gamma", { shape, scale }).variance` |  |
| `jStat.invgamma.pdf` | `dinvgamma(x, alpha, { beta })` | extraDistr's names: `beta` is the scale. |
| `jStat.invgamma.cdf` | `pinvgamma(q, alpha, { beta })` |  |
| `jStat.invgamma.inv` | `qinvgamma(p, alpha, { beta })` |  |
| `jStat.invgamma.mean` | `distSummary("invgamma", { alpha, beta }).mean` |  |
| `jStat.invgamma.mode` | `distSummary("invgamma", { alpha, beta }).mode` |  |
| `jStat.invgamma.sample` | `rinvgamma(n, alpha, { beta })` |  |
| `jStat.invgamma.variance` | `distSummary("invgamma", { alpha, beta }).variance` |  |
| `jStat.lognormal.pdf` | `dlnorm(x, { meanlog, sdlog })` |  |
| `jStat.lognormal.cdf` | `plnorm(q, { meanlog, sdlog })` |  |
| `jStat.lognormal.inv` | `qlnorm(p, { meanlog, sdlog })` |  |
| `jStat.lognormal.mean` | `distSummary("lnorm", { meanlog, sdlog }).mean` |  |
| `jStat.lognormal.median` | `distSummary("lnorm", { meanlog, sdlog }).median` |  |
| `jStat.lognormal.mode` | `distSummary("lnorm", { meanlog, sdlog }).mode` |  |
| `jStat.lognormal.sample` | `rlnorm(n, { meanlog, sdlog })` |  |
| `jStat.lognormal.variance` | `distSummary("lnorm", { meanlog, sdlog }).variance` |  |
| `jStat.exponential.pdf` | `dexp(x, { rate })` |  |
| `jStat.exponential.cdf` | `pexp(q, { rate })` |  |
| `jStat.exponential.inv` | `qexp(p, { rate })` |  |
| `jStat.exponential.mean` | `distSummary("exp", { rate }).mean` |  |
| `jStat.exponential.median` | `distSummary("exp", { rate }).median` |  |
| `jStat.exponential.mode` | `distSummary("exp", { rate }).mode` |  |
| `jStat.exponential.sample` | `rexp(n, { rate })` |  |
| `jStat.exponential.variance` | `distSummary("exp", { rate }).variance` |  |
| `jStat.uniform.pdf` | `dunif(x, { min, max })` | jStat's median returns NaN and its mode throws. |
| `jStat.uniform.cdf` | `punif(q, { min, max })` |  |
| `jStat.uniform.inv` | `qunif(p, { min, max })` |  |
| `jStat.uniform.mean` | `distSummary("unif", { min, max }).mean` |  |
| `jStat.uniform.median` | `distSummary("unif", { min, max }).median` |  |
| `jStat.uniform.mode` | `distSummary("unif", { min, max }).mode` |  |
| `jStat.uniform.sample` | `runif(n, { min, max })` |  |
| `jStat.uniform.variance` | `distSummary("unif", { min, max }).variance` |  |
| `jStat.cauchy.pdf` | `dcauchy(x, { location, scale })` |  |
| `jStat.cauchy.cdf` | `pcauchy(q, { location, scale })` |  |
| `jStat.cauchy.inv` | `qcauchy(p, { location, scale })` |  |
| `jStat.cauchy.median` | `distSummary("cauchy", { location, scale }).median` |  |
| `jStat.cauchy.mode` | `distSummary("cauchy", { location, scale }).mode` |  |
| `jStat.cauchy.sample` | `rcauchy(n, { location, scale })` |  |
| `jStat.weibull.pdf` | `dweibull(x, shape, { scale })` | **Order:** jStat takes (scale, shape), R takes (shape, scale). |
| `jStat.weibull.cdf` | `pweibull(q, shape, { scale })` |  |
| `jStat.weibull.inv` | `qweibull(p, shape, { scale })` |  |
| `jStat.weibull.mean` | `distSummary("weibull", { shape, scale }).mean` |  |
| `jStat.weibull.median` | `distSummary("weibull", { shape, scale }).median` |  |
| `jStat.weibull.mode` | `distSummary("weibull", { shape, scale }).mode` |  |
| `jStat.weibull.sample` | `rweibull(n, shape, { scale })` |  |
| `jStat.weibull.variance` | `distSummary("weibull", { shape, scale }).variance` |  |
| `jStat.kumaraswamy.pdf` | `dkumar(x, a, b)` | jStat's variance throws. |
| `jStat.kumaraswamy.cdf` | `pkumar(q, a, b)` |  |
| `jStat.kumaraswamy.inv` | `qkumar(p, a, b)` |  |
| `jStat.kumaraswamy.mean` | `distSummary("kumar", { a, b }).mean` |  |
| `jStat.kumaraswamy.median` | `distSummary("kumar", { a, b }).median` |  |
| `jStat.kumaraswamy.mode` | `distSummary("kumar", { a, b }).mode` |  |
| `jStat.kumaraswamy.variance` | `distSummary("kumar", { a, b }).variance` |  |
| `jStat.laplace.pdf` | `dlaplace(x, { mu, sigma })` | jStat has no inverse; `qlaplace` is available. |
| `jStat.laplace.cdf` | `plaplace(q, { mu, sigma })` |  |
| `jStat.laplace.mean` | `distSummary("laplace", { mu, sigma }).mean` |  |
| `jStat.laplace.median` | `distSummary("laplace", { mu, sigma }).median` |  |
| `jStat.laplace.mode` | `distSummary("laplace", { mu, sigma }).mode` |  |
| `jStat.laplace.variance` | `distSummary("laplace", { mu, sigma }).variance` |  |
| `jStat.laplace.sample` | `rlaplace(n, { mu, sigma })` |  |
| `jStat.pareto.pdf` | `dpareto(x, { a, b })` | extraDistr's names: `a` is the shape and `b` the scale (jStat: (scale, shape)). jStat's mean and median are wrong. |
| `jStat.pareto.cdf` | `ppareto(q, { a, b })` |  |
| `jStat.pareto.inv` | `qpareto(p, { a, b })` |  |
| `jStat.pareto.mean` | `distSummary("pareto", { a, b }).mean` |  |
| `jStat.pareto.median` | `distSummary("pareto", { a, b }).median` |  |
| `jStat.pareto.mode` | `distSummary("pareto", { a, b }).mode` |  |
| `jStat.pareto.variance` | `distSummary("pareto", { a, b }).variance` |  |
| `jStat.triangular.pdf` | `dtriang(x, { a, b, c })` | Minimum, maximum and mode, as jStat. |
| `jStat.triangular.cdf` | `ptriang(q, { a, b, c })` |  |
| `jStat.triangular.inv` | `qtriang(p, { a, b, c })` |  |
| `jStat.triangular.mean` | `distSummary("triang", { a, b, c }).mean` |  |
| `jStat.triangular.median` | `distSummary("triang", { a, b, c }).median` |  |
| `jStat.triangular.mode` | `distSummary("triang", { a, b, c }).mode` |  |
| `jStat.triangular.sample` | `rtriang(n, { a, b, c })` |  |
| `jStat.triangular.variance` | `distSummary("triang", { a, b, c }).variance` |  |
| `jStat.arcsine.pdf` | `darcsine(x, { a, b })` | jStat's mode throws; there are two modes (at a and b), so `distSummary` returns NaN. |
| `jStat.arcsine.cdf` | `parcsine(q, { a, b })` |  |
| `jStat.arcsine.inv` | `qarcsine(p, { a, b })` |  |
| `jStat.arcsine.mean` | `distSummary("arcsine", { a, b }).mean` |  |
| `jStat.arcsine.median` | `distSummary("arcsine", { a, b }).median` |  |
| `jStat.arcsine.mode` | `distSummary("arcsine", { a, b }).mode` |  |
| `jStat.arcsine.sample` | `rarcsine(n, { a, b })` |  |
| `jStat.arcsine.variance` | `distSummary("arcsine", { a, b }).variance` |  |
| `jStat.binomial.pdf` | `dbinom(x, size, prob)` | jStat rounds the cdf to 1e-10. |
| `jStat.binomial.cdf` | `pbinom(q, size, prob)` |  |
| `jStat.negbin.pdf` | `dnbinom(x, size, { prob })` | Both count the failures before the `size`-th success. |
| `jStat.negbin.cdf` | `pnbinom(q, size, { prob })` |  |
| `jStat.hypgeom.pdf` | `dhyper(x, m, n, k)` | **Parameters:** jStat's (N, m, n) is (population, successes, draws); R's `dhyper(x, m, n, k)` takes successes m, failures n = N − m and draws k. |
| `jStat.hypgeom.cdf` | `phyper(q, m, n, k)` |  |
| `jStat.poisson.pdf` | `dpois(x, lambda)` |  |
| `jStat.poisson.cdf` | `ppois(q, lambda)` |  |
| `jStat.poisson.mean` | `distSummary("pois", { lambda }).mean` |  |
| `jStat.poisson.variance` | `distSummary("pois", { lambda }).variance` |  |
| `jStat.poisson.sample` | `rpois(n, lambda)` |  |
| `jStat.poisson.sampleSmall` | `rpois(n, lambda)` |  |
| `jStat.poisson.sampleLarge` | `rpois(n, lambda)` |  |
| `jStat.tukey.cdf` | `ptukey(q, nmeans, df)` |  |
| `jStat.tukey.inv` | `qtukey(p, nmeans, df)` |  |
| `jStat.noncentralt.pdf` | `dt(x, df, { ncp })` |  |
| `jStat.noncentralt.cdf` | `pt(q, df, { ncp })` |  |

## Linear algebra and numerical methods

| jStat | rStats.js | Notes |
|---|---|---|
| `jStat.add` | `add(a, b)` | Element-wise with R's recycling (a scalar, a vector or a matrix of the same shape). |
| `jStat.subtract` | `subtract(a, b)` | jStat turns NaN results into 0 (`value - arg || 0`). |
| `jStat.divide` | `divide(a, b)` | Element-wise. jStat's `divide` by a matrix multiplies by its inverse: `matMul(a, solve(b))`. |
| `jStat.multiply` | `matMul(a, b)` | jStat's `multiply` is the matrix product for two matrices and element-wise for a scalar; rStats.js has `matMul` (R's `%*%`) and element-wise `multiply`. |
| `jStat.outer` | `outer(x, y)` |  |
| `jStat.dot` | `matMul(a, b)` | jStat's `dot` is the row-wise inner product; for two vectors it is `sum(multiply(x, y))`. |
| `jStat.pow` | JS: `a.map((r) => r.map((v) => v ** p))` |  |
| `jStat.exp` | JS: `a.map((r) => r.map(Math.exp))` |  |
| `jStat.log` | JS: `a.map((r) => r.map(Math.log))` |  |
| `jStat.abs` | JS: `a.map((r) => r.map(Math.abs))` |  |
| `jStat.norm` | `norm(a, { type: "F" })` | R's `norm` is a matrix norm; for jStat's p-norm of a vector use `sum(x.map((v) => Math.abs(v) ** p)) ** (1 / p)`. |
| `jStat.angle` | JS: `Math.acos(sum(multiply(x, y)) / Math.sqrt(sum(multiply(x, x)) * sum(multiply(y, y))))` |  |
| `jStat.aug` | `cbind(a, b)` |  |
| `jStat.inv` | `solve(a)` |  |
| `jStat.det` | `det(a)` | LU decomposition (jStat expands cofactors recursively and fails on 1 × 1). |
| `jStat.gauss_elimination` | `solve(a, b)` | jStat's pivot search compares signed values. |
| `jStat.gauss_jordan` | `solve(a, b)` |  |
| `jStat.triaUpSolve` | `backsolve(r, b)` |  |
| `jStat.triaLowSolve` | `forwardsolve(l, b)` |  |
| `jStat.lu` | `lu(a)` | With partial pivoting (LAPACK's dgetrf, as `Matrix::lu`): `a = P L U`. jStat's has no pivoting. |
| `jStat.cholesky` | `t(chol(a))` | R's `chol` returns the upper triangle R (a = RᵀR); jStat returns the lower one. |
| `jStat.gauss_jacobi` | `solve(a, b)` | A direct solve replaces the iterative methods. |
| `jStat.gauss_seidel` | `solve(a, b)` |  |
| `jStat.SOR` | `solve(a, b)` |  |
| `jStat.householder` | `eigen(a)` | jStat's Householder tridiagonalization is a step towards eigenvalues; `eigen` gives them directly. |
| `jStat.QR` | `qr(a)` | Householder QR with R's column pivoting (`qrQ`, `qrR`). |
| `jStat.lstsq` | `qrSolve(a, b)` |  |
| `jStat.jacobi` | `eigen(a, { symmetric: true })` | jStat stops at a tolerance of 0.001 and skips row and column 0 in its convergence test. |
| `jStat.rungekutta` | `ode(y, times, func, { method: "rk4" })` | Fixed-step `euler`, `rk2` and `rk4` as in `deSolve::ode`; returns the whole trajectory. |
| `jStat.romberg` | `integrate(f, a, b)` | Adaptive Gauss-Kronrod (QUADPACK, as R's `integrate`), with an error estimate. |
| `jStat.richardson` | `hessian(f, x)` | jStat extrapolates a second derivative from tabulated values; `grad` and `hessian` use Richardson extrapolation on a function (`numDeriv`). |
| `jStat.simpson` | `integrate(f, a, b)` |  |
| `jStat.hermite` | `hermiteInterp(x, y, dy, xout)` | The global polynomial through values and derivatives, as jStat's; for piecewise cubic Hermite use `splinefunH`. |
| `jStat.lagrange` | `barylag(x, y, xout)` | Barycentric Lagrange interpolation, as `pracma::barylag`. |
| `jStat.cubic_spline` | `spline(x, y, { xout })` | jStat's `cubic_spline` throws (it calls a missing `jStat.sq`). `splinefun` returns a function. |
| `jStat.gauss_quadrature` | `integrate(f, a, b)` | jStat's throws "not yet implemented". |
| `jStat.PCA` | `prcomp(x)` | Observations are the rows of `x` (jStat: the columns). Signs of components may differ. |

## Hypothesis tests

| jStat | rStats.js | Notes |
|---|---|---|
| `jStat.zscore` | JS: `(value - mean(x)) / sd(x)` |  |
| `jStat.ztest` | `zTest(x, { mu, sigmaX })` | As `BSDA::z.test`. jStat's one-sided p-value ignores the direction of the effect. |
| `jStat.tscore` | `tTest(x, { mu }).statistic` |  |
| `jStat.ttest` | `tTest(x, { mu }).pValue` | jStat's four-argument form is misread as `(t, n, sides)`. |
| `jStat.anovafscore` | `aov(groups).fValue` |  |
| `jStat.anovaftest` | `aov(groups).pValue` | Or `onewayTest(groups, { varEqual: true })`. |
| `jStat.ftest` | `pf(f, df1, df2, { lowerTail: false })` |  |
| `jStat.qscore` | `TukeyHSD(groups)` |  |
| `jStat.qtest` | `ptukey(q, k, df, { lowerTail: false })` |  |
| `jStat.tukeyhsd` | `TukeyHSD(groups)` | Also returns the differences and intervals, as R's `TukeyHSD`. |
| `jStat.normalci` | `zTest(x, { sigmaX }).confInt` | jStat's array form uses the population standard deviation. |
| `jStat.tci` | `tTest(x).confInt` |  |
| `jStat.significant` | JS: `p < alpha` |  |
| `jStat.fn.anovaftes` | `aov(groups).pValue` | Spelled `anovaftes` in jStat (the documented `anovaftest()` instance method does not exist). |
| `jStat.fn.oneSidedDifferenceOfProportions` | `propTest([x1, x2], [n1, n2], { alternative: "greater", correct: false })` | The pooled z test is the chi-squared test without continuity correction; choose the side with `alternative`. |
| `jStat.fn.twoSidedDifferenceOfProportions` | `propTest([x1, x2], [n1, n2], { correct: false })` |  |

## Models

| jStat | rStats.js | Notes |
|---|---|---|
| `jStat.models.ols` | `lm(x, y)` | `lm` adds the intercept itself (jStat expects a column of ones). jStat's `SSE` is the explained sum of squares and `SSR` the residual one, the reverse of the usual names. |

## Regression

| jStat | rStats.js | Notes |
|---|---|---|
| `jStat.buildxmatrix` | `lm(x, y)` | Not needed: `lm` takes the predictors as a matrix and adds the intercept. |
| `jStat.builddxmatrix` | `lm(x, y)` |  |
| `jStat.buildjxmatrix` | `lm(x, y)` |  |
| `jStat.buildymatrix` | `lm(x, y)` |  |
| `jStat.buildjymatrix` | `lm(x, y)` |  |
| `jStat.matrixmult` | `matMul(a, b)` |  |
| `jStat.regress` | `lm(x, y).coefficients` |  |
| `jStat.regresst` | `lm(x, y)` | The coefficient table (estimates, standard errors, t and p) and the ANOVA quantities. jStat's t tests appear to use n − p − 1 degrees of freedom. |
| `jStat.xtranspx` | `crossprod(x)` |  |
| `jStat.xtranspxinv` | `solve(crossprod(x))` |  |
| `jStat.jMatYBar` | `mean(y)` |  |
| `jStat.residuals` | `lm(x, y).residuals` |  |
| `jStat.ssr` | `lm(x, y)` | The regression sum of squares: `sum(fitted.map((v) => (v - mean(y)) ** 2))`. |
| `jStat.sse` | `lm(x, y)` | The residual sum of squares: `sum(residuals.map((v) => v * v))`. |
| `jStat.sst` | `variance(y) * (y.length - 1)` |  |
| `jStat.matrixsubtract` | `subtract(a, b)` |  |

## Bugs in jStat

The replacements give the correct values in these cases (the examples in `test/jstat-replacement.test.ts` skip them):

- `percentile` is wrong for p close to 1 (`[1, 2, 3, 4]`, 0.9 gives 3 instead of 3.7) and NaN for small p when
  exclusive.
- `pareto.mean` returns shape · scale^shape / (shape − 1) (correct only for scale = 1); `pareto.median` returns
  scale · shape · √2 instead of scale · 2^(1/shape).
- `uniform.median` returns NaN; `uniform.mode`, `arcsine.mode` and `kumaraswamy.variance` throw.
- `cubic_spline` throws (it calls a missing `jStat.sq`); `gauss_quadrature` throws "not yet implemented"; the
  matrix form of `randg` throws a TypeError.
- `betacf` stops at a relative change of 3e-7, so `ibeta` and the beta, F and t distributions are good to about 7
  digits; `erfc` is computed as 1 − erf and loses the tails.
- `quartiles` picks order statistics without interpolation; its middle value is not the median for even n.
- `subtract` turns NaN results into 0; `unique` treats `1` and `"1"` as equal; `histogram` loses every value
  when they are all equal.
- `jacobi` stops at a tolerance of 0.001 and skips row and column 0 in its convergence test;
  `gauss_elimination` compares signed values when searching for a pivot; `det` fails on 1 × 1 matrices.
- The one-sided tests ignore the direction of the effect; `ttest(value, mean, sd, n)` is read as `(t, n, sides)`.
