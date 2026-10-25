# rStats.js

[English](README.md) | 日本語

> この文書は [英語版](README.md) の訳です。内容が食い違うときは英語版が正です。

JavaScript とブラウザで使える、R と互換の統計関数のライブラリです。TypeScript で書いています。
[ブラウザで試す](https://numero-uno-jpn.github.io/rStats.js/demo/) (すべての関数を、R が出す値と並べて試せます)。

- **R と同じ数値を返します。** 関数名・既定値・結果は R に合わせています。すべての関数を R 4.5.2 と
  比べてテストしています (分布関数は相対誤差 1e-14)。R 自身が不正確なところでは、高精度の参照値と
  比べています。
- **JavaScript らしい呼び出し方です。** 必須の引数は位置で渡し、省略できる引数は camelCase のキーを
  持つオブジェクトで渡します。`pt(q, df, { lowerTail: false })` は R の `pt(q, df, lower.tail = FALSE)` に
  当たります。結果は素のオブジェクトなので、そのまま `JSON.stringify` できます。
- **どこでも動きます。** ESM のみで、依存パッケージはなく、Node 専用の API も使っていません。
  tree-shaking が効きます (`pnorm` だけなら gzip で 1.2 KB)。

状態: **0.8.0。** R の stats パッケージの数値計算の中心
(分布・記述統計・検定・線形モデル・特殊関数・数値計算・線形代数の基本) を、R と同じ結果でカバーすることを目指しています。残っている作業は
[ROADMAP.ja.md](ROADMAP.ja.md)、変更履歴は [CHANGELOG.md](CHANGELOG.md) (英語) にあります。

## インストール

```sh
npm install @numero-uno-jpn/rstats
```

ES2022 の環境が必要です (現行のブラウザ、Node.js 22 以降、Deno、Bun)。

## 使い方の例

### 分布

```ts
import { pnorm, qnorm, pt, qbeta, dbinom } from "@numero-uno-jpn/rstats";

pnorm(1.96);                                  // 0.9750021048517795
qnorm([0.025, 0.975]);                        // [-1.9599639845400545, 1.959963984540054]
pt(-40, 3);                                   // 1.7190340394579263e-5
pt(2, 10, { lowerTail: false, logP: true });  // -3.3051415512324533 (log of the upper tail)
qbeta(1e-10, 2, 3);                           // 4.082494015808333e-6
dbinom(3, 10, 0.2);                           // 0.20132659200000003
```

最初の引数には数値・配列・`Float64Array` を渡せます。結果は同じ形で返ります。分布の母数はスカラーです。

### `set.seed()` と同じ乱数

```ts
import { setSeed, rnorm, RNGkind, getRandomSeed, setRandomSeed, nextRNGStream, runif } from "@numero-uno-jpn/rstats";

setSeed(42);
rnorm(3);  // [1.3709584471466685, -0.5646981713960887, 0.3631284113373392]
           // R: set.seed(42); rnorm(3) gives the same numbers (up to the last bit)

// R の既定以外の設定: RNGkind("L'Ecuyer-CMRG") と parallel::nextRNGStream、sample.kind = "Rounding"
RNGkind({ kind: "L'Ecuyer-CMRG" });
setSeed(1);                                   // R: set.seed(1, kind = "L'Ecuyer-CMRG")
setRandomSeed(nextRNGStream(getRandomSeed())); // R: .Random.seed <- nextRNGStream(.Random.seed)
runif(2);  // [0.31369782407981056, 0.9280126525616814]
```

R で `set.seed(42); rnorm(3)` とすると、最後のビットまで同じ数値になります。

### 検定

```ts
import { tTest, fisherTest, pAdjust } from "@numero-uno-jpn/rstats";

const r = tTest([5.1, 4.9, 6.2, 5.8, 6.0, 5.5], [4.1, 4.5, 5.0, 4.8, 4.3]);
r.pValue;    // 0.0035365308877675647 (Welch, the default in R)
r.confInt;   // [0.4423253334608047, 1.6443413332058612]
r.method;    // "Welch Two Sample t-test"

fisherTest([[3, 1], [1, 3]]).pValue;                     // 0.4857142857142857
pAdjust([0.01, 0.02, 0.03, 0.04], { method: "BH" });    // ≈ [0.04, 0.04, 0.04, 0.04]
```

`tTest` の既定は、R と同じ Welch の検定です。

### 一般化線形モデル

説明変数は `lm` と同じく行列 (行の配列) かベクトルで渡します。二項分布の応答は (成功数, 失敗数) の行でも渡せます。

```ts
import { glm, glmSummary, glmPredict, glmConfint, glmAnova } from "@numero-uno-jpn/rstats";

const dose = [1, 2, 3, 4, 5, 6];
const counts = [[1, 19], [4, 16], [9, 11], [13, 7], [18, 2], [19, 1]];
const fit = glm(dose, counts, { family: "binomial" });   // R: glm(cbind(s, f) ~ dose, binomial)
fit.coefficients;                                  // ≈ [-3.77413, 1.14807]
glmSummary(fit).pValue;                            // ≈ [5.357e-8, 3.579e-9] (z tests)
glmPredict(fit, { newdata: [3.5], type: "response" }); // { fit: ≈ [0.56073], seFit: ≈ [0.06140] }
glmConfint(fit).lower;                             // ≈ [-5.27166, 0.80033] (profile likelihood)
glmAnova(fit).table[1];                            // ≈ [1, 62.978, 4, 0.5196, 2.09e-15]
fit.warnings;                                      // [] (R's warnings, such as non-convergence)
```

### 線形代数

行列は行の配列で表します。

```ts
import { solve, qr, qrCoef, svd, eigen } from "@numero-uno-jpn/rstats";

solve([[2, 1], [1, 3]]);            // [[0.6, -0.2], [-0.2, 0.4]]
const q = qr([[1, 1], [1, 2], [1, 3]]);
qrCoef(q, [1, 3, 4]);               // ≈ [-0.333, 1.5] (least squares)
svd([[1, 4], [2, 5], [3, 6]]).d;    // [9.50803200069572, 0.7728696356734838]
eigen([[2, 1], [1, 3]]).values;     // [3.618033988749895, 1.381966011250105]
```

## 含まれるもの

| 分野 | 関数 (R と名前が違うものは括弧内が R の名前) |
|---|---|
| 特殊関数 | `gamma`, `lgamma`, `beta`, `lbeta`, `choose`, `lchoose`, `factorial`, `lfactorial`, `digamma`, `trigamma`, `psigamma`, `besselI`, `besselK`, `besselJ`, `besselY`。R にはない `erf`, `erfc`, `erfinv`, `erfcinv`, `gammainc`, `perm` と、R の C API (Rmath.h) の `log1pmx`, `lgamma1p`, `log1mexp`, `log1pexp` も |
| 分布 (d/p/q) | 正規、t、カイ二乗、F、ベータ、ガンマ、二項、ポアソン、一様、指数、対数正規、ロジスティック、コーシー、ワイブル、幾何、負の二項、超幾何、Wilcoxon の符号付き順位と順位和、スチューデント化された範囲 (`ptukey`, `qtukey`)、非心カイ二乗・t・F・ベータ (`ncp`)。多項分布の確率 (`dmultinom`)。逆ガンマ、Kumaraswamy、Pareto、三角、Laplace (extraDistr) と逆正弦。`distSummary` (平均・分散・標準偏差・中央値・最頻値・歪度・尖度) |
| 乱数 | `setSeed` (`set.seed`), `RNGkind` (Mersenne-Twister と L'Ecuyer-CMRG、`sample.kind` の Rejection と Rounding), `getRandomSeed`/`setRandomSeed` (`.Random.seed`), `nextRNGStream`/`nextRNGSubStream` (`parallel`), 26 個の `r*` 関数, `sample`, `sampleInt` (`sample.int`), `r2dtable` |
| 記述統計 | `sum`, `prod`, `mean`, `weightedMean` (`weighted.mean`), `variance` (`var`), `sd`, `median`, `range`, `cumsum`, `cumprod`, `cummax`, `cummin`, `diff`, `quantile`, `IQR`, `fivenum`, `mad`, `rank`, `cov`, `cor`, `tabulate`, `table`, `unique`, `cut`, `findInterval`, `pretty`, `hist`, `ecdf`, `scale`, `skewness`, `kurtosis`, `geometricMean`, `modes`, `meanAD`, `cv` |
| 検定 | `tTest`, `chisqTest`, `fisherTest`, `wilcoxTest`, `corTest`, `binomTest`, `poissonTest`, `propTest`, `mcnemarTest`, `varTest`, `bartlettTest`, `kruskalTest`, `friedmanTest`, `quadeTest`, `flignerTest`, `moodTest`, `onewayTest`, `shapiroTest`, `mantelhaenTest`, `ansariTest`, `ksTest`, `pairwiseTTest`, `pairwiseWilcoxTest`, `pairwisePropTest`, `aov`, `TukeyHSD`, `zTest`, `brunnerMunzelTest`, `pAdjust` (`p.adjust`) |
| 線形モデル | `lm` (行列で渡す形。`summary` の値も返す), `confint`, `predict`。`glm` (行列で渡す形。R の `stats` のすべての族とリンク) と `glmSummary` (`summary.glm`)、`glmResiduals` (4 種類)、`glmHatvalues`、`glmRstandard`、`glmCooksDistance`、`glmPredict` (標準誤差つき)、`glmConfint` (プロファイル尤度、厳密な限界)、`glmAnova` (`anova.glm`) |
| 線形代数 | `matMul` (`%*%`), `add`, `subtract`, `multiply`, `divide`, `outer`, `t`, `diag`, `cbind`, `rbind`, `matrix`, `kronecker`, `seq`, `crossprod`, `tcrossprod`, `norm`, `backsolve`, `forwardsolve`, `chol`, `chol2inv`, `qr` と `qrQ`, `qrR`, `qrX`, `qrCoef`, `qrQy`, `qrQty`, `qrResid`, `qrFitted`, `qrSolve` (`qr.Q` …), `solve`, `det`, `determinant`, `rcond`, `kappa`, `svd`, `eigen`, `lu`, `prcomp`, `ginv` (MASS) |
| 数値計算 | `integrate`, `optimize`, `uniroot`, `approx`, `spline`, `splinefun`, `splinefunH`, `barylag`, `hermiteInterp`, `ode`, `grad`, `jacobian`, `hessian` |

jStat から移るときは [docs/ja/migrating-from-jstat.md](docs/ja/migrating-from-jstat.md) に jStat の全関数の置き換えがあります。

API リファレンスは `npm run docs` (TypeDoc) で作れます (英語)。

## 精度

正解の値は [`oracle/`](oracle) の R のスクリプトで作り、[`test/fixtures/`](test/fixtures) に
保存してあります。そのため、テストは R がなくても動きます。各ケースは、R と一致するか、R が
間違っているところでは Rmpfr や gmp で計算した高精度の値と一致すれば合格です。分布の裾の深い
ところや母数の大きいところでは、rStats.js のほうが R より正確なことがよくあります。指数部を
double-double 演算で計算しているためです。詳しくは [docs/ja/accuracy.md](docs/ja/accuracy.md) を
見てください。

## R との違い

違いの多くは、R の精度が落ちるか、R が失敗するケースです。ふだんの使い方に関わる意図的な違いは
次のとおりです。

- 添字は 0 から始まります。`sampleInt(n)` は `0..n-1` を返します (R の `sample.int()` から 1 を
  引いた値で、乱数の列は同じ)。`qr` と `chol` のピボットも 0 から始まります。
- 固有ベクトルと特異ベクトルの符号が R と違うことがあります (どちらも正しい答えです)。
- 検定は R の警告を出しません。数値の欄と手法の名前はすべて一致します。`glm` は R の警告を結果の
  `warnings` で返します。
- 分布の母数は、ベクトルとして使い回されません (リサイクルしない)。

すべての違いは [docs/ja/differences-from-r.md](docs/ja/differences-from-r.md) にあります。

## ブラウザで使う

バンドラ (Vite、esbuild、webpack、Rollup) を使う場合は、関数を名前で import してください。
使わない関数は取り除かれます。minify と gzip をした後のおおよその大きさは次のとおりです。

| import するもの | gzip |
|---|---|
| `pnorm` | 1.2 KB |
| `setSeed`, `rnorm` | 1.7 KB |
| `solve` / `svd` / `eigen` | 1.7 / 2.0 / 3.7 KB |
| `wilcoxTest` / `fisherTest` / `tTest` | 8.6 / 15.6 / 21.4 KB |
| `qbeta` / `pt` と `qt` | 23.2 / 30.3 KB |
| `glm` と `glmSummary` / `glm` とそのすべての関数 | 27.2 / 39.2 KB |
| すべて | 130.0 KB |

(`npm run size` で測れます。)

分野ごとにサブパスからも export しているので、1 つの分野だけを import することもできます。
`@numero-uno-jpn/rstats/distributions`、`/tests` (検定、`lm`・`confint`・`predict`、`glm` とその関数)、`/linalg`、
`/descriptive`、`/numerics`、`/special` です。

バンドラを使わない場合は、1 ファイルにまとめたビルド `dist/rstats.js` (すべての関数を含む minify 済みの
ES モジュール、gzip で 122 KB) を jsDelivr から読み込めます。jsDelivr は、このリポジトリのリリースの
タグをそのまま配信します。

```html
<script type="module">
  import { pnorm } from "https://cdn.jsdelivr.net/gh/numero-uno-jpn/rStats.js@v0.8.0/dist/rstats.js";
  console.log(pnorm(1.96)); // 0.9750021048517795
</script>
```

関数は R と同じ名前の named export で、`jStat.` や `_.` のような接頭辞はありません。他の名前と区別
したいときは、名前空間として import してください (上の URL から `import * as rs from` で読み込む)。
`rs.pnorm(1.96)`、`rs.tTest(x, y)` のように呼べます。バンドラを使う場合
(`import * as rs from "@numero-uno-jpn/rstats"`) も、使わない関数は取り除かれます。CDN から読み込む
場合は、どちらの書き方でもファイル全体が読み込まれます。`window` には何も追加しません。他のスクリプトや
ブラウザのコンソールから使うときは、自分で `window.rs = rs` としてください。

一部の分野だけを使うページでは、代わりに分野ごとのバンドルを読み込めます。`dist/distributions.js`、
`dist/tests.js`、`dist/linalg.js`、`dist/descriptive.js`、`dist/numerics.js`、`dist/special.js` は
上のサブパスと同じ関数を export し、共通のコードを `dist/chunks/` で共有します。そのため、2 つの分野を
読み込んでも共通部分は 1 回しか読み込まれません。chunk を含めた 1 分野の転送量は、gzip で 18 KB
(`numerics`) から 93 KB (`tests`) です。

ビルド結果 (`dist/`) は main ブランチにはなく、リリースのタグにだけ入っています。npm を元にした CDN も
使えます。たとえば
`https://cdn.jsdelivr.net/npm/@numero-uno-jpn/rstats@0.8.0/dist/rstats.js` や
`https://esm.sh/@numero-uno-jpn/rstats` です。

ブラウザ向けのビルドは、headless Chromium でテストしています。バンドラでまとめた場合と、
`dist/rstats.js` を ES モジュールとして読み込んだ場合の両方です (`npm run test:browser`)。

**デモ:** <https://numero-uno-jpn.github.io/rStats.js/demo/>。[`demo/`](demo) は、`dist/rstats.js` を jsDelivr から読み込んで、すべての関数を試せる
静的なページです。確率分布 (グラフ付き)・特殊関数・乱数・検定・線形代数を扱います。各フォームには、
入力に対応する R と JavaScript のコードが表示されます。「R との比較」のタブでは、例題の値を R が
出力した値と照らし合わせます (`source("examples.R")` で、すべての例題を R で実行できます)。CDN の
代わりに手元のビルドを使うには、`npm run build` をしてから、リポジトリのルートを静的サーバー
(たとえば `npx serve .`) で配信し、`/demo/?src=local` を開いてください。

## 版の番号

版が 0.x の間は、minor の版で互換性のない変更が入ることがあります。その場合は変更履歴に
書きます。1.0.0 からは Semantic Versioning に従います。

## 貢献

R との答え合わせの仕組みと、ライセンスの決まり (R や GPL のパッケージのコードは使わない) は
[CONTRIBUTING.ja.md](CONTRIBUTING.ja.md) にあります。速さと double-double 演算については
[docs/ja/performance.md](docs/ja/performance.md) にあります。

## ライセンス

MIT です。数値計算の部品は、SciPy の xsf・scipy.stats・QUADPACK の C 訳 (BSD-3)、Boost.Math
(BSL-1.0)、statsmodels (BSD-3)、LAPACK の参照実装 (修正 BSD) から移植しています。パブリックドメインの
LINPACK・EISPACK・Cephes・QUADPACK・netlib のコードも使っています。詳しくは
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) (英語) を見てください。
