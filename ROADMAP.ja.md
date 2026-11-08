# ロードマップ

[English](ROADMAP.md) | 日本語

> この文書は [英語版](ROADMAP.md) の訳です。内容が食い違うときは英語版が正です。

## 目標

R の `stats` パッケージ (と `base` の関連部分) の数値計算の中核を、R と同じ関数名・既定値・数値
結果のまま、素の TypeScript でカバーすること。対象は分布、記述統計、仮説検定、線形モデル、特殊関数、
数値計算、線形代数の基本です。
R を oracle とし、すべての関数を R の出力と照合します。R 自身が不正確な箇所では高精度の参照値と
照合します ([docs/ja/accuracy.md](docs/ja/accuracy.md) を参照)。

狙いは空白を埋めることです。JavaScript には分布と特殊関数のライブラリ (正確で範囲も広い
[stdlib-js](https://github.com/stdlib-js/stdlib) など) や記述統計のライブラリがあり、R 自体も
WebAssembly (webR) でブラウザ上で動きますが、その代わりに数十 MB のダウンロードが要ります。
欠けているのは、分布から仮説検定まで、R の `set.seed()` の乱数列も含めて、結果が R と一致すると
信頼できる軽いライブラリです。

優先するのは、医学・生物学・心理学の研究で使われる解析です。R の `stats` にその関数がないときは、
広く使われている CRAN のパッケージ (`car`、`multcomp`、`survival` など) を照合先にし、ほかの
パッケージと同じ日付のスナップショットから oracle のイメージに入れます。

SciPy (`scipy.stats`、`scipy.special`、`scipy.linalg`) は移植元のコードであり、何が役に立つかの
手がかりでもありますが、目標ではありません。R に対応するもののない関数は R と照合できないので、
優先しません。

## 完了したこと

| 分野 | 状況 |
|---|---|
| 特殊関数 | `gamma`、`lgamma`、`beta`、`lbeta`、`choose`、`lchoose`、`factorial`、`lfactorial`、`digamma`、`trigamma`、`psigamma`、`besselI`、`besselK`、`besselJ`、`besselY` と、R にはない `erf`、`erfc`、`erfinv`、`erfcinv`、`gammainc`、`perm`、R の C API の log1p 系の関数 `log1pmx`、`lgamma1p`、`log1mexp`、`log1pexp` を export |
| 分布 | R の `stats` にある 20 の分布すべて (スチューデント化された範囲を含む)、非心カイ二乗・t・F・ベータ分布、逆ガンマ・Kumaraswamy・Pareto・三角・Laplace (extraDistr)・逆正弦の d/p/q (`lowerTail` と `logP` 付き)。23 の分布の `distSummary` (ウィルコクソンの符号付き順位と順位和の分布、スチューデント化された範囲の分布を除く) |
| 乱数 | R の既定の Mersenne-Twister と `set.seed()` 互換の乱数列、`RNGkind` による `"L'Ecuyer-CMRG"` (`parallel` の `nextRNGStream`・`nextRNGSubStream` 付き) と `sample.kind = "Rounding"`、`rmultinom` を含む 26 の `r*` 関数 (R にない分布は extraDistr と同じ乱数列)、`sample`、`sampleInt`、`r2dtable` |
| 記述統計 | R の要約 (`mean`、`variance`、9 種類の `quantile`、`rank`、行列の `cov`/`cor`、`table`、`cut`、`hist`、`ecdf`、`scale` など) と e1071・DescTools のもの (`skewness`、`kurtosis`、`geometricMean`、`modes`、`meanAD`、`cv`) |
| 仮説検定 | R の `htest` の関数: `tTest`、`chisqTest` (シミュレーションによる p 値と 2 つの因子ベクトルを含む)、`fisherTest` (r × c とシミュレーションによる p 値を含む)、`wilcoxTest`、`corTest`、`binomTest`、`poissonTest`、`propTest`、`mcnemarTest`、`varTest`、`bartlettTest`、`kruskalTest`、`friedmanTest`、`quadeTest`、`flignerTest`、`moodTest`、`onewayTest`、`shapiroTest`、`mantelhaenTest`、`ansariTest` (信頼区間を含む)、`ksTest`、`pairwise*`、`pAdjust`。一元配置の `aov`、`TukeyHSD`、`zTest` (BSDA)、`brunnerMunzelTest` (lawstat) |
| 線形モデル | 行列で渡す `lm` と `summary.lm` の値、`confint`、`predict`。行列で渡す `glm` (R の `stats` のすべての族とリンク)、`summary.glm`、4 種類の残差、`hatvalues`、`rstandard`、`cooks.distance`、標準誤差つきの `predict`、プロファイル尤度の `confint` (厳密な限界)、`anova`。頑健な共分散: sandwich の `vcovHC` (HC0〜HC5) と `vcovCL` (一元と多元のクラスター、HC0〜HC3)、lmtest の `coeftest` と `coefci`。修正ポアソン回帰 (リスク比)、逆確率重み付けの後の重み付き回帰、差の差分析に使える |
| 分散分析 | formula で呼ぶ `aov`、`lm`、`modelMatrix` (多元、交互作用、共変量、`Error()` の層)、`anova` (逐次の表とモデルの比較)、car の `Anova` (Type II と III)、afex の `aov_ez` に当たる `aovEz` (反復測定、Greenhouse-Geisser と Huynh-Feldt、一般化 η²)、`mauchly.test` |
| 効果量と検出力 | effectsize の `cohens_d`、`hedges_g`、`eta_squared`、`omega_squared`、`epsilon_squared` (`anova` と `Anova` の表から。信頼区間は厳密な限界)、`power.t.test`、`power.prop.test`、`power.anova.test` と `pwr` の検出力の関数 |
| ほかの検定 | `leveneTest` (car)、`propTrendTest` (`prop.trend.test`)、`jonckheereTest` (DescTools と clinfun)、`cochranQTest` (DescTools)、`adTest`、`lillieTest`、`cvmTest`、`sfTest`、`pearsonTest` (nortest)。`tTOST` と `tsumTOST` (TOSTER: 1 標本・2 標本・対応のある標本の平均の同等性検定と最小効果検定、標準化平均差つき) |
| 分割表と比率 | `binomCI`、`binomDiffCI`、`binomRatioCI` (DescTools の `BinomCI`、`BinomDiffCI`、`BinomRatioCI`)、`oddsRatio` (epitools と epiR のスコア区間)、`fisherTest(x, { midp: true })` (exact2x2)、`boschlooTest` (Exact)、`gTest`、`stuartMaxwellTest`、`goodmanKruskalGamma` (DescTools)、`lblTest` (coin)、`chisqTest(x, { nMinus1: true })` (Campbell の N − 1 検定) と Freeman-Tukey 残差、`tost` (equivalence)、`binomDiffEquivalenceTest` (2 つの比率のスコア法の TOST) |
| 多重比較 | PMCMRplus の `dscfAllPairsTest` (Steel-Dwass)、`kwAllPairsDunnTest`、`kwManyOneDunnTest`、`manyOneUTest` (Steel の多対一の順位検定)、`dunnettTest`、`gamesHowellTest`、`tukeyTest`、`dunnTest` (dunn.test)、`glhtDunnett` (multcomp)。Dunnett 型の確率は厳密に計算する (R は乱数を使う) |
| 混合モデル | lme4 の `lmer` を `lmer` として (REML と ML。相関のある変量効果と相関のない変量効果 `(x \| g)`・`(x \|\| g)`、交差と入れ子の群 `a/b`・`a:b`)。`fixef`、`vcov`、`coef(summary())` (p 値を除く)、`VarCorr`、`ranef`、`fitted`、`residuals`、`logLik`、`AIC`、`BIC`、`deviance`、`REMLcrit`、`isSingular` に当たる値。lmerTest の Satterthwaite の t 検定と F 検定 (`summary`、`contest`、Type I/II/III の `anova`) と、lme4 の複数の当てはめの `anova`。lme4 の `glmer` を `glmer` として (glm のすべての族、ラプラス近似と適応的 Gauss-Hermite 求積)、その `summary`・`anova`・`predict` (`glmerSummary`・`glmerAnova`・`glmerPredict`) と `lmer` の `predict` (`lmerPredict`)。Bates ら (2015) の論文から、疎なコレスキー分解で実装。推定値は基準の厳密な最適点 (lme4 はその手前で止まる)。独立した分野 `@numero-uno-jpn/rstats/mixed` (`dist/mixed.js`) にあり、全部入りのファイルには含めない |
| 生存時間解析 | `survival` パッケージの `survdiff` (log-rank と G-rho 族) と `survfit` (Kaplan-Meier。log・plain・log-log の信頼区間と中央値)、`coxph` (Cox 回帰。Efron と Breslow のタイ、重み、層、summary の検定、ロバスト分散と `cluster`) |
| 診断の精度と測定法の比較 | pROC の `roc`、`auc` (部分 AUC も)、`ci.auc`、`roc.test`、`coords` (DeLong の区間と検定、R の乱数列によるブートストラップ)。epiR の `epi.tests` (`diagnosticTests`)。BlandAltmanLeh の `bland.altman.stats` (`blandAltman`。一致限界の厳密な区間も)。mcr の `mcreg` (Deming 回帰、重み付き Deming 回帰、Passing-Bablok 回帰。解析的、ジャックナイフ、ブートストラップの区間) |
| 一致度と信頼性 | `kappa2`、`kappamFleiss`、`icc` (irr)、`ICC` (psych。Shrout と Fleiss の 6 つの形式)、`cronbachAlpha`、`partialR` (psych)、`polychor`、`polyserial` (polycor の 2 段階推定と最尤推定)、`pbvnorm`、`omega` (McDonald の ω。psych)。反復測定の計画の効果量 (`Error()` の層と `aovEz`) |
| 最適化 | `factanal` (最尤法、varimax と promax)、`optim` の 6 つの手法すべて (Nelder-Mead、BFGS、CG、L-BFGS-B、SANN、Brent。R と同じ反復。ただし CG は、R が中点を試すところで放物線の最小点を試すので、経路が R と違う) と `optimHess` |
| データの扱い | `completeCases` (`complete.cases`)、`naOmit` (`na.omit`)、`subset`、`merge`、データフレームの `rbind`・`cbind`、`tapply`、`split`、`aggregate`、`pivotLonger` と `pivotWider` (tidyr)。検定の formula 版 (`tTest("y ~ g", data)`、`kruskalTest`、`friedmanTest("y ~ w \| b", data)`、`corTest("~ x + y", data)` など) |
| 線形代数 | R の `base` の行列関数と、`Matrix::lu`、`prcomp` (`stats`)、`MASS::ginv`: 行列演算、`crossprod`、`norm`、`backsolve`、`chol`、`qr` (R のピボット選択と LAPACK)、`solve`、`det`、`rcond`、`kappa`、`svd`、`eigen` (対称と一般)、`lu`、`prcomp`、`ginv`、`schur` (`Matrix::Schur`) と `expm` (expm の Higham08、Padé、Taylor の方法) |
| 数値計算 | `integrate`、`optimize`、`uniroot`、`approx`、`spline`/`splinefun`/`splinefunH`、Lagrange (pracma) と Hermite の補間、固定刻みの `ode` (deSolve)、`grad`/`jacobian`/`hessian` (numDeriv) |
| jStat | jStat の全関数に置き換えがある ([docs/ja/migrating-from-jstat.md](docs/ja/migrating-from-jstat.md))。jStat と照合済み |

一覧は [README](README.ja.md#含まれるもの) に、R との既知の違いは
[docs/ja/differences-from-r.md](docs/ja/differences-from-r.md) にあります。

## 残っていること

優先するのは、医学・心理学の研究で正しい手法を使えることです。小標本で正確な方法と、p 値だけでなく効果の
指標とその信頼区間を出せることを重視します。この一覧は、医学・心理学の研究向けの統計ウェブアプリの手法と
照らし合わせて作りました (2026-11-06)。優先度の高い順です。括弧内は、各項目の照合先の R の関数またはパッケージです。

1. **生存時間解析の続き:** Nelson-Aalen 推定量 [`survfit` の累積ハザード]。制限平均生存時間 [survRM2]。比例
   ハザード性の検定 [`cox.zph`]。(start, stop] 形式の時間依存性変数 [`coxph`]。競合リスク: 累積発生率、Gray の
   検定、Fine-Gray 回帰 [cmprsk]。加速故障時間モデルと Tobit モデル [`survreg`]。
2. **試験デザインのサンプルサイズと検出力:** 平均と比率の同等性・非劣性・優越性、McNemar 検定、生存時間
   (Schoenfeld、Freedman)、Simon の 2 段階デザイン [clinfun `ph2simon`]。照合先は項目に着手するときに決める。
3. **メタアナリシス:** 固定効果とランダム効果 (DerSimonian-Laird、REML)、Q と I²、Egger の検定 [metafor]。
4. **混合モデルの続き:** `lmer` と `glmer` の当てはめの `confint` (プロファイル尤度) と `simulate` [lme4]。
   `mixed` の分野はパッケージのルートと全部入りの `dist/rstats.js` には含めない (2026-11-05 に決定)。後で含めても
   互換性は崩れない。
5. **その後 (順不同):** 順序ロジスティック回帰 [MASS `polr`]、非線形回帰 [`nls` と自己開始モデル]、ロバスト回帰と
   分位点回帰 [MASS `rlm`、quantreg]、GEE [geepack]。MANOVA [`manova`]、判別分析 [MASS `lda`]、正準相関
   [`cancor`]。クラスタ分析 [`hclust`、`kmeans`]。多次元尺度法と対応分析 [`cmdscale`、MASS `isoMDS`、ca]。
   Tamhane の T2 と Page の検定 [PMCMRplus]、Grubbs の検定 [outliers]。正則化回帰 [glmnet]。時系列 [`acf`、`arima`]。

以前の項目 1 (頑健な標準誤差) と 2 (診断の正確度と測定の一致) は 1.3.0 で完了しました。それぞれの動作の文書
([oracle/robust-behaviour.md](oracle/robust-behaviour.md)、[oracle/roc-behaviour.md](oracle/roc-behaviour.md)、
[oracle/methodcomparison-behaviour.md](oracle/methodcomparison-behaviour.md)) の「rStats.js's choices」に記録した
とおり、次のものは含めていません: `coxph` のスコア残差と dfbeta 残差 (ロバスト分散のために計算するが、公開しない)。
pROC の Venkatraman の検定、部分 AUC の区間、平滑化した曲線、`percent`、座標・閾値・感度・特異度の区間 (`ci.coords`、
`ci.thresholds`、`ci.se`、`ci.sp`)、`power.roc.test`、多クラスの曲線。Youden 指数と NND (number needed to diagnose)
の区間。Bland-Altman の回帰に基づく一致限界と反復測定の一致限界 [照合先は SimplyAgree になる見込み]、片側の一致限界。
mcr の `PaBaLarge` (大きいデータ向けにビンにまとめる Passing-Bablok)、`LinReg`、`WLinReg`、`PBequi`、`TS`。欠測した
評価のある `ICC`。TOSTER の `log_TOST`、`wilcox_TOST`、`boot_t_TOST` と検出力の関数 (検出力は項目 2 に含める)。

速度: 当面の作業は完了。両方のパラメータが大きい不完全ベータ関数は Temme の一様漸近展開を使い (長さ √(a + b)
の連分数の代わりに定数時間)、一方のパラメータが大きく他方が小さいときは DiDonato と Morris の展開を使う (自由度が
大きい `pt` と `pf`、`pbeta(x, 1e6, 10)`、x が 0 または n に近い `pbinom`。最大 30 倍かかっていたのが、典型的な
`pbeta` 程度の時間になった)。主要な d/p 関数は、誤差の上界から不要と分かる double-double の処理を省く
([docs/ja/performance.md](docs/ja/performance.md) を参照)。残り: double-double のままの連分数。どちらの展開も
当てはまらないところ (a = 30、b = 20 のような中程度のパラメータ。そこでは連分数は短い。および遠い裾) では、
今も連分数を使う。

対象外: SciPy のうち R に対応するもののない部分 (`scipy.special` の大部分と、`scipy.stats` にしか
ない分布)。構造方程式モデル (`lavaan`。確認的因子分析とマルチレベル SEM を含む) も対象外です。それだけで 1 つの
ライブラリの規模があるためです。同じ理由で、項目反応理論 [mirt、ltm]、潜在クラス分析 [poLCA]、多重代入 [mice]、
混合正規分布モデル [mclust] も対象外です。分布のパラメータのベクトルとしてのリサイクル
(`rnorm(3, mean = c(0, 10, 100))`) も対象外です。`map` で R と同じ結果と乱数列が得られるためです
([docs/ja/differences-from-r.md](docs/ja/differences-from-r.md#全般) を参照)。ほかの RNG の種類
(Wichmann-Hill、Marsaglia-Multicarry、Super-Duper、Knuth-TAOCP) と正規乱数の種類 (Kinderman-Ramberg、
Ahrens-Dieter、Box-Muller) も対象外です。古いコードの再現にしか使わないためです。

## サイズ

バンドラを使う利用者には import した関数だけが入るので (`pnorm` だけなら gzip 後 1.6 KB)、関数を
増やしても利用者の負担にはなりません。CDN 用には、分野ごとのファイル (`dist/distributions.js`、
`dist/tests.js`、`dist/linalg.js`、`dist/descriptive.js`、`dist/numerics.js`、`dist/special.js`、
`dist/mixed.js`) を esbuild のコード分割で作り (共通のコードは重複しない)、`mixed` 以外のすべてを含む
`dist/rstats.js` も残しています (混合モデルは大きいので、全部入りのファイルに含めません。2026-11-05 に決定)。
同じ分野はパッケージのサブパスとしても import できます (`@numero-uno-jpn/rstats/linalg` など)。
大きさは `npm run size` で確かめられます。npm に公開した後は、export 単位でバンドルする CDN
(`?exports=` を付けた esm.sh など) も選択肢になります。

## 移植するコードの出典

- 寛容なライセンスの出典からのみ移植する: SciPy と xsf (BSD-3)、Boost.Math (BSL-1.0)、
  statsmodels (BSD-3)、lifelines (MIT)、LAPACK のリファレンス実装 (修正 BSD)、パブリック
  ドメインのコード (LINPACK、EISPACK、xsf とともに配布されている Cephes)、公表された論文。
- R は、結果を照合する oracle として使う。R の挙動を確かめるために R のソースを読むのはよいが、
  rStats.js が MIT ライセンスのままでいられるよう、R と GPL のパッケージのコードはコピーも翻訳も
  しない。
- 移植したファイルにはそれぞれ出典を書き、その出典を
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) に載せる。
  [CONTRIBUTING.ja.md](CONTRIBUTING.ja.md) も参照してください。
