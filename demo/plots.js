// Plots tab (from 1.21.0): the plot data of /plot (survPlotData, qqPlotData, densityPlotData, lmDiagnosticsData,
// rocPlotData) drawn with the demo's own SVG plots (plot.js), with the code that draws the same rows with Observable
// Plot and with Plotly.js. The demo loads no plotting library: the rows are what the code hands to one.

import { plot } from "./plot.js";
import { codeBlock, debounce, errorBox, field, h, jsArr, parseNumbers, setChildren, textInput } from "./util.js";

const TIME = "5, 8, 12, 12, 20, 3, 9, 9, 15, 22, 30, 4";
const STATUS = "1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1";
const GROUP = "a, a, a, a, a, b, b, b, b, b, b, b";
const SAMPLE = "3.1, 1.2, 5.5, 1.2, 9.0, 4.4, 6.3, 2.8, 7.7, 0.4";
const X = "1, 2, 3, 4, 10, 6, 7";
const Y = "1.1, 1.9, 3.2, 3.9, 7, 5.5, 6.1";

const range = (v, pad = 0.05) => {
  const lo = Math.min(...v), hi = Math.max(...v);
  const d = (hi - lo) * pad || 1;
  return [lo - d, hi + d];
};

export function createPlotsTab(ctx) {
  const { lib } = ctx;
  const err = errorBox("plots-error");
  const figures = h("div", { class: "plots", "data-testid": "plots-figures" });
  const observable = codeBlock("js", "plots.observable", "plots-code-observable");
  const plotly = codeBlock("js", "plots.plotly", "plots-code-plotly");
  const codes = h("div", { "data-testid": "plots-code" }, observable.el, plotly.el);
  const run = debounce(update, 150);
  const inputs = {
    time: textInput({ value: TIME, testid: "plots-time", inputmode: "decimal", onInput: run }),
    status: textInput({ value: STATUS, testid: "plots-status", inputmode: "decimal", onInput: run }),
    group: textInput({ value: GROUP, testid: "plots-group", onInput: run }),
    sample: textInput({ value: SAMPLE, testid: "plots-sample", inputmode: "decimal", onInput: run }),
    x: textInput({ value: X, testid: "plots-x", inputmode: "decimal", onInput: run }),
    y: textInput({ value: Y, testid: "plots-y", inputmode: "decimal", onInput: run }),
  };

  function update() {
    err.clear();
    try {
      const time = parseNumbers(inputs.time.value), status = parseNumbers(inputs.status.value);
      const group = inputs.group.value.split(",").map((s) => s.trim()).filter((s) => s !== "");
      const sample = parseNumbers(inputs.sample.value);
      const x = parseNumbers(inputs.x.value), y = parseNumbers(inputs.y.value);
      const km = lib.survPlotData(lib.survfit(time, status, group.length ? { group } : {}));
      const groups = km.meta.groups;
      const kmFig = plot({
        title: "survPlotData(survfit(...))",
        series: [
          ...groups.map((g, i) => ({ type: "step", points: km.layers.steps.filter((r) => r.group === g).map((r) => [r.x, r.y]), className: `series-${(i % 2) + 1}` })),
          ...groups.map((g, i) => ({ type: "points", points: km.layers.censor.filter((r) => r.group === g).map((r) => [r.x, r.y]), className: `series-${(i % 2) + 1}` })),
        ],
        xDomain: [0, Math.max(...time) * 1.04], yDomain: [0, 1.04], xLabel: km.meta.xLabel, yLabel: km.meta.yLabel, testid: "plots-km",
      });
      const qq = lib.qqPlotData(sample);
      const qqFig = plot({
        title: "qqPlotData(x)",
        series: [{ type: "points", points: qq.layers.points.map((p) => [p.x, p.y]) }, { type: "line", points: qq.layers.line.map((p) => [p.x, p.y]), className: "series-2" }],
        xDomain: range(qq.layers.points.map((p) => p.x)), yDomain: range(qq.layers.points.map((p) => p.y)), xLabel: qq.meta.xLabel, yLabel: qq.meta.yLabel, testid: "plots-qq",
      });
      const dens = lib.densityPlotData(sample);
      const densFig = plot({
        title: "densityPlotData(x)",
        series: [{ type: "line", points: dens.layers.curve.map((p) => [p.x, p.y]) }],
        xDomain: range(dens.layers.curve.map((p) => p.x), 0), yDomain: [0, Math.max(...dens.layers.curve.map((p) => p.y)) * 1.08],
        xLabel: dens.meta.xLabel, testid: "plots-density",
      });
      const diag = lib.lmDiagnosticsData(lib.lm(x, y));
      const rf = diag.layers.residualsFitted;
      const diagFig = plot({
        title: "lmDiagnosticsData(lm(x, y)): Residuals vs Fitted",
        series: [{ type: "points", points: rf.map((p) => [p.x, p.y]) }, { type: "line", points: diag.layers.residualsFittedSmooth.map((p) => [p.x, p.y]), className: "series-2" }],
        xDomain: range(rf.map((p) => p.x)), yDomain: range(rf.map((p) => p.y), 0.15), testid: "plots-diag",
      });
      setChildren(figures, kmFig, qqFig, densFig, diagFig);
      const imp = ctx.importLine(["survfit", "survPlotData", "qqPlotData", "fromRows"]);
      observable.set(
        [
          imp,
          'const Plot = await import("https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.16/+esm");',
          `const km = survPlotData(survfit(${jsArr(time)}, ${jsArr(status)}${group.length ? `, { group: ${JSON.stringify(group)} }` : ""}));`,
          "document.body.append(Plot.plot({ y: { domain: [0, 1] }, marks: [",
          '  Plot.areaY(km.layers.steps, { x: "x", y1: "ymin", y2: "ymax", fill: "group", fillOpacity: 0.15, curve: "step-after" }),',
          '  Plot.line(km.layers.steps, { x: "x", y: "y", stroke: "group", curve: "step-after" }),',
          '  Plot.tickY(km.layers.censor, { x: "x", y: "y", stroke: "group" }),',
          "] }));",
        ].join("\n"),
      );
      plotly.set(
        [
          imp,
          `const qq = qqPlotData(${jsArr(sample)});`,
          "// Plotly takes columns: fromRows turns the rows of a layer into { x: [...], y: [...] }",
          'Plotly.newPlot("qq", [',
          '  { ...fromRows(qq.layers.points), mode: "markers", name: "data" },',
          '  { ...fromRows(qq.layers.line), mode: "lines", name: "qqline" },',
          "]);",
        ].join("\n"),
      );
    } catch (e) {
      err.show(e);
      setChildren(figures);
    }
  }

  const form = h(
    "form",
    { class: "card form-card", on: { submit: (e) => e.preventDefault() } },
    h("h2", { class: "card-title", i18n: "tab.plots" }),
    h("p", { class: "hint", i18n: "plots.intro" }),
    field(null, inputs.time, { labelText: "time" }),
    field(null, inputs.status, { labelText: "status" }),
    field(null, inputs.group, { labelText: "group" }),
    field(null, inputs.sample, { labelText: "x (Q-Q, density)" }),
    field(null, inputs.x, { labelText: "lm: x" }),
    field(null, inputs.y, { labelText: "lm: y" }),
    err.el,
  );
  const el = h(
    "div",
    { class: "tab-body" },
    h("div", { class: "workbench" }, form, h("div", { class: "card result-card" }, h("h3", { class: "sub-heading", i18n: "results" }), figures, codes)),
  );
  update();
  return { el, update: () => update() };
}

