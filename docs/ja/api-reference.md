# rStats.js API リファレンス

rStats.js は、R の数値計算の中心を JavaScript に提供します。確率分布、R の `set.seed()` と一致する乱数、記述統計、仮説検定、線形モデル、一般化線形モデル、(一般化) 線形混合モデル、生存時間解析、線形代数、数値計算です。関数の名前と結果は R に従い、関数は R と比べてテストしています (相対誤差で、分布は 1e-14、検定とモデルは 1e-12 まで。[精度](https://numero-uno-jpn.github.io/rStats.js/docs/ja/accuracy.html) を参照)。R と比べる代わりに、R 自身が不正確な場合や R にその関数がない場合は、高精度の参照値と比べています。

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
```

バンドラーを使わないときは、`https://cdn.jsdelivr.net/npm/@numero-uno-jpn/rstats@1.2.0/dist/rstats.js` が、混合モデル以外のすべての関数を含む 1 つの ES モジュールです。混合モデルは `dist/mixed.js` にあります。URL にはバージョンを含めてください (正確なバージョン、または 1.0.0 以降の `@1` のようなメジャーバージョン)。バージョンのない URL は、破壊的変更を含むすべての新しいリリースに追従してしまいます。1 つのページでは、`dist/rstats.js` か分野ごとのバンドル (`dist/tests.js`、`dist/mixed.js` など) のどちらか一方だけを使ってください。両方を混ぜると、共通のコードが 2 度読み込まれ、乱数の状態も 2 つになります。

## 規約

- **名前**は R のものです。ドット (.) は camelCase になります: `t.test` → `tTest`、`p.adjust` → `pAdjust`。他のパッケージの関数は、名前をそのまま保ちます (`car::Anova` → `Anova`、`tidyr::pivot_longer` → `pivotLonger`)。R の名前が JavaScript の予約語であるか、一般的すぎてそのまま公開できない場合は、名前がその関数の計算内容を表します: `variance` (`var`)、`cronbachAlpha` (psych の `alpha`)、`modes` (DescTools の `Mode`)、`geometricMean` (DescTools の `Gmean`)、`cv` (DescTools の `CoefVar`)、`pbvnorm` (mvtnorm の二次元の `pmvnorm`)、`glhtDunnett` (multcomp の `glht` で Dunnett の対比を使うもの)。`lm` 以外のモデルのメソッド (R の、当てはめに対する `summary`、`predict`、`anova` などのメソッド) には、モデルの名前が前に付きます: `glmSummary`、`glmPredict`、`lmerSummary`、`lmerAnova`、`glmerSummary`、`glmerPredict`。モデルの名前が付かないメソッド (`predict`、`confint`、`anova`) は `lm` のものです。
- **引数:** 必須の引数は位置で渡します。省略できる引数は、R の名前を camelCase にしたキーを持つ 1 つのオプションのオブジェクトに入れます: `pt(q, df, lower.tail = FALSE)` は `pt(q, df, { lowerTail: false })` です。R の呼び出しで位置によって渡される省略可能な引数は、どちらの方法でも渡せます。対象は、`glmResiduals` の type、`cohenES` の size、`outer` の fun、`tabulate` の nbins、`propTrendTest` の score、そして `splinefun` と `splinefunH` が返す関数の deriv です (`glmResiduals(fit, "pearson")` も `glmResiduals(fit, { type: "pearson" })` も使えます。1 つの引数を位置とオプションの両方で渡すと RangeError になります)。例外は `optimHess(par, fn, gr, control)` です。R と同じく、`gr` と `control` は位置でしか渡せません。`control` 自体が素のオブジェクトなので、`gr` の後のオプションのオブジェクトとは区別できないためです。関数が知らないキーは RangeError になります。固定のキーを持つ入れ子のオブジェクト (`optim` の `control`、オブジェクトで渡された `glm` の `family`) でも同様です。たとえば `pnorm(1, { lowertail: false })` は、誤って綴ったキーを無視するのではなく、"unknown option 'lowertail' for pnorm (known: mean, sd, lowerTail, logP)" という例外を投げます。キーがデータであるオブジェクト (データフレーム、`contrasts`、`levels`) は検査しません。
- **結果**は素のオブジェクトです。`lmer` または `glmer` の当てはめを受け取る関数 (`lmerSummary`、`lmerAnova`、`lmerContest`、`glmerSummary`、`glmerPredict` など) には、`lmer` や `glmer` が返したオブジェクトそのものが必要です。そのコピー (`structuredClone`、`{ ...fit }`、JSON、`postMessage` によるもの) は渡せません。コピーでは内部の値が失われ、コピーを渡すと TypeError になります。検定は、R の `htest` のフィールドを camelCase で返します (`statistic`、`parameter`、`pValue`、`confInt`、`estimate`、`method` など)。R での値の名前は、別のフィールド (`statisticName` など) に入ります。
- **データ:** 標本は、数値の配列 (または `Float64Array`) です。行列は行の配列、データフレームは同じ長さの列からなるオブジェクトです。欠測値は、数値の配列では `NaN`、データフレームの列では `null` です。
- **式**は文字列です: `lm("y ~ x + g", data)`、`tTest("score ~ arm", data)`。
- 関数が返す**添字**は 0 始まりです。
- **エラー:** 引数の型や形が誤っているとき (関数に合わない形の式も含む) は `TypeError`、値が範囲外のとき (存在しない列、空の選択、知らない選択肢) は `RangeError` です。数値計算の失敗と、結果が定義されない入力 (観測数が足りないなど) は `Error` です。式を解析できないときは `SyntaxError` です。結果が定義されない入力は、R が NaN を返す場合でも例外を投げます。分布関数 (d/p/q/r) は、R と同じく、無効なパラメータに対して NaN を返します。1 つの配列に 2^24 個を超える値を割り当てる計算、または約 10 秒を超えて実行される計算は、開始する前に RangeError を投げます ([上限](https://numero-uno-jpn.github.io/rStats.js/docs/ja/performance.html#上限))。
- **警告:** すべての検定、モデル、当てはめは、R の警告を結果の `warnings` に入れて返します (R の文言で、同じ警告は R と同じ順序で 1 回だけ。警告がないときは `[]` です。R の分布関数が自身の精度について出す警告や、R の引数の型についての警告は含みません)。既定では何も表示しません。`setWarningHandler(handler)` は、関数を設定します。その関数は、呼び出しの警告を 1 つずつ、呼び出された関数の名前とともに、結果を計算した後に受け取ります (`(message, source) => console.warn(source + ": " + message)` とすると、R と同じように表示されます。例外を投げるハンドラーは、R の `options(warn = 2)` の役割を果たします)。別の関数を呼ぶ関数は、警告を自分の名前で 1 回だけ渡します。また、当てはめの警告は、当てはめたときに渡され、`anova(fit)` や `glmSummary(fit)` では再び渡されません。
- **乱数:** `setSeed(42)` の後では、`rnorm`、`runif`、`sample` などは、R の `set.seed(42)` の後と同じ数値を返します。
