# Plotting the results

rStats.js computes; it does not draw. From 1.21.0 the entry `@numero-uno-jpn/rstats/plot` (`dist/plot.js` on a CDN)
turns results into the values R's plots draw, as arrays of rows that any JavaScript plotting library takes. This page
shows the shape and how to hand it to [Observable Plot](https://observablehq.com/plot/) and
[Plotly.js](https://plotly.com/javascript/); Vega-Lite, ECharts and D3 take the same rows.

(The rStats.js parts of the examples are run by `test/plotting.test.ts`.)

## The shape

Every function returns `{ layers, meta }`. Each layer is one kind of mark (a line, points, a band, a table) and is an
array of plain objects with short numeric columns (`x`, `y`, `ymin`, `ymax`, `group`, ...). `meta` has suggested axis
labels and the numbers to print with the figure (an AUC, I², a bandwidth).

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

Observable Plot, Vega-Lite and ECharts take the rows as they are. Plotly takes columns: `fromRows` (in the main entry)
turns a layer into an object of columns.

```js
import { fromRows } from "@numero-uno-jpn/rstats";
const cols = fromRows(km.layers.steps); // { x: [...], y: [...], ymin: [...], ymax: [...], group: [...] }
```

## Survival curves

The steps change at each row: draw them as steps after the point (`curve: "step-after"` in Observable Plot,
`line.shape: "hv"` in Plotly). Each stratum starts at (0, 1), as R's `plot.survfit`.

```js
// Observable Plot
Plot.plot({
  y: { domain: [0, 1], label: km.meta.yLabel },
  marks: [
    // one band per stratum
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

`survPlotData(fit, { fun: "event" })` gives the cumulative incidence 1 − S(t), `"cumhaz"` the cumulative hazard and
`"cloglog"` log(−log S) against log t. `riskTimes` sets the times of the risk table (by default R's `pretty` of the
time range). `cumincPlotData` does the same for `cuminc`'s competing-risks curves.

## Forest and funnel plots

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

The study intervals are estimate ∓ z se at `level` (default 0.95); the weights are in percent (the random effects
weights when that estimate is shown, as meta's forest). Pass `transform: Math.exp` for ratio measures on the log
scale. For `rma`, the weights are 1 / (vᵢ + τ²).

`funnelPlotData(m)` gives the studies as (estimate, standard error), the pseudo 95% region around the common effect
and, with `contours: [0.9, 0.95, 0.99]`, the regions of a contour-enhanced funnel plot around 0. Plot the y axis
reversed (`y: { reverse: true }`, or `yaxis: { autorange: "reversed" }` in Plotly).

`netgraphData(netmeta(...))` gives the treatments on a circle and one edge per direct comparison with its number of
studies (for the line width).

## Distributions

```js
import { qqPlotData, densityPlotData, boxplotData, ecdfPlotData, histPlotData } from "@numero-uno-jpn/rstats/plot";

const y = [3.1, 1.2, 5.5, 1.2, 9.0, 4.4, 6.3, 2.8];
const qq = qqPlotData(y);            // points (normal quantile, value) and qqline's line
const dens = densityPlotData(y);     // R's density() curve (512 points) and a rug; meta.bw is the bandwidth
const box = boxplotData({ a: y, b: [2, 3, 3, 5, 12] }); // R's boxplot statistics per group, and the outliers

Plot.plot({ marks: [Plot.dot(qq.layers.points, { x: "x", y: "y" }), Plot.line(qq.layers.line, { x: "x", y: "y" })] });
Plotly.newPlot("dens", [{ ...fromRows(dens.layers.curve), mode: "lines" }]);
```

`boxplotData`'s rows have `lower`, `q1`, `median`, `q3`, `upper` (the whiskers at R's 1.5 IQR rule) and the notch
limits; Plotly's box traces take them as `lowerfence`, `q1`, `median`, `q3`, `upperfence`. `ecdfPlotData` gives the
steps of the empirical distribution function and `histPlotData` the bars of `hist`.

The statistics themselves are in `/descriptive` and match R: `density` (the same binned FFT approximation, seven
kernels, weights), `bwNrd0`, `bwNrd`, `qqnorm`, `qqline`, `ppoints`, `boxplotStats`, `lowess`.

## Model diagnostics and predictions

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

These are R's `plot.lm` panels: the smooths are `lowess` with span 2/3 (as `panel.smooth`), the residuals are
weighted as in R, `extreme` flags the three points R labels, and the Cook's distance contours are at 0.5 and 1. The
influence measures are also available on their own: `lmHatvalues`, `lmRstandard`, `lmRstudent`, `lmCooksDistance`.

`coefPlotData(fit)` gives each coefficient with its confidence interval; `predictionBandData(fit, xs)` the fitted line
with the confidence band and the prediction band over `xs`.

## ROC curves, time series, clusters, components

- `rocPlotData(roc(...))`: the curve as (1 − specificity, sensitivity) from (0, 0) to (1, 1), the diagonal, the point
  of the largest Youden index; `meta.auc`.
- `acfPlotData(acf(x))`: the bars and the ± qnorm(0.975) / √n band of `plot.acf`.
- `forecastPlotData(x, forecast(fit, { h }), { start, frequency })`: the series, the point forecasts and one
  interval band per level (widest first), as forecast's `plot.forecast`.
- `dendrogramData(hclust(...))`: the segments of the tree with the leaves at 1, …, n in the clustering's order and each
  merge centred over its two clusters, as `plot.hclust` (`hang` as R's).
- `biplotData(prcomp(...))`: the observations and the variables of `biplot.prcomp` (`scale`, `pcBiplot`).

## Loading from a CDN

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
