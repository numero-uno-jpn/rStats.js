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
| `pt(1, 1e-300, ncp = 1e4)` | 0 | 3.3623538933995988e-298 (mpmath) | 3.362353893399793e-298 |
| `pt(1, 10, ncp = 1e9, log.p = TRUE)` | -4.7619047526190466e17 | -4.5454545454545440e17 (Rmpfr) | 真値と同じ |
| `dt(1, 10, ncp = 1e9, log = TRUE)` | -Inf | -4.5454545454545436e17 (Rmpfr) | 真値と同じ |
| `qt(1e-300, 1e-300, ncp = 1e4)` | 18961.503816218225 | 2.4637413705646497e-146 (mpmath) | 2.463741370564455e-146 |
| `qt(1e-300, 1e-100, ncp = 1e4)` | 1.8961503816217974e104 | 3.3196830107614348e-48 (mpmath) | 3.3196830107614347e-48 |
| `qt(-1419.5258582683982, 2, ncp = 0.5, lower.tail = FALSE, log.p = TRUE)` | Inf | 1.7976931348623157e308 (P[T > t] = c/t²、c = (1 + δ²) Φ(δ) + δ φ(δ)) | 1.7976931348622732e308 |
| `dchisq(1e4, 5, ncp = 10, log = TRUE)` | -2975.1 | -4688.08 | 真値と同じ |
| `dchisq(1e-300, 0, ncp = 1)`、`dchisq(1.5e-323, 0, ncp = 1)` | 0 | 0.1516 | 真値と同じ |
| `dchisq(1.5e-323, 2e-323, ncp = 1)` (x と df がサブノーマル) | 0.6065306597126334 | 0.55598643806991397 (Rmpfr) | 0.5559864380699139 |
| `df(1e10, 5, Inf, ncp = 0, log = TRUE)` | -1.25e11 | -2.5e10 | 真値と同じ |
| `qchisq(-1e10, 5, ncp = 1, lower.tail = FALSE, log.p = TRUE)` | 2.29e10 | 2.00e10 (分布関数で確認) | 真値と同じ |
| `dbeta(1.05e-231, 0.194, 141.1, ncp = 1.39e-303)` (極小の ncp での非心密度) | 9.3999238814454927e185 | 9.399923881445698e185 (mpmath) | 真値と同じ (中心分布の密度) |
| `df(2.86e-257, 0.0275, 3, ncp = 5e-324)` | 1.3617011778446392e251 | 1.3617011778446561e251 (mpmath) | 1.3617011778446567e251 (中心分布の密度) |
| `df(1e100, 1e-200, 1e200, ncp = 1, log = TRUE)` (df1/df2 がアンダーフロー) | Inf | -462.40331295992905 (χ² 極限、R の dchisq) | 真値と同じ |
| `pf(1e290, 1, 1e290, ncp = 1, lower.tail = FALSE, log.p = TRUE)`、`df(..., log = TRUE)` (1e290 を超える m q が n と同じ規模) | -Inf、NaN | -3.4657359027997265e289 (主要項 −n log(2)/2。中心 F の値) | -3.4657359027997267e289、同じ |
| `df(5e299, 2, 1e308, ncp = 1e300)` (巨大な df2 と巨大な非心度。issue #202) | NaN | 約 3.98942279e-151 (非心 χ² の極限 1e-150 / sqrt(2π) から、χ²_df2/df2 のばらつきによる相対 2.5e-9 を引いた値) | 3.9894228040144464e-151 (非心 χ² の極限。pf が極限を使う条件で使う。修正前は 0) |
| `qf(1.89e-13, 0.0885, 6.01e302)` | 4.6113445353195029e-287 | 4.6113445353197333e-287 (mpmath、χ² 極限) | 4.611344535319733e-287 |
| `pbeta(0.973, 0.130, 8.15e-322, log.p = TRUE)` | -736.93128475074695 | -736.93155014878607 (mpmath) | 真値と同じ |
| `dchisq(1.005e-308, 294.4, ncp = 2.91e304, log = TRUE)` | -1.0243631212370614e307 | -1.4537765239560228e304 (−λ/2。残りは 1e5 程度) | 真値と同じ |
| `dnorm(-1.59e-321, sd = 3e-323)` | 0 | 5.2576630112522621e-304 (mpmath) | 5.257663011252932e-304 (対数密度と同じく x / sd を丸めたときの真値どおり) |
| `dcauchy(-2.16543841389836e-309, scale = 1.57817263326e-312)` | 1.0713040120126725e305 | 1.0713040120123239e305 (mpmath) | 真値と同じ |
| `dcauchy(1e-10, scale = 5e-324)` | 0 | 1.5726597949504821e-304 (mpmath) | 真値と同じ |
| `log(dlogis(-3.5667197e-316, scale = 4.81926e-319))` | -7.1442431635500565 | -7.1442419008923714 (mpmath) | 真値と同じ |
| `dnbinom(57, 3.941094207e-315, 0.1246, log = TRUE)` | -735.57086040999684 | -735.57086038617797 (mpmath) | 真値と同じ |
| `dnbinom(1, 1e-200, mu = 1e200, log = TRUE)` (size / (size + mu) が double の範囲より下) | -Inf | -460.51701859880914 (Rmpfr) | 真値と同じ |
| 形状と尺度の差が 2^-20 以内の `dweibull(x, shape, scale, log = TRUE)` (`dweibull(2^52 - 0.5, 2^52, 2^52 - 0.5, log = TRUE)`) | log(shape/scale) が比の丸めを受ける: -0.99999999999999978 | -0.99999999999999989 (厳密な差の log1p) | 真値と同じ |
| `pnbinom(0, 5e-324, mu = 1.797693e308)` と `qnbinom(0.5, ...)` (size / (size + mu) が double の範囲より下) | 0 と NaN | 1 と 0 (比の正確な log からの不完全ベータ関数) | 真値と同じ |
| `qexp(-720.6156070081367, 7.378938265185878e-258, log.p = TRUE)` | 1.4880736486358194e-56 | 1.4880736486357560e-56 (mpmath) | 1.4880736486357558e-56 |
| `qweibull(-720.6156070081367, 1, 1.3552e257, log.p = TRUE)` | 1.4880642941554512e-56 | 1.4880642941553880e-56 (mpmath) | 真値と同じ |

### 特殊関数

これらの比較に使う値は Rmpfr ではなく mpmath (100〜800 桁) で計算しています。

- **`choose` と `lchoose`**: n が整数でなく k が大きいとき、R は最大 2.6e-10 ずれます
  (`choose(10.3, 1e5)`)。
- **`choose`**: k が小さく値がオーバーフローに近いとき、R は n に (n - 1)/2 などを掛けていき、1 段に 2 回丸めます。
  `choose(1.5e154, 2)` は R で 1.125e308 で、真値から 0.91 ulp ずれます。rStats.js は double-double の積で
  1.1250000000000002e308 (0.09 ulp) を返します (途中で溢れる場合は n / 2^s の座標で積を取る)。
- **`factorial`**: オーバーフローの近くで、R の `factorial(170)` は 1.2e-13 ずれます。
- **`dmultinom`**: 度数が大きいと、R は `lgamma` の値を足し合わせるので桁を失います (度数 1e9 で
  相対 2.8e-6。rStats.js は二項確率を掛け合わせます)。
- **`digamma`、`trigamma`、`psigamma`**: 絶対値の大きい負の x (`trigamma(-100000.25)` は 1.2e-11
  ずれる)、digamma の正の零点の近く、非常に大きい x (`trigamma(1e300)` は 2.4e-14 ずれる)。
- **ベッセル関数**: x や次数が大きいと、R は多くの点で 1e-13〜1e-11 ずれ、大きく外れる点もあります
  (次の節)。

### 和

- **`sum`** で、値が 3 つ以上の桁の帯に分かれ、あとで打ち消し合う場合: R の long double は 64 ビット、
  rStats.js の double-double は 106 ビットを保つので、ほかよりずっと小さい帯は丸めで消えます。
  `sum(c(1e308, 1e100, 1, -1e308, -1e100))` は R で -1e100、`sum(c(1e20, 1e3, 1e-10, -1e20, -1e3))` は -1000 で、
  厳密な値は 1 と 1e-10 です。rStats.js は double-double が失った量の上界を数え、それが丸めた結果を変えうるときだけ
  和を厳密に (BigInt で) 作って 1 回で丸めます: 1 と 1e-10 (issue #374)。それ以外の和は変わりません。

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
| `fisher.test` (2 x 2) と `mantelhaen.test(exact = TRUE)` の条件付き最尤推定値と信頼限界 | psi の [0, 1] か 1/psi の [eps, 1] で、絶対許容誤差 eps^0.25 の uniroot を使う。[[3, 1], [1, 3]] では推定値が 1.7e-6、95% の限界が 1.3e-5 と 0.7% (626.24 が 621.93)、99% の上限が 6% ずれ、99.99% の限界は区間の端 1/eps (3.2e5 が 4.5e15) | psi の対数の座標で、double の精度まで根を求める (限界で片側確率が alpha、推定値で平均が度数に一致する) |
| logit リンクで \|eta\| が 30 を超える `glm` | C コードが逆リンクと微分を eps の値でクリップする (30 で 1 − 9.4e-14、すぐ先で 1 − 2.2e-16 に跳ぶ)。x = 1、2 で度数 (1e15, 1)、(1, 2) の binomial は deviance 2139 で止まり、収束しない (解は eta = log 1e15) | 30 の先も厳密な値。1 未満の最大の double と最小の double で止める。deviance 0.013 (1 − y = 1/(1e15 + 1) の表現で決まる)。30 以内は R と同じ |
| rate × q が非正規化数の `pexp(q, rate, log.p = TRUE)` (`pexp(1e-20, 1e-300, log.p = TRUE)`) | 非正規化数に丸めた積の対数: -736.8272408909739 (1.1e-5 ずれる) | log rate + log q: -736.8272297580946 |
| 端の値での probit・cauchit・cloglog・power リンクの `glm` | `make.link` が eta (または mu) を eps の値で、微分を eps でクリップする。Phi(−10) = 7.6e-24、1 − exp(−e^-40) = 4.2e-18、平均 1e-16 (power 0.5) が 2.2e-16 に、−1e9 での cauchit の微分 3.2e-19 も 2.2e-16 になる | 厳密な値。最小の double と 1 未満の最大の double で (0, 1) に収める。R の範囲内は R と同じ |
| 小さな平均での cloglog リンク `log(-log(1 - mu))` | 1 − mu が 1 に丸まり、mu = 1e-20 で −Inf (`glm` は "NA/NaN/Inf in 'y'" で止まる) | `log(-log1p(-mu))` で有限 |
| 1/lambda が範囲外の power リンクの微分 (`power(5e-324)$mu.eta(0.5)`、`power(.Machine$double.xmax)$mu.eta(5e-324)`) | NaN (Inf × 0) と Inf (eta^-1 が溢れる) | 最小の double (微分は double の範囲より小さい) と 1.1258999068426242e15 (eta^(1/lambda)/(lambda eta)) |
| (y − mu)² か y mu² が範囲外のときの逆ガウス分布の deviance の寄与 (分散 `mu^3` の quasi も。`inverse.gaussian()$dev.resids(1e-308, 1e308, 1)`、`(0.5, 1e300, 1)`、`(1e-200, 2e-200, 1)`) | NaN か Inf | ((y − mu)/mu)²/y: 1e308、2、2.5e199 |
| 平均から 10% より離れたところで y/mu、y log(y/mu)、重みとの積が double の範囲を出るときの poisson の deviance の寄与 (quasipoisson と分散 `mu` の quasi も。`poisson()$dev.resids(1e308, 1e-308, 1e-320)`、`(1e308, 1e-10, 1e-10)`、`(3e-320, 1e-320, 1e308)`) | Inf | 2.83e-9、1.46e301、2.59e-12: y と mu を 2 の冪の単位で持ち、比が範囲外なら log(y/mu) を対数の差で作り、重みの指数を外に出す。それ以外は R の式とビット |
| 平均から 10% より離れたところで y/mu が溢れるかアンダーフローするか、2 w が溢れるときの Gamma の deviance の寄与 (分散 `mu^2` の quasi も。`Gamma()$dev.resids(1e308, 1e-308, 1e-320)`、`(1e-308, 1e300, 1e-300)`、`(5, 2, 1e308)`) | NaN、Inf、Inf | 2e296、2.8e-297、1.17e308: r = y/mu を仮数と 2 の冪で持って 2 w (r - 1 - log r) とし、重みの指数を外に出す。それ以外は R の式とビット |
| 平均が極小か、重みが double の最大の半分を超えるときの、平均に近いところの binomial の deviance の寄与 (quasibinomial と分散 `mu(1-mu)` の quasi も。y が 1e-300 の 1 ulp 上の `binomial()$dev.resids(y, 1e-300, 1e308)`、`(0.3, 0.3003, 1e308)`) | Inf (直接の式。この修正の前の rStats.js は NaN と Inf) | 2.748e-24、4.284e301: deviance か 2 w 倍が double の範囲を出るときだけ、y と mu を 2 の冪の単位にした bd0 で作り、重みの指数を外に出す。それ以外は以前と同じ |
| 平均が極小か、重みが double の最大の半分を超えるときの、平均に近いところの poisson の deviance の寄与 (quasipoisson と分散 `mu` の quasi も。y が 1e-300 の 1 ulp 上の `poisson()$dev.resids(y, 1e-300, 1e308)`、`(5.1, 5, 1e308)`) | 1.1e-8 (直接の式が桁落ち) と Inf (この修正の前の rStats.js は NaN と Inf) | 2.748e-24、1.987e305: 2 w bd0(y, mu) が double の範囲を出るか bd0 がサブノーマルのときだけ、y と mu を 2 の冪の単位にした bd0 で作り、重みの指数を外に出す。それ以外は以前と同じ |
| `summary.glm`、`predict.glm` に正規化数の範囲より小さい dispersion を与えたとき (x = 0:3 で `summary(glm(y ~ x), dispersion = 2^-1074)`) | 標準誤差 2^-537 と 0 (丸めたサブノーマルの積 0.7 × 2^-1074、0.2 × 2^-1074 の平方根。`predict(se.fit = TRUE)` は 0) | sqrt(0.7) 2^-537 と sqrt(0.2) 2^-537: 当てはめの単位での値 (rStats.js は gaussian の応答を 2 の冪で割って当てはめる) が範囲外のときだけ dispersion を m 4^s (m は [1, 4)) で持ち、2 の冪を結果に掛ける。1e308 の応答 (R は当てはめられない) で dispersion 1 を与えた場合もこれで保たれる |
| y = mu の近くの binomial・poisson・Gamma の deviance の寄与 (quasibinomial・quasipoisson と分散 `mu(1-mu)`・`mu`・`mu^2` の quasi も): `binomial()$dev.resids(0.5, 0.5 + 2^-52, 1)`、`poisson()$dev.resids(1, 1 + 2^-52, 1)`、`Gamma()$dev.resids(1, 1 + 2^-52, 1)`、(1000, 1001)、(0.3, 0.3003) | 1 次の項が打ち消し合い、t = (y - mu)/mu として相対約 2 eps / abs(t) ずれる: -9.86e-32、0、9.86e-32 (真値 1.97e-31、4.93e-32、4.93e-32)。t = 1e-3 で 6.8e-11・9.0e-11 のずれ | abs(y - mu) < 0.1 mu (binomial は 0.1 min(mu, 1 - mu)) のときだけ 2 bd0(y, mu)、2 (bd0(y, mu) + bd0(1 - y, 1 - mu))、-2 log1pmx(t) で計算する (R の dpois_raw・dbinom_raw が bd0 に切り替える条件と同じ形)。真値との差は数 ulp。10% の外は R の式・ビットのまま。完全な当てはまりに近い当てはめの deviance と deviance 残差は末尾の桁が変わり (glm の fixture では 69 件の 512 値、ほとんど相対 1e-15〜1e-10)、完全な当てはまりの丸めの残りが負にならない |
| 平均が小さいときの y = 0 の binomial の deviance の寄与 (quasibinomial と分散 `mu(1-mu)` の quasi も): `binomial()$dev.resids(0, 1e-20, 1)` | 1 − mu を丸めてから -2 log(1 − mu): mu が 1.1e-16 未満で 0 (真値 2e-20)、それより上でも相対約 eps/(2 mu) ずれる | mu < 0.1 のときだけ -2 log1p(−mu): 2e-20。mu ≥ 0.1 は R の式・ビットのまま。glm の fixture では 31 件の deviance 残差が変わり (ほとんど末尾の桁)、分離した 2 件の当てはめの deviance (約 2e-10) は相対 6e-7 変わる |
| 重み 0 の行がある gaussian `glm` の `AIC` | Inf。family の `aic` がその行の重みの log(0) を取り、n にも数える | その行は尤度に入れない (すべての family)。その行を除いた当てはめの AIC と同じ (重み 1, 1, 1, 0 で 5.84) |
| 残差自由度のない `residuals(glm, "deviance")` | すべての行で 0。収束していない当てはめでも 0 (deviance 0.34 で残差 0) | 各行の寄与から計算する。二乗和が deviance になる (収束した飽和モデルでは丸めの残り) |
| log リンクで eta < −36 の `glm` | `pmax(exp(eta), eps)`。平均 e^-100 が 2.2e-16 になる | 最小の double まで exp(eta) |
| 分離したデータの `glm` (x = 1..6 で y = 0, 0, 0, 1, 1, 1 の binomial、度数 0 を含む飽和 Poisson) | 収束と報告し、係数 (−165, 47) は反復が止まった位置にすぎない。警告はせいぜい "fitted probabilities numerically 0 or 1 occurred" | `converged` は同じ。警告 "the linear predictor was still changing at convergence: the data may be separated (no finite maximum likelihood estimates)" を付ける (最後のステップで eta が 0.1 より大きく動いた)。厳密な logit リンクでは係数はさらに先まで進む |
| Cholesky 分解で落とされる、ほぼ共線な列 (x2 = x1 + 1e-6 e) のある `coxph` | survival の cholesky2 がその列の残差の積を残し、chsolve2 と chinv2 がそれを使う。係数と分散が、その列を除いた当てはめと 4e-12 ずれる | 落とした列を 0 にする。その列を除いた当てはめとビット一致 |
| `optim(method = "CG")` | cgmin は放物線を作る前に始点の値を受け入れた値で上書きするので、試す点がいつも受け入れたステップの中点になる (3 変数の二次関数で関数の評価 46 回、値 5.6e-14。(-1.2, 1) からの Rosenbrock は maxit 100 で値 3.1) | 始点と受け入れた点を通る放物線の最小点を試す (評価 8 回、値 1.8e-25。Rosenbrock は 5.3e-8)。経路は R と違う |
| IRLS のステップで deviance が増える `glm` (すべての重みが 1000 の binomial の `y ~ x`) | `glm.fit` はそのステップを受け入れる。deviance は 7564、89255、144175 と進んでそこで止まり、係数 1e15 で「収束」(最大は 4956) | deviance が相対 epsilon (既定 1e-8) 以上増えるあいだステップを半分にする (glm2 の規則)。重み 1 と同じ最大に届く。警告 "step size truncated due to increasing deviance" |
| 同順位の p 値がある dunn.test の段階的な調整 (`holm`、`hs`、`hochberg`、`bh`、`by`) | 同順位を比較の順に順位付けし、同じ p 値に違う調整値が付く (`holm` で 1、0.828、0.414)。群のラベルを付け替えると変わる | 同順位の組には、停止規則が判定に使う組の最初の順位を付ける。並び順によらず同じ値で、判定は同じ。同順位がなければ dunn.test と同じ |
| 同順位のある clinfun の `jonckheere.test` と DescTools の `JonckheereTerpstraTest` (正規近似) | 同順位のない帰無分散 (sum n_i m_i (n_i + m_i + 1) / 12) を使い、大きすぎる。3 群の c(1, 1, 2, 2, 3, 3) で p = 0.0086 | 同順位を入れた並べ替え分布の分散 (Hollander & Wolfe)。p = 0.0061。同順位がなければパッケージと同じ |
| clinfun の `jonckheere.test` と DescTools の `JonckheereTerpstraTest` の正規近似で、統計量が大きい正の値 | 上側を 1 - pnorm(z) で求め、z が約 8.3 を超えると 0 (1:101 を 34、34、33 の順に並んだ群に分けると increasing と両側で p 0) | 1 - pnorm(z) が 1e-8 未満のときだけ上側を pnorm(z, lower.tail = FALSE) で直接求める。1.4902389037944e-26 (Rmpfr 1.4902389037944002e-26)。1e-8 以上ではパッケージと同じ値 (#280) |
| `oneway.test` (Welch、既定) で定数の群が 1 つ | 重み n / 0 が無限で、すべて NaN ([1, 1, 1] と [2, 3, 4] の `oneway.test`) | その群の分散を 0 に近づけた極限。F = (ほかの群の w_i (m_i - m_z)^2 の和) / ((k - 1)(1 + 2 (k - 2) c))、c = ほかの群の 1 / (n_i - 1) の和 / (k^2 - 1)、df2 = 1 / (3 c)。F 12、自由度 (1, 2)、p 0.0742 で、同じデータの `t.test` (Welch) と同じ。定数の群が 2 つ以上では極限が分散の近づき方で変わるので、エラー "Welch's test is not defined with two or more constant groups" (R は NaN) (#313) |
| 不一致の 2 セルの差が 1 未満の小数の度数での `mcnemar.test` (2 x 2、連続性補正) | (abs(b - c) - 1)^2 / (b + c) で負の補正後の差を二乗するので、補正で統計量が大きくなる。b = 0.5、c = 0.2 で 0.7 (補正なしは 0.129)、b = 1.5、c = 1 で 0.1 (補正なしと同じ) | 補正後の差を max(0, abs(b - c) - 1) とする。そこでは統計量 0、p 1 (R の `chisq.test` と `prop.test` も補正を同じように止めている)。整数の度数では変わらない |
| 総和に比べて小さい周辺度数がある分割表の `chisq.test(x)$stdres` | E (1 - r / n)(1 - c / n) を倍精度で計算し、小さい周辺度数を落とす。[[2^52, 0], [0, 0.1]] で NaN、-Inf、-Inf、2^26 (正しくは 4 セルとも絶対値 2^26)。[[1e15, 7], [3, 11]] のような整数の表でも相対 2e-14 誤る | 補数 1 - r / n、1 - c / n をほかの行・列の和 / n とし、O - E と分散を倍精度 2 倍長で計算して最後に 1 回丸める。4 セルとも 2^26、2 つ目の例は 21912524.504463962 (真の値を丸めたもの)。通常の表でも R と末尾のビットが違うことがある (#382) |
| 被験者と評価者の効果が交互作用よりずっと大きいときの irr の `icc` (two-way) | 残差の平均平方を全体・被験者・評価者の平方和の引き算で求め、桁が落ちる。効果 1e8、交互作用 ±1 で ICC 1、F Inf、区間 NaN (真の MSE は 3/2) | その引き算の結果が全体の平方和の 2^-20 未満 (0 以下を含む) のときだけ、残差 x - 行平均 - 列平均 + 総平均 の平方和を倍精度 2 倍長で計算する。ICC 0.9999999999999999、F 2e16。それ以外は以前と同じビット (#392) |
| 尺度が大きく違う群 (ある群の散らばりが最大の値の 2^-1022 倍未満) での `oneway.test` (Welch)、`var.test`、car の `leveneTest` | [1e200, 2e200]、[0, 1e-100]、[5, 7] の `oneway.test` は NaN (1 群目の分散が溢れる)。`var.test(c(1e308, 1e308), c(0, 1e-100))` は F Inf、p 0 (1 群目の var が Inf)。[1e308, 1e308] と [0, 1e-100] の `leveneTest` は F 6.2e31、p 1.6e-32 | 共通の座標で分散 (や偏差) が正規化数の範囲を下回るときだけ、各群を自分の座標で計算する (`bartlettTest` の #270 と同じ)。F 15、df2 4/3。比 0、F 0、p 0。F Inf、p 0 (偏差が 0 なのは片方の群だけ)。それ以外は以前と同じビット (#393) |
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
| `contr.poly(k)` (rStats.js では lmer の `contrasts: "contr.poly"`) | 得点のべき乗の QR で作る。要素が k <= 15 で最大 3e-13、k = 16 で 1.3e-12、k = 20 で 6e-11 ずれ、k = 23 からは高次の列がまったく別のベクトル (誤差 0.9。k = 24 では QR の数値的なランクが 22) | すべての k で、3 項漸化式と全体の再直交化で作る直交多項式。厳密な値との差は 6e-16 以内 (k = 2〜26)。そのため水準が少なくても最終桁は R と違う |
| 非心分布を使う検出力の計算 (`power.t.test`、`power.anova.test`、`pwr.*`) | R の非心 t は 1e-12 程度、非心 F は 1e-9 程度の精度 (自由度 4e5 を超える t は近似式) なので、検出力とそこから解いた標本サイズが最大 3e-8 ずれる | 正確な非心分布。解く量は R と同じ `uniroot` の呼び出し (同じ区間と許容) なので、R の許容の精度のまま |
| effectsize の信頼区間 (`cohens_d`、`hedges_g`、`eta_squared` など) | 非心度を Nelder-Mead (`optim`) で探すので、限界が 1e-9 程度、最大で相対 3e-3 ずれる (偏 η² の上限が 0.25111 でなく 0.25181) | 厳密な限界 |
| Dunnett 型の p 値 (multcomp の Dunnett、PMCMRplus の `dunnettTest` と single-step の `kwManyOneDunnTest`・`manyOneUTest`) | mvtnorm の乱数を使う積分で、絶対 1e-3 程度。実行ごとに変わる (種で固定) | 1 次元積分で厳密に |
| 多重比較 (Steel-Dwass、Games-Howell、Tukey) のステューデント化範囲の p 値 | R の `ptukey` は 8 桁程度 (テストで最大 3.4e-8 ずれる) | 完全な精度 |
| irr の κ の p 値 | 2 (1 − Φ(|z|)) で作るので、小さい値が桁落ちする (1.7e-16 でなく 2.2e-16) | 2 Φ(−|z|) |
| polycor の最尤推定と標準誤差 (`ML = TRUE`、`std.err = TRUE`) | Nelder-Mead や BFGS が早めに止まり、ヘッセ行列は差分で求める: 相対で最大 1e-3 ずれる。関連の強い表では 2 段階推定の BFGS が 1 を越え、0.9999 と無限大の分散を返す | 尤度の厳密な最大値 (160 ビットの値と 4e-15 以内) と解析的なヘッセ行列 |
| psych の `omega` (minres) で独自因子分散が下限 0.005 に張り付く場合 (Heywood) | `fa` は L-BFGS-B に、非対角の目的関数ではなく、対角を含めた残差の二乗和の勾配を渡す。2 つの最小は内点では一致するが下限では一致せず、最小より高い点で、多くは convergence 0 で止まる (テストの例では 0.5%〜3.4% 高く、独自因子分散は最大 0.05 ずれる) | その点から目的関数そのものの勾配で L-BFGS-B を続け (factr 1e3)、最小に届く。下限に張り付かなければ psych と同じビット |
| nortest の `pearson.test` で、`pnorm` が 1 に丸まる値 (平均より約 8.3 sd 以上大きい外れ値) がある場合 | その値は k + 1 番目の区間になり、`tabulate` が捨てる。計数の合計が n より小さくなる (0 が 99 個と 1e6 で 1176.13) | 最後の区間に数える: 1174.26 |

### R にない分布

R 側の参照は extraDistr (invgamma・kumar・pareto・triang・laplace)、R のベータ分布の関数 (arcsine)、R で書いた
閉じた形 (`distSummary`) です。rStats.js の値は mpmath の 50 桁の値と一致します (`scripts/mpmath/extradist.py`、
`scripts/mpmath/distsummary.py`)。

| ケース | R | rStats.js |
|---|---|---|
| `pinvgamma`・`pkumar`・`ppareto`・`plaplace`・`ptriang` の裾 | extraDistr は教科書の式をそのまま計算するので、1 − x^a や 1 − p が桁落ちし、確率がアンダーフローしてから対数を取る (`pkumar(1e-10, 1, 1)` が 8e-8 ずれ、`pinvgamma(1e-300, 1, 1, log.p = TRUE)` が −1e300 でなく −Inf) | 裾を直接計算 |
| 非正規化数の shape と同じ程度の裾の対数 (`pkumar(0.2015, 0.4224, 1.85e-317, log.p = TRUE)`、`ppareto(318.7, 1.04e-317, 1, log.p = TRUE)`) | −Inf | −729.6448082452898、−728.127870954796 (mpmath: −729.64480824528978、−728.12787095479600) |
| `dkumar(0.2015, 0.4224, 1.85e-317, log = TRUE)` | −728.528830589584 (1.2e-10 ずれ) | −728.5288305013036 (mpmath: −728.52883050130359) |
| `qkumar(-744.2443613428673, 1.1349, 0.1241, log.p = TRUE)` (log p が正規数の範囲より下) | 0 | 1.0076418889538287e-284 (mpmath: 1.0076418889538287057e-284) |
| `ptriang(3.0662e-190, 0, 1.2412e133, 5.581e132, log.p = TRUE)` (長さの比が非正規化数) | −Inf | −1484.8619589788332 (mpmath: −1484.8619589788330) |
| 遠い裾の分位点 (`qlaplace`・`qkumar`・`qtriang` など) | 1 − p が丸まる: `qlaplace(1e-300, lower.tail = FALSE)` が Inf | 正しく丸めた値 (p に戻る) |
| 母数に対して急な密度 (alpha = 100 の `dinvgamma`、端に近い `dtriang`) | beta / x や b − x の丸めが拡大される (9e-14 まで) | 割り算を double-double で |
| `weibull` と `kumar` の `distSummary` の歪度・尖度 | 生のモーメントからの式が桁落ちする (shape 20 で尖度の 9 桁を失う) | 中心モーメントを直接積分 (3e-14) |
| 小さい引数の `erfinv` (pracma の定義 `qnorm((1 - |y|) / 2)` を通す形) | y の相対精度が失われる: `erfinv(1e-10)` が 8e-8 ずれ、`erfinv(1e-300)` が −0 | `erf` のニュートン法 |
| `gammainc` (R の `pgamma(x, a) * gamma(a)`) | 丸めが 2 回入り、積がオーバーフローすると大きな対数の exp になる (a = 200 で 1e-13) | x < a では `pow` を使った級数 |

## R が失敗し、rStats.js が値を返す場合

| ケース | R | rStats.js |
|---|---|---|
| `pbinom(36, 1e5, 0.01, log.p = TRUE)` | -Inf (内部でアンダーフロー、警告あり) | -851.68… |
| `pbinom(1e16, 2e16, 0.5)` (2^53 を超え、x + 1 が丸めで x になる) | 0.5 (対称な I_p(x, x)) | 0.5000000028209479 = 1/2 + dbinom/2 (I_p(x + 1, n - x) = I_p(x, n - x) - (n - x)/n dbinom(x)。n - x も丸めでずれる場合は NaN)。`ppois` もこの範囲で同じ恒等式を使う (R の値と一致) |
| `pnbinom(1e16, 1e16, 0.5)` (2^53 を超え、x + 1 が丸めでずれる) | 0.5 | 0.5000000028209479 = 1/2 + dnbinom (I_p(size, x + 1) = I_p(size, x) + dnbinom(x))。`qnbinom(0.5, 1e16, 0.5)` は R と同じく 1e16。極端な上側の裾で項が裾に対して分解できない場合は、丸めた x + 1 を使う (そこでは x の 1 の違いが結果の分解能より小さい) |
| `pgeom(2^54, 1e-14, lower.tail = FALSE)` (2^53 を超え、x + 1 が丸めでずれる) | 0x1.13bd80f2f26d7p-260 (丸めた x + 1 を指数にした q^(x + 1)) | 0x1.13bd80f2f26d2p-260 (q^x q。正しく丸めた値は ...d1p-260。issue #327) |
| `binom.test(0, 1e20)`、`poisson.test(0, r = 1e20)` (2^53 を超えるカウント) | エラー "result would be too long a vector" | p 値を返す (二分法は中点が端点に丸まったところで止める。以前は終わらなかった) |
| `poisson.test(2^53 + 2, r = 2^53 + 2, alternative = "greater")` (2^53 を超え、x - 1 が丸めでずれる) | 0.50000000980826 (P[X >= x] を丸めた x - 1 の ppois(x - 1, upper) で計算) | 0.50000000140118 = P[X > x] + dpois(x)。真値は 1 次で 1/2 + 1/(3 sqrt(2 pi x))。両側の p 値の上側の裾も同じ (issue #323) |
| `binom.test(2^53, 2^54, alternative = "greater")`、`binom.test(2^53 + 2, 2^54 + 4, alternative = "greater")` (2^53 を超え、x - 1 か n - (x - 1) が丸めでずれる) | 0.5、0.500000011889406 (丸めた引数の pbinom(x - 1, upper)) | 0.5000000029723516 = P[X > x] + dbinom(x) (真値 1/2 + dbinom(n/2)/2)。両側の p 値の上側の裾も同じ (issue #324) |
| `poisson.test(c(5, 5), T = c(1e308, 1e308))`、`T = c(1e-308, 1e-308)` | p 値 0 (p0 = r T1 / (r T1 + T2) = 0)、期待度数 NaN。率比 NaN | p 値 1、期待度数 5、率比 1 (和が溢れる・正規の範囲を下回るときは T2 / T1 の比で計算する) |
| `binom.test(5, 10, conf.level = 1 - 1e-16)` と `poisson.test` (alpha が 1e-8 未満) | 上限を 1 - alpha から求め、桁が落ちる (1 - 1e-16 では 1 と Inf) | 上限を上側確率 alpha そのものから求める (0.99981、52.549)。alpha が 1e-8 以上なら R と同じ |
| `var.test`、`prop.test`、`mantelhaen.test`、`t.test`、ICC、`cor.test`、一元配置の対比、lm の `confint`・`predict`、glm のプロファイル区間、`coxph`、`survfit` の区間も同じ (alpha が 1e-8 未満) | 1 - alpha や (1 + level) / 2 が 1 に丸まり、限界が 0・NaN・Inf | 上側確率 alpha を分位点関数に渡す |
| 度数が 1e150 前後の `mantelhaen.test` (度数の積が溢れる) | 統計量と p 値が NaN (分散で Inf / Inf) | その場合だけ比を先に作る。釣り合った表では統計量 0、p 値 1 |
| 度数が 1e103 前後以上の I x J x K の `mantelhaen.test` (t^2 (t - 1) と共分散の積が溢れる)。例: すべてのセルが 1e103 | エラー "NA/NaN/Inf in foreign function call" (共分散で 0 × Inf) | その場合だけ共分散の各要素を r_i (d - r_ii / t) (d - c_jj / t) c_j / (t - 1) で作り、層の合計や層をまたぐ和が溢れるときは全度数を 2 の冪で割る。釣り合った表では統計量 0、それ以外も厳密な計算と 1 ulp 以内 |
| 層の合計や層をまたぐ和が溢れる 2 x 2 x K の `mantelhaen.test` (1e308 前後の有限な度数) | エラー "missing value where TRUE/FALSE needed" (合計が Inf、差が NaN) | その場合だけ全度数を偶数乗の 2 の冪で割り、統計量はその冪で、対数オッズ比の標準偏差はその平方根で戻す。釣り合った表では統計量 0、推定値 1、それ以外も厳密な計算と数 ulp 以内 |
| D >= 1/2 で p 値が極小の `ks.test(x, "punif", exact = TRUE)` (D = 0.9、n = 20・50・99) | 0、8.9e-16、2.0e-15 (1 - P(D < d) で桁が落ちる) | 2.0e-20、2.0e-50、2.05e-99。d >= 1/2 では P(D >= d) = 2 P(D+ >= d) を正の項の和で求める |
| 有限なデータの範囲や偏差が溢れる `quade.test`・`fligner.test` (-1e308〜1e308 と -9e307〜9e307 の行) | どちらも Inf で同順位になり、尺度を変えると結果が変わる | その場合は共通の 2 の冪で割ってから計算し、どの尺度でも同じ結果 |
| `wilcox.test(c(1e308, 1.1e308, 1.2e308), mu = -1e308)` と 2 標本の `x - mu` (`mu` との差が溢れる有限なデータ) | 差がどれも Inf で同順位になり、正規近似で V = 6、p = 0.1489 (y = 1:3 に対して W = 9、p = 0.0636) | その場合だけ差を半分の単位 (x / 2 - mu / 2) で作り、真の差の順位を付ける。正確な p = 0.25 (W = 9 では 0.1) |
| 不一致の度数がない組を含む r x r 表の `mcnemar.test` | 統計量と p 値が NaN | その組の寄与を 0 にする (自由度は変えない) |
| `cor.test(c(1, 2), c(1, 2), method = "kendall", exact = FALSE)` (n = 2) | 統計量と p 値が NaN: 分散の 2 つ目の同順位の項が 0 / 0 (分母に n − 2 = 0) | z = 1、p = 0.3173: その項を 0 にする (同順位の組はどれも 2 個以下) |
| 二乗が溢れる `predict(glm, newdata, se.fit = TRUE)` (newdata 1e155) | se.fit が Inf | 最大の値で割ってからノルムを作る: 1.07e154 |
| x の列が 1 から遠い (x の 1e-200 倍や 1e200 倍) `summary(lm)`、`summary(glm)`、`confint(glm)` | 標準誤差が Inf か 0 ((R'R)^-1 が溢れるか 0 に落ちる)、t が 0 か Inf、p が 1 か 0。プロファイル区間も求まらない | 逆行列の前に R の列を 2 の冪で割る。t、p、区間は x そのものと同じ (尺度を戻さない共分散は、範囲外なら今まで通り Inf か 0) |
| 重み 1e308 か、重み 0 の行に無限大の応答がある `glm` (gaussian、切片あり) | null deviance が NaN (重みの和が溢れる、0 × Inf) | 5e306 と 4.67。重みを 2 の冪で割り、重み 0 の行を除く |
| 重み 0 の行に巨大な応答がある `anova(lm(...))` と car の `Anova`: `y = c(1, 2, 4, 3, 1e308)`、`x = 0:4`、重み 1, 1, 1, 1, 0 | `anova`: エラー "missing value where TRUE/FALSE needed"。`Anova`: すべて NaN | 最初の 4 行で当てはめた表 (Sum Sq 3.2 と 1.8、F 3.56)。応答の尺度を重みが正の行だけから決める (Issue #350) |
| 重みの和が double の最大を超える重み付き `lm` の car の `Anova` (タイプ II・III): `x = 0:4`、`y = c(1, 2, 1, 3, 1) * 1e-154` の `lm(y ~ x, weights = rep(1e308, 5))` | エラー "system is computationally singular: reciprocal condition number = 0" | Sum Sq 0.1 と 3.1、F 0.0968、p 0.776 (`anova` と同じ)。重みの和が溢れるときだけ、重みを偶数の 2 の冪で割る (Issue #347) |
| `x = 0:3`、`y = c(0, 1, 2, 4)` の `summary(lm(y ~ x, weights = c(1e308, 1e308, 1e308, 2^-1074)))` (重み付き残差平方和がサブノーマルの範囲) | sigma 0 (rss / df = 2^-1075 が 0 に丸まる)、標準誤差 0、R^2 と F は NaN | sigma 2^-537.5 = 1.57e-162、R^2 1、F Inf、標準誤差もこの sigma から。共通の尺度で正の重みがアンダーフローするときだけ、元の重みで 2 の冪を単位にして rss を作る (Issue #388。残差の自由度 1 では R と同じ 2^-537) |
| 応答がふつうのデータの 1e200 倍 (や 1e-200 倍) の `lmer` | lme4 は固定効果は正しいが sigma が Inf (罰則つき二乗和が溢れる) | 当てはめでは応答を 2 の冪で割る。theta はもとのデータと同じ。固定効果・sigma・分散成分・ランダム効果・残差は倍率を戻し、対数尤度は −(n または n − p) log c だけずれる |
| x の単位が違う `lmer(y ~ x + (x \| g))` (x の 3e5 倍、1e6 倍、1e-5 倍) | lme4 は別の点に止まり、収束の警告を出す (Issue #11 のデータで REML 基準 101、正しくは 65.9。`autoscale = TRUE` を勧める) | theta の最適化を、Z の列を 2 の冪で割って行い、theta を戻す。x の単位によらず同じ当てはめ |
| 応答の単位が違う (1e6 倍や 1e-6 倍) lmerTest の Satterthwaite の自由度 | 1e6 倍で x の自由度が 31 から 7.4e8 (1e-6 倍で 0.19) になり、固有値の警告が出る。(theta, sigma) のヘッセ行列を絶対値 1e-8 で切るため | 尺度をそろえた座標 (theta は Z の列で、sigma は推定値に近い 2 の冪で割る) でヘッセ行列を切る。自由度・t・F・p はもとのデータと同じ |
| 節点が 1e200 (や 1e-200) 規模の pracma の `barylag` | 節点の差の積が溢れる (0 に落ちる)。重みがすべて 0 になり、結果は NaN | 積を指数つきで持ち、重みを共通の 2 の冪でそろえる。0.5e200 での (x / 1e200)^2 は 0.25 |
| pracma の `barylag(c(-1e308, 1e308), c(-1, 1), 0)` など、有限な節点の範囲が溢れる場合 | 節点の差が溢れて NaN | 重みと差を x / 2 の座標で作る (補間値は x の尺度によらない)。0 |
| pracma の `barylag(c(0, 2^-250, 2^-249, 2^-600), c(1, 0, 0, 0), 2^-1074)` (節点の差の積 2^-1099 がアンダーフローし、重みを点との差で割った項が溢れる。issue #402) | NaN | 1 (範囲の外に出るときだけ、積を 2 つの因子それぞれ m 2^f にして掛け、商の項を m 2^e にして最大の項の 2 の冪で割る) |
| 負荷量がすべて 0 の行 (ほかと無相関の変数) がある `varimax` と `factanal` (varimax・promax) | "infinite or missing values in 'x'"。Kaiser の正規化でその行を 0 で割る | ほかの行の回転 (R でそれらの行だけを varimax したものと同じ)。0 の行は 0 のまま |
| scale が 5.7e307 を超える `dcauchy` (`dcauchy(1.1e308, scale = 1e308)`) | 0。π × scale が溢れる | 非正規化数の密度 1.44e-309。その場合は 1/π を先に計算する |
| すべての重みが 1e-308 未満の `lm` | 標準誤差 Inf (5e-324 で NaN)、t 0、p 1 | 重み 1 と同じ値 ((R'R)^-1 を、重みを 2 の冪で割った尺度で作る) |
| 大きい方のモデルが実質的に完全適合する `anova(fit1, fit2)` (y = 1 + x + z が厳密に成り立つ) | 警告なしで F 2.6e30、p 4e-16 (1 つのモデルの表は警告する) | 同じ値に警告 "ANOVA F-tests on an essentially perfect fit are unreliable" を付ける |
| `p.adjust(p, "BY", n = Inf)`、`"holm"` で `n = Inf` | "result would be too long a vector"、すべて 1 | エラー (n は有限)。BY で n が 1e6 を超えると調和数を漸近展開で求める |
| `qbinom(-1e10, 1e5, 0.01, log.p = TRUE)` | 37 (探索が途中で止まる) | 0 (F(0) ≈ e^-1005 は e^-1e10 を超える) |
| `qt(1e-320, 2)` (非正規化数の p) | -Inf | -7.0711e159 (閉じた式 −sqrt(1/(2p)) と一致) |
| `qbeta(-1e5, 1e-10, 100, lower.tail = FALSE, log.p = TRUE)` | NaN | 1 (真の答えを丸めると 1) |
| `qbeta(2.25e-265, 5.68e-37, 5643.4, lower.tail = FALSE)` (極小の shape) | 1 (警告つき) | 0.08797712670529832 |
| `df(1.33e-322, 1.04, 206159)` など非正規化数の x | NaN | 3.77e153 (m x / n の log から計算) |
| `pf(5.43e-319, 1.04, 206159)` (非正規化数の x) | 1.0014e-166 | 7.3742e-167 |
| `dcauchy(1e300, log = TRUE)`、`pcauchy(-1e300, scale = 1e-300, log.p = TRUE)` | -Inf | -1382.69… |
| `dweibull(1e-300, 3, log = TRUE)` | -Inf | -1380.45… |
| `dweibull(1e100, 5, log = TRUE)` | NaN (∞ − ∞) | -Inf |
| `pnbinom(30, 1e7, 0.7, log.p = TRUE)` | -Inf | -3566376.67… |
| `qcauchy(-1000, 0, 1e-300, log.p = TRUE)` | -Inf | -6.27e133 |
| `qcauchy(1e-320, 0, 1e-300)` | 不正確 (πp が非正規化数) | scale/p/π として計算した正しい値 |
| `qlogis(1e-320, lower.tail = FALSE)` | Inf | 736.83 |
| `plogis(-745)` など答えが非正規化数になるもの | 0 | 5e-324 |
| `pwilcox(q, 500, 500)` | 数 GB を使ってメモリ不足になる | 計算できる (メモリは mn/2 に比例して増える)。m = n が約 510 を超えると、中央付近の項が精度を失う (表の各段で、中心より上の誤差が増幅される)。そこは RangeError になる。520 では中央から 1.7 sd 下、1050 では 18 sd 下から先 (裾は計算できる。100 と 20000 のように m が小さい場合は中央まで計算できる) |
| `dwilcox(3, Inf, 5)`、`dsignrank(3, Inf)` | 割り当てエラーまたはクラッシュ | NaN |
| `qsignrank(p, 1100)`、`qhyper(0.5, 1e15, 1e15, 1e15)` | 終わらない | 計算できる (この大きさの `qhyper` は 10 秒ほどかかる) |
| `qtukey(1e-10, 20, 10)` | NaN | 有限の答え |
| `qtukey(1.52e-287, 3, 4.67e10, nranges = 2, lower.tail = FALSE)` | NaN ("convergence failed") | 51.31849500218445 |
| `ptukey(54.5, 3, Inf, nranges = 2, lower.tail = FALSE, log.p = TRUE)` (1 − W が double の範囲を下回る) | -Inf | -744.6488312090673 (log 2 + log(1 − W)) |
| `qbeta(8.7e-285, 1.33e304, 5.89)` (巨大な shape。答えを丸めると 1) | NaN (`bgrat` の警告つき) | 1 |
| `pf(2e-323, 0.0121, Inf)` (q df1 が正規化数の範囲を下回る) | 0 | 0.01091389160021212 |
| `qf(-385.76, 1.05, 1.14e264, ncp = 1.65e262, log.p = TRUE)` | Inf (警告つき) | 1.5704712908151466e262 (非心 χ² 極限) |
| `pf(2.5e300, 1827.5, 0.165, ncp = 3.66e307)` | NaN (警告つき) | 7.4814091599854485e-292 |
| `qchisq(0.5, 1e308, ncp = 1e308)`、`qchisq(0.5, 1e308, ncp = 7e307)` (df + ncp が溢れる、または分位点が最大の double の近く。issue #157) | NaN と警告 (`qchisq(0.5, 5e307, ncp = 5e307)` も) | Infinity (平均 2e308、標準偏差 2.4e154。分位点は double の範囲を超える)、1.7000000000000001e308 (分布関数がその double で 0 から 1 に飛ぶ)。括りの上端は最大の double で止め、そこで目標に届かなければ Infinity |
| `beta(1e-310, 1e-310)` (B(a, a) > 2/a がオーバーフロー) | NaN (警告つき) | Inf |
| `qhyper(1 - 1e-15, 1e4, 1e5, 5000)` | 5000 | 617 (定義どおり) |
| n = 179 の 3 × 5 表に対する `fisher.test` | 既定の workspace で FEXACT error 7 | 0.2023726720757 (0.65 秒) |
| 非常に大きな n (たとえば 3000) での `wilcox.test(exact = TRUE)` | `psignrank` が NaN を返す | 計算できる |
| `wilcox.test(x, y)` (正規近似) で、すべての値が同じ場合 (`wilcox.test(1, 1)` など) | 両側の p が NaN (0 / 0。R 4.6 は 1 を返す) | 1 (W はいつも期待値に等しい)。どの alternative でも |
| 特異値が最大の double を超える行列の `kappa(exact = TRUE)` と MASS の `ginv` (a = 1.7e308 で `a * matrix(c(1, 1, 1, -1), 2)`) | NaN (Inf / Inf) と零行列 (閾値 tol × Inf ですべての成分を捨てる) | 1 と逆行列 (±2.9e-309)。比と閾値を縮めた特異値で求める |
| 極端な大きさの対比 (`c(0, 1e160)`、`c(0, 1e-200)`、`diag(2) * 1e160`) での lmerTest の `contest` | 標準誤差が Inf か 0、t が 0 か Inf、df と p が NaN。同時検定は "infinite or missing values in 'x'" か空の表 | 対比そのものの検定 (L と rhs を 2 の冪で割る)。推定値と標準誤差は対比の単位 |
| x < 0 で deriv ≥ 6 の `psigamma(x, deriv)` | NaN (R では未実装) | 計算できる (`psigamma(-1.5, 10)` = -156.229596593233) |
| `trigamma(1e-300)`、`psigamma(1e-100, 3)` など結果がオーバーフローするもの | NaN | ±Inf |
| `besselI(1000, 1000)` | Inf | 2.7234536469108428e229 |
| `besselK(1000, 1000)`、`lfactorial(1e-300)`、`besselI(1e-300, 1)` | 0 | 1.2981802514667e-233、-5.77e-301、5e-301 |
| `besselJ(1e6, 0)` | 0 | 3.3104301373987376e-4 |
| `besselY(1e6, -2.75)` | -4.1e-4 | -2.8030753997749413e-5 |
| `besselJ(1e308, 0)`、`besselY(1e308, 0)`、`besselI(1e308, 0, expon.scaled = TRUE)` (pi x や 2 pi x が溢れる) | 0 (J は警告 "value out of range") | -2.4706564120790082e-155、7.5866879552418034e-155、3.989422804014327e-155 (平方根を因子ごとに取る) |
| `gamma(171.6243769563027)` (Γ が有限になる最大の double) | Inf | 1.79769313486223e308 |
| `gamma(-171.5)`、`gamma(-172.5)`、… `gamma(-177.5)` まで (結果が非正規化数) | 0 | 1.9316265431712e-310、-1.1197835032888e-312、…、5e-324 |
| `lbeta(1e308, 1e308)` (a + b が溢れる) | -Inf | -1.3862943611198915e308 |
| `besselY(1e-310, 0)`、`besselY(5e-324, 0)` | -Inf | -454.49387560035387、-473.99907342300429 |
| `besselK(1, 1e12)`、`besselY(1, 1e12)`、`besselY(10, 1e8)` (大きな次数で、結果が範囲を大きく超える) | エラー "cannot allocate vector of size 7450.6 Gb"、警告付きの NaN | Inf、-Inf、-Inf をすぐに返す (次数に比例する漸化式の前に、結果の対数の上界・下界で判定する) |
| `besselK(1e8, 2e8)` | 0 | Inf |
| タイがあり `exact` を指定しない (または `TRUE`) `ansari.test(conf.int = TRUE)` | エラー "object 'cint' not found" (両方の標本が 50 未満だと R は正確な方法の分岐に入り、タイがあると区間を飛ばす) | 正規近似の区間と推定値 (`exact: false` と同じ) |
| `weighted.mean(c(1e308, 1e308), c(1, 1))` など和が溢れる場合。重みの和だけが溢れる `weighted.mean(c(1e-308, 2e-308), c(1e308, 1e308))`。符号付きの重みが打ち消し合う `weighted.mean(c(1e308, 1e308, 1e308), c(1e308, -1e308, 1e-308))`。積がアンダーフローする `weighted.mean(1e-200, 1e-200)` | Inf。0。NaN。0 | 1e308。1.5e-308。1e308。1e-200 (積の和と重みの和を厳密に求め、商を 1 回だけ丸める) |
| `fivenum(c(1e308, 1e308))`、`hist(...)$mids`、Kaplan-Meier の中央値、`wilcox.test` の Hodges-Lehmann 推定値と midrange、三角分布の既定の最頻値、`splinefun` の `monoH.FC` の傾き (いずれも `(a + b) / 2`) | a + b が溢れると Inf | 中点 (a + b が溢れるときは a / 2 + b / 2) |
| `hist(c(-1e308, 1e308), breaks = c(-1e308, 0, 1e308))$counts` (breaks が 3 個以下で、データの範囲が溢れる) | (2, 0) (数えるときのずらし幅 1e-7 × 範囲が Inf) | (1, 1): ずらし幅は範囲の半分から求めて 2 倍する |
| `hist(c(-1e308, 1e308), breaks = "Scott")`、`breaks = "FD"` (有限のデータで範囲と Scott または Freedman-Diaconis の幅が溢れる) | エラー "invalid number of 'breaks'" (Inf / Inf) | breaks (-1e308, 0, 1e308): 区間数は、データを 2 の冪で割った範囲と幅から求める (FD は先に 5 桁に丸める) |
| `hist(c(-1e308, 1e308), breaks = c(-1e308, 1e308))$density` (区間の幅が溢れる)。`hist(c(0, 1e308), breaks = c(0, 1e308))$density` (n × 幅が溢れる) | 0。0 | 5e-309。1e-308 (幅かその半分を 2 の冪で割って計算し、丸めは 1 回) |
| 1e150 程度のデータに対する e1071 の `skewness`、`kurtosis` | NaN (べき乗が溢れる) | 尺度によらない値 (偏差を 2 のべき乗でスケーリング) |
| `scale(c(1e200, 2e200, 3e200))`、`scale(c(1e-200, 2e-200, 3e-200))` | scale が Inf または 0、標準化値が 0 または ±Inf | -1, 0, 1 (二乗和をスケーリング) |
| `runif(n, -1e308, 1e308)` | Inf (max - min が溢れる) | 範囲内の値 |
| 1e308 規模の行列の `kappa()` (例 `1e308 * matrix(c(1, 0, 1, 1), 2)`。既定の QR の推定、`method = "direct", triangular = TRUE`、`exact = TRUE, norm = "1"`) | エラー ("NA/NaN/Inf in foreign function call")、Inf、エラー ("computationally singular") | 元の行列の条件数 (3.33、3.33、4)。先に行列を 2 の冪で割る |
| `optimize(function(x) x^2, c(-1, 1), tol = 5e-324)` (tol/3 がアンダーフローする tol) | 返らない (サブノーマルの間でステップが 0 に丸まる) | 0 (ステップで点が動かなくなったところで終える) |
| `seq(1, 2, by = Inf)`; `seq(1, 2, by = -Inf)` (`to` と逆向きの刻み) | NaN; NaN | 1; エラー "wrong sign in 'by' argument" |
| `seq(-1e308, 1e308, by = 5e307)` | 中央の値が -1.9958e292 | 0 (端点の差が溢れるので、半分にした端点の値を 2 倍する) |
| `matrix(c(1, 3, 2, 4), 2) * 1e-60` のような小さな非対称行列の `eigen()` | 対称とみなす (平均 \|a\| <= 100 eps で `isSymmetric` が絶対差で比べる) ため固有値が誤る | 対称判定をどの尺度でも相対的に行う (`isSymmetric()` 自体は R と同じ) |
| 値に "\r" を含む複数キー、または `NA` と文字列 "NA" での `merge()` | 異なるキーの行が結合される (キーを "\r" で連結するため) | 等しいキーだけを結合 |
| `JonckheereTerpstraTest` (DescTools) の両側 p 値 | 1 を超えることがある | 最大 1 |
| distSummary の `unif(-1e308, 1e308)` の平均、`beta(1e150, 1e150)` の分散、`triang(-1e308, 1e308, 0)` と `triang(0, 3e120, 1e120)` の歪度 | Inf、0、NaN、NaN | 0、1.25e-151、0、0.3054 (歪度は 2 の冪で割ったパラメータから) |
| 小さな単位の共変量 x (x * 1e-4) での `aov(y ~ x + w + Error(id/w))` | x の行が消える (層への射影の平方和が 1e-5 を超える列だけを採用するため) | x の尺度によらず同じ表 (しきい値は列自身の平方和の 1e-14 倍。以前の 1e-5 × 列の平均二乗では、主に被験者間で変動する共変量の小さな被験者内成分も落ちていた) |
| 1e-200 や 1e155 程度のデータでの `t.test`、`oneway.test`、`var.test`、`bartlett.test`、PMCMRplus の `tukeyTest`/`gamesHowellTest`、`pairwise.t.test` | "data are essentially constant" か NaN (分散が 0 にアンダーフロー、またはその二乗がオーバーフロー) | 尺度によらず同じ結果 (データを 2 の冪で正規化。丸め誤差なし) |
| 1e±150 程度のデータでの `t.test`、`gamesHowellTest`、`cohensD`、ICC の二元配置の限界の Welch 自由度 | NaN (標準誤差の 4 乗) | 尺度によらず同じ自由度 |
| `chisq.test(c(1e200, 1e200), p = c(0.1, 0.9))`、`chisq.test(matrix(1e200, 2, 2))`、`mcnemar.test`・`prop.test`・`mantelhaen.test` の Pearson 型の項 | Inf か NaN (偏差の二乗や周辺度数の積がオーバーフロー) | 3.56e200、0 (必要なときは (d / sqrt(e))^2、(a / n) b の順で計算) |
| `mcnemar.test(matrix(c(0, 8e307, 1e308, 0), 2))` (不一致の組の和がオーバーフロー) | NaN | 2.22e306 (その組の項を、差は 2^520、セルは 2^1040 を単位として計算。尺度の変更は厳密で、戻す必要もない) |
| `prop.test(c(6e307, 4e307), c(1e308, 1e308), correct = FALSE)` (試行数の合計がオーバーフロー) | Inf (プールした割合が 0) | 8e306 (プールした割合を、両方の合計を 2^s (2^s は群の数以上) を単位にして計算) |
| `chisq.test(c(1e308, 1e308))` など、度数の合計がオーバーフローする適合度検定 | NaN (期待度数が Inf) | 統計量 0、期待度数 1e308 (度数を 2^s (2^s はセルの数以上、s は偶数) を単位にして計算し、期待度数と統計量は 2^s 倍、残差は 2^(s/2) 倍で戻す) |
| `chisq.test(c(1, 1), p = c(1e308, 1e308), rescale.p = TRUE)` (有限の重みの合計が溢れる) | 統計量 Inf、p 値 0 (Inf で割った重みがすべて 0) | 統計量 0、p 値 1 (重みを 2^e (2^e はセルの数以上) を単位にしてから割る。issue #303) |
| 応答の単位を変えた (1e-4 倍、1e±100 程度) afex の `aov_ez` と `mauchly.test` | 球面性の補正と Mauchly 検定が消える (car の固有値の絶対しきい値)、または W が NaN | 尺度によらず同じ ε と W (ランクは最大固有値とデータの平方和に対する相対値で判定。W は det(U / (trace(U)/p)) で計算) |
| 単位が大きく違う共変量の `coxph(Surv(time, status) ~ x1 + x2)` (x1 を 1e7 倍や 1e-6 倍、x2 はそのまま) | Wald 検定で共変量が 1 つ落ちる (3.36 が 0.31 や 3.08 になる。元の単位の分散のコレスキー分解で、ピボットが相対許容幅を下回る)。x1 を 1e200 倍すると標準誤差がアンダーフローして 0 (z は Inf、p は 0)、1e-160 倍すると "infinite argument in coxph.wtest" | 尺度によらず同じ z、p、Wald 検定 (分散・z・Wald 検定・無限の係数の判定を、各共変量の尺度の 2 の冪を単位として計算する。係数・分散・標準誤差は出力の直前に元の単位に戻す) |
| 1e±200 程度のデータでの `zTest` (BSDA の `z.test`)、effectsize の `cohens_d`/`hedges_g`、irr の `icc`、psych の `alpha`、nortest の `ad.test`/`cvm.test`/`lillie.test`/`sf.test`/`pearson.test`、`aov`、`TukeyHSD`、car の `leveneTest`、`lm`、`anova`、`aov(... + Error())`、afex の `ges` | NaN、0、±Inf、または異なる検定結果 (データの二乗がオーバーフロー・アンダーフロー) | 尺度によらず同じ結果 (平均を引く前にデータを 2 の冪で正規化。平方和、MSE、標準誤差、区間は出力時に単位を戻す) |
| `cov(c(MAX, MAX, -MAX), c(-1e-308, -1e-308, 1e-308))` (`MAX` は double の最大値)、double の最大値に近い符号の異なる値の対応のある `t.test` | -Inf か NaN (正規化の前に偏差や差がオーバーフロー) | 約 -2.3969、相関は -1。対応のある検定は他の尺度と同じ結果 |
| `t.test(x, mu = 1e100)` | 区間が [0, 0] (mu + (t ± q) stdErr の形で計算) | x の平均を中心とする区間 (mu に依存しない。mu が無限大のとき R は NaN) |
| 応答が 1e±200 程度での car の `Anova` (型 II・III)、`predict(lm)` の標準誤差と区間、gaussian の `glm` とその `summary`・`residuals`・`rstandard`・`cooks.distance`・`predict`・`anova`・`confint`、DescTools の `CoefVar` と `MeanAD` | Inf、0、NaN、"residual sum of squares is 0"、または "no valid set of coefficients has been found" | 尺度によらず同じ結果 (応答を 2 の冪で正規化。glm は gaussian と定数分散の quasi の identity link) |
| `pnorm(1e308, -1e308, 1.7e308)`、`qnorm(0.9, -1e308, 1.7e308)`、および `plogis`/`qlogis`、`pcauchy`/`qcauchy`、extraDistr の `plaplace`/`qlaplace`/`dlaplace` で、結果は範囲内なのに x − location や scale z が溢れる場合 | 1、Inf、0、-Inf (pnorm 1、dnorm 0、qnorm Inf を R 4.5.2 で確認) | 0.8803、1.1786e308 (引き算や積の前に、x と location を半分に、または location と scale を 2 の冪で割る) |
| 欠測値のあるブロック (行) を含む `quade.test(y)`。例: `y <- rbind(c(10,12,15), c(11,14,16), c(12,NA,17), c(13,15,18), c(14,16,20))` | F = 10、df (2, 8)、p = 0.00666。除いたブロックも b に数える (B = ΣS_j^2 / b、(b − 1) B / (A − B)、df (b − 1)(k − 1)) ので、同じデータの `quade.test(y[-3, ])` (F = 25、df (2, 6)、p = 0.00123) と結果が違う。R のバグ (4.5.2 で実行して確認) | 完全なブロックだけでの検定: F = 25、df (2, 6)、p = 0.00123 (ブロックを除いたデータと同じ) |
| 自由度が無限大の非心 `rt(n, Inf, ncp = 1)`、`rf(n, Inf, 10, ncp = 2)`、`rf(n, 10, Inf, ncp = 2)` | NaN ("NAs produced"。非心でない `rt(n, Inf)`、`rf(n, Inf, 10)` は値を返す) | 極限の分布。t は N(ncp, 1)、F は無限大の自由度の側のカイ二乗/自由度を 1 とする (X / df1、df2 / Y、または 1)。R と同じ乱数を引くので、呼び出し後の乱数の状態も R と同じ |
| `rf(n, 0, 10, ncp = 2)` (非心、df1 = 0)、`rsignrank(n, Inf)` | 乱数次第で Inf か NaN (df1 = 0 で割る。非心でない `rf` は NaN)。Inf の整数への変換は未定義 | NaN (F は df1, df2 > 0 が必要。R と同じ乱数を引くので、呼び出し後の乱数の状態は R と同じ)。乱数を引かずに NaN |
| expm の `expm(matrix(c(1e308, 0, 0, 0), 2), method = "Higham08")` | 全要素 NaN (2 乗の段階で Inf × 0) | diag(Inf, 1)。溢れた要素は有限の巨大な値を表すので、厳密な 0 との積は 0。1-ノルムが溢れる行列でも無限ループしない |
| expm の `expm(matrix(c(0, 1e-308, 1e308, 0), 2), method = "Higham08")` (1e±200 でも。Padé の前の縮小 A / 2^s で要素 1e-308 が正規化数の下に落ちる。Issue #207) | [[1, 1e308], [0, 1]] (冪零行列の指数関数) | [[cosh 1, 1e308 sinh 1], [1e-308 sinh 1, cosh 1]] で、既定の "Higham08.b" とビットまで同じ。その縮小で非零の要素が 2^-1022 未満に落ちるときだけ、"Higham08" も内部で平衡化 (dgebal の job "S"、2 の冪の対角の相似変換) をして戻す。それ以外の行列は R と同じく平衡化しない |
| expm の `expm(matrix(c(0, 0, 2^-1074, 0), 2), method = "Taylor")` (order によらない。"TaylorO" も。Issue #404) | 単位行列 (N = 2^p、p ≥ 5 での縮小で要素が 0 になる。1e-310 も末尾の桁を失い 9.9999999999945e-311) | [[1, 2^-1074], [0, 1]] (この冪零行列の指数関数 I + A)。1e-310 もそのまま。A / 2^p で非零の要素が 2^-1022 未満に落ちるときだけ、p を 2^p ≥ 16 nu (nu = sqrt(1 ノルム × 無限大ノルム)) を満たす最小の値 (p ≥ 0) にし、下限 p ≥ 5 を外す。"Pade" も同じ p を使う (1e-310 は 1.00000000000005e-310、R は 1.00000000000103e-310) が、2^-1074 は最初の係数 1/2 で半分になり 0 のまま。それ以外の行列は R と同じ p |
| expm の `expm(matrix(c(0, 0, 1, 0), 2), method = "Pade", order = 0)` ("Taylor"、"PadeO"、"TaylorO" も) | 単位行列 (正しくは [[1, 1], [0, 1]]) | エラー。これらの方法では order は正の整数 (Higham08 系は R と同じく order を無視する)。NaN や無限大を含む 2 × 2 以上の行列は、どの方法でもエラー (Padé・Taylor 系は NaN を返していた) |
| `rcond(matrix(c(1e308, 0, 1e308, 1e308), 2))` など、ノルムが溢れる行列 (`triangular = TRUE` と `solve` の条件数の検査も) | `dgecon` のエラー -5 (`triangular = TRUE` では 0)。この行列の `solve` は computationally singular (rcond = 0) で止まる | 0.3。2 の冪で割った行列と同じ値 (逆条件数は尺度によらない)。`solve` は (0, 1e-308) を返す |
| `qr(matrix(1e308, 2, 2))` (`LAPACK = TRUE` も)、x が 1e308 規模の `lm(y ~ x)` (`x = c(1e308, 5e307, 3e307, 8e307)`、`y = c(1, 3, 2, 4)`) | ランク 2、R[, 2] = -Inf (Householder の積が溢れる)。`lm` は係数が NaN (`glm` はエラー) | ランク 1、R = [-1.414e308, -1.414e308; 0, 0]。`lm`・`glm` は (2.948, -6.897e-309) (x / 2^1000 で当てはめて戻した値)。有限な行列の分解が有限でないときだけ、[2^-256, 2^256] の外の列をそれぞれ 2 の冪で割って (LINPACK。判定は列ごとの相対)、または行列全体を割って (LAPACK) 分解し直し、R を戻す |
| `qr.solve(qr(matrix(c(1, 2, 2, 4), 2), LAPACK = TRUE), c(3, 6))` (ランク落ちの LAPACK の分解) | (8, -2.5)。LAPACK の分解のランクは常に min(n, p) | "singular matrix in qrSolve"。abs(R_kk) <= tol abs(R_11) (tol は 1e-7) をランク落ちとする |
| `kappa(matrix(c(1, 2, 2, 4), 2), exact = TRUE, norm = "1")` (厳密に特異、2 以外のノルム) | "system is exactly singular" | Inf。ノルム "2" と同じ (計算上特異な行列は R と同じく止まる) |
| `anova(lm(y ~ x2), lm(y ~ x1 + x3))` や、入れ子でない glm の `anova()` (どちらのモデルも他方の特別な場合でない) | F 検定 (例では F 1110、p 4.6e-7)、glm では尤度比検定 | 検定しない。F、p 値、検定の列は NaN (`lmerAnova` と同じ)。入れ子かどうかは、パラメータの少ないモデルの列が他方の列空間に入るかを、正の重みの行で QR のランクで判定する (重み 0 の行は尤度に入らない) |
| offset の違う glm の `anova()` (`glm(y ~ 1, poisson)` と `glm(y ~ x, poisson, offset = log(y) - x/2)`) | 尤度比検定 (p = 0.000417) | 検定しない (NaN)。列と同じく、offset の差も大きいモデルの列空間に入るときだけ入れ子とする |
| `cooks.distance(glm(y ~ x, binomial), dispersion = 1e308)`、(r / (1 - h))^2 が溢れる Cook の距離 (事前の重み 1.5e306 の binomial の当てはめ。R は当てはめられない) | すべての行で 0 (h / (dispersion p) がアンダーフロー) | 1.4e-309、…、9.0e-307 (dispersion 1 の距離を 1e308 で割った値) と 1.35e308。二乗が溢れるか h / (dispersion p) が正規化数の下に落ちるときは、残差と dispersion を 2 の冪を単位にして計算する |
| 作業重み w mu.eta(eta)^2 / V(mu) の途中が、重みは範囲内なのに溢れるかアンダーフローする `glm`: poisson の `y = c(1e308, 1e308)`、Gamma (inverse リンク) の `y = c(1e308, 1e308)`、平均 1e200 か 1e-200 の inverse.gaussian (log リンク)、平均 1e-320 の poisson (offset `log(1e-320)`) | "NA/NaN/Inf in 'x'" (poisson、Gamma)。作業重み NaN (平均 1e200)。平均を 2.2e-16 に切り上げて収束、deviance 2e200 (平均 1e-200)。平均と重みを 2.2e-16 に切り上げる (1e-320) | 当てはまる: log(1e308) = 709.196 で null deviance 0、1e-308、重み 1/mu = 1e-200、平均 1e-200、重み 1e-320。mu.eta^2、V(mu)、w mu.eta^2 が正規化数の範囲の外のときだけ、mu.eta = c mu^a と V = mu^p から重みを sqrt(w) abs(c) mu^((2a - p)/2) で作る (identity・log・inverse・sqrt・1/mu^2・power リンク、分散 1・mu・mu^2・mu^3)。作業残差・Pearson 残差も同じ。正の平均で V = mu^p がアンダーフローしても "0s in V(mu)" にしない。null モデルの平均は、重み付きの和が溢れるときだけ応答も 2 の冪で割る。binomial のリンクは R の式のまま。Gamma の例では作業重み mu^2 = 1e616 そのものが double で表せないので、重みは Inf、dispersion と標準誤差は NaN |
| `shapiro.test(c(-1e308, 0, 1e308))` (範囲が溢れる) | NaN | W = 1。`shapiro.test(c(-1, 0, 1))` と同じ (先にデータを 2 の冪で割る) |
| polycor の `polyserial(x * 1e200, y, std.err = TRUE)` (平方和が溢れる) | rho 0、chisq NaN | x のときと同じ値 (レビューの例では rho 0.589) |
| `rexp(n, rate = 1e-310)` (正の rate で 1 / rate が溢れる) | 警告付きの NaN (乱数は引かない) | 乱数 `exp_rand() / rate` (指数乱数がおよそ 0.018 未満でなければ Inf)。1 個につき指数乱数を 1 個引く |
| `set.seed(7)` の後の `rnorm(1, mean = -1e308, sd = 1e308)` (sd Z は溢れるが mean + sd Z は溢れない。issue #396) | Inf | 1.2872471613405238e308 (mean + sd Z が有限でないときだけ、mean と sd を半分にして同じ和を作り 2 倍する。乱数は同じ) |
| `set.seed(19)` の後の `rweibull(1, shape = 0.001, scale = 2^-1074)` ((-log u)^(1/shape) は溢れるが乱数の値は溢れない。issue #408) | Inf | 103020481.1280669 (冪が溢れるときだけ、scale (-log u)^(1/shape) を double-double の log から作る。一様乱数は同じ) |
| `set.seed(1)` の後の `rgamma(1, 0.001, scale = 2^1023)` と extraDistr の `rinvgamma(1, 0.001, 2^-1023)` (形状が 1 未満で、単位尺度の p^(1/shape) はアンダーフローするが尺度を掛けた値はしない。issue #409) | 0 と Inf | 1.5563963702389774e-268 と 6.4250985103907345e267 (p^(1/shape) が正規化数の範囲より下で scale > 1 のときだけ、scale p^(1/shape) を double-double の log から作る。乱数と採否は同じ) |
| `rcond(diag(c(1, 1e-310)))` など、逆行列のノルムが double の範囲を超える正則な行列 (`triangular = TRUE`、正方でない行列、`solve` の条件数の検査も) | 0 | 1e-310。推定の途中で逆行列との積が溢れたら、すべてのベクトルを 2 の冪で割って (厳密) 推定し直し、結果を戻す。それでも溢れるときだけ 0 |
| `backsolve(diag(1e-308, 2), c(1, 2))`、`forwardsolve(..., transpose = TRUE)` (`solve` も) | NaN、Inf (溢れた成分との 0 * Inf)。`solve` は rcond = 0 で止まる | 1e308、Inf。溢れた成分は有限の値の代わりなので、厳密に 0 の係数は飛ばす |
| `solve(1e308 * matrix(c(1, 1, 1, -1), 2), c(1, 0))` と逆行列 (消去で -1e308 - 1e308 が溢れる)、`solve(matrix(c(1, 1, 1, -1), 2), c(1.7e308, -1.7e308))` (代入で溢れる) | (1e-308, 0)、0 を含む逆行列。-Inf、Inf | (5e-309, 5e-309)、逆行列 (±5e-309)。(0, 1.7e308)。入力が有限で U か解が有限でないときは、行列を 2 の冪で割った複製 (条件数の検査と同じもの) の LU で解く。必要なら右辺も最大の要素の 2 の冪で割り、最後に 1 回で戻す |
| `prcomp(c(1e308, -1e308, 1e308, -1e308))$sdev` (特異値が溢れる) | Inf | 1.1547005383792517e308 (2 の冪で割った行列を分解する) |
| `sd(c(-1e308, -1e308, -1e308, -1e308, 1.5e308))` (分散が溢れる)、`sd(c(1e-200, 2e-200, 4e-200))` (分散がアンダーフローする)。そうしたデータの e1071 の `skewness`・`kurtosis` と変動係数 | Inf、0。NaN または 0 | 1.118e308、1.53e-200 (2^-k の座標の偏差から sd を作る)。積率と変動係数は、どの尺度でも同じ値 |
| 同じデータの `scale(x)` と `prcomp(x)` (平均からの偏差 2e308 が溢れる) | `scale` は NaN、scale は Inf。`prcomp` は svd のエラー | `scale` は [-0.447, …, 1.789]、scale は 1.118e308。`prcomp` は sdev 1.118e308、範囲外のスコアは Inf (2^-k の座標で計算する) |
| `determinant(diag(c(1e308, 1e308, 1e-308, 1e-308)), logarithm = FALSE)` | modulus が Inf (途中の積が溢れる) | 1 (積の 2 の冪の指数を別に持つ) |
| `matrix(c(1e308, 1e308), 1) %*% matrix(c(1e308, -1e308))` と、`x <- matrix(c(1e200, 1e200, 1e200, -1e200), 2)` の `crossprod(x)`・`tcrossprod(x)` の非対角 (積は溢れるが和は溢れない)、`matrix(c(1e308, 1e308, 1e-308), 1) %*% c(1e308, -1e308, 1e308)` (大きな積が打ち消す。Issue #208) | NaN | 0、0.9999999999999999 (double の 1e-308 * 1e308)。そうした要素は、各積を「整数 × 2 の冪」として BigInt で厳密に足し、1 回だけ丸めて取り直す (素朴な和が有限でないときだけ) |
| `x1 = c(1, 0, 1)`、`x2 = c(0, 1, 1)`、`y = c(2, -2, 0)` の `predict(lm(y ~ x1 + x2 - 1), data.frame(x1 = 1e308, x2 = 1e308))` (係数は 2 + 1 ulp と -(2 + 2 ulp)。積が溢れて打ち消す。Issue #195) | NaN | -4.440892098500626e292 (この係数での厳密な値、Rmpfr。行列の積と同じ厳密な内積。素朴な和が有限でないときだけ) |
| 重み 0 の行の当てはめ値で、積が溢れて打ち消すもの: `a = c(1, 0, 1, 1e308)`、`b = c(0, 1, 1, 1e308)`、`y = c(1.9, -1.9, 0, 0)` の `lm(y ~ 0 + a + b, weights = c(1, 1, 1, 0))` (R の係数は 1.9 と -(1.9 + 3 ulp)。Issue #193) | 4 行目の当てはめ値と残差が NaN | 行列の形 (係数は R と同じ): -6.661338147750939e292 とその符号を変えた値。この係数での厳密な x'b で、`predict` と同じ (素朴な和が有限でないときだけ)。式の形: 0 (double-double の係数がちょうど 1.9 と -1.9) |
| `x1 = c(0.5, 0, 0.5)`、`x2 = c(0, 0.5, 0.5)`、`y = c(2, -2, 0)` の `predict(glm(y ~ x1 + x2, gaussian), data.frame(x1 = 1e308, x2 = 1e308))` (`newdata` を渡した `glmPredict`。傾きは rStats.js で 4 + 2 ulp と -(4 + 1 ulp)、R で 4 + 1 ulp と -(4 + 1 ulp)。積が溢れて打ち消す。Issue #174) | NaN | 8.881784197001252e292 (この係数での厳密な値、Rmpfr。lm の `predict` と同じ厳密な内積。素朴な和が有限でないときだけ) |
| `crossprod(rep(1e-162, 100))` (`tcrossprod`・`%*%`、新データでの lm・glm の `predict` も。和は表せるのに、各積 1e-162 * 1e-162 が 0 に丸まる。Issue #395) | 0 | 1e-322 (厳密な内積を 1 回だけ丸めた値。`crossprod(rep(1e-160, 3), rep(3e-161, 3))` は 9e-321、R は 8.997e-321)。上の行の厳密な和は、素朴な和の絶対値が 2^-969 未満で、0 でない因子の積が 2^-1022 未満に落ちたときにも取る (そうした積の誤差は 2^-1075 までで、それより大きな和では丸めに埋もれる)。「2^-1022 未満」は厳密な積で見る。2^-1022 に丸め上がる積も含む (`crossprod(rep(2^-511, 100), rep(2^-511 (1 - 2^-53), 100))` は 0x1.8ffffffffffffp-1016、R は 0x1.9p-1016。Issue #465)。正規化数の範囲で打ち消す和は素朴な値のまま (`crossprod(c(1e16, 1, -1e16), c(1, 1, 1))` は R と同じく 0) |
| `x = c(1e-200, 2e-200, 3e-200)`、`y = c(1e-200, 2e-200, 4e-200)` の `predict(lm(y ~ 0 + x), data.frame(x = 1e200), se.fit = TRUE)$se.fit` (残差標準誤差 4.2e-201 を掛ける前に R^-T x が約 1e400。Issue #196) | NaN (R の残差標準誤差は 0 にアンダーフロー) | 1.1293848786315636e199 (Rmpfr 1.12938487863156401e199。R^-T x が範囲の外のときだけ、x を 2 の冪で割って解き直す)。`x = c(1e200, 2e200, 3e200)`、`y = c(1e100, 2e100, 4e100)` の `x = 1e-200`: R は 0、rStats.js は 1.129384878631563e-301 |
| `x1 = c(0, 1, 0, 1)`、`x2 = c(0, 0, 1, 1)`、`y = c(0, 1, 1, 2)` の `predict(glm(y ~ x1 + x2, gaussian), data.frame(x1 = 1.5e308, x2 = 1.5e308), se.fit = TRUE, dispersion = 1e-300)$se.fit` (`glmPredict`。sqrt(dispersion) を掛ける前の R^-T x のノルムが約 2.1e308。Issue #175) | Inf | 2.1213203435596427e158 (newdata を 2^100 で割った値の 2^100 倍。二乗が溢れたときの受け皿で積が有限でないときだけ、ノルムに先に sqrt(dispersion) を掛ける) |
| `x = c(0.7e308, 0.8e308, 0.9e308)`、`y = c(1, 2, 3)` の `lm(y ~ x, weights = c(2, 2, 2))` (sqrt(w) x の列のノルムが 1.97e308。Issue #199) と、同じデータの式の形の `lm(y ~ x)` (double-double の再計算が列を二乗していた) | 係数が NaN (重みなしでも) | 式の形で -5.999999999999999 と 1e-307 (Rmpfr -5.99999999999999933、9.99999999999999889e-308)、重みつきの行列の形で -5.999999999999992 と 9.999999999999993e-308。重みつきの分解が有限でないときは、`qr` は重みを 2^qw で割った (最大の重みが [1/4, 1)) 分解で、`predict` はそれを考慮する |
| `optimize(function(x) (x / 1e308 - 1.05)^2, c(1e308, 1.1e308))` (lower + upper が溢れる) | 終わらない (中点が Inf) | 1.05e308 (x/2 の座標で探す) |
| `optimize(function(x) (x / 1e308 + 1.6)^2, c(-1.7e308, 1e306))` (lower + upper は有限だが、端点が `.Machine$double.xmax / 2` を超え、その近くまで狭めた区間の中点が溢れる。Issue #212) | 終わらない | -1.5999999916130706e308 (評価 38 回。端点が最大の double の半分を超えるときも x/2 の座標で探す) |
| `approx(c(-1e308, 1e308), c(0, 1), n = 3)`、`approx(c(0, 1), c(-1e308, 1e308), xout = 0.5)`、`spline(c(-1e308, 1e308), c(0, 1), n = 3)` (有限な値の差が溢れる) | y が 0, 0, 1。Inf。spline は 0, 0, NaN | 0, 0.5, 1。0。0, 0.5, 1 (差を半分の座標で取る。spline は x / 2^k で作る) |
| `splinefun(c(-1e308, 1e308), c(0, 1))(0)` (全方式)、`splinefun(c(-1.5e308, 0, 1.5e308), c(0, 1, 0), method = "periodic")(0)`、`splinefunH(c(-1e308, 1e308), c(0, 1), c(0, 0))(0)` (節点の範囲が溢れる。issue #125) | 0 (fmm、natural)、NaN (hyman、monoH.FC、splinefunH)。periodic は 0 | 0.5。periodic は 1 (x / 2^k で作り、d 階の導関数は 2^(-d k) 倍で戻す。splinefunH は与えた傾きをそのまま使う)。`spline` も同じ条件 (隣の間隔だけでなく範囲) で判定する |
| `spline(c(0, 2), c(-1e308, 1e308), xout = 1)`、`splinefun(c(0, 2), c(-1e308, 1e308))(1)` (節点 2 個の fmm、natural)、`splinefunH(c(0, 2), c(-1e308, 1e308), c(0, 0))(1, deriv = 1)` (y の差が溢れる。issue #380) | Inf | 0。0。1.5e308 (割線の傾きを半分にした y から作る) |
| `splinefun(c(0, 1, 5), c(0, 2e-199, 4e-199), method = "hyman")(5, deriv = 1)` (隣り合う 2 つの割線の積 2.5e-399 がアンダーフローする。issue #398) | -7e-200 (リミッタが fmm の傾きの符号を使い、増加するデータで負の微分になる) | 0 (割線の積ではなく符号どうしを比べる) |
| `splinefunH(c(0, 1e200), c(0, 0), c(1e200, 1e200))(5e199, deriv = 3)` (h^2 が溢れる。issue #399) | 12 (R は 3 階微分を h で 1 回しか割らない。下の「3 次 Hermite スプラインの 3 階微分」を参照) | 1.2e-199 (h^2 が正規化数でないときだけ h で 2 回割る。以前は 0) |
| `splinefunH(c(0, 1e200), c(0, 0), c(1e200, 1e200))(1e100)` (基底の因子 1e-100 を掛ける前に h m = 1e400 が溢れる。issue #400) | NaN | 1e300 (その項が有限でないときだけ、h、m、基底の因子を指数を分けて掛ける) |
| `splinefunH(c(0, 1e-200), c(0, 1e200), c(0, 0))(1e-300, deriv = 1)` (基底の因子 6e-100 を掛ける前に割線 1e400 が溢れる。issue #401) | Inf | 6e300 (有限な y で割線が有限でないときだけ、差と基底の因子の積を h で割る計算を指数を分けて行う) |
| `splinefunH(c(0, 1e-200), c(0, 1e200), c(0, 0))(5e-201, deriv = 2)` (基底の因子 6 - 12 t = 0 を掛ける前に割線 1e400 が溢れる。issue #466) | NaN | 0 (#401 の 1 階微分と同じく、差と基底の因子の積を h^2 で割る計算を指数を分けて行う) |
| `splinefun(c(0, 1, 2), c(0, 1e-200, 1e200), method = "monoH.FC")(0.5)` (傾きと割線の比 5e399 が溢れ、Fritsch-Carlson の判定 `Inf < Inf` でリミッタが飛ばされる。issue #397) | -6.25e198 (単調でない) | 1.25e-201 (比やその積が溢れるときだけ、比を共通の 2 の冪で割って判定し、制限した傾きを作る) |
| `rbeta(n, 1e308, 1e308, ncp = 0)` (2 shape が溢れる) | NaN | 0.5 (χ² 乱数を半分にして作る。引く乱数は R と同じ) |
| `rgeom(n, 1e-309)`、`rnbinom(n, 1, prob = 1e-309)`、`rnbinom(n, 0.5, mu = 1e308)` ((1 - p) / p や mu / size が溢れる) | NA または NaN (その後の乱数を引かない) | 乱数の値 (`set.seed(4)` なら 1.716e308 など)。指数乱数や尺度 1 のガンマ乱数に 1 - p を掛けて p で割る。平均そのものが溢れるときだけ Inf。Poisson の段の乱数は引くので、R と乱数列がずれるのはこの場合だけ |
| `rmultinom(n, size, c(0.5, 0.5, 1e-16))` (確率の和が double で 1 になる) | 2 番目の区分が残りをすべて取り (p = 1)、3 番目は引かれない | 2 番目は 0.5 / (0.5 + 1e-16) の二項乱数 (後ろの区分の確率を後ろから足した和で割る)。R と乱数列がずれるのはこうした場合だけ |
| `summary(glm(...), dispersion = -1)` (`glmAnova`、`glmPredict`、`glmRstandard`、`glmCooksDistance` も) | 標準誤差が NaN (警告あり) | エラー。dispersion は 0 以上の有限値 (0 なら R と同じく標準誤差 0) |
| `pwr.chisq.test(w = 1e200, N = 100, df = 3)`、`pwr.f2.test(f2 = 1e308)`、`pwr.anova.test(f = 1e200)` (非心度が溢れる) | NaN | 検出力の極限 1。`powerAnovaTest` は、積だけが溢れる場合は between.var / within.var を先に計算する |
| `pwr.2p2n.test(h = 1e-100, n1 = 1e200, n2 = 1e200)` (n1 n2 が溢れる) | 1 | 0.10895461755061556。積が溢れる場合 (有限の標本サイズ) は、実効的な標本サイズ n1 n2 / (n1 + n2) を a / (1 + a / b) (a <= b) で作る |
| `ES.w1(c(0.5, 0.5, 0), c(0.5, 0.5, 0))` や、空の行・列がある `ES.w2` (両方の確率が 0 のセル) | NaN (0 / 0) | そのセルは 0 を足す (ここでは 0)。p0 = 0 < p1 は R と同じく Inf |
| `ES.w1(c(1e-320, 1), c(1e-200, 1))` ((p1 - p0)^2 がアンダーフローする。issue #264)、`ES.w1(c(0, 1), c(1e-300, 1))` | 0。NaN (0 / 0) | 1.0000055664551364e-40 (Rmpfr 1.00000556645513627e-40)。Inf (p0 = 0 < p1。差が大きいときと同じ)。差の 2 乗が正規化数の範囲より小さいときだけ、項を (d / sqrt(p0))^2 で計算する |
| `ES.w2(matrix(c(1e-200, 0, 0, 1), 2))` (独立のときのセルの確率 r c = 1e-400 がアンダーフローする。issue #265)、`ES.w2(matrix(c(1e-160, 1e-170, 1e-170, 1), 2))` (r c が非正規化数) | NaN (0 / 0)。1 | 1。0.9999999998999998 (Rmpfr 0.99999999989999997)。r c が正規化数の範囲より小さいとき (行和・列和は 0 でない) だけ、項を行和・列和の平方根から (p / sqrt(r c) - sqrt(r c))^2 で計算する |
| `pwr.r.test(n = 4, r = 0.5, sig.level = 1e-320)` (t の臨界値 7.07e159 (自由度 2) の 2 乗が溢れる。issue #269) | NaN (R の `qt` もこの非正規化数の確率では Inf を返す) | 0。t が有限で t^2 + n - 2 が溢れるときだけ、臨界相関を 1 / sqrt(1 + ((n - 2) / t) / t) で計算し (ここでは 1)、検出力は 0 にアンダーフローする |
| `power.anova.test(groups = 3, n = 1e308, between.var = 1, within.var = 1e308)` ((groups - 1) n が溢れる。非心度は 2。issue #272) と、そこで `between.var = 0` | NaN。NaN | 0.2255449157695638 (非心度 2・自由度 2 の R の `pchisq` は 0.22554491576956397。df2 は Inf)。0.05 (非心度 0)。比を先に計算しても (groups - 1) n between.var / within.var が有限でないときだけ、4 つの因子を 2 の冪でそろえて掛ける |
| `power.anova.test(groups = 1e200, n = 1e200, between.var = 1e8, within.var = 1e308)` (df1 = 1e200、df2 = Inf、非心度 1e100。issue #272) と `power.anova.test(groups = 1e17, n = 2, between.var = sqrt(1e17) / 1e17, within.var = 1)` (両方の自由度が 1e16 を超える) | NaN。1 (pnchisq が収束しない警告つき) | 0.17418726161793208 (pnorm(qnorm(0.95) - 1 / sqrt(2), upper) = 0.1741872616179323 と O(1e-100) まで同じ。修正前は 0.760)。0.2595110241630547 (256 ビットの参照値は 0.25951102181670718。修正前は 0.2595111267699508)。両方の自由度が 1e16 を超えるとき (groups - 1 > 1e16) は、`pwr.anova.test`・`pwr.f2.test` (#200、#202) と同じく F の正規近似の検出力を返す |
| `pwr.f2.test(u = 1e308, v = 1e308, f2 = 1e-308)` (u + v が溢れる。非心度は 2。issue #202) と `pwr.f2.test(u = 1e24, v = 1e24, f2 = 1e-12)` (両方の自由度が 1e16 を超える) | NaN。1 (pnchisq が収束しない警告つき) | 0.04999999999999999 (極限は 0.05 + 1e-155)。0.25951102284186195 (修正前は 0.2591899066123998、1e32 以上では 0)。有限の u + v が溢れるときだけ、非心度を 2 f2 (u / 2 + v / 2 + 0.5) で計算する。両方の自由度が 1e16 を超えると F の臨界値は double で 1 より先の桁が数桁しか残らない (約 1e33 より上では 1 に丸まる) ので、F の正規近似 (平均 1 + ncp / u、分散 2 (1 + 2 ncp / u) / u + 2 (1 + ncp / u)^2 / v) の検出力を返す。近似の誤差は O(1 / sqrt(u)) で、Rmpfr と比べて u = v = 1e17 で 2.3e-9、1e20 で 7e-11 (厳密な経路の pf(qf(...)) はそれぞれ 1e-7、3e-6 ずれていた。R はそこで 1 を返し、警告が出る) |
| `pwr.anova.test(k = 1e160, n = 1e160, f = 1e-160)` (k n が溢れる。非心度は 1。issue #200)、`pwr.anova.test(k = 3, n = 1e308, f = 1e-154)`、`pwr.anova.test(k = 1e40, n = 2, f = 1e-10)` (両方の自由度が 1e16 を超える) | NaN。NaN。1 (pnchisq が収束しない警告つき) | 0.04999999999999999 (極限は 0.05 + 7e-82)。0.32152403656716766 (n = 1e300、f = 1e-150 の R の値は 0.3215240365671677)。0.259511022841444 (修正前は 0)。有限の値で k n f^2 が有限でないときだけ、4 つの因子を 2 の冪でそろえて掛ける。両方の自由度が 1e16 を超えるとき (k - 1 > 1e16) は、`pwr.f2.test` (#202) と同じく F の正規近似の検出力を返す |
| df が非常に大きい effectsize の `hedges_g` (Hedges の J を、df log df ほどの 2 つの lgamma の差で計算) | df = 1e10 で J が 0.99997 (相対誤差 3e-5)、1e14 で 1.28、1e16 で 1e-14。1e6 でも 3e-10 ずれる | lgamma の差を直接計算する (`lgammaDiff`)。大きな df では丸めの範囲で 1 - 3/(4 df - 1) |
| effectsize の `cohens_d(c(1, 1 + eps), mu = -1)` (t = 2^54 で t ± 1 が t に丸まる) と `hedges_g` | `optim` のエラー "function cannot be evaluated at initial parameters" | d 1.27e16、区間 [3.99e14, 2.86e16] (非心度の探索を t ± (1〜2 ulp) から始める) |
| 1e154 程度のデータの aov の effectsize の `eta_squared`・`omega_squared`・`epsilon_squared` (`Error()` 付きと afex の `aov_ez` も) | NaN (平方和が溢れる) | 単位を変えた同じデータと同じ値。当てはめたときの平方和 (応答を 2 の冪で割ったもの) を使い、比をとる前に共通の 2 の冪で割る |
| 共変量 x が 1e-200 や 1e200 程度の `aov(y ~ x + W + Error(id))`、共変量 z が 1e-200 程度の `Error(z)` | x はすべての層から消える (2 乗がアンダーフローする)。z は正しい | 単位を変えた同じデータと同じ表。処置と誤差モデルの各列を、列ごとの 2 の冪で割る (層は列が張る空間だけで決まる) |
| 残差自由度が次元より少ない `mauchly.test` (`mauchly.test(lm(cbind(c(1, 3), c(2, 7)) ~ 1))`) | NaN、または W = 0 で p = 1、または W 2e-17 で p 9e-4 (共分散はデータによらず特異) | エラー。検定には残差自由度が足りない |
| 検定する次元が 1 の `mauchly.test` (`X = ~1` で測定が 2 回、または `M` が `X` より 1 次元だけ大きい) | データによらず W = 1、p = 1 (1 次元は常に球面性を満たす。χ² の自由度 p (p + 1) / 2 - 1 が 0) | エラー。検定する次元が 1 で、検定の自由度がない (issue #342) |
| 打ち切り時刻が `Inf` の `coxph(Surv(time, status) ~ x)` | "NA/NaN/Inf in foreign function call" | 当てはめを返す (その個体はすべてのイベント時点でリスク集合に入る。最後のイベントより後の打ち切りと同じ) |
| 共変量が 1e308 規模かサブノーマルの `coxph(Surv(time, status) ~ x)` (x の 2^1020 倍、2^1022 倍、2^-1060 倍) | 2^1020 倍で se 0、2^1022 倍と 2^-1060 倍で "Loglik converged before variable 1; coefficient may be infinite" (中心化・尺度化の和が溢れる) | x の当てはめと同じ検定と対数尤度、係数と se は 2^-k 倍 (2^-1060 倍では double の範囲外で -Inf と Inf) |
| 線形予測子が exp の範囲を超える初期値の `coxph(Surv(time, status) ~ x)` (x = 0, 1 や 0, 2 で `init = 1000`、`iter.max = 0`) | 対数尤度 -Inf (x = 0, 1) か "initial values lead to overflow or underflow of the exp function" | 有限の対数尤度 (-1000、-2000)。リスク集合の和を e^-m 倍で持ち、m は有限の exp(eta) が溢れるときだけ動かす。そのような飽和した値から反復すると、係数は NaN のまま (survival は NA) |
| `qr(x, tol = Inf)` | "NA/NaN/Inf in foreign function call" | rank 0 (すべての列を従属とみなす) |
| `rgeom(n, 5e-324)` (約 5.6e-309 未満の prob)、p < 1 の `rnbinom(n, Inf, prob = p)` | NA。約 9e307 (size = MAX / 2 での値) か NA | Infinity。値は double の最大値を超える (rgeom は 1e-15 未満の確率を除いて。rnbinom は確率がすべて無限遠にあり、dnbinom・qnbinom と整合)。同じ乱数を引くので、乱数の状態は R と同じ |
| `rbeta(n, 1e308, 1e308)` など、約 1e154 を超える形状 (2ab が溢れる) | 0 (Algorithm BB の定数が溢れる) | 平均 a / (a + b)。分布は 1e-77 以内に集中している。同じ一様乱数を引くので、乱数の状態は R と同じ |
| `rbeta(n, 0, 0, ncp = 0)` (ncp > 0 でも Poisson の回数 0 の成分) | NaN (0 / 0) | 確率 1/2 ずつ 0 か 1 (Beta(0, 0))。非心でない `rbeta(n, 0, 0)` と同じ。ここで一様乱数を 1 個引く (R は引かない) |
| `dhyper(1, 1e308, 1e308, 1)`、`phyper`、`qhyper`、`rhyper(n, 1e308, 1e308, 1)` (m + n が溢れる) | NaN。rhyper はすべて 0 | 0.5、0.5、…。k / (m + n) が 2^-60 未満なら超幾何分布は倍精度で二項分布 Bin(k, m / (m + n)) と同じなので、それを使う (m / (m + n) は和を作らずに計算)。rhyper は 1 個ごとに一様乱数を 1 個引く (R は引かない) |
| `dnbinom(0, size = 1e308, mu = 1e308)` | 1 | 0 (= 0.5^1e308。和が溢れるときは size と mu の比から p と q を求める) |
| `qt(0.5, 10, ncp = Inf)` | NaN (p によっては Inf)。ただし `pt(t, 10, ncp = Inf)` はすべての有限の t で 0 | Inf。確率はすべて +∞ にある (ncp = -Inf なら -Inf)。df = Inf の場合と同じ |
| `pbeta(-1, 0, 2)`、`pbeta(-1, 0, 0)` (形状が無限大のときも) | 1、0.5。点質量を q <= 0 より先に判定するので、台より左で分布関数が正になる | 0 |
| 有限の x > 0 での `dweibull(x, shape, scale = Inf)` | NaN (Inf × 0) | 0 (log は -Inf)。極限の値 |
| `qnorm(0.5, 3, Inf)`、`qlnorm(0.5, 0, Inf)`、`qlogis(0.5, 3, Inf)` (尺度が無限大のときの中央値) | NaN (Inf × 0)。ほかの p では極限の値 (±Inf、`qlnorm` では 0 と Inf) を返し、`pnorm(3, 3, Inf)` は 0.5 | 位置パラメータ (3、`qlnorm` では exp(meanlog) = 1)。極限の値 |
| `dbeta(0.5, 1e308, 1e308)` など、形状の和が溢れる場合 | NaN | 1.128e154 (log は 354.72)。半分の形状で指数を求めて 2 倍する (偏差は同次) |
| `dbeta(1, 1.5e308, 1, ncp = 1.5e308, log = TRUE)` (x = 1 の密度 a + ncp/2 は溢れるが、その log は溢れない) | -Inf | 710.0071388583824 |
| `dbeta(0.5, 0.75, 5e-324, ncp = 0.1, log = TRUE)` (サブノーマルの形状) | -Inf | -743.5986379456813: 混合の j = 0 の項を残す (a/b を作らずに log(1 + a/b)) |
| `pf(1e150, 1e150, 1e308, lower.tail = FALSE, log.p = TRUE)` と `df(..., log = TRUE)` (m x が 1e290 を超え、n がさらに大きい) | -Inf | -4.999999975e299: m x と n をともに 2^600 で割ってベータの座標を作る |
| mvtnorm の `pmvnorm(c(-1e200, -1e200), c(Inf, Inf), corr = ...)` など、2 変量正規の巨大な有限の境界 (`pbvnorm`) | NaN | 1 (`c(1e200, 1e200)` では 0): ±40 を超える境界は無限とみなす (Φ(-40) = 3.7e-350) |
| extraDistr の `qtriang(-1000, 0, 1e308, 0, log.p = TRUE)` (最頻値が端、exp(p) が double の範囲より下) | -Inf | 2.5379794487747283e-127 (w exp(p/2)^2 / 2) |
| `dlogis(0, 0, 1.282987806042392e308)` などの x (scale (1 + e)^2 が溢れる) | 0、log でも -Inf | 1.95e-309 (log -710.83): 尺度での割り算を最後に |
| 形状の和が溢れる場合の、平均付近の `qbeta` (`qbeta(0.5, 1e308, 1e308)` など)。`pbeta(0.4999999999999999, 1e308, 1e308, log.p = TRUE)` | NaN ("NaNs produced")。−3.98e276 | 0.5 (対称なベータ分布の中央値)。−4.93e276 = −a log(1 − 4 d^2)、d = 2^-53。不完全ベータ関数の一様漸近展開を半分の形状で計算し、偏差と m を 2 倍する (平均付近の pbeta はここで NaN だった) |
| 小さい x の `pwilcox(x, 1050, 1050, log.p = TRUE)` など、確率が 1e-308 を下回る下側の裾 (`pwilcox(1000, 600, 600, log.p = TRUE)` も) | −Inf (確率を C(m + n, m) で割り、その値が溢れる) | −1451.558 (x = 0)、−752.510 (600 の場合)。確率の表を、最大の項が 2^760 を下回ったら 2 の冪で拡大する。dwilcox の log と同じ値 |
| `qcauchy(p, 3, Inf)` | すべての p で NaN。ただし `dcauchy`・`pcauchy` は極限の値 0 と 0.5 を返す | 中央値より下・中央値・上で -Inf、3、Inf。`qnorm`・`qlogis` と同じ |
| `lm(y ~ x, weights = rep(1e308, n))` (重み付きの平方和が double の範囲を超える) | R² NaN、F NaN | 重みを一律に何倍しても同じ値 (テストの例で R² 0.982)。sigma は倍率の平方根に比例する。平方和は重みを 2 の冪で割って作る |
| `integrate(f, 0, -Inf)`、`integrate(f, Inf, 1)`、`integrate(f, Inf, -Inf)`、`integrate(f, Inf, Inf)` | (0, Inf)、(-Inf, 1)、(-Inf, Inf)、(-Inf, Inf) での積分。無限大の端点の符号を見ない | (-Inf, 0)、(1, Inf)、(-Inf, Inf) での積分の符号を反転したもの、および 0 |
| upper − lower が溢れる `integrate`・`optimize`・`uniroot` (`uniroot(function(x) x, c(-1e308, 1e308))`) と、中点が溢れる `integrate` (`integrate(function(x) 1/x, 1e308, 1.1e308)`) | `integrate` は "roundoff error was detected" (中点が溢れる場合は、節点がすべて Inf になり、0 と誤差 0)。`optimize`・`uniroot` は警告 ("Inf replaced by maximum positive value") | x / 2 の座標で、半分にした区間で解く (`uniroot` は 0。以前ここでは -Inf を返し、`optimize` は終わらなかった) |
| deSolve の `ode(1, c(-1e308, 1e308), function(t, y, p) list(0), NULL, method = "euler")` (`"rk4"`、`rkMethod("rk2")` も) など、有限な時刻の差が溢れる場合 | NaN (1 + Inf × 0) | 刻みの半分から組み立て、h k を (h/2) k の 2 回の加算にする。傾き 0 なら 1 |
| numDeriv の `hessian(function(x) (x[1] / 1e100)^2 + x[1] / 1e100 * x[2] / 1e100, c(1e100, 1e100), method.args = list(d = 2e54))` など、刻みの 2 乗や 2 h_i h_j が溢れる場合 | 対角は 2.0007e-200 (最初の刻みの商が 0)、非対角は NaN | 2e-200 と 1e-200。刻みの積が溢れるときは、差を刻みで 1 つずつ割る |
| f(1) と f(2) が同符号で、その積がアンダーフローする `uniroot(f, c(1, 2), extendInt = "yes")` (1e-300 (x − 5)) | "f() values at end points not of opposite sign" | ほかの同符号の値と同じく区間を広げる (5) |
| 重み 0 の観測の逸脱度の寄与が 0 × Inf になる `glm` (poisson、y = 1e308) | 逸脱度が NaN | その観測は 0 を足す (逸脱度残差も 0) |
| x = 0 の `coxph(Surv(1, 1) ~ x)` など、対数尤度が 0 のまま変わらない当てはめ | "Ran out of iterations and did not converge" (判定 1 − 0/0 が NaN) | 収束 (対数尤度が変わらなければ収束とする) |
| `survdiff(Surv(c(1, 1), c(1, 1)) ~ c("A", "B"))` など、分散行列が特異になるデータ | "system is exactly singular" | 一般化逆行列を使い、自由度は rank(V) (結果の `df`)。群について情報がない (rank 0) ときは chisq 0、df 0、p NaN |
| 打ち切り時刻が `Inf` の `survdiff`・`survfit` | "NA/NaN/Inf in foreign function call" | その個体は最後までリスク集合に入る (`Inf` でのイベントはエラー) |
| 小さな単位の説明変数を含む lmerTest の `anova(fit, type = 1)` (type 2 も)。例: `lmer(y ~ x1 + I(x2 * 1e-6) + (1 \| g))` | x1 の type I の F が type II の F になる (13.96 が 14.45)。Doolittle 分解のピボットと要素を、データの単位のまま 1e-6 と比べるため。lmerTest のバグ (R 4.5.2 で実行して確認) | 単位によらず同じ検定 (分解を、対角を 1 に正規化した交差積行列で行う) |
| 行数は同じだが使った行や応答が異なる lmer の当てはめの `anova()` | 尤度比検定を返す | エラー (lme4 は行数だけを比べる) |
| `power.t.test(n = 10, delta = 1e308, sd = 1e308)` など、非心度は有限だが sqrt(n / ts) × delta が溢れる delta・sd | 検出力 1 (非心度が Inf) | 0.56198。delta = sd = 1 と同じ検出力 (積が溢れるときだけ比 delta / sd を先に作る) |
| `poisson.test(c(1e308, 0), r = 2, T = c(1, 1e308))` と `poisson.test(c(1e300, 0), r = 2, T = c(1e-10, 1e308))` (n r T1 と r T2 / T1 が溢れる場合の期待度数) | NaN (bgrat の警告つき)。0 | 1。1e-18。n r T1 / (T1 + r T2) を n、r、T1、T2 の仮数で計算し、2 の冪を最後に掛ける |
| y が 1e-6 を 99 個と 5000 の `summary(glm(y ~ 1, Gamma("log"), weights = rep(2e304, 100)))` など、分散パラメータは有限だが Pearson 残差の重みつき平方和が溢れる当てはめ (`glmAnova`・`glmPredict`・`glmRstandard`・`glmCooksDistance` も) | dispersion が Inf | 2.0e306。和が溢れるときだけ、各項を (sqrt(w) r)^2 とし、残差とその積を 2 の冪で割って和を取り、残差自由度で割ってから指数を戻す |
| `anova(glm(1e154 ~ 0, gaussian("log")), test = "Cp")` など、分散パラメータが double の最大値の半分を超える、パラメータのないモデルの Cp | Cp が NaN (2 × dispersion が溢れて 0 を掛ける) | 残差逸脱度の 1e308。罰則を 2 (n − df) × dispersion の順に計算する (R の順で溢れない範囲では同じビット) |
| y = 1e154 の `AIC(glm(y ~ 0, gaussian("log")))` など、逸脱度は有限だが 2 pi × 逸脱度が溢れる gaussian の当てはめ | Inf (`log(2 * pi * dev / n)`) | 真の値 714.034。2 pi × dev が溢れるときだけ log(2 pi) + log(dev / n)。それ以外は R の式 |
| `prop.trend.test(c(5e307, 5e307), c(1e308, 1e308))` と `prop.trend.test(c(1, 0), c(1e300, 1e300))` (度数の合計や重み n / (p (1 - p)) が溢れる場合) | エラー "NA/NaN/Inf in 'x'" (lm.wfit) | 統計量 0 (p 値 1) と 1。プールした比率を 2 の冪で割った度数から求め、重み n_i 2^-k で回帰して、統計量に 2^k を掛けて戻す。それ以外は R の式 |
| polycor の `polychor(matrix(8e307, 2, 2))` と `polychor(matrix(4e307, 2, 2))` (表の合計や対数尤度が溢れる場合) | 0.999859 ("Inf replaced by maximum positive value" の警告つき) | -1.67e-16 (すべて 1 の表と同じ値)。合計が 2^1000 以上のときだけ度数を 2 の冪で割る (rho と閾値は度数の単位によらない)。分散・カイ二乗・n は掛け戻す |
| `bartlett.test(list(c(1e200, 1.000000000000001e200), c(0, 1e-100)))`、`bartlett.test(list(c(1e200, 2e200, 4e200), c(1e-200, 2e-200, 4e-200)))` など、ある群の分散が最大の絶対値の二乗の約 2.2e-308 倍より小さい場合 | NaN | 874.084 (p 4.2e-192)、2945.09。共通の尺度で分散がアンダーフローするときだけ、各群の分散をその群の尺度で求め、分散とプールした分散 (log-sum-exp) の log を最大の尺度からの相対で計算する |

## 意図的な違い

### 全般

- **添字は 0 始まりです。** `sampleInt(n)` は 0..n-1 の値を返します (同じ乱数列から得た R の
  `sample.int()` から 1 を引いたもの)。`qr()` と `chol(x, { pivot: true })` の `pivot` も 0 始まりです。
  `sample(array, ...)` は R と同じく要素を返します。
- **行列の `cor`** は、列の自分自身との相関が定義されない対角を NaN にします。定数の列 (0/0) と、`use: "everything"` で
  欠損値を含む列です。R は列の中身によらず対角をすべて 1 にします (`cor(cbind(c(1, 1, 1), c(1, 2, 3)))` の [1, 1] が 1)。
  それ以外の対角は R と同じく 1 です。
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

- **意味のない入力はエラーにする** (R は値を返す場合でも)。たとえば `zTest` の 0 以下の既知標準偏差、
  `chisqTest` の無限大の確率、`cochranQTest` の二値でないデータ、`propTrendTest`・`polychor`・二列形式の
  二項 `glm` の負の度数、`icc`・`kappamFleiss` の被験者・評価者が 2 未満、`kappa2` の欠測のない組が 2 未満 (irr の `kappa2` は z と p が NaN。issue #309)、`tTest` で平均が 0 のときも含めて標準誤差が 0 (0 だけの標本や、対の差がすべて 0。"data are essentially constant"。R の判定はそこで `0 < 0` になり、t が NaN か ±Inf の結果を返す。issue #314)、`adTest`・`cvmTest`・`lillieTest`・`sfTest`・`pearsonTest` の無限の観測値 (nortest の `pearson.test(c(1:7, Inf))` は空の分類から P = 8、p = 0.0183 を返し、`sf.test` は NaN。ほかはエラー。issue #304)、`flignerTest` で中央値が無限の群 (偏差が Inf − Inf になる。R はその NaN を最後の順位にし、`fligner.test(c(1, Inf, 2, 3), c("a", "a", "b", "b"))` は 2.476、p 0.116。issue #329)、`propTrendTest` で異なる score が 2 個未満 (score がすべて同じか、score のある群が 1 つ。R の `prop.trend.test` は NA。issue #318。issue #50 の NaN を改めた)、`pwrChisqTest` の `df <= 0`、
  非有限または NaN の許容誤差 (`optim` の `reltol`、`uniroot`、`optimize`、`integrate`、`qr`、`chol`、
  `solve`、`coxph`、`glm`)、`optim` の SANN で正の有限値でない温度 `temp` (R は 0 で "non-finite value supplied
  by optim" で止まり、負の値は受け付ける)、`optim`・`optimHess` の無限大の `fnscale` (R の `optim` は開始値をそのまま value NaN、convergence 0 で返し、`optimHess` は NaN を返す。Issue #248)、
  `optim` (BFGS・CG・L-BFGS-B)・`optimHess` の解析的な勾配 `gr` の NaN・無限大の成分 (数値の勾配の検査と同じく "non-finite
  value of the gradient [i] supplied by 'gr'"。R は `gr` を確かめず、NaN の勾配では 1 歩も動かずに開始値を convergence 0
  で返し、`optimHess` は NaN の行列を返す。Issue #355)、`binomTest([0, 0])` (試行が 0。R の `binom.test(c(0, 0))` は p 値 1 を返す。
  `poissonTest` は事象数 0 どうしの比較を R どおり行う)、`factanal`・`omega` の `covmat` で、正方・有限・対称 (R の
  `isSymmetric` と同じ判定)・対角が正のどれかを満たさないもの (R の `factanal` は非対称な行列も分析する)、`poissonTest` の観察時間
  `T` が 0 (R は推定値と区間に NaN や Inf を返す)、`binomTest`・`poissonTest` でカウントの合計が溢れるもの (R は NaN かエラー)、`chisqTest` のシミュレーションで整数でない `B` や、合計が整数でない適合度検定の度数 (R の p 値は 1 を超えることがある)、`fisherTest` のシミュレーションで整数でない `B` (R は trunc(B) 個の表をシミュレーションし、B + 1 で割る。issue #278)、`mantelhaenTest(exact: true)` の小数の度数 (R は結果を返す)、`mcnemarTest` で不一致の組がない表、符号付き順位の `wilcoxTest` で差がすべて 0、`varTest` で両群とも定数、`chisqTest` の分割表のシミュレーションで小数の度数 (R は NaN を返すか、周辺度数を切り捨てる)、`dunnettTest`・`tukeyTest`・`glhtDunnett` で全群が定数 (プールした分散が 0。R の p 値は `TukeyHSD` と PMCMRplus で 0、multcomp の `glht` で 1)、`grad`・`jacobian`・
  `hessian` の 0 の刻み `eps` や、有限でない `d`・`eps`・`zeroTol` (numDeriv の "simple" 法は `eps = 0` で NaN を返す。`d = 0` は
  numDeriv でもエラー)、同じ 3 関数で刻み d abs(x[i]) が double の範囲を超えるもの (Issue #213) や 0 になるもの (x[i] = 0 で `zeroTol: 0`。
  Issue #246) (numDeriv は `grad` が f の値の検査でエラー、`jacobian` と `hessian` は NaN)、`TukeyHSD` の [0, 1] の外か NaN の `confLevel` (R は区間の端に NaN を返す。0 と 1 は R と同じく受け付ける)、`TukeyHSD` で各群の値が 1 個 (残差自由度が 0。R は区間の端と p 値に NaN を返す。issue #315)、`TukeyHSD`・`tukeyTest` で残差自由度が 1 (`ptukey`・`qtukey` のスチューデント化範囲の分布は R と同じく自由度 2 から。R は NaN、PMCMRplus は NA。issue #315)、
  `cut` で (NaN を除いて) 2 個未満の区切り (R は NA の区間番号を返す。1 個は R でもエラー "invalid number of intervals"。無限の区切りは
  R と同じく受け付ける)、`hist` の無限か NaN の区切り (R は無限の幅のセルに密度 0 と無限か NaN の中点を返す)、`approx` の 1・2 以外の
  `rule` (R は 3、0、1.5 など 1 以外の値をすべて rule 2 として扱う)。
- **検出力と効果量の関数**は、既知の量の NaN (pwr はたいてい "missing value where TRUE/FALSE needed" で止まる。
  以前は NaN を返していた)、`pwrRTest` の [-1, 1] の外の相関、`esH`・`esW1`・`esW2` の [0, 1] の外の確率 (R は NaN)、
  `esW2` の空や不整形の行列 (R は 0)、`powerPropTest` の n <= 0 (R は n = 0 で検出力を返し、負なら NaN)、`pwrTTest` の
  n < 2 (pwr と同じ) をエラーにします。`delta = 0` で `sd` を、`betweenVar = 0` で `withinVar` を求めるときは、検出力が
  それによらないことをエラーで伝えます (R は "lower < upper is not fulfilled")。効果がないときに `n` を求める場合
  (`powerTTest` の `delta = 0`、`powerPropTest` の `p1 = p2`、`powerAnovaTest` の `betweenVar = 0`) も同じです (R は
  "no sign change found" か "f() values at end points not of opposite sign"。Issue #311)。探索区間が 1 点になる
  `powerPropTest` の `p2 = 0` での `p1`、`p1 = 1` での `p2` も同じです (R は "lower < upper is not fulfilled"。Issue #312)。`cohensD` は、無限大の値と、(群ごとに)
  2 個未満の観測をエラーにします (effectsize は NA)。

### 分布

| ケース | R | rStats.js |
|---|---|---|
| `qbeta` の答えがアンダーフローする (たとえば `qbeta(0.5, 1e-10, 2.5)`) | 2^-1024 (5.56e-309) | 0 |
| `qf` の答えがオーバーフローする (たとえば `qf(-1e-300, 1, 1, log.p = TRUE)`) | 2^1023 付近の有限値 | Inf |
| df = -5e-324 (最小の負の非正規化数) の `dchisq`・`pchisq`・`qchisq` | df / 2 が -0 に丸められ、0 の 1 点分布になる。Inf、0、1、0 | NaN (負の df は定義されない) |
| size が整数でない `qbinom` (たとえば 2.5) | size を整数に丸める (偶数への丸め: 10.5 は 10、11.5 は 12)。`dbinom`・`pbinom`・`rbinom` はその size で NaN | NaN (`dbinom`、`pbinom` と同じ) |
| max − min がオーバーフローする一様分布 (min = -1e308、max = 1e308) | Inf / 0 / NaN | 両端を半分にして計算 (`dunif` は 5e-309、`punif(-1)` は 0.5、`qunif(0.5)` は 0) |
| 重みは有限だが合計がオーバーフローする `dmultinom` (`dmultinom(c(1, 1), prob = c(1e308, 1e308))`) | 0 (log は -Inf) | 0.5 (log は -0.693)。重みを 2 の冪で割ってから合計する |
| ある区分の重みの割合が double の範囲より小さい `dmultinom` (`dmultinom(c(1, 0, 0), prob = c(5e-324, 1, 1), log = TRUE)`) | -Inf | -745.133 (log 5e-324 − log 2)。その区分の項を割合の log から作る |
| size = Inf の `dnbinom` | prob < 1 で -1.2e308 のような有限の対数確率。prob = 1 で log P[X = 0] が NaN | -Inf と 0 |
| size = Inf かつ prob < 1 の `qnbinom` | p によって Inf または NaN | 常に Inf (質量は X = ∞ にある。p = 0 と 1 は R と同じ) |
| 答えが 2^53 を超える `qnbinom` | 分布関数が目標に届かない答え (目標 −32 に対して log p が −31.85) | 目標を満たす答え |
| p が微小 (1e-15 程度未満)、上側の p が小さい、または log p が深い `qsignrank`、`qwilcox` | 線形の下側 p に変換して絶対許容幅 10ε で比べるため、0 などを返す (`qsignrank(1e-100, 1000)` は 0) | 定義どおりの答え (69727) |
| `log.p = TRUE` かつ p = -Inf の `qsignrank`、`qwilcox`、`qhyper` | NaN | p = 0 と同じ (台の下端) |
| n = Inf の signrank、m = Inf の wilcox | クラッシュ | NaN |
| パラメータが無限大の非心 `qbeta` (たとえば shape2 = Inf) | NaN 上の探索から 0、0.5、1 | NaN |
| `qchisq(p, 0, ncp = 0)` (質量がすべて 0 にある) | NaN または Inf | 0 |
| `qgamma` と `pgamma` (上側の log) で q / scale が double の最大値を超え、答えは有限な場合。shape が約 1e307 以上 (q / scale が最大値をわずかに超えるだけなら約 1e290 以上) で起きる (`qgamma(-1e308, 1e308, scale = 1e-308, lower.tail = FALSE, log.p = TRUE)` の真の値は約 3.146、`pgamma(1.8, 1e308, scale = 1e-308, lower.tail = FALSE, log.p = TRUE)` は約 -2e307) | Inf、-Inf | NaN (計算しない。標準化した x が double の範囲の外にある。以前は誤った 1.797 と -Inf、issue #368)。scale >= 1 なら分位点は R と同じく Inf |
| r が非正規化数 (約 5.6e-309 未満で、1 / r が溢れる) の `pgamma(Inf, shape, rate = r)` | NaN | 1 (定義により P[X ≤ Inf] = 1) |
| 0 < q / s < 1 の `pgamma(q, Inf, scale = s)`、つまり 0 < q < 2 の `pchisq(q, Inf)` (質量がすべて +Inf にある) | NaN | 極限値: 下側 0、上側 1 (ほかの有限の q で R が返す値と同じ) |
| `df(0, df1, Inf, ncp, log = TRUE)` | 線形の値の対数にならない (ncp = 0 で −1.386。線形の値は 1) | 線形の値の対数 |
| 答えが丸めで 0 になる、df2 = Inf の `qf` | 2e-130 のような意味のない値。log p = -1e-300 で Inf | 分布関数で確認した値 |
| 整数 k の少し下の q (k − 1e-7 ≤ q < k − 1e-9 max(1, k)。k < 100 の場合だけ) の `pgeom`・`pnbinom`・`ppois`・`pbinom`・`phyper`・`pwilcox`・`psignrank` と `ansari.test` の正確分布 (`pgeom(0.99999999, 0.5)`) | floor(q + 1e-7) = k なので P[X ≤ k] (0.75)。密度関数はこの q を整数でないとみなす (`dgeom` は 0) | P[X ≤ k − 1] (0.5)。q 以下の最大の整数 |
| 小数部分が 0.5 以上の q の `psignrank` (`psignrank(0.6, 4)`) | q + 1e-7 を最も近い整数に丸める: P[V ≤ 1] = 0.125 | ほかの分布関数と同じく P[V ≤ floor(q)] = 0.0625 |

離散分布の分布関数は、P[X ≤ q] を q 以下の最大の整数 k の P[X ≤ k] とします。整数から
min(1e-7, 1e-9 max(1, |q|)) 以内の q はその整数とみなします (計算で作った 2.9999999999999996 は 3)。q < 100 では、これは
`dpois`・`dgeom`・`dnbinom`・`dhyper`・`dwilcox`・`dsignrank` が x を整数かどうか判定する規則と同じです。q ≥ 100 では幅を
R と同じ 1e-7 にとどめ、1000 − 5e-7 のような q を整数とみなしません (`ppois(1000 - 5e-7, 1000)` は R と同じく P[X ≤ 999])。それ以外の q は
floor(q) です。R は floor の前に 1e-7 を足す (`psignrank` では最も近い整数に丸める) ため、分布関数が整数の
1e-7 手前で段を上がり、密度関数と食い違います。変わるのは整数から 1e-7 以内の q だけで、`psignrank` だけは
小数部分が 0.5 以上のすべての q が変わります (Issue #145・#146)。25 回目のレビューでは `pbinom` の
floor(q + 1e-7) を R と同じ処理として残しましたが、正しい値と密度関数との一致のためにこの判断を改めました。

非常に平坦な `qnbinom` のケース (size = 1e-10、p = 1 − 1e-10 など) では、p の丸め幅に数十個の整数が
含まれるため、答えが R と数十ずれることがあります。どちらの答えも、分布関数が p から 16ε 以内にある
ことを確認しています。

R の `dgeom` と `dnbinom` は、|x − round(x)| > 1e-9 max(1, |x|) のとき x を整数でないとみなします。
rStats.js の `dpois` と `dbinom` は 1e-7 のしきい値を使うため、整数の近くで R と異なる可能性があります
(未検証)。

- **R にない分布**は extraDistr の名前と母数を使います。`darcsine`・`parcsine`・`qarcsine`・`rarcsine`
  (extraDistr に無い) はベータ(1/2, 1/2) を (a, b) に移したものです。b − a が溢れる場合 (a = -1e308、
  b = 1e308) は、半分にした尺度で計算します。無限大の形や位置の母数は極限として
  扱います。extraDistr の式はその端で NaN や外れた値を返します (`qkumar(0, Inf, 1)` は extraDistr で 1、
  ここでは 0)。x と無限大の位置が同じ符号の無限大 (`plaplace(Inf, mu = Inf)`) では極限が定まらないので、
  extraDistr と同じく NaN です。`qinvgamma` は `dinvgamma`・`pinvgamma` と同じく alpha <= 0 で NaN を返します (extraDistr の
  `qinvgamma` は alpha を確かめません)。乱数は分位関数に合わせます。無限大の形の母数 a・alpha は極限
  (`rkumar` は 1、`rpareto` は b、`rinvgamma` は 0。extraDistr と同じ) で、`rkumar`・`rpareto` の b と
  `rinvgamma` の beta が無限大なら、密度・分布・分位関数と同じく NaN です (extraDistr は 0 か Inf)。乱数は
  extraDistr と同じ数だけ引きます。`rlaplace` も同じく、無限大の mu は極限 mu (extraDistr と同じ)、sigma = Inf は
  `qlaplace` と同じく NaN です (extraDistr は符号に応じて -Inf か Inf)。extraDistr が引く指数乱数と一様乱数は引きます。
  `rtriang` の端点が無限大なら `qtriang` と同じく NaN です (extraDistr は b = Inf で c が有限なら Inf)。extraDistr が
  引く 2 個の一様乱数は引きます。
- **`distSummary`** の決まり: 存在しないモーメントは NaN、無限のモーメントは Infinity。離散分布で等しい
  最大が 2 つあれば大きい方を最頻値とし、密度の最大が一意でなければ NaN です。

### 乱数

- `setSeed(seed)` のあとに任意の `r*` 関数や `sample` を呼ぶと、R の `set.seed(seed)` と同じ乱数列が
  得られます。離散値、`sample`、消費する一様乱数の個数は完全に一致します。連続値は 1e-13 程度
  (最大 1e-12) まで一致します。`Math.log`、`Math.exp`、`Math.pow`、`Math.tan` の最後のビットが
  V8 と glibc で異なるためです。
- **n min(p, 1 - p) >= 30 (アルゴリズム BTPE) の `rbinom` は、R の乱数列と一致しません。** R の rbinom.c の最後の受理判定は、
  log ix! と log (n - ix)! の Stirling 補正を、引くべきところで足しています (n = 60 で確率比の対数が最大 0.013 ずれる)。
  rStats.js は正しい符号を使うので、受理・棄却が変わる抽出があり、そこから先の乱数列が R とずれます
  (`set.seed(439); rbinom(1, 10000, 0.5)` は R が 5023、rStats.js が 4879)。`rmultinom` の二項乱数も同じコードを通ります。
- **片方の shape が巨大で、もう片方が 1e32 以下 (2ab が溢れる) の `rbeta` は、R の乱数列と一致しません。** R はそこで平均を返します
  (`set.seed(12); rbeta(5, 1.1, 1e308)` は 1.1e-308 が 5 個。変動係数は 0.95 なのに)。rStats.js は小さい方の shape m の
  Gamma(m) の乱数 G を引いて G / (G + B) を返します (double の精度でベータ乱数そのもの)。そのため、そこから先の乱数列が
  R とずれます。両方の shape が 1e32 を超えるときは、R と同じく R の乱数列のまま平均を返します。
- **p が 1.1e-16 未満の `rbinom`** (1 − p が 1 に丸まる): R の逆変換は (1 − p)^n = 1 から始まるので、成功の確率 n p
  (最大 1e-7) があるのに、どの抽出も 0 になります。rStats.js は exp(n log1p(−p)) から始めます。どちらも 1 回の抽出に
  一様乱数を 1 個使うので、乱数列は R のままです。一様乱数が exp(n log1p(−p)) を超えたところで、R が 0 のところ 1 を返します。
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
  `n1 + 1:n2` で取り出しており、`1:0` が `c(1, 0)` になるためです。値が 1 個の標本も同じ例外を投げます。lawstat は
  統計量・自由度・区間が NaN になります (分散の推定で n − 1 = 0 で割るため。issue #320)。
- **`pAdjust`** の Hommel 法は、`n` が整数でないと例外を投げます (R は値を返します)。また、空の `p`
  で n > 0 のときは空の配列を返します (R は 1 を返します)。
- **`fisherTest` (2 × 2) と `mantelhaenTest(exact: true)` の正確検定**は、度数の台の値の個数が 2^24 を超えると、何も確保
  する前に RangeError を投げます (`fisherTest` は min(a, d) + min(b, c) + 1、`mantelhaenTest` は層ごとの同じ和に 1 を
  足したもので、`exact: false` を案内します)。R は大きさによらず台全体を確保します。`fisher.test(matrix(1e7, 2, 2))`
  (2e7 + 1 個) は 45 秒かかり、度数 1e9 では配列 1 本が 16 GB になります。
- **`chisqTest` の適合度のシミュレーション (`simulatePValue: true`)** は、B と度数の合計の積が 2^27 (134217728 回の
  抽出、数十秒) を超えると、抽出の前に RangeError を投げます。それ以下では R の `sample.int` と同じ一様乱数で n 個ずつ
  引くので、p 値は R と一致します。R は B n 個をまとめて引き、確保できる限り受け付けます
  (`chisq.test(c(1e9, 1e9), simulate.p.value = TRUE, B = 1)` は 2e9 回の抽出。issue #287)。
- **`r2dtable` と、`chisqTest` (分割表) と `fisherTest` のシミュレーションの p 値**は、表を作るときに総数が 2^24
  (16777216) を超えると RangeError を投げます。Patefield の方法が総数 + 1 個の対数階乗の表を使うためです (上限で
  128 MB。上の正確検定と同じ 2^24)。R は総数 2147483647 まで表を作ります (`r2dtable(1, c(5e8, 5e8), c(5e8, 5e8))` は
  8 GB)。`r2dtable(0, ...)` は表を作らないので、R と同じく総数 2147483647 まで受け付けます (issue #285、#286、#336)。
- **`ksTest`・`ansariTest`・`corTest` (Kendall)・`jonckheereTest` の正確な p 値と、`pAdjust` の Hommel 法**は、計算に
  数秒より長くかかる大きさでは、何も確保する前に RangeError を投げます (上限は開発機での計測から決めました。`ksTest`
  の n < 100 などの既定の切り替えは、上限よりずっと小さい)。`ksTest(exact: true)` (1 標本、両側、D < 1/2) は大きさ
  m = 2 floor(n D) + 1 の行列を n 乗し、m^3 と行列の積の回数の積が 2^33 まで (n 1023 で m 781、3.6 秒) です。
  `ansariTest(exact: true)` (同順位なし) は分布に 2 (m + 1) (floor((N + 1)^2 / 4) + 1) 個 (N = m + n) の double を使い、
  これが 2^24 まで、手数 (その半分の N 倍) が 2^32 まで (m = n = 202 で 5.3 秒) です。`corTest(method: "kendall",
  exact: true)` (同順位なし) は n が 1290 まで (手数は約 n^3 / 2、4.9 秒。Spearman の正確検定の上限と同じ数) です。
  `jonckheereTest(exact: true)` (同順位なし) は Mann-Whitney の分布の畳み込みの値の個数が 2^24 まで、積和の回数が
  2^32 まで (215 個ずつの 3 群で 8.5 秒) です。`exact: false` を案内します。`pAdjust(method: "hommel")` は n が
  65536 まで (手数は O(n^2)、5.7 秒) です。R は時間がかかっても計算します (issue #307、#308、#316、#321、#391)。
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
  対比は `contr.treatment` (既定)、`contr.sum`、`contr.helmert` です (`lmer` では `contr.poly` も)。解析できない formula は、
  R の構文エラーの代わりに "invalid formula: ..." を投げます。
  変数名は、Unicode の文字、文字の数字 (Ⅰ など)、`.`、ASCII 以外の数字のどれかで始まり (`.` と ASCII の数字は数の
  始まりです。`_` では始められません)、文字、記号でない数字、結合文字、`.`、`_` が続きます (`転帰 ~ 年齢` が使えます)。
  これは Windows 版 R より広い範囲です。Windows 版 R は、結合文字 (`नमस्ते`、母音記号のあるタイ文字、分解した é) と
  BMP の外の文字 (`𝐀`、CJK 拡張 B) を名前に含めません。Linux 版 R はどちらも含めます。
- **当てはめの警告** (`lm`、`Error()` の有無によらない `aov`。"Error() model is singular" や、`contrasts` に指定した変数が式にない
  場合など) は、`anova` (比べるすべての当てはめのもの)、car の `Anova`、`aovSummary`、それらから計算した効果量の結果にも、
  同じ警告を 1 回ずつ引き継ぎます (R は当てはめのときだけ警告を出します)。
- **`dunnTest`** は値を数として順位づけます。dunn.test 1.4.2 は、群を文字列のベクトルで渡すと値を文字列として
  順位づけ (10.06 が 8.88 より前)、因子で渡すと数として順位づけます。`dunnTest` は後者を再現します。
- **R がデータの表示で締めくくる `aovEz` のメッセージ** (欠測値で除いた id、被験者内の空のセル、
  被験者間の空のセル) は、表示の手前で終わります。
- **`aovEz` の欠測値**: 応答が `null` か `NaN` ならその id を除きます (afex の "Missing values for ... ID(s)")。応答の
  無限大はエラーです。id や因子が欠測の行は除きます。被験者内の項の誤差 SSP 行列が特異なときは、その p 値が未補正である
  ことを警告します (afex は何も出しません)。被験者内因子が 1 水準なら、被験者間因子と同じくエラーです (afex は空の表を返します)。
- **`aovEz` で `between` や `within` に同じ因子名が重複するとき、または両方に同じ名前があるとき**はエラーです
  ("duplicated factor names in 'between': A"、"factors in both 'between' and 'within': A")。afex の `aov_ez` は重複を
  黙って除き (`between = c("A", "A")` は 1 因子の表)、両方にある名前では "No observations remain after removing
  missing values" で止まります。重複した名前は打ち間違い (別の因子のつもり) なので、小さいモデルとして当てはめません。
- **誤差 SSP 行列が特異なときの `aovEz`** (被験者数が測定数より少ない場合など): car は球面性の補正を出しません
  ("Singular error SSP matrix")。rStats.js は補正ごとに条件を判定します。Greenhouse-Geisser の ε = tr(A)^2 / (p tr(A^2))
  は 0 でない A なら定義できるので出します。Huynh-Feldt は d - p GG > 0 のときだけ出します (それ以外は NaN。`correction: "HF"`
  のときは GG で補正)。Mauchly 検定は正則なときだけです。出せないものは警告します。誤差 SSP 行列の固有値は、最大固有値の
  1e-12 倍、またはワイド形式のデータの平方和の 1e-24 倍以下なら 0 とみなします。判定には (P'P)^-1 の計量での行列を使うので、
  対比の取り方によりません。そのため、データの丸めだけからなる誤差 SSP 行列 (y = s_i + c_j で s_i = 0.3, 1.7, ... のような、
  小数の加法的なデータ) は 0 とみなし、どの尺度でも補正と Mauchly 検定を出しません。car も通常の尺度では出しませんが、
  固有値の絶対しきい値のため、同じデータを 1e100 倍すると W = Inf、p = 1 を返します。
- **`Anova` (型 II・III)** は、残差平方和が応答の全平方和 (中心化・重み付き) の sqrt(eps) 倍未満のとき "residual sum of squares
  is 0 (within rounding error)" とします。car は sqrt(eps) そのものと比べるので、単位に依存します。
- **`nextRNGStream`** は、`setRandomSeed` が復元できる L'Ecuyer-CMRG の種別コード 10407 と 407 だけを受け付けます (R は末尾が 07 の
  どのコードも受け付ける)。
- **分布を定義しないパラメータの乱数**は、R が乱数を引くか 0 を返すところで NaN を返します: 負 (または NaN) の shape と scale 0 の
  `rgamma`・`rweibull`、負の scale の `rlogis`。R が引く一様乱数は同じく引くので、呼び出し後の乱数の状態は R と同じです。
- **`setRandomSeed`** は、Mersenne-Twister の状態で、位置が負・整数でない・2^31 − 1 を超える (R の整数の `.Random.seed` も持てない) もの、
  状態語が 32 ビット整数でないものを拒否します。R は負の位置をそのまま受け取り、最初の乱数でその位置の欄自体を状態語として読みます。
  位置 0 と 624 を超える位置は、R と同じく次の乱数で再生成します。
- **`rwilcox`** は、R で順位の配列の確保に失敗する場合に "m + n must be at most 2147483647" を投げます。
- **`rsignrank`** は、丸めた n が 2^27 以上なら、乱数を引く前に "n must be less than 2^27 (134217728)" を投げます (#407)。
  順位ごとに一様乱数を 1 個引くので、2^27 で約 4 秒 (L'Ecuyer-CMRG で 8 秒) かかります。上限は `dsignrank` の定義域と同じです。
  R は 2147483647 まで回し (約 1 分)、整数の範囲を超えると乱数を引かずに 0 を返します。
- **当てはめの比較** (lm の `anova(fit1, fit2)`、複数の当てはめを渡した `glmAnova`) は、使った行・応答の値・重みが同じことを
  求めます。R は行数だけを比べます (glm では応答の式が違う当てはめを除きます)。`lmerAnova` も同じ確認をします。
- **(0, 1) の外の信頼水準**は、lm の `confint` と `predict` (R は NaN の限界、負の水準では別の被覆率の区間を返す) と効果量
  (`cohensD`、`etaSquared` など。effectsize と同じ) でエラーです。
- **`qr`** は負の `tol` を拒否します (R は受け付け、どの列も従属にならない)。`tol: Infinity` は rank 0 です。
- **分散成分が異なる当てはめを比べる `lmerAnova`** は、lme4 と同じくカイ二乗分布を使います。帰無仮説の値 0 が境界にあるので
  p 値は保守的です (参照分布はカイ二乗の混合。ランダム切片 1 つなら 0.5 χ²_0 + 0.5 χ²_1)。
- **R が通してしまう意味のない入力**はエラーです: `chisqTest` の無限大の度数 (R は NaN)、`glm` の無限大の offset (R は作業応答で
  止まる。rStats.js は係数 0 を返していた)、`ksTest` で [0, 1] の外の値を返す分布関数 (R は 1.5 を返す関数で D = 1.5、p = 0)。
- **`glmAnova`** は、分布族や link が違う当てはめを拒否します (R は最初の当てはめの分布族をすべてに使う)。
- **`glmConfint`** は、当てはめ、またはプロファイルの制約付き当てはめが収束しないとき、その限界を NaN にします。
- **逆ガウス分布族**は平均が正であることを求めます (R の validmu はどの値も受け付ける)。反復の途中で平均が 0 以下になるステップは
  半分にします。R はそのまま作業重みが NaN になります。
- **入れ子でない当てはめの `lmerAnova`** (小さい当てはめの固定効果の列が大きい当てはめにない、またはランダム効果の項が大きい
  当てはめの同じグループの項に含まれない。例: `(1 | g)` と `(1 | h)`) は Chisq と p 値を返しません。lme4 はどの組にも尤度比
  検定を返します。AIC と BIC は従来どおり比べられます。
- **`coxph`** は、`survdiff`・`survfit` と同じく、`Inf` での打ち切りを最後までリスク集合に入れ、`Inf` でのイベントを拒否します
  (R は無限大の時刻があると止まる)。
- **非心の `pbeta`** は、台の端より先にパラメータを確かめます。負の形状、負または無限大の ncp は NaN です (R は q <= 0 や q >= 1
  なら 0 か 1 を返し、非心でない `pbeta` は NaN)。形状 0 (点質量) は、R と同じく端の値を返します。
- **`qnbinom`** は、`dnbinom`・`pnbinom` と同じく、負の size や mu で NaN です (R の `qnbinom` は、それを確かめる前に mu = 0 や
  size = 0 で 0 を返す)。
- **`qgamma`・`qchisq`** は、密度や分布関数と同じく、負の形状や自由度、0 以下の scale で、p = 0 と 1 でも NaN です (R はそこで
  0 と Inf を返す)。
- **`qgeom`** は、ほかの離散分布の量子関数と同じ許容幅 (p に相対 8ε、log 尺度で 2ε) を、それが 1 段の半分未満のときだけ使い、
  それ以外は与えられた p に対して厳密な答えを返します。`qnbinom` の size = 1 と一致します。R の閉じた式は log の比から 1e-12
  を引くので、跳びより相対 1e-12 まで上の p で y − 1 を返します。`qgeom(0.7500000000000866, 0.5)` は R で 1 ですが、
  P[X <= 1] = 0.75 < p です (ここでは R の `qnbinom(p, 1, 0.5)` と同じ 2)。`qgeom(0.8757104766401955, 1.1843097327690854e-6,
  lower.tail = FALSE)` は R で 112065 です (p は `pgeom(112064)` で、ここと R の `qnbinom` は 112064)。
- **`phyper`・`qhyper`** は、台が 2^53 を超えると NaN です。裾の和は整数を 1 つずつ進むので、そこでは進まなくなります
  (`phyper(5e16, 1e17, 1e17, 1e17)` は終わらなかった)。2^53 未満では時間が sqrt(m + n) に比例し、1e16 で 40 秒ほどです。
  同じく、m + n が double で厳密でないとき、`dhyper`・`phyper`・`qhyper` は台の中で NaN です (`dhyper(0, 1, 1e16, 1e16)`:
  母集団 1 + 1e16 が k = 1e16 に丸まり、R は x = 1, 0 で 1, 0 を返す)。台の端と二項分布の極限 (k / (m + n) が 2^-60 未満) は
  値を返します。
- **`dwilcox`・`pwilcox`・`qwilcox`** は、mn が 2^53 を超えると NaN です。統計量は 0..mn の整数をとり、そこでは整数がすべては
  double で表せません (上の `phyper` と同じ)。表は、項が 1 つでも min(m, n) 回の段で作るので、`dwilcox(0, 1e12, 1e12)` は
  50 分ほどかかるところでした。
  判定は厳密な積で行います。m = 3、n = 3002399751580331 (mn = 2^53 + 1 で、double では 2^53 に丸まる) も NaN です。
  同じく **`dsignrank`・`psignrank`・`qsignrank`** は、n(n + 1)/2 が 2^53 を超える n ≥ 2^27 で NaN です (R の `psignrank(5, 134217733)` は 2 分で終わらなかった)。
- **`omega`** は、minres の当てはめ (L-BFGS-B) が収束しないとき警告を出します ("minres did not converge ...")。psych の `fa` は
  何も言わずに最後の点から先へ進みます。値は同じです。
- **`mauchlyTest`** は、`y` に欠測値がある行と `group` が欠測の行を除きます (`lm(y ~ group)` と同じ)。無限大はエラーです。
- **残差自由度がないときはエラー**: `aovEz` (被験者数が被験者間のパラメータ数以下) と `mauchlyTest` (完全な行の数が群の数
  以下)。R は NaN を返します。
- **`icc`、`cronbachAlpha` など評価行列を受け取る関数**は、無限大を拒否します ("contains infinite values")。
- **`poissonTest`** の `T` と `r` は有限値が必要です (R は `Inf` を受け付けます)。1 標本の検定は R と同じく `confLevel` の
  0 と 1 を受け付けます (2 標本の検定は `binomTest` と同じく 0 < `confLevel` < 1)。

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
  ます)。`valuesFn` で要約してください。`pivotLonger` で、名前 (`namesTransform` の後) が同じキーに同じ `".value"`
  の列を 2 回与えるとエラーにします (tidyr はそれぞれに行を作ります。issue #444)。正規表現 (`namesSep`、
  `namesPattern`) は JavaScript のものです。
- **`merge` と `cbind`** は列の名前が重なるとエラーにします。R は許しますが、列のオブジェクトでは同じ名前の列を
  2 つ持てないためです。

### 線形モデル

- **重みがすべて 0 の `lm`** は "all weights are zero" で例外を投げます。R は NA の係数を返します。
- **無限の重みを持つ `lm`** は "non-finite weights not allowed" で例外を投げます (`glm` と同じ)。R は列のあるモデルでは
  "NA/NaN/Inf in 'x'" で止まりますが、列のないモデル (`y ~ 0`) では残差 y、sigma Inf を返します (issue #302)。

### 一般化線形モデル

- **formula はありません:** `glm` は説明変数を行列 (またはベクトル) で受け取り、`intercept` が false で
  なければ 1 の列を先頭に加えます。応答はベクトル、二項分布の族では (成功数, 失敗数) の行でも渡せます。
  各列が 1 つの項です。`glmAnova` は列を 1 つずつ加えるので (行 `"x1"`、`"x2"`、...)、複数の列で表した
  因子は表の複数の行になります。係数の番号 (`glmConfint` の `parm`) は 0 始まりで、切片が最初です。
- **`glmAnova` は収束していないモデルについて警告します** ("model k has not converged: its deviance is not that
  of the maximum likelihood fit")。表の値は R と同じです。R の `anova` は、そうした当てはめも何も言わずに検定します。
- **`glmConfint` はプロファイル尤度の厳密な限界を計算します。** R の glm の `confint` は、各係数を
  標準誤差の約 1/5 の刻みで動かし、尤度比 (またはスコア) 統計量の符号付き平方根にスプラインを通して
  補間します。テストの fixture では、その限界は厳密な値から最大で標準誤差の 4.5e-4 ずれています。
  rStats.js は z(b) = qnorm((1 ∓ level)/2) を Brent 法で解きます。当てはめとプロファイルの各再当て
  はめは係数が変わらなくなるまで反復し (R の逸脱度の相対変化による判定では、係数がまだ sqrt(epsilon)
  程度動く段階で止まります)、分散パラメータも収束した当てはめのものを使います。限界は、テストの
  fixture の厳密な参照値 (R で同じように収束させた当てはめから計算したもの) と、標準誤差の 1e-14 まで
  一致します。
  信頼水準がごく小さいとき (cutoff が 2^-9 未満、level が約 1.6e-3 未満) は、cutoff を sqrt(2) erfinv(level) の
  級数で求め、限界は z = 0、±2^-9、±2^-8 での限界を通る逆プロファイルの補間で出します。逸脱度の差ではそれより
  小さい z を分解できないためです (相対誤差は約 epsilon D / z²)。限界は厳密な値と相対 1e-10 程度まで一致します
  (切片だけの binomial と Poisson の当てはめ)。R は level 1e-20 で [0, 0] (1 + level が 1 に丸まる)、1e-10 で
  相対 1.6e-4 ずれます。#179 の前の rStats.js は、そこで ±1.2533e-10 に対し [-7.2e-10, 1.5e-8] を返していました。
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
  平らなため)。lme4 の収束の警告 (`Model failed to converge ...`) は出しません。
- **局所解:** 基準には局所的な最小が複数あることがあります (たとえば固定効果の切片がない交差のモデルで、
  ある項が切片の代わりをする場合)。rStats.js は局所的な最小化の後で、変量効果の項を 1 つ外した (その分散を 0 にした)
  境界の点を、ほかの項について最小化したものと比べ、低ければそこから続けます。交差した項が 2 つの普通の場合は
  これで大域的な最小が見つかりますが、大域的な最適化ではありません。項が 3 つ以上あると、2 つの項が役割を入れ替える
  (切片の代わりをする項が入れ替わる) ことがあり、そのときは項を 1 つ外したモデルより基準が高いまま止まることがあります。
  lme4 が高い方の局所解で止まり rStats.js は止まらない場合、rStats.js は同じモデルの別の (よりよい) 当てはめを
  報告します (特異になることが多いです)。
- **特異な当てはめは、厳密な最適点で判定します。** 最適点が境界上にある θ の要素はちょうど 0 になり、
  `singular` と message `boundary (singular) fit: see help('isSingular')` はそれに従います。lme4 が境界の
  すぐ内側 (θ が閾値 1e-4 より大きい所) で止まる場合、lme4 は特異でないと報告しますが、rStats.js は
  特異と報告します。
- **列が 2 つ以上の項** (`(x | g)`): 先頭の列の分散が 0 に向かうと、共分散の因子の列の符号を変えても基準が
  変わらないため、lme4 の境界つきの最適化は最小でない点で止まることがあります。rStats.js はその境界なしで
  最小化し、同じ意味の因子で報告するので、そこでは lme4 より低い基準に達することがあります (同じモデルの、
  よりよい当てはめです)。
- **計算は lme4 と同じく疎行列で行いますが、JavaScript なので、** 当てはめの時間は lme4 のおよそ
  2.5〜3 倍です ([performance.md](performance.md) を参照)。

- **options を確かめます:** R の `lmer` にあって rStats.js が対応していない引数 (`weights`、`offset`、`subset`、
  `naAction`、`control`、`start` など) はエラーです。知らないキーもエラーです (`unused argument (reml)`。R は値も
  書きます)。lmerTest の `summary`、`contest`、`anova` は知らない引数を無視しますが (`summary` は警告つき)、
  `lmerSummary`、`lmerContest`、`lmerAnova` はエラーにします。真偽値の引数 (`REML`、`joint`、`confint`、`refit`) は、
  R と同じく真偽値と数 (0 は false) を受け付けますが、文字列は受け付けません (R は `"TRUE"`、`"F"` なども受け付けます)。
- **固定効果で完全に当てはまる応答** (切片のあるモデルで応答が一定、または固定効果の数が観測の数と同じ) はエラーです。
  残差の分散が 0 で、推定値がありません。lme4 は丸め誤差の大きさの σ と +∞ に近い対数尤度を返します (固定効果の数が
  観測の数と同じときは失敗します)。
- **列のない変量効果の項** (`(0 | g)`、`(0 || g)`) は、専用の文言のエラーです。lme4 は内部の文言で失敗します。

- **lmerTest の検定** (`lmerSummary`、`lmerContest`、`lmerAnova`) は、厳密な最適点で、逸脱度と固定効果の共分散の
  厳密な (解析的な) 導関数を使います。lmerTest は lme4 の近似の最適点で数値微分します。そのため Satterthwaite
  の自由度は lmerTest と有効数字 4〜8 桁目で違い (128 ビットで計算した参照値とは 1e-13 程度で一致します)、
  p 値もそれに応じて違います。ヘッセ行列の警告 (`Model failed to converge with ...`、`Model may not have
  converged with ...`) は厳密なヘッセ行列から判定し、当てはめのときではなく、各結果の `warnings` に返します。
  方法は Satterthwaite だけです (Kenward-Roger と、`lmerAnova` の `ddf = "lme4"` はありません)。`ranova`、
  `ls_means`、`difflsmeans`、`step` は実装していません。
- **`lmerContest` の `joint: false`** は、L の行ごとの右辺 (`rhs: [1, 0, 2]`) を受け付け、各行をそれぞれの値に対して
  検定します。lmerTest はそこでエラーになります。
- **`lmerContest` の無限大の L と rhs** はエラーです (lmerTest は L が無限大なら NaN の行、rhs が無限大なら F が Inf で p が
  0)。NaN は lmerTest の NA と同じく NaN の結果になります。`level` は lmerTest と同じく 0 より大きく 1 より小さい値です。
- **当てはめどうしの比較** (`lmerAnova([fit1, fit2])`): REML の当てはめは、最尤法の厳密な最適点へ当てはめ直します
  (lme4 の当てはめ直しはその手前で止まります)。どの当てはめも、同じデータのオブジェクトに対する `lmer` の結果で
  なければなりません。当てはめの間にそのオブジェクトの値を変えた場合もエラーです。`lmerAnova` の仮説と当てはめ直しは、
  R が当てはめ時のモデルフレームを使うのと同じく、当てはめ時のデータの複製から作ります。
- **結合 F 検定の分母自由度**で、個々の自由度が無限大の項は、その極限 1 (ν/(ν − 2)) として扱います。すべて無限大なら
  無限大です (lmerTest の式では NaN になり、すべて無限大だとエラー)。

### 線形代数

- **行列**は行の配列として渡します。0 行の行列は 0 × 0 として扱います。
- **`qrSolve`** は、解の NaN (応答の NaN から生じたもの) を残します。0 にするのは、分解で使わない列 (横長の
  行列の余り) の係数だけです。R の `qr.solve` は NA と NaN をすべて 0 にします (単位行列と b = (NaN, 1) で (0, 0))。
- **固有ベクトルと特異ベクトル**は R と符号が逆になることがありますが、どちらも正しい答えです。
  複素固有ベクトルは、絶対値が最大の成分が正の実数になるようにスケーリングします (R の `dgeev` は
  その成分を実数にするだけです)。重複した固有値や特異値に対するベクトルと、min(行数, 列数) を超える
  特異ベクトルは一意でなく、一般に R と異なります。
- **アルゴリズム:** `svd` は Golub–Reinsch、`eigen` は EISPACK のアルゴリズム `tred2`、`tql2`、
  `orthes`、`hqr2` を使います (R は LAPACK の `dgesdd`、`dsyevr`、`dgeev` を使います)。値は丸め誤差の
  範囲で一致します。一般行列の `eigen` は `dgeev` と同じく事前に行列のバランス調整 (`dgebal`) をします。`eigen`・
  `svd`・`schur` は、要素の最大値が [2^-256, 2^256] の外にある行列を、分解の前に 2 の冪で割ります (厳密)。途中の和が
  オーバーフローもアンダーフローもしないようにするためです。小さな行列は 1 の近くまで、大きな行列は 2^256 までだけ割り、
  最大の要素の 2^-1278 倍までの要素が正規化数の範囲に残るようにします (`eigen` は `dgeev` と同じく 2^459 まで割り、
  バランス調整が最大の 2^-1481 倍までの要素を扱えるようにします。`eigen(matrix(c(1, 1e-200, 1e200, 2), 2))` は R と同じく
  2.618 と 0.382)。R の LAPACK は約 2^459 まで縮めるので、それより小さな要素は R の `svd` や Schur 分解の方が多くの桁を
  保ちます。`svd(diag(c(1e308, 1e-80)))` は R で 1e-80、rStats.js で 9.9999999999995e-81
  (`ginv(..., tol = 0)` は 1e80 と 1.00000000000005e80) です。最大の 2^-1331 倍より小さな要素 (`diag(c(1e308, 1e-308))`)
  はどちらでも 0 になります。
- **三角行列の `rcond`** は、`dlatrs` (オーバーフローを避けるためにスケーリングし直す) ではなく単純な
  代入で解くため、オーバーフローぎりぎりの行列では値が異なることがあります。代入が溢れる
  場合 (LU 分解からの推定でも) は、ベクトルを 2 の冪で割って推定し直します (上の表)。試した行列では
  R は 0 を返します。
- **`chol`** は対角に NaN があっても失敗せず、NaN を伝播させます (R の OpenBLAS も同じです。参照実装の
  `dpotf2` は停止します)。`pivot: true` では、ランク落ちの行列に対して警告の代わりに `rank` を返し、
  停止位置の対角にはその時点の残りの値が入ります。
- **`solve`** は行列に NaN や Inf があると条件数のチェックなしで解きます (LAPACK 3.12 の `dgecon` は
  エラーを返しますが、R は無視します)。同じ行列の `rcond` は例外を投げます。
- **`lu`** は NaN や無限大を含む行列で、`svd`・`qr`・`eigen` と同じく "the matrix contains NaN or infinite values" の
  例外を投げます。`Matrix::lu` (LAPACK の `dgetrf`) は NaN や無限大を含む因子を返し、それは元の行列に戻るとは限りません
  (`matrix(c(Inf, 1, 2, 3), 2)` では乗数 1 / Inf が 0 になり、P L U の、元の行列で 1 の位置が NaN (0 × Inf) になります)。

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
  に NaN を返し、`phyper` と `qhyper` はそれらを丸めます。signrank/wilcox の n と m は丸められ、
  ≤ 0 なら NaN になります。(q を整数に直す方法は R と違います。意図的な違いを参照)
- 非心ベータの `pbeta` は、パラメータが不正でも x ≤ 0 または x ≥ 1 なら 0 または 1 を返します。
  ncp = Inf の非心カイ二乗分布と非心ベータ分布は NaN を返します (`qchisq` は端点でのみ値を返します)。
  `pf(·, Inf, df2, ncp)` は NaN です。`df(·, Inf, df2, ncp)` は ncp を無視します。
  `df(Inf, df1, finite, ncp)` は NaN です。
- rate が約 5.6e-309 未満 (非正規化数) のガンマ分布 (`dgamma`、`pgamma`、`qgamma`) では、scale = 1 / rate が
  Inf に溢れ、分布全体が +Inf にあるものとして扱います。有限の x では `pgamma` も `dgamma` も 0、`qgamma` は Inf
  で、R と同じです (正確な分布では有限になる分位点もあります。たとえば `qgamma(3.3e-160, 0.5, rate = 4.19e-319)`
  は約 0.3)。`pgamma(Inf, ...)` だけは違います (NaN ではなく 1。意図的な違いの表を参照)。
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
- **AIC:** 二項分布の AIC は R の `round` と同じく m y を偶数への丸めで整数にします。事前重み 0 の行は、すべての
  family で尤度に入れません (R の gaussian の AIC は無限大になる。「R が不正確で、rStats.js のほうが真値に近い場合」の「重み 0 の行がある gaussian `glm` の `AIC`」の行)。
- **`glmAnova`:** 逐次表の再当てはめは当てはめと同じ `start` を使うので、小さいモデルでは長さが合わず
  エラーになります (R と同じです)。既定の検定は、分散パラメータが既知なら `"Chisq"`、そうでなければ
  `"F"` です (R 4.4.0 以降)。

### 線形代数

- **`qr` の既定のピボット選択:** 列を左から右へ処理します。残りのノルムが元のノルム × tol より小さい
  列 (元のノルムが 0 なら常に) は右端へ移し、移した列も順番が来れば変換します。
  rank = min(列数 − 移した列数, 行数)。
- **`qrFitted`、`qrResid`:** k = 0 では y をそのまま返します。1 行の行列の残差は 0 です。
- **`qrX`:** `ncol` の既定値は min(行数, 列数) です。ピボットで列が入れ替わっている場合、列数より
  小さい `ncol` はエラーです。max(行数, 列数) を超える `ncol` もエラーです (R は 0 の列を足します。X の列でも直交補完の
  列でもありません)。`ncol` 0 は R と同じく空の行列です。
- **`qrSolve`:** rank = min(行数, 列数) でなければエラーです。横長の行列では使わない係数は 0 です。
  `b` を省略できるのは正方行列のときだけです。
- **`qr(x, { lapack: true })`:** `qraux` (tau) は R と同じく反射ごとに 1 つ、min(行数, 列数) 個です。rank は
  常に min(行数, 列数) で、`qrFitted` と `qrResid` は例外を投げます。NaN や Inf を含む行列も拒否
  しません (R も意味のない値を返します。値が R と一致する必要はありません)。
- **`kappa`:** 既定 (`exact: false`) では、QR 分解の R (横長の行列は転置した後) に LINPACK の
  `dtrco` の推定を適用します。`norm: "I"` では、R と同じく転置行列の同じ三角部分を使います。
  `triangular` は `method: "direct"` のときだけ効き、そのときも `dtrco` を使います。R と同じく、三角行列を
  通すこれらの推定では、無限大ノルムを使うのは `norm: "I"` (`"i"` ではない) のときだけで、ほかのノルムは
  すべて 1 ノルムになります。ノルムを置き換えたという R の警告は報告しません。特異行列の正確な
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
- **`optimize`** は、R と同じく、関数の値の NaN と +Inf を最大の double、-Inf を最小の double として探します。
  R の警告 ("NA/NaN replaced by maximum positive value" など) は出しません。`objective` はその点の関数の値そのもの
  です (R と同じく NaN や -Inf)。

## 未対応

- 分布パラメータのリサイクル (`rnorm(3, mean = c(0, 10, 100))`)。
- R の既定以外の RNG の種類。
- Fisher の `hybrid` と `workspace`、Wilcoxon の `digits.rank`。Kendall の一致ペアの数え上げは O(n²) です。
- `kappa` の `inv_z`、複素行列、`EISPACK = TRUE` / `LINPACK = TRUE`。
- `glm` の formula (説明変数は行列で渡します。[ROADMAP.ja.md](../../ROADMAP.ja.md) を参照してください)。
- `lmer`: lme4 2.0 の共分散の構造 (`diag()`・`cs()`・`ar1()` の項)、`weights`、`offset`、`subset`、`na.action`
  (欠測値のある行は常に除きます)、`start`、`control`。`predict`、`simulate`、`confint`、`profile`。lmerTest の
  Kenward-Roger 法、`ranova`、`ls_means`、`step`。`glmer` と `nlmer` ([ROADMAP.ja.md](../../ROADMAP.ja.md) を参照してください)。
- numDeriv の複素数ステップ法 (`method = "complex"`。複素数の引数を受け取る関数が要る) と、`grad`・
  `jacobian` の `side` 引数。
- deSolve の適応刻みの解法 (`lsoda`、`ode45` など)。`ode` は固定刻みの `euler`・`rk2`・`rk4` です。
- `coxph`: 計数過程のデータ (`Surv(start, stop, event)`)、`ties = "exact"`、オフセット、クラスターと頑健分散、
  `tt()` の項、残差、concordance。
- `omega`: minres 以外の因子抽出法、oblimin 以外の回転、`n.iter` (ブートストラップの区間)、`poly = TRUE`。
