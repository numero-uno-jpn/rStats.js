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

SciPy (`scipy.stats`、`scipy.special`、`scipy.linalg`) は移植元のコードであり、何が役に立つかの
手がかりでもありますが、目標ではありません。R に対応するもののない関数は R と照合できないので、
優先しません。

## 完了したこと

| 分野 | 状況 |
|---|---|
| 特殊関数 | `gamma`、`lgamma`、`beta`、`lbeta`、`choose`、`lchoose`、`factorial`、`lfactorial`、`digamma`、`trigamma`、`psigamma`、`besselI`、`besselK`、`besselJ`、`besselY` と、R にはない `erf`、`erfc`、`erfinv`、`erfcinv`、`gammainc`、`perm` を export。log1p 系の関数は内部で実装済み |
| 分布 | R の `stats` にある 20 の分布すべて (スチューデント化された範囲を含む)、非心カイ二乗・t・F・ベータ分布、逆ガンマ・Kumaraswamy・Pareto・三角・Laplace (extraDistr)・逆正弦の d/p/q (`lowerTail` と `logP` 付き)。すべての分布の `distSummary` |
| 乱数 | R の既定の Mersenne-Twister と `set.seed()` 互換の乱数列、26 の `r*` 関数 (R にない分布は extraDistr と同じ乱数列)、`rmultinom`、`sample`、`sampleInt` |
| 記述統計 | R の要約 (`mean`、`variance`、9 種類の `quantile`、`rank`、行列の `cov`/`cor`、`table`、`cut`、`hist`、`ecdf`、`scale` など) と e1071・DescTools のもの (`skewness`、`kurtosis`、`geometricMean`、`modes`、`meanAD`、`cv`) |
| 仮説検定 | R の `htest` の関数: `tTest`、`chisqTest`、`fisherTest` (r × c を含む)、`wilcoxTest`、`corTest`、`binomTest`、`poissonTest`、`propTest`、`mcnemarTest`、`varTest`、`bartlettTest`、`kruskalTest`、`friedmanTest`、`quadeTest`、`flignerTest`、`moodTest`、`onewayTest`、`shapiroTest`、`mantelhaenTest`、`ansariTest`、`ksTest`、`pairwise*`、`pAdjust`。一元配置の `aov`、`TukeyHSD`、`zTest` (BSDA) |
| 線形モデル | 行列で渡す `lm` と `summary.lm` の値、`confint`、`predict` |
| 線形代数 | R の `base` の行列関数と `MASS::ginv`: 行列演算、`crossprod`、`norm`、`backsolve`、`chol`、`qr` (R のピボット選択と LAPACK)、`solve`、`det`、`rcond`、`kappa`、`svd`、`eigen` (対称と一般)、`lu`、`prcomp`、`ginv` |
| 数値計算 | `integrate`、`optimize`、`uniroot`、`approx`、`spline`/`splinefun`/`splinefunH`、Lagrange (pracma) と Hermite の補間、固定刻みの `ode` (deSolve)、`grad`/`jacobian`/`hessian` (numDeriv) |
| jStat | jStat の全関数に置き換えがある ([docs/ja/migrating-from-jstat.md](docs/ja/migrating-from-jstat.md))。jStat と照合済み |

一覧は [README](README.ja.md#含まれるもの) に、R との既知の違いは
[docs/ja/differences-from-r.md](docs/ja/differences-from-r.md) にあります。

## 残っていること

優先度の高い順です。

1. **仮説検定:** `ansari.test` の信頼区間、`chisqTest` と `fisherTest` の `simulate.p.value`、
   `chisqTest` に 2 つの因子ベクトルを渡す使い方。
2. **特殊関数:** 内部で実装済みの log1p 系の関数も、おまけとして export してよい。
3. **分布:** 分布のパラメータをベクトルとして与えたときのリサイクル。
4. **速度:** 必要な箇所だけ double-double に切り替える高速な倍精度の経路と、パラメータが大きい
   ときの不完全ベータ関数の漸近展開 ([docs/ja/performance.md](docs/ja/performance.md) を参照)。
5. **乱数:** R の既定以外の RNG の種類。

いずれ取り組むかもしれないもの (どれもそれ自体が大きなプロジェクト):

- **`lm` を超える線形モデル:** 行列インターフェースの `glm` (JavaScript には式もデータフレームも
  ないため)。
- **`base` を超える線形代数:** Schur 分解、行列指数関数。推奨パッケージ `Matrix` と `expm`
  パッケージで照合する。
- **最適化:** `optim`。

対象外: SciPy のうち R に対応するもののない部分 (`scipy.special` の大部分と、`scipy.stats` にしか
ない分布)。

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
