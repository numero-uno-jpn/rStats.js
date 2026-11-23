# rStats.js API リファレンス

rStats.js は、R の数値計算の中心を JavaScript に提供します。確率分布、R の `set.seed()` と一致する乱数、記述統計、仮説検定、線形モデル、一般化線形モデル、順序・ロバスト・非線形回帰、(一般化) 線形混合モデルと頑健な共分散、生存時間解析、試験デザインの標本サイズと検出力、メタアナリシスとメタ回帰、診断の精度と測定法の比較、線形代数、数値計算です。関数の名前と結果は R に従い、関数は R と比べてテストしています (相対誤差で、分布は 1e-14、検定とモデルは 1e-12 まで。[精度](https://numero-uno-jpn.github.io/rStats.js/docs/ja/accuracy.html) を参照)。R と比べる代わりに、R 自身が不正確な場合や R にその関数がない場合は、高精度の参照値と比べています。

このリファレンスでは、すべての関数について、そのオプション、結果、使用例を載せています (使用例はテストで実行しています)。関数は、メニューで分野ごとにまとめてあります。

## はじめに

- [R の関数と rStats.js の関数](https://numero-uno-jpn.github.io/rStats.js/docs/ja/r-functions.html): R の関数に対応する rStats.js の関数を探せます (`t.test` → `tTest`)。各関数に 1 行の説明があります。
- [JavaScript の開発者のための rStats.js](https://numero-uno-jpn.github.io/rStats.js/docs/ja/guide-for-js-developers.html): データフレーム、欠測値、因子、式と、分析の一通りの例を扱います。R で分析を書く方法に慣れていない読者向けです。
- [ブラウザで試す](https://numero-uno-jpn.github.io/rStats.js/demo/): ブラウザで、すべての関数を R の値と並べて試せます。
- [R との違い](https://numero-uno-jpn.github.io/rStats.js/docs/ja/differences-from-r.html) と [精度](https://numero-uno-jpn.github.io/rStats.js/docs/ja/accuracy.html)。

## 使い方

```sh
npm install @numero-uno-jpn/rstats
```

```ts
import { pnorm, tTest, lm } from "@numero-uno-jpn/rstats";        // すべて (バンドラーが使わない部分を除きます)
import { qbeta } from "@numero-uno-jpn/rstats/distributions";       // または 1 つの分野: distributions、tests、
                                                                     // descriptive、linalg、numerics、special
import { lmer, glmer } from "@numero-uno-jpn/rstats/mixed";        // 混合モデル: この分野からだけ
import { polr, rlm, nls } from "@numero-uno-jpn/rstats/regression"; // 回帰: この分野からだけ
import { rq, rqSummary, rqPredict, rqPredictInterval, rqAnova } from "@numero-uno-jpn/rstats/regression";
import { geeglm, geeSummary, geeVcov, geePredict, geeAnova, geeQIC } from "@numero-uno-jpn/rstats/regression";
import { glmnet, glmnetCoef, glmnetPredict, cvGlmnet } from "@numero-uno-jpn/rstats/regression";
```

`/regression` には、分位点回帰 (`rq`)、一般化推定方程式 (`geeglm`)、正則化回帰 (`glmnet`) もあります。
たとえば、`rq("y ~ x", data, { tau: 0.5 })` は条件付き中央値を当てはめ、
`geeglm("y ~ x", data, { id: "subject", corstr: "exchangeable" })` は周辺モデルを当てはめ、
`glmnet(x, y, { family: "gaussian", alpha: 1 })` は lasso の経路を求めます。
メソッドはそれぞれ `rqSummary` / `rqPredictInterval`、`geeSummary` / `geeVcov` / `geeQIC`、
`glmnetCoef` / `glmnetPredict` / `cvGlmnet` です。

バンドラーを使わないときは、`https://cdn.jsdelivr.net/npm/@numero-uno-jpn/rstats@1.11.0/dist/rstats.js` が、混合モデル・回帰・多変量解析以外のすべての関数を含む 1 つの ES モジュールです。混合モデルは `dist/mixed.js`、回帰は `dist/regression.js`、多変量解析は `dist/multivariate.js` にあります。URL にはバージョンを含めてください (正確なバージョン、または 1.0.0 以降の `@1` のようなメジャーバージョン)。バージョンのない URL は、破壊的変更を含むすべての新しいリリースに追従してしまいます。1 つのページでは、`dist/rstats.js` か分野ごとのバンドル (`dist/tests.js`、`dist/mixed.js`、`dist/regression.js`、`dist/multivariate.js` など) のどちらか一方だけを使ってください。両方を混ぜると、共通のコードが 2 度読み込まれ、乱数の状態も 2 つになります。

## 規約

### 名前

R の名前を使います。ドット (.) は camelCase になります: `t.test` → `tTest`、`p.adjust` → `pAdjust`。他のパッケージの関数も、名前をそのまま使います: `car::Anova` → `Anova`、`tidyr::pivot_longer` → `pivotLonger`、`TOSTER::t_TOST` → `tTOST`。psych の `ICC` と irr の `icc` は別の関数です。

R の名前が JavaScript の予約語である場合や、一般的すぎてそのまま公開できない場合は、関数が計算する内容を名前にしています。

| rStats.js | R |
| --- | --- |
| `variance` | `var` |
| `cronbachAlpha` | psych の `alpha` |
| `modes` | DescTools の `Mode` |
| `geometricMean` | DescTools の `Gmean` |
| `cv` | DescTools の `CoefVar` |
| `pbvnorm` | mvtnorm の `pmvnorm` (2 次元) |
| `glhtDunnett` | multcomp の `glht` (Dunnett の対比) |
| `blandAltman` | BlandAltmanLeh の `bland.altman.stats` |
| `diagnosticTests` | epiR の `epi.tests` |

`lm` 以外のモデルのメソッド (R で当てはめに対して使う `summary`、`predict`、`anova` など) は、名前の前にモデルの名前が付きます: `glmSummary`、`glmPredict`、`lmerSummary`、`lmerAnova`、`glmerSummary`、`glmerPredict`、`coxZph`、`survregPredict`、`survregResiduals`、`confintRma`、`predictRma`、`confintLmer`、`confintGlmer`、`simulateLmer`、`simulateGlmer`。例外は `predictCrr` (R の `predict.crr`) です。モデルの名前が付かないメソッド (`predict`、`confint`、`anova`) は `lm` のものです。`rma` のメソッドは `confintRma` と `predictRma` です。

### 引数

- 必須の引数は、位置で渡します。
- 省略できる引数は、1 つのオプションのオブジェクトにまとめて渡します。キーは R の名前を camelCase にしたものです: `pt(q, df, lower.tail = FALSE)` → `pt(q, df, { lowerTail: false })`。
- R の usage で位置によって渡す省略可能な引数は、位置でもオプションでも渡せます。対象は、`glmResiduals` の type、`cohenES` の size、`outer` の fun、`tabulate` の nbins、`propTrendTest` の score、`splinefun` と `splinefunH` が返す関数の deriv です。`glmResiduals(fit, "pearson")` と `glmResiduals(fit, { type: "pearson" })` は同じです。同じ引数を両方の方法で渡すと RangeError になります。
- 例外は `optimHess(par, fn, gr, control)` で、R と同じく `gr` と `control` は位置でしか渡せません。`control` 自体が素のオブジェクトなので、`gr` の後に置いたオプションのオブジェクトと区別できないためです。
- 関数が知らないキーは RangeError になります。キーが決まっている入れ子のオブジェクト (`optim` の `control`、オブジェクトで渡した `glm` の `family`) でも同じです。たとえば `pnorm(1, { lowertail: false })` は、綴りを誤ったキーを無視せず、"unknown option 'lowertail' for pnorm (known: mean, sd, lowerTail, logP)" という例外を投げます。キーがデータそのものであるオブジェクト (データフレーム、`contrasts`、`levels`) は検査しません。

### 結果

- 結果は素のオブジェクトです。
- 検定は、R の `htest` のフィールドを camelCase で返します (`statistic`、`parameter`、`pValue`、`confInt`、`estimate`、`method` など)。R で値に付く名前は、別のフィールド (`statisticName` など) に入ります。
- `lmer` や `glmer` の当てはめを受け取る関数 (`lmerSummary`、`lmerAnova`、`lmerContest`、`glmerSummary`、`glmerPredict` など) には、`lmer` や `glmer` が返したオブジェクトそのものを渡してください。コピー (`structuredClone`、`{ ...fit }`、JSON、`postMessage` によるもの) では内部の値が失われるため、渡すと TypeError になります。

### データ

- 標本は、数値の配列 (または `Float64Array`) です。
- 行列は、行の配列です。
- データフレームは、同じ長さの列からなるオブジェクトです。
- 欠測値は、数値の配列では `NaN`、データフレームの列では `null` です。
- 式は文字列です: `lm("y ~ x + g", data)`、`tTest("score ~ arm", data)`。
- 関数が返す添字は 0 始まりです。

### エラー

| エラー | 起きるとき |
| --- | --- |
| `TypeError` | 引数の型や形が誤っている (関数に合わない形の式も含む) |
| `RangeError` | 値が範囲外 (存在しない列、空の選択、知らない選択肢) |
| `Error` | 数値計算の失敗、または結果が定義されない入力 (観測数が足りないなど) |
| `SyntaxError` | 式を解析できない |

- 結果が定義されない入力は、R が NaN を返す場合でも例外を投げます。ただし分布関数 (d/p/q/r) は、R と同じく、無効なパラメータに対して NaN を返します。
- 1 つの配列に 2^24 個を超える値を割り当てる計算や、約 10 秒を超えて実行される計算は、始める前に RangeError を投げます ([上限](https://numero-uno-jpn.github.io/rStats.js/docs/ja/performance.html#上限))。

### 警告

- すべての検定、モデル、当てはめは、R の警告を結果の `warnings` に入れて返します。文言は R のもので、同じ警告は R と同じ順序で 1 回だけ入ります。警告がなければ `[]` です。R の分布関数が自分の精度について出す警告と、R の引数の型についての警告は含みません。
- 既定では何も表示しません。`setWarningHandler(handler)` で関数を設定すると、その関数は、呼び出しの警告を 1 つずつ、呼び出した関数の名前とともに、結果を計算した後に受け取ります。
  - `(message, source) => console.warn(source + ": " + message)` とすると、R と同じように表示します。
  - 例外を投げるハンドラーにすると、R の `options(warn = 2)` と同じ働きになります。
- 別の関数を呼ぶ関数は、警告を自分の名前で 1 回だけ渡します。当てはめの警告は当てはめたときに渡し、`anova(fit)` や `glmSummary(fit)` では再び渡しません。

### 乱数

`setSeed(42)` の後では、`rnorm`、`runif`、`sample` などは、R で `set.seed(42)` とした後と同じ数値を返します。


## 多変量解析

この分野は独立した `/multivariate` から import します。パッケージのルートには含まれません。

```ts
import { dist, asDist, hclust, cutree, kmeans, cmdscale, manova, manovaSummary, lda, ldaPredict, cancor, ca, caSummary, caCoord, mjca, sammon, isoMDS } from "@numero-uno-jpn/rstats/multivariate";

const distances = dist([[0, 0], [1, 0], [0, 2], [4, 3]], { method: "euclidean" });
const tree = hclust(distances, { method: "average" });
cutree(tree, { k: [2, 3] });
kmeans([[1, 1], [1.2, 0.8], [5, 5], [5.2, 4.8]], [[1, 1], [5, 5]]);
const dissimilarities = asDist([[0, 1, 1, Math.SQRT2], [1, 0, Math.SQRT2, 1], [1, Math.SQRT2, 0, 1], [Math.SQRT2, 1, 1, 0]]);
cmdscale(dissimilarities, { k: 2 });

const d = {
  group: ["A", "A", "A", "B", "B", "B", "C", "C", "C"],
  y1: [2.1, 2.4, 1.8, 4.2, 4.5, 3.9, 6.1, 6.4, 5.8],
  y2: [1.2, 1.5, 1.0, 2.8, 2.5, 3.0, 3.9, 4.2, 3.7],
};
const fit = manova("cbind(y1, y2) ~ group", d);
manovaSummary(fit); // Pillai、Wilks、Hotelling-Lawley、Roy、SSP、固有値、係数

const discriminant = lda([[1, 2], [1.2, 1.8], [4, 3], [4.2, 2.8]], ["A", "A", "B", "B"]);
ldaPredict(discriminant, { newdata: [[2, 2], [4, 3]] }); // クラス、事後確率、判別得点

cancor([[1, 2], [2, 1], [3, 4], [4, 3]], [[2, 1], [1, 3], [4, 2], [3, 5]]);
```

`manova` は逐次 (Type I) の項を当てはめます。`lda` は moment 法と leave-one-out 交差検証に対応し、`ldaPredict` は plug-in 法で予測します。`cancor` は非ゼロの正準相関と使用した中心を返します。`ca` は対応分析、`caSummary` は固有値と寄与の表、`caCoord` は布置図の座標を返します。`mjca` はカテゴリ列の多重対応分析を行います。`sammon` と `isoMDS` は非計量多次元尺度法です。

## 時系列

自己相関の関数は、独立した `/timeseries` から import します。

```ts
import { acf, pacf, ccf } from "@numero-uno-jpn/rstats/timeseries";

const x = [4, 5, 7, 6, 9, 8, 11, 10, 12, 13];
const y = [3, 4, 5, 7, 6, 8, 9, 8, 10, 11];
acf(x, { lagMax: 5 });
pacf(x, { lagMax: 5 });
ccf(x, y, { lagMax: 3 });
```

`acf` は既定で自己相関を返します。`type: "covariance"` で自己共分散を返し、`pacf` は偏自己相関を返します。`ccf` は `-lagMax` から `lagMax` までの交差相関 (または交差共分散) を返します。ラグは整数の観測単位で、暦時間の単位や R の `frequency` メタデータは扱いません。欠測値は既定でエラーになり、`naAction: "pass"` では欠測を含む組を除きます。
