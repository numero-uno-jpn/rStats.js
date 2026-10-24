# jStat 1.9.6 の全関数 (洗い出し)

2026-10-24、npm の jstat 1.9.6 のソース (`src/*.js`) と文書 (`doc/md/*.md`) を読んで作成。コードは実行していない。リリースに含めない一時文書。移行の手引きと `test/fixtures/jstat-api.json` の元にする。

ビルドは `_header, core, vector, special, distribution, linearalgebra, test, models, regression, _footer` を連結した UMD (`dist/jstat.js`)。

| モジュール | `jStat.*` の静的関数 | `jStat.fn` (インスタンス) |
|---|---|---|
| core.js | 29 (+ `utils` 5、`_random_fn`、`fn`) | 21 |
| vector.js | 37 | 31 |
| special.js | 21 | 5 |
| distribution.js | 分布 23 種 (静的メソッド約 140) | 分布ごとに約 11 + `jStat.fn.<dist>` 23 |
| linearalgebra.js | 38 | 11 |
| test.js | 13 | 10 |
| models.js | 1 (`jStat.models.ols`) | — |
| regression.js | 16 | — |

## 1. core.js

- `jStat(array)` はベクトル (`this[0] = array`, `length = 1`)、`jStat(matrix)` は各行を `this[i]` に持つ。`jStat(arr, fn)` は map してから。`jStat(min, max, count[, fn])` は `seq`。`jStat(jStatObj)` は複製。それ以外は空 (`this[0] = []`) で、例外は出さない。`[[1,2,3]]` は length 1 なのでベクトル扱い。
- `utils`: `calcRdx(n, m)`、`isArray`、`isFunction`、`isNumber` (有限のときだけ true)、`toVector` (1 段平らにする)
- `setRandom(fn)` で `_random_fn` (既定 `Math.random`) を差し替える (関数でなければ TypeError)。`poisson.sampleLarge` だけは `Math.random` を直接使う
- `extend(obj)` / `extend(target, ...srcs)`
- 形: `rows(a)` (`a.length || 1`)、`cols(a)` (`a[0].length || 1`、平らなベクトルは 1)、`dimensions(a)` (`{rows, cols}`)
- 取り出し:
  - `row(a, i | i[])`、`rowa(a, i)` (同じ)
  - `col(a, j)` は n×1 の行列、配列の添字なら n×k。`cola(a, j)` は平らな配列
  - `diag(a)` は n×1 の列。`antidiag(a)` も n×1 の列
  - `diagonal(vec)` は正方の対角行列を作る
- `transpose(a)`: 平らなベクトルは 1×n とみなして n×1 を返す。結果が 1 行なら平らにして返す (n×1 の転置は平らな配列)
- `map(a, fn(value, row, col), toAlter)` (平らなら平ら)、`cumreduce(a, fn(acc, cur), toAlter)` (行ごと)、`alter(a, fn)` (その場で map)
- 作る:
  - `create(rows, cols, fn(i, j))` / `create(n, fn)`
  - `zeros`・`ones`・`rand`・`identity(rows[, cols])` (cols が無いか数でなければ正方。rand は `_random_fn`)
- `symmetric(a)` (正方でなければ false、`===` で比べる)、`clear(a)` (その場で 0)
- `seq(min, max, length[, fn(value, idx)])`: 両端を含む等間隔 (linspace)。`calcRdx` で 10 進の補正。max を超えたら止める
- `arange(start[, end[, step]])`: numpy の arange (end を含まない)。step が偽なら 1。向きが逆なら `[]`
- `slice(A, {row: int | {start, end, step}, col: ...})`: numpy 風、負の添字可。両方 int ならスカラー、片方 int なら平らな配列、引数なしは複製。`end: 0` は length とみなす癖がある
- `sliceAssign(A, rcSlice, B)`: A を変えて返す (スカラーなら B を返す)。渡した `rcSlice` に既定値を書き込む。バグ: 行が int のとき列の上限に `A[0].length` でなく `A.length` を使う (列が int のときも同様)
- `copy(A)`: 2 段の複製
- `jStat.fn`: `toArray()`、`map`・`cumreduce` (jStat オブジェクトを返す)、`alter` (this を返す)、`transpose`・`clear`・`symmetric`・`rows`・`cols`・`dimensions`・`diag`・`antidiag` (省略可能な非同期のコールバック。配列は jStat オブジェクトで包み、スカラーはそのまま)、`row(i[, cb])`・`col(j[, cb])`、`create`・`zeros`・`ones`・`rand`・`identity`。コールバックは `setTimeout` で呼ばれ、メソッドは `this` を返す

## 2. vector.js

すべて平らな数値の配列を受け取る。並べ替えは複製を数値の昇順で。

| 関数 | 内容 |
|---|---|
| `sum` | 空なら 0 |
| `sumsqrd` | Σx² |
| `sumsqerr` | Σ(x − mean)² |
| `sumrow` | sum と同じ |
| `product` | |
| `min`, `max` | 単純なループ。空なら undefined |
| `unique` | オブジェクトのキーで判定 (1 と "1" が衝突)。最初に出た順 |
| `mean` | sum / n (空なら NaN) |
| `meansqerr` | sumsqerr / n |
| `geomean` | exp(mean(log x)) |
| `median` | n が偶数なら中央 2 つの平均 |
| `cumsum`, `cumprod` | cumreduce |
| `diff` | 隣の差 (長さ n − 1) |
| `rank` | 同順位は平均順位 (`[1,2,2,3]` → `[1, 2.5, 2.5, 4]`) |
| `mode` | 並べた複製で `===`。1 つならその数、最多が同数なら全部 (昇順の配列)、全部異なれば並べた配列全体 |
| `range` | max − min |
| `variance(arr, flag)` | sumsqerr / (n − (flag ? 1 : 0))。**既定は母分散**、flag が真なら標本分散 |
| `stdev(arr, flag)` | variance の平方根 |
| `pooledvariance(arrays)` | ΣSSE_i / (N − k)。`pooledstdev` はその平方根 |
| `deviation` | x − mean の配列 |
| `meandev` | mean(\|x − mean\|) |
| `meddev` | median(\|x − median\|) (1.4826 倍しない) |
| `coeffvar` | 母標準偏差 / mean |
| `quartiles` | `sorted[round(n/4) − 1]`、`sorted[round(n/2) − 1]`、`sorted[round(3n/4) − 1]`。補間なし。n が偶数だと中央は median でない |
| `quantiles(arr, ps, alphap = 3/8, betap = 3/8)` | scipy の `mstats.mquantiles` の移植。m = α + p(1 − α − β)、aleph = np + m、k = floor(clip(aleph, 1, n − 1))、γ = clip(aleph − k, 0, 1)、(1 − γ) x[k−1] + γ x[k]。既定 3/8, 3/8 は **R の type 9** (scipy の既定は 0.4, 0.4)。`[1..6]` の p = 0.25 は 1.9375 |
| `percentile(arr, k, exclusive)` | inclusive は index = k(n − 1) + 1 で **R の type 7** (Excel の PERCENTILE.INC)、exclusive は k(n + 1) で **type 6** (PERCENTILE.EXC)。`idx + 1 < n` のときだけ補間し、それ以外は端数を捨てる。**バグ**: inclusive で k が 1 に近いと誤る (`[1,2,3,4]` の k = 0.9 が 3.7 でなく 3)。exclusive で k が小さいと添字 −1 を読んで NaN |
| `percentileOfScore(arr, score, kind)` | **0〜1 の割合** (百分率ではない)。既定 `'weak'` は ≤、`'strict'` は < |
| `histogram(arr, bins = 4)` | 等幅 (max − min)/bins。添字 `min(floor((x − min)/width), bins − 1)` (最大値は最後の区間)。全部同じ値だと幅 0 で全部数え落とす |
| `covariance(a, b)` | **標本**共分散 (n − 1) |
| `corrcoeff(a, b)` | Pearson |
| `spearmancoeff(a, b)` | 平均順位での Pearson |
| `stanMoment(arr, n)` | Σ((x − μ)/σ)ⁿ / N (σ は母標準偏差) |
| `skewness` | stanMoment(3) (偏りのある g1、e1071 の type 1) |
| `kurtosis` | stanMoment(4) − 3 (**超過**尖度、偏りのある g2、e1071 の type 1) |

インスタンス (`jStat(v).f(fullbool, callback)`): sum sumsqrd sumsqerr sumrow product min max unique mean meansqerr geomean median diff rank mode range variance deviation stdev meandev meddev coeffvar quartiles histogram skewness kurtosis。
- ベクトルなら `jStat.f(this[0], fullbool)` (`jStat(v).variance(true)` は標本分散)
- 行列なら**列ごと**に計算して配列を返す。`fullbool === true` なら行ごとに計算してから、その結果にもう一度 f をかける (`sum(true)` は総和)。`sumrow` は常に行ごと
- 行列では flag が渡らないので、列ごとの variance は常に母分散
- `cumsum`・`cumprod` は列ごと (fullbool なら行ごと、2 段目なし)。`quantiles`・`percentileOfScore` は列ごと
- 静的関数だけでインスタンスが無いもの: `percentile`、`pooledvariance`、`pooledstdev`、`covariance`、`corrcoeff`、`spearmancoeff`、`stanMoment`

## 3. special.js

| 関数 | 内容 |
|---|---|
| `gammaln(x)` | Lanczos (Numerical Recipes の gammln、係数 6 個)、x > 0 |
| `loggam(x)` | SPECFUN の対数ガンマ (Poisson の乱数で使う) |
| `gammafn(x)` | Cody の有理近似。x > 171.62… と 0 以下の整数で Infinity。負の非整数は反射公式 |
| `gammap(a, x)` | **正規化しない**下側不完全ガンマ `lowRegGamma(a, x) · Γ(a)` |
| `lowRegGamma(a, x)` | 正規化した P(a, x)。x < a + 1 で級数、それ以外は連分数。反復回数は `-~(8.5·ln(max(a, 1/a)) + 0.4a + 17)` で固定。x < 0 か a ≤ 0 で NaN |
| `gammapinv(p, a)` | P の逆関数 (NR の invgammp、Halley 法 12 回まで、eps 1e-8)。p ≥ 1 は `max(100, a + 100√a)`、p ≤ 0 は 0 |
| `factorialln(n)`, `factorial(n)` | gammaln(n + 1)、gammafn(n + 1)。n < 0 で NaN |
| `combination(n, m)` | n か m が 170 を超えれば exp(combinationln)、それ以外は n!/m!/(n − m)!。丸めない |
| `combinationln(n, m)` | |
| `permutation(n, m)` | n!/(n − m)! |
| `betafn(x, y)` | x ≤ 0 か y ≤ 0 で undefined。x + y > 170 なら exp(betaln) |
| `betaln(x, y)` | lnΓ(x) + lnΓ(y) − lnΓ(x + y) |
| `betacf(x, a, b)` | 修正 Lentz の連分数、100 回まで、収束判定 **3e-7** (ベータ関数の精度の上限) |
| `ibeta(x, a, b)` | 正規化した I_x(a, b)。x が [0, 1] の外なら **false**。x ≥ (a + 1)/(a + b + 2) で対称性を使う |
| `ibetainv(p, a, b)` | NR の invbetai (Halley 法 10 回まで)。p ≤ 0 で 0、p ≥ 1 で 1 |
| `erf(x)` | 係数 28 個の Chebyshev 近似 |
| `erfc(x)` | 1 − erf(x) (裾で桁落ち) |
| `erfcinv(p)` | p ≥ 2 で −100、p ≤ 0 で 100。有理近似の初期値 + 2 回の反復 |
| `randn(n, m)` | Leva の比の一様乱数法。n があれば n×m の行列 (m の既定は n) |
| `randg(shape, n, m)` | Marsaglia–Tsang。shape が偽なら 1、shape < 1 は `u^(1/α)` で補正。**バグ**: 行列の形は素の配列に `.alter` を呼んで TypeError |

インスタンス: `fn.gammaln`・`gammafn`・`factorial`・`factorialln` (要素ごと)、`fn.randn(n, m)`。

## 4. distribution.js

共通: `jStat.D(a, b, c)` は `_a`/`_b`/`_c` を持つオブジェクト (new は省略可)。`pdf(x)`・`cdf(x)`・`inv(x)` は x が数でなければ map して jStat オブジェクトを返し、x が無ければ `this.data` を使う。`mean()`・`median()`・`mode()`・`variance()`・`sample(arr?)` (arr を渡すとその場で埋める)。`jStat.fn.D(...)` は `.data = this` で作る (`jStat(data).normal(0, 1).pdf()`)。静的メソッドが無いのにインスタンスにはあり、呼ぶと TypeError になるものがある。**skewness はどの分布にも無い**。離散の cdf は P(X ≤ x)。

| 分布 (母数) | 静的メソッド | 注意 |
|---|---|---|
| `beta(alpha, beta)` | pdf, cdf, inv, mean, median, mode, sample, variance | pdf は [0, 1] の外で 0、α = β = 1 で 1。α か β ≥ 512 で対数の形。cdf は x > 1 で 1。median = ibetainv(0.5)。mode = (α−1)/(α+β−2) (検査なし)。sample はガンマの比 |
| `centralF(df1, df2)` | pdf, cdf, inv, mean, mode, sample, variance | median なし。pdf は R の df.c の方式 (非整数の binomial.pdf)。mean は df2 > 2、mode は df1 > 2、variance は df2 > 4 のときだけ (それ以外 undefined) |
| `cauchy(local, scale)` | pdf, cdf, inv, median, mode, sample | mean・variance なし (文書に cauchy.variance があるが未実装) |
| `chisquare(dof)` | pdf, cdf, inv, mean, median, mode, sample, variance | median は Wilson–Hilferty の近似 k(1 − 2/(9k))³。mode = max(k − 2, 0)。dof = 2 の pdf(0) は 0.5 |
| `exponential(rate)` | 8 つ全部 | **rate** λ |
| `gamma(shape, scale)` | pdf, cdf, inv, mean, mode, sample, variance | **scale** θ (rate でない)。median なし。shape ≤ 1 で mode は undefined |
| `invgamma(shape, scale)` | pdf, cdf, inv, mean, mode, sample, variance | pdf = β^α x^(−α−1) e^(−β/x)/Γ(α)、cdf = 1 − P(α, β/x)。mean は α > 1、variance は α > 2。mode = β/(α + 1)。median なし |
| `kumaraswamy(alpha, beta)` | pdf, cdf, inv, mean, median, mode, variance | pdf は台を検査しない。mode は α ≥ 1、β ≥ 1 で両方 ≠ 1 のときだけ。variance は**例外を投げる**。sample なし |
| `laplace(mu, b)` | pdf, cdf, mean, median, mode, variance, sample | **inv なし**。variance = 2b²。b ≤ 0 で pdf・cdf は 0。文書なし |
| `lognormal(mu, sigma)` | 8 つ全部 | μ・σ は対数の尺度 |
| `noncentralt(dof, ncp)` | pdf, cdf | \|ncp\| < 1e-14 で studentt に切り替え。cdf は級数を 200 項以上。文書なし |
| `normal(mean, std)` | 8 つ全部 | 標準偏差を取る |
| `pareto(scale, shape)` | pdf, cdf, inv, mean, median, mode, variance | sample なし。**mean のバグ**: shape·scale^shape/(shape−1) (正しくは shape·scale/(shape−1)、scale = 1 のときだけ一致)。**median のバグ**: scale·shape·√2 (正しくは scale·2^(1/shape))。mode = scale |
| `studentt(dof)` | 8 つ全部 | mean は dof > 1 で 0、それ以外 undefined。variance は dof > 2 で dof/(dof − 2)、1 < dof ≤ 2 で Infinity、それ以外 undefined。pdf は dof を 1e100 で打ち切る |
| `weibull(scale, shape)` | 8 つ全部 | **scale が先** |
| `uniform(a, b)` | pdf, cdf, inv, mean, median, mode, sample, variance | **median のバグ**: `jStat.mean(a, b)` を返して NaN。mode は**例外を投げる** |
| `binomial(n, p)` | pdf(k, n, p), cdf(x, n, p) | pdf は整数の検査なし、p = 0・1 を特別扱い。cdf は x を切り捨て、x < 0 で 0、x ≥ n で 1、母数が不正なら NaN、結果を **1e-10 に丸める** |
| `negbin(r, p)` | pdf(k, r, p), cdf(x, r, p) | pdf = C(k+r−1, r−1)(1−p)^k p^r (r 回目の成功までの**失敗の数** k、p は成功の確率)。k が非負の整数でなければ **false**。cdf は 0..⌊x⌋ の和 |
| `hypgeom(N, m, n)` | pdf(k, N, m, n), cdf(x, N, m, n) | N = 母集団の大きさ、m = 母集団中の成功の数、n = 取り出す数。整数の検査 `k !== k \| 0` は演算子の優先順位のせいで働かない。cdf は x ≥ n か x ≥ m で 1。非整数の x を切り捨てない (切り上げに近い) |
| `poisson(l)` | pdf, cdf, mean, variance, sample, sampleSmall, sampleLarge | pdf は非整数・負の k、l < 0 で 0。cdf は 0..⌊x⌋ の和。sample は l < 10 で Knuth、それ以外 PTRS (`Math.random`)。median・mode・inv なし |
| `triangular(a, b, c)` | 8 つ全部 | a = 最小、b = 最大、c = 最頻値。b ≤ a か c が [a, b] の外で NaN。文書は inv を書いていない |
| `tukey(nmeans, dof)` | cdf(q, nmeans, df), inv(p, nmeans, df) | R の ptukey/qtukey の移植 (nranges = 1)。df < 2 か nmeans < 2 で NaN。収束しないと**例外を投げる** |
| `arcsine(a, b)` | pdf, cdf, inv, mean, median, mode, sample, variance | mode は**例外を投げる**。variance = (b − a)²/8。b ≤ a で NaN |

## 5. linearalgebra.js

| 関数 | 内容 |
|---|---|
| `add(arr, arg)` | arg が配列か jStat なら要素ごと (平らな配列は 1 行として包む)、それ以外はスカラーを全要素に |
| `subtract(arr, arg)` | 同様。`value − arg[r][c] \|\| 0` なので NaN の結果は 0 になる |
| `divide(arr, arg)` | 行列の arg なら `multiply(arr, inv(arg))`、それ以外はスカラーで割る |
| `multiply(arr, arg)` | スカラー × スカラーはスカラー、行列 × 行列は行列の積 (1×1 ならスカラー)、行列 × スカラーは全要素。arr は 2 次元の配列でなければならない |
| `outer(a, b)` | |
| `dot(a, b)` | **行ごと**の内積 (行列の積でない)。n×1 の列は先に転置。ベクトルならスカラー、行列なら行ごとの内積の配列 |
| `pow(arr, p)`, `exp`, `log`, `abs` | 要素ごと |
| `norm(arr, p = 2)` | p ノルム。行列なら最初の行だけ |
| `angle(a, b)` | acos(dot / (norm·norm)) |
| `aug(A, B)` | B を A の右に付ける |
| `inv(A)` | 部分ピボットの Gauss–Jordan |
| `det(A)` | 余因子展開 (再帰)。基底が 2×2 なので 1×1 は失敗 |
| `gauss_elimination(A, b)` | b・x は平らな配列。バグ: ピボット探しが絶対値を取らない値と比べる |
| `gauss_jordan(A, B)` | 簡約した拡大行列 `[I \| X]` |
| `triaUpSolve(A, b)`, `triaLowSolve(A, b)` | 後退・前進代入 (平らか列の b、同じ形で返す)。文書なし |
| `lu(A)` | `[L, U]` (Doolittle、ピボットなし) |
| `cholesky(A)` | 下三角 T (A = T·Tᵀ) |
| `gauss_jacobi(A, b, x, r)`, `gauss_seidel(A, b, x, r)`, `SOR(A, b, x, r, w)` | 反復解法。b・x は n×1、r は停止の許容値、w は緩和係数。n×1 を返す |
| `householder(A)` | Householder の三重対角化 (相似変換) |
| `QR(A)` | 修正 Gram–Schmidt の薄い QR。`[Q (n×p), R (p×p)]` |
| `lstsq(A, b)` | QR による最小二乗。平らな b なら平らな x |
| `jacobi(A)` | 対称行列の Jacobi 法。`[固有ベクトルの行列, 固有値の配列]`。停止の許容値 0.001。バグ: 収束の判定が行・列 0 を飛ばす |
| `rungekutta(f(t, u), h, p, t0, u0, order)` | order は 2 か 4。`t ≤ p` のあいだ進めて最後の u を返す |
| `romberg(f, a, b, order)` | **要素 1 つの配列**を返す |
| `richardson(X, f, x, h)` | 表の値 f (点 X) から 2 階微分を外挿で推定。配列を返す |
| `simpson(f, a, b, n)` | 合成 Simpson |
| `hermite(X, F, dF, value)`, `lagrange(X, F, value)` | 補間 (hermite は導関数つきの大域多項式) |
| `cubic_spline(X, F, value)` | **壊れている** (存在しない `jStat.sq` を呼ぶ) |
| `gauss_quadrature()` | "not yet implemented" で**例外を投げる** |
| `PCA(X)` | X の**行が変数**、列が観測。`[X, 固有値 (降順), Vt (固有ベクトルが行), Y (得点)]`。共分散は n − 1、分解は jacobi |

インスタンス: `fn.add`・`divide`・`multiply`・`subtract`・`dot`・`pow`・`exp`・`log`・`abs`・`norm`・`angle` (`(arg, callback)`、数ならそのまま、それ以外は jStat で包む)。

## 6. test.js

p 値か統計量だけを返す (オブジェクトは返さない)。`sides === 1` で片側、それ以外 (省略を含む) は両側。片側は常に Φ(−|z|)・T(−|t|) で、効果の向きを無視する。

| 関数 | 形 |
|---|---|
| `zscore` | `(value, mean, sd)` → (v − m)/sd、`(value, array, flag)` (flag が真なら標本標準偏差) |
| `ztest` | `(value, array, sides, flag)`、`(value, mean, sd, sides)` (引数が 2 つより多いとき)、`(z, sides)` |
| `tscore` | `(value, mean, sd, n)` → (v − m)/(sd/√n)、`(value, array)` (標本標準偏差、n = 長さ) |
| `ttest` | `(value, mean, sd, n, sides)` (引数ちょうど 5 つ)、`(t, n, sides)`、`(value, array, sides)`。df = n − 1。**癖**: 4 引数 `(value, mean, sd, n)` は `(t, n, sides)` の形に落ちる |
| `anovafscore(a1, a2, ...)` / `([a1, a2, ...])` | F = [Σnᵢ(meanᵢ − 全体の mean)²/(k − 1)] / [SSW/(N − k)] |
| `anovaftest(a1, a2, ...)` | p = 1 − F_cdf(F, k − 1, N − k)。`(F, df1, df2)` も可。配列の配列は受け付けない |
| `ftest(f, df1, df2)` | 1 − F_cdf |
| `qscore` | `(m1, m2, n1, n2, sd)` / `(a1, a2, sd)`。\|m1 − m2\| / (sd·√((1/n1 + 1/n2)/2)) (Tukey–Kramer) |
| `qtest` | `(q, n, k)`、`(m1, m2, n1, n2, sd, n, k)`、`(a1, a2, sd, n, k)`。1 − tukey.cdf(q, k, n − k) |
| `tukeyhsd(arrays)` | `[[[i, j], p], ...]` (i < j の全組)。`pooledstdev` と総数 N |
| `normalci` | `(value, alpha, sd, n)` / `(value, alpha, array)` → value ∓ \|z_(α/2)\|·sd/√n。配列の形は**母標準偏差** |
| `tci` | 同じ 2 つの形、t (df n − 1)。配列の形は**標本標準偏差** |
| `significant(p, alpha)` | p < alpha |

インスタンス (`jStat.fn` だけ): `zscore(value, flag)`、`ztest(value, sides, flag)`、`tscore(value)` (n = `this.cols()`)、`ttest(value, sides)` (片側は `1 − cdf(|t|)`)、`anovafscore()`、**`anovaftes()`** (綴りがこのとおり。文書の `anovaftest()` は存在しない。df = (k − 1, N − k))、`normalci(value, alpha)`、`tci(value, alpha)`。
**`oneSidedDifferenceOfProportions(p1, n1, p2, n2)`・`twoSidedDifferenceOfProportions(...)`** は `jStat.fn` にだけある。プールした比率の z、`ztest(z, 1)`・`ztest(z, 2)`。0 < p ≤ 1 でなければ例外。

## 7. models.js: `jStat.models.ols(endog, exog)`

exog は定数の列を含めて渡す (自動で足さない)。返すもの:
- `exog`、`endog`、`nobs`、`df_model` = p − 1、`df_resid` = n − p
- `coef` (lstsq)、`predict`、`resid` (`jStat.subtract` なので `|| 0` の癖あり)、`ybar`
- **`SSE` = Σ(ŷ − ȳ)²** (説明された平方和。普通の名前と逆)、**`SSR` = Σ(y − ŷ)²** (残差平方和)、`SST` = SSE + SSR、`R2` = SSE/SST
- `t`: `{ se, t, p (両側、df_resid), sigmaHat = √(SSR/df_resid), interval95: [[lo, hi], ...] }` (se は σ̂·√[(XᵀX)⁻¹]ⱼⱼ と同じ)
- `f`: `{ F_statistic = (R2/df_model)/((1 − R2)/df_resid), pvalue }`
- `adjust_R2` = 1 − (1 − R2)(n − 1)/df_resid

## 8. regression.js (すべて文書なし。ソースに "regress and regresst to be fixed" とある)

- `buildxmatrix(row1, row2, ...)` (各行の前に 1)、`builddxmatrix([rows])`、`buildjxmatrix(jMat)`、`buildymatrix(arr)`、`buildjymatrix(jMat)`、`matrixmult(A, B)`
- `regress(X, Y)`: β = (XᵀX)⁻¹XᵀY
- `regresst(X, Y, sides)`: `anova` = `{residuals, ssr (回帰), msr, sse (誤差), mse, sst, mst, r2, fratio, pvalue, rmse, r2adj}` (r2・r2adj は 0 で下限)、`yBar`、`stats` = `[[β, se, |t|, p], ...]` (t 検定の df が n − p − 1 で 1 つずれているように見える)、`regress` = β
- `xtranspx`、`xtranspxinv`、`jMatYBar`、`residuals`、`ssr`、`sse`、`sst`、`matrixsubtract`

## 文書と実装の食い違い

- コードにあって文書に無い: `setRandom`、`_random_fn`、`utils.toVector`、`jStat.jStat`、`stanMoment`、`loggam`、`combinationln`、`noncentralt` と `laplace` (全体)、`triangular.inv`、`poisson.mean`・`variance`・`sampleSmall`・`sampleLarge`、`jStat.fn.<dist>`、`triaUpSolve`・`triaLowSolve`、`fn.gammaln` など、`fn.anovaftes`、ols の一部のフィールド、regression.js の全部 (`extend`・`unique` は overview.md にだけある。`spearmancoeff` は corrcoeff の節の中にだけある)
- 文書にあってコードに無い・壊れている:
  - 無い: `cauchy.variance`、インスタンスの `anovaftest()`
  - 呼ぶと例外: `kumaraswamy.variance`、`uniform.mode`、`arcsine.mode`、`gauss_quadrature`
  - 壊れている: `cubic_spline`、行列の形の `randg`
  - 値が誤り: `uniform.median`、`pareto.mean`、`pareto.median`、k が 1 に近い `percentile`
