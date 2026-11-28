// Plots tab (from 1.21.0): the plot data of rStats.js/plot drawn with Observable Plot or Plotly.js (loaded from
// jsDelivr when the tab is first shown; demo/plotLibs.js), for 16 figures (demo/plotFigures.js) on R's example data
// (demo/plot-data.json) or the user's CSV, with the values compared with R, the rows of each layer (with JSON and
// CSV downloads) and the code that draws the same figure.

import { getLang, t } from "./i18n.js";
import { plot as svgPlot } from "./plot.js";
import { codeBlock, errorBox, h, setChildren } from "./util.js";
import { FIGURES, SECTIONS, exampleInput, labelIn, runChecks } from "./plotFigures.js";
import { loadObservablePlot, loadPlotly } from "./plotLibs.js";

const CSV = "csv";
const MAX_ROWS = 200;

/** A small CSV parser: a header line, comma-separated values, numbers where they parse */
export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) throw new Error(t("plots.csvEmpty"));
  const cols = lines[0].split(",").map((c) => c.trim());
  return lines.slice(1).map((l) => {
    const v = l.split(",").map((c) => c.trim());
    return Object.fromEntries(cols.map((c, i) => [c, v[i] !== undefined && v[i] !== "" && !Number.isNaN(Number(v[i])) ? Number(v[i]) : v[i] ?? ""]));
  });
}

/** Rows as CSV text */
function toCsv(rows) {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v) => (typeof v === "string" && /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v));
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
}

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h("a", { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const fmtNum = (v) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : Number(v.toPrecision(10)).toString()) : String(v));

export function createPlotsTab(ctx) {
  const { lib } = ctx;
  let data = null; // demo/plot-data.json
  let fig = FIGURES[0];
  let library = "observable";
  let dataset = Object.keys(fig.datasets)[0];
  let csvText = fig.csv.example;
  let layer = null;
  let started = false;
  let current = null; // { pd, input }

  const err = errorBox("plots-error");
  const libStatus = h("p", { class: "hint", "data-testid": "plots-lib-status", "aria-live": "polite" });
  const figureEl = h("div", { class: "plot-figure", "data-testid": "plots-figure" });
  const checksEl = h("div", { "data-testid": "plots-checks" });
  const extraEl = h("div", { "data-testid": "plots-extra" });
  const rowsEl = h("div", { "data-testid": "plots-rows" });
  const codeObs = codeBlock("js", "plots.observable", "plots-code-observable");
  const codePly = codeBlock("js", "plots.plotly", "plots-code-plotly");
  const titleEl = h("h2", { class: "card-title", "data-testid": "plots-title" });
  const fnsEl = h("p", { class: "hint", "data-testid": "plots-fns" });

  // ---- controls
  const libButtons = ["observable", "plotly"].map((v) =>
    h("button", { type: "button", class: "seg-btn", "data-value": v, "data-testid": `plots-lib-${v}`, text: v === "observable" ? "Observable Plot" : "Plotly.js",
      on: { click: () => { library = v; render(); } } }));
  const datasetSelect = h("select", { "data-testid": "plots-dataset", on: { change: (e) => { dataset = e.target.value; render(); } } });
  const csvArea = h("textarea", { "data-testid": "plots-csv", rows: 6, class: "csv-input", spellcheck: "false",
    on: { input: (e) => { csvText = e.target.value; render(); } } });
  const csvHint = h("p", { class: "hint", "data-testid": "plots-csv-columns" });
  const csvBox = h("div", { class: "field field-wide" }, h("label", { i18n: "plots.csvLabel" }), csvHint, csvArea);
  const layerSelect = h("select", { "data-testid": "plots-layer", on: { change: (e) => { layer = e.target.value; renderRows(); } } });
  const dlJson = h("button", { type: "button", class: "btn btn-small", "data-testid": "plots-download-json", text: "JSON",
    on: { click: () => current && download(`${fig.id}-${layer}.json`, JSON.stringify(current.pd.layers[layer], null, 2), "application/json") } });
  const dlCsv = h("button", { type: "button", class: "btn btn-small", "data-testid": "plots-download-csv", text: "CSV",
    on: { click: () => current && download(`${fig.id}-${layer}.csv`, toCsv(current.pd.layers[layer]), "text/csv") } });

  const nav = h("nav", { class: "plot-nav", "aria-label": "figures" },
    Object.entries(SECTIONS).map(([sid, name]) => h("div", { class: "plot-nav-section" },
      h("h3", { class: "sub-heading", text: name.en, dataset: { sectionEn: name.en, sectionJa: name.ja } }),
      FIGURES.filter((f) => f.section === sid).map((f) => h("button", { type: "button", class: "plot-nav-btn", "data-testid": `plots-fig-${f.id}`, "data-id": f.id,
        on: { click: () => selectFigure(f.id) } })))));

  function selectFigure(id) {
    fig = FIGURES.find((f) => f.id === id);
    dataset = Object.keys(fig.datasets)[0];
    csvText = fig.csv.example;
    layer = null;
    render();
  }

  function labels() {
    const ja = getLang() === "ja";
    for (const b of nav.querySelectorAll(".plot-nav-btn")) {
      const f = FIGURES.find((x) => x.id === b.dataset.id);
      b.textContent = ja ? f.title.ja : f.title.en;
      b.setAttribute("aria-pressed", String(f === fig));
    }
    for (const s of nav.querySelectorAll("h3[data-section-en]")) s.textContent = ja ? s.dataset.sectionJa : s.dataset.sectionEn;
    for (const b of libButtons) b.setAttribute("aria-pressed", String(b.dataset.value === library));
    titleEl.textContent = ja ? fig.title.ja : fig.title.en;
    fnsEl.textContent = `${t("plots.functions")}: ${fig.fns.join(", ")}`;
  }

  function input() {
    if (dataset !== CSV) return exampleInput(fig, data, dataset);
    return fig.fromCsv(parseCsv(csvText));
  }

  async function render() {
    labels();
    setChildren(datasetSelect, [...Object.entries(fig.datasets).map(([k, v]) => h("option", { value: k, text: v })), h("option", { value: CSV, text: t("plots.yourData") })]);
    datasetSelect.value = dataset;
    csvBox.hidden = dataset !== CSV;
    csvHint.textContent = `${t("plots.csvColumns")}: ${fig.csv.columns.join(", ")}`;
    if (csvArea.value !== csvText) csvArea.value = csvText;
    err.clear();
    if (!data || !started) return;
    let d, pd;
    try {
      d = input();
      pd = fig.compute(lib, d);
    } catch (e) {
      err.show(e);
      current = null;
      setChildren(figureEl);
      setChildren(checksEl);
      setChildren(rowsEl);
      return;
    }
    current = { pd, input: d };
    renderChecks();
    renderExtra();
    renderCode();
    if (!layer || !(layer in pd.layers)) layer = Object.keys(pd.layers)[0];
    setChildren(layerSelect, Object.keys(pd.layers).map((k) => h("option", { value: k, text: `${k} (${pd.layers[k].length})` })));
    layerSelect.value = layer;
    renderRows();
    await draw();
  }

  async function draw() {
    const { pd, input: d } = current;
    const which = library;
    figureEl.dataset.library = which;
    figureEl.dataset.state = "loading";
    libStatus.textContent = t("plots.loading", which === "observable" ? "Observable Plot" : "Plotly.js");
    try {
      if (which === "observable") {
        const Plot = await loadObservablePlot();
        if (library !== which || current?.pd !== pd) return;
        setChildren(figureEl, fig.observable(Plot, pd, d));
      } else {
        const Plotly = await loadPlotly();
        if (library !== which || current?.pd !== pd) return;
        const div = h("div", { class: "plotly-box" });
        setChildren(figureEl, div);
        const { data: traces, layout } = fig.plotly(pd, d);
        await Plotly.newPlot(div, traces, layout, { responsive: true, displaylogo: false });
      }
      libStatus.textContent = "";
      figureEl.dataset.state = "drawn";
    } catch (e) {
      // the library could not be loaded (offline, blocked): the demo's own SVG of the layers with x and y
      libStatus.textContent = t("plots.libFailed", e.message);
      figureEl.dataset.state = "fallback";
      setChildren(figureEl, fallback(pd));
    }
  }

  function fallback(pd) {
    const series = Object.entries(pd.layers)
      .filter(([, rows]) => rows.length && typeof rows[0].x === "number" && typeof rows[0].y === "number")
      .slice(0, 3)
      .map(([k, rows], i) => ({ type: k === "steps" ? "step" : rows.length > 60 ? "line" : "points", points: rows.map((r) => [r.x, r.y]), className: `series-${(i % 2) + 1}` }));
    if (series.length === 0) return h("p", { class: "hint", text: t("plots.noFallback") });
    const xs = series.flatMap((s) => s.points.map((p) => p[0])).filter(Number.isFinite), ys = series.flatMap((s) => s.points.map((p) => p[1])).filter(Number.isFinite);
    return svgPlot({ series, xDomain: [Math.min(...xs), Math.max(...xs)], yDomain: [Math.min(...ys), Math.max(...ys)], testid: "plots-fallback" });
  }

  function renderChecks() {
    if (dataset === CSV) {
      setChildren(checksEl, h("p", { class: "hint", i18n: "plots.noChecks" }));
      return;
    }
    const checks = runChecks(lib, fig, current.pd, current.input, data, dataset);
    const allOk = checks.every((c) => c.ok);
    setChildren(checksEl,
      h("h4", { class: "sub-heading", i18n: "plots.checks" }),
      h("p", { class: allOk ? "hint ok" : "hint ng", "data-testid": "plots-checks-summary", "data-ok": String(allOk), "data-count": String(checks.length),
        text: t(allOk ? "plots.checksOk" : "plots.checksNg", checks.filter((c) => c.ok).length, checks.length) }),
      h("div", { class: "table-wrap" }, h("table", { class: "data-table compact" },
        h("thead", {}, h("tr", {}, [t("plots.value"), "rStats.js", "R", t("plots.relDiff"), ""].map((x) => h("th", { text: x })))),
        h("tbody", {}, checks.map((c) => h("tr", { class: c.ok ? "status-ok" : "status-fail", "data-testid": "plots-check-row" },
          h("th", { scope: "row", text: labelIn(c.label, getLang()) }),
          h("td", { text: c.js.slice(0, 4).map(fmtNum).join(", ") + (c.js.length > 4 ? ", …" : "") }),
          h("td", { text: c.r.slice(0, 4).map(fmtNum).join(", ") + (c.r.length > 4 ? ", …" : "") }),
          h("td", { text: c.worst === 0 ? "0" : c.worst.toExponential(1) }),
          h("td", { text: c.ok ? "✓" : "✗" }))))),
      ));
  }

  function renderExtra() {
    const tb = fig.table?.(current.pd);
    if (!tb || tb.rows.length === 0) {
      setChildren(extraEl);
      return;
    }
    const cols = Object.keys(tb.rows[0]);
    setChildren(extraEl, h("h4", { class: "sub-heading", text: labelIn(tb.title, getLang()) }),
      h("div", { class: "table-wrap" }, h("table", { class: "data-table compact", "data-testid": "plots-extra-table" },
        h("thead", {}, h("tr", {}, cols.map((c) => h("th", { text: c })))),
        h("tbody", {}, tb.rows.slice(0, MAX_ROWS).map((r) => h("tr", {}, cols.map((c) => h("td", { text: fmtNum(r[c]) }))))))));
  }

  function renderRows() {
    if (!current) return;
    const rows = current.pd.layers[layer] ?? [];
    const cols = rows.length ? Object.keys(rows[0]) : [];
    setChildren(rowsEl,
      h("div", { class: "rows-head" }, h("label", { i18n: "plots.layer" }), layerSelect, h("span", { class: "hint", i18n: "plots.download" }), dlJson, dlCsv),
      h("div", { class: "table-wrap rows-wrap" }, h("table", { class: "data-table compact", "data-testid": "plots-rows-table" },
        h("thead", {}, h("tr", {}, cols.map((c) => h("th", { text: c })))),
        h("tbody", {}, rows.slice(0, MAX_ROWS).map((r) => h("tr", {}, cols.map((c) => h("td", { text: fmtNum(r[c]) }))))))),
      rows.length > MAX_ROWS ? h("p", { class: "hint", text: t("plots.moreRows", MAX_ROWS, rows.length) }) : null);
  }

  function renderCode() {
    const code = fig.code(current.input);
    const imp = ctx.importLine([...fig.fns, "fromRows"]);
    codeObs.set([imp, 'const Plot = await import("https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.19/+esm");', code.setup, `document.body.append(${code.observable});`].join("\n"));
    codePly.set([imp, "// <script src=\"https://cdn.jsdelivr.net/npm/plotly.js-dist-min@4.3.0/plotly.min.js\"></script>", code.setup, code.plotly].join("\n"));
  }

  const controls = h("div", { class: "plot-controls" },
    h("div", { class: "field" }, h("label", { i18n: "plots.library" }), h("div", { class: "segmented", role: "group" }, libButtons)),
    h("div", { class: "field" }, h("label", { i18n: "plots.data" }), datasetSelect),
    csvBox);
  const el = h("div", { class: "tab-body plots-tab" },
    h("div", { class: "card plots-intro" }, h("h2", { class: "card-title", i18n: "tab.plots" }), h("p", { class: "hint", i18n: "plots.intro" })),
    h("div", { class: "plots-layout" },
      h("div", { class: "card plot-nav-card" }, nav),
      h("div", { class: "card result-card" }, titleEl, fnsEl, controls, err.el, libStatus, figureEl, extraEl, checksEl,
        h("h4", { class: "sub-heading", i18n: "plots.rows" }), rowsEl,
        h("h4", { class: "sub-heading", i18n: "plots.code" }), codeObs.el, codePly.el)));

  // the libraries are loaded when the tab is first shown
  const start = () => {
    if (started) return;
    started = true;
    render();
  };
  new IntersectionObserver((entries, obs) => {
    if (entries.some((e) => e.isIntersecting)) {
      obs.disconnect();
      start();
    }
  }).observe(figureEl);
  fetch("plot-data.json")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`plot-data.json: ${r.status}`))))
    .then((j) => {
      data = j;
      render();
    })
    .catch((e) => err.show(e));
  labels();
  return { el, update: () => render() };
}
