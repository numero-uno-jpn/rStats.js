# rStats.js API リファレンス

rStats.js は、R の数値計算の中心を JavaScript に提供します。確率分布、R の `set.seed()` と一致する乱数、記述統計、仮説検定、線形モデル、一般化線形モデル、順序・多項・ロバスト・非線形回帰、(一般化) 線形混合モデルと頑健な共分散、生存時間解析、試験デザインの標本サイズと検出力、メタアナリシスとメタ回帰、診断の精度と測定法の比較、線形代数、数値計算です。関数の名前と結果は R に従い、関数は R と比べてテストしています (相対誤差で、分布は 1e-14、検定とモデルは 1e-12 まで。[精度](https://numero-uno-jpn.github.io/rStats.js/docs/ja/accuracy.html) を参照)。R と比べる代わりに、R 自身が不正確な場合や R にその関数がない場合は、高精度の参照値と比べています。

このリファレンスでは、すべての関数について、そのオプション、結果、使用例を載せています (使用例はテストで実行しています)。関数は、メニューで分野ごとにまとめてあります。

## はじめに

- [R の関数と rStats.js の関数](https://numero-uno-jpn.github.io/rStats.js/docs/ja/r-functions.html): R の関数に対応する rStats.js の関数を探せます (`t.test` → `tTest`)。各関数に 1 行の説明があります。
- [JavaScript の開発者のための rStats.js](https://numero-uno-jpn.github.io/rStats.js/docs/ja/guide-for-js-developers.html): データフレーム、欠測値、因子、式と、分析の一通りの例を扱います。R で分析を書く方法に慣れていない読者向けです。
- [結果の描画](https://numero-uno-jpn.github.io/rStats.js/docs/ja/plotting.html): `/plot` の描画用データ (生存曲線、forest plot、Q-Q プロット、モデル診断など) と Observable Plot・Plotly.js での描画方法を説明します。
- [ブラウザで試す](https://numero-uno-jpn.github.io/rStats.js/demo/): ブラウザで、すべての関数を R の値と並べて試せます。
- [R との違い](https://numero-uno-jpn.github.io/rStats.js/docs/ja/differences-from-r.html) と [精度](https://numero-uno-jpn.github.io/rStats.js/docs/ja/accuracy.html)。

## 使い方

```sh
npm install @numero-uno-jpn/rstats
```

```ts
import { pnorm, tTest, lm } from "@numero-uno-jpn/rstats";        // メインの入口 (バンドラーが使わない部分を除きます)
import { qbeta } from "@numero-uno-jpn/rstats/distributions";       // またはその 1 つの分野: distributions、tests、
                                                                     // descriptive、linalg、numerics、special
import { lmer, glmer } from "@numero-uno-jpn/rstats/mixed";        // 混合モデル: この分野からだけ
import { polr, rlm, nls } from "@numero-uno-jpn/rstats/regression"; // 回帰: この分野からだけ
import { hclust, manova } from "@numero-uno-jpn/rstats/multivariate"; // 多変量解析: この分野からだけ
import { arima, forecast } from "@numero-uno-jpn/rstats/timeseries"; // 時系列: この分野からだけ
import { match, weightit } from "@numero-uno-jpn/rstats/causal";     // 因果推論: この分野からだけ
import { survPlotData } from "@numero-uno-jpn/rstats/plot";         // 描画用のデータ: この分野からだけ
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

バンドラーを使わないときは、`https://cdn.jsdelivr.net/npm/@numero-uno-jpn/rstats@1.21.0/dist/rstats.js` が、混合モデル・回帰・多変量解析・時系列・因果推論・描画用データ以外のすべての関数を含む 1 つの ES モジュールです。混合モデルは `dist/mixed.js`、回帰は `dist/regression.js`、多変量解析は `dist/multivariate.js`、時系列は `dist/timeseries.js`、因果推論は `dist/causal.js`、描画用データは `dist/plot.js` にあります。URL にはバージョンを含めてください (正確なバージョン、または 1.0.0 以降の `@1` のようなメジャーバージョン)。バージョンのない URL は、破壊的変更を含むすべての新しいリリースに追従してしまいます。1 つのページでは、`dist/rstats.js` か分野ごとのバンドル (`dist/tests.js`、`dist/mixed.js`、`dist/regression.js`、`dist/multivariate.js` など) のどちらか一方だけを使ってください。両方を混ぜると、共通のコードが 2 度読み込まれ、乱数の状態も 2 つになります。

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


## 変数選択 (段階的なモデル選択)

`step`・`stepAIC`・`drop1`・`add1`・`extractAIC` は、式で当てはめた `lm` か `glm` (1.15.0 から式で当てはめられる) と、
当てはめに使ったデータフレームを受け取ります。

```ts
import { lm, glm, step, stepAIC, drop1, add1, extractAIC } from "@numero-uno-jpn/rstats";

const full = lm("y ~ x1 + x2 + x3 + f", data);
const s = step(lm("y ~ 1", data), data, { scope: { lower: "~ 1", upper: "~ x1 + x2 + x3 + f" } }); // "both"
s.fit;      // 選ばれた lm の当てはめ
s.anova;    // 経路 (R の $anova): step, df, deviance, residDf, residDeviance, aic
s.visits;   // たどった各モデルと、そこで調べた表 (R の trace)
step(full, data, { direction: "backward", k: Math.log(full.nObs) }); // BIC
step(glm("y01 ~ x1 + x2 + f", data, { family: "binomial" }), data); // glm
drop1(full, data, { test: "F" }); // add1(fit, data, { scope, test }) も
extractAIC(full); // [edf, AIC]
```

探索は R と同じです。項は周辺性を保って丸ごと出し入れし、規準が厳密に小さくなるときだけ動き、別名の項は最初に外します。
R と同じく、使う行が変わる動き (欠損値) はエラーで止まります。`stepAIC` は同じ探索で、経路の `df` だけが違います (正の値)。
glm の表の AIC は R の値です (Gamma と inverse.gaussian では分散を通した近似で、探索もそれに従います)。

## Tobit 回帰・ベータ回帰・対数線形モデル

`tobit`・`betareg`・`loglin`・`loglm` は `/regression` にあります:

```ts
import { tobit, tobitSummary, betareg, betaregSummary, betaregConfint, betaregPredict, betaregResiduals, loglin, loglm, loglmAnova } from "@numero-uno-jpn/rstats/regression";

const t = tobit("hours ~ age + kids", data, { left: 0 }); // AER::tobit: [left, right] に切り詰めた応答の survreg
tobitSummary(t); // Wald の表・尺度・Wald 検定。t.loglik は null モデルとこのモデルの対数尤度
const b = betareg("rate ~ x1 + x2 | z", data, { link: "logit", type: "BR" }); // 精度を z で回帰
betaregSummary(b); betaregConfint(b, { level: 0.95 });
betaregPredict(b, { newdata, type: "quantile", at: [0.1, 0.9] });
betaregResiduals(b, { type: "sweighted2" });
const table = { counts, dim: [4, 4, 2], names: ["Hair", "Eye", "Sex"] }; // counts は R の順 (第 1 添字が最も速く動く)
loglin(table, [["Hair", "Eye"], ["Hair", "Sex"], ["Eye", "Sex"]]);
loglmAnova(loglm("~ Hair + Eye + Sex", table), loglm("~ (Hair + Eye + Sex)^2", table));
```

`tobit` は `AER::tobit(formula, left, right, dist)` に合わせています: `left` 以下の応答はそこで左打ち切り、`right` 以上は
そこで右打ち切りとし、モデルは `survreg` のもの (どの分布でも) です。`betareg` は `betareg::betareg` に合わせています: 平均の
リンクは logit・probit・cloglog・cauchit・log・loglog、精度のリンクは identity・log・sqrt、推定は最尤と Kosmidis と Firth
(2010) のバイアス補正・バイアス減少 (`type: "BC"`・`"BR"`) です。尤度は収束するまで最大化するので、推定値は R と 1e-7 程度で
一致します。0 や 1 の応答はエラーです (R は台を拡張した分布に切り替えます)。`loglin` は R の反復比例当てはめ (R の緩い既定値
`eps = 0.1` も) をそのまま繰り返します。`loglm` は表か、式の左辺に度数を置いたデータフレームを受けます。ガンマ回帰は Gamma 族の
`glm` です。

## 多項ロジスティック回帰

`multinom` とその関数は `/regression` にあり、`polr` と同じく式とデータフレームで与えます。

```ts
import { multinom, multinomSummary, multinomConfint, multinomPredict, multinomAnova } from "@numero-uno-jpn/rstats/regression";

const fit = multinom("smoke ~ sex + age + exercise", data, { levels: { smoke: ["Never", "Occas", "Regul", "Heavy"] } });
const s = multinomSummary(fit); // 係数・標準誤差・Wald の z と p・オッズ比・擬似 R²
multinomConfint(fit, { level: 0.95 }); // Wald 信頼区間
multinomPredict(fit, { type: "class" }); // 同点は R の max.col と同じ (setSeed で R と同じクラス)
multinomAnova(multinom("smoke ~ sex", data), fit); // 尤度比検定
```

`multinom` は `nnet::multinom(y ~ ..., data, weights, decay, Hess = TRUE)` に従います。応答の最初の水準を基準カテゴリとする基準カテゴリロジットです。係数は厳密な最尤推定値です (Newton 法)。R の BFGS は既定ではそこから 1e-5 程度手前で止まります。標準誤差は −log L の Hessian から求めます。`weights` はケース重みで、`decay` は全係数の 2 乗和の decay 倍を加えます (nnet と同じく、逸脱度と AIC には含み、標準誤差には含みません)。擬似 R² (McFadden・Cox-Snell・Nagelkerke) には、同じ行での切片だけのモデルを使います。

## 管理図

qcc パッケージの管理図は `/descriptive` にあります (値だけで、図は描きません):

```ts
import { qcc, cusum, ewma, ocCurves, processCapability, mqcc, qccGroups, medianChart } from "@numero-uno-jpn/rstats/descriptive";

const g = qccGroups(diameter, sample).groups;           // 群ごとに 1 行、足りない所は NaN
const xbar = qcc(g, { type: "xbar" });                   // 中心線・stdDev (UWAVE-R)・管理限界・管理外れ
qcc(g, { type: "R" });                                   // "S" も。stdDev: "UWAVE-SD"・"MVLUE-R"・"MVLUE-SD"・"RMSDF"
qcc(g.slice(0, 25), { type: "xbar", newdata: g.slice(25), nsigmas: 2 });
qcc(defects, { type: "p", sizes, confidenceLevel: 0.99 }); // 確率限界
qcc(x, { type: "xbar.one" });                            // 個別値、σ は移動範囲から
cusum(g, { decisionInterval: 4, seShift: 1 }); ewma(x, { lambda: 0.2 });
ocCurves(xbar);                                          // ずれ c と群の大きさ n ごとの β
processCapability(xbar, [73.95, 74.05], { target: 74 }); // Cp・Cp_l・Cp_u・Cp_k・Cpm と信頼区間
mqcc([X1, X2], { type: "T2", predLimits: true });        // 群平均の Hotelling の T2
medianChart(values, groups);                             // Me-R 管理図、JIS の係数、群の大きさ 2〜10
```

`qcc` は `qcc::qcc` に合わせています。中心線は群の大きさで重みづけ、R 管理図の限界は `center +- k d3(n) sigma`、S 管理図は
`center +- k sigma sqrt(1 - c4(n)^2)`、確率限界は範囲の分布・カイ二乗・二項・ポアソン・幾何の各モデルから求めます。
`violations` は管理限界の外の点 (上側、次に下側) と、中心線の片側に 7 点 (`runLength`) 続く連の点です。qcc と同じく、群の
大きさが 25 を超えると xbar の既定は RMSDF になります。NA の統計量は管理外れの一覧に入れません。

## 一対比較

Bradley-Terry モデルと準分散は `/regression` にあります:

```ts
import { btm, btAbilities, countsToBinomial, qvcalc, worstErrors } from "@numero-uno-jpn/rstats/regression";

const f = btm(contests, { outcome: ["win1", "win2"], player1: "player1", player2: "player2", refcat: "A" });
btAbilities(f);                       // 対象ごとの能力と標準誤差 (基準は 0)
qvcalc(btAbilities(f));               // 基準に依らない準標準誤差
btm(contests, { outcome: ["win1", "win2"], player1: "home", player2: "away", formula: "~ .. + at.home",
  contestCovariates: { "at.home": ["home1", "home2"] } });
btm(contests, { outcome: "won", player1: "p1", player2: "p2", formula: "~ x[..] + (1 | ..)", predictors });
```

`btm` は `BradleyTerry2::BTm` に合わせています。対象の共変量がなければ、2 つの対象の +1 / -1 の計画行列への二項 glm です。
対象の共変量と `(1 | ..)` があれば、能力は `x_j' beta + e_j` (対象の変量効果つき) で、作業用モデルの REML 尤度を σ が最大に
する固定点まで PQL で当てはめます (BTm は許容誤差で止まり、そこから 1e-7 ほど手前です)。`countsToBinomial` は勝敗の表
(行が勝者) を対象の組に直します。

## 時間依存 ROC

打ち切りのある事象時間の時間依存 ROC 曲線は `/tests` にあります (timeROC と survivalROC のパッケージに合わせています):

```ts
import { timeROC, timeROCConfint, timeROCCompare, seSpPPVNPV, survivalROC } from "@numero-uno-jpn/rstats/tests";
import { setSeed } from "@numero-uno-jpn/rstats/distributions";

const f = timeROC(time, status, marker, { times: [365, 730, 1095], iid: true }); // AUC・TP・FP と標準誤差
f.competingRisks ? f.auc1 : f.auc;              // status に他の事象があれば定義 (i) と (ii)
setSeed(1); timeROCConfint(f);                  // 点ごとの信頼区間と同時信頼帯 (パーセント)
timeROCCompare(f, timeROC(time, status, marker2, { times: [365, 730, 1095], iid: true }), { adjusted: true });
timeROC(time, status, marker, { times: [365], weighting: "cox", otherMarkers: covariates }); // または "aalen"
seSpPPVNPV(2.5, time, status, marker, { times: [365], iid: true }); // marker > 2.5 の感度・特異度・的中率
survivalROC(time, status, marker, { predictTime: 365 });              // Heagerty らの Kaplan-Meier 推定量
```

`timeROC` は `timeROC::timeROC` に合わせています。事例は原因の事象が T < t の人、対照は T > t の人 (競合リスクの定義 (ii)
では t より前に他の事象があった人も) です。重みは打ち切りの Kaplan-Meier (または打ち切りの Cox・Aalen モデル) による
打ち切りの逆確率で、マーカーの同点は 1/2 に数えます。iid 表現から標準誤差、`confint` の同時信頼帯 (乗数ブートストラップ。
同じ種なら R と同じ乱数)、`compare` の検定を求めます。時刻に同点があるときの iid は同点を正しく扱う形で、R とは少し
違います (R との違いを参照)。

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

模型と予測は stats・forecast・tseries に従います (1.20.0)。系列はただの配列で、季節の周期は `frequency`
オプションで渡します (R の `ts` の属性にあたります)。

```ts
import { arima, predictArima, forecastArima, forecastFromArima, autoArima, ets, forecastEts, stl, mstl, holtWinters,
  ses, hw, thetaf, ndiffs, nsdiffs, boxTest, accuracy, adfTest, kpssTest, forecast } from "@numero-uno-jpn/rstats/timeseries";

const fit = arima(y, { order: [0, 1, 1], seasonal: { order: [0, 1, 1], period: 12 }, frequency: 12 });
predictArima(fit, 12);                                   // stats::predict: pred と se
const a = autoArima(y, { frequency: 12 });               // forecast::auto.arima
forecastFromArima(a, { h: 24 });                         // mean、lower、upper (80% と 95%)
forecastArima(y, { order: [1, 1, 0], includeDrift: true, lambda: "auto" }); // forecast::Arima
forecastEts(ets(y, { frequency: 12 }), { h: 24 });       // ETS の族から AICc で選んだ模型
forecast(y, { frequency: 12, h: 24 });                   // 系列や任意の当てはめに対する forecast::forecast
stl(y, { frequency: 12, sWindow: "periodic" }); mstl(y, { frequency: 12 });
ndiffs(y); nsdiffs(y, { frequency: 12 }); boxTest(fit.residuals, { lag: 24, type: "Ljung-Box", fitdf: 2 });
adfTest(y); kpssTest(y);                                 // tseries の単位根検定と定常性検定
```

当てはめは系列を 1e-300 倍から 2^1000 倍しても正確です (予測は同変、統計量は不変)。欠損値 (NaN) は R が受け付ける
ところで受け付け (`arima`、`ets`、`naive`、`mstl`、`kpssTest` など)、無限大の値はエラーです。短い系列は R の規則に
従います (`ets` は系列が 1 周期以下なら季節を落とし、値が少ないときは小さな模型を尤度を使わずに当てはめます。
`autoArima` は次数を制限します)。R が最適化を早く止めるところでは rStats.js はさらに最適化するので、`ets` と `hw` は
R より高い尤度に着くことがあります (R との違いを参照)。

## メタ分析 (meta と netmeta)

meta パッケージの関数とネットワークメタ分析は、metafor の `rma`・`escalc` と同じ `/tests` にあります。

```ts
import { metagen, metabin, metacont, metaprop, metabias, trimfill, metareg, netmeta, netrank, netsplit, netleague }
  from "@numero-uno-jpn/rstats/tests";

const m = metagen(TE, seTE);                             // 共通効果と変量効果 (REML)、tau2 とその区間
metabin(e1, n1, e2, n2, { sm: "OR", method: "MH" });     // metacont、metainc、metacor、metamean、metarate、metaprop も
metabias(m); trimfill(m); metareg(m, latitude.map((v) => [v]));
const n = netmeta(TE, seTE, treat1, treat2, studlab, { referenceGroup: "placebo" });
netrank(n);                                              // P スコア
netsplit(n); netleague(n, { digits: 2 });                // 直接と間接のエビデンス、リーグ表
```

`metagen` とその仲間は meta の既定に従います (REML、tau2 の Q-profile 区間、Higgins と Thompson の区間付きの H と
I2)。推定値は TE と seTE の尺度によらず正確です。`netmeta` は多群の研究を含む Rücker (2012) の頻度論のグラフ理論の
模型です。連結でない網は受け付けません (`netconnection` を参照)。

## 描画用のデータ

R のプロットが描画する値は、どの描画ライブラリでも使える行配列として、別の入口 `/plot` から取得できます。その基礎となる統計量 (`density`、`qqnorm`、`boxplotStats`、`lowess`、`lmHatvalues` など) は、他の関数と同じ入口にあります。

```ts
import { survfit, metagen, lm } from "@numero-uno-jpn/rstats";
import { survPlotData, forestPlotData, lmDiagnosticsData } from "@numero-uno-jpn/rstats/plot";

survPlotData(survfit(time, status, { group })).layers.steps; // [{ x, y, ymin, ymax, group }, ...] from (0, 1)
forestPlotData(metagen(TE, seTE), { labels });               // studies, pooled estimates, diamonds
lmDiagnosticsData(lm(x, y));                                 // plot.lm's four panels with their smooths
```

各関数は `{ layers, meta }` を返します。`fromRows` で層を列形式に変換すると Plotly で使えます。[結果の描画](https://numero-uno-jpn.github.io/rStats.js/docs/ja/plotting.html) を参照してください。

## 因果推論

傾向スコアのマッチングとバランスは、別の入口 `/causal` から読み込みます。`clogit` (マッチした組の条件付きロジスティック回帰) は `coxph` と同じく主な入口にあります。

```ts
import { clogit, setSeed } from "@numero-uno-jpn/rstats";
import { match, balTab, tableOneSmd } from "@numero-uno-jpn/rstats/causal";

// x はロジスティックモデルの logit(PS)。R では ps <- fitted(glm(tr ~ age + male, family = binomial()))
setSeed(1234);
const m = match(tr, logitPs, { estimand: "ATT", M: 1, caliper: 0.2 });
balTab(tr, { age, male }, { match: m, binary: "std" }); // マッチング前後の SMD と分散比
tableOneSmd(age, tr); // tableone の SMD
```

`match` は `Matching::Match(Tr, X, estimand, M, caliper, ties = FALSE, replace = FALSE)` に従います。同点が無ければ組は R と同じです。3 つ以上の候補の同点は、文書化した独自の規則で選びます (`tieSizes` に出ます)。キャリパーは `x` の標準偏差 (n で割る) を単位とします。`balTab` はマッチングの重み (`matchWeights`) を使い、分母にはマッチング前の標本の SD を使います (ATT では処置群、ATC では対照群、ATE では両群をまとめたもの)。マッチした組は、`clogit` (正確な尤度または近似)、組を `strata` にして `ties: "breslow"` とした `coxph`、組を層にした `mantelhaenTest` で解析します。

逆確率重み付けも `/causal` にあります。重み付きの解析 (`svyglm`、`survfitCoxph`、`weights` を与えた `lm`・`coxph`・`survfit`) は主な入口にあります。

```ts
import { svyglm, coxph, survfit, survfitCoxph } from "@numero-uno-jpn/rstats";
import { weightit, trimWeights, weightSummary, balTab } from "@numero-uno-jpn/rstats/causal";

const cov = { age, smoker }; // 文字列の列は因子
const w = weightit(tr, cov, { method: "glm", link: "logit", estimand: "ATE" });
const t = trimWeights(w, { at: 0.99, lower: true }); // 上下 1% を抑える
weightSummary(t); // 群ごとの範囲・変動係数・有効サンプルサイズ
balTab(tr, cov, { weightit: t, binary: "std" }); // 重み付けの前後の SMD と分散比
svyglm(tr.map((v) => [v]), y, { weights: t.weights, family: "quasibinomial" }); // デザインに基づく標準誤差
survfit(time, status, { group: tr, weights: t.weights }); // 重み付きの Kaplan-Meier (既定は頑健な分散)
survfitCoxph(time, status, tr.map((v, i) => [v, age[i]]), { weights: t.weights, robust: true, newdata: [[0, 50], [1, 50]] });
```

`weightit` は `WeightIt::weightit(tr ~ ..., method, link, estimand, stabilize)` に従います。手法は `glm` (`ps`。logit・probit・cauchit・cloglog)、`cbps` (logit・probit)、`ipt`、`ebal`、推定対象は ATE・ATT・ATC・ATO (重複重み。ipt と ebal にはありません) です。`stabilize` は glm の ATE の重みに群の割合を掛けます。cbps・ipt・ebal は釣り合いの条件を厳密に解くので、重みは R と 1e-8 程度で一致します (R は最適化を早めに止めます)。`trimWeights` は、推定対象が固定しない重みの R の type 3 の分位点で抑えます。`weightit` を与えた `balTab` は `prop.score` の行を足し、文字列の共変量を水準に分けます。ATO の分母は重複重みで重み付けた標本の SD です。`svyglm` は `svydesign(ids = ~1, weights)` に対する `survey::svyglm` です: 重み付きの glm に、サンドイッチ分散に n/(n − 1) を掛けた分散と、自由度 n − p の t 検定を組み合わせます。

媒介分析・調整分析・調整媒介分析も `/causal` にあります。`mvrnorm` は乱数と一緒です:

```ts
import { lm, glm, setSeed } from "@numero-uno-jpn/rstats";
import { mediate, simSlopes, sobelTest, mediationMonteCarlo, moderatedMediation } from "@numero-uno-jpn/rstats/causal";

const m = lm("M ~ X + C", data), y = lm("Y ~ X + M + C", data);
setSeed(1234);
const r = mediate(m, y, data, { treat: "X", mediator: "M", sims: 1000 }); // r.d0, r.z0, r.tau, r.n0 ...
setSeed(1234);
mediate(m, y, data, { treat: "X", mediator: "M", boot: true, bootCiType: "bca" }); // ノンパラメトリック・ブートストラップ
simSlopes(lm("Y ~ X * W + C", data), data, { pred: "X", modx: "W", robust: "HC3" }); // 平均 ± SD での単純傾斜と Johnson-Neyman 区間
sobelTest(m, y, { treat: "X", mediator: "M" });
setSeed(1234);
mediationMonteCarlo(m, y, { treat: "X", mediator: "M" }); // a は rnorm、(b, c') は mvrnorm、20000 回
moderatedMediation(lm("M ~ X * W", data), lm("Y ~ X * W + M * W", data), data, { treat: "X", mediator: "M", moderator: "W" });
```

`mediate` は `lm` と 2 項 (logit・probit) の `glm` の式による当てはめについて `mediation::mediate(model.m, model.y,
treat, mediator, treat.value, control.value, covariates, sims, boot, boot.ci.type, conf.level, robustSE)` に従い、
当てはめに使ったデータを受け取ります。同じ `setSeed` なら、抽出値・推定値・区間・p 値は R と同じです。母数は共分散の
対称な平方根で抽出し、媒介変数はシミュレーションと観測ごとに抽出し、ブートストラップのリサンプルは
`sample(n, n * sims, replace = TRUE)` を 1 回で引きます。`simSlopes` と `johnsonNeyman` は `interactions::sim_slopes` と
`johnson_neyman` に従います (lm は残差自由度の t、glm の傾きは z、Johnson-Neyman の境界はどちらも t。interactions と同じ)。
`sobelTest`・`mediationMonteCarlo`・`moderatedMediation` は、これらを使う ReactiveStat の手順です。`mvrnorm` は
`MASS::mvrnorm` で、1 次元と 2 次元では R と同じ値、3 次元以上では R と同じ分布です (LAPACK の固有ベクトルの符号は
再現しないため)。

npm から使うときは、すべての入口が 1 つの乱数生成器を共有します。CDN から使うときは、`dist/causal.js` は分野ごとの
バンドルと同じ生成器を使うので、`dist/distributions.js` の `setSeed` で種を設定してください (`dist/rstats.js` は別の
生成器を持ちます)。`lm` と `glm` の当てはめは、どのバンドルのものでも受け付けます。
