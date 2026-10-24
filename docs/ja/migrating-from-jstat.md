# jStat からの移行

[English](../migrating-from-jstat.md) | 日本語

rStats.js は [jStat](https://github.com/jstat/jstat) 1.9.6 のすべての関数をカバーします。名前と既定値は jStat
ではなく R のものなので、多くの呼び出しは形が変わります。このページには、jStat の全関数とその置き換え、既定値の
違い、置き換えでは再現しない jStat のバグを載せます。*(予定)* の行は、まだ rStats.js にありません。

rStats.js は素の配列 (行列は行の配列) を扱い、素のオブジェクトを返します。`jStat(...)` のラッパー、メソッドの
チェーン、コールバックはありません。どの関数も、パッケージのルートからでも分野ごとのサブパス
(`@numero-uno-jpn/rstats/descriptive`、`/distributions`、`/tests`、`/linalg`、`/numerics`、`/special`) からでも
import できます。

## 既定値の違い

| | jStat | rStats.js (R) |
|---|---|---|
| `variance`、`stdev` | `flag` が真でなければ母分散 (n) | 標本 (n − 1): `variance`、`sd` |
| `quantiles` | (α, β) = (3/8, 3/8)、R の type 9 | `quantile` は type 7 (`{ type: 9 }` を渡す) |
| `percentile` | type 7 (exclusive は type 6) | `quantile` は type 7 |
| `range` | max − min | `[min, max]` |
| `coeffvar` | 母標準偏差 | 標本標準偏差 |
| `meddev` | 中央値からの絶対偏差の中央値 | `mad` は 1.4826 倍する (`{ constant: 1 }` を渡す) |
| `skewness`、`kurtosis` | 偏りのある形 (e1071 の type 1) | `skewness`・`kurtosis` の既定は e1071 の type 3 |
| `gamma` | (shape, scale) | 既定は `(shape, { rate })`。`{ scale }` を渡す |
| `weibull` | (scale, shape) | `(shape, { scale })` |
| `pareto` | (scale, shape) | extraDistr の `{ a: 形, b: 尺度 }` |
| `hypgeom` | (N, m, n): 母集団・成功の数・取り出す数 | `(m, n, k)`: 成功・失敗・取り出す数 |
| `negbin` | (r, p) | `(size, { prob })` (意味は同じ) |
| `cholesky` | 下三角 | `chol` は上三角を返す |
| `multiply` | 行列どうしなら行列の積 | `matMul`。`multiply` は要素ごと |
| 片側検定 (`sides = 1`) | 効果の向きを無視する | `alternative: "less"` か `"greater"` |
| 乱数 | `Math.random` (か `setRandom`) | R の Mersenne-Twister: `setSeed(n)` で R の `set.seed(n)` を再現 |

## コア: 配列と行列

| jStat | rStats.js | 備考 |
|---|---|---|
| `jStat` | JS: arrays (`[1, 2, 3]`, arrays of rows for matrices) | rStats.js は素の配列を扱います。ラッパーのオブジェクトやメソッドのチェーンはありません。 |
| `jStat.utils.calcRdx` | — | jStat の `seq` の内部の補助関数です。 |
| `jStat.utils.isArray` | JS: `Array.isArray(x)` |  |
| `jStat.utils.isFunction` | JS: `typeof f === "function"` |  |
| `jStat.utils.isNumber` | JS: `Number.isFinite(x)` | jStat の `isNumber` は有限の数のときだけ真です。 |
| `jStat.utils.toVector` | JS: `x.flat()` |  |
| `jStat.setRandom` | `setSeed(seed)` | rStats.js は R の Mersenne-Twister を使うので、`setSeed(42)` で R の `set.seed(42)` と同じ乱数になります。独自の乱数生成器は差し込めません。 |
| `jStat.extend` | JS: `Object.assign(target, source)` |  |
| `jStat.rows` | JS: `a.length` |  |
| `jStat.cols` | JS: `a[0].length` |  |
| `jStat.dimensions` | JS: `({ rows: a.length, cols: a[0].length })` |  |
| `jStat.row` | JS: `a[i]` |  |
| `jStat.rowa` | JS: `a[i]` |  |
| `jStat.col` | JS: `a.map((r) => [r[j]])` | jStat は n × 1 の行列を返します。 |
| `jStat.cola` | JS: `a.map((r) => r[j])` |  |
| `jStat.diag` | `diag(a)` | 行列の `diag` は対角要素を平らな配列で返します (jStat は n × 1 の行列)。 |
| `jStat.antidiag` | JS: `a.map((r, i) => r[r.length - 1 - i])` |  |
| `jStat.diagonal` | `diag(v)` | 長さ 2 以上のベクトルの `diag` は、R と同じく対角行列を作ります。 |
| `jStat.transpose` | `t(a)` | `t` は常に行列を返します (jStat は 1 行の結果を平らにします)。 |
| `jStat.map` | JS: `a.map((r) => r.map(f))` |  |
| `jStat.cumreduce` | JS: `a.map((r) => { let s = 0; return r.map((v) => (s += v)); })` | 累積和なら `cumsum(x)` を使います。 |
| `jStat.alter` | JS: `a.forEach((r) => r.forEach((v, j) => (r[j] = f(v))))` |  |
| `jStat.create` | `matrix(data, nrow, ncol)` | JavaScript で行の配列を作ってもかまいません。 |
| `jStat.zeros` | `matrix(0, nrow, ncol)` |  |
| `jStat.ones` | `matrix(1, nrow, ncol)` |  |
| `jStat.rand` | `matrix(runif(nrow * ncol), nrow, ncol)` | `setSeed` で再現できます。 |
| `jStat.identity` | `diag(n)` |  |
| `jStat.symmetric` | JS: `a.every((r, i) => r.every((v, j) => v === a[j][i]))` |  |
| `jStat.clear` | JS: `a.forEach((r) => r.fill(0))` |  |
| `jStat.seq` | `seq(from, to, { lengthOut })` | R の `seq(length.out = n)` は両端をちょうどにします。 |
| `jStat.arange` | `seq(from, to, { by })` | R の `seq` は `to` に届けば含めます。`arange` は `end` の手前で止まります。 |
| `jStat.slice` | JS: `a.slice(r0, r1).map((r) => r.slice(c0, c1))` |  |
| `jStat.sliceAssign` | JS: assign to `a[i][j]` in a loop | jStat の実装は行が整数のときにバグがあります (列の上限に行数を使う)。 |
| `jStat.copy` | JS: `a.map((r) => [...r])` |  |

## 記述統計

| jStat | rStats.js | 備考 |
|---|---|---|
| `jStat.sum` | `sum(x)` | R が long double で足すのと同じく、double-double で足します。 |
| `jStat.sumsqrd` | `sum(x.map((v) => v * v))` |  |
| `jStat.sumsqerr` | `variance(x) * (x.length - 1)` |  |
| `jStat.sumrow` | `sum(x)` |  |
| `jStat.product` | `prod(x)` |  |
| `jStat.min` | `range(x)[0]` | 短い配列なら `Math.min(...x)` でもかまいません。 |
| `jStat.max` | `range(x)[1]` | 短い配列なら `Math.max(...x)` でもかまいません。 |
| `jStat.unique` | `unique(x)` | jStat はオブジェクトのキーで比べるので、`1` と `"1"` が衝突します。 |
| `jStat.mean` | `mean(x)` | 最後のビットまで正確です (double-double の和と R の補正)。`trim` は R と同じです。 |
| `jStat.meansqerr` | `variance(x) * (x.length - 1) / x.length` |  |
| `jStat.geomean` | `geometricMean(x)` | `DescTools::Gmean` と同じで、負の値があれば NaN、0 があれば 0 です。 |
| `jStat.median` | `median(x)` |  |
| `jStat.cumsum` | `cumsum(x)` |  |
| `jStat.cumprod` | `cumprod(x)` |  |
| `jStat.diff` | `diff(x)` | R と同じく `lag` と `differences` も指定できます。 |
| `jStat.rank` | `rank(x)` | 同順位の既定は平均順位です (`tiesMethod` は R と同じ)。 |
| `jStat.mode` | `modes(x)` | `DescTools::Mode` と同じで、最多の値すべてを昇順で返し、どの値も 1 回なら NaN です (jStat は並べた配列全体を返します)。 |
| `jStat.range` | `range(x)` | R の `range` は `[min, max]` を返します。jStat は `max - min` を返します (`diff(range(x))`)。 |
| `jStat.variance` | `variance(x)` | **既定が違います:** `variance` (R の `var`) は標本分散 (n − 1)、jStat の既定は母分散です。`jStat.variance(x, true)` が `variance(x)` です。 |
| `jStat.stdev` | `sd(x)` | **既定が違います:** 標本標準偏差 (n − 1) です。 |
| `jStat.pooledvariance` | `aov(groups).meanSq[1]` | 一元配置分散分析の残差平均平方です。 |
| `jStat.pooledstdev` | `Math.sqrt(aov(groups).meanSq[1])` |  |
| `jStat.deviation` | JS: `x.map((v) => v - m)` with `m = mean(x)` |  |
| `jStat.meandev` | `meanAD(x)` | `DescTools::MeanAD` と同じです。 |
| `jStat.meddev` | `mad(x, { constant: 1 })` | R の `mad` は既定で 1.4826 倍します。jStat はしません。 |
| `jStat.coeffvar` | `cv(x)` | **違います:** `cv` (`DescTools::CoefVar`) は標本標準偏差、jStat は母標準偏差を使います。 |
| `jStat.quartiles` | `quantile(x, [0.25, 0.5, 0.75])` | jStat は補間せずに順序統計量を選びます (n が偶数だと中央の値が中央値になりません)。別の定義は `type` で選びます。 |
| `jStat.quantiles` | `quantile(x, p, { type: 9 })` | jStat の既定 (α, β) = (3/8, 3/8) は R の type 9 です。R の既定は type 7 です。 |
| `jStat.percentile` | `quantile(x, p)` | inclusive は R の type 7、`exclusive = true` は type 6 (`{ type: 6 }`) です。jStat は p が 1 に近いと誤り (`[1, 2, 3, 4]` の 0.9 が 3.7 でなく 3)、exclusive で p が小さいと NaN を返します。 |
| `jStat.percentileOfScore` | `ecdf(x)(score)` | score 以下の値の割合です (jStat の既定 `'weak'`)。`'strict'` なら `x.filter((v) => v < score).length / x.length` です。 |
| `jStat.histogram` | `hist(x, { breaks })` | R は `pretty` で区切りを選び (既定は Sturges)、右閉区間で数えます。jStat の等幅の区間は `hist(x, { breaks: seq(min, max, { lengthOut: bins + 1 }) }).counts` で得られます。 |
| `jStat.covariance` | `cov(x, y)` |  |
| `jStat.corrcoeff` | `cor(x, y)` |  |
| `jStat.spearmancoeff` | `cor(x, y, { method: "spearman" })` |  |
| `jStat.stanMoment` | `skewness(x)` / `kurtosis(x)` | jStat の標準化モーメント (母標準偏差) です。ほかの次数は `mean(x.map((v) => ((v - m) / s) ** k))` で計算します。 |
| `jStat.skewness` | `skewness(x, { type: 1 })` | jStat の歪度は e1071 の type 1 です。e1071 の既定は type 3 です。 |
| `jStat.kurtosis` | `kurtosis(x, { type: 1 })` | 超過尖度で、e1071 の type 1 です (e1071 の既定は type 3)。 |

## 特殊関数と乱数

| jStat | rStats.js | 備考 |
|---|---|---|
| `jStat.gammaln` | `lgamma(x)` |  |
| `jStat.loggam` | `lgamma(x)` |  |
| `jStat.gammafn` | `gamma(x)` |  |
| `jStat.gammap` | `gammainc(x, a).lower` | 正規化しない下側不完全ガンマ関数です。 |
| `jStat.lowRegGamma` | `pgamma(x, a)` | 引数の順に注意: R の `pgamma(q, shape)` です。 |
| `jStat.gammapinv` | `qgamma(p, a)` |  |
| `jStat.factorialln` | `lfactorial(n)` |  |
| `jStat.factorial` | `factorial(n)` |  |
| `jStat.combination` | `choose(n, k)` | R の `choose` は整数の引数では整数に丸めます。 |
| `jStat.combinationln` | `lchoose(n, k)` |  |
| `jStat.permutation` | `perm(n, k)` |  |
| `jStat.betafn` | `beta(a, b)` |  |
| `jStat.betaln` | `lbeta(a, b)` |  |
| `jStat.betacf` | `pbeta(x, a, b)` | jStat の連分数は相対変化 3e-7 で止まるので、不完全ベータ関数の精度は 7 桁ほどです。 |
| `jStat.ibeta` | `pbeta(x, a, b)` | jStat は [0, 1] の外で `false` を返します。R は 0 か 1 を返します。 |
| `jStat.ibetainv` | `qbeta(p, a, b)` |  |
| `jStat.erf` | `erf(x)` |  |
| `jStat.erfc` | `erfc(x)` | jStat は 1 − erf(x) で計算するので裾が失われます。`erfc` は相対精度を保ちます。 |
| `jStat.erfcinv` | `erfcinv(p)` |  |
| `jStat.randn` | `rnorm(n)` | 行列なら `matrix(rnorm(n * m), n, m)` です。 |
| `jStat.randg` | `rgamma(n, shape)` | jStat の行列の形は TypeError になります。 |

## 分布

どの分布にも R の名前の d/p/q/r 関数 (`dnorm`、`pnorm`、`qnorm`、`rnorm` など) があり、`log`・`lowerTail`・`logP` を指定できます。`distSummary(distribution, params)` はどの分布でも平均・分散・標準偏差・中央値・最頻値・歪度・(超過) 尖度を返します。

| jStat | rStats.js | 備考 |
|---|---|---|
| `jStat.normal.pdf` | `dnorm(x, { mean, sd })` | jStat と同じく標準偏差を取ります。 |
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
| `jStat.chisquare.pdf` | `dchisq(x, df)` | jStat の median は Wilson-Hilferty の近似です。`distSummary` は `qchisq(0.5, df)` を返します。 |
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
| `jStat.gamma.pdf` | `dgamma(x, shape, { scale })` | **母数:** jStat の 2 つ目の母数は尺度です。R の既定は rate なので `{ scale }` で渡します。 |
| `jStat.gamma.cdf` | `pgamma(q, shape, { scale })` |  |
| `jStat.gamma.inv` | `qgamma(p, shape, { scale })` |  |
| `jStat.gamma.mean` | `distSummary("gamma", { shape, scale }).mean` |  |
| `jStat.gamma.mode` | `distSummary("gamma", { shape, scale }).mode` |  |
| `jStat.gamma.sample` | `rgamma(n, shape, { scale })` |  |
| `jStat.gamma.variance` | `distSummary("gamma", { shape, scale }).variance` |  |
| `jStat.invgamma.pdf` | `dinvgamma(x, alpha, { beta })` | extraDistr の名前です: `beta` が尺度です。 |
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
| `jStat.uniform.pdf` | `dunif(x, { min, max })` | jStat の median は NaN を返し、mode は例外になります。 |
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
| `jStat.weibull.pdf` | `dweibull(x, shape, { scale })` | **順序:** jStat は (scale, shape)、R は (shape, scale) です。 |
| `jStat.weibull.cdf` | `pweibull(q, shape, { scale })` |  |
| `jStat.weibull.inv` | `qweibull(p, shape, { scale })` |  |
| `jStat.weibull.mean` | `distSummary("weibull", { shape, scale }).mean` |  |
| `jStat.weibull.median` | `distSummary("weibull", { shape, scale }).median` |  |
| `jStat.weibull.mode` | `distSummary("weibull", { shape, scale }).mode` |  |
| `jStat.weibull.sample` | `rweibull(n, shape, { scale })` |  |
| `jStat.weibull.variance` | `distSummary("weibull", { shape, scale }).variance` |  |
| `jStat.kumaraswamy.pdf` | `dkumar(x, a, b)` | jStat の variance は例外になります。 |
| `jStat.kumaraswamy.cdf` | `pkumar(q, a, b)` |  |
| `jStat.kumaraswamy.inv` | `qkumar(p, a, b)` |  |
| `jStat.kumaraswamy.mean` | `distSummary("kumar", { a, b }).mean` |  |
| `jStat.kumaraswamy.median` | `distSummary("kumar", { a, b }).median` |  |
| `jStat.kumaraswamy.mode` | `distSummary("kumar", { a, b }).mode` |  |
| `jStat.kumaraswamy.variance` | `distSummary("kumar", { a, b }).variance` |  |
| `jStat.laplace.pdf` | `dlaplace(x, { mu, sigma })` | jStat には逆関数がありません。`qlaplace` があります。 |
| `jStat.laplace.cdf` | `plaplace(q, { mu, sigma })` |  |
| `jStat.laplace.mean` | `distSummary("laplace", { mu, sigma }).mean` |  |
| `jStat.laplace.median` | `distSummary("laplace", { mu, sigma }).median` |  |
| `jStat.laplace.mode` | `distSummary("laplace", { mu, sigma }).mode` |  |
| `jStat.laplace.variance` | `distSummary("laplace", { mu, sigma }).variance` |  |
| `jStat.laplace.sample` | `rlaplace(n, { mu, sigma })` |  |
| `jStat.pareto.pdf` | `dpareto(x, { a, b })` | extraDistr の名前です: `a` が形、`b` が尺度です (jStat は (scale, shape))。jStat の mean と median は誤りです。 |
| `jStat.pareto.cdf` | `ppareto(q, { a, b })` |  |
| `jStat.pareto.inv` | `qpareto(p, { a, b })` |  |
| `jStat.pareto.mean` | `distSummary("pareto", { a, b }).mean` |  |
| `jStat.pareto.median` | `distSummary("pareto", { a, b }).median` |  |
| `jStat.pareto.mode` | `distSummary("pareto", { a, b }).mode` |  |
| `jStat.pareto.variance` | `distSummary("pareto", { a, b }).variance` |  |
| `jStat.triangular.pdf` | `dtriang(x, { a, b, c })` | jStat と同じく最小・最大・最頻値です。 |
| `jStat.triangular.cdf` | `ptriang(q, { a, b, c })` |  |
| `jStat.triangular.inv` | `qtriang(p, { a, b, c })` |  |
| `jStat.triangular.mean` | `distSummary("triang", { a, b, c }).mean` |  |
| `jStat.triangular.median` | `distSummary("triang", { a, b, c }).median` |  |
| `jStat.triangular.mode` | `distSummary("triang", { a, b, c }).mode` |  |
| `jStat.triangular.sample` | `rtriang(n, { a, b, c })` |  |
| `jStat.triangular.variance` | `distSummary("triang", { a, b, c }).variance` |  |
| `jStat.arcsine.pdf` | `darcsine(x, { a, b })` | jStat の mode は例外になります。最頻値は 2 つ (a と b) なので `distSummary` は NaN を返します。 |
| `jStat.arcsine.cdf` | `parcsine(q, { a, b })` |  |
| `jStat.arcsine.inv` | `qarcsine(p, { a, b })` |  |
| `jStat.arcsine.mean` | `distSummary("arcsine", { a, b }).mean` |  |
| `jStat.arcsine.median` | `distSummary("arcsine", { a, b }).median` |  |
| `jStat.arcsine.mode` | `distSummary("arcsine", { a, b }).mode` |  |
| `jStat.arcsine.sample` | `rarcsine(n, { a, b })` |  |
| `jStat.arcsine.variance` | `distSummary("arcsine", { a, b }).variance` |  |
| `jStat.binomial.pdf` | `dbinom(x, size, prob)` | jStat は cdf を 1e-10 に丸めます。 |
| `jStat.binomial.cdf` | `pbinom(q, size, prob)` |  |
| `jStat.negbin.pdf` | `dnbinom(x, size, { prob })` | どちらも `size` 回目の成功までの失敗の数です。 |
| `jStat.negbin.cdf` | `pnbinom(q, size, { prob })` |  |
| `jStat.hypgeom.pdf` | `dhyper(x, m, n, k)` | **母数:** jStat の (N, m, n) は (母集団、成功の数、取り出す数) です。R の `dhyper(x, m, n, k)` は成功 m、失敗 n = N − m、取り出す数 k を取ります。 |
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

## 線形代数と数値計算

| jStat | rStats.js | 備考 |
|---|---|---|
| `jStat.add` | `add(a, b)` | R の再利用規則による要素ごとの演算です (スカラー、ベクトル、同じ形の行列)。 |
| `jStat.subtract` | `subtract(a, b)` | jStat は NaN の結果を 0 にします (`value - arg || 0`)。 |
| `jStat.divide` | `divide(a, b)` | 要素ごとです。jStat の行列による `divide` は逆行列を掛けます: `matMul(a, solve(b))`。 |
| `jStat.multiply` | `matMul(a, b)` | jStat の `multiply` は行列どうしなら行列の積、スカラーなら要素ごとです。rStats.js では `matMul` (R の `%*%`) と要素ごとの `multiply` に分かれます。 |
| `jStat.outer` | `outer(x, y)` |  |
| `jStat.dot` | `matMul(a, b)` | jStat の `dot` は行ごとの内積です。2 つのベクトルなら `sum(multiply(x, y))` です。 |
| `jStat.pow` | JS: `a.map((r) => r.map((v) => v ** p))` |  |
| `jStat.exp` | JS: `a.map((r) => r.map(Math.exp))` |  |
| `jStat.log` | JS: `a.map((r) => r.map(Math.log))` |  |
| `jStat.abs` | JS: `a.map((r) => r.map(Math.abs))` |  |
| `jStat.norm` | `norm(a, { type: "F" })` | R の `norm` は行列のノルムです。jStat のベクトルの p ノルムは `sum(x.map((v) => Math.abs(v) ** p)) ** (1 / p)` です。 |
| `jStat.angle` | JS: `Math.acos(sum(multiply(x, y)) / Math.sqrt(sum(multiply(x, x)) * sum(multiply(y, y))))` |  |
| `jStat.aug` | `cbind(a, b)` |  |
| `jStat.inv` | `solve(a)` |  |
| `jStat.det` | `det(a)` | LU 分解で計算します (jStat は余因子展開を再帰的に行い、1 × 1 で失敗します)。 |
| `jStat.gauss_elimination` | `solve(a, b)` | jStat のピボット探しは符号付きの値で比べます。 |
| `jStat.gauss_jordan` | `solve(a, b)` |  |
| `jStat.triaUpSolve` | `backsolve(r, b)` |  |
| `jStat.triaLowSolve` | `forwardsolve(l, b)` |  |
| `jStat.lu` | `lu(a)` | 部分ピボット付きです (LAPACK の dgetrf、`Matrix::lu` と同じ): `a = P L U`。jStat のものはピボットしません。 |
| `jStat.cholesky` | `t(chol(a))` | R の `chol` は上三角 R (a = RᵀR) を返します。jStat は下三角を返します。 |
| `jStat.gauss_jacobi` | `solve(a, b)` | 反復解法の代わりに直接解きます。 |
| `jStat.gauss_seidel` | `solve(a, b)` |  |
| `jStat.SOR` | `solve(a, b)` |  |
| `jStat.householder` | `eigen(a)` | jStat の Householder の三重対角化は固有値を求める途中の段階です。`eigen` は固有値を直接与えます。 |
| `jStat.QR` | `qr(a)` | R の列ピボット付きの Householder QR です (`qrQ`、`qrR`)。 |
| `jStat.lstsq` | `qrSolve(a, b)` |  |
| `jStat.jacobi` | `eigen(a, { symmetric: true })` | jStat は許容値 0.001 で止まり、収束の判定で行と列 0 を飛ばします。 |
| `jStat.rungekutta` | `ode(y, times, func, { method: "rk4" })` | `deSolve::ode` と同じ固定刻みの `euler`・`rk2`・`rk4` です。軌跡全体を返します。 |
| `jStat.romberg` | `integrate(f, a, b)` | 適応 Gauss-Kronrod 法 (QUADPACK、R の `integrate` と同じ) で、誤差の見積もりも返します。 |
| `jStat.richardson` | `hessian(f, x)` | jStat は表の値から 2 階微分を外挿します。`grad` と `hessian` は関数に対して Richardson の外挿を使います (`numDeriv`)。 |
| `jStat.simpson` | `integrate(f, a, b)` |  |
| `jStat.hermite` | `hermiteInterp(x, y, dy, xout)` | jStat と同じく値と導関数を通る大域の多項式です。区分的な 3 次の Hermite 補間は `splinefunH` です。 |
| `jStat.lagrange` | `barylag(x, y, xout)` | 重心型の Lagrange 補間で、`pracma::barylag` と同じです。 |
| `jStat.cubic_spline` | `spline(x, y, { xout })` | jStat の `cubic_spline` は例外になります (存在しない `jStat.sq` を呼ぶ)。`splinefun` は関数を返します。 |
| `jStat.gauss_quadrature` | `integrate(f, a, b)` | jStat のものは "not yet implemented" で例外になります。 |
| `jStat.PCA` | `prcomp(x)` | 観測は `x` の行です (jStat は列)。主成分の符号は違うことがあります。 |

## 仮説検定

| jStat | rStats.js | 備考 |
|---|---|---|
| `jStat.zscore` | JS: `(value - mean(x)) / sd(x)` |  |
| `jStat.ztest` | `zTest(x, { mu, sigmaX })` | `BSDA::z.test` と同じです。jStat の片側 p 値は効果の向きを無視します。 |
| `jStat.tscore` | `tTest(x, { mu }).statistic` |  |
| `jStat.ttest` | `tTest(x, { mu }).pValue` | jStat の 4 引数の形は `(t, n, sides)` と解釈されてしまいます。 |
| `jStat.anovafscore` | `aov(groups).fValue` |  |
| `jStat.anovaftest` | `aov(groups).pValue` | `onewayTest(groups, { varEqual: true })` でも得られます。 |
| `jStat.ftest` | `pf(f, df1, df2, { lowerTail: false })` |  |
| `jStat.qscore` | `TukeyHSD(groups)` |  |
| `jStat.qtest` | `ptukey(q, k, df, { lowerTail: false })` |  |
| `jStat.tukeyhsd` | `TukeyHSD(groups)` | R の `TukeyHSD` と同じく差と信頼区間も返します。 |
| `jStat.normalci` | `zTest(x, { sigmaX }).confInt` | jStat の配列の形は母標準偏差を使います。 |
| `jStat.tci` | `tTest(x).confInt` |  |
| `jStat.significant` | JS: `p < alpha` |  |
| `jStat.fn.anovaftes` | `aov(groups).pValue` | jStat での綴りは `anovaftes` です (文書にあるインスタンスの `anovaftest()` は存在しません)。 |
| `jStat.fn.oneSidedDifferenceOfProportions` | `propTest([x1, x2], [n1, n2], { alternative: "greater", correct: false })` | プールした比率の z 検定は、連続性補正のないカイ二乗検定です。向きは `alternative` で選びます。 |
| `jStat.fn.twoSidedDifferenceOfProportions` | `propTest([x1, x2], [n1, n2], { correct: false })` |  |

## モデル

| jStat | rStats.js | 備考 |
|---|---|---|
| `jStat.models.ols` | `lm(x, y)` | `lm` は切片を自分で足します (jStat は 1 の列を含めて渡します)。jStat の `SSE` は説明された平方和、`SSR` は残差平方和で、普通の名前と逆です。 |

## 回帰

| jStat | rStats.js | 備考 |
|---|---|---|
| `jStat.buildxmatrix` | `lm(x, y)` | 不要です: `lm` は説明変数を行列で受け取り、切片を足します。 |
| `jStat.builddxmatrix` | `lm(x, y)` |  |
| `jStat.buildjxmatrix` | `lm(x, y)` |  |
| `jStat.buildymatrix` | `lm(x, y)` |  |
| `jStat.buildjymatrix` | `lm(x, y)` |  |
| `jStat.matrixmult` | `matMul(a, b)` |  |
| `jStat.regress` | `lm(x, y).coefficients` |  |
| `jStat.regresst` | `lm(x, y)` | 係数の表 (推定値・標準誤差・t・p) と分散分析の量です。jStat の t 検定は自由度を n − p − 1 にしているように見えます。 |
| `jStat.xtranspx` | `crossprod(x)` |  |
| `jStat.xtranspxinv` | `solve(crossprod(x))` |  |
| `jStat.jMatYBar` | `mean(y)` |  |
| `jStat.residuals` | `lm(x, y).residuals` |  |
| `jStat.ssr` | `lm(x, y)` | 回帰の平方和です: `sum(fitted.map((v) => (v - mean(y)) ** 2))`。 |
| `jStat.sse` | `lm(x, y)` | 残差平方和です: `sum(residuals.map((v) => v * v))`。 |
| `jStat.sst` | `variance(y) * (y.length - 1)` |  |
| `jStat.matrixsubtract` | `subtract(a, b)` |  |

## jStat のバグ

置き換えの関数はこれらの場合も正しい値を返します (`test/jstat-replacement.test.ts` の例はこれらを除いています)。

- `percentile` は p が 1 に近いと誤り (`[1, 2, 3, 4]` の 0.9 が 3.7 でなく 3)、exclusive で p が小さいと NaN。
- `pareto.mean` は shape · scale^shape / (shape − 1) を返す (scale = 1 のときだけ正しい)。`pareto.median` は
  scale · 2^(1/shape) でなく scale · shape · √2 を返す。
- `uniform.median` は NaN を返す。`uniform.mode`・`arcsine.mode`・`kumaraswamy.variance` は例外になる。
- `cubic_spline` は例外になる (存在しない `jStat.sq` を呼ぶ)。`gauss_quadrature` は "not yet implemented" で例外。
  行列の形の `randg` は TypeError。
- `betacf` は相対変化 3e-7 で止まるので、`ibeta` とベータ・F・t 分布の精度は 7 桁ほど。`erfc` は 1 − erf で計算
  するので裾が失われる。
- `quartiles` は補間せずに順序統計量を選ぶ。n が偶数だと中央の値が中央値にならない。
- `subtract` は NaN の結果を 0 にする。`unique` は `1` と `"1"` を同じとみなす。`histogram` は値がすべて等しいと
  すべて数え落とす。
- `jacobi` は許容値 0.001 で止まり、収束の判定で行と列 0 を飛ばす。`gauss_elimination` はピボット探しで符号付きの
  値を比べる。`det` は 1 × 1 の行列で失敗する。
- 片側検定は効果の向きを無視する。`ttest(value, mean, sd, n)` は `(t, n, sides)` と解釈される。
