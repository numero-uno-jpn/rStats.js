// Special functions tab: gamma, beta, binomial coefficients, polygamma, Bessel and error functions, gammainc, perm.

import { t } from "./i18n.js";
import { plot } from "./plot.js";
import { codePanel, debounce, errorBox, field, fmt, h, jsArr, jsNum, parseNumbers, parseNumber, rNum, rVec, select, setChildren, table, textInput } from "./util.js";
import { exampleSection } from "./examples.js";

/**
 * The functions. x/b: names of the list argument and the second argument (none for one-argument functions); r: R
 * code for a vector x and a number b where the R expression differs from the name; range: plotting range of x.
 */
const FUNCS = [
  { id: "gamma", x: "x", range: [-4.5, 5], ys: [-10, 25] },
  { id: "lgamma", x: "x", range: [-4.5, 8] },
  { id: "beta", x: "a", b: "b", bDef: "3" },
  { id: "lbeta", x: "a", b: "b", bDef: "3" },
  { id: "factorial", x: "x", range: [0, 8] },
  { id: "lfactorial", x: "x", range: [0, 20] },
  { id: "choose", x: "n", b: "k", bDef: "2", range: [-2, 8] },
  { id: "lchoose", x: "n", b: "k", bDef: "2", range: [2, 30] },
  { id: "perm", x: "n", b: "k", bDef: "2", range: [2, 10], r: (x, b) => `factorial(${x}) / factorial(${x} - ${b})` },
  { id: "digamma", x: "x", range: [0.1, 8] },
  { id: "trigamma", x: "x", range: [0.2, 8] },
  { id: "psigamma", x: "x", b: "deriv", bDef: "2", range: [0.3, 8] },
  { id: "besselJ", x: "x", b: "nu", bDef: "0", range: [0, 20] },
  { id: "besselY", x: "x", b: "nu", bDef: "0", range: [0.3, 20] },
  { id: "besselI", x: "x", b: "nu", bDef: "0", range: [0, 5] },
  { id: "besselK", x: "x", b: "nu", bDef: "0", range: [0.1, 5] },
  { id: "erf", x: "x", range: [-3, 3], r: (x) => `2 * pnorm(${x} * sqrt(2)) - 1` },
  { id: "erfc", x: "x", range: [-3, 3], r: (x) => `2 * pnorm(-${x} * sqrt(2))` },
  { id: "erfinv", x: "y", range: [-0.995, 0.995], r: (x) => `pracma::erfinv(${x})` },
  { id: "erfcinv", x: "y", range: [0.005, 1.995], r: (x) => `pracma::erfcinv(${x})` },
  { id: "gammainc", x: "x", b: "a", bDef: "2.5", range: [0, 8], call: (f, x, b) => f(x, b).lower, js: ".lower", r: (x, b) => `pgamma(${x}, ${b}) * gamma(${b})` },
];
const DEFAULT_X = { x: "0.5, 1, 4.5, -1.5, 171.5", a: "0.5, 1, 4.5, 10", n: "5, 10, 20.5", y: "-0.5, 0.1, 0.9" };

export function createSpecialTab(ctx) {
  const { lib } = ctx;
  const funcs = FUNCS.filter((f) => lib[f.id]);
  const err = errorBox("special-error");
  const output = h("div", { class: "output", "data-testid": "special-output" });
  const plots = h("div", { class: "plots plots-single" });
  const code = codePanel("special-code");
  const run = debounce(update, 120);

  const fnSelect = select(funcs.map((f) => ({ value: f.id, text: f.id })), { testid: "special-fn", onChange: () => changeFn() });
  const xInput = textInput({ value: DEFAULT_X.x, testid: "special-x", inputmode: "decimal", onInput: run });
  const bInput = textInput({ value: "3", testid: "special-b", inputmode: "decimal", onInput: run });
  const xLabel = h("label", { for: "special-x-input" });
  xInput.id = "special-x-input";
  const bLabel = h("span", { class: "mono" });
  const bField = h("div", { class: "field" }, h("label", {}, bLabel), bInput);
  let spec = funcs[0];

  function changeFn() {
    const prev = spec;
    spec = funcs.find((f) => f.id === fnSelect.value);
    if (spec.x !== prev.x) xInput.value = DEFAULT_X[spec.x] ?? DEFAULT_X.x;
    if (spec.b && spec.b !== prev.b) bInput.value = spec.bDef;
    update();
  }

  const valueOf = (x, b) => (spec.call ? spec.call(lib[spec.id], x, b) : spec.b ? lib[spec.id](x, b) : lib[spec.id](x));

  function update() {
    const fn = spec.id;
    bField.hidden = !spec.b;
    bLabel.textContent = spec.b ?? "";
    xLabel.textContent = `${spec.x} ${t("label.commaSeparated")}`;
    err.clear();
    try {
      const xs = parseNumbers(xInput.value);
      const b = spec.b ? parseNumber(bInput.value) : undefined;
      const res = xs.map((x) => valueOf(x, b));
      const head = spec.b ? `${fn}(${spec.x}, ${fmt(b)})${spec.js ?? ""}` : `${fn}(${spec.x})`;
      setChildren(output, table([spec.x, head], xs.map((x, i) => [fmt(x), fmt(res[i])]), { testid: "special-table" }));
      const jsCall = spec.b ? `${jsArr(xs)}.map((${spec.x}) => ${fn}(${spec.x}, ${jsNum(b)})${spec.js ?? ""})` : `${jsArr(xs)}.map((${spec.x}) => ${fn}(${spec.x}))`;
      const rCall = spec.r ? spec.r(rVec(xs), spec.b ? rNum(b) : undefined) : spec.b ? `${fn}(${rVec(xs)}, ${rNum(b)})` : `${fn}(${rVec(xs)})`;
      code.set(`print(${rCall}, digits = 17)`, `${ctx.importLine([fn])}\n${jsCall};`);
      setChildren(plots, curve(b));
    } catch (e) {
      err.show(e);
      setChildren(output);
      setChildren(plots);
    }
  }

  function curve(b) {
    const [lo, hi] = spec.range ?? [0.02, 6];
    const N = 600;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const x = lo + ((hi - lo) * i) / (N - 1);
      let y;
      try {
        y = valueOf(x, b);
      } catch {
        y = NaN;
      }
      pts.push([x, y]);
    }
    const finite = pts.map((p) => p[1]).filter(Number.isFinite);
    const top = Math.max(...finite);
    // clip the poles (gamma, beta near 0, Bessel Y and K near 0)
    const yDomain = spec.ys ?? [Math.max(Math.min(...finite), -25), Math.min(top, 25) * (top > 0 ? 1.05 : 1)];
    const series = [{ type: "line", points: pts.map(([x, y], i) => [x, i > 0 && Math.abs(y - pts[i - 1][1]) > 50 ? NaN : y]) }];
    const title = spec.b ? `${spec.id}(${spec.x}, ${fmt(b)})${spec.js ?? ""}` : `${spec.id}(${spec.x})`;
    return plot({ title, series, xDomain: [lo, hi], yDomain, xLabel: spec.x, testid: "special-plot" });
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
