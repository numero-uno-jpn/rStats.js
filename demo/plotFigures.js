// The figures of the demo's Plots tab: for each, its example data (demo/plot-data.json, from oracle/demoplots.R), the
// columns of the user's own CSV, the rStats.js calls that make the plot data (/plot), the drawing with Observable Plot
// and with Plotly.js, the code a user copies, and the values compared with R. `L` is the library's namespace (every
// area); `Plot` and `Plotly` are the loaded plotting libraries. Also run by test/demoPlots.test.ts (compute and checks).

/** The value of a step function given as rows sorted by x (steps after each point) at t */
export function stepAt(rows, t, key = "y") {
  let v = NaN;
  for (const r of rows) {
    if (r.x <= t) v = r[key];
    else break;
  }
  return v;
}

const js = (v) => JSON.stringify(v);
/** An array in code: in full when short, else its first values and a comment */
function arr(v, max = 40) {
  if (v.length <= max) return js(v);
  return `[${v.slice(0, 8).map((x) => js(x)).join(", ")}, /* … ${v.length} values in all */]`;
}
const num = (s) => (s === "" || s == null ? NaN : Number(s));

const COLORS = ["#2456c8", "#d1495b", "#2a9d8f", "#e9a03b", "#7b5ea7", "#5c6b73"];

/** Plotly layout defaults shared by the figures */
function layout(extra = {}) {
  return {
    margin: { l: 60, r: 20, t: 30, b: 50 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { color: getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#222" },
    legend: { orientation: "h", y: -0.2 },
    ...extra,
  };
}

/** A band as two Plotly traces (lower, then upper filled to it) */
function bandTraces(xs, lo, hi, color, name, shape) {
  return [
    { x: xs, y: lo, mode: "lines", line: { width: 0, shape }, showlegend: false, hoverinfo: "skip" },
    { x: xs, y: hi, mode: "lines", line: { width: 0, shape }, fill: "tonexty", fillcolor: color, name, hoverinfo: "skip" },
  ];
}

const groupsOf = (rows, key = "group") => [...new Set(rows.map((r) => r[key]))];

export const FIGURES = [
  // ------------------------------------------------------------------ survival and ROC
  {
    id: "km", section: "survival", fns: ["survfit", "survPlotData"],
    title: { en: "Kaplan-Meier curves with a risk table", ja: "Kaplan-Meier 曲線とリスク表" },
    datasets: { lung: "survival::lung (by sex)", aml: "survival::aml (by maintenance)" },
    csv: { columns: ["time", "status", "group"], example: "time,status,group\n5,1,A\n8,0,A\n12,1,B\n15,1,B\n20,0,B" },
    fromCsv: (rows) => ({ time: rows.map((r) => num(r.time)), status: rows.map((r) => num(r.status)), group: rows.map((r) => String(r.group ?? "all")) }),
    compute: (L, d) => L.survPlotData(L.survfit(d.time, d.status, { group: d.group }), d.riskTimes ? { riskTimes: d.riskTimes } : {}),
    observable: (Plot, pd) => Plot.plot({
      y: { domain: [0, 1], label: pd.meta.yLabel, grid: true }, x: { label: pd.meta.xLabel }, color: { legend: true },
      marks: [
        // one band per stratum (a single areaY over every stratum drew a stray band)
        ...groupsOf(pd.layers.steps).map((g) => Plot.areaY(pd.layers.steps.filter((r) => r.group === g), { x: "x", y1: "ymin", y2: "ymax", fill: () => g, fillOpacity: 0.12, curve: "step-after" })),
        Plot.line(pd.layers.steps, { x: "x", y: "y", stroke: "group", curve: "step-after", strokeWidth: 2 }),
        Plot.dot(pd.layers.censor, { x: "x", y: "y", stroke: "group", symbol: "plus", r: 3.5 }),
      ],
    }),
    plotly: (pd) => ({
      data: groupsOf(pd.layers.steps).flatMap((g, i) => {
        const s = pd.layers.steps.filter((r) => r.group === g);
        const c = pd.layers.censor.filter((r) => r.group === g);
        return [
          ...bandTraces(s.map((r) => r.x), s.map((r) => r.ymin), s.map((r) => r.ymax), COLORS[i] + "22", `${g} (95% CI)`, "hv"),
          { x: s.map((r) => r.x), y: s.map((r) => r.y), mode: "lines", line: { shape: "hv", color: COLORS[i], width: 2 }, name: g },
          { x: c.map((r) => r.x), y: c.map((r) => r.y), mode: "markers", marker: { symbol: "line-ns-open", size: 9, color: COLORS[i] }, showlegend: false, name: `${g} censored` },
        ];
      }),
      layout: layout({ yaxis: { range: [0, 1.02], title: pd.meta.yLabel }, xaxis: { title: pd.meta.xLabel } }),
    }),
    table: (pd) => ({ title: "Risk table (number at risk)", rows: pd.layers.riskTable }),
    code: (d) => ({
      setup: `const time = ${arr(d.time)};\nconst status = ${arr(d.status)};\nconst group = ${arr(d.group)};\nconst km = survPlotData(survfit(time, status, { group }));`,
      observable: `Plot.plot({ y: { domain: [0, 1] }, color: { legend: true }, marks: [\n  ...km.meta.groups.map((g) => Plot.areaY(km.layers.steps.filter((r) => r.group === g), { x: "x", y1: "ymin", y2: "ymax", fill: () => g, fillOpacity: 0.12, curve: "step-after" })),\n  Plot.line(km.layers.steps, { x: "x", y: "y", stroke: "group", curve: "step-after" }),\n  Plot.dot(km.layers.censor, { x: "x", y: "y", stroke: "group", symbol: "plus" }),\n] })`,
      plotly: `const traces = km.meta.groups.map((g) => {\n  const c = fromRows(km.layers.steps.filter((r) => r.group === g));\n  return { x: c.x, y: c.y, name: g, mode: "lines", line: { shape: "hv" } };\n});\nPlotly.newPlot("km", traces, { yaxis: { range: [0, 1] } });`,
    }),
    checks: (L, pd, d, r) => {
      const groups = groupsOf(pd.layers.steps).sort();
      const surv = groups.flatMap((g) => r.times.map((t) => stepAt(pd.layers.steps.filter((s) => s.group === g), t)));
      const risk = groups.flatMap((g) => r.times.map((t) => pd.layers.riskTable.find((x) => x.group === g && x.x === t)?.nRisk));
      return [
        { label: "S(t) at the risk-table times, by group", js: surv, r: r.surv },
        { label: "number at risk", js: risk, r: r.nRisk },
      ];
    },
  },
  {
    id: "cuminc", section: "survival", fns: ["cuminc", "cumincPlotData"],
    title: { en: "Cumulative incidence with competing risks", ja: "競合リスクの累積発生" },
    datasets: { crisk: "a seeded sample (two causes, two groups)" },
    csv: { columns: ["time", "status (0 = censored, 1, 2, ... = cause)", "group"], example: "time,status,group\n2,1,A\n3,2,A\n5,0,A\n4,1,B\n6,1,B\n8,2,B" },
    fromCsv: (rows) => ({ time: rows.map((r) => num(r.time)), status: rows.map((r) => num(r.status)), group: rows.map((r) => String(r.group ?? "all")) }),
    compute: (L, d) => L.cumincPlotData(L.cuminc(d.time, d.status, { group: d.group })),
    observable: (Plot, pd) => Plot.plot({
      y: { domain: [0, 1], label: pd.meta.yLabel, grid: true }, x: { label: pd.meta.xLabel }, color: { legend: true },
      marks: [Plot.line(pd.layers.steps, { x: "x", y: "y", stroke: "group", curve: "step-after", strokeWidth: 2 })],
    }),
    plotly: (pd) => ({
      data: groupsOf(pd.layers.steps).map((g, i) => {
        const s = pd.layers.steps.filter((r) => r.group === g);
        return { x: s.map((r) => r.x), y: s.map((r) => r.y), mode: "lines", line: { shape: "hv", color: COLORS[i % 6] }, name: g };
      }),
      layout: layout({ yaxis: { range: [0, 1], title: pd.meta.yLabel }, xaxis: { title: pd.meta.xLabel } }),
    }),
    code: (d) => ({
      setup: `const ci = cumincPlotData(cuminc(${arr(d.time)}, ${arr(d.status)}, { group: ${arr(d.group)} }));`,
      observable: `Plot.plot({ color: { legend: true }, marks: [\n  Plot.line(ci.layers.steps, { x: "x", y: "y", stroke: "group", curve: "step-after" }),\n] })`,
      plotly: `const names = [...new Set(ci.layers.steps.map((r) => r.group))];\nPlotly.newPlot("ci", names.map((g) => ({ ...fromRows(ci.layers.steps.filter((r) => r.group === g)), name: g, line: { shape: "hv" } })));`,
    }),
    checks: (L, pd, d, r) => [{
      label: "estimates at the time points (timepoints)",
      js: r.names.flatMap((name) => r.times.map((t) => stepAt(pd.layers.steps.filter((s) => s.group === name), t))),
      r: r.est.flat(),
    }],
  },
  {
    id: "roc", section: "survival", fns: ["roc", "rocPlotData"],
    title: { en: "ROC curve with the AUC and the best Youden point", ja: "ROC 曲線 (AUC と Youden 指数の最適点)" },
    datasets: { aSAH: "pROC::aSAH (s100b)", aSAHwfns: "pROC::aSAH (wfns)" },
    csv: { columns: ["outcome", "marker"], example: "outcome,marker\n0,0.1\n0,0.4\n1,0.35\n1,0.8\n0,0.2\n1,0.9" },
    fromCsv: (rows) => ({ outcome: rows.map((r) => String(r.outcome)), marker: rows.map((r) => num(r.marker)) }),
    compute: (L, d) => L.rocPlotData(L.roc(d.outcome, d.marker)),
    observable: (Plot, pd) => Plot.plot({
      aspectRatio: 1, x: { domain: [0, 1], label: pd.meta.xLabel }, y: { domain: [0, 1], label: pd.meta.yLabel, grid: true },
      marks: [
        Plot.line(pd.layers.diagonal, { x: "x", y: "y", strokeDasharray: "4,4", stroke: "gray" }),
        Plot.line(pd.layers.curve, { x: "x", y: "y", strokeWidth: 2, stroke: COLORS[0] }),
        Plot.dot(pd.layers.best, { x: "x", y: "y", r: 5, fill: COLORS[1] }),
        Plot.text([`AUC = ${pd.meta.auc.toFixed(4)}`], { frameAnchor: "bottom-right", dx: -10, dy: -10 }),
      ],
    }),
    plotly: (pd) => ({
      data: [
        { ...xy(pd.layers.diagonal), mode: "lines", line: { dash: "dash", color: "gray" }, name: "chance" },
        { ...xy(pd.layers.curve), mode: "lines", line: { color: COLORS[0], width: 2 }, name: `AUC = ${pd.meta.auc.toFixed(4)}` },
        { ...xy(pd.layers.best), mode: "markers", marker: { size: 10, color: COLORS[1] }, name: "best (Youden)" },
      ],
      layout: layout({ xaxis: { range: [0, 1], title: pd.meta.xLabel }, yaxis: { range: [0, 1], title: pd.meta.yLabel, scaleanchor: "x" } }),
    }),
    code: (d) => ({
      setup: `const r = rocPlotData(roc(${arr(d.outcome)}, ${arr(d.marker)}));`,
      observable: `Plot.plot({ aspectRatio: 1, marks: [\n  Plot.line(r.layers.diagonal, { x: "x", y: "y", strokeDasharray: "4,4" }),\n  Plot.line(r.layers.curve, { x: "x", y: "y" }),\n  Plot.dot(r.layers.best, { x: "x", y: "y", fill: "red" }),\n] })`,
      plotly: `Plotly.newPlot("roc", [{ ...fromRows(r.layers.curve), mode: "lines", name: "AUC " + r.meta.auc.toFixed(3) }]);`,
    }),
    checks: (L, pd, d, r) => [
      { label: "AUC", js: [pd.meta.auc], r: [r.auc] },
      { label: "largest Youden index (sensitivity + specificity − 1)", js: [pd.layers.best[0].youden], r: [r.youden] },
    ],
  },
  // ------------------------------------------------------------------ meta-analysis
  {
    id: "forest", section: "meta", fns: ["metagen", "forestPlotData"],
    title: { en: "Forest plot of a meta-analysis", ja: "メタ分析の forest plot" },
    datasets: { bcg: "metafor::dat.bcg (log risk ratios)" },
    csv: { columns: ["TE", "seTE", "label"], example: "TE,seTE,label\n0.21,0.11,A\n0.52,0.21,B\n-0.08,0.16,C\n0.35,0.12,D" },
    fromCsv: (rows) => ({ TE: rows.map((r) => num(r.TE)), seTE: rows.map((r) => num(r.seTE)), labels: rows.map((r, i) => String(r.label ?? `Study ${i + 1}`)) }),
    compute: (L, d) => L.forestPlotData(L.metagen(d.TE, d.seTE), { labels: d.labels, prediction: true }),
    observable: (Plot, pd) => Plot.plot({
      height: 60 + 24 * (pd.layers.studies.length + pd.layers.pooled.length), marginLeft: 170, marginTop: 20,
      y: { axis: null, domain: [Math.min(...pd.layers.pooled.map((p) => p.y)) - 0.8, pd.layers.studies.length + 0.8] },
      x: { label: "Estimate (log scale of the measure)", grid: true },
      marks: [
        Plot.ruleX([0], { stroke: "gray" }),
        Plot.link(pd.layers.studies, { x1: "lower", x2: "upper", y1: "y", y2: "y" }),
        Plot.dot(pd.layers.studies, { x: "estimate", y: "y", r: (r) => 2 + Math.sqrt(r.weight), fill: COLORS[0], symbol: "square" }),
        Plot.line(pd.layers.diamonds, { x: "x", y: "y", z: "group", fill: COLORS[1], stroke: COLORS[1] }),
        Plot.link(pd.layers.pooled.filter((p) => p.type === "prediction"), { x1: "lower", x2: "upper", y1: "y", y2: "y", stroke: COLORS[1], strokeDasharray: "3,3" }),
        Plot.text([...pd.layers.studies, ...pd.layers.pooled], { x: (r) => Math.min(...pd.layers.studies.map((s) => s.lower)), y: "y", text: "label", textAnchor: "end", dx: -12 }),
      ],
    }),
    plotly: (pd) => {
      const all = [...pd.layers.studies, ...pd.layers.pooled];
      return {
        data: [
          { x: pd.layers.studies.map((r) => r.estimate), y: pd.layers.studies.map((r) => r.y), mode: "markers", text: pd.layers.studies.map((r) => `${r.label}: ${r.weight.toFixed(1)}%`),
            marker: { symbol: "square", size: pd.layers.studies.map((r) => 4 + 1.5 * Math.sqrt(r.weight)), color: COLORS[0] },
            error_x: { type: "data", symmetric: false, array: pd.layers.studies.map((r) => r.upper - r.estimate), arrayminus: pd.layers.studies.map((r) => r.estimate - r.lower), color: "#444" }, name: "studies" },
          ...groupsOf(pd.layers.diamonds).map((g) => {
            const dm = pd.layers.diamonds.filter((q) => q.group === g);
            return { x: dm.map((q) => q.x), y: dm.map((q) => q.y), mode: "lines", fill: "toself", line: { color: COLORS[1] }, fillcolor: COLORS[1], name: g };
          }),
        ],
        layout: layout({ yaxis: { tickvals: all.map((r) => r.y), ticktext: all.map((r) => r.label), zeroline: false }, xaxis: { zeroline: true }, margin: { l: 180, r: 20, t: 30, b: 50 }, height: 140 + 24 * all.length, showlegend: false }),
      };
    },
    table: (pd) => ({ title: "Studies (weights in %)", rows: pd.layers.studies }),
    code: (d) => ({
      setup: `const fp = forestPlotData(metagen(${arr(d.TE)}, ${arr(d.seTE)}), { labels: ${arr(d.labels)}, prediction: true });`,
      observable: `Plot.plot({ marginLeft: 170, y: { axis: null }, marks: [\n  Plot.ruleX([0]),\n  Plot.link(fp.layers.studies, { x1: "lower", x2: "upper", y1: "y", y2: "y" }),\n  Plot.dot(fp.layers.studies, { x: "estimate", y: "y", r: (d) => 2 + Math.sqrt(d.weight), symbol: "square" }),\n  Plot.line(fp.layers.diamonds, { x: "x", y: "y", z: "group", fill: "currentColor" }),\n  Plot.text([...fp.layers.studies, ...fp.layers.pooled], { x: -2, y: "y", text: "label", textAnchor: "end" }),\n] })`,
      plotly: `const s = fromRows(fp.layers.studies);\nPlotly.newPlot("forest", [{ x: s.estimate, y: s.label, mode: "markers",\n  error_x: { type: "data", symmetric: false, array: s.upper.map((u, i) => u - s.estimate[i]), arrayminus: s.lower.map((l, i) => s.estimate[i] - l) } }],\n  { yaxis: { autorange: "reversed" } });`,
    }),
    checks: (L, pd, d, r) => {
      const pooled = (t) => pd.layers.pooled.find((p) => p.type === t);
      return [
        { label: "study intervals (lower)", js: pd.layers.studies.map((s) => s.lower), r: r.lower },
        { label: "study intervals (upper)", js: pd.layers.studies.map((s) => s.upper), r: r.upper },
        { label: "random-effects weights (%)", js: pd.layers.studies.map((s) => s.weight), r: r.weight },
        { label: "common and random effects estimates", js: [pooled("common").estimate, pooled("random").estimate], r: [r.TEcommon, r.TErandom] },
        { label: "random-effects interval", js: [pooled("random").lower, pooled("random").upper], r: [r.lowerRandom, r.upperRandom] },
        { label: "tau² and I² (REML at the maximum)", js: [pd.meta.tau2, pd.meta.I2], r: [r.tau2, r.I2] },
      ];
    },
  },
  {
    id: "funnel", section: "meta", fns: ["metagen", "funnelPlotData"],
    title: { en: "Contour-enhanced funnel plot", ja: "等高線つき funnel plot" },
    datasets: { bcg: "metafor::dat.bcg (log risk ratios)" },
    csv: { columns: ["TE", "seTE"], example: "TE,seTE\n0.21,0.11\n0.52,0.21\n-0.08,0.16\n0.35,0.12" },
    fromCsv: (rows) => ({ TE: rows.map((r) => num(r.TE)), seTE: rows.map((r) => num(r.seTE)) }),
    compute: (L, d) => L.funnelPlotData(L.metagen(d.TE, d.seTE), { contours: [0.9, 0.95, 0.99] }),
    observable: (Plot, pd) => Plot.plot({
      y: { reverse: true, label: pd.meta.yLabel }, x: { label: pd.meta.xLabel }, color: { legend: true, type: "ordinal", scheme: "greys" },
      marks: [
        ...[0.99, 0.95, 0.9].map((lv) => Plot.areaX(pd.layers.contours.filter((c) => c.level === lv), { y: "y", x1: "xmin", x2: "xmax", fill: () => lv, fillOpacity: 0.35 })),
        Plot.line(pd.layers.region, { x: "xmin", y: "y", strokeDasharray: "4,3" }),
        Plot.line(pd.layers.region, { x: "xmax", y: "y", strokeDasharray: "4,3" }),
        Plot.line(pd.layers.reference, { x: "x", y: "y", stroke: COLORS[1] }),
        Plot.dot(pd.layers.studies, { x: "x", y: "y", fill: COLORS[0], r: 4 }),
      ],
    }),
    plotly: (pd) => ({
      data: [
        ...[0.99, 0.95, 0.9].flatMap((lv, i) => {
          const c = pd.layers.contours.filter((q) => q.level === lv);
          return [{ x: [...c.map((q) => q.xmin), ...c.map((q) => q.xmax).reverse()], y: [...c.map((q) => q.y), ...c.map((q) => q.y).reverse()], fill: "toself", mode: "lines", line: { width: 0 }, fillcolor: ["#bbb", "#ccc", "#e2e2e2"][i], name: `p < ${(1 - lv).toFixed(2)}` }];
        }),
        { x: pd.layers.region.map((r) => r.xmin), y: pd.layers.region.map((r) => r.y), mode: "lines", line: { dash: "dash", color: "#444" }, name: "95% region" },
        { x: pd.layers.region.map((r) => r.xmax), y: pd.layers.region.map((r) => r.y), mode: "lines", line: { dash: "dash", color: "#444" }, showlegend: false },
        { ...xy(pd.layers.studies), mode: "markers", marker: { color: COLORS[0], size: 8 }, name: "studies" },
      ],
      layout: layout({ yaxis: { autorange: "reversed", title: pd.meta.yLabel }, xaxis: { title: pd.meta.xLabel } }),
    }),
    code: (d) => ({
      setup: `const fu = funnelPlotData(metagen(${arr(d.TE)}, ${arr(d.seTE)}), { contours: [0.9, 0.95, 0.99] });`,
      observable: `Plot.plot({ y: { reverse: true }, marks: [\n  Plot.areaX(fu.layers.contours.filter((c) => c.level === 0.95), { y: "y", x1: "xmin", x2: "xmax", fillOpacity: 0.3 }),\n  Plot.line(fu.layers.region, { x: "xmin", y: "y", strokeDasharray: "4,3" }),\n  Plot.line(fu.layers.region, { x: "xmax", y: "y", strokeDasharray: "4,3" }),\n  Plot.dot(fu.layers.studies, { x: "x", y: "y" }),\n] })`,
      plotly: `Plotly.newPlot("funnel", [{ ...fromRows(fu.layers.studies), mode: "markers" }], { yaxis: { autorange: "reversed" } });`,
    }),
    checks: (L, pd, d, r) => {
      const last = pd.layers.region.at(-1);
      return [
        { label: "reference line (common effect)", js: [pd.meta.reference], r: [r.reference] },
        { label: "95% region at the largest standard error", js: [last.y, last.xmin, last.xmax], r: [r.maxSe, r.xmin, r.xmax] },
      ];
    },
  },
  {
    id: "netgraph", section: "meta", fns: ["netmeta", "netgraphData"],
    title: { en: "Network graph of a network meta-analysis", ja: "ネットワーク・メタアナリシスの網目図" },
    datasets: { senn: "netmeta::Senn2013 (diabetes)" },
    csv: { columns: ["TE", "seTE", "treat1", "treat2", "studlab"], example: "TE,seTE,treat1,treat2,studlab\n0.3,0.1,A,B,s1\n0.5,0.2,A,C,s2\n0.2,0.15,B,C,s3\n0.4,0.2,A,B,s4" },
    fromCsv: (rows) => ({ TE: rows.map((r) => num(r.TE)), seTE: rows.map((r) => num(r.seTE)), treat1: rows.map((r) => String(r.treat1)), treat2: rows.map((r) => String(r.treat2)), studlab: rows.map((r) => String(r.studlab)) }),
    compute: (L, d) => L.netgraphData(L.netmeta(d.TE, d.seTE, d.treat1, d.treat2, d.studlab)),
    observable: (Plot, pd) => Plot.plot({
      aspectRatio: 1, inset: 60, x: { axis: null }, y: { axis: null },
      marks: [
        Plot.link(pd.layers.edges, { x1: "x1", y1: "y1", x2: "x2", y2: "y2", strokeWidth: (e) => 1 + 2 * e.studies, stroke: COLORS[0], strokeOpacity: 0.7 }),
        Plot.dot(pd.layers.nodes, { x: "x", y: "y", r: 6, fill: COLORS[1] }),
        Plot.text(pd.layers.nodes, { x: "x", y: "y", text: "label", dy: -14, fontSize: 12 }),
      ],
    }),
    plotly: (pd) => ({
      data: [
        ...pd.layers.edges.map((e) => ({ x: [e.x1, e.x2], y: [e.y1, e.y2], mode: "lines", line: { width: 1 + 2 * e.studies, color: COLORS[0] }, opacity: 0.7, hoverinfo: "text", text: `${e.from}–${e.to}: ${e.studies}`, showlegend: false })),
        { ...xy(pd.layers.nodes), mode: "markers+text", text: pd.layers.nodes.map((n) => n.label), textposition: "top center", marker: { size: 12, color: COLORS[1] }, showlegend: false },
      ],
      layout: layout({ xaxis: { visible: false }, yaxis: { visible: false, scaleanchor: "x" } }),
    }),
    table: (pd) => ({ title: "Direct comparisons", rows: pd.layers.edges.map(({ from, to, studies }) => ({ from, to, studies })) }),
    code: (d) => ({
      setup: `const ng = netgraphData(netmeta(TE, seTE, treat1, treat2, studlab)); // ${d.TE.length} comparisons`,
      observable: `Plot.plot({ aspectRatio: 1, inset: 60, axis: null, marks: [\n  Plot.link(ng.layers.edges, { x1: "x1", y1: "y1", x2: "x2", y2: "y2", strokeWidth: (e) => 1 + 2 * e.studies }),\n  Plot.dot(ng.layers.nodes, { x: "x", y: "y", r: 6 }),\n  Plot.text(ng.layers.nodes, { x: "x", y: "y", text: "label", dy: -14 }),\n] })`,
      plotly: `Plotly.newPlot("net", ng.layers.edges.map((e) => ({ x: [e.x1, e.x2], y: [e.y1, e.y2], mode: "lines", line: { width: 1 + 2 * e.studies } })));`,
    }),
    checks: (L, pd, d, r) => {
      const key = (e) => [e.from, e.to].sort().join(":");
      const m = new Map(pd.layers.edges.map((e) => [key(e), e.studies]));
      return [{ label: "studies per direct comparison", js: r.pairs.map((p) => m.get(p) ?? NaN), r: r.studies }];
    },
  },
  // ------------------------------------------------------------------ distributions
  {
    id: "qq", section: "dist", fns: ["qqPlotData"],
    title: { en: "Normal Q-Q plot with qqline", ja: "正規 Q-Q プロットと qqline" },
    datasets: { eruptions: "faithful$eruptions", precip: "precip" },
    csv: { columns: ["x"], example: "x\n3.1\n1.2\n5.5\n1.2\n9.0\n4.4" },
    fromCsv: (rows) => ({ x: rows.map((r) => num(r.x)) }),
    compute: (L, d) => L.qqPlotData(d.x),
    observable: (Plot, pd) => Plot.plot({
      x: { label: pd.meta.xLabel, grid: true }, y: { label: pd.meta.yLabel, grid: true },
      marks: [Plot.line(pd.layers.line, { x: "x", y: "y", stroke: COLORS[1] }), Plot.dot(pd.layers.points, { x: "x", y: "y", r: 2.5, fill: COLORS[0] })],
    }),
    plotly: (pd) => ({
      data: [{ ...xy(pd.layers.points), mode: "markers", marker: { color: COLORS[0], size: 5 }, name: "data" }, { ...xy(pd.layers.line), mode: "lines", line: { color: COLORS[1] }, name: "qqline" }],
      layout: layout({ xaxis: { title: pd.meta.xLabel }, yaxis: { title: pd.meta.yLabel } }),
    }),
    code: (d) => ({
      setup: `const qq = qqPlotData(${arr(d.x)});`,
      observable: `Plot.plot({ marks: [\n  Plot.line(qq.layers.line, { x: "x", y: "y", stroke: "red" }),\n  Plot.dot(qq.layers.points, { x: "x", y: "y" }),\n] })`,
      plotly: `Plotly.newPlot("qq", [\n  { ...fromRows(qq.layers.points), mode: "markers" },\n  { ...fromRows(qq.layers.line), mode: "lines" },\n]);`,
    }),
    checks: (L, pd, d, r) => [
      { label: "theoretical quantiles of the first 5 values", js: pd.layers.points.filter((p) => p.index < 5).sort((a, b) => a.index - b.index).map((p) => p.x), r: r.x },
      { label: "qqline: intercept and slope", js: [pd.meta.intercept, pd.meta.slope], r: [r.intercept, r.slope] },
    ],
  },
  {
    id: "density", section: "dist", fns: ["densityPlotData", "histPlotData"],
    title: { en: "Histogram with a kernel density curve", ja: "ヒストグラムとカーネル密度曲線" },
    datasets: { eruptions: "faithful$eruptions", precip: "precip" },
    csv: { columns: ["x"], example: "x\n3.1\n1.2\n5.5\n1.2\n9.0\n4.4" },
    fromCsv: (rows) => ({ x: rows.map((r) => num(r.x)) }),
    compute: (L, d) => {
      const dens = L.densityPlotData(d.x);
      const h = L.histPlotData(d.x);
      return { layers: { curve: dens.layers.curve, rug: dens.layers.rug, bars: h.layers.bars }, meta: { ...dens.meta } };
    },
    observable: (Plot, pd) => Plot.plot({
      x: { label: pd.meta.xLabel }, y: { label: "Density", grid: true },
      marks: [
        Plot.rectY(pd.layers.bars, { x1: "x0", x2: "x1", y: "density", fill: COLORS[0], fillOpacity: 0.35, inset: 0.5 }),
        Plot.line(pd.layers.curve, { x: "x", y: "y", stroke: COLORS[1], strokeWidth: 2 }),
        Plot.ruleX(pd.layers.rug, { x: "x", y1: 0, y2: 0.04 * Math.max(...pd.layers.curve.map((r) => r.y)), strokeOpacity: 0.5 }),
      ],
    }),
    plotly: (pd) => ({
      data: [
        { x: pd.layers.bars.map((b) => b.mid), y: pd.layers.bars.map((b) => b.density), width: pd.layers.bars.map((b) => b.x1 - b.x0), type: "bar", marker: { color: COLORS[0], opacity: 0.4 }, name: "histogram" },
        { ...xy(pd.layers.curve), mode: "lines", line: { color: COLORS[1], width: 2 }, name: `density (bw ${pd.meta.bw.toPrecision(4)})` },
      ],
      layout: layout({ xaxis: { title: pd.meta.xLabel }, yaxis: { title: "Density" }, bargap: 0 }),
    }),
    code: (d) => ({
      setup: `const x = ${arr(d.x)};\nconst dens = densityPlotData(x), h = histPlotData(x);`,
      observable: `Plot.plot({ marks: [\n  Plot.rectY(h.layers.bars, { x1: "x0", x2: "x1", y: "density", fillOpacity: 0.35 }),\n  Plot.line(dens.layers.curve, { x: "x", y: "y", stroke: "red" }),\n  Plot.ruleX(dens.layers.rug, { x: "x", y1: 0, y2: 0.02 }),\n] })`,
      plotly: `const b = fromRows(h.layers.bars);\nPlotly.newPlot("dens", [\n  { x: b.mid, y: b.density, type: "bar" },\n  { ...fromRows(dens.layers.curve), mode: "lines" },\n]);`,
    }),
    checks: (L, pd, d, r, rh) => [
      { label: "bandwidth (bw.nrd0)", js: [pd.meta.bw], r: [r.bw] },
      { label: "density at 5 of the 512 points", js: r.idx.map((i) => pd.layers.curve[i].y), r: r.y, tol: 1e-10 },
      { label: "histogram counts (Sturges)", js: pd.layers.bars.map((b) => b.count), r: rh.counts },
    ],
    rKey: ["density", "hist"],
  },
  {
    id: "ecdf", section: "dist", fns: ["ecdfPlotData"],
    title: { en: "Empirical distribution function", ja: "経験分布関数" },
    datasets: { eruptions: "faithful$eruptions", precip: "precip" },
    csv: { columns: ["x"], example: "x\n3.1\n1.2\n5.5\n1.2\n9.0\n4.4" },
    fromCsv: (rows) => ({ x: rows.map((r) => num(r.x)) }),
    compute: (L, d) => L.ecdfPlotData(d.x),
    observable: (Plot, pd) => Plot.plot({
      y: { domain: [0, 1], label: pd.meta.yLabel, grid: true }, x: { label: pd.meta.xLabel },
      marks: [Plot.line(pd.layers.steps, { x: "x", y: "y", curve: "step-after", stroke: COLORS[0], strokeWidth: 2 })],
    }),
    plotly: (pd) => ({ data: [{ ...xy(pd.layers.steps), mode: "lines", line: { shape: "hv", color: COLORS[0] }, name: "Fn(x)" }], layout: layout({ yaxis: { range: [0, 1.02] } }) }),
    code: (d) => ({
      setup: `const e = ecdfPlotData(${arr(d.x)});`,
      observable: `Plot.plot({ marks: [Plot.line(e.layers.steps, { x: "x", y: "y", curve: "step-after" })] })`,
      plotly: `Plotly.newPlot("ecdf", [{ ...fromRows(e.layers.steps), mode: "lines", line: { shape: "hv" } }]);`,
    }),
    checks: (L, pd, d, r) => [{ label: "Fn at the 10%, 50% and 90% quantiles", js: r.at.map((t) => stepAt(pd.layers.steps, t)), r: r.F }],
  },
  {
    id: "boxplot", section: "dist", fns: ["boxplotData"],
    title: { en: "Box plots by group", ja: "群ごとの箱ひげ図" },
    datasets: { sprays: "InsectSprays (count by spray)", mpgcyl: "mtcars (mpg by cylinders)" },
    csv: { columns: ["value", "group"], example: "value,group\n1,a\n2,a\n3,a\n40,a\n2,b\n3,b\n5,b" },
    fromCsv: (rows) => ({ value: rows.map((r) => num(r.value)), group: rows.map((r) => String(r.group)) }),
    compute: (L, d) => {
      const groups = {};
      d.value.forEach((v, i) => (groups[d.group[i]] ??= []).push(v));
      return L.boxplotData(groups);
    },
    observable: (Plot, pd) => Plot.plot({
      x: { label: null }, y: { grid: true, label: "value" },
      marks: [
        Plot.ruleX(pd.layers.boxes, { x: "group", y1: "lower", y2: "upper" }),
        Plot.barY(pd.layers.boxes, { x: "group", y1: "q1", y2: "q3", fill: COLORS[0], fillOpacity: 0.35, stroke: COLORS[0], insetLeft: 8, insetRight: 8 }),
        Plot.tickY(pd.layers.boxes, { x: "group", y: "median", strokeWidth: 2, insetLeft: 8, insetRight: 8 }),
        Plot.dot(pd.layers.outliers, { x: "group", y: "y", r: 3, stroke: COLORS[1] }),
      ],
    }),
    plotly: (pd) => ({
      data: [{
        type: "box", name: "boxes", x: pd.layers.boxes.map((b) => b.group), q1: pd.layers.boxes.map((b) => b.q1), median: pd.layers.boxes.map((b) => b.median),
        q3: pd.layers.boxes.map((b) => b.q3), lowerfence: pd.layers.boxes.map((b) => b.lower), upperfence: pd.layers.boxes.map((b) => b.upper), marker: { color: COLORS[0] },
      }, { x: pd.layers.outliers.map((o) => o.group), y: pd.layers.outliers.map((o) => o.y), mode: "markers", marker: { color: COLORS[1] }, name: "outliers" }],
      layout: layout({ showlegend: false }),
    }),
    code: () => ({
      setup: `const bx = boxplotData({ a: [/* values */], b: [/* values */] });`,
      observable: `Plot.plot({ marks: [\n  Plot.ruleX(bx.layers.boxes, { x: "group", y1: "lower", y2: "upper" }),\n  Plot.barY(bx.layers.boxes, { x: "group", y1: "q1", y2: "q3", fillOpacity: 0.35 }),\n  Plot.tickY(bx.layers.boxes, { x: "group", y: "median" }),\n  Plot.dot(bx.layers.outliers, { x: "group", y: "y" }),\n] })`,
      plotly: `const b = fromRows(bx.layers.boxes);\nPlotly.newPlot("box", [{ type: "box", x: b.group, q1: b.q1, median: b.median, q3: b.q3, lowerfence: b.lower, upperfence: b.upper }]);`,
    }),
    checks: (L, pd, d, r) => [
      { label: "boxplot.stats per group (whiskers, hinges, median)", js: r.groups.flatMap((g) => { const b = pd.layers.boxes.find((x) => x.group === g); return [b.lower, b.q1, b.median, b.q3, b.upper]; }), r: r.stats.flat() },
      { label: "outliers", js: r.groups.flatMap((g) => pd.layers.outliers.filter((o) => o.group === g).map((o) => o.y)), r: r.out.flat() },
    ],
  },
  // ------------------------------------------------------------------ models
  {
    id: "lmdiag", section: "models", fns: ["lm", "lmDiagnosticsData"],
    title: { en: "Regression diagnostics (plot.lm's four panels)", ja: "回帰の診断図 (plot.lm の 4 枚)" },
    datasets: { mtcars: "mtcars (mpg ~ wt)", cars: "cars (dist ~ speed)" },
    csv: { columns: ["x", "y"], example: "x,y\n1,1.1\n2,1.9\n3,3.2\n4,3.9\n10,7\n6,5.5\n7,6.1" },
    fromCsv: (rows) => ({ x: rows.map((r) => num(r.x)), y: rows.map((r) => num(r.y)) }),
    compute: (L, d) => L.lmDiagnosticsData(L.lm(d.x, d.y)),
    panels: true,
    observable: (Plot, pd) => {
      const L = pd.layers;
      const panel = (title, xl, yl, pts, smooth, extra = [], opts = {}) => Plot.plot({
        width: 340, height: 260, title, grid: true, ...opts, x: { label: xl, ...opts.x }, y: { label: yl, ...opts.y },
        marks: [...extra, Plot.dot(pts, { x: "x", y: "y", r: 2.5, fill: COLORS[0] }), smooth ? Plot.line(smooth, { x: "x", y: "y", stroke: COLORS[1] }) : null,
          Plot.text(pts.filter((p) => p.extreme), { x: "x", y: "y", text: (p) => String(p.index + 1), dx: 8, fontSize: 10 })].filter(Boolean),
      });
      const wrap = document.createElement("div");
      wrap.className = "panel-grid";
      wrap.append(
        panel("Residuals vs Fitted", "Fitted values", "Residuals", L.residualsFitted, L.residualsFittedSmooth, [Plot.ruleY([0], { strokeDasharray: "3,3" })]),
        panel("Q-Q Residuals", "Theoretical quantiles", "Standardized residuals", L.qq, null, [Plot.line([{ x: -2.5, y: -2.5 }, { x: 2.5, y: 2.5 }], { x: "x", y: "y", strokeDasharray: "3,3" })]),
        panel("Scale-Location", "Fitted values", "√|standardized residuals|", L.scaleLocation, L.scaleLocationSmooth),
        panel("Residuals vs Leverage", "Leverage", "Standardized residuals", L.leverage, L.leverageSmooth, [Plot.line(L.cookContours, { x: "x", y: "y", z: (r) => `${r.level}${r.side}`, stroke: "gray", strokeDasharray: "4,3" })],
          { y: { domain: [Math.min(-3, ...L.leverage.map((p) => p.y)), Math.max(3, ...L.leverage.map((p) => p.y))] } }),
      );
      return wrap;
    },
    plotly: (pd) => {
      const L = pd.layers;
      const p = (pts, sm, ax, name) => [{ ...xy(pts), mode: "markers", marker: { color: COLORS[0], size: 5 }, xaxis: `x${ax}`, yaxis: `y${ax}`, name, showlegend: false },
        ...(sm ? [{ ...xy(sm), mode: "lines", line: { color: COLORS[1] }, xaxis: `x${ax}`, yaxis: `y${ax}`, showlegend: false }] : [])];
      return {
        data: [...p(L.residualsFitted, L.residualsFittedSmooth, "", "Residuals vs Fitted"), ...p(L.qq, null, 2, "Q-Q"), ...p(L.scaleLocation, L.scaleLocationSmooth, 3, "Scale-Location"), ...p(L.leverage, L.leverageSmooth, 4, "Leverage")],
        layout: layout({ grid: { rows: 2, columns: 2, pattern: "independent" }, height: 560, annotations: pd.meta.titles.map((t, i) => ({ text: t, xref: `x${i ? i + 1 : ""} domain`, yref: `y${i ? i + 1 : ""} domain`, x: 0.5, y: 1.12, showarrow: false })) }),
      };
    },
    code: (d) => ({
      setup: `const diag = lmDiagnosticsData(lm(${arr(d.x)}, ${arr(d.y)}));`,
      observable: `Plot.plot({ marks: [\n  Plot.ruleY([0]),\n  Plot.dot(diag.layers.residualsFitted, { x: "x", y: "y" }),\n  Plot.line(diag.layers.residualsFittedSmooth, { x: "x", y: "y", stroke: "red" }),\n] })`,
      plotly: `Plotly.newPlot("diag", [\n  { ...fromRows(diag.layers.residualsFitted), mode: "markers" },\n  { ...fromRows(diag.layers.residualsFittedSmooth), mode: "lines" },\n]);`,
    }),
    checks: (L, pd, d, r) => [
      { label: "leverages (hatvalues)", js: pd.layers.leverage.map((p) => p.x), r: r.hat },
      { label: "Cook's distances", js: pd.layers.leverage.map((p) => p.cooks), r: r.cooks },
      { label: "standardized residuals (rstandard)", js: pd.layers.qq.map((p) => p.y), r: r.rstandard },
      { label: "lowess smooth of the residuals", js: pd.layers.residualsFittedSmooth.map((p) => p.y), r: r.smooth, tol: 1e-12 },
    ],
  },
  {
    id: "band", section: "models", fns: ["lm", "predictionBandData", "coefPlotData"],
    title: { en: "Regression line with confidence and prediction bands", ja: "回帰直線と信頼帯・予測帯" },
    datasets: { mtcars: "mtcars (mpg ~ wt)", cars: "cars (dist ~ speed)" },
    csv: { columns: ["x", "y"], example: "x,y\n1,1.1\n2,1.9\n3,3.2\n4,3.9\n5,5.1\n6,5.5\n7,6.1" },
    fromCsv: (rows) => ({ x: rows.map((r) => num(r.x)), y: rows.map((r) => num(r.y)) }),
    compute: (L, d) => {
      const fit = L.lm(d.x, d.y);
      const lo = Math.min(...d.x), hi = Math.max(...d.x);
      const grid = Array.from({ length: 41 }, (_, i) => lo + ((hi - lo) * i) / 40);
      const b = L.predictionBandData(fit, grid);
      const c = L.coefPlotData(fit);
      return { layers: { band: b.layers.band, points: d.x.map((x, i) => ({ x, y: d.y[i] })), coefficients: c.layers.coefficients }, meta: { xLabel: d.xName ?? "x", yLabel: d.yName ?? "y" } };
    },
    observable: (Plot, pd) => Plot.plot({
      x: { label: pd.meta.xLabel }, y: { label: pd.meta.yLabel, grid: true },
      marks: [
        Plot.areaY(pd.layers.band, { x: "x", y1: "predLower", y2: "predUpper", fill: COLORS[0], fillOpacity: 0.12 }),
        Plot.areaY(pd.layers.band, { x: "x", y1: "confLower", y2: "confUpper", fill: COLORS[0], fillOpacity: 0.3 }),
        Plot.line(pd.layers.band, { x: "x", y: "fit", stroke: COLORS[0], strokeWidth: 2 }),
        Plot.dot(pd.layers.points, { x: "x", y: "y", r: 3, fill: COLORS[1] }),
      ],
    }),
    plotly: (pd) => {
      const b = pd.layers.band, xs = b.map((r) => r.x);
      return {
        data: [
          ...bandTraces(xs, b.map((r) => r.predLower), b.map((r) => r.predUpper), COLORS[0] + "22", "95% prediction band"),
          ...bandTraces(xs, b.map((r) => r.confLower), b.map((r) => r.confUpper), COLORS[0] + "55", "95% confidence band"),
          { x: xs, y: b.map((r) => r.fit), mode: "lines", line: { color: COLORS[0], width: 2 }, name: "fit" },
          { ...xy(pd.layers.points), mode: "markers", marker: { color: COLORS[1] }, name: "data" },
        ],
        layout: layout({ xaxis: { title: pd.meta.xLabel }, yaxis: { title: pd.meta.yLabel } }),
      };
    },
    table: (pd) => ({ title: "Coefficients with 95% confidence intervals", rows: pd.layers.coefficients }),
    code: (d) => ({
      setup: `const fit = lm(${arr(d.x)}, ${arr(d.y)});\nconst band = predictionBandData(fit, xs); // xs: a grid over x`,
      observable: `Plot.plot({ marks: [\n  Plot.areaY(band.layers.band, { x: "x", y1: "predLower", y2: "predUpper", fillOpacity: 0.12 }),\n  Plot.areaY(band.layers.band, { x: "x", y1: "confLower", y2: "confUpper", fillOpacity: 0.3 }),\n  Plot.line(band.layers.band, { x: "x", y: "fit" }),\n] })`,
      plotly: `const b = fromRows(band.layers.band);\nPlotly.newPlot("band", [\n  { x: b.x, y: b.confLower, mode: "lines", line: { width: 0 } },\n  { x: b.x, y: b.confUpper, mode: "lines", fill: "tonexty", line: { width: 0 } },\n  { x: b.x, y: b.fit, mode: "lines" },\n]);`,
    }),
    checks: (L, pd, d, r, rc) => {
      const fit = L.lm(d.x, d.y);
      const b = L.predictionBandData(fit, r.x).layers.band;
      return [
        { label: "fit and 95% confidence band at 5 points (predict)", js: b.flatMap((q) => [q.fit, q.confLower, q.confUpper]), r: r.x.flatMap((_, i) => [r.fit[i], r.confLower[i], r.confUpper[i]]) },
        { label: "95% prediction band at 5 points", js: b.flatMap((q) => [q.predLower, q.predUpper]), r: r.x.flatMap((_, i) => [r.predLower[i], r.predUpper[i]]) },
        { label: "coefficients and confint", js: pd.layers.coefficients.flatMap((c) => [c.estimate, c.lower, c.upper]), r: rc.estimate.flatMap((e, i) => [e, rc.lower[i], rc.upper[i]]) },
      ];
    },
    rKey: ["band", "coef"],
  },
  // ------------------------------------------------------------------ time series and multivariate
  {
    id: "acf", section: "ts", fns: ["acf", "acfPlotData"],
    title: { en: "Autocorrelation with its white-noise band", ja: "自己相関と白色雑音の帯" },
    datasets: { nile: "Nile (yearly flow)", usacc: "USAccDeaths (monthly)" },
    csv: { columns: ["y"], example: "y\n1\n3\n2\n5\n4\n6\n5\n8\n7\n9\n8\n10" },
    fromCsv: (rows) => ({ y: rows.map((r) => num(r.y)) }),
    compute: (L, d) => L.acfPlotData(L.acf(d.y)),
    observable: (Plot, pd) => Plot.plot({
      y: { label: pd.meta.yLabel, grid: true }, x: { label: pd.meta.xLabel },
      marks: [
        Plot.ruleY([0]),
        Plot.ruleY([pd.meta.clim, -pd.meta.clim], { stroke: COLORS[1], strokeDasharray: "4,3" }),
        Plot.ruleX(pd.layers.bars, { x: "lag", y1: 0, y2: "acf", strokeWidth: 2, stroke: COLORS[0] }),
      ],
    }),
    plotly: (pd) => ({
      data: [
        { x: pd.layers.bars.map((b) => b.lag), y: pd.layers.bars.map((b) => b.acf), type: "bar", width: 0.15, marker: { color: COLORS[0] }, name: "ACF" },
        { x: pd.layers.band.map((b) => b.lag), y: pd.layers.band.map((b) => b.upper), mode: "lines", line: { dash: "dash", color: COLORS[1] }, name: "95% band" },
        { x: pd.layers.band.map((b) => b.lag), y: pd.layers.band.map((b) => b.lower), mode: "lines", line: { dash: "dash", color: COLORS[1] }, showlegend: false },
      ],
      layout: layout({ xaxis: { title: "Lag" }, yaxis: { title: pd.meta.yLabel } }),
    }),
    code: (d) => ({
      setup: `const a = acfPlotData(acf(${arr(d.y)}));`,
      observable: `Plot.plot({ marks: [\n  Plot.ruleY([a.meta.clim, -a.meta.clim], { strokeDasharray: "4,3" }),\n  Plot.ruleX(a.layers.bars, { x: "lag", y1: 0, y2: "acf" }),\n] })`,
      plotly: `const b = fromRows(a.layers.bars);\nPlotly.newPlot("acf", [{ x: b.lag, y: b.acf, type: "bar" }]);`,
    }),
    checks: (L, pd, d, r) => [
      { label: "autocorrelations", js: pd.layers.bars.map((b) => b.acf), r: r.acf },
      { label: "band ±qnorm(0.975)/√n", js: [pd.meta.clim], r: [r.clim] },
    ],
  },
  {
    id: "forecast", section: "ts", fns: ["rwf", "snaive", "forecastPlotData"],
    title: { en: "Forecast fan with 80% and 95% intervals", ja: "予測の扇形 (80% と 95% の区間)" },
    datasets: { nile: "Nile with a random walk with drift (rwf)", usacc: "USAccDeaths with the seasonal naive method (snaive)" },
    csv: { columns: ["y"], example: "y\n1\n3\n2\n5\n4\n6\n5\n8\n7\n9\n8\n10" },
    fromCsv: (rows) => ({ y: rows.map((r) => num(r.y)), start: 1, frequency: 1 }),
    compute: (L, d) => {
      const fc = d.frequency > 1 ? L.snaive(d.y, { frequency: d.frequency, h: 2 * d.frequency }) : L.rwf(d.y, { h: 10, drift: true });
      return L.forecastPlotData(d.y, fc, { start: d.start ?? 1, frequency: d.frequency ?? 1 });
    },
    observable: (Plot, pd) => Plot.plot({
      y: { grid: true }, x: { label: "time" },
      marks: [
        ...pd.meta.levels.slice().sort((a, b) => b - a).map((lv, i) => Plot.areaY(pd.layers.intervals.filter((r) => r.level === lv), { x: "x", y1: "lower", y2: "upper", fill: COLORS[0], fillOpacity: 0.15 + 0.2 * i })),
        Plot.line(pd.layers.history, { x: "x", y: "y" }),
        Plot.line(pd.layers.mean, { x: "x", y: "y", stroke: COLORS[0], strokeWidth: 2 }),
      ],
    }),
    plotly: (pd) => ({
      data: [
        { ...xy(pd.layers.history), mode: "lines", line: { color: "#555" }, name: "series" },
        ...pd.meta.levels.slice().sort((a, b) => b - a).flatMap((lv, i) => {
          const iv = pd.layers.intervals.filter((r) => r.level === lv);
          return bandTraces(iv.map((r) => r.x), iv.map((r) => r.lower), iv.map((r) => r.upper), i ? COLORS[0] + "66" : COLORS[0] + "33", `${lv}%`);
        }),
        { ...xy(pd.layers.mean), mode: "lines", line: { color: COLORS[0], width: 2 }, name: "forecast" },
      ],
      layout: layout({ title: { text: pd.meta.title, font: { size: 13 } } }),
    }),
    code: (d) => ({
      setup: d.frequency > 1
        ? `const y = ${arr(d.y)};\nconst fan = forecastPlotData(y, snaive(y, { frequency: ${d.frequency}, h: ${2 * d.frequency} }), { start: ${d.start}, frequency: ${d.frequency} });`
        : `const y = ${arr(d.y)};\nconst fan = forecastPlotData(y, rwf(y, { h: 10, drift: true }), { start: ${d.start ?? 1} });`,
      observable: `Plot.plot({ marks: [\n  Plot.areaY(fan.layers.intervals.filter((r) => r.level === 95), { x: "x", y1: "lower", y2: "upper", fillOpacity: 0.2 }),\n  Plot.areaY(fan.layers.intervals.filter((r) => r.level === 80), { x: "x", y1: "lower", y2: "upper", fillOpacity: 0.35 }),\n  Plot.line(fan.layers.history, { x: "x", y: "y" }),\n  Plot.line(fan.layers.mean, { x: "x", y: "y", stroke: "steelblue" }),\n] })`,
      plotly: `Plotly.newPlot("fan", [\n  { ...fromRows(fan.layers.history), mode: "lines" },\n  { ...fromRows(fan.layers.mean), mode: "lines" },\n]);`,
    }),
    checks: (L, pd, d, r) => [
      { label: `point forecasts (${r.method})`, js: pd.layers.mean.map((m) => m.y), r: r.mean },
      { label: "95% interval", js: pd.layers.intervals.filter((i) => i.level === 95).flatMap((i) => [i.lower, i.upper]), r: r.mean.flatMap((_, i) => [r.lower95[i], r.upper95[i]]) },
    ],
  },
  {
    id: "dendrogram", section: "ts", fns: ["dist", "hclust", "dendrogramData"],
    title: { en: "Dendrogram of a hierarchical clustering", ja: "階層クラスタリングの樹形図" },
    datasets: { usarrests: "USArrests (scaled, average linkage)" },
    csv: { columns: ["label", "x1", "x2", "…"], example: "label,a,b\np,1,2\nq,2,3.5\nr,6,3\ns,7,6\nt,15,5.5" },
    fromCsv: (rows) => {
      const cols = Object.keys(rows[0] ?? {}).filter((k) => k !== "label");
      return { rows: rows.map((r) => cols.map((c) => num(r[c]))), labels: rows.map((r, i) => String(r.label ?? i + 1)), columns: cols };
    },
    compute: (L, d) => {
      const z = L.scale(d.rows).scaled;
      const hc = L.hclust(L.dist(z), { method: "average" });
      return L.dendrogramData({ ...hc, labels: d.labels });
    },
    observable: (Plot, pd) => Plot.plot({
      height: 420, marginBottom: 110, x: { axis: null }, y: { label: pd.meta.yLabel, grid: true },
      marks: [
        Plot.link(pd.layers.segments, { x1: "x1", y1: "y1", x2: "x2", y2: "y2", stroke: COLORS[0] }),
        Plot.text(pd.layers.leaves, { x: "x", y: "y", text: "label", rotate: -90, textAnchor: "end", dy: 0, dx: -4, fontSize: 9 }),
      ],
    }),
    plotly: (pd) => ({
      data: pd.layers.segments.map((s) => ({ x: [s.x1, s.x2], y: [s.y1, s.y2], mode: "lines", line: { color: COLORS[0] }, hoverinfo: "skip", showlegend: false })),
      layout: layout({ height: 440, xaxis: { tickvals: pd.layers.leaves.map((l) => l.x), ticktext: pd.layers.leaves.map((l) => l.label), tickangle: -90 }, yaxis: { title: "Height" }, margin: { l: 60, r: 20, t: 30, b: 120 } }),
    }),
    code: () => ({
      setup: `const tree = dendrogramData(hclust(dist(scale(rows).scaled), { method: "average" }));`,
      observable: `Plot.plot({ x: { axis: null }, marks: [\n  Plot.link(tree.layers.segments, { x1: "x1", y1: "y1", x2: "x2", y2: "y2" }),\n  Plot.text(tree.layers.leaves, { x: "x", y: "y", text: "label", rotate: -90, textAnchor: "end" }),\n] })`,
      plotly: `Plotly.newPlot("tree", tree.layers.segments.map((s) => ({ x: [s.x1, s.x2], y: [s.y1, s.y2], mode: "lines" })));`,
    }),
    checks: (L, pd, d, r) => [
      { label: "merge heights", js: pd.layers.nodes.map((n) => n.y), r: r.height },
      { label: "leaf order (1-based)", js: pd.layers.leaves.map((l) => l.index), r: r.order },
    ],
  },
  {
    id: "biplot", section: "ts", fns: ["prcomp", "biplotData"],
    title: { en: "Biplot of principal components", ja: "主成分のバイプロット" },
    datasets: { usarrests: "USArrests (scaled)" },
    csv: { columns: ["label", "x1", "x2", "…"], example: "label,a,b,c\np,1,2,0.5\nq,2,3.5,1.1\nr,6,3,0.2\ns,7,6,1.9\nt,15,5.5,0.7" },
    fromCsv: (rows) => {
      const cols = Object.keys(rows[0] ?? {}).filter((k) => k !== "label");
      return { rows: rows.map((r) => cols.map((c) => num(r[c]))), labels: rows.map((r, i) => String(r.label ?? i + 1)), columns: cols };
    },
    compute: (L, d) => {
      const p = L.prcomp(d.rows, { scale: true });
      const b = L.biplotData(p, { variableNames: d.columns });
      const obs = b.layers.observations.map((o) => ({ ...o, label: d.labels[o.index - 1] }));
      // the arrows share the observations' axes, scaled to fit (R's biplot draws them on axes of their own)
      const k = (0.8 * Math.max(...obs.map((o) => Math.hypot(o.x, o.y)))) / Math.max(...b.layers.variables.map((v) => Math.hypot(v.x, v.y)));
      return { layers: { observations: obs, variables: b.layers.variables.map((v) => ({ ...v, xs: v.x * k, ys: v.y * k })) }, meta: { ...b.meta, sdev: p.sdev, rotation: p.rotation } };
    },
    observable: (Plot, pd) => Plot.plot({
      aspectRatio: 1, x: { label: pd.meta.xLabel, grid: true }, y: { label: pd.meta.yLabel, grid: true },
      marks: [
        Plot.text(pd.layers.observations, { x: "x", y: "y", text: "label", fontSize: 8, fill: "gray" }),
        Plot.arrow(pd.layers.variables, { x1: 0, y1: 0, x2: "xs", y2: "ys", stroke: COLORS[1], strokeWidth: 1.5 }),
        Plot.text(pd.layers.variables, { x: "xs", y: "ys", text: "variable", fill: COLORS[1], dy: -8, fontWeight: "bold" }),
      ],
    }),
    plotly: (pd) => ({
      data: [
        { ...xy(pd.layers.observations), mode: "text", text: pd.layers.observations.map((o) => o.label), textfont: { size: 9, color: "gray" }, name: "observations" },
        ...pd.layers.variables.map((v) => ({ x: [0, v.xs], y: [0, v.ys], mode: "lines+text", text: ["", v.variable], textposition: "top center", line: { color: COLORS[1] }, showlegend: false })),
      ],
      layout: layout({ xaxis: { title: pd.meta.xLabel }, yaxis: { title: pd.meta.yLabel, scaleanchor: "x" } }),
    }),
    code: () => ({
      setup: `const bp = biplotData(prcomp(rows, { scale: true }), { variableNames });`,
      observable: `Plot.plot({ aspectRatio: 1, marks: [\n  Plot.dot(bp.layers.observations, { x: "x", y: "y" }),\n  Plot.arrow(bp.layers.variables, { x1: 0, y1: 0, x2: "x", y2: "y" }), // on axes of their own in R\n] })`,
      plotly: `Plotly.newPlot("bp", [{ ...fromRows(bp.layers.observations), mode: "markers" }]);`,
    }),
    checks: (L, pd, d, r) => [
      { label: "component standard deviations (prcomp)", js: pd.meta.sdev, r: r.sdev },
      { label: "|loadings| of PC1 and PC2", js: pd.meta.rotation.flatMap((row) => [Math.abs(row[0]), Math.abs(row[1])]), r: r.absRotation.flat() },
    ],
  },
];

function xy(rows) {
  return { x: rows.map((r) => r.x), y: rows.map((r) => r.y) };
}

export const SECTIONS = {
  survival: { en: "Survival and ROC", ja: "生存時間と ROC" },
  meta: { en: "Meta-analysis", ja: "メタ分析" },
  dist: { en: "Distributions", ja: "分布" },
  models: { en: "Models", ja: "モデル" },
  ts: { en: "Time series and multivariate", ja: "時系列と多変量" },
};

/** The inputs of a figure from the example data (demo/plot-data.json) */
export function exampleInput(fig, data, datasetId) {
  const d = data.datasets[datasetId];
  if (fig.id === "km") return { ...d, riskTimes: data.r.km[datasetId]?.times };
  return { ...d };
}

/** R's values of a figure for a dataset (one object, or several when the figure has rKey) */
export function rValues(fig, data, datasetId) {
  const keys = fig.rKey ?? [fig.id === "km" ? "km" : fig.id];
  return keys.map((k) => data.r[k]?.[datasetId]);
}

/** The checks with their largest relative difference and whether it is within the tolerance */
export function runChecks(L, fig, pd, input, data, datasetId) {
  const rv = rValues(fig, data, datasetId);
  if (rv.some((v) => v === undefined)) return [];
  return fig.checks(L, pd, input, ...rv).map((c) => {
    const tol = c.tol ?? 1e-9;
    // R's NA (null in JSON, as timepoints after a curve's last time) is not compared
    const js = c.js.map(Number), r = [].concat(c.r).map((v) => (v == null ? NaN : Number(v)));
    let worst = js.length === r.length ? 0 : Infinity;
    js.forEach((v, i) => {
      const e = r[i];
      if (Number.isNaN(e)) return;
      const d = Math.abs(v - e) / Math.max(Math.abs(e), 1e-300);
      worst = Math.max(worst, v === e ? 0 : Number.isNaN(d) ? Infinity : Math.abs(e) < 1e-12 ? Math.abs(v - e) : d);
    });
    return { label: c.label, js, r, worst, ok: worst <= tol };
  });
}

/** Japanese for the labels of the checks and of the extra tables (English is the key) */
export const LABELS_JA = {
  "S(t) at the risk-table times, by group": "リスク表の時刻の S(t) (群ごと)",
  "number at risk": "リスク集合の大きさ (number at risk)",
  "estimates at the time points (timepoints)": "時点ごとの推定値 (timepoints)",
  "AUC": "AUC",
  "largest Youden index (sensitivity + specificity − 1)": "最大の Youden 指数 (感度 + 特異度 − 1)",
  "study intervals (lower)": "研究ごとの区間 (下限)",
  "study intervals (upper)": "研究ごとの区間 (上限)",
  "random-effects weights (%)": "変量効果の重み (%)",
  "common and random effects estimates": "共通効果と変量効果の推定値",
  "random-effects interval": "変量効果の区間",
  "tau² and I² (REML at the maximum)": "tau² と I² (REML、最大点まで)",
  "reference line (common effect)": "基準の線 (共通効果)",
  "95% region at the largest standard error": "最大の標準誤差での 95% 域",
  "studies per direct comparison": "直接比較ごとの研究の数",
  "theoretical quantiles of the first 5 values": "最初の 5 個の値の理論分位点",
  "qqline: intercept and slope": "qqline の切片と傾き",
  "bandwidth (bw.nrd0)": "帯域幅 (bw.nrd0)",
  "density at 5 of the 512 points": "512 点のうち 5 点での密度",
  "histogram counts (Sturges)": "ヒストグラムの度数 (Sturges)",
  "Fn at the 10%, 50% and 90% quantiles": "10%・50%・90% 分位点での Fn",
  "boxplot.stats per group (whiskers, hinges, median)": "群ごとの boxplot.stats (ひげ・ヒンジ・中央値)",
  "outliers": "外れ値",
  "leverages (hatvalues)": "てこ比 (hatvalues)",
  "Cook's distances": "Cook の距離",
  "standardized residuals (rstandard)": "標準化残差 (rstandard)",
  "lowess smooth of the residuals": "残差の lowess 平滑線",
  "fit and 95% confidence band at 5 points (predict)": "5 点での当てはめ値と 95% 信頼帯 (predict)",
  "95% prediction band at 5 points": "5 点での 95% 予測帯",
  "coefficients and confint": "係数と confint",
  "autocorrelations": "自己相関",
  "band ±qnorm(0.975)/√n": "帯 ±qnorm(0.975)/√n",
  "95% interval": "95% 区間",
  "merge heights": "併合の高さ",
  "leaf order (1-based)": "葉の順序 (1 から)",
  "component standard deviations (prcomp)": "主成分の標準偏差 (prcomp)",
  "|loadings| of PC1 and PC2": "PC1 と PC2 の負荷量の絶対値",
  "Risk table (number at risk)": "リスク表 (number at risk)",
  "Studies (weights in %)": "研究 (重みは %)",
  "Direct comparisons": "直接比較",
  "Coefficients with 95% confidence intervals": "係数と 95% 信頼区間",
};

/** A label in the current language */
export function labelIn(text, lang) {
  if (lang !== "ja") return text;
  if (LABELS_JA[text]) return LABELS_JA[text];
  const m = /^point forecasts \((.+)\)$/.exec(text);
  return m ? `点予測 (${m[1]})` : text;
}
