# 結果の描画

rStats.js は計算を行いますが、描画は行いません。1.21.0 から、エントリ `@numero-uno-jpn/rstats/plot` (CDN では `dist/plot.js`) を使うと、R のプロットが描画する値を、どの JavaScript 描画ライブラリでも利用できる行配列として取り出せます。このページでは、そのデータ形式と、[Observable Plot](https://observablehq.com/plot/) および [Plotly.js](https://plotly.com/javascript/) への渡し方を説明します。Vega-Lite、ECharts、D3 でも同じ行データを使えます。

(例の rStats.js 部分は `test/plotting.test.ts` で実行しています。)

## データ形式

すべての関数は `{ layers, meta }` を返します。各層は 1 種類のマーク (線、点、帯、表など) を表し、短い数値列 (`x`、`y`、`ymin`、`ymax`、`group` など) を持つプレーンオブジェクトの配列です。`meta` には、推奨する軸ラベルと、図に表示する数値 (AUC、I²、帯域幅など) が含まれます。

```js
import { survfit } from "@numero-uno-jpn/rstats";
import { survPlotData } from "@numero-uno-jpn/rstats/plot";

const time = [5, 8, 12, 12, 20, 3, 9, 9, 15, 22, 30, 4];
const status = [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1];
const arm = ["a", "a", "a", "a", "a", "b", "b", "b", "b", "b", "b", "b"];
const km = survPlotData(survfit(time, status, { group: arm }));
km.layers.steps[0];      // { x: 0, y: 1, ymin: 1, ymax: 1, group: "group=a" }
km.layers.censor[0];     // { x: 8, y: 0.8, group: "group=a", n: 1 }
km.layers.riskTable[2];  // { x: 10, group: "group=a", nRisk: 3 }
```

Observable Plot、Vega-Lite、ECharts では行データをそのまま使えます。Plotly は列形式を使います。`fromRows` (メインのエントリにあります) で、層を列オブジェクトに変換できます。

```js
import { fromRows } from "@numero-uno-jpn/rstats";
const cols = fromRows(km.layers.steps); // { x: [...], y: [...], ymin: [...], ymax: [...], group: [...] }
```

## 生存曲線

各行で階段が変化します。各点の後で階段状に描画します (Observable Plot では `curve: "step-after"`、Plotly では `line.shape: "hv"`)。各層は R の `plot.survfit` と同じく (0, 1) から始まります。

```js
// Observable Plot
Plot.plot({
  y: { domain: [0, 1], label: km.meta.yLabel },
  marks: [
    // 層ごとに 1 本の帯
    ...km.meta.groups.map((g) => Plot.areaY(km.layers.steps.filter((r) => r.group === g),
      { x: "x", y1: "ymin", y2: "ymax", fill: () => g, fillOpacity: 0.15, curve: "step-after" })),
    Plot.line(km.layers.steps, { x: "x", y: "y", stroke: "group", curve: "step-after" }),
    Plot.dot(km.layers.censor, { x: "x", y: "y", stroke: "group", symbol: "plus" }),
  ],
});

// Plotly: one trace per stratum
const traces = km.meta.groups.map((g) => {
  const c = fromRows(km.layers.steps.filter((r) => r.group === g));
  return { x: c.x, y: c.y, name: g, mode: "lines", line: { shape: "hv" } };
});
Plotly.newPlot("km", traces, { yaxis: { range: [0, 1] } });
```

`survPlotData(fit, { fun: "event" })` は累積発生率 1 − S(t)、`"cumhaz"` は累積ハザード、`"cloglog"` は log t に対する log(−log S) を返します。`riskTimes` でリスク表の時刻を指定します (既定では、時刻範囲に対する R の `pretty` を使います)。`cumincPlotData` は `cuminc` の競合リスク曲線について同様のデータを返します。

## Forest plot と funnel plot

```js
import { metagen } from "@numero-uno-jpn/rstats";
import { forestPlotData, funnelPlotData } from "@numero-uno-jpn/rstats/plot";

const m = metagen([0.21, 0.52, -0.08, 0.35, 0.11, 0.62], [0.11, 0.21, 0.16, 0.12, 0.09, 0.3]);
const fp = forestPlotData(m, { labels: ["A", "B", "C", "D", "E", "F"], prediction: true });
fp.layers.studies[0];  // { label: "A", y: 6, estimate: 0.21, lower: -0.0056, upper: 0.4256, se: 0.11, weight: 22.11 } (rounded)
fp.layers.pooled;      // the common effect, random effects and prediction rows, below the studies (y < 0)

Plot.plot({
  y: { axis: null },
  marks: [
    Plot.ruleX([0]),
    Plot.link(fp.layers.studies, { x1: "lower", x2: "upper", y1: "y", y2: "y" }),
    Plot.dot(fp.layers.studies, { x: "estimate", y: "y", r: (d) => Math.sqrt(d.weight), fill: "currentColor" }),
    Plot.text(fp.layers.studies, { x: -0.6, y: "y", text: "label", textAnchor: "start" }),
    Plot.line(fp.layers.diamonds, { x: "x", y: "y", z: "group", fill: "currentColor" }),
  ],
});
```

研究ごとの区間は、`level` (既定 0.95) における estimate ∓ z se です。重みはパーセント表示です (変量効果の推定値を表示する場合は変量効果の重みを使い、meta の forest と同じです)。対数尺度の比率指標には `transform: Math.exp` を渡します。`rma` では重みは 1 / (vᵢ + τ²) です。

`funnelPlotData(m)` は研究ごとの (推定値、標準誤差)、共通効果の周囲の擬似 95% 領域、および `contours: [0.9, 0.95, 0.99]` を指定した場合は 0 の周囲の等高線付きファンネルプロットの領域を返します。y 軸は反転してください (`y: { reverse: true }`、または Plotly では `yaxis: { autorange: "reversed" }`)。

`netgraphData(netmeta(...))` は、治療を円周上に配置したデータと、直接比較ごとに研究数を含む辺 (線幅に使用) を返します。

## 分布

```js
import { qqPlotData, densityPlotData, boxplotData, ecdfPlotData, histPlotData } from "@numero-uno-jpn/rstats/plot";

const y = [3.1, 1.2, 5.5, 1.2, 9.0, 4.4, 6.3, 2.8];
const qq = qqPlotData(y);            // points (normal quantile, value) and qqline's line
const dens = densityPlotData(y);     // R's density() curve (512 points) and a rug; meta.bw is the bandwidth
const box = boxplotData({ a: y, b: [2, 3, 3, 5, 12] }); // R's boxplot statistics per group, and the outliers

Plot.plot({ marks: [Plot.dot(qq.layers.points, { x: "x", y: "y" }), Plot.line(qq.layers.line, { x: "x", y: "y" })] });
Plotly.newPlot("dens", [{ ...fromRows(dens.layers.curve), mode: "lines" }]);
```

`boxplotData` の行には `lower`、`q1`、`median`、`q3`、`upper` (R の 1.5 IQR 規則によるひげ) とノッチの限界値が含まれます。Plotly の箱ひげ図トレースでは、それぞれ `lowerfence`、`q1`、`median`、`q3`、`upperfence` として使用します。`ecdfPlotData` は経験分布関数の階段、`histPlotData` は `hist` の棒を返します。

統計量そのものは `/descriptive` にあります。R と一致する関数は `density` (同じビン分割 FFT 近似、7 種類のカーネル、重み)、`bwNrd0`、`bwNrd`、`qqnorm`、`qqline`、`ppoints`、`boxplotStats`、`lowess` です。

## モデル診断と予測

```js
import { lm } from "@numero-uno-jpn/rstats";
import { lmDiagnosticsData, coefPlotData, predictionBandData } from "@numero-uno-jpn/rstats/plot";

const fit = lm([1, 2, 3, 4, 10, 6, 7], [1.1, 1.9, 3.2, 3.9, 7, 5.5, 6.1]);
const diag = lmDiagnosticsData(fit);
// diag.layers: residualsFitted (+ Smooth), qq, scaleLocation (+ Smooth), leverage (+ Smooth), cookContours
Plot.plot({
  marks: [
    Plot.ruleY([0]),
    Plot.dot(diag.layers.residualsFitted, { x: "x", y: "y" }),
    Plot.line(diag.layers.residualsFittedSmooth, { x: "x", y: "y", stroke: "red" }),
    Plot.text(diag.layers.residualsFitted.filter((d) => d.extreme), { x: "x", y: "y", text: "index", dx: 8 }),
  ],
});
```

これらは R の `plot.lm` のパネルです。平滑線は span 2/3 の `lowess` (`panel.smooth` と同じ)、残差は R と同じ重み付けで、`extreme` は R がラベルを付ける 3 点を示し、Cook の距離の等高線は 0.5 と 1 です。影響度の指標は、単独でも `lmHatvalues`、`lmRstandard`、`lmRstudent`、`lmCooksDistance` で利用できます。

`coefPlotData(fit)` は各係数とその信頼区間を返し、`predictionBandData(fit, xs)` は `xs` にわたる当てはめ直線、信頼帯、予測帯を返します。

## ROC 曲線、時系列、クラスター、成分

- `rocPlotData(roc(...))`: (1 − specificity、sensitivity) の曲線を (0, 0) から (1, 1) まで、対角線、Youden 指数が最大となる点とともに返します。`meta.auc` も含みます。
- `acfPlotData(acf(x))`: `plot.acf` の棒と ± qnorm(0.975) / √n の帯を返します。
- `forecastPlotData(x, forecast(fit, { h }), { start, frequency })`: 系列、点予測、水準ごとの予測区間の帯 (幅の広いものから順) を forecast の `plot.forecast` と同様に返します。
- `dendrogramData(hclust(...))`: `plot.hclust` と同様に、クラスタリング順の 1, …, n に葉を配置し、結合する 2 つのクラスターの中央に結合位置を置いた樹形図の線分を返します (`hang` も R と同じです)。
- `biplotData(prcomp(...))`: `biplot.prcomp` の観測値と変数を返します (`scale`、`pcBiplot`)。

## CDN からの読み込み

```html
<script type="module">
  import * as R from "https://cdn.jsdelivr.net/npm/@numero-uno-jpn/rstats@1.21.0/dist/rstats.js";
  import * as P from "https://cdn.jsdelivr.net/npm/@numero-uno-jpn/rstats@1.21.0/dist/plot.js";
  import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.19/+esm";
  const fit = R.survfit([5, 8, 12, 12, 20], [1, 0, 1, 1, 0]);
  const km = P.survPlotData(fit);
  document.body.append(Plot.line(km.layers.steps, { x: "x", y: "y", curve: "step-after" }).plot());
</script>
```
