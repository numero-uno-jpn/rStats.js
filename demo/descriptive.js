// Descriptive statistics tab: summaries of one sample (and of a pair), quantiles of every type, histogram and ECDF.

import { t } from "./i18n.js";
import { plot } from "./plot.js";
import { codePanel, debounce, errorBox, field, fmt, h, jsArr, parseNumbers, rVec, setChildren, table, textInput } from "./util.js";
import { exampleSection } from "./examples.js";

const X = "2.5, 3.1, 4.7, 1.8, 5.2, 3.3, 2.9, 4.1, 3.3, 6.8";
const Y = "1.2, 2.8, 4.1, 1.1, 4.9, 2.7, 3.3, 3.6, 3.0, 5.9";

/** [label, js call, R call, value(lib, x)]: one row of the summary table */
const SUMMARIES = [
  ["sum", "sum(x)", "sum(x)", (l, x) => l.sum(x)],
  ["mean", "mean(x)", "mean(x)", (l, x) => l.mean(x)],
  ["mean, trim 0.1", "mean(x, { trim: 0.1 })", "mean(x, trim = 0.1)", (l, x) => l.mean(x, { trim: 0.1 })],
  ["median", "median(x)", "median(x)", (l, x) => l.median(x)],
  ["variance", "variance(x)", "var(x)", (l, x) => l.variance(x)],
  ["sd", "sd(x)", "sd(x)", (l, x) => l.sd(x)],
  ["IQR", "IQR(x)", "IQR(x)", (l, x) => l.IQR(x)],
  ["mad", "mad(x)", "mad(x)", (l, x) => l.mad(x)],
  ["skewness", "skewness(x)", "e1071::skewness(x)", (l, x) => l.skewness(x)],
  ["kurtosis", "kurtosis(x)", "e1071::kurtosis(x)", (l, x) => l.kurtosis(x)],
  ["geometricMean", "geometricMean(x)", "DescTools::Gmean(x)", (l, x) => l.geometricMean(x)],
  ["cv", "cv(x)", "DescTools::CoefVar(x)", (l, x) => l.cv(x)],
  ["meanAD", "meanAD(x)", "DescTools::MeanAD(x)", (l, x) => l.meanAD(x)],
  ["prod", "prod(x)", "prod(x)", (l, x) => l.prod(x)],
];
const VECTORS = [
  ["range", "range(x)", "range(x)", (l, x) => l.range(x)],
  ["fivenum", "fivenum(x)", "fivenum(x)", (l, x) => l.fivenum(x)],
  ["modes", "modes(x).value", "DescTools::Mode(x)", (l, x) => l.modes(x).value],
  ["rank", "rank(x)", "rank(x)", (l, x) => l.rank(x)],
  ["cumsum", "cumsum(x)", "cumsum(x)", (l, x) => l.cumsum(x)],
  ["diff", "diff(x)", "diff(x)", (l, x) => l.diff(x)],
  ["scale", "scale(x).scaled.flat()", "c(scale(x))", (l, x) => l.scale(x).scaled.flat()],
];
const PAIR = [
  ["cov", "cov(x, y)", "cov(x, y)", (l, x, y) => l.cov(x, y)],
  ["cor (pearson)", "cor(x, y)", "cor(x, y)", (l, x, y) => l.cor(x, y)],
  ["cor (kendall)", "cor(x, y, { method: \"kendall\" })", "cor(x, y, method = \"kendall\")", (l, x, y) => l.cor(x, y, { method: "kendall" })],
  ["cor (spearman)", "cor(x, y, { method: \"spearman\" })", "cor(x, y, method = \"spearman\")", (l, x, y) => l.cor(x, y, { method: "spearman" })],
  ["weightedMean(x, y)", "weightedMean(x, y)", "weighted.mean(x, y)", (l, x, y) => l.weightedMean(x, y)],
];

const safe = (f) => {
  try {
    return f();
  } catch (e) {
    return e;
  }
};
const show = (v) => (v instanceof Error ? v.message : Array.isArray(v) ? v.map(fmt).join(", ") : fmt(v));

export function createDescriptiveTab(ctx) {
  const { lib } = ctx;
  const err = errorBox("desc-error");
  const output = h("div", { class: "output", "data-testid": "desc-output" });
  const plots = h("div", { class: "plots", "data-testid": "desc-plots" });
  const code = codePanel("desc-code");
  const run = debounce(update, 150);
  const xInput = textInput({ value: X, testid: "desc-x", inputmode: "decimal", onInput: run });
  const yInput = textInput({ value: Y, testid: "desc-y", inputmode: "decimal", onInput: run });
  const pInput = textInput({ value: "0.1, 0.25, 0.5, 0.9", testid: "desc-probs", inputmode: "decimal", onInput: run });

  function update() {
    err.clear();
    try {
      const x = parseNumbers(xInput.value);
      const ys = yInput.value.trim() ? parseNumbers(yInput.value) : null;
      const probs = parseNumbers(pInput.value);
      const rows = SUMMARIES.map(([label, , , f]) => [label, show(safe(() => f(lib, x)))]);
      const vrows = VECTORS.map(([label, , , f]) => [label, show(safe(() => f(lib, x)))]);
      const prows = ys ? PAIR.map(([label, , , f]) => [label, show(safe(() => f(lib, x, ys)))]) : [];
      const qrows = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((type) => [String(type), ...lib.quantile(x, probs, { type }).map(fmt)]);
      setChildren(
        output,
        h("h4", { class: "sub-heading", i18n: "desc.summaries" }),
        table([t("desc.statistic"), t("desc.value")], [...rows, ...vrows, ...prows], { testid: "desc-table", className: "data-table kv" }),
        h("h4", { class: "sub-heading", i18n: "desc.quantiles" }),
        table(["type", ...probs.map(fmt)], qrows, { testid: "desc-quantiles", className: "data-table compact" }),
      );
      const all = [...SUMMARIES, ...VECTORS, ...(ys ? PAIR : [])];
      const names = [...new Set(all.flatMap(([, js]) => js.match(/^[A-Za-z]+/g)).concat(["quantile", "hist", "ecdf"]))];
      code.set(
        [`x <- ${rVec(x)}`, ys && `y <- ${rVec(ys)}`, ...all.map(([, , r]) => `print(${r}, digits = 17)`), `print(sapply(1:9, function(type) quantile(x, ${rVec(probs)}, type = type, names = FALSE)), digits = 17)`, `hist(x, plot = FALSE)$counts`]
          .filter(Boolean)
          .join("\n"),
        [`${ctx.importLine(names)}`, `const x = ${jsArr(x)};`, ys && `const y = ${jsArr(ys)};`, ...all.map(([, js]) => `${js};`), `[1, 2, 3, 4, 5, 6, 7, 8, 9].map((type) => quantile(x, ${jsArr(probs)}, { type }));`, "hist(x).counts;"]
          .filter(Boolean)
          .join("\n"),
      );
      setChildren(plots, histPlot(x), ecdfPlot(x));
    } catch (e) {
      err.show(e);
      setChildren(output);
      setChildren(plots);
    }
  }

  function histPlot(x) {
    const hs = lib.hist(x);
    const pts = hs.mids.map((m, i) => [m, hs.counts[i]]);
    const w = hs.breaks[1] - hs.breaks[0];
    return plot({
      title: "hist(x)",
      series: [{ type: "bars", points: pts, width: w * 0.95 }],
      xDomain: [hs.breaks[0], hs.breaks[hs.breaks.length - 1]],
      yDomain: [0, Math.max(...hs.counts) * 1.08 || 1],
      testid: "desc-hist",
    });
  }

  function ecdfPlot(x) {
    const F = lib.ecdf(x);
    const s = [...x].sort((a, b) => a - b);
    const lo = s[0];
    const hi = s[s.length - 1];
    const pad = (hi - lo) * 0.08 || 1;
    const pts = [[lo - pad, 0], ...s.map((v) => [v, F(v)]), [hi + pad, 1]];
    return plot({ title: "ecdf(x)", series: [{ type: "step", points: pts }], xDomain: [lo - pad, hi + pad], yDomain: [0, 1.04], testid: "desc-ecdf" });
  }

  const form = h(
    "form",
    { class: "card form-card", on: { submit: (e) => e.preventDefault() } },
    h("h2", { class: "card-title", i18n: "tab.descriptive" }),
    h("p", { class: "hint", i18n: "desc.intro" }),
    field(null, xInput, { labelText: "x", hintKey: "hint.commaList" }),
    field("desc.y", yInput),
    field("desc.probs", pInput),
    err.el,
  );
  const el = h(
    "div",
    { class: "tab-body" },
    h("div", { class: "workbench" }, form, h("div", { class: "card result-card" }, h("h3", { class: "sub-heading", i18n: "results" }), output, plots, code.el)),
    exampleSection(ctx, "descriptive"),
  );
  update();
  return { el, update };
}
