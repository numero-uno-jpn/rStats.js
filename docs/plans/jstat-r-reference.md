# 照合に使う R の結果 (fixture) と R の挙動の要点

2026-10-24 作成 (Mac mini のセッション)。リリースに含めない一時文書。計画は [jstat-coverage.md](jstat-coverage.md)。

## 共通

- **R とパッケージ**: R 4.5.2、イメージは `rstats-oracle` (`oracle/Dockerfile`、CRAN は p3m の 2026-10-23 のスナップショット)。版は extraDistr 1.10-0.5、e1071 1.7-17、DescTools 0.99.60、pracma 2.4.6、deSolve 1.42、numDeriv 2016.8-1.1、BSDA 1.2.2、Matrix 1.7-4、MASS 7.3-65、Rmpfr 1.1-3、gmp 0.7-5.1、jsonlite 2.0.0。
  - 乱数の fixture は x86_64 版の `rstats-oracle-amd64` で作る (`scripts/oracle.sh` の既定。従来の rocker/r-ver で作った乱数の fixture と 1 ビットも違わないことを確かめた)。
  - 新しいイメージで既存の oracle (special・ttest・linalg・qr・choose) を作り直し、既存の fixture と生成日時以外に差分が無いことを確かめた。
- **形式**: 分布の d/p/q と特殊関数は `write_fixture` の形 (`fixtureSuite` で照合)。それ以外は `write_htest_fixture` の形 (`htestSuite` で照合)。
  - `args` のキーは JS の引数名 (`naRm`、`tiesMethod`、`confLevel` など)。省略した引数はキーごと無い。
  - `expected` は数値のフィールドだけ (文字列のフィールドは `htestSuite` の `STRING_FIELDS` だけが文字列として比べられるため)。名前などの文字列はこの文書に書いた。
  - R がエラーを出したケースは `expected: { error }` (文言は R のまま)。
- **R のソース**: 挙動を確かめるため R の関数の本体を読んだ (写してはいない)。下の要点はそこから取った。C の部分 (R_pretty、BinCount、SplineCoef、zeroin2、fmin、dqags) は R のソースの `src/appl`・`src/library/stats/src` にある。挙動を確かめるために読むのはよい。

## Phase 1: 記述統計 (`oracle/descriptive.R`)

| fixture | R | args | expected |
|---|---|---|---|
| sum, prod, var, sd, median | 同名 | x, naRm | value |
| mean | `mean(x, trim, na.rm)` | x, trim, naRm | value |
| range | `range(x, na.rm)` | x, naRm | value (2 つ) |
| weightedMean | `weighted.mean(x, w, na.rm)` | x, w, naRm | value |
| quantile | `quantile(x, probs, type, na.rm, names = FALSE)` | x, probs, type, naRm | value |
| IQR | `IQR(x, na.rm, type)` | x, type, naRm | value |
| fivenum | `fivenum(x)` | x | value (5 つ) |
| mad | `mad(x, center, constant, na.rm, low, high)` | x, center, constant, naRm, low, high | value |
| cumsum, cumprod, cummax, cummin | 同名 | x | value |
| diff | `diff(x, lag, differences)` | x, lag, differences | value |
| rank | `rank(x, ties.method, na.last)` | x, tiesMethod, naLast ("keep" / "last" = TRUE / "first" = FALSE) | value |
| cov, corMatrix | `cov`/`cor(x, y, method, use)` | x (ベクトルか行列), y, method, use | value (行列なら行の配列、スカラーなら数) |
| scale | `scale(x, center, scale)` | x, center, scale (論理値か数のベクトル) | value (行列), center, scale (属性があるときだけ) |
| tabulate | `tabulate(bin, nbins)` | bin, nbins | value |
| table | `table(x, useNA)` | x, useNA | values (異なる値、表の順。NA は最後), counts |
| unique | `unique(x)` | x | value |
| cut | `cut(x, breaks, labels = FALSE, right, include.lowest)` | x, breaks (数か区切りのベクトル), right, includeLowest | value (区間の番号。外は NA) |
| findInterval | `findInterval(x, vec, rightmost.closed, all.inside, left.open)` | x, vec, rightmostClosed, allInside, leftOpen | value |
| hist | `hist(x, breaks, right, plot = FALSE)` | x, breaks ("Scott"・"FD"・数・ベクトル。無ければ "Sturges"), right | breaks, counts, density, mids |
| ecdf | `ecdf(x)(q)` | x, q | value |
| skewness, kurtosis | `e1071::skewness`/`kurtosis(x, na.rm = TRUE, type)` | x, type | value |
| geometricMean | `DescTools::Gmean(x, na.rm)` | x, naRm | value |
| modes | `DescTools::Mode(x, na.rm = TRUE)` | x | value (最多の値すべて、昇順), frequency |
| meanAD | `DescTools::MeanAD(x)` / `MeanAD(x, center = median)` | x, center ("median" のときだけ) | value |
| cv | `DescTools::CoefVar(x, unbiased)` | x, unbiased | value |

`cor` という名前の fixture は既存の `oracle/cor.R` (2 つのベクトルの相関) が使っているので、行列版は `corMatrix` にした。

要点
- **quantile**
  - fuzz は type 7 で 0、それ以外 `4 * .Machine$double.eps`。`floor(v * (1 + fuzz))` で添字を取る
  - probs は ±100 eps まで許して [0, 1] に丸める。それより外は `'probs' outside [0,1]`。NA の probs は結果も NA
  - type 7: index = 1 + (n − 1)p、lo = floor、hi = ceiling。`index > lo` かつ `x[hi] != x[lo]` のときだけ補間する (隣が等しければ x[lo] そのまま。Inf が NaN にならない)
  - type 1〜3 は nppm = np (type 3 は np − 0.5)。h は type 1 で (nppm > j)、type 2 で ((nppm > j) + 1)/2、type 3 で (nppm != j) | (j が奇数)
  - type 4〜9 は (a, b) = 4:(0,1)、5:(.5,.5)、6:(0,0)、8:(1/3,1/3)、9:(3/8,3/8)。nppm = a + p(n + 1 − a − b)、h = nppm − j (|h| < fuzz なら 0)。x_0 = x_1、x_{n+1} = x_n と延ばして補間する
  - n = 0 は NA。NA を含み na.rm が偽なら `missing values and NaN's not allowed if 'na.rm' is FALSE`
  - 名前 (返り値に付けるなら) は `formatC(100 * probs, format = "fg", width = 1, digits = 7)` + "%" ("25%"、"33.33333%")
  - jStat の `quantiles` (既定) は type 9、`percentile` は type 7、`percentile(…, true)` は type 6
- **fivenum**: 並べて n4 = floor((n + 3)/2)/2、d = (1, n4, (n + 1)/2, n + 1 − n4, n)、0.5 (x[floor(d)] + x[ceiling(d)])。NA は既定で除く。空なら NA が 5 つ
- **mad**: constant 1.4826、center = median (除いたあとの x)。low/high は n が偶数のときだけ効き、|x − center| の (n %/% 2 + high) 番目。両方真なら `'low' and 'high' cannot be both TRUE`
- **mean(trim)**
  - trim ≥ 0.5 は median、負は 0
  - lo = floor(n trim) + 1、hi = n + 1 − lo、並べた x[lo..hi] の平均
  - R の mean は長い倍精度で足してから、mean += sum(x − mean)/n で補正する (`src/internal/summary.ts` の `meanDD` と同じ考え)
- **weighted.mean**
  - `sum((x*w)[w != 0]) / sum(w)`。重み 0 の x は (Inf や NA でも) 分子に入らない
  - na.rm は NA の x と対応する w を除く (w の NA は除かない)
  - 長さが違えば `'x' and 'w' must have the same length`
- **rank**
  - NA を除いて順位を付けてから戻す。na.last = TRUE なら NA に n_nonNA + 1.. の順位、FALSE なら先頭の順位 (他を後ろへずらす)、"keep" なら NA のまま
  - "random" は乱数を使うので fixture に入れていない
- **cov・cor**
  - `use` は "everything"・"all.obs"・"complete.obs"・"na.or.complete"・"pairwise.complete.obs"
  - all.obs で NA があれば `missing observations in cov/cor`
  - spearman は順位 (`na.last = "keep"`) の Pearson。pairwise では組ごとに NA を除いてから順位を付ける
  - kendall の cov は Σ sign(xi − xj) sign(yi − yj) の全組の和そのまま (割らない)、cor は tau-b
  - cov で pairwise かつ Pearson 以外は `cannot handle 'pairwise.complete.obs'`
  - 標準偏差 0 の列の cor は NA (警告)
- **scale**: center = TRUE は列の平均 (NA を除く)。scale = TRUE は中心化したあとの列の二乗平均の平方根 `sqrt(sum(v^2) / max(1, n − 1))` (中心化しないと標準偏差ではない)
- **tabulate**: nbins = max(1, bin)。bin は整数に切り捨て、1..nbins の外と NA は数えない
- **cut** (breaks が数のとき)
  - nb = breaks + 1、rx = range(x)、dx = diff(rx)
  - dx > 0 なら `seq(rx1, rx2, length.out = nb)` の両端だけを rx1 − dx/1000・rx2 + dx/1000 に置き換える
  - dx == 0 なら dx = |rx1| (0 なら 1) として `seq(rx1 − dx/1000, rx2 + dx/1000, length.out = nb)`
  - breaks < 2 か NA で `invalid number of intervals`、重複で `'breaks' are not unique`
  - right なら (b_i, b_{i+1}]、include.lowest で最初の区間を閉じる。left なら [b_i, b_{i+1})、include.lowest で最後を閉じる
  - ラベルは "(a,b]" で、`formatC(breaks, digits = dig, width = 1)` (dig は 3 から隣が区別できるまで増やす)
- **hist**
  - 有限の x だけを使う
  - breaks が文字列なら nclass を求める (Sturges = ceiling(log2(n) + 1)、Scott = h = 3.5 sd n^(−1/3)、FD = 2 IQR(signif(x, 5)))。数でも文字列でも、そのあと `pretty(range(x), n = breaks, min.n = 1)` で区切りを作るので、区切りの数はちょうどにはならない
  - **R の `pretty` (C の R_pretty) の移植が要る**。引数の既定: n = 5、min.n = n %/% 3、shrink.sml = 0.75、high.u.bias = 1.5、u5.bias = 0.5 + 1.5 × high.u.bias、eps.correct = 0、f.min = 2^−20
  - 数えるときの fuzz: diddle = 1e-7 × (nB > 5 なら median(h)、nB ≤ 3 なら diff(range(x))、それ以外 min(h[h > 0]))。区切りをずらして数える (right なら最初だけ include.lowest に応じて −diddle、ほかは +diddle)。返す breaks はずらす前のもの
  - density = counts / (n h)、mids = 区切りの中点
  - 数え落としがあれば `some 'x' not counted; maybe 'breaks' do not span range of 'x'`
- **ecdf**: F(t) = #{x ≤ t}/n (右連続)
- **e1071**: x を中心化して g1 = √n Σx³ / (Σx²)^1.5。skewness の type 2 は g1 √(n(n − 1))/(n − 2)、type 3 は g1 (1 − 1/n)^1.5。r = n Σx⁴/(Σx²)² として kurtosis の type 1 は r − 3、type 2 は ((n + 1)(r − 3) + 6)(n − 1)/((n − 2)(n − 3))、type 3 は r (1 − 1/n)² − 3。type 2 は n < 3 (skewness)・n < 4 (kurtosis) で `Need at least 3 complete observations.` / `Need at least 4 complete observations.`。jStat の skewness・kurtosis は type 1
- **DescTools**
  - Mode: 最多の値すべて (昇順) と頻度。全部の値が 1 回ずつなら NA (頻度も NA)。長さ 1 も NA
  - Gmean: 負の値があれば NA (警告)、0 があれば 0、それ以外 exp(mean(log x))
  - MeanAD: mean(|x − center|)、center の既定は平均
  - CoefVar: sd/mean (sd は n − 1)。unbiased なら res × (1 − 1/(4(n − 1)) + res²/n + 1/(2(n − 1)²))。jStat の coeffvar は母標準偏差で、どの形とも違う (手引きに書く)

## Phase 2: 行列演算 (`oracle/matrix.R`)

| fixture | R | args | expected |
|---|---|---|---|
| matMul | `x %*% y` | x, y (ベクトルなら R と同じく行か列) | value |
| arith | `x op y` | op ("+"・"-"・"*"・"/"), x, y | value |
| outer | `outer(x, y, fun)` | x, y, fun ("*"・"+"・"-"・"/"・"^") | value |
| transpose | `t(x)` | x | value |
| diag | `diag(x, nrow, ncol)` | x, nrow, ncol | value |
| cbind, rbind | 同名 | x, y | value |
| matrix | `matrix(data, nrow, ncol, byrow)` | data, nrow, ncol, byrow | value |
| kronecker | `kronecker(x, y)` | x, y | value |
| seq | `seq(from, to, by, length.out)` | from, to, by, lengthOut | value |
| lu | `Matrix::expand(Matrix::lu(x))` | x | P, L, U (x = P L U) |
| prcomp | `prcomp(x, center, scale.)` | x, center, scale | sdev, rotation, x (得点), center, scale |

要点
- **arith**
  - 行列とベクトルの演算は列優先でベクトルを繰り返す。長さが割り切れなければ R は警告を出して続ける (fixture は値)
  - 形の違う行列どうしは `non-conformable arrays`
  - 0 で割れば Inf・NaN
- **diag**: 行列なら対角の要素。長さ 2 以上のベクトルなら対角行列。数が 1 つなら (`I()` で包んでいても) その大きさの単位行列 (`diag(3)`、`diag(c(2))` は 2×2)。`diag(x, nrow, ncol)` は x を繰り返す
- **seq**
  - by があれば n = (to − from)/by を `as.integer(n + 1e-10)` で切り、from + (0:n) by を to で頭打ちにする
  - length.out があれば両端をちょうどにする (`c(from, from + (1:(L − 2)) (to − from)/(L − 1), to)`)
  - 符号が逆なら `wrong sign in 'by' argument`、length.out が負なら `'length.out' must be a non-negative number`
- **lu**: LAPACK の dgetrf (部分ピボット) と同じ。長方形の行列も通る。特異な行列は U の対角に 0
- **prcomp**
  - sdev = svd の d / √max(1, n − 1)
  - rotation の各列の符号と得点 x の列の符号は、既存の svd の fixture と同じ規則 (`align_columns`、`test/helpers/linalg.ts` の `alignColumns`) でそろえてある。値が重なる列は NaN
  - 定数の列を scale すると `cannot rescale a constant/zero column to unit variance`

## Phase 3: 検定 (`oracle/anova.R`)

| fixture | R | args | expected |
|---|---|---|---|
| aovOneway | `summary(aov(y ~ g))[[1]]` | groups (標本の配列) | df, sumSq, meanSq (群間・残差の 2 つずつ), fValue, pValue |
| TukeyHSD | `TukeyHSD(aov(y ~ g), conf.level)$g` | groups, confLevel | i, j (群の番号、i > j), diff, lwr, upr, pAdj |
| zTest | `BSDA::z.test(x, y, sigma.x, sigma.y, mu, alternative, conf.level)` | x, y, sigmaX, sigmaY, mu, alternative, confLevel | htest のフィールド |

要点
- **aov**
  - 群内のばらつきが 0 のデータ (`list(c(1, 1, 1), c(2, 2, 2))`) で、R は残差平方和を 1e-30 (QR の丸め) とし F = 5.9e30 を返す。正しく 0 とすれば F = Inf で、ここは R と違ってよい (knownDifference と differences-from-r.md に書く)
  - 群が 1 つなら `contrasts can be applied only to factors with 2 or more levels`
- **TukeyHSD**
  - 組の順は (2-1, 3-1, …, k-1, 3-2, …)
  - MSE = 残差平方和 / 残差自由度、se = √(MSE/2 × (1/n_i + 1/n_j)) (Tukey–Kramer)
  - lwr・upr = diff ∓ qtukey(conf.level, k, df) se、p adj = ptukey(|diff|/se, k, df, lower.tail = FALSE)
- **z.test**
  - method は "One-sample z-Test" / "Two-sample z-Test"、statistic の名前は "z"、estimate の名前は "mean of x"(・"mean of y")、null.value の名前は "mean" / "difference in means"
  - p 値は less で pnorm(z)、greater で **1 − pnorm(z)** (`lower.tail = FALSE` ではないので、z が大きいと 0 に丸まる。R が不正確な点)、two.sided で 2 pnorm(−|z|)
  - 信頼区間は z se ± qnorm(…) se に mu を足して作る (mx ± … ではないので、浮動小数点の結果が少し違う)
  - エラー: sigma.x が無いと `You must enter the value for sigma.x`、観測が 2 つ以下で `not enough x observations`
  - sigma.x が負でもエラーにならず、そのまま計算する

### 作成済みの検定 (クラウド側の実装) の R との照合の結果

`binomtest`・`vartest`・`ranktests`・`proptest`・`mantelhaen`・`ansari`・`kstest`・`pairwise` の oracle を実行して fixture を作った (コミット 5076ce9)。`htest_fields` が alternative の無い検定 (kruskal.test など) で `{}` を書いていたので、alternative を省くように直した (`oracle/_htest.R`)。

2026-10-24 の時点で `test/htest-basic.test.ts` の R との照合で残っている不一致 (1 つのテストにつき表示は 20 件まで):

| 検定 | 不一致 | 内容 |
|---|---|---|
| binomTest | 2 | conf.level = 0・1 で R はエラー (`'conf.level' must be a single number between 0 and 1`)、TS は例外を投げない |
| poissonTest | 26 | 2 標本の `parameter` (例 R 3.4626、TS 14.069。値が大きく違う) |
| varTest | 44 | R の p 値が 0 (1 − P の形の打ち消し)、TS は 4e-58 など。統計量・区間も 1e-13 程度ずれる |
| mcnemarTest | 3 | method・統計量・p 値 (補正の扱い) |
| flignerTest | 1 | 統計量 |
| friedmanTest | 1 | エラーにする入力 |
| quadeTest | 7 | parameter 5、統計量 1、エラー 1 |
| moodTest | 96 | 統計量と p 値 (相対 1e-3〜6e-2。同順位のあるデータで多い) |
| shapiroTest | 3 | p 値 2、エラー 1 |
| propTest | 1 | estimateNames |
| mantelhaenTest | 2 | エラーにする入力 |
| ansariTest | 354 | nullValue・nullValueName (R は 1 と "ratio of scales" を返す、TS は返していない) |
| ksTest | 245 | alternative の文字列 (R は "two-sided"、"the CDF of x lies above the null hypothesis" など。TS は "two.sided"・"greater") |

bartlettTest・kruskalTest・onewayTest・pairwise は一致した。R が不正確な点 (varTest の p 値など) は、参照値か knownDifference で判定する。

## Phase 4: 回帰 (`oracle/lm.R`)

fixture `lm`。R は `lm(y ~ x)` (intercept が偽なら `lm(y ~ x − 1)`、weights があれば重み付き)、`summary`、`confint`、`predict(interval = "confidence" / "prediction")`。

- args: x (行列), y, intercept, weights, newdata (行列), level (既定 0.95)
- expected:
  - coefficients (切片が先。別名の列は NA)、residuals、fittedValues、rank、dfResidual
  - 係数の表は別名の列を除いて estimate・stdError・tValue・pValue
  - sigma、rSquared、adjRSquared、fStatistic (値・分子の自由度・分母の自由度)、fPValue
  - confLower・confUpper (別名の列は NA)
  - newdata があれば predict、confidenceLower/Upper、predictionLower/Upper

要点
- R の lm.fit は LINPACK の dqrdc2 (許容値 1e-7。ノルムの小さい列を最後へ回す、LAPACK の dgeqp3 と違う規則) を使う。別名になるのは後ろの列 (fixture では 4 列目 = 1 列目 + 2 × 2 列目)
- y に NA があればその行を除く (na.omit)。residuals・fittedValues は残った行だけ
- 長さが違えば `variable lengths differ (found for 'x')`
- 残差自由度 0 のケースでは F が NaN になる
- 当てはまりが完全なケースは F = 7.5e31 (R が残差の丸めを残す)

## Phase 5: 数値計算 (`oracle/numerics.R`)

関数は JSON に書けないので、各ケースの `args.fn` に名前、`args.js` に同じ関数の JS の式を入れた (x の式、ode は t・y・p、numDeriv は配列 x)。テストでは `new Function("x", "return " + js)` などで作れる。

| fixture | R | args | expected |
|---|---|---|---|
| integrate | `integrate(f, lower, upper, subdivisions, rel.tol, stop.on.error)` | fn, js, lower, upper, subdivisions, relTol, stopOnError | value, absError, subdivisions, ier |
| optimize | `optimize(f, lower, upper, maximum, tol)` | fn, js, lower, upper, maximum, tol | optimum, objective |
| uniroot | `uniroot(f, lower, upper, tol, maxiter, extendInt)` | fn, js, lower, upper, tol, maxiter, extendInt | root, fRoot, iter, initIt, estimPrec |
| approx | `approx(x, y, xout, method, n, yleft, yright, rule, f, ties)` | x, y, xout, method, n, yleft, yright, rule, f, ties ("mean"・"min"・"max") | x, y |
| spline | `spline(x, y, n, method, xout, xmin, xmax)` | x, y, n, method, xout, xmin, xmax | x, y |
| splinefun | `splinefun(x, y, method)(xq, deriv)` | x, y, method, xq, deriv | value |
| splinefunH | `splinefunH(x, y, m)(xq, deriv)` | x, y, m, xq, deriv | value |
| barylag | `pracma::barylag(xi, yi, x)` | xi, yi, x | value |
| hermite | 導関数つきの大域 Hermite 補間 (Rmpfr で計算した参照値) | xi, yi, di, x | value |
| ode | `deSolve::ode(y, times, func, parms, method)` | fn, js, y, times, parms, method ("euler"・"rk2"・"rk4") | value (行 = 時刻、列 = 時刻・状態) |
| grad | `numDeriv::grad(f, x, method)` | fn, js, x, method ("Richardson"・"simple"・"complex") | value |
| hessian | `numDeriv::hessian(f, x)` | fn, js, x | value |
| jacobian | `numDeriv::jacobian(f, x, method)` | fn, js, x, method | value |

要点
- **integrate**
  - 既定: subdivisions = 100、rel.tol = eps^0.25、abs.tol = rel.tol
  - 有限区間は dqags (21 点、f を 21 点のベクトルで呼ぶ)、無限は dqagi (15 点)。(lower, Inf) は inf = 1・bound = lower、(−Inf, upper) は inf = −1、両方無限は inf = 2・bound = 0
  - 作成済みの `src/integrate/quadpack.ts` の dqagse・dqagie と同じ
  - `ier` は R の message を番号にしたもの: 0 "OK"、1 "maximum number of subdivisions reached"、2 "roundoff error was detected"、3 "extremely bad integrand behaviour"、4 "roundoff error is detected in the extrapolation table"、5 "the integral is probably divergent"、6 "the input is invalid"
  - ier > 0 は stop.on.error が真ならエラー (fixture は `{error}`)、偽なら値と ier を返す
  - 関数の値が有限でないと `non-finite function value`
  - lower > upper は符号を反転した値、lower == upper は 0
- **optimize**: lower・upper の小さい方・大きい方、tol = eps^0.25。Brent の fmin (作成済みの `localMin`)。maximum は −f を最小化する。objective は最適点で f をもう一度評価した値
- **uniroot**
  - tol = eps^0.25、maxiter = 1000
  - extendInt: "yes" は両端を Δ(u) = 0.01 max(1e-4, |u|) ずつ外へ広げ、Δ を毎回 2 倍にする。"downX"・"upX" は片側ずつ
  - 1000 回で見つからなければ `no sign change found in 1000 iterations`、広げなければ `f() values at end points not of opposite sign`
  - iter は広げた回数を足した数、initIt は広げた回数 (広げなければ NA)、estimPrec は Brent の精度の見積もり
  - 収束しなければ警告で、iter = maxiter
- **approx**
  - 既定 method = "linear"、n = 50、rule = 1 (長さ 1 なら両側に)、f = 0、ties = mean
  - NA の組を除き、x で並べ、同じ x の y を ties で 1 つにまとめる
  - rule 1 は外側を NA (yleft・yright の既定)、rule 2 は端の値
  - xout が無ければ seq(x[1], x[nx], length.out = n)
  - constant は (1 − f) y_left + f y_right (f が 0 か 1 なら片側だけを使う)
  - 点が 1 つなら `need at least two non-NA values to interpolate`
- **spline・splinefun**
  - fmm (既定)・natural・periodic・hyman (spline)・monoH.FC (splinefun)
  - spline の n の既定は 3 × length(x)、xout があれば n は使わない
  - periodic で y[1] != y[n] なら警告して y[n] = y[1] にする
  - hyman は単調な y が要り (`'y' must be increasing or decreasing`)、fmm の係数の傾きを単調になるよう切り詰める
  - 評価は y + dx (b + dx (c + dx d))
  - natural は左右の外側で直線
  - deriv 1 は (b, 2c, 3d)、2 は (2c, 6d)、3 は 6d
- **barylag**: 節点の外は `Some interpolation points outside the nodes.` でエラー (最後のケース)
- **hermite**: 節点 x_i で値 y_i と導関数 d_i を満たす次数 2n − 1 の多項式。jStat の `hermite(X, F, dF, value)` と同じもの。R にもパッケージにも無いので、重複した節点の Newton 形を 256 ビットで計算した。区分的な 3 次の Hermite (R の splinefunH) は別の fixture
- **ode**: 刻みは times の間隔 (固定刻み)。rk2 は `deSolve::rkMethod("rk2")` (Heun 法)
- **numDeriv**: Richardson の既定 (eps = 1e-4、d = 1e-4、zero.tol = √(eps/7e-7)、r = 4、v = 2)。simple は前進差分 h = 1e-4、complex は複素数ステップ (JS で再現するなら複素数の演算が要る。難しければ knownDifference にしてよい)

## Phase 6: R にない分布 (`oracle/extradist.R`, `oracle/rextradist.R`, `oracle/distsummary.R`)

d/p/q の fixture (`write_fixture` の形): `dinvgamma`・`pinvgamma`・`qinvgamma`、kumar・pareto・triang・laplace・arcsine も同様 (18 本)。

- 母数は extraDistr の名前と取り方
  - invgamma(alpha, beta): beta は尺度。f(x) = β^α x^(−α−1) e^(−β/x)/Γ(α)
  - kumar(a, b)
  - pareto(a, b): a が形、b が尺度。x ≥ b で F = 1 − (b/x)^a
  - triang(a, b, c): 最小・最大・最頻値
  - laplace(mu, sigma)
  - arcsine(a, b): extraDistr に無い。ベータ(1/2, 1/2) を (a, b) に移したものとして R の dbeta・pbeta・qbeta で計算
- args は d が x・log、p が q・lowerTail・logP、q が p・lowerTail・logP と母数
- extraDistr の素朴な式は裾で不正確なことがある。どれも閉じた形があるので、参照値は mpmath で作ってよい (invgamma は不完全ガンマ)
- 不正な母数 (0、負、NaN、b ≤ a など) では extraDistr は NaN (警告) を返す

乱数 (`rextradist`、x86_64、`oracle/_random.R` の形: seed・args・expected・next)。extraDistr の作り方 (R の出力とソースで確認):
- rinvgamma = 1 / rgamma(alpha, rate = beta)
- rkumar = qkumar(1 − u)、rpareto = qpareto(1 − u) (u は runif)
- rtriang は一様乱数 2 つ u, v から a + (b − a)((1 − cc) min(u, v) + cc max(u, v))、cc = (c − a)/(b − a)
- rlaplace は mu + sigma s e。e = exp_rand() (rexp と同じ R の指数乱数) を先に引き、続く一様乱数が 0.5 より大きければ s = +1、それ以外 −1
- 不正な母数では乱数を消費せずに NA (next が seed 直後の runif と同じ)
- arcsine の r は R の参照が無い (逆関数法で作り、分布の検定で確かめる)

分布の要約 (`distSummary`): args は distribution と母数 (d/p/q の引数名。gamma は shape・rate、nbinom は size・prob か size・mu)、expected は mean・variance・sd・median・mode・skewness・kurtosis。
- 閉じた形を R で書き、すべての有限の値を数値的なモーメント (integrate か和) と、mode を密度と照らし合わせてから書いた。食い違えば oracle が止まる
- 決まり:
  - 定義されないものは NaN (Cauchy の平均、平均が無限のときの分散)
  - 無限のモーメントは Inf (1 < df ≤ 2 の t の分散、a ≤ 1 の pareto の平均)
  - median は q(0.5) (離散なら F(x) ≥ 0.5 の最小の x)
  - mode は密度の最大。一意でなければ NaN (一様、beta(1, 1)、両方の形 < 1 の beta、arcsine)。離散で隣り合う 2 つが最大なら大きい方 (Boost.Math と同じ)。境界で密度が発散するなら (形 < 1 の gamma) その境界
  - kurtosis は超過尖度 (正規分布で 0)
- 対象: norm, lnorm, unif, exp, gamma, chisq, beta, t, f, cauchy, weibull, logis, binom, pois, geom, nbinom, hyper, invgamma, kumar, pareto, triang, laplace, arcsine
- jStat の誤り (pareto.mean・median、uniform.median) は手引きに書く

## Phase 7: 特殊関数 (`oracle/specialextra.R`)

| fixture | 内容 | expected |
|---|---|---|
| gammainc | 正規化しない不完全ガンマ。args は x, a | [下側 γ(a, x), 上側 Γ(a, x), log 下側, log 上側] |
| erfinv | erf の逆関数。args は y | 値 |
| erfcinv | erfc の逆関数。args は y | 値 |
| perm | n!/(n − k)!。args は n, k | 値 |

- pracma の `gammainc(x, a)` は lowinc・uppinc・reginc を返すが、大きな引数で NA になるので、値は R の pgamma × gamma で作った。対数の版は値がオーバーフローしても有限
- erfinv は sign(y) × (−qnorm((1 − |y|)/2)/√2)、erfcinv は −qnorm(y/2)/√2 (pracma::erfinv・erfcinv と同じ定義)。|y| > 1 (erfinv)、y の範囲 [0, 2] の外 (erfcinv) は NaN
- perm は Γ(n + 1)/Γ(n − k + 1) を 256 ビットの Rmpfr で計算した。整数の n で k > n なら 0、負の n・k は NaN、非整数の n も Γ の比で定義する (jStat の permutation と同じ)

## oracle の一覧と実行

```sh
npm run oracle -- descriptive matrix anova lm numerics extradist distsummary specialextra   # rstats-oracle
npm run oracle -- rextradist                                                             # rstats-oracle-amd64
```

イメージが無ければ:

```sh
docker build -t rstats-oracle oracle
docker build --platform linux/amd64 -t rstats-oracle-amd64 oracle
```
