# ロードマップ

[English](ROADMAP.md) | 日本語

> この文書は [英語版](ROADMAP.md) の訳です。内容が食い違うときは英語版が正です。

## 目標

R の `stats` パッケージ (と `base` の関連部分) の数値計算の中核を、R と同じ関数名・既定値・数値
結果のまま、素の TypeScript でカバーすること。対象は分布、仮説検定、特殊関数、線形代数の基本です。
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
| 特殊関数 | `gamma`、`lgamma`、`beta`、`lbeta`、`choose`、`lchoose`、`factorial`、`lfactorial`、`digamma`、`trigamma`、`psigamma`、`besselI`、`besselK`、`besselJ`、`besselY` と、R にはない `erf`、`erfc` を export。不完全ガンマ関数・不完全ベータ関数、log1p 系の関数は内部で実装済み |
| 分布 | R の `stats` にある 20 の分布すべて (スチューデント化された範囲を含む) と、非心カイ二乗・t・F・ベータ分布の d/p/q (`lowerTail` と `logP` 付き) |
| 乱数 | R の既定の Mersenne-Twister と `set.seed()` 互換の乱数列、20 の `r*` 関数、`rmultinom`、`sample`、`sampleInt` |
| 仮説検定 | `tTest`、`chisqTest`、`fisherTest` (r × c を含む)、`wilcoxTest` (正確法と近似法、信頼区間付き)、`cor`、`corTest`、`pAdjust`。R の `htest` のフィールドをすべて返す |
| 線形代数 | R の `base` の行列関数と `MASS::ginv`: `crossprod`、`norm`、`backsolve`、`chol`、`qr` (R のピボット選択と LAPACK)、`solve`、`det`、`rcond`、`kappa`、`svd`、`eigen` (対称と一般)、`ginv` |

一覧は [README](README.ja.md#含まれるもの) に、R との既知の違いは
[docs/ja/differences-from-r.md](docs/ja/differences-from-r.md) にあります。

## 残っていること

優先度の高い順です。

1. **jStat の機能をすべてカバーする** (2026-10-24 に決定)。jStat を使っているプロジェクトが、移行の
   手引き 1 枚 ([docs/ja/migrating-from-jstat.md](docs/ja/migrating-from-jstat.md)) で乗り換えられる
   ようにする。名前と既定値は jStat ではなく R に合わせる。順に、記述統計 (`mean`、`var`、R の 9 種類の
   `quantile`、`rank`、行列の `cov`/`cor`、`hist`、`ecdf`、歪度と尖度など)、行列演算 (`matMul`、要素
   ごとの演算、`outer`、`diag`、`lu`、`prcomp`)、一元配置の `aov`・`TukeyHSD`・`zTest`、行列の
   インターフェースの `lm`、数値計算 (`integrate`、`optimize`、`uniroot`、`approx`/`spline`、Lagrange と
   Hermite の補間、固定刻みの `ode`、`grad`/`hessian`/`jacobian`)、jStat にあって R にない分布 (逆ガンマ、
   Kumaraswamy、Pareto、三角、Laplace、逆正弦) と全分布の平均・分散・中央値・最頻値・歪度・尖度、
   `gammainc`・`erfinv`・`erfcinv`・`perm`。R にない関数は R のパッケージ (extraDistr、e1071、
   DescTools、pracma、deSolve、numDeriv、BSDA) と照合する。
2. **仮説検定:** `binom.test`、`prop.test`、`poisson.test`、`mcnemar.test`、`mantelhaen.test`、
   `ks.test`、`shapiro.test`、`kruskal.test`、`friedman.test`、`quade.test`、`var.test`、
   `bartlett.test`、`fligner.test`、`ansari.test`、`mood.test`、`oneway.test` と `pairwise.*` は
   作成済みで R と一致する (1 と一緒に export する)。残りは `ansari.test` の信頼区間、`chisqTest` と
   `fisherTest` の `simulate.p.value`、`chisqTest` に 2 つの因子ベクトルを渡す使い方。
3. **特殊関数:** `erf` と `erfc` はおまけとして export 済み。内部で実装済みの log1p 系の関数も、
   おまけとして export してよい。
4. **分布:** 分布のパラメータをベクトルとして与えたときのリサイクル。
5. **速度:** 必要な箇所だけ double-double に切り替える高速な倍精度の経路と、パラメータが大きい
   ときの不完全ベータ関数の漸近展開 ([docs/ja/performance.md](docs/ja/performance.md) を参照)。
6. **乱数:** R の既定以外の RNG の種類。

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
