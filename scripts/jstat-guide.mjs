// Writes the jStat migration guide, docs/migrating-from-jstat.md and docs/ja/migrating-from-jstat.md, from the table
// below. A row is marked "planned" while a function it names is not exported yet (read from src/entries/), so the
// guide follows the code: rerun after adding functions.
//
//   node scripts/jstat-guide.mjs
//
// Cell syntax: the rStats.js column is Markdown; names of rStats.js functions are written as calls inside backticks
// (`mean(x)`), which is how test/jstat-coverage.test.ts finds and checks them. A cell starting with "JS:" is plain
// JavaScript (nothing from rStats.js is needed); "—" means there is no counterpart (with the reason in the notes).

import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);

/** [jStat name, rStats.js (Markdown), note (English), note (Japanese)] */
const rows = {
  core: [
    ["jStat", "JS: arrays (`[1, 2, 3]`, arrays of rows for matrices)", "rStats.js works on plain arrays; there is no wrapper object or method chaining.", "rStats.js は素の配列を扱います。ラッパーのオブジェクトやメソッドのチェーンはありません。"],
    ["jStat.utils.calcRdx", "—", "Internal helper of jStat's `seq`.", "jStat の `seq` の内部の補助関数です。"],
    ["jStat.utils.isArray", "JS: `Array.isArray(x)`", "", ""],
    ["jStat.utils.isFunction", "JS: `typeof f === \"function\"`", "", ""],
    ["jStat.utils.isNumber", "JS: `Number.isFinite(x)`", "jStat's `isNumber` is true only for finite numbers.", "jStat の `isNumber` は有限の数のときだけ真です。"],
    ["jStat.utils.toVector", "JS: `x.flat()`", "", ""],
    ["jStat.setRandom", "`setSeed(seed)`", "rStats.js uses R's Mersenne-Twister, so `setSeed(42)` gives the same numbers as R's `set.seed(42)`. A custom generator cannot be plugged in.", "rStats.js は R の Mersenne-Twister を使うので、`setSeed(42)` で R の `set.seed(42)` と同じ乱数になります。独自の乱数生成器は差し込めません。"],
    ["jStat.extend", "JS: `Object.assign(target, source)`", "", ""],
    ["jStat.rows", "JS: `a.length`", "", ""],
    ["jStat.cols", "JS: `a[0].length`", "", ""],
    ["jStat.dimensions", "JS: `({ rows: a.length, cols: a[0].length })`", "", ""],
    ["jStat.row", "JS: `a[i]`", "", ""],
    ["jStat.rowa", "JS: `a[i]`", "", ""],
    ["jStat.col", "JS: `a.map((r) => [r[j]])`", "jStat returns an n × 1 matrix.", "jStat は n × 1 の行列を返します。"],
    ["jStat.cola", "JS: `a.map((r) => r[j])`", "", ""],
    ["jStat.diag", "`diag(a)`", "R's `diag` of a matrix returns its diagonal as a flat array (jStat: an n × 1 matrix).", "行列の `diag` は対角要素を平らな配列で返します (jStat は n × 1 の行列)。"],
    ["jStat.antidiag", "JS: `a.map((r, i) => r[r.length - 1 - i])`", "", ""],
    ["jStat.diagonal", "`diag(v)`", "`diag` of a vector of length ≥ 2 builds the diagonal matrix, as in R.", "長さ 2 以上のベクトルの `diag` は、R と同じく対角行列を作ります。"],
    ["jStat.transpose", "`t(a)`", "`t` always returns a matrix (jStat flattens a 1-row result).", "`t` は常に行列を返します (jStat は 1 行の結果を平らにします)。"],
    ["jStat.map", "JS: `a.map((r) => r.map(f))`", "", ""],
    ["jStat.cumreduce", "JS: `a.map((r) => { let s = 0; return r.map((v) => (s += v)); })`", "For running sums use `cumsum(x)`.", "累積和なら `cumsum(x)` を使います。"],
    ["jStat.alter", "JS: `a.forEach((r) => r.forEach((v, j) => (r[j] = f(v))))`", "", ""],
    ["jStat.create", "`matrix(data, nrow, ncol)`", "Or build the array of rows in JavaScript.", "JavaScript で行の配列を作ってもかまいません。"],
    ["jStat.zeros", "`matrix(0, nrow, ncol)`", "", ""],
    ["jStat.ones", "`matrix(1, nrow, ncol)`", "", ""],
    ["jStat.rand", "`matrix(runif(nrow * ncol), nrow, ncol)`", "Reproducible with `setSeed`.", "`setSeed` で再現できます。"],
    ["jStat.identity", "`diag(n)`", "", ""],
    ["jStat.symmetric", "JS: `a.every((r, i) => r.every((v, j) => v === a[j][i]))`", "", ""],
    ["jStat.clear", "JS: `a.forEach((r) => r.fill(0))`", "", ""],
    ["jStat.seq", "`seq(from, to, { lengthOut })`", "R's `seq(length.out = n)` hits both ends exactly.", "R の `seq(length.out = n)` は両端をちょうどにします。"],
    ["jStat.arange", "`seq(from, to, { by })`", "R's `seq` includes `to` when it is reached; `arange` stops before `end`.", "R の `seq` は `to` に届けば含めます。`arange` は `end` の手前で止まります。"],
    ["jStat.slice", "JS: `a.slice(r0, r1).map((r) => r.slice(c0, c1))`", "", ""],
    ["jStat.sliceAssign", "JS: assign to `a[i][j]` in a loop", "jStat's version has a bug when the row is an integer (it bounds the columns by the number of rows).", "jStat の実装は行が整数のときにバグがあります (列の上限に行数を使う)。"],
    ["jStat.copy", "JS: `a.map((r) => [...r])`", "", ""],
  ],
  vector: [
    ["jStat.sum", "`sum(x)`", "Summed in double-double, as R sums in long double.", "R が long double で足すのと同じく、double-double で足します。"],
    ["jStat.sumsqrd", "`sum(x.map((v) => v * v))`", "", ""],
    ["jStat.sumsqerr", "`variance(x) * (x.length - 1)`", "", ""],
    ["jStat.sumrow", "`sum(x)`", "", ""],
    ["jStat.product", "`prod(x)`", "", ""],
    ["jStat.min", "`range(x)[0]`", "Or `Math.min(...x)` for short arrays.", "短い配列なら `Math.min(...x)` でもかまいません。"],
    ["jStat.max", "`range(x)[1]`", "Or `Math.max(...x)` for short arrays.", "短い配列なら `Math.max(...x)` でもかまいません。"],
    ["jStat.unique", "`unique(x)`", "jStat compares object keys, so `1` and `\"1\"` collide.", "jStat はオブジェクトのキーで比べるので、`1` と `\"1\"` が衝突します。"],
    ["jStat.mean", "`mean(x)`", "Accurate to the last bit (double-double sum and R's correction step); `trim` as in R.", "最後のビットまで正確です (double-double の和と R の補正)。`trim` は R と同じです。"],
    ["jStat.meansqerr", "`variance(x) * (x.length - 1) / x.length`", "", ""],
    ["jStat.geomean", "`geometricMean(x)`", "As `DescTools::Gmean`: NaN with a negative value, 0 with a zero.", "`DescTools::Gmean` と同じで、負の値があれば NaN、0 があれば 0 です。"],
    ["jStat.median", "`median(x)`", "", ""],
    ["jStat.cumsum", "`cumsum(x)`", "", ""],
    ["jStat.cumprod", "`cumprod(x)`", "", ""],
    ["jStat.diff", "`diff(x)`", "Also `lag` and `differences`, as in R.", "R と同じく `lag` と `differences` も指定できます。"],
    ["jStat.rank", "`rank(x)`", "Ties get the average rank by default (`tiesMethod` as in R).", "同順位の既定は平均順位です (`tiesMethod` は R と同じ)。"],
    ["jStat.mode", "`modes(x)`", "As `DescTools::Mode`: all most frequent values in increasing order, and NaN when every value occurs once (jStat then returns the whole sorted array).", "`DescTools::Mode` と同じで、最多の値すべてを昇順で返し、どの値も 1 回なら NaN です (jStat は並べた配列全体を返します)。"],
    ["jStat.range", "`range(x)`", "R's `range` returns `[min, max]`; jStat returns `max - min` (`diff(range(x))`).", "R の `range` は `[min, max]` を返します。jStat は `max - min` を返します (`diff(range(x))`)。"],
    ["jStat.variance", "`variance(x)`", "**Default differs:** `variance` (R's `var`) is the sample variance (n − 1), jStat's default is the population variance. `jStat.variance(x, true)` is `variance(x)`.", "**既定が違います:** `variance` (R の `var`) は標本分散 (n − 1)、jStat の既定は母分散です。`jStat.variance(x, true)` が `variance(x)` です。"],
    ["jStat.stdev", "`sd(x)`", "**Default differs:** sample standard deviation (n − 1).", "**既定が違います:** 標本標準偏差 (n − 1) です。"],
    ["jStat.pooledvariance", "`aov(groups).meanSq[1]`", "The residual mean square of a one-way ANOVA.", "一元配置分散分析の残差平均平方です。"],
    ["jStat.pooledstdev", "`Math.sqrt(aov(groups).meanSq[1])`", "", ""],
    ["jStat.deviation", "JS: `x.map((v) => v - m)` with `m = mean(x)`", "", ""],
    ["jStat.meandev", "`meanAD(x)`", "As `DescTools::MeanAD`.", "`DescTools::MeanAD` と同じです。"],
    ["jStat.meddev", "`mad(x, { constant: 1 })`", "R's `mad` multiplies by 1.4826 by default; jStat does not.", "R の `mad` は既定で 1.4826 倍します。jStat はしません。"],
    ["jStat.coeffvar", "`cv(x)`", "**Differs:** `cv` (`DescTools::CoefVar`) uses the sample standard deviation; jStat uses the population one.", "**違います:** `cv` (`DescTools::CoefVar`) は標本標準偏差、jStat は母標準偏差を使います。"],
    ["jStat.quartiles", "`quantile(x, [0.25, 0.5, 0.75])`", "jStat picks order statistics without interpolation (and its middle value is not the median for even n). Pass `type` for other definitions.", "jStat は補間せずに順序統計量を選びます (n が偶数だと中央の値が中央値になりません)。別の定義は `type` で選びます。"],
    ["jStat.quantiles", "`quantile(x, p, { type: 9 })`", "jStat's default (α, β) = (3/8, 3/8) is R's type 9; R's default is type 7.", "jStat の既定 (α, β) = (3/8, 3/8) は R の type 9 です。R の既定は type 7 です。"],
    ["jStat.percentile", "`quantile(x, p)`", "Inclusive is R's type 7, `exclusive = true` is type 6 (`{ type: 6 }`). jStat is wrong for p close to 1 (`[1, 2, 3, 4]`, 0.9 gives 3 instead of 3.7) and returns NaN for small p when exclusive.", "inclusive は R の type 7、`exclusive = true` は type 6 (`{ type: 6 }`) です。jStat は p が 1 に近いと誤り (`[1, 2, 3, 4]` の 0.9 が 3.7 でなく 3)、exclusive で p が小さいと NaN を返します。"],
    ["jStat.percentileOfScore", "`ecdf(x)(score)`", "The fraction of values ≤ score (jStat's default `'weak'`); for `'strict'` use `x.filter((v) => v < score).length / x.length`.", "score 以下の値の割合です (jStat の既定 `'weak'`)。`'strict'` なら `x.filter((v) => v < score).length / x.length` です。"],
    ["jStat.histogram", "`hist(x, { breaks })`", "R chooses breaks with `pretty` (Sturges by default) and counts right-closed intervals; `hist(x, { breaks: seq(min, max, { lengthOut: bins + 1 }) }).counts` gives jStat's equal-width bins.", "R は `pretty` で区切りを選び (既定は Sturges)、右閉区間で数えます。jStat の等幅の区間は `hist(x, { breaks: seq(min, max, { lengthOut: bins + 1 }) }).counts` で得られます。"],
    ["jStat.covariance", "`cov(x, y)`", "", ""],
    ["jStat.corrcoeff", "`cor(x, y)`", "", ""],
    ["jStat.spearmancoeff", "`cor(x, y, { method: \"spearman\" })`", "", ""],
    ["jStat.stanMoment", "`skewness(x)` / `kurtosis(x)`", "jStat's standardized moments with the population standard deviation; for other orders compute `mean(x.map((v) => ((v - m) / s) ** k))`.", "jStat の標準化モーメント (母標準偏差) です。ほかの次数は `mean(x.map((v) => ((v - m) / s) ** k))` で計算します。"],
    ["jStat.skewness", "`skewness(x, { type: 1 })`", "jStat's skewness is e1071's type 1; e1071's default is type 3.", "jStat の歪度は e1071 の type 1 です。e1071 の既定は type 3 です。"],
    ["jStat.kurtosis", "`kurtosis(x, { type: 1 })`", "Excess kurtosis, e1071's type 1 (e1071's default is type 3).", "超過尖度で、e1071 の type 1 です (e1071 の既定は type 3)。"],
  ],
  special: [
    ["jStat.gammaln", "`lgamma(x)`", "", ""],
    ["jStat.loggam", "`lgamma(x)`", "", ""],
    ["jStat.gammafn", "`gamma(x)`", "", ""],
    ["jStat.gammap", "`gammainc(x, a).lower`", "The non-regularized lower incomplete gamma function.", "正規化しない下側不完全ガンマ関数です。"],
    ["jStat.lowRegGamma", "`pgamma(x, a)`", "Note the argument order: R's `pgamma(q, shape)`.", "引数の順に注意: R の `pgamma(q, shape)` です。"],
    ["jStat.gammapinv", "`qgamma(p, a)`", "", ""],
    ["jStat.factorialln", "`lfactorial(n)`", "", ""],
    ["jStat.factorial", "`factorial(n)`", "", ""],
    ["jStat.combination", "`choose(n, k)`", "R's `choose` rounds to an integer for integer arguments.", "R の `choose` は整数の引数では整数に丸めます。"],
    ["jStat.combinationln", "`lchoose(n, k)`", "", ""],
    ["jStat.permutation", "`perm(n, k)`", "", ""],
    ["jStat.betafn", "`beta(a, b)`", "", ""],
    ["jStat.betaln", "`lbeta(a, b)`", "", ""],
    ["jStat.betacf", "`pbeta(x, a, b)`", "jStat's continued fraction stops at a relative change of 3e-7, which limits its incomplete beta function to about 7 digits.", "jStat の連分数は相対変化 3e-7 で止まるので、不完全ベータ関数の精度は 7 桁ほどです。"],
    ["jStat.ibeta", "`pbeta(x, a, b)`", "jStat returns `false` outside [0, 1]; R returns 0 or 1.", "jStat は [0, 1] の外で `false` を返します。R は 0 か 1 を返します。"],
    ["jStat.ibetainv", "`qbeta(p, a, b)`", "", ""],
    ["jStat.erf", "`erf(x)`", "", ""],
    ["jStat.erfc", "`erfc(x)`", "jStat computes 1 − erf(x), which loses the tail; `erfc` keeps full relative accuracy.", "jStat は 1 − erf(x) で計算するので裾が失われます。`erfc` は相対精度を保ちます。"],
    ["jStat.erfcinv", "`erfcinv(p)`", "", ""],
    ["jStat.randn", "`rnorm(n)`", "For a matrix: `matrix(rnorm(n * m), n, m)`.", "行列なら `matrix(rnorm(n * m), n, m)` です。"],
    ["jStat.randg", "`rgamma(n, shape)`", "jStat's matrix form throws a TypeError.", "jStat の行列の形は TypeError になります。"],
  ],
  distribution: [],
  linearalgebra: [
    ["jStat.add", "`add(a, b)`", "Element-wise with R's recycling (a scalar, a vector or a matrix of the same shape).", "R の再利用規則による要素ごとの演算です (スカラー、ベクトル、同じ形の行列)。"],
    ["jStat.subtract", "`subtract(a, b)`", "jStat turns NaN results into 0 (`value - arg || 0`).", "jStat は NaN の結果を 0 にします (`value - arg || 0`)。"],
    ["jStat.divide", "`divide(a, b)`", "Element-wise. jStat's `divide` by a matrix multiplies by its inverse: `matMul(a, solve(b))`.", "要素ごとです。jStat の行列による `divide` は逆行列を掛けます: `matMul(a, solve(b))`。"],
    ["jStat.multiply", "`matMul(a, b)`", "jStat's `multiply` is the matrix product for two matrices and element-wise for a scalar; rStats.js has `matMul` (R's `%*%`) and element-wise `multiply`.", "jStat の `multiply` は行列どうしなら行列の積、スカラーなら要素ごとです。rStats.js では `matMul` (R の `%*%`) と要素ごとの `multiply` に分かれます。"],
    ["jStat.outer", "`outer(x, y)`", "", ""],
    ["jStat.dot", "`matMul(a, b)`", "jStat's `dot` is the row-wise inner product; for two vectors it is `sum(multiply(x, y))`.", "jStat の `dot` は行ごとの内積です。2 つのベクトルなら `sum(multiply(x, y))` です。"],
    ["jStat.pow", "JS: `a.map((r) => r.map((v) => v ** p))`", "", ""],
    ["jStat.exp", "JS: `a.map((r) => r.map(Math.exp))`", "", ""],
    ["jStat.log", "JS: `a.map((r) => r.map(Math.log))`", "", ""],
    ["jStat.abs", "JS: `a.map((r) => r.map(Math.abs))`", "", ""],
    ["jStat.norm", "`norm(a, { type: \"F\" })`", "R's `norm` is a matrix norm; for jStat's p-norm of a vector use `sum(x.map((v) => Math.abs(v) ** p)) ** (1 / p)`.", "R の `norm` は行列のノルムです。jStat のベクトルの p ノルムは `sum(x.map((v) => Math.abs(v) ** p)) ** (1 / p)` です。"],
    ["jStat.angle", "JS: `Math.acos(sum(multiply(x, y)) / Math.sqrt(sum(multiply(x, x)) * sum(multiply(y, y))))`", "", ""],
    ["jStat.aug", "`cbind(a, b)`", "", ""],
    ["jStat.inv", "`solve(a)`", "", ""],
    ["jStat.det", "`det(a)`", "LU decomposition (jStat expands cofactors recursively and fails on 1 × 1).", "LU 分解で計算します (jStat は余因子展開を再帰的に行い、1 × 1 で失敗します)。"],
    ["jStat.gauss_elimination", "`solve(a, b)`", "jStat's pivot search compares signed values.", "jStat のピボット探しは符号付きの値で比べます。"],
    ["jStat.gauss_jordan", "`solve(a, b)`", "", ""],
    ["jStat.triaUpSolve", "`backsolve(r, b)`", "", ""],
    ["jStat.triaLowSolve", "`forwardsolve(l, b)`", "", ""],
    ["jStat.lu", "`lu(a)`", "With partial pivoting (LAPACK's dgetrf, as `Matrix::lu`): `a = P L U`. jStat's has no pivoting.", "部分ピボット付きです (LAPACK の dgetrf、`Matrix::lu` と同じ): `a = P L U`。jStat のものはピボットしません。"],
    ["jStat.cholesky", "`t(chol(a))`", "R's `chol` returns the upper triangle R (a = RᵀR); jStat returns the lower one.", "R の `chol` は上三角 R (a = RᵀR) を返します。jStat は下三角を返します。"],
    ["jStat.gauss_jacobi", "`solve(a, b)`", "A direct solve replaces the iterative methods.", "反復解法の代わりに直接解きます。"],
    ["jStat.gauss_seidel", "`solve(a, b)`", "", ""],
    ["jStat.SOR", "`solve(a, b)`", "", ""],
    ["jStat.householder", "`eigen(a)`", "jStat's Householder tridiagonalization is a step towards eigenvalues; `eigen` gives them directly.", "jStat の Householder の三重対角化は固有値を求める途中の段階です。`eigen` は固有値を直接与えます。"],
    ["jStat.QR", "`qr(a)`", "Householder QR with R's column pivoting (`qrQ`, `qrR`).", "R の列ピボット付きの Householder QR です (`qrQ`、`qrR`)。"],
    ["jStat.lstsq", "`qrSolve(a, b)`", "", ""],
    ["jStat.jacobi", "`eigen(a, { symmetric: true })`", "jStat stops at a tolerance of 0.001 and skips row and column 0 in its convergence test.", "jStat は許容値 0.001 で止まり、収束の判定で行と列 0 を飛ばします。"],
    ["jStat.rungekutta", "`ode(y, times, func, { method: \"rk4\" })`", "Fixed-step `euler`, `rk2` and `rk4` as in `deSolve::ode`; returns the whole trajectory.", "`deSolve::ode` と同じ固定刻みの `euler`・`rk2`・`rk4` です。軌跡全体を返します。"],
    ["jStat.romberg", "`integrate(f, a, b)`", "Adaptive Gauss-Kronrod (QUADPACK, as R's `integrate`), with an error estimate.", "適応 Gauss-Kronrod 法 (QUADPACK、R の `integrate` と同じ) で、誤差の見積もりも返します。"],
    ["jStat.richardson", "`hessian(f, x)`", "jStat extrapolates a second derivative from tabulated values; `grad` and `hessian` use Richardson extrapolation on a function (`numDeriv`).", "jStat は表の値から 2 階微分を外挿します。`grad` と `hessian` は関数に対して Richardson の外挿を使います (`numDeriv`)。"],
    ["jStat.simpson", "`integrate(f, a, b)`", "", ""],
    ["jStat.hermite", "`hermiteInterp(x, y, dy, xout)`", "The global polynomial through values and derivatives, as jStat's; for piecewise cubic Hermite use `splinefunH`.", "jStat と同じく値と導関数を通る大域の多項式です。区分的な 3 次の Hermite 補間は `splinefunH` です。"],
    ["jStat.lagrange", "`barylag(x, y, xout)`", "Barycentric Lagrange interpolation, as `pracma::barylag`.", "重心型の Lagrange 補間で、`pracma::barylag` と同じです。"],
    ["jStat.cubic_spline", "`spline(x, y, { xout })`", "jStat's `cubic_spline` throws (it calls a missing `jStat.sq`). `splinefun` returns a function.", "jStat の `cubic_spline` は例外になります (存在しない `jStat.sq` を呼ぶ)。`splinefun` は関数を返します。"],
    ["jStat.gauss_quadrature", "`integrate(f, a, b)`", "jStat's throws \"not yet implemented\".", "jStat のものは \"not yet implemented\" で例外になります。"],
    ["jStat.PCA", "`prcomp(x)`", "Observations are the rows of `x` (jStat: the columns). Signs of components may differ.", "観測は `x` の行です (jStat は列)。主成分の符号は違うことがあります。"],
  ],
  test: [
    ["jStat.zscore", "JS: `(value - mean(x)) / sd(x)`", "", ""],
    ["jStat.ztest", "`zTest(x, { mu, sigmaX })`", "As `BSDA::z.test`. jStat's one-sided p-value ignores the direction of the effect.", "`BSDA::z.test` と同じです。jStat の片側 p 値は効果の向きを無視します。"],
    ["jStat.tscore", "`tTest(x, { mu }).statistic`", "", ""],
    ["jStat.ttest", "`tTest(x, { mu }).pValue`", "jStat's four-argument form is misread as `(t, n, sides)`.", "jStat の 4 引数の形は `(t, n, sides)` と解釈されてしまいます。"],
    ["jStat.anovafscore", "`aov(groups).fValue`", "", ""],
    ["jStat.anovaftest", "`aov(groups).pValue`", "Or `onewayTest(groups, { varEqual: true })`.", "`onewayTest(groups, { varEqual: true })` でも得られます。"],
    ["jStat.ftest", "`pf(f, df1, df2, { lowerTail: false })`", "", ""],
    ["jStat.qscore", "`TukeyHSD(groups)`", "", ""],
    ["jStat.qtest", "`ptukey(q, k, df, { lowerTail: false })`", "", ""],
    ["jStat.tukeyhsd", "`TukeyHSD(groups)`", "Also returns the differences and intervals, as R's `TukeyHSD`.", "R の `TukeyHSD` と同じく差と信頼区間も返します。"],
    ["jStat.normalci", "`zTest(x, { sigmaX }).confInt`", "jStat's array form uses the population standard deviation.", "jStat の配列の形は母標準偏差を使います。"],
    ["jStat.tci", "`tTest(x).confInt`", "", ""],
    ["jStat.significant", "JS: `p < alpha`", "", ""],
    ["jStat.fn.anovaftes", "`aov(groups).pValue`", "Spelled `anovaftes` in jStat (the documented `anovaftest()` instance method does not exist).", "jStat での綴りは `anovaftes` です (文書にあるインスタンスの `anovaftest()` は存在しません)。"],
    ["jStat.fn.oneSidedDifferenceOfProportions", "`propTest([x1, x2], [n1, n2], { alternative: \"greater\", correct: false })`", "The pooled z test is the chi-squared test without continuity correction; choose the side with `alternative`.", "プールした比率の z 検定は、連続性補正のないカイ二乗検定です。向きは `alternative` で選びます。"],
    ["jStat.fn.twoSidedDifferenceOfProportions", "`propTest([x1, x2], [n1, n2], { correct: false })`", "", ""],
  ],
  models: [
    ["jStat.models.ols", "`lm(x, y)`", "`lm` adds the intercept itself (jStat expects a column of ones). jStat's `SSE` is the explained sum of squares and `SSR` the residual one, the reverse of the usual names.", "`lm` は切片を自分で足します (jStat は 1 の列を含めて渡します)。jStat の `SSE` は説明された平方和、`SSR` は残差平方和で、普通の名前と逆です。"],
  ],
  regression: [
    ["jStat.buildxmatrix", "`lm(x, y)`", "Not needed: `lm` takes the predictors as a matrix and adds the intercept.", "不要です: `lm` は説明変数を行列で受け取り、切片を足します。"],
    ["jStat.builddxmatrix", "`lm(x, y)`", "", ""],
    ["jStat.buildjxmatrix", "`lm(x, y)`", "", ""],
    ["jStat.buildymatrix", "`lm(x, y)`", "", ""],
    ["jStat.buildjymatrix", "`lm(x, y)`", "", ""],
    ["jStat.matrixmult", "`matMul(a, b)`", "", ""],
    ["jStat.regress", "`lm(x, y).coefficients`", "", ""],
    ["jStat.regresst", "`lm(x, y)`", "The coefficient table (estimates, standard errors, t and p) and the ANOVA quantities. jStat's t tests appear to use n − p − 1 degrees of freedom.", "係数の表 (推定値・標準誤差・t・p) と分散分析の量です。jStat の t 検定は自由度を n − p − 1 にしているように見えます。"],
    ["jStat.xtranspx", "`crossprod(x)`", "", ""],
    ["jStat.xtranspxinv", "`solve(crossprod(x))`", "", ""],
    ["jStat.jMatYBar", "`mean(y)`", "", ""],
    ["jStat.residuals", "`lm(x, y).residuals`", "", ""],
    ["jStat.ssr", "`lm(x, y)`", "The regression sum of squares: `sum(fitted.map((v) => (v - mean(y)) ** 2))`.", "回帰の平方和です: `sum(fitted.map((v) => (v - mean(y)) ** 2))`。"],
    ["jStat.sse", "`lm(x, y)`", "The residual sum of squares: `sum(residuals.map((v) => v * v))`.", "残差平方和です: `sum(residuals.map((v) => v * v))`。"],
    ["jStat.sst", "`variance(y) * (y.length - 1)`", "", ""],
    ["jStat.matrixsubtract", "`subtract(a, b)`", "", ""],
  ],
};

// Distributions: [jStat name, d/p/q/r prefix name in R, call arguments, distSummary name and parameters, notes]
const dists = [
  ["normal", "norm", "x, { mean, sd }", "\"norm\", { mean, sd }", "Takes the standard deviation, as jStat.", "jStat と同じく標準偏差を取ります。"],
  ["studentt", "t", "x, df", "\"t\", { df }", "", ""],
  ["centralF", "f", "x, df1, df2", "\"f\", { df1, df2 }", "", ""],
  ["chisquare", "chisq", "x, df", "\"chisq\", { df }", "jStat's median is the Wilson-Hilferty approximation; `distSummary` gives `qchisq(0.5, df)`.", "jStat の median は Wilson-Hilferty の近似です。`distSummary` は `qchisq(0.5, df)` を返します。"],
  ["beta", "beta", "x, a, b", "\"beta\", { shape1: a, shape2: b }", "", ""],
  ["gamma", "gamma", "x, shape, { scale }", "\"gamma\", { shape, scale }", "**Parameter:** jStat's second parameter is the scale; R's default is the rate, so pass `{ scale }`.", "**母数:** jStat の 2 つ目の母数は尺度です。R の既定は rate なので `{ scale }` で渡します。"],
  ["invgamma", "invgamma", "x, alpha, { beta }", "\"invgamma\", { alpha, beta }", "extraDistr's names: `beta` is the scale.", "extraDistr の名前です: `beta` が尺度です。"],
  ["lognormal", "lnorm", "x, { meanlog, sdlog }", "\"lnorm\", { meanlog, sdlog }", "", ""],
  ["exponential", "exp", "x, { rate }", "\"exp\", { rate }", "", ""],
  ["uniform", "unif", "x, { min, max }", "\"unif\", { min, max }", "jStat's median returns NaN and its mode throws.", "jStat の median は NaN を返し、mode は例外になります。"],
  ["cauchy", "cauchy", "x, { location, scale }", "\"cauchy\", { location, scale }", "", ""],
  ["weibull", "weibull", "x, shape, { scale }", "\"weibull\", { shape, scale }", "**Order:** jStat takes (scale, shape), R takes (shape, scale).", "**順序:** jStat は (scale, shape)、R は (shape, scale) です。"],
  ["kumaraswamy", "kumar", "x, a, b", "\"kumar\", { a, b }", "jStat's variance throws.", "jStat の variance は例外になります。"],
  ["laplace", "laplace", "x, { mu, sigma }", "\"laplace\", { mu, sigma }", "jStat has no inverse; `qlaplace` is available.", "jStat には逆関数がありません。`qlaplace` があります。"],
  ["pareto", "pareto", "x, { a, b }", "\"pareto\", { a, b }", "extraDistr's names: `a` is the shape and `b` the scale (jStat: (scale, shape)). jStat's mean and median are wrong.", "extraDistr の名前です: `a` が形、`b` が尺度です (jStat は (scale, shape))。jStat の mean と median は誤りです。"],
  ["triangular", "triang", "x, { a, b, c }", "\"triang\", { a, b, c }", "Minimum, maximum and mode, as jStat.", "jStat と同じく最小・最大・最頻値です。"],
  ["arcsine", "arcsine", "x, { a, b }", "\"arcsine\", { a, b }", "jStat's mode throws; there are two modes (at a and b), so `distSummary` returns NaN.", "jStat の mode は例外になります。最頻値は 2 つ (a と b) なので `distSummary` は NaN を返します。"],
  ["binomial", "binom", "x, size, prob", "\"binom\", { size, prob }", "jStat rounds the cdf to 1e-10.", "jStat は cdf を 1e-10 に丸めます。"],
  ["negbin", "nbinom", "x, size, { prob }", "\"nbinom\", { size, prob }", "Both count the failures before the `size`-th success.", "どちらも `size` 回目の成功までの失敗の数です。"],
  ["hypgeom", "hyper", "x, m, n, k", "\"hyper\", { m, n, k }", "**Parameters:** jStat's (N, m, n) is (population, successes, draws); R's `dhyper(x, m, n, k)` takes successes m, failures n = N − m and draws k.", "**母数:** jStat の (N, m, n) は (母集団、成功の数、取り出す数) です。R の `dhyper(x, m, n, k)` は成功 m、失敗 n = N − m、取り出す数 k を取ります。"],
  ["poisson", "pois", "x, lambda", "\"pois\", { lambda }", "", ""],
  ["tukey", "tukey", "q, nmeans, df", "", "", ""],
  ["noncentralt", "t", "x, df, { ncp }", "", "", ""],
];

function distRows() {
  const out = [];
  const api = JSON.parse(readFileSync(new URL("test/fixtures/jstat-api.json", root), "utf8")).groups.distribution;
  for (const [js, r, args, sum, en, ja] of dists) {
    const methods = api.filter((n) => n.startsWith(`jStat.${js}.`)).map((n) => n.slice(`jStat.${js}.`.length));
    let first = true;
    for (const m of methods) {
      let cell;
      const a = args.replace(/^x/, "x");
      if (m === "pdf") cell = `\`d${r}(${a})\``;
      else if (m === "cdf") cell = `\`p${r}(${a.replace(/^x/, "q")})\``;
      else if (m === "inv") cell = `\`q${r}(${a.replace(/^(x|q)/, "p")})\``;
      else if (m.startsWith("sample")) cell = `\`r${r}(n, ${a.replace(/^x, /, "")})\``;
      else cell = `\`distSummary(${sum}).${m}\``;
      out.push([`jStat.${js}.${m}`, cell, first ? en : "", first ? ja : ""]);
      first = false;
    }
  }
  return out;
}
rows.distribution = distRows();

/** Names of the functions exported by rStats.js (value exports of src/entries/) */
function exported() {
  const dir = new URL("src/entries/", root);
  const src = readdirSync(dir)
    .map((f) => readFileSync(new URL(f, dir), "utf8"))
    .join("\n");
  return new Set(
    [...src.matchAll(/^export \{([^}]*)\}/gm)]
      .flatMap((m) => m[1].split(","))
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("type ")),
  );
}

/** rStats.js function names called in a cell (identifiers followed by "(" inside backticks, not after a dot) */
export function calledNames(cell) {
  if (cell.startsWith("JS:") || cell === "—") return [];
  const names = [];
  for (const code of cell.match(/`[^`]*`/g) ?? []) {
    for (const m of code.matchAll(/(?<![\w.$])([A-Za-z_$][\w$]*)\(/g)) names.push(m[1]);
  }
  return names;
}

const JS_GLOBALS = new Set(["Math", "Array", "Number", "Object"]);

const text = {
  en: {
    title: "# Migrating from jStat",
    lang: "English | [日本語](ja/migrating-from-jstat.md)",
    intro: `rStats.js covers every function of [jStat](https://github.com/jstat/jstat) 1.9.6. The names and defaults are
R's, not jStat's, so most calls change shape. This page lists every jStat function with its replacement, the
defaults that differ, and the bugs in jStat that the replacement does not reproduce. Rows marked *(planned)* are not
in rStats.js yet.

rStats.js works on plain arrays (a matrix is an array of rows) and returns plain objects; there is no \`jStat(...)\`
wrapper, method chaining or callback. Everything can be imported from the package root or from one area
(\`@numero-uno-jpn/rstats/descriptive\`, \`/distributions\`, \`/tests\`, \`/linalg\`, \`/numerics\`, \`/special\`).`,
    defaults: `## Defaults that differ

| | jStat | rStats.js (R) |
|---|---|---|
| \`variance\`, \`stdev\` | population (n) unless \`flag\` is true | sample (n − 1): \`variance\`, \`sd\` |
| \`quantiles\` | (α, β) = (3/8, 3/8), R's type 9 | \`quantile\` type 7 (pass \`{ type: 9 }\`) |
| \`percentile\` | type 7 (exclusive: type 6) | \`quantile\` type 7 |
| \`range\` | max − min | \`[min, max]\` |
| \`coeffvar\` | population standard deviation | sample standard deviation |
| \`meddev\` | median absolute deviation | \`mad\` multiplies by 1.4826 (pass \`{ constant: 1 }\`) |
| \`skewness\`, \`kurtosis\` | biased (e1071 type 1) | \`skewness\`, \`kurtosis\` default to e1071's type 3 |
| \`gamma\` | (shape, scale) | \`(shape, { rate })\` by default; pass \`{ scale }\` |
| \`weibull\` | (scale, shape) | \`(shape, { scale })\` |
| \`pareto\` | (scale, shape) | extraDistr's \`{ a: shape, b: scale }\` |
| \`hypgeom\` | (N, m, n): population, successes, draws | \`(m, n, k)\`: successes, failures, draws |
| \`negbin\` | (r, p) | \`(size, { prob })\` (same meaning) |
| \`cholesky\` | lower triangle | \`chol\` returns the upper triangle |
| \`multiply\` | matrix product for two matrices | \`matMul\`; \`multiply\` is element-wise |
| one-sided tests (\`sides = 1\`) | direction of the effect ignored | \`alternative: "less"\` or \`"greater"\` |
| random numbers | \`Math.random\` (or \`setRandom\`) | R's Mersenne-Twister: \`setSeed(n)\` reproduces R's \`set.seed(n)\` |`,
    bugs: `## Bugs in jStat

The replacements give the correct values in these cases (the examples in \`test/jstat-replacement.test.ts\` skip them):

- \`percentile\` is wrong for p close to 1 (\`[1, 2, 3, 4]\`, 0.9 gives 3 instead of 3.7) and NaN for small p when
  exclusive.
- \`pareto.mean\` returns shape · scale^shape / (shape − 1) (correct only for scale = 1); \`pareto.median\` returns
  scale · shape · √2 instead of scale · 2^(1/shape).
- \`uniform.median\` returns NaN; \`uniform.mode\`, \`arcsine.mode\` and \`kumaraswamy.variance\` throw.
- \`cubic_spline\` throws (it calls a missing \`jStat.sq\`); \`gauss_quadrature\` throws "not yet implemented"; the
  matrix form of \`randg\` throws a TypeError.
- \`betacf\` stops at a relative change of 3e-7, so \`ibeta\` and the beta, F and t distributions are good to about 7
  digits; \`erfc\` is computed as 1 − erf and loses the tails.
- \`quartiles\` picks order statistics without interpolation; its middle value is not the median for even n.
- \`subtract\` turns NaN results into 0; \`unique\` treats \`1\` and \`"1"\` as equal; \`histogram\` loses every value
  when they are all equal.
- \`jacobi\` stops at a tolerance of 0.001 and skips row and column 0 in its convergence test;
  \`gauss_elimination\` compares signed values when searching for a pivot; \`det\` fails on 1 × 1 matrices.
- The one-sided tests ignore the direction of the effect; \`ttest(value, mean, sd, n)\` is read as \`(t, n, sides)\`.`,
    groups: {
      core: "Core: arrays and matrices",
      vector: "Descriptive statistics",
      special: "Special functions and random numbers",
      distribution: "Distributions",
      linearalgebra: "Linear algebra and numerical methods",
      test: "Hypothesis tests",
      models: "Models",
      regression: "Regression",
    },
    distNote:
      "Every distribution has d/p/q/r functions with R's names (`dnorm`, `pnorm`, `qnorm`, `rnorm`, ...), with `log`, `lowerTail` and `logP` options. `distSummary(distribution, params)` returns the mean, variance, sd, median, mode, skewness and (excess) kurtosis of any of them.",
    head: "| jStat | rStats.js | Notes |",
    planned: "*(planned)*",
  },
  ja: {
    title: "# jStat からの移行",
    lang: "[English](../migrating-from-jstat.md) | 日本語",
    intro: `rStats.js は [jStat](https://github.com/jstat/jstat) 1.9.6 のすべての関数をカバーします。名前と既定値は jStat
ではなく R のものなので、多くの呼び出しは形が変わります。このページには、jStat の全関数とその置き換え、既定値の
違い、置き換えでは再現しない jStat のバグを載せます。*(予定)* の行は、まだ rStats.js にありません。

rStats.js は素の配列 (行列は行の配列) を扱い、素のオブジェクトを返します。\`jStat(...)\` のラッパー、メソッドの
チェーン、コールバックはありません。どの関数も、パッケージのルートからでも分野ごとのサブパス
(\`@numero-uno-jpn/rstats/descriptive\`、\`/distributions\`、\`/tests\`、\`/linalg\`、\`/numerics\`、\`/special\`) からでも
import できます。`,
    defaults: `## 既定値の違い

| | jStat | rStats.js (R) |
|---|---|---|
| \`variance\`、\`stdev\` | \`flag\` が真でなければ母分散 (n) | 標本 (n − 1): \`variance\`、\`sd\` |
| \`quantiles\` | (α, β) = (3/8, 3/8)、R の type 9 | \`quantile\` は type 7 (\`{ type: 9 }\` を渡す) |
| \`percentile\` | type 7 (exclusive は type 6) | \`quantile\` は type 7 |
| \`range\` | max − min | \`[min, max]\` |
| \`coeffvar\` | 母標準偏差 | 標本標準偏差 |
| \`meddev\` | 中央値からの絶対偏差の中央値 | \`mad\` は 1.4826 倍する (\`{ constant: 1 }\` を渡す) |
| \`skewness\`、\`kurtosis\` | 偏りのある形 (e1071 の type 1) | \`skewness\`・\`kurtosis\` の既定は e1071 の type 3 |
| \`gamma\` | (shape, scale) | 既定は \`(shape, { rate })\`。\`{ scale }\` を渡す |
| \`weibull\` | (scale, shape) | \`(shape, { scale })\` |
| \`pareto\` | (scale, shape) | extraDistr の \`{ a: 形, b: 尺度 }\` |
| \`hypgeom\` | (N, m, n): 母集団・成功の数・取り出す数 | \`(m, n, k)\`: 成功・失敗・取り出す数 |
| \`negbin\` | (r, p) | \`(size, { prob })\` (意味は同じ) |
| \`cholesky\` | 下三角 | \`chol\` は上三角を返す |
| \`multiply\` | 行列どうしなら行列の積 | \`matMul\`。\`multiply\` は要素ごと |
| 片側検定 (\`sides = 1\`) | 効果の向きを無視する | \`alternative: "less"\` か \`"greater"\` |
| 乱数 | \`Math.random\` (か \`setRandom\`) | R の Mersenne-Twister: \`setSeed(n)\` で R の \`set.seed(n)\` を再現 |`,
    bugs: `## jStat のバグ

置き換えの関数はこれらの場合も正しい値を返します (\`test/jstat-replacement.test.ts\` の例はこれらを除いています)。

- \`percentile\` は p が 1 に近いと誤り (\`[1, 2, 3, 4]\` の 0.9 が 3.7 でなく 3)、exclusive で p が小さいと NaN。
- \`pareto.mean\` は shape · scale^shape / (shape − 1) を返す (scale = 1 のときだけ正しい)。\`pareto.median\` は
  scale · 2^(1/shape) でなく scale · shape · √2 を返す。
- \`uniform.median\` は NaN を返す。\`uniform.mode\`・\`arcsine.mode\`・\`kumaraswamy.variance\` は例外になる。
- \`cubic_spline\` は例外になる (存在しない \`jStat.sq\` を呼ぶ)。\`gauss_quadrature\` は "not yet implemented" で例外。
  行列の形の \`randg\` は TypeError。
- \`betacf\` は相対変化 3e-7 で止まるので、\`ibeta\` とベータ・F・t 分布の精度は 7 桁ほど。\`erfc\` は 1 − erf で計算
  するので裾が失われる。
- \`quartiles\` は補間せずに順序統計量を選ぶ。n が偶数だと中央の値が中央値にならない。
- \`subtract\` は NaN の結果を 0 にする。\`unique\` は \`1\` と \`"1"\` を同じとみなす。\`histogram\` は値がすべて等しいと
  すべて数え落とす。
- \`jacobi\` は許容値 0.001 で止まり、収束の判定で行と列 0 を飛ばす。\`gauss_elimination\` はピボット探しで符号付きの
  値を比べる。\`det\` は 1 × 1 の行列で失敗する。
- 片側検定は効果の向きを無視する。\`ttest(value, mean, sd, n)\` は \`(t, n, sides)\` と解釈される。`,
    groups: {
      core: "コア: 配列と行列",
      vector: "記述統計",
      special: "特殊関数と乱数",
      distribution: "分布",
      linearalgebra: "線形代数と数値計算",
      test: "仮説検定",
      models: "モデル",
      regression: "回帰",
    },
    distNote:
      "どの分布にも R の名前の d/p/q/r 関数 (`dnorm`、`pnorm`、`qnorm`、`rnorm` など) があり、`log`・`lowerTail`・`logP` を指定できます。`distSummary(distribution, params)` はどの分布でも平均・分散・標準偏差・中央値・最頻値・歪度・(超過) 尖度を返します。",
    head: "| jStat | rStats.js | 備考 |",
    planned: "*(予定)*",
  },
};

export function render(lang) {
  const t = text[lang];
  const have = exported();
  const out = [t.title, "", t.lang, "", t.intro, "", t.defaults, ""];
  let planned = 0;
  for (const [group, list] of Object.entries(rows)) {
    out.push(`## ${t.groups[group]}`, "");
    if (group === "distribution") out.push(t.distNote, "");
    out.push(t.head, "|---|---|---|");
    for (const [js, cell, en, ja] of list) {
      const missing = calledNames(cell).filter((n) => !have.has(n) && !JS_GLOBALS.has(n));
      const mark = missing.length > 0 ? ` ${t.planned}` : "";
      if (mark) planned++;
      out.push(`| \`${js}\` | ${cell}${mark} | ${lang === "en" ? en : ja} |`);
    }
    out.push("");
  }
  out.push(t.bugs, "");
  return { md: out.join("\n"), planned };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [lang, file] of [
    ["en", "docs/migrating-from-jstat.md"],
    ["ja", "docs/ja/migrating-from-jstat.md"],
  ]) {
    const { md, planned } = render(lang);
    writeFileSync(new URL(file, root), md);
    console.log(`${file}: ${planned} planned`);
  }
}
