# R との違い

[English](../differences-from-r.md) | 日本語

> この文書は [英語版](../differences-from-r.md) の訳です。内容が食い違うときは英語版が正です。

rStats.js は R と同じ結果を返すことを目指しています。このページには、そうならない場合をまとめます。
R 自身が不正確か失敗する場合と、rStats.js が意図的に違う動作をする場合です。テストではこれらのケースに
理由付きで `knownDifference` の印を付けています (`test/helpers/suite.ts` と個々のテストファイルを参照)。
ケースの比べ方は [accuracy.md](accuracy.md) で説明しています。

## R が不正確で、rStats.js のほうが真値に近い場合

テストケースが R と一致しないときは、Rmpfr (256〜1300 ビット) または gmp (厳密な有理数) で計算した
高精度の参照値と比べます。rStats.js が参照値と一致すれば、そのケースは「R より正確」として合格します。

### 分布

- **裾の奥** (確率が 1e-200〜1e-300 程度): R はしばしば相対誤差で 1e-13 程度ずれます。rStats.js は
  指数部を double-double 演算で計算し、1e-15 程度に収まります。
- **大きなパラメータ** (shape が 1e5 程度): R の `pbeta`、`dbeta`、`pgamma` は 1e-13〜1e-11 ずれる
  ことがあります。`plnorm`/`dlnorm` は、たとえば meanlog = 700、sdlog = 20 で 1e-13 程度ずれます。
- **非心分布:** R は下側の裾だけを計算し、上側は 1 − (下側の裾) として返すため、上側の裾は絶対誤差
  1e-10 程度より下が失われます。R の非心 t 分布は |ncp| > 37.62 で近似に切り替わり、`pf` は
  df2 > 1e8 でカイ二乗近似に切り替わり (相対誤差 1e-9 程度)、非心の `qt` と `qchisq` は低い精度で
  逆算し、裾では打ち切られます。`ncp = 0` のとき、R の F 分布は非心のアルゴリズムを使って精度を
  落とします (たとえば `pf(1e5, 4, 5, ncp = 0, lower.tail = FALSE)` は 4e-5 ずれます)。rStats.js は
  `ncp: 0` に対して中心分布と同じ精度の値を返します (端のケースは R の非心分布の動作に従います)。
- **符号付き順位と順位和:** R の `dsignrank`/`psignrank` は n = 500 と 1000 で 1e-14 程度ずれます。
  n = 1100 では中央の `dsignrank` が Inf になり、`psignrank(1000, 1100)` は 0 になります (真値は
  2.27e-308)。`dwilcox(·, 200, 200)` は全域で 1.4e-14 ずれます。
- **スチューデント化された範囲:** R の `ptukey` の精度は 8 桁程度、`qtukey` は 4 桁程度です。
  1e-15 より小さい上側の裾は 0 になります。大きな df (1e5 など) では R は df = ∞ の値を返します。
  rStats.js は与えられた df での値を計算します。

| 呼び出し | R | 真値 (Rmpfr) | rStats.js |
|---|---|---|---|
| `dgamma(110000.00000000001, 1e5)` | 2.4166502895221053e-207 | 2.4166502895188551e-207 | 2.416650289518855e-207 |
| `pgamma(1e-100, 3, lower.tail = FALSE, log.p = TRUE)` | -1.6666666666665175e-301 | -1.6666666666666667e-301 | -1.666666666666667e-301 |
| `pbeta(0.99, 1e5, 100)` | 4.127552829240118e-296 | 4.1275528292396704e-296 | 4.1275528292396705e-296 |
| `pnbinom(1e5, 1e-10, 0.001, lower.tail = FALSE)` | 3.5003255336351424e-56 | 3.5003255336350864e-56 | 3.500325533635079e-56 |
| `pnbinom(1e8, 10, mu = 1e6, lower.tail = FALSE, log.p = TRUE)` | -879.62 | -950.61809786317 | -950.6180978631712 |
| `phyper(0, 3, 1e6, 2, log.p = TRUE)` | -5.999993999861e-6 | -5.999994000011999976e-6 | 真値と同じ |
| `ptukey(30, 3, 10, lower.tail = FALSE)` | 2.880e-9 | 3.3124453334e-9 | 真値と同じ |
| `ptukey(3, 1000, 10)` | 0 | 1.3584e-5 | 真値と同じ |
| `ptukey(0.5, 20, 2)` | 0 | 3.427e-8 | 真値と同じ |
| `qtukey(0.999, 3, 2)` | 42.41 (その値の `ptukey` は 0.99797) | | 60.418 |
| `qtukey(-20, 10, 10, log.p = TRUE)` | 4.05e-5 | | 0.2084 |
| `pchisq(1000, 5, ncp = 10, lower.tail = FALSE)` | 1.64e-180 | 1.7925e-176 | 真値と同じ |
| `pbeta(1 - 1e-10, 2, 3, ncp = 1, lower.tail = FALSE)` | 1.7e-10 | 7.52e-30 | 真値と同じ |
| `pt(-1, 5, ncp = 10)` | 0 | 1.3248e-26 | 真値と同じ |
| `pt(1, 5, ncp = 40)` | 1.009e-303 | 1.0887e-287 | 真値と同じ |
| `dchisq(1e4, 5, ncp = 10, log = TRUE)` | -2975.1 | -4688.08 | 真値と同じ |
| `dchisq(1e-300, 0, ncp = 1)` | 0 | 0.1516 | 真値と同じ |
| `df(1e10, 5, Inf, ncp = 0, log = TRUE)` | -1.25e11 | -2.5e10 | 真値と同じ |
| `qchisq(-1e10, 5, ncp = 1, lower.tail = FALSE, log.p = TRUE)` | 2.29e10 | 2.00e10 (分布関数で確認) | 真値と同じ |

### 特殊関数

これらの比較に使う値は Rmpfr ではなく mpmath (100〜800 桁) で計算しています。

- **`choose` と `lchoose`**: n が整数でなく k が大きいとき、R は最大 2.6e-10 ずれます
  (`choose(10.3, 1e5)`)。
- **`factorial`**: オーバーフローの近くで、R の `factorial(170)` は 1.2e-13 ずれます。
- **`dmultinom`**: 度数が大きいと、R は `lgamma` の値を足し合わせるので桁を失います (度数 1e9 で
  相対 2.8e-6。rStats.js は二項確率を掛け合わせます)。
- **`digamma`、`trigamma`、`psigamma`**: 絶対値の大きい負の x (`trigamma(-100000.25)` は 1.2e-11
  ずれる)、digamma の正の零点の近く、非常に大きい x (`trigamma(1e300)` は 2.4e-14 ずれる)。
- **ベッセル関数**: x や次数が大きいと、R は多くの点で 1e-13〜1e-11 ずれ、大きく外れる点もあります
  (次の節)。

### p が 1 に極めて近い離散分布の分位点

`qpois(0.999999999999999, 1e5)` のように 1 − p が 1e-12 より小さい呼び出しでは、R は 1 に近い
分布関数の値どうしを比べるため、1 − (小さい値) の丸めによって答えが数単位ずれます。rStats.js は
反対側の裾の小さな確率どうしを比べるので、この影響を受けません。

### 仮説検定

| ケース | R | rStats.js |
|---|---|---|
| 平均が大きく散らばりが小さいデータ (1e8 + 1e-3 のノイズ) の分散と相関 | 分散が 1.4e-11、`cor` が 2e-10 ずれる | double-double で総和 |
| 1e200 前後の値の分散 | 二乗がオーバーフロー: 分散 Inf、t = 0、p = 1 | 偏差を 2 のべき乗でスケーリングし、有限の結果 |
| 1e-200 前後の値の相関 | アンダーフローして NA | 有限の結果 (同上) |
| 完全相関 (たとえば `1:5` とそれ自身) | r = 1 − 2 ulp。1 − r² が桁落ちし、t と p が大きくずれる (p が 0 でなく 4e-24。1e-4 のノイズがあると p 値が 14% ずれる) | r と 1 − r² を double-double で計算 |
| Kendall の正確検定の上側の裾 | 1 − (下側の裾) として計算: n = 30 の完全相関で 3.8e-33 でなく 5.6e-16 | 上側の裾を直接合計 |
| Spearman、n = 2 の完全相関 | S = 2.2e-16 (0 であるべき) | 0 |
| rho ≈ ±1 での Spearman の t 近似 | n = 10 の完全相関で p = 1e-62 (0 であるべき) | 0 |
| r × c 表の Fisher の正確検定 | FEXACT の丸め誤差が相対で 1e-11 程度 (`workspace` を変えると値が 2e-13 変わる) | 厳密な全列挙と一致 |
| `var.test`・`ansari.test`・`mood.test`・lawstat の `brunner.munzel.test` の上側の裾 | 1 − P の形で求めるので、小さな p 値は相対精度を失う (`var.test` は p = 4e-58 で 0 を返す) | 裾を直接計算 |
| `ansari.test` の正確な p 値 | 確率の和に丸め誤差が残り、小さな p 値で相対 1e-8 程度までずれる (m = 60、n = 70 で 8.8e-9) | 部分集合の厳密な数え上げと一致 |
| 同順位のある `mood.test` | R 4.5.2 は分散の同順位の補正で Mielke の式の (N − 2 cumsum(t) + t)² を (N − t)² としている (R-devel で修正済み)。統計量が最大 6% ずれる | 平均した得点の正確な置換分散 |
| `ks.test` の漸近的な両側 p 値 | Kolmogorov の極限分布の級数を許容値 1e-6 で打ち切る (最大 1e-5 ずれる) | `scipy.special.kolmogorov` と一致 |
| 非心度が巨大 (1e13 以上) で分位点から遠い `pchisq` と `pf` | 0 と 1 で正しい (ただし、そのような分布の中心付近では R は収束しない) | 0 と 1 (Chernoff の上界で判定)。中心付近は対象外 |
| 2 標本の `ks.test` で 0 になる統計量 | 1/m と −1/n の累積和の丸めの残り (±1e-16、負のこともある) | 0 |
| `fligner.test`・`prop.test` で 0 になる統計量 | 丸めの残り (1e-31) | 0 |
| 平均が大きくばらつきの小さいデータの `skewness`・`kurtosis`・`cv` | e1071 は double に丸めた平均を引くので、歪度が相対 8e-5、尖度が 2e-6 ずれる (1e8 + 1e-3 のノイズ) | double-double の平均からの偏差。60 桁の値と一致 |
| 平均が大きくばらつきの小さいデータや、値がすべて等しいデータの一元配置 `aov` | R は QR 分解で当てはめるので、平方和が 6e-8 ずれる (1e6 + 1e-3 のノイズ)。値がすべて等しいと丸めの残りから F = 1、群ごとに一定なら 5.9e30 | double-double の平方和 (F = NaN、Inf) |
| `TukeyHSD` | R の `ptukey`・`qtukey` (上記)。df = 5 で p 値が 3e-6 ずれる (2 群なら t 分布から決まる) | 高精度の値と一致 |
| ほぼ共線な列の `lm` (1e6 + ノイズと切片) | 係数が 60 桁の値から 1.7e-9 ずれる | 3.6e-11 (どちらも eps と条件数の積の範囲) |
| 平均の大きいデータ (1e6 + ノイズ) の formula の `lm` と `anova` | 係数が厳密な有理数の値から最大 1.5e-11、R² が 2.8e-12 ずれる。0 に近い平方和は相対 1.6e-10 ずれる | double-double で当てはめる。厳密な値との差は 7e-15 以内 |
| `M` と `X` で対比を指定した `mauchly.test` | W が厳密な値から最大 4e-12 ずれ、W ≈ 1 の p 値は 1.3e-12 ずれる | W を double-double で計算する。厳密な値との差は 1e-15 以内 |
| 非心分布を使う検出力の計算 (`power.t.test`、`power.anova.test`、`pwr.*`) | R の非心 t は 1e-12 程度、非心 F は 1e-9 程度の精度 (自由度 4e5 を超える t は近似式) なので、検出力とそこから解いた標本サイズが最大 3e-8 ずれる | 正確な非心分布。解く量は R と同じ `uniroot` の呼び出し (同じ区間と許容) なので、R の許容の精度のまま |
| effectsize の信頼区間 (`cohens_d`、`hedges_g`、`eta_squared` など) | 非心度を Nelder-Mead (`optim`) で探すので、限界が 1e-9 程度、最大で相対 3e-3 ずれる (偏 η² の上限が 0.25111 でなく 0.25181) | 厳密な限界 |
| Dunnett 型の p 値 (multcomp の Dunnett、PMCMRplus の `dunnettTest` と single-step の `kwManyOneDunnTest`・`manyOneUTest`) | mvtnorm の乱数を使う積分で、絶対 1e-3 程度。実行ごとに変わる (種で固定) | 1 次元積分で厳密に |
| 多重比較 (Steel-Dwass、Games-Howell、Tukey) のステューデント化範囲の p 値 | R の `ptukey` は 8 桁程度 (テストで最大 3.4e-8 ずれる) | 完全な精度 |
| irr の κ の p 値 | 2 (1 − Φ(|z|)) で作るので、小さい値が桁落ちする (1.7e-16 でなく 2.2e-16) | 2 Φ(−|z|) |
| polycor の最尤推定と標準誤差 (`ML = TRUE`、`std.err = TRUE`) | Nelder-Mead や BFGS が早めに止まり、ヘッセ行列は差分で求める: 相対で最大 1e-3 ずれる。関連の強い表では 2 段階推定の BFGS が 1 を越え、0.9999 と無限大の分散を返す | 尤度の厳密な最大値 (160 ビットの値と 4e-15 以内) と解析的なヘッセ行列 |

### R にない分布

R 側の参照は extraDistr (invgamma・kumar・pareto・triang・laplace)、R のベータ分布の関数 (arcsine)、R で書いた
閉じた形 (`distSummary`) です。rStats.js の値は mpmath の 50 桁の値と一致します (`scripts/mpmath/extradist.py`、
`scripts/mpmath/distsummary.py`)。

| ケース | R | rStats.js |
|---|---|---|
| `pinvgamma`・`pkumar`・`ppareto`・`plaplace`・`ptriang` の裾 | extraDistr は教科書の式をそのまま計算するので、1 − x^a や 1 − p が桁落ちし、確率がアンダーフローしてから対数を取る (`pkumar(1e-10, 1, 1)` が 8e-8 ずれ、`pinvgamma(1e-300, 1, 1, log.p = TRUE)` が −1e300 でなく −Inf) | 裾を直接計算 |
| 遠い裾の分位点 (`qlaplace`・`qkumar`・`qtriang` など) | 1 − p が丸まる: `qlaplace(1e-300, lower.tail = FALSE)` が Inf | 正しく丸めた値 (p に戻る) |
| 母数に対して急な密度 (alpha = 100 の `dinvgamma`、端に近い `dtriang`) | beta / x や b − x の丸めが拡大される (9e-14 まで) | 割り算を double-double で |
| `weibull` と `kumar` の `distSummary` の歪度・尖度 | 生のモーメントからの式が桁落ちする (shape 20 で尖度の 9 桁を失う) | 中心モーメントを直接積分 (3e-14) |
| 小さい引数の `erfinv` (pracma の定義 `qnorm((1 - |y|) / 2)` を通す形) | y の相対精度が失われる: `erfinv(1e-10)` が 8e-8 ずれ、`erfinv(1e-300)` が −0 | `erf` のニュートン法 |
| `gammainc` (R の `pgamma(x, a) * gamma(a)`) | 丸めが 2 回入り、積がオーバーフローすると大きな対数の exp になる (a = 200 で 1e-13) | x < a では `pow` を使った級数 |

## R が失敗し、rStats.js が値を返す場合

| ケース | R | rStats.js |
|---|---|---|
| `pbinom(36, 1e5, 0.01, log.p = TRUE)` | -Inf (内部でアンダーフロー、警告あり) | -851.68… |
| `qbinom(-1e10, 1e5, 0.01, log.p = TRUE)` | 37 (探索が途中で止まる) | 0 (F(0) ≈ e^-1005 は e^-1e10 を超える) |
| `qt(1e-320, 2)` (非正規化数の p) | -Inf | -7.0711e159 (閉じた式 −sqrt(1/(2p)) と一致) |
| `qbeta(-1e5, 1e-10, 100, lower.tail = FALSE, log.p = TRUE)` | NaN | 1 (真の答えを丸めると 1) |
| `dcauchy(1e300, log = TRUE)`、`pcauchy(-1e300, scale = 1e-300, log.p = TRUE)` | -Inf | -1382.69… |
| `dweibull(1e-300, 3, log = TRUE)` | -Inf | -1380.45… |
| `dweibull(1e100, 5, log = TRUE)` | NaN (∞ − ∞) | -Inf |
| `pnbinom(30, 1e7, 0.7, log.p = TRUE)` | -Inf | -3566376.67… |
| `qcauchy(-1000, 0, 1e-300, log.p = TRUE)` | -Inf | -6.27e133 |
| `qcauchy(1e-320, 0, 1e-300)` | 不正確 (πp が非正規化数) | scale/p/π として計算した正しい値 |
| `qlogis(1e-320, lower.tail = FALSE)` | Inf | 736.83 |
| `plogis(-745)` など答えが非正規化数になるもの | 0 | 5e-324 |
| `pwilcox(q, 500, 500)` | 数 GB を使ってメモリ不足になる | 計算できる (メモリは mn/2 に比例して増える) |
| `dwilcox(3, Inf, 5)`、`dsignrank(3, Inf)` | 割り当てエラーまたはクラッシュ | NaN |
| `qsignrank(p, 1100)`、`qhyper(0.5, 1e15, 1e15, 1e15)` | 終わらない | 計算できる (この大きさの `qhyper` は 10 秒ほどかかる) |
| `qtukey(1e-10, 20, 10)` | NaN | 有限の答え |
| `qhyper(1 - 1e-15, 1e4, 1e5, 5000)` | 5000 | 617 (定義どおり) |
| n = 179 の 3 × 5 表に対する `fisher.test` | 既定の workspace で FEXACT error 7 | 0.2023726720757 (0.65 秒) |
| 非常に大きな n (たとえば 3000) での `wilcox.test(exact = TRUE)` | `psignrank` が NaN を返す | 計算できる |
| x < 0 で deriv ≥ 6 の `psigamma(x, deriv)` | NaN (R では未実装) | 計算できる (`psigamma(-1.5, 10)` = -156.229596593233) |
| `trigamma(1e-300)`、`psigamma(1e-100, 3)` など結果がオーバーフローするもの | NaN | ±Inf |
| `besselI(1000, 1000)` | Inf | 2.7234536469108428e229 |
| `besselK(1000, 1000)`、`lfactorial(1e-300)`、`besselI(1e-300, 1)` | 0 | 1.2981802514667e-233、-5.77e-301、5e-301 |
| `besselJ(1e6, 0)` | 0 | 3.3104301373987376e-4 |
| `besselY(1e6, -2.75)` | -4.1e-4 | -2.8030753997749413e-5 |
| タイがあり `exact` を指定しない (または `TRUE`) `ansari.test(conf.int = TRUE)` | エラー "object 'cint' not found" (両方の標本が 50 未満だと R は正確な方法の分岐に入り、タイがあると区間を飛ばす) | 正規近似の区間と推定値 (`exact: false` と同じ) |

## 意図的な違い

### 全般

- **添字は 0 始まりです。** `sampleInt(n)` は 0..n-1 の値を返します (同じ乱数列から得た R の
  `sample.int()` から 1 を引いたもの)。`qr()` と `chol(x, { pivot: true })` の `pivot` も 0 始まりです。
  `sample(array, ...)` は R と同じく要素を返します。
- **分布のパラメータはスカラーです。** ベクトルとしてリサイクルはしません。第 1 引数には数値、配列、
  `Float64Array` を渡せます。ベクトルのパラメータには `map` を使います。`setSeed` の後に 1 つずつ引く
  乱数は、R のリサイクルと同じ順で乱数列を消費するので、結果は R と同じです:

  ```ts
  [0, 1, 2].map((m) => pnorm(1.96, { mean: m }));         // R: pnorm(1.96, mean = c(0, 1, 2))
  setSeed(1);
  [0, 10, 100].map((m) => rnorm(1, { mean: m })[0]);      // R: set.seed(1); rnorm(3, mean = c(0, 10, 100))
  // [-0.6264538107423324, 10.183643324222082, 99.16437138758995]
  ```
- **NA は NaN で表します。** R は `NA` と `NaN` を区別します (たとえば `table` と `unique` は別々に数える)
  が、rStats.js には `NaN` が 1 つしかありません。
- **`var` は `variance` という名前です。** JavaScript では `var` を名前に使えないためです。

### 分布

| ケース | R | rStats.js |
|---|---|---|
| `qbeta` の答えがアンダーフローする (たとえば `qbeta(0.5, 1e-10, 2.5)`) | 2^-1024 (5.56e-309) | 0 |
| `qf` の答えがオーバーフローする (たとえば `qf(-1e-300, 1, 1, log.p = TRUE)`) | 2^1023 付近の有限値 | Inf |
| size が整数でない `qbinom` (たとえば 2.5) | `pbinom` の NaN で探索し、意味のない値 (-0 を含む) を返す | NaN (`dbinom`、`pbinom` と同じ) |
| max − min がオーバーフローする一様分布 (min = -1e308、max = 1e308) | Inf / 0 / NaN | 両端を半分にして計算 (`dunif` は 5e-309、`punif(-1)` は 0.5、`qunif(0.5)` は 0) |
| size = Inf の `dnbinom` | prob < 1 で -1.2e308 のような有限の対数確率。prob = 1 で log P[X = 0] が NaN | -Inf と 0 |
| size = Inf かつ prob < 1 の `qnbinom` | p によって Inf または NaN | 常に Inf (質量は X = ∞ にある。p = 0 と 1 は R と同じ) |
| 答えが 2^53 を超える `qnbinom` | 分布関数が目標に届かない答え (目標 −32 に対して log p が −31.85) | 目標を満たす答え |
| p が微小 (1e-15 程度未満)、上側の p が小さい、または log p が深い `qsignrank`、`qwilcox` | 線形の下側 p に変換して絶対許容幅 10ε で比べるため、0 などを返す (`qsignrank(1e-100, 1000)` は 0) | 定義どおりの答え (69727) |
| `log.p = TRUE` かつ p = -Inf の `qsignrank`、`qwilcox`、`qhyper` | NaN | p = 0 と同じ (台の下端) |
| n = Inf の signrank、m = Inf の wilcox | クラッシュ | NaN |
| パラメータが無限大の非心 `qbeta` (たとえば shape2 = Inf) | NaN 上の探索から 0、0.5、1 | NaN |
| ncp = ±Inf の `qt` | p によって NaN と ±Inf が混在 | 端点以外は NaN |
| `qchisq(p, 0, ncp = 0)` (質量がすべて 0 にある) | NaN または Inf | 0 |
| `df(0, df1, Inf, ncp, log = TRUE)` | 線形の値の対数にならない (ncp = 0 で −1.386。線形の値は 1) | 線形の値の対数 |
| 答えが丸めで 0 になる、df2 = Inf の `qf` | 2e-130 のような意味のない値。log p = -1e-300 で Inf | 分布関数で確認した値 |

非常に平坦な `qnbinom` のケース (size = 1e-10、p = 1 − 1e-10 など) では、p の丸め幅に数十個の整数が
含まれるため、答えが R と数十ずれることがあります。どちらの答えも、分布関数が p から 16ε 以内にある
ことを確認しています。

R の `dgeom` と `dnbinom` は、|x − round(x)| > 1e-9 max(1, |x|) のとき x を整数でないとみなします。
rStats.js の `dpois` と `dbinom` は 1e-7 のしきい値を使うため、整数の近くで R と異なる可能性があります
(未検証)。

- **R にない分布**は extraDistr の名前と母数を使います。`darcsine`・`parcsine`・`qarcsine`・`rarcsine`
  (extraDistr に無い) はベータ(1/2, 1/2) を (a, b) に移したものです。無限大の形や位置の母数は極限として
  扱います。extraDistr の式はその端で NaN や外れた値を返します (`qkumar(0, Inf, 1)` は extraDistr で 1、
  ここでは 0)。`qinvgamma` は `dinvgamma`・`pinvgamma` と同じく alpha <= 0 で NaN を返します (extraDistr の
  `qinvgamma` は alpha を確かめません)。
- **`distSummary`** の決まり: 存在しないモーメントは NaN、無限のモーメントは Infinity。離散分布で等しい
  最大が 2 つあれば大きい方を最頻値とし、密度の最大が一意でなければ NaN です。

### 乱数

- `setSeed(seed)` のあとに任意の `r*` 関数や `sample` を呼ぶと、R の `set.seed(seed)` と同じ乱数列が
  得られます。離散値、`sample`、消費する一様乱数の個数は完全に一致します。連続値は 1e-13 程度
  (最大 1e-12) まで一致します。`Math.log`、`Math.exp`、`Math.pow`、`Math.tan` の最後のビットが
  V8 と glibc で異なるためです。
- 基準は x86_64 版の R です。arm64 版は積和演算を融合 (FMA) するため、`qnorm` の最後のビット、
  ひいては正規乱数の値が変わります。`set.seed(42); rnorm(3)[2]` は x86_64 で -0.56469817139608869、
  arm64 で -0.5646981713960888 です。JavaScript には FMA がないので、rStats.js は x86_64 の R と
  一致します。
- R の RNG の種類のうち、一様乱数の生成器 `"Mersenne-Twister"` (既定) と `"L'Ecuyer-CMRG"`、
  正規乱数の種類 `"Inversion"`、sample の両方の種類 (既定の `"Rejection"` と `"Rounding"`) に
  `RNGkind({ kind, sampleKind })` で対応しています。R の `set.seed(seed, kind, sample.kind = ...)` は
  `RNGkind({ kind, sampleKind })` のあとに `setSeed(seed)` を呼ぶのと同じで、同じ状態になります
  (R も内部で同じことをしています)。`setSeed` 自体は seed だけを受け取ります。L'Ecuyer-CMRG の
  生成器を、使わないバンドルに含めないためです。`RNGkind` は R の文字列ベクトルではなくオブジェクト
  (`{ kind, normalKind, sampleKind }`) を返し、`"Rounding"` を選んでも警告は出ません。
- `getRandomSeed()`/`setRandomSeed()` は R の `.Random.seed` と同じ整数を使います。種類のコード
  (`10403`、Rounding では `403`、L'Ecuyer-CMRG では `10407`) に続いて、Mersenne-Twister では 625 個、
  L'Ecuyer-CMRG では 6 個の整数です。R が黙って時計から seed を取り直す場合 (対応していない種類の
  コード、seed が範囲外か最初の 3 つがすべて 0 の L'Ecuyer-CMRG の状態)、`setRandomSeed` は
  RangeError を投げます。`nextRNGStream` と `nextRNGSubStream` も同様です (R は確認せずに無意味な
  状態を計算します)。
- `rmultinom` は R の K × n 行列ではなく、長さ K の配列 n 個からなる配列を返します。
- `r2dtable` は R の行列のリストではなく、表 (行の配列) の配列を返します。

### 仮説検定

- **警告は返しません** ("Chi-squared approximation may be incorrect" や "cannot compute exact p-value
  with ties" など)。手法名と数値のフィールドはすべて R と一致します。
- **`wilcoxTest`** で n = 3、片側の正確な区間の場合、達成された信頼水準は 0.88 です。R は 0.87 と
  報告します。R の `psignrank(0, 3)` が 0.12500000000000003 で、1/8 より 1 ulp 大きいためです
  (R 自身も n = 4 の両側区間では 0.88 と報告します)。
- **`brunnerMunzelTest`** は、lawstat の `alpha` の代わりに `confLevel` を受け取ります
  (`confLevel = 1 - alpha`)。また、lawstat の結果にはない `alternative` のフィールドを返します。空の標本は
  "not enough 'x' observations" (または 'y') で例外を投げます。lawstat は意味のない数値を返します。順位を
  `n1 + 1:n2` で取り出しており、`1:0` が `c(1, 0)` になるためです。
- **`pAdjust`** の Hommel 法は、`n` が整数でないと例外を投げます (R は値を返します)。また、空の `p`
  で n > 0 のときは空の配列を返します (R は 1 を返します)。
- **標本が 1 つだけのリストを渡した `kruskalTest` と `flignerTest`** は、rStats.js のメッセージ
  "all observations are in the same group" で例外を投げます (R は "'x' must be a list with at least
  2 elements")。
- **文字列のグループラベル** (`kruskalTest`、`aov`、`TukeyHSD`、`pairwise*` の検定などの `g`) は、
  C ロケールの順 (コードポイント順) に並べます。R は因子の水準をロケールの照合順序で並べるので、
  グループの順序と、グループごとに並ぶ結果の順序が異なることがあります (`"a"`、`"b"`、`"B"` は、
  rStats.js では `"B"`、`"a"`、`"b"`、en_US ロケールの R では `"a"`、`"b"`、`"B"` の順になります)。
  `chisqTest(x, y)` の 2 つの因子の水準 (表の行と列) も同じです。因子の値は文字列 (欠測値は `null`)
  でなければなりません。
  formula の因子 (`modelMatrix`、`lm`、`aov`、`lmer`。`levels` で順序を固定できます) と、`aovEz` の被験者間
  因子も同じです。`aovEz` の被験者内因子は、afex と同じくデータに現れた順です。
- **formula** は文字列で、変数名、`.`、`+`、`-`、`*`、`/`、`:`、`%in%`、`^`、括弧、`0` と `1`、
  `aov` では 1 つの `Error()`、`lmer` では変量効果の項 `(lhs | g)` と `(lhs || g)` に対応します (lme4 2.0 の
  共分散の構造 `diag()`・`cs()`・`ar1()` には対応しません)。関数呼び出し (`log(x)`、`I(x^2)`、`poly(x, 2)`、
  `offset()`)、バッククォートの名前、変換した応答には対応しません。先に列を計算してください。
  対比は `contr.treatment` (既定)、`contr.sum`、`contr.helmert` です。解析できない formula は、
  R の構文エラーの代わりに "invalid formula: ..." を投げます。
- **`dunnTest`** は値を数として順位づけます。dunn.test 1.4.2 は、群を文字列のベクトルで渡すと値を文字列として
  順位づけ (10.06 が 8.88 より前)、因子で渡すと数として順位づけます。`dunnTest` は後者を再現します。
- **R がデータの表示で締めくくる `aovEz` のメッセージ** (欠測値で除いた id、被験者内の空のセル、
  被験者間の空のセル) は、表示の手前で終わります。

- **`coxph`** は共変量を行列で受け取ります (formula はありません)。整数でないケースの重みは "non-integer weights (robust
  variance) are not supported yet" で止まります (R はそのとき頑健 (サンドイッチ) 分散に切り替えます)。多数の反復で
  係数が無限大に向かう例では R 自身の結果がプラットフォームで違う (20 回の反復で x86_64 と arm64 の R が 1e-7
  違う) ので、その程度までしか一致しません。
- **`omega`** は 1 因子のとき、Schmid-Leiman 行列の群因子の列と群ごとの ω を厳密に 0 と返します。R は丸めの残差の
  平方根 (1e-8 ほど) を返します。群因子が 4 つ以上だと、データの最終ビットを変えるだけで R 自身の結果が最大 4e-11
  動くので、その程度で一致します (3 つまでは 1e-12)。

### データの扱い

- **`subset`** は条件を、行ごとの真偽値か行を受け取る関数 (`(r) => r.age >= 20`) で受け取ります。R のような式は
  書けません。`select` は列の名前の配列です。条件が欠測なら、R と同じく偽として扱います。
- **`split`** は `Map` を返します (群の並びは R と同じ)。普通のオブジェクトだと、整数のような名前が先頭に並べ
  替えられてしまうためです。
- **`aggregate`** が要約するのは数値の列で、関数はどの群でも 1 つの数か、同じ個数の値を返す必要があります (R は
  リストの列も作ります)。
- **`pivotLonger` と `pivotWider`** はデータフレームを返します。tidyr の警告は任意の `onWarning` コールバックに
  渡します。`pivotWider` で 1 つのセルに複数の行が当たるとエラーにします (tidyr は警告を出してリストの列を作り
  ます)。`valuesFn` で要約してください。正規表現 (`namesSep`、`namesPattern`) は JavaScript のものです。
- **`merge`** は数値のキーと文字列のキーを一致させません (R は一方を他方に変換します)。`merge` と `cbind` は列の
  名前が重なるとエラーにします。R は許しますが、列のオブジェクトでは同じ名前の列を 2 つ持てないためです。

### 線形モデル

- **重みがすべて 0 の `lm`** は "all weights are zero" で例外を投げます。R は NA の係数を返します。

### 一般化線形モデル

- **formula はありません:** `glm` は説明変数を行列 (またはベクトル) で受け取り、`intercept` が false で
  なければ 1 の列を先頭に加えます。応答はベクトル、二項分布の族では (成功数, 失敗数) の行でも渡せます。
  各列が 1 つの項です。`glmAnova` は列を 1 つずつ加えるので (行 `"x1"`、`"x2"`、...)、複数の列で表した
  因子は表の複数の行になります。係数の番号 (`glmConfint` の `parm`) は 0 始まりで、切片が最初です。
- **`glmConfint` はプロファイル尤度の厳密な限界を計算します。** R の glm の `confint` は、各係数を
  標準誤差の約 1/5 の刻みで動かし、尤度比 (またはスコア) 統計量の符号付き平方根にスプラインを通して
  補間します。テストの fixture では、その限界は厳密な値から最大で標準誤差の 4.5e-4 ずれています。
  rStats.js は z(b) = qnorm((1 ∓ level)/2) を Brent 法で解きます。当てはめとプロファイルの各再当て
  はめは係数が変わらなくなるまで反復し (R の逸脱度の相対変化による判定では、係数がまだ sqrt(epsilon)
  程度動く段階で止まります)、分散パラメータも収束した当てはめのものを使います。限界は、テストの
  fixture の厳密な参照値 (R で同じように収束させた当てはめから計算したもの) と、標準誤差の 1e-14 まで
  一致します。
- **警告**は出さずに返します。`glm` の結果の `warnings` に R の警告を入れます (各メッセージは 1 回、
  最初に現れた順)。Poisson の AIC で R の `dpois` が出す警告 (`"non-integer x = 0.500000"`) と、
  `1/mu^2` リンクの `sqrt` の警告 (`"NaNs produced"`) も含みます。`glmSummary` と `glmAnova` は
  それぞれの警告を返します (`"observations with zero weight not used for calculating dispersion"`、
  `"using F test with a 'binomial' family is inappropriate"`、`glmAnova` の再当てはめの警告)。
  `glmResiduals`、影響の尺度、`glmPredict` は警告を返しません。offset のあるモデルの null 逸脱度の
  ための切片だけの再当てはめも、その反復の警告を返します (R の `glm.fit` も出します)。
- **ないもの:** `etastart` と `mustart` (`start` を使ってください)、`method`、`singular.ok = FALSE`、
  `x`・`y`・`model` の指定 (モデル行列と応答は常に `model` に保存します)。
- **テストでの R との比較:** よく当てはまるモデルの残差は y − mu で桁落ちするので、max(|y|, |mu|)
  (残差の種類ごとに同じ倍率をかけたもの) に対する相対誤差で比べます。逸脱度残差と逸脱度は y/mu の対数の
  丸めに対して、0 に近い線形予測子は |x_j b_j| の和に対して比べます。これを超えて R と 1e-12 より
  大きく違うのは 3 種類です。完全分離と準完全分離では推定値が無限遠にあり、係数は反復が止まった位置の
  値です (4e-11 まで一致し、重み exp(−|eta|) とそれに依存する量、たとえば hat 値は 1.5e-9 まで)。
  境界で止まり、平均が値域の端から 1e-8 以内にある当てはめ (mu が 1 に近い log リンクの二項分布、mu が
  0 に近い identity リンクの Poisson) では、その平均は桁落ちの結果で、eps とその条件数の積までしか
  決まりません (3.9e-14 の平均に依存する標準誤差で最大 7.3e-4)。gaussian の完全な当てはめの AIC は、
  丸め誤差だけの逸脱度の n log です。

### 混合モデル

- **`lmer` は厳密な最適点を返します。** REML 基準 (または ML の逸脱度) の最適点を、解析的な勾配を使った
  ニュートン法で求めます。lme4 の最適化は自分の許容誤差を満たしたところで止まり、θ では最適点から
  相対でおおむね 1e-9〜1e-5 離れています。そのため、θ、分散成分 (`VarCorr`)、標準誤差、変量効果は、lme4 と
  有効数字 5〜9 桁目あたりで違います。固定効果と対数尤度は、それより多くの桁で一致します (最適点では基準が
  平らなため)。rStats.js の基準の値が lme4 より大きくなることはありません。lme4 の収束の警告
  (`Model failed to converge ...`) は出しません。
- **特異な当てはめは、厳密な最適点で判定します。** 最適点が境界上にある θ の要素はちょうど 0 になり、
  `singular` と message `boundary (singular) fit: see help('isSingular')` はそれに従います。lme4 が境界の
  すぐ内側 (θ が閾値 1e-4 より大きい所) で止まる場合、lme4 は特異でないと報告しますが、rStats.js は
  特異と報告します。
- **列が 2 つ以上の項** (`(x | g)`): 先頭の列の分散が 0 に向かうと、共分散の因子の列の符号を変えても基準が
  変わらないため、lme4 の境界つきの最適化は最小でない点で止まることがあります。rStats.js はその境界なしで
  最小化し、同じ意味の因子で報告するので、そこでは lme4 より低い基準に達することがあります (同じモデルの、
  よりよい当てはめです)。
- **計算は lme4 と同じく疎行列で行いますが、JavaScript なので、** 当てはめの時間は lme4 のおよそ
  1.4〜3 倍です ([performance.md](performance.md) を参照)。

### 線形代数

- **行列**は行の配列として渡します。0 行の行列は 0 × 0 として扱います。
- **固有ベクトルと特異ベクトル**は R と符号が逆になることがありますが、どちらも正しい答えです。
  複素固有ベクトルは、絶対値が最大の成分が正の実数になるようにスケーリングします (R の `dgeev` は
  その成分を実数にするだけです)。重複した固有値や特異値に対するベクトルと、min(行数, 列数) を超える
  特異ベクトルは一意でなく、一般に R と異なります。
- **アルゴリズム:** `svd` は Golub–Reinsch、`eigen` は EISPACK のアルゴリズム `tred2`、`tql2`、
  `orthes`、`hqr2` を使います (R は LAPACK の `dgesdd`、`dsyevr`、`dgeev` を使います)。値は丸め誤差の
  範囲で一致します。一般行列の `eigen` は事前に行列のバランス調整 (`dgebal`) をしないため、スケールの
  悪い行列では R より精度が落ちることがあります。
- **三角行列の `rcond`** は、`dlatrs` (オーバーフローを避けるためにスケーリングし直す) ではなく単純な
  代入で解くため、オーバーフローぎりぎりの行列では値が異なることがあります。
- **`chol`** は対角に NaN があっても失敗せず、NaN を伝播させます (R の OpenBLAS も同じです。参照実装の
  `dpotf2` は停止します)。`pivot: true` では、ランク落ちの行列に対して警告の代わりに `rank` を返し、
  停止位置の対角にはその時点の残りの値が入ります。
- **`solve`** は行列に NaN や Inf があると条件数のチェックなしで解きます (LAPACK 3.12 の `dgecon` は
  エラーを返しますが、R は無視します)。同じ行列の `rcond` は例外を投げます。

### 数値計算

- **3 次 Hermite スプラインの 3 階微分** (`splinefunH` と、`method: "monoH.FC"` の `splinefun` で
  `deriv = 3`): rStats.js は数学的に正しい値、幅 h の区間で (6 m_i + 6 m_{i+1} − 12 δ) / h² を返します。
  R (4.5.2 と R-devel) は h で 1 回しか割らず、その h 倍を返します。R のバグと思われます。幅 1 の
  区間では両者は一致します。たとえば `splinefunH(c(0, 2), c(0, 0), c(1, 1))(1, deriv = 3)` は、R では
  6、rStats.js では 3 です。

## R に合わせた動作

これらは R のドキュメントと観察した出力から決めました (特殊関数は R のソースも参照)。間違えやすい
ので載せています。

### 分布

- 離散分布の分位点探索の許容幅: 線形の p では相対 8ε、log p では 2ε。
- ベータ分布の点質量は、q ≥ 1、次にパラメータが 0 または ∞、次に q ≤ 0 の順で調べます。
- `df(Inf, df1, df2)` は df1 < 2 で NaN、それ以外で 0 です。
- 超幾何分布と順位の分布は、パラメータを偶数丸め (half to even) します。`dhyper` は整数でない m, n, k
  に NaN を返し、`phyper` と `qhyper` はそれらを丸めます。`psignrank` は round(q + 1e-7)、ほかは
  floor(q + 1e-7) を使います。signrank/wilcox の n と m は丸められ、≤ 0 なら NaN になります。
- 非心ベータの `pbeta` は、パラメータが不正でも x ≤ 0 または x ≥ 1 なら 0 または 1 を返します。
  ncp = Inf の非心カイ二乗分布と非心ベータ分布は NaN を返します (`qchisq` は端点でのみ値を返します)。
  `pf(·, Inf, df2, ncp)` は NaN です。`df(·, Inf, df2, ncp)` は ncp を無視します。
  `df(Inf, df1, finite, ncp)` は NaN です。
- `ptukey` は nmeans < 2、df < 2、nranges < 1 で NaN を返します。整数でない nmeans と nranges は
  受け付けます。
- 引数を調べる順序 (たとえば scale = 0 の `qcauchy` は p を見る前に location を返す) は R に従います。

### 仮説検定

- **欠損値:** 検定が除くのは NaN だけで、Inf は残します (`wilcoxTest`、`corTest`)。対応のある検定では
  ペアごと除きます。既定の `use: "everything"` の `cor` は、R と同じく、データに NaN があると NaN を
  返します。
- **信頼水準のチェック:** `tTest` はちょうど 0 と 1 を受け付けます (1 なら ±Inf)。
  `wilcoxTest` (`confInt` が true のときだけ) と `fisherTest` (常に) は開区間を要求します。
  `corTest` は Pearson のときだけチェックします。
- **`tTest`:** 標準誤差が平均の絶対値の 10ε 倍より小さいとき、データは「本質的に定数」とみなされ
  エラーになります。等分散の手法名は R と同じく空白で始まります (`" Two Sample t-test"`)。
- **`chisqTest`:** Yates の補正は min(0.5, min |O − E|) をすべてのセルから引きます (SciPy はセル
  ごとに補正します)。その量が 0 なら、手法名に Yates は付きません。2 × 2 以上の行列は負の値、NaN、
  Inf を拒否します。ベクトルと 1 行または 1 列の行列は負の値と NaN を拒否し、Inf では統計量が NaN に
  なります。1 行または 1 列の行列は適合度検定として扱います。`p` の和は sqrt(ε) 以内で 1 でなければ
  ならず、正規化し直さずにそのまま使います。`alternative` は返しません。
- **`fisherTest`:** オッズ比の推定値と区間は、R の `uniroot` の動作をその誤差も含めて再現します。
  ψ = 1 での値によって、ψ ∈ [0, 1] と 1/ψ ∈ [ε, 1] のどちらを Brent 法 (許容誤差 ε^0.25) で探索するか
  が決まるため、結果は真の根から最大 0.7% ずれます (紅茶の味見の表の上限は R でも rStats.js でも
  621.93 で、真の根は 626.24 です)。両側 p 値は、観測された表の確率の 1 + 1e-7 倍以下の確率をもつ表を
  合計します。整数でない度数は偶数丸めします。周辺度数に 0 がある 2 × 2 表では p = 1、推定値 0、
  区間 [0, Inf] になります。r × c 表では `alternative` をチェックせず、与えられたまま返します。
  `statistic` は返しません。
- **`wilcoxTest`:** 既定 (`exact` 未指定) では、ゼロを除いた後の n < 50 (2 標本では両方が < 50) で
  同順位がなければ正確法を使います。同順位やゼロがあると、`exact: true` でも正規近似を使います。
  正規近似の区間と推定値は R と同じ探索範囲と目的関数を使い、最後の桁まで一致します。正確な区間の
  達成された α が目標から α/2 より大きく離れているときは、報告する信頼水準を置き換えます
  (符号付き順位: 1 − signif(α, 2)。順位和: 丸めない)。
- **`corTest`:** Spearman の正確検定 (Best and Roberts 1975, AS 89) は、同順位のない n ≤ 1290 で
  使います (R のヘルプには n < 1290 とありますが、1290 も正確です)。n ≤ 9 では全列挙、それより上では
  Edgeworth 級数です。p 値は round(S) を使います。Spearman の `continuity` は t 近似にだけ効き、
  符号や alternative にかかわらず常に rho を大きくする方向、(rho + d)/(1 + d) (d = 6/(n³ − n)) に
  動かします。R のバグに見えますが、合わせています。Kendall の正確検定は同順位のない n < 50 で既定と
  なり、`exact: true` で n ≥ 50 でも強制できます。`continuity` は S を sign(S)(|S| − 1) に置き換え
  ます。Pearson は 3 ペア以上、Kendall と Spearman は 2 ペア以上が必要で、区間には 4 ペア以上が必要
  です。定数のデータでは統計量、p 値、推定値が NaN になります。
- **`ansariTest` の区間 (`confInt: true`):** R 4.5.2 と同じく位置を 0 として計算します。正確な方法:
  候補の比は x_i / y_j ≥ 0 で、x / s と y の統計量を隣り合う候補の間 (と最大の候補の 2.01 倍) で
  評価し、R の `qansari` の分位点を横切る候補を限界とします (`qansari` の累積和には余裕がないので、
  ちょうど 1/2 の確率が丸めで見逃されることがあり、R と同じです)。限界を作れないときは NaN (R の NA)
  です。正規近似: 標準化した統計量 (R 4.5.2 のタイ補正した分散と、タイがないときの平均。R-devel では
  変更されています) が正規分位点を横切る点を、正の値どうしの比と、0 以下の x と負の y の比の最小から
  最大の範囲で `uniroot` (許容誤差 1e-4) により求めます。s = 0 での 0 / 0 は、R の `rank` が NA を
  最後に置くのと同じく最後の順位にします。
- **シミュレーションによる p 値** (`chisqTest`、`fisherTest`): (1 + 観測値の (1 − 64ε) 倍以上の
  シミュレーション統計量の数) / (B + 1)。`fisherTest` では −Σ log(x_ij!) が観測値 / (1 + 64ε) 以下の
  表を数えます。手法名には R と同じ `" with simulated p-value\n\t (based on B replicates)"` が付き、
  パラメータは NaN (R の NA) です。`chisqTest` は補正しない統計量を使い、周辺和に 0 があるときは
  シミュレーションせず通常の検定をします。適合度検定では B n 個のカテゴリをまとめて引き、n 個ずつ
  数えます (総数 n が整数でないときの、R の floor(n) 行の行列とその再利用も再現します)。
  `fisherTest` は先に空の行と列を除き、2 × 2 の表では `simulatePValue` を無視します。`B: 0` では
  p = 1 です。
- **`pAdjust`:** `n` の既定値は NaN でない値の個数で、それより小さい `n` はエラーです。[0, 1] の外の
  p 値も処理し、上端だけを 1 で抑えます。省略した手法名は大文字と小文字を区別します。

### 一般化線形モデル

- **リンク:** lambda <= 0 の power リンクは log リンク (名前は `"log"`)、lambda = 1 は identity です。
  それ以外の power リンクの名前は `"mu^"` に lambda を小数 3 桁に丸めたものを続けたものです。逆リンク
  とその導関数には R と同じ制限があります (|eta| > 30 の logit、log リンク、eps の分位点での probit と
  cauchit、cloglog で eps = 2^-52)。
- **反復:** 逸脱度が有限でないときと、平均や線形予測子が範囲外のときのステップの半減は、どちらも
  boundary を設定し、boundary は最後の反復のものを表します。"no observations informative at
  iteration k" は警告で、収束しないまま反復を終えます。返す作業重み (分散パラメータ、影響の尺度、
  標準誤差に使うもの) は最後の最小二乗のステップのもので、最後の更新の前の平均から計算します。QR の
  許容誤差は min(1e-7, epsilon/1000) なので、`epsilon: 1e-14` では完全に共線な列も aliased になりません。
- **AIC:** gaussian の AIC は log w をすべての行で足すので、事前重み 0 があると無限大になります。
  二項分布の AIC は R の `round` と同じく m y を偶数への丸めで整数にします。
- **`glmAnova`:** 逐次表の再当てはめは当てはめと同じ `start` を使うので、小さいモデルでは長さが合わず
  エラーになります (R と同じです)。既定の検定は、分散パラメータが既知なら `"Chisq"`、そうでなければ
  `"F"` です (R 4.4.0 以降)。

### 線形代数

- **`qr` の既定のピボット選択:** 列を左から右へ処理します。残りのノルムが元のノルム × tol より小さい
  列 (元のノルムが 0 なら常に) は右端へ移し、移した列も順番が来れば変換します。
  rank = min(列数 − 移した列数, 行数)。
- **`qrFitted`、`qrResid`:** k = 0 では y をそのまま返します。1 行の行列の残差は 0 です。
- **`qrX`:** `ncol` の既定値は min(行数, 列数) です。ピボットで列が入れ替わっている場合、列数より
  小さい `ncol` はエラーです。
- **`qrSolve`:** rank = min(行数, 列数) でなければエラーです。横長の行列では使わない係数は 0 です。
  `b` を省略できるのは正方行列のときだけです。
- **`qr(x, { lapack: true })`:** `qraux` (tau) は R と同じく反射ごとに 1 つ、min(行数, 列数) 個です。rank は
  常に min(行数, 列数) で、`qrFitted` と `qrResid` は例外を投げます。NaN や Inf を含む行列も拒否
  しません (R も意味のない値を返します。値が R と一致する必要はありません)。
- **`kappa`:** 既定 (`exact: false`) では、QR 分解の R (横長の行列は転置した後) に LINPACK の
  `dtrco` の推定を適用します。`norm: "I"` では、R と同じく転置行列の同じ三角部分を使います。
  `triangular` は `method: "direct"` のときだけ効き、そのときも `dtrco` を使います。特異行列の正確な
  `kappa` は Inf です。
- **`norm`:** `type` は 1 文字でなければなりません ("One" はエラー)。`type: "2"` は、行列が NaN を
  含めば NaN を返し、Inf を含めば例外を投げます。
- **`eigen`:** sum|A − Aᵀ| / sum|A| ≤ 100ε のとき行列を対称とみなし (`isSymmetric` と同じ)、その場合は
  下三角だけを使います。一般行列では固有値を絶対値の大きい順に返し、同じ値は元の順序を保ちます
  (共役のうち虚部が正のものが先)。

### 特殊関数

既定では R と同じ値を返し、`{ rCompatible: false }` を渡すと
数学的な値を返します。

- **`choose` と `lchoose` で整数に近い n:** R は整数から 1e-9 max(1, |n|) 以内の n をその整数と
  みなします。そのため `choose(1e-10, 2)` は 0 (数学的には -4.9999999995e-11)、
  `choose(5 + 1e-9, 2)` は 10 です。k < 30 の `choose` は積には元の n を使い、結果を丸めます。
  k ≥ 30 の `choose` と k ≥ 2 の `lchoose` は n そのものを丸め、n < 0 では k − 1 − n で判定します
  (許容幅はそれに対する相対値)。`lchoose(n, 1)` は丸めずに log|n| を返します。
- **無限大の引数:** `choose(±Inf, k)` は k ≥ 30 で NaN (それ未満は ±Inf)、`lchoose(±Inf, k)` は
  k ≥ 2 で NaN です。`choose(n, Inf)` は有限の n ≥ 0 で 0、`lchoose(n, Inf)` は -Inf、それ以外は
  NaN です。`rCompatible: false` では、`choose(±Inf, k)` はどの k でも ±Inf、`choose(n, Inf)` は
  NaN です。
- **`trigamma(-Inf)` と `psigamma(-Inf, deriv)`:** R は -Inf を極と同じに扱い、deriv が奇数なら
  Inf、偶数なら NaN を返します (`rCompatible: false` では常に NaN)。
- `choose` の k と `psigamma` の deriv は偶数への丸めです (`psigamma(x, 2.5)` は `psigamma(x, 2)`)。

### 数値計算

- **関数は数を受け取る普通の JS の関数** (`integrate`・`optimize`・`uniroot`)、または配列を受け取る
  関数 (`grad`・`jacobian`・`hessian`) です。R の `...` にあたる追加の引数はクロージャで渡します。
  `ode` の `func(t, y, parms)` は導関数を配列で返し (deSolve の `list(dy)`)、結果は行 `[t, y1, y2, ...]`
  の配列です。
- **関数の値が R と同じなら、結果も末尾のビットまで R と一致します。** R と JS で関数の値が末尾の
  ビットで違うとき (R の `sum` は long double で足す。`exp`・`log`・`sin`・`cos` は別のライブラリ)、
  `integrate` の誤差の見積もりは数 % まで、平らな最適点は 1e-14 程度、数値微分は相対 1e-9 まで
  動きます (差分商は関数の丸めを |f| / h 倍にする)。
- **`uniroot`** は区間を広げなかったとき `initIt` を NaN (R の NA) で返し、`maxiter` に達しても
  警告しません (そのとき `iter` は R と同じく `maxiter`)。

## 未対応

- 分布パラメータのリサイクル (`rnorm(3, mean = c(0, 10, 100))`)。
- R の既定以外の RNG の種類。
- Fisher の `hybrid` と `workspace`、Wilcoxon の `digits.rank`。Kendall の一致ペアの数え上げは O(n²) です。
- `kappa` の `inv_z`、複素行列、`EISPACK = TRUE` / `LINPACK = TRUE`。
- `glm` の formula (説明変数は行列で渡します。[ROADMAP.ja.md](../../ROADMAP.ja.md) を参照してください)。
- `lmer`: lme4 2.0 の共分散の構造 (`diag()`・`cs()`・`ar1()` の項)、`weights`、`offset`、`subset`、`na.action`
  (欠測値のある行は常に除きます)、`start`、`control`。lmerTest の p 値と当てはめの `anova`、`predict`、
  `simulate`、`confint`、`profile`。`glmer` と `nlmer` ([ROADMAP.ja.md](../../ROADMAP.ja.md) を参照してください)。
- numDeriv の複素数ステップ法 (`method = "complex"`。複素数の引数を受け取る関数が要る) と、`grad`・
  `jacobian` の `side` 引数。
- deSolve の適応刻みの解法 (`lsoda`、`ode45` など)。`ode` は固定刻みの `euler`・`rk2`・`rk4` です。
- `coxph`: 計数過程のデータ (`Surv(start, stop, event)`)、`ties = "exact"`、オフセット、クラスターと頑健分散、
  `tt()` の項、残差、concordance。
- `omega`: minres 以外の因子抽出法、oblimin 以外の回転、`n.iter` (ブートストラップの区間)、`poly = TRUE`。
