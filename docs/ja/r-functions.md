# R の関数と rStats.js の関数

R の関数から、rStats.js でそれに当たる関数を引くための一覧です (`node scripts/r-index.mjs --ja` で生成)。ほかのパッケージの
関数は `package::function()` と書いています。引数の書き方は [JavaScript の開発者のための rStats.js](guide-for-js-developers.md) を、
各関数の詳しい説明は [API リファレンス](https://numero-uno-jpn.github.io/rStats.js/api/) (英語) を参照してください。

## 特殊関数 (`rStats.js/special`)

| R | rStats.js | 説明 |
| --- | --- | --- |
| `besselI()` | `besselI` | 第 1 種変形ベッセル関数 |
| `besselJ()` | `besselJ` | 第 1 種ベッセル関数 |
| `besselK()` | `besselK` | 第 2 種変形ベッセル関数 |
| `besselY()` | `besselY` | 第 2 種ベッセル関数 |
| `beta()` | `beta` | ベータ関数 B(a, b) |
| `choose()` | `choose` | 二項係数 |
| `digamma()` | `digamma` | ディガンマ関数 (`lgamma` の導関数) |
| `pracma::erfcinv()` | `erfcinv` | 相補誤差関数の逆関数: erfc(x) = z となる x (0 <= z <= 2) |
| `pracma::erfinv()` | `erfinv` | 誤差関数の逆関数: erf(x) = y となる x (-1 <= y <= 1) |
| `factorial()` | `factorial` | 階乗 |
| `gamma()` | `gamma` | ガンマ関数 |
| `pracma::gammainc()` | `gammainc` | 正則化しない不完全ガンマ関数 gamma(a, x) と Gamma(a, x)、およびそれらの対数 |
| `lbeta()` | `lbeta` | ベータ関数の絶対値の自然対数 log\|B(a, b)\| |
| `lchoose()` | `lchoose` | 二項係数の絶対値の対数 |
| `lfactorial()` | `lfactorial` | 階乗の対数 |
| `lgamma()` | `lgamma` | ガンマ関数の絶対値の自然対数 log\|Gamma(x)\| |
| `psigamma()` | `psigamma` | ポリガンマ関数 (`digamma` の `deriv` 階導関数) |
| `trigamma()` | `trigamma` | トリガンマ関数 (`lgamma` の 2 階導関数) |
| (R にない) | `erf` | 誤差関数 erf(x) = 2 / sqrt(pi) * (exp(-t^2) の 0 から x までの積分) |
| (R にない) | `erfc` | 相補誤差関数 erfc(x) = 1 - erf(x) (上側の裾でも正確) |
| (R にない) | `lgamma1p` | lgamma(1 + x) = log\|Gamma(1 + x)\| (値が 0 に近くなる x = 0 と x = 1 の付近でも正確) |
| (R にない) | `log1mexp` | x >= 0 での log(1 - exp(-x)) (x が小さくても大きくても正確、引数の符号に注意) |
| (R にない) | `log1pexp` | log(1 + exp(x)) (x が大きくてもオーバーフローせず、絶対値の大きな負の x でも正確) |
| (R にない) | `log1pmx` | log(1 + x) - x (log1p(x) - x では桁落ちする小さな \|x\| でも正確) |
| (R にない) | `perm` | n 個から k 個を選ぶ順列の数 n! / (n - k)! (実数 n >= 0 に対しては Gamma(n + 1) / Gamma(n - k + 1) として定義) |

## 確率分布と乱数 (`rStats.js/distributions`)

| R | rStats.js | 説明 |
| --- | --- | --- |
| `dbeta()` | `dbeta` | ベータ分布の密度関数 |
| `dbinom()` | `dbinom` | 二項分布の確率関数 |
| `dcauchy()` | `dcauchy` | コーシー分布の密度関数 |
| `dchisq()` | `dchisq` | カイ二乗分布の密度関数 |
| `dexp()` | `dexp` | 指数分布の密度関数 |
| `df()` | `df` | F 分布の密度関数 |
| `dgamma()` | `dgamma` | ガンマ分布の密度関数 |
| `dgeom()` | `dgeom` | 幾何分布の確率関数 |
| `dhyper()` | `dhyper` | 超幾何分布の確率関数 |
| `extraDistr::dinvgamma()` | `dinvgamma` | 逆ガンマ分布の密度関数 |
| `extraDistr::dkumar()` | `dkumar` | Kumaraswamy 分布の密度関数 |
| `extraDistr::dlaplace()` | `dlaplace` | Laplace 分布の密度関数 |
| `dlnorm()` | `dlnorm` | 対数正規分布の密度関数 |
| `dlogis()` | `dlogis` | ロジスティック分布の密度関数 |
| `dmultinom()` | `dmultinom` | 多項分布の確率関数 |
| `dnbinom()` | `dnbinom` | 負の二項分布の確率関数 |
| `dnorm()` | `dnorm` | 正規分布の密度関数 |
| `extraDistr::dpareto()` | `dpareto` | Pareto 分布の密度関数 |
| `dpois()` | `dpois` | ポアソン分布の確率関数 |
| `dsignrank()` | `dsignrank` | Wilcoxon の符号付き順位統計量の分布の確率関数 |
| `dt()` | `dt` | t 分布の密度関数 |
| `extraDistr::dtriang()` | `dtriang` | 三角分布の密度関数 |
| `dunif()` | `dunif` | 一様分布の密度関数 |
| `dweibull()` | `dweibull` | ワイブル分布の密度関数 |
| `dwilcox()` | `dwilcox` | Wilcoxon の順位和統計量の分布の確率関数 |
| `parallel::nextRNGStream()` | `nextRNGStream` | L'Ecuyer-CMRG の次のストリームの開始状態: 状態を 2^127 ステップ進めたもの |
| `parallel::nextRNGSubStream()` | `nextRNGSubStream` | L'Ecuyer-CMRG の次のサブストリームの開始状態: 状態を 2^76 ステップ進めたもの |
| `pbeta()` | `pbeta` | ベータ分布の分布関数 |
| `pbinom()` | `pbinom` | 二項分布の分布関数 |
| `pcauchy()` | `pcauchy` | コーシー分布の分布関数 |
| `pchisq()` | `pchisq` | カイ二乗分布の分布関数 |
| `pexp()` | `pexp` | 指数分布の分布関数 |
| `pf()` | `pf` | F 分布の分布関数 |
| `pgamma()` | `pgamma` | ガンマ分布の分布関数 |
| `pgeom()` | `pgeom` | 幾何分布の分布関数 |
| `phyper()` | `phyper` | 超幾何分布の分布関数 |
| `extraDistr::pinvgamma()` | `pinvgamma` | 逆ガンマ分布の分布関数 |
| `extraDistr::pkumar()` | `pkumar` | Kumaraswamy 分布の分布関数 |
| `extraDistr::plaplace()` | `plaplace` | Laplace 分布の分布関数 |
| `plnorm()` | `plnorm` | 対数正規分布の分布関数 |
| `plogis()` | `plogis` | ロジスティック分布の分布関数 |
| `mvtnorm::pmvnorm()` | `pbvnorm` | 相関 `rho` の標準 2 変量正規分布に従う (X, Y) が長方形 `lower ≤ (X, Y) ≤ upper` に入る確率 |
| `pnbinom()` | `pnbinom` | 負の二項分布の分布関数 |
| `pnorm()` | `pnorm` | 正規分布の分布関数 |
| `extraDistr::ppareto()` | `ppareto` | Pareto 分布の分布関数 |
| `ppois()` | `ppois` | ポアソン分布の分布関数 |
| `psignrank()` | `psignrank` | Wilcoxon の符号付き順位統計量の分布の分布関数 |
| `pt()` | `pt` | t 分布の分布関数 |
| `extraDistr::ptriang()` | `ptriang` | 三角分布の分布関数 |
| `ptukey()` | `ptukey` | スチューデント化された範囲の分布の分布関数 |
| `punif()` | `punif` | 一様分布の分布関数 |
| `pweibull()` | `pweibull` | ワイブル分布の分布関数 |
| `pwilcox()` | `pwilcox` | Wilcoxon の順位和統計量の分布の分布関数 |
| `qbeta()` | `qbeta` | ベータ分布の分位点関数 |
| `qbinom()` | `qbinom` | 二項分布の分位点関数 |
| `qcauchy()` | `qcauchy` | コーシー分布の分位点関数 |
| `qchisq()` | `qchisq` | カイ二乗分布の分位点関数 |
| `qexp()` | `qexp` | 指数分布の分位点関数 |
| `qf()` | `qf` | F 分布の分位点関数 |
| `qgamma()` | `qgamma` | ガンマ分布の分位点関数 |
| `qgeom()` | `qgeom` | 幾何分布の分位点関数 |
| `qhyper()` | `qhyper` | 超幾何分布の分位点関数 |
| `extraDistr::qinvgamma()` | `qinvgamma` | 逆ガンマ分布の分位点関数 |
| `extraDistr::qkumar()` | `qkumar` | Kumaraswamy 分布の分位点関数 |
| `extraDistr::qlaplace()` | `qlaplace` | Laplace 分布の分位点関数 |
| `qlnorm()` | `qlnorm` | 対数正規分布の分位点関数 |
| `qlogis()` | `qlogis` | ロジスティック分布の分位点関数 |
| `qnbinom()` | `qnbinom` | 負の二項分布の分位点関数 |
| `qnorm()` | `qnorm` | 正規分布の分位点関数 |
| `extraDistr::qpareto()` | `qpareto` | Pareto 分布の分位点関数 |
| `qpois()` | `qpois` | ポアソン分布の分位点関数 |
| `qsignrank()` | `qsignrank` | Wilcoxon の符号付き順位統計量の分布の分位点関数 |
| `qt()` | `qt` | t 分布の分位点関数 |
| `extraDistr::qtriang()` | `qtriang` | 三角分布の分位点関数 |
| `qtukey()` | `qtukey` | スチューデント化された範囲の分布の分位点関数 |
| `qunif()` | `qunif` | 一様分布の分位点関数 |
| `qweibull()` | `qweibull` | ワイブル分布の分位点関数 |
| `qwilcox()` | `qwilcox` | Wilcoxon の順位和統計量の分布の分位点関数 |
| `r2dtable()` | `r2dtable` | 行和と列和を与えた 2 元分割表の乱数 |
| `.Random.seed` | `getRandomSeed` | 現在の乱数生成器の状態のコピー (R で `.Random.seed` を読むのに当たる) |
| `.Random.seed` | `setRandomSeed` | 乱数生成器の状態の復元 (種類も含む、R で `.Random.seed` に代入するのに当たる) |
| `rbeta()` | `rbeta` | ベータ分布の乱数 |
| `rbinom()` | `rbinom` | 二項分布の乱数 |
| `rcauchy()` | `rcauchy` | コーシー分布の乱数 |
| `rchisq()` | `rchisq` | カイ二乗分布の乱数 |
| `rexp()` | `rexp` | 指数分布の乱数 |
| `rf()` | `rf` | F 分布の乱数 |
| `rgamma()` | `rgamma` | ガンマ分布の乱数 |
| `rgeom()` | `rgeom` | 幾何分布の乱数 |
| `rhyper()` | `rhyper` | 超幾何分布の乱数 |
| `extraDistr::rinvgamma()` | `rinvgamma` | 逆ガンマ分布の乱数 |
| `extraDistr::rkumar()` | `rkumar` | Kumaraswamy 分布の乱数 |
| `extraDistr::rlaplace()` | `rlaplace` | Laplace 分布の乱数 |
| `rlnorm()` | `rlnorm` | 対数正規分布の乱数 |
| `rlogis()` | `rlogis` | ロジスティック分布の乱数 |
| `rmultinom()` | `rmultinom` | 多項分布の乱数ベクトル |
| `rnbinom()` | `rnbinom` | 負の二項分布の乱数 |
| `RNGkind()` | `RNGkind` | 乱数生成の種類の取得と変更 |
| `rnorm()` | `rnorm` | 正規分布の乱数 |
| `extraDistr::rpareto()` | `rpareto` | Pareto 分布の乱数 |
| `rpois()` | `rpois` | ポアソン分布の乱数 |
| `rsignrank()` | `rsignrank` | Wilcoxon の符号付き順位統計量の分布の乱数 |
| `rt()` | `rt` | Student の t 分布の乱数 |
| `extraDistr::rtriang()` | `rtriang` | 三角分布の乱数 |
| `runif()` | `runif` | 一様分布の乱数 |
| `rweibull()` | `rweibull` | ワイブル分布の乱数 |
| `rwilcox()` | `rwilcox` | Wilcoxon の順位和統計量の分布の乱数 |
| `sample.int()` | `sampleInt` | `0..n-1` の整数からの無作為抽出 |
| `sample()` | `sample` | 配列の要素からの無作為抽出 |
| `set.seed()` | `setSeed` | 乱数生成器のシードの設定 |
| (R にない) | `darcsine` | (a, b) 上の逆正弦分布の密度関数 f(x) = 1 / (pi sqrt((x - a)(b - x))) |
| (R にない) | `distSummary` | d/p/q/r 関数の名前とパラメータで指定した分布の平均、分散、標準偏差、中央値、最頻値、歪度、超過尖度 |
| (R にない) | `parcsine` | (a, b) 上の逆正弦分布の分布関数 |
| (R にない) | `qarcsine` | (a, b) 上の逆正弦分布の分位点関数 |
| (R にない) | `rarcsine` | (a, b) 上の逆正弦分布の乱数 (逆関数法による) |

## 検定とモデル (`rStats.js/tests`)

| R | rStats.js | 説明 |
| --- | --- | --- |
| `nortest::ad.test()` | `adTest` | Anderson-Darling の正規性検定 |
| `psych::alpha()` | `cronbachAlpha` | 項目群の Cronbach の α、標準化 α、Guttman の λ6、項目間相関の平均、各項目を除いたときの α |
| `anova()` | `anova` | 式から当てはめた線形モデルの分散分析 |
| `car::Anova()` | `Anova` | 線形モデルの項の Type II または Type III の検定 |
| `anova()` | `glmAnova` | 1 つの `glm` の当てはめ、または同じデータへの複数の当てはめ (`anova(fit1, fit2, ...)`) の逸脱度分析 |
| `ansari.test()` | `ansariTest` | 2 標本の尺度の違いについての Ansari-Bradley 検定 |
| `afex::aov_ez()` | `aovEz` | long のデータからの反復測定・被験者間・混合計画の分散分析 |
| `aov()` | `aov` | 一元配置分散分析 |
| `bartlett.test()` | `bartlettTest` | 複数の正規標本の分散が等しいことについての Bartlett 検定 |
| `binom.test()` | `binomTest` | ベルヌーイ試行の成功確率についての単純帰無仮説の正確検定 |
| `lawstat::brunner.munzel.test()` | `brunnerMunzelTest` | 2 標本の相対効果 P(X < Y) + P(X = Y)/2 が 1/2 であることについての Brunner-Munzel 検定 (等分散も分布の形が同じことも仮定しない) |
| `chisq.test()` | `chisqTest` | Pearson のカイ二乗検定 |
| `DescTools::CochranQTest()` | `cochranQTest` | 反復のない完全ブロック計画での 2 値応答に対する Cochran の Q 検定 |
| `pwr::cohen.ES()` | `cohenES` | Cohen による効果量の慣用値 |
| `effectsize::cohens_d()` | `cohensD` | Cohen の d: 2 標本、対応のある標本、または 1 標本と `mu` の平均の差を標準化した値と、非心 t 分布による信頼区間 |
| `confint()` | `confint` | `lm` で当てはめた線形モデルの係数の信頼区間 |
| `confint()` | `glmConfint` | `glm` で当てはめた一般化線形モデルの係数のプロファイル尤度信頼区間 |
| `cooks.distance()` | `glmCooksDistance` | `glm` の当てはめの Cook の距離 (事前重みが 0 でない行について) |
| `cor.test()` | `corTest` | 対応のある標本間の相関の検定 |
| `survival::coxph()` | `coxph` | Cox 比例ハザード回帰 |
| `nortest::cvm.test()` | `cvmTest` | Cramer-von Mises の正規性検定 |
| `PMCMRplus::dscfAllPairsTest()` | `dscfAllPairsTest` | 対ごとの Mann-Whitney 統計量による Dwass-Steel-Critchlow-Fligner の全対比較検定 |
| `dunn.test::dunn.test()` | `dunnTest` | 平均順位のすべての対についての Dunn の検定 |
| `PMCMRplus::dunnettTest()` | `dunnettTest` | プールした分散による、対照群に対する平均の Dunnett の多対一検定 |
| `effectsize::epsilon_squared()` | `epsilonSquared` | 分散分析表の各項のイプシロン二乗 (反復測定計画にも対応) |
| `pwr::ES.h()` | `esH` | 2 つの比率の効果量 h |
| `pwr::ES.w1()` | `esW1` | 適合度検定の効果量 w `sqrt(sum((p1 - p0)^2 / p0))` |
| `pwr::ES.w2()` | `esW2` | セル確率の行列に対する関連の検定の効果量 w: 行和を r、列和を c として `p0 = r c'`、`sqrt(sum((p - p0)^2 / p0))` |
| `effectsize::eta_squared()` | `etaSquared` | 分散分析表の各項のイータ二乗と、非心 F 分布による信頼区間 |
| `factanal()` | `factanal` | データ行列、または `options.covmat` を与えたときは共分散行列の最尤因子分析 |
| `fisher.test()` | `fisherTest` | 計数データに対する Fisher の正確検定 |
| `fligner.test()` | `flignerTest` | 分散の均一性についての Fligner-Killeen 検定 |
| `friedman.test()` | `friedmanTest` | 反復のない完全ブロック計画に対する Friedman の順位和検定 |
| `PMCMRplus::gamesHowellTest()` | `gamesHowellTest` | Welch の標準誤差と自由度による、平均の Games-Howell の全対比較検定 |
| `multcomp::glht()` | `glhtDunnett` | 一元配置分散分析での Dunnett の多対一比較 (同時 p 値つき) |
| `glm()` | `glm` | 反復重み付き最小二乗法による一般化線形モデルの当てはめ |
| `hatvalues()` | `glmHatvalues` | `glm` の当てはめの、最後の重み付き最小二乗ステップのハット行列の対角成分 (事前重みが 0 でない行について) |
| `effectsize::hedges_g()` | `hedgesG` | Hedges の g |
| `irr::icc()` | `icc` | 級内相関係数と、その F 検定および信頼区間 |
| `DescTools::JonckheereTerpstraTest()` | `jonckheereTest` | 順序のある対立仮説に対する、分布が等しいことについての Jonckheere-Terpstra 検定 |
| `irr::kappa2()` | `kappa2` | 2 人の評定者に対する Cohen の κ (重みなしまたは重みつき) と、κ = 0 の z 検定 |
| `irr::kappam.fleiss()` | `kappamFleiss` | 複数の評定者に対する Fleiss の κ と、Fleiss の κ についての κ = 0 の z 検定 |
| `kruskal.test()` | `kruskalTest` | Kruskal-Wallis の順位和検定 |
| `ks.test()` | `ksTest` | Kolmogorov-Smirnov 検定 |
| `PMCMRplus::kwAllPairsDunnTest()` | `kwAllPairsDunnTest` | 平均順位の Dunn の全対比較検定 (調整済み p 値つき) |
| `PMCMRplus::kwManyOneDunnTest()` | `kwManyOneDunnTest` | 対照群に対する平均順位の Dunn の多対一検定 |
| `car::leveneTest()` | `leveneTest` | 群間の分散の均一性についての Levene 検定 |
| `nortest::lillie.test()` | `lillieTest` | Lilliefors の正規性検定 |
| `lm()` | `lm` | 式からの線形モデルの当てはめ |
| `mantelhaen.test()` | `mantelhaenTest` | 層ごとに 1 つずつの分割表の組での条件付き独立性についての Cochran-Mantel-Haenszel のカイ二乗検定 |
| `PMCMRplus::manyOneUTest()` | `manyOneUTest` | Steel の多対一順位検定の正規近似: 各群と対照群の Mann-Whitney 統計量を、対ごとに順位を付け、同順位を補正した分散で標準化したもの |
| `mauchly.test()` | `mauchlyTest` | `M` が張り `X` に直交する対比上での、各被験者の測定値の球面性についての Mauchly 検定 |
| `mcnemar.test()` | `mcnemarTest` | 正方の計数表の行と列の対称性についての McNemar のカイ二乗検定 |
| `model.matrix()` | `modelMatrix` | データフレームに対する式のモデル行列 (R の `terms()` の属性つき) |
| `mood.test()` | `moodTest` | 尺度についての Mood の 2 標本検定 |
| `effectsize::omega_squared()` | `omegaSquared` | 分散分析表の各項のオメガ二乗 (反復測定計画にも対応) |
| `psych::omega()` | `omega` | 斜交 minres 因子解の Schmid-Leiman 変換による McDonald の ω |
| `oneway.test()` | `onewayTest` | 複数の正規標本の平均が等しいことの検定 (等分散を仮定しない場合と仮定する場合) |
| `p.adjust()` | `pAdjust` | 多重比較のための p 値の調整 |
| `pairwise.prop.test()` | `pairwisePropTest` | 比率が等しいことについての群の対ごとの 2 群検定 (調整済み p 値つき) |
| `pairwise.t.test()` | `pairwiseTTest` | 群間の対ごとの t 検定 (調整済み p 値つき) |
| `pairwise.wilcox.test()` | `pairwiseWilcoxTest` | 群間の対ごとの Wilcoxon 順位和検定 (調整済み p 値つき) |
| `psych::partial.r()` | `partialR` | `x` のほかのすべての列を与えたときの列 `i` と `j` の偏相関 |
| `nortest::pearson.test()` | `pearsonTest` | Pearson のカイ二乗正規性検定 (当てはめた正規分布のもとで等確率の階級による) |
| `poisson.test()` | `poissonTest` | ポアソン率の正確検定、または 2 つのポアソン率の比較 |
| `polycor::polychor()` | `polychor` | 2 つの順序変数のポリコリック相関 |
| `polycor::polyserial()` | `polyserial` | 数値変数と順序変数のポリシリアル相関 |
| `power.anova.test()` | `powerAnovaTest` | 釣り合い型一元配置分散分析の F 検定の検出力、または与えた検出力に対するほかの量のいずれか |
| `power.prop.test()` | `powerPropTest` | 2 つの比率の検定の検出力、または与えた検出力に対する標本サイズ、確率の一方、有意水準のいずれか |
| `power.t.test()` | `powerTTest` | 1 標本または 2 標本 t 検定の検出力、または与えた検出力に対する標本サイズ、差、標準偏差、有意水準のいずれか |
| `predict()` | `glmPredict` | `glm` で当てはめた一般化線形モデルの予測値とその標準誤差 |
| `predict()` | `predict` | `lm` で当てはめた線形モデルの、説明変数の新しい値での予測値 (標準誤差と、必要に応じて区間つき) |
| `prop.test()` | `propTest` | 比率が等しいこと、または与えた値であることの検定 |
| `prop.trend.test()` | `propTrendTest` | 比率の傾向についてのカイ二乗検定 |
| `pwr::pwr.2p.test()` | `pwr2pTest` | 標本サイズが等しい 2 つの比率の検定の検出力、または与えた検出力に対する効果量、標本サイズ、有意水準のいずれか |
| `pwr::pwr.2p2n.test()` | `pwr2p2nTest` | 標本サイズが異なる 2 つの比率の検定の検出力、または与えた検出力に対する効果量、標本サイズの一方、有意水準のいずれか |
| `pwr::pwr.anova.test()` | `pwrAnovaTest` | 釣り合い型一元配置分散分析の F 検定の検出力、または与えた検出力に対する群の数、標本サイズ、効果量、有意水準のいずれか |
| `pwr::pwr.chisq.test()` | `pwrChisqTest` | カイ二乗検定の検出力、または与えた検出力に対する効果量、観測数、有意水準のいずれか |
| `pwr::pwr.f2.test()` | `pwrF2Test` | 一般線形モデルの F 検定の検出力、または与えた検出力に対する自由度、効果量、有意水準のいずれか |
| `pwr::pwr.norm.test()` | `pwrNormTest` | 分散が既知の正規分布の平均の検定の検出力、または与えた検出力に対する効果量、標本サイズ、有意水準のいずれか |
| `pwr::pwr.p.test()` | `pwrPTest` | 1 つの比率の検定の検出力、または与えた検出力に対する効果量、標本サイズ、有意水準のいずれか |
| `pwr::pwr.r.test()` | `pwrRTest` | 相関の検定の検出力、または与えた検出力に対する標本サイズ、相関、有意水準のいずれか |
| `pwr::pwr.t.test()` | `pwrTTest` | 平均の t 検定の検出力、または与えた検出力に対する標本サイズ、効果量、有意水準のいずれか |
| `pwr::pwr.t2n.test()` | `pwrT2nTest` | 標本サイズが異なる 2 標本 t 検定の検出力、または与えた検出力に対する標本サイズの一方、効果量、有意水準のいずれか |
| `quade.test()` | `quadeTest` | 反復のない完全ブロック計画に対する Quade 検定 |
| `residuals()` | `glmResiduals` | `glm` で当てはめた一般化線形モデルの残差 (1 行に 1 つ) |
| `rstandard()` | `glmRstandard` | `glm` の当てはめの標準化逸脱度残差 (事前重みが 0 でない行について) |
| `nortest::sf.test()` | `sfTest` | Shapiro-Francia の正規性検定 |
| `shapiro.test()` | `shapiroTest` | Shapiro-Wilk の正規性検定 |
| `PMCMRplus::steelTest()` | `steelTest` | Steel の多対一順位検定 |
| `summary()` | `aovSummary` | `aov` で当てはめた分散分析の表 |
| `summary()` | `glmSummary` | `glm` で当てはめた一般化線形モデルの要約: 分散パラメータ、係数の表、推定値の共分散 |
| `survival::survdiff()` | `survdiff` | 生存曲線の差の検定: Harrington と Fleming の G-rho 族 (`rho = 0` でログランク検定) |
| `survival::survfit()` | `survfit` | 生存関数の Kaplan-Meier 推定 (Greenwood の標準誤差と各点での信頼区間つき) |
| `t.test()` | `tTest` | Student の t 検定 |
| `TukeyHSD()` | `TukeyHSD` | 一元配置分散分析の群平均の間の Tukey の HSD (honest significant differences) |
| `PMCMRplus::tukeyTest()` | `tukeyTest` | 平均の Tukey の全対比較検定 |
| `var.test()` | `varTest` | 2 つの正規標本の分散が与えた比であることの F 検定 |
| `wilcox.test()` | `wilcoxTest` | Wilcoxon の符号付き順位検定と順位和検定 |
| `BSDA::z.test()` | `zTest` | 標準偏差が既知の場合の、1 標本の平均または 2 標本の平均の差の z 検定 |

## 線形代数 (`rStats.js/linalg`)

| R | rStats.js | 説明 |
| --- | --- | --- |
| `-` | `subtract` | R のリサイクルによる要素ごとの差 |
| `*` | `multiply` | R のリサイクルによる要素ごとの積 |
| `%*%` | `matMul` | 行列積 |
| `/` | `divide` | R のリサイクルによる要素ごとの商 |
| `+` | `add` | R のリサイクルによる要素ごとの和 |
| `backsolve()` | `backsolve` | 右辺がベクトルの三角連立方程式 `r y = x` の解 |
| `cbind()` | `cbind` | ベクトルと行列の列としての結合 |
| `chol()` | `chol` | Cholesky 分解 |
| `chol2inv()` | `chol2inv` | Cholesky 因子からの逆行列: `(t(R) R)^-1` の計算 |
| `crossprod()` | `crossprod` | 行列の交差積 `t(x) %*% y` (`y` を省いたときは `t(x) %*% x`) |
| `det()` | `det` | 正方行列の行列式 |
| `determinant()` | `determinant` | 絶対値と符号に分けた行列式 |
| `diag()` | `diag` | 行列の対角成分、対角行列、単位行列 |
| `eigen()` | `eigen` | 正方行列の固有値と固有ベクトル |
| `expm::expm()` | `expm` | 行列指数関数 |
| `forwardsolve()` | `forwardsolve` | 右辺がベクトルの三角連立方程式 `l y = x` の解 |
| `MASS::ginv()` | `ginv` | Moore-Penrose の一般化逆行列 |
| `kappa()` | `kappa` | 行列の条件数 (推定値または厳密な値) |
| `kronecker()` | `kronecker` | Kronecker 積 |
| `Matrix::lu()` | `lu` | 部分ピボット選択つきの LU 分解 `x = P L U` |
| `matrix()` | `matrix` | データを埋めるまでリサイクルした行列の作成 |
| `norm()` | `norm` | 行列ノルム |
| `outer()` | `outer` | 2 つのベクトルの外積: `fun(x[i], y[j])` の行列 |
| `prcomp()` | `prcomp` | `x` の列の主成分 |
| `qr.coef()` | `qrCoef` | ベクトルの応答に対する最小二乗係数 |
| `qr.fitted()` | `qrFitted` | ベクトルの応答に対する最小二乗の当てはめ値: ピボット選択後の最初の `k` 列が張る空間への `y` の射影 |
| `qr.Q()` | `qrQ` | QR 分解からの直交行列 `Q` の復元 |
| `qr.qty()` | `qrQty` | ベクトル `y` に対する `t(Q) %*% y` の計算 |
| `qr.qy()` | `qrQy` | ベクトル `y` に対する `Q %*% y` の計算 |
| `qr.R()` | `qrR` | QR 分解からの上三角行列 `R` の復元 |
| `qr.resid()` | `qrResid` | ベクトルの応答に対する最小二乗残差 |
| `qr.solve()` | `qrSolve` | QR 分解による `a x = b` の最小二乗解 |
| `qr.X()` | `qrX` | QR 分解からの元の行列の再構成 (列は元の順序に戻す) |
| `qr()` | `qr` | QR 分解 |
| `rbind()` | `rbind` | ベクトルと行列の行としての結合 |
| `rcond()` | `rcond` | 行列の逆条件数の推定値 |
| `Matrix::Schur()` | `schur` | 正方行列の実 Schur 分解 |
| `seq()` | `seq` | 規則的な数列 |
| `solve()` | `solve` | 正方行列の逆行列 |
| `svd()` | `svd` | 特異値分解 |
| `t()` | `t` | 転置 |
| `tcrossprod()` | `tcrossprod` | 行列の交差積 `x %*% t(y)` (`y` を省いたときは `x %*% t(x)`) |

## 記述統計 (`rStats.js/descriptive`)

| R | rStats.js | 説明 |
| --- | --- | --- |
| `aggregate()` | `aggregate` | 各群の値に関数を適用した結果 (データフレームとして) |
| `DescTools::CoefVar()` | `cv` | 変動係数 sd / mean |
| `complete.cases()` | `completeCases` | 欠測値を含まない行の判定 |
| `cor()` | `cor` | 2 つのベクトルの相関、または行列の列の相関行列 |
| `cov()` | `cov` | 2 つのベクトルの共分散、または行列の列の共分散行列 |
| `cummax()` | `cummax` | 累積最大値 |
| `cummin()` | `cummin` | 累積最小値 |
| `cumprod()` | `cumprod` | 累積積 |
| `cumsum()` | `cumsum` | 累積和 |
| `cut()` | `cut` | 値が属する区間の番号 (区切りの外では NaN) |
| `diff()` | `diff` | ラグ付きの差分と反復した差分 |
| `ecdf()` | `ecdf` | `x` の経験分布関数: 引数以下の値の割合を返す関数 |
| `findInterval()` | `findInterval` | 各値について、それ以下の区切り点の数 |
| `fivenum()` | `fivenum` | Tukey の五数要約 |
| `DescTools::Gmean()` | `geometricMean` | 幾何平均 exp(mean(log x)) |
| `hist()` | `hist` | ヒストグラムの度数 |
| `IQR()` | `IQR` | 四分位範囲 (0.75 分位点と 0.25 分位点の差) |
| `e1071::kurtosis()` | `kurtosis` | 標本の超過尖度 |
| `mad()` | `mad` | 定数倍した中央絶対偏差 |
| `mean()` | `mean` | 算術平均 (刈り込み平均も可) |
| `DescTools::MeanAD()` | `meanAD` | 中心からの平均絶対偏差 |
| `median()` | `median` | 中央値 |
| `merge()` | `merge` | キー列による 2 つのデータフレームの結合 |
| `DescTools::Mode()` | `modes` | 最も頻度の高い値とその度数 |
| `na.omit()` | `naOmit` | 欠測でない値 |
| `tidyr::pivot_longer()` | `pivotLonger` | データフレームの wide から long への変形: 選んだ列が行になる |
| `tidyr::pivot_wider()` | `pivotWider` | データフレームの long から wide への変形: `namesFrom` の値が列になり、`valuesFrom` の値で埋まる |
| `pretty()` | `pretty` | `x` の範囲を覆う、約 n + 1 個の等間隔の「きりのよい」値 |
| `prod()` | `prod` | 値の積 |
| `quantile()` | `quantile` | 標本分位点 |
| `range()` | `range` | 値の `[min, max]` |
| `rank()` | `rank` | 標本の順位 |
| `scale()` | `scale` | 行列の列の中心化と尺度化 |
| `sd()` | `sd` | 標本標準偏差 |
| `e1071::skewness()` | `skewness` | 標本歪度 |
| `split()` | `split` | 群に分けた `x` の値 |
| `subset()` | `subset` | 条件を満たすデータフレームの行 (必要に応じて一部の列だけ) |
| `sum()` | `sum` | 値の和 |
| `table()` | `table` | 異なる値の度数表 |
| `tabulate()` | `tabulate` | `bin` に含まれる整数 1..nbins の個数 |
| `tapply()` | `tapply` | 各群の値に関数を適用した結果 |
| `unique()` | `unique` | 重複を除いた値 (最初に現れた順) |
| `var()` | `variance` | 標本分散 |
| `weighted.mean()` | `weightedMean` | 加重平均 `sum(x w) / sum(w)` |
| (R にない) | `fromRows` | 行オブジェクトの配列 (JSON や解析した CSV の通常の形) からのデータフレーム |
| (R にない) | `toRows` | データフレームの行のオブジェクトの配列 (`fromRows` の逆) |

## 数値計算 (`rStats.js/numerics`)

| R | rStats.js | 説明 |
| --- | --- | --- |
| `approx()` | `approx` | 線形補間または定数補間 |
| `pracma::barylag()` | `barylag` | 点を通る重心形式の Lagrange 補間 |
| `numDeriv::grad()` | `grad` | ベクトルのスカラー関数の勾配 |
| `numDeriv::hessian()` | `hessian` | Richardson 外挿による、ベクトルのスカラー関数のヘッセ行列 |
| `integrate()` | `integrate` | 有限または無限の範囲での 1 変数関数の積分 |
| `numDeriv::jacobian()` | `jacobian` | ベクトルのベクトル関数のヤコビ行列: 第 i 行は i 番目の値の導関数 |
| `deSolve::ode()` | `ode` | 初期値問題 y' = func(t, y, parms)、y(times[0]) = y の解 (`times` の各区間で固定の 1 ステップ) |
| `optim()` | `optim` | 開始点 `par` からの `fn` の汎用の最小化 |
| `optimHess()` | `optimHess` | 勾配の中心差分による、par での fn の数値微分によるヘッセ行列 |
| `optimize()` | `optimize` | Brent の黄金分割探索と放物線探索による、区間上の 1 変数関数の最小値 |
| `spline()` | `spline` | 与えた点または等間隔の点での 3 次スプライン補間 |
| `splinefun()` | `splinefun` | 点を通る 3 次スプライン (`x` と導関数の階数の関数として) |
| `splinefunH()` | `splinefunH` | 点 `x` で値 `y` と傾き `m` をとる 3 次 Hermite スプライン (`x` と導関数の階数の関数として、データの外では線形) |
| `uniroot()` | `uniroot` | Brent の zeroin による、区間内の 1 変数関数の根 |
| (R にない) | `hermiteInterp` | 値と導関数を与えた n 点を通る 2n - 1 次の多項式の `x` での値 |

## 混合モデル (`rStats.js/mixed`)

| R | rStats.js | 説明 |
| --- | --- | --- |
| `lme4::lmer()` | `lmer` | REML または最尤法による線形混合モデルの当てはめ |
