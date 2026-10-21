// Special functions tab: gamma, lgamma, beta, lbeta.

import { t } from "./i18n.js";
import { plot } from "./plot.js";
import { codePanel, debounce, errorBox, field, fmt, h, jsArr, jsNum, parseNumbers, parseNumber, rNum, rVec, select, setChildren, table, textInput } from "./util.js";
import { exampleSection } from "./examples.js";

const FUNCS = ["gamma", "lgamma", "beta", "lbeta"];
const TWO_ARGS = new Set(["beta", "lbeta"]);

export function createSpecialTab(ctx) {
  const { lib } = ctx;
  const err = errorBox("special-error");
  const output = h("div", { class: "output", "data-testid": "special-output" });
  const plots = h("div", { class: "plots plots-single" });
  const code = codePanel("special-code");
  const run = debounce(update, 120);

  const fnSelect = select(FUNCS.map((f) => ({ value: f, text: f })), { testid: "special-fn", onChange: () => update() });
  const xInput = textInput({ value: "0.5, 1, 4.5, -1.5, 171.5", testid: "special-x", inputmode: "decimal", onInput: run });
  const bInput = textInput({ value: "3", testid: "special-b", inputmode: "decimal", onInput: run });
  const xLabel = h("label", { for: "special-x-input" });
  xInput.id = "special-x-input";
  const bField = field("label.b", bInput);

  function update() {
    const fn = fnSelect.value;
    const two = TWO_ARGS.has(fn);
    bField.hidden = !two;
    xLabel.textContent = two ? t("label.aList") : t("label.xList");
    err.clear();
    try {
      const xs = parseNumbers(xInput.value);
      const b = two ? parseNumber(bInput.value) : undefined;
      const f = lib[fn];
      const res = xs.map((x) => (two ? f(x, b) : f(x)));
      setChildren(
        output,
        table([two ? "a" : "x", two ? `${fn}(a, ${fmt(b)})` : `${fn}(x)`], xs.map((x, i) => [fmt(x), fmt(res[i])]), { testid: "special-table" }),
      );
      const jsCall = two ? `${jsArr(xs)}.map((a) => ${fn}(a, ${jsNum(b)}))` : `${jsArr(xs)}.map((x) => ${fn}(x))`;
      const rCall = two ? `${fn}(${rVec(xs)}, ${rNum(b)})` : `${fn}(${rVec(xs)})`;
      code.set(`print(${rCall}, digits = 17)`, `${ctx.importLine([fn])}\n${jsCall};`);
      setChildren(plots, curve(fn, b));
    } catch (e) {
      err.show(e);
      setChildren(output);
      setChildren(plots);
    }
  }

  function curve(fn, b) {
    const two = TWO_ARGS.has(fn);
    const [lo, hi] = fn === "gamma" ? [-4.5, 5] : fn === "lgamma" ? [-4.5, 8] : [0.02, 6];
    const N = 600;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const x = lo + ((hi - lo) * i) / (N - 1);
      pts.push([x, two ? lib[fn](x, b) : lib[fn](x)]);
    }
    // break the line at the poles of gamma
    const ys = fn === "gamma" ? [-10, 25] : fn === "beta" ? [0, Math.min(10, Math.max(...pts.map((p) => p[1]).filter(Number.isFinite)) * 1.05)] : null;
    const finite = pts.map((p) => p[1]).filter(Number.isFinite);
    const yDomain = ys ?? [Math.min(...finite), Math.max(...finite)];
    const series = [{ type: "line", points: pts.map(([x, y], i) => [x, i > 0 && Math.abs(y - pts[i - 1][1]) > 50 ? NaN : y]) }];
    return plot({ title: two ? `${fn}(a, ${fmt(b)})` : `${fn}(x)`, series, xDomain: [lo, hi], yDomain, xLabel: two ? "a" : "x", testid: "special-plot" });
  }

  const form = h(
    "form",
    { class: "card form-card", on: { submit: (e) => e.preventDefault() } },
    h("h2", { class: "card-title", i18n: "tab.special" }),
    h("p", { class: "hint", i18n: "special.intro" }),
    field("label.function", fnSelect),
    h("div", { class: "field" }, xLabel, xInput, h("small", { class: "hint", i18n: "hint.commaList" })),
    bField,
    err.el,
  );
  const el = h(
    "div",
    { class: "tab-body" },
    h("div", { class: "workbench" }, form, h("div", { class: "card result-card" }, h("h3", { class: "sub-heading", i18n: "results" }), output, plots, code.el)),
    exampleSection(ctx, "special"),
  );
  update();
  return { el, update };
}
