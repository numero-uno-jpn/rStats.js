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
| 線形モデル | 行列で渡す `lm` と `summary.lm` の値、`confint`、`predict`。行列で渡す `glm` (R の `stats` のすべての族とリンク)、`summary.glm`、4 種類の残差、`hatvalues`、`rstandard`、`cooks.distance`、標準誤差つきの `predict`、プロファイル尤度の `confint` (厳密な限界)、`anova` |
| 線形代数 | R の `base` の行列関数と、`Matrix::lu`、`prcomp` (`stats`)、`MASS::ginv`: 行列演算、`crossprod`、`norm`、`backsolve`、`chol`、`qr` (R のピボット選択と LAPACK)、`solve`、`det`、`rcond`、`kappa`、`svd`、`eigen` (対称と一般)、`lu`、`prcomp`、`ginv` |
| 数値計算 | `integrate`、`optimize`、`uniroot`、`approx`、`spline`/`splinefun`/`splinefunH`、Lagrange (pracma) と Hermite の補間、固定刻みの `ode` (deSolve)、`grad`/`jacobian`/`hessian` (numDeriv) |
| jStat | jStat の全関数に置き換えがある ([docs/ja/migrating-from-jstat.md](docs/ja/migrating-from-jstat.md))。jStat と照合済み |

一覧は [README](README.ja.md#含まれるもの) に、R との既知の違いは
[docs/ja/differences-from-r.md](docs/ja/differences-from-r.md) にあります。

## 残っていること

優先度の高い順です。括弧内は、各項目の照合先の R の関数またはパッケージです。

1. **分散分析:** 2 つ以上の因子と交互作用、`lm` に対する `anova`、Type II と Type III の平方和
   (`car::Anova`)、反復測定と混合計画、`mauchly.test`、Greenhouse-Geisser と Huynh-Feldt の補正
   (`afex`)。
2. **効果量と検出力:** Cohen の d、Hedges の g、η²、偏 η²、ω² とその信頼区間 (`effectsize`)。
   `power.t.test`、`power.prop.test`、`power.anova.test` (`stats`) と、効果量で指定する `pwr` の関数。
3. **多重比較:** Steel-Dwass (`PMCMRplus`)、Dunn (`dunn.test`)、Dunnett と Steel (`multcomp`、
   `PMCMRplus`)。`multcomp` は Dunnett の p 値を `mvtnorm` の乱数を使う積分で求めるので、再現するのは
   5 桁程度です。Dunnett の統計量の相関は積の形をしていて、確率が 1 次元の積分に帰着するので、
   これらは完全な精度で計算し、代わりに高精度の参照値と照合します。
4. **ほかの検定:** Levene (`car::leveneTest`)、`prop.trend.test` (`stats`)、Jonckheere-Terpstra
   (`clinfun`)、Cochran の Q (`DescTools`)、正規性の Anderson-Darling 検定と Lilliefors 検定
   (`nortest`)。
5. **生存時間解析:** log-rank 検定 (`survival::survdiff`) と、Kaplan-Meier 推定とその信頼区間
   (`survival::survfit`)。Cox 回帰は後で。
6. **最適化と因子分析:** `optim`、次に `factanal` (`stats`)、次に McDonald の ω (`psych`)。
7. **一致度・信頼性・相関:** Cohen の κ と ICC (`irr`)、Cronbach の α (`psych`)、偏相関、
   ポリコリック相関とテトラコリック相関 (`polycor`)。
8. **速度:** 当面の作業は完了。両方のパラメータが大きい不完全ベータ関数は Temme の一様漸近展開を
   使い (長さ √(a + b) の連分数の代わりに定数時間)、一方のパラメータが大きく他方が小さいときは
   DiDonato と Morris の展開を使う (自由度が大きい `pt` と `pf`、`pbeta(x, 1e6, 10)`、x が 0 または n
   に近い `pbinom`。最大 30 倍かかっていたのが、典型的な `pbeta` 程度の時間になった)。主要な d/p 関数は、
   誤差の上界から不要と分かる double-double の処理を省く ([docs/ja/performance.md](docs/ja/performance.md)
   を参照)。残り: double-double のままの連分数。どちらの展開も当てはまらないところ (a = 30、b = 20
   のような中程度のパラメータ。そこでは連分数は短い。および遠い裾) では、今も連分数を使う。

いずれ取り組むかもしれないもの (それ自体が大きなプロジェクト): **`base` を超える線形代数**。
Schur 分解と行列指数関数で、推奨パッケージ `Matrix` と `expm` パッケージで照合する。

対象外: SciPy のうち R に対応するもののない部分 (`scipy.special` の大部分と、`scipy.stats` にしか
ない分布)。構造方程式モデル (`lavaan`) と混合モデル (`lme4`) も対象外です。どちらもそれだけで
1 つのライブラリの規模があるためです。分布のパラメータのベクトルとしてのリサイクル
(`rnorm(3, mean = c(0, 10, 100))`) も対象外です。`map` で R と同じ結果と乱数列が得られるためです
([docs/ja/differences-from-r.md](docs/ja/differences-from-r.md#全般) を参照)。ほかの RNG の種類
(Wichmann-Hill、Marsaglia-Multicarry、Super-Duper、Knuth-TAOCP) と正規乱数の種類 (Kinderman-Ramberg、
Ahrens-Dieter、Box-Muller) も対象外です。古いコードの再現にしか使わないためです。

## サイズ

バンドラを使う利用者には import した関数だけが入るので (`pnorm` だけなら gzip 後 1.2 KB)、関数を
増やしても利用者の負担にはなりません。CDN 用には、分野ごとのファイル (`dist/distributions.js`、
`dist/tests.js`、`dist/linalg.js`、`dist/descriptive.js`、`dist/numerics.js`、`dist/special.js`) を
esbuild のコード分割で作り (共通のコードは重複しない)、すべてを含む `dist/rstats.js` も残しています。
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
