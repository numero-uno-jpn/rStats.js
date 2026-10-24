// Numerical methods tab: integrate / optimize / uniroot / grad of a function given as a JavaScript expression, and
// interpolation (approx, spline, splinefun, barylag) of data points.

import { t } from "./i18n.js";
import { plot } from "./plot.js";
import { codePanel, debounce, errorBox, field, fmt, h, jsArr, jsNum, parseNumber, parseNumbers, rNum, rVec, segmented, select, setChildren, table, textInput } from "./util.js";
import { exampleSection } from "./examples.js";

/** Preset functions: a JS expression in x, the same in R, and an interval */
const FUNS = [
  { js: "Math.exp(-x * x / 2)", r: "exp(-x^2 / 2)", lo: "-3", hi: "3" },
  { js: "Math.cos(x) - x", r: "cos(x) - x", lo: "0", hi: "1" },
  { js: "x * Math.exp(-x)", r: "x * exp(-x)", lo: "0", hi: "5" },
  { js: "x ** 3 - 2 * x - 5", r: "x^3 - 2 * x - 5", lo: "2", hi: "3" },
  { js: "Math.sqrt(x)", r: "sqrt(x)", lo: "0", hi: "1" },
];

function functionSection(ctx) {
  const { lib } = ctx;
  const err = errorBox("num-error");
  const output = h("div", { class: "output", "data-testid": "num-output" });
  const plots = h("div", { class: "plots plots-single" });
  const code = codePanel("num-code");
  const run = debounce(update, 200);
  const preset = select(FUNS.map((f, i) => ({ value: String(i), text: f.js })), { testid: "num-preset", onChange: () => usePreset() });
  const fInput = textInput({ value: FUNS[0].js, testid: "num-f", onInput: run });
  const loInput = textInput({ value: FUNS[0].lo, testid: "num-lower", inputmode: "decimal", onInput: run });
  const hiInput = textInput({ value: FUNS[0].hi, testid: "num-upper", inputmode: "decimal", onInput: run });

  function usePreset() {
    const f = FUNS[Number(preset.value)];
    fInput.value = f.js;
    loInput.value = f.lo;
    hiInput.value = f.hi;
    update();
  }

  function update() {
    err.clear();
    try {
      const src = fInput.value.trim();
      const f = new Function("x", `return (${src});`);
      const lo = parseNumber(loInput.value);
      const hi = parseNumber(hiInput.value);
      const known = FUNS.find((p) => p.js === src);
      const rows = [];
      const tryRow = (label, g) => {
        try {
          rows.push([label, g()]);
        } catch (e) {
          rows.push([label, e.message]);
        }
      };
      let root;
      let opt;
      tryRow("integrate(f, lower, upper)", () => {
        const r = lib.integrate(f, lo, hi);
        return `${fmt(r.value)} (absError ${fmt(r.absError)}, ${r.subdivisions} subdivisions)`;
      });
      tryRow("optimize(f, lower, upper)", () => {
        opt = lib.optimize(f, lo, hi);
        return `minimum ${fmt(opt.optimum)}, objective ${fmt(opt.objective)}`;
      });
      tryRow("optimize(…, { maximum: true })", () => {
        const r = lib.optimize(f, lo, hi, { maximum: true });
        return `maximum ${fmt(r.optimum)}, objective ${fmt(r.objective)}`;
      });
      tryRow("uniroot(f, lower, upper, { extendInt: \"yes\" })", () => {
        root = lib.uniroot(f, lo, hi, { extendInt: "yes" });
        return `root ${fmt(root.root)}, f(root) ${fmt(root.fRoot)}, iter ${root.iter}`;
      });
      const mid = (lo + hi) / 2;
      tryRow(`grad(f, [${fmt(mid)}])`, () => fmt(lib.grad((v) => f(v[0]), [mid])[0]));
      tryRow(`hessian(f, [${fmt(mid)}])`, () => fmt(lib.hessian((v) => f(v[0]), [mid])[0][0]));
      setChildren(output, table([t("num.call"), t("desc.value")], rows, { testid: "num-table", className: "data-table kv" }));
      const rf = known ? `f <- function(x) ${known.r}` : `f <- function(x) ...  # ${src}`;
      code.set(
        `${rf}\nintegrate(f, ${rNum(lo)}, ${rNum(hi)})\noptimize(f, c(${rNum(lo)}, ${rNum(hi)}))\noptimize(f, c(${rNum(lo)}, ${rNum(hi)}), maximum = TRUE)\nuniroot(f, c(${rNum(lo)}, ${rNum(hi)}), extendInt = "yes")\nnumDeriv::grad(f, ${rNum(mid)})\nnumDeriv::hessian(f, ${rNum(mid)})`,
        `${ctx.importLine(["integrate", "optimize", "uniroot", "grad", "hessian"])}\nconst f = (x) => ${src};\nintegrate(f, ${jsNum(lo)}, ${jsNum(hi)});\noptimize(f, ${jsNum(lo)}, ${jsNum(hi)});\noptimize(f, ${jsNum(lo)}, ${jsNum(hi)}, { maximum: true });\nuniroot(f, ${jsNum(lo)}, ${jsNum(hi)}, { extendInt: "yes" });\ngrad((v) => f(v[0]), [${jsNum(mid)}]);\nhessian((v) => f(v[0]), [${jsNum(mid)}]);`,
      );
      const N = 300;
      const pts = Array.from({ length: N }, (_, i) => {
        const x = lo + ((hi - lo) * i) / (N - 1);
        return [x, f(x)];
      });
      const ys = pts.map((p) => p[1]).filter(Number.isFinite);
      const markers = [root?.root, opt?.optimum].filter((v) => Number.isFinite(v) && v >= lo && v <= hi);
      setChildren(plots, plot({ title: "f(x)", series: [{ type: "line", points: pts }], xDomain: [lo, hi], yDomain: [Math.min(...ys, 0), Math.max(...ys, 0) * 1.05 || 1], markers, testid: "num-plot" }));
    } catch (e) {
      err.show(e);
      setChildren(output);
      setChildren(plots);
    }
  }

  const form = h(
    "form",
    { class: "card form-card", on: { submit: (e) => e.preventDefault() } },
    h("h2", { class: "card-title", i18n: "num.functions" }),
    h("p", { class: "hint", i18n: "num.functionsIntro" }),
    field("num.preset", preset),
    field("num.f", fInput),
    h("div", { class: "field-row" }, field("num.lower", loInput), field("num.upper", hiInput)),
    err.el,
  );
  const el = h("div", { class: "workbench" }, form, h("div", { class: "card result-card" }, h("h3", { class: "sub-heading", i18n: "results" }), output, plots, code.el));
  update();
  return { el, update };
}

/** Interpolation methods: [label, js(xout) call, R call, value(lib, x, y, xout)] */
const METHODS = [
  ["approx", (o) => `approx(x, y, { xout: ${o} }).y`, (o) => `approx(x, y, xout = ${o})$y`, (l, x, y, o) => l.approx(x, y, { xout: o }).y],
  ["approx constant", (o) => `approx(x, y, { xout: ${o}, method: "constant" }).y`, (o) => `approx(x, y, xout = ${o}, method = "constant")$y`, (l, x, y, o) => l.approx(x, y, { xout: o, method: "constant" }).y],
  ["spline fmm", (o) => `spline(x, y, { xout: ${o} }).y`, (o) => `spline(x, y, xout = ${o})$y`, (l, x, y, o) => l.spline(x, y, { xout: o }).y],
  ["spline natural", (o) => `spline(x, y, { xout: ${o}, method: "natural" }).y`, (o) => `spline(x, y, xout = ${o}, method = "natural")$y`, (l, x, y, o) => l.spline(x, y, { xout: o, method: "natural" }).y],
  ["splinefun monoH.FC", (o) => `splinefun(x, y, { method: "monoH.FC" })(${o})`, (o) => `splinefun(x, y, method = "monoH.FC")(${o})`, (l, x, y, o) => l.splinefun(x, y, { method: "monoH.FC" })(o)],
  ["barylag", (o) => `barylag(x, y, ${o})`, (o) => `pracma::barylag(x, y, ${o})`, (l, x, y, o) => l.barylag(x, y, o)],
];

function interpSection(ctx) {
  const { lib } = ctx;
  const err = errorBox("interp-error");
  const output = h("div", { class: "output", "data-testid": "interp-output" });
  const plots = h("div", { class: "plots plots-single" });
  const code = codePanel("interp-code");
  const run = debounce(update, 150);
  const xInput = textInput({ value: "0, 1, 2.5, 3, 4.5, 6", testid: "interp-x", inputmode: "decimal", onInput: run });
  const yInput = textInput({ value: "0, 0.84, 1.44, 1.58, 2.56, 2.84", testid: "interp-y", inputmode: "decimal", onInput: run });
  const oInput = textInput({ value: "0.5, 2, 3.8, 5.5", testid: "interp-xout", inputmode: "decimal", onInput: run });

  function update() {
    err.clear();
    try {
      const x = parseNumbers(xInput.value);
      const y = parseNumbers(yInput.value);
      const xo = parseNumbers(oInput.value);
      const rows = METHODS.map(([label, , , f]) => {
        try {
          return [label, ...f(lib, x, y, xo).map(fmt)];
        } catch (e) {
          return [label, e.message, ...xo.slice(1).map(() => "")];
        }
      });
      setChildren(output, table(["xout", ...xo.map(fmt)], rows, { testid: "interp-table", className: "data-table compact" }));
      code.set(
        [`x <- ${rVec(x)}`, `y <- ${rVec(y)}`, `xout <- ${rVec(xo)}`, ...METHODS.map(([, , r]) => `print(${r("xout")}, digits = 17)`)].join("\n"),
        [ctx.importLine(["approx", "spline", "splinefun", "barylag"]), `const x = ${jsArr(x)};`, `const y = ${jsArr(y)};`, `const xout = ${jsArr(xo)};`, ...METHODS.map(([, js]) => `${js("xout")};`)].join("\n"),
      );
      const lo = Math.min(...x);
      const hi = Math.max(...x);
      const grid = Array.from({ length: 200 }, (_, i) => lo + ((hi - lo) * i) / 199);
      const series = [0, 2, 4].map((k) => {
        try {
          const v = METHODS[k][3](lib, x, y, grid);
          return { type: "line", points: grid.map((g, i) => [g, v[i]]) };
        } catch {
          return null;
        }
      }).filter(Boolean);
      series.push({ type: "points", points: x.map((v, i) => [v, y[i]]) });
      const all = series.flatMap((s) => s.points.map((p) => p[1])).filter(Number.isFinite);
      setChildren(plots, plot({ title: "approx, spline (fmm), splinefun (monoH.FC)", series, xDomain: [lo, hi], yDomain: [Math.min(...all), Math.max(...all) * 1.05], testid: "interp-plot" }));
    } catch (e) {
      err.show(e);
      setChildren(output);
      setChildren(plots);
    }
  }

  const form = h(
    "form",
    { class: "card form-card", on: { submit: (e) => e.preventDefault() } },
    h("h2", { class: "card-title", i18n: "num.interp" }),
    h("p", { class: "hint", i18n: "num.interpIntro" }),
    field(null, xInput, { labelText: "x" }),
    field(null, yInput, { labelText: "y" }),
    field(null, oInput, { labelText: "xout" }),
    err.el,
  );
  const el = h("div", { class: "workbench" }, form, h("div", { class: "card result-card" }, h("h3", { class: "sub-heading", i18n: "results" }), output, plots, code.el));
  update();
  return { el, update };
}

export function createNumericsTab(ctx) {
  const sections = { functions: functionSection(ctx), interp: interpSection(ctx) };
  const nav = segmented(
    [
      { value: "functions", i18n: "num.functions" },
      { value: "interp", i18n: "num.interp" },
    ],
    { labelKey: "tab.numerics", testid: "num-nav", onChange: show },
  );
  function show(v) {
    for (const [k, s] of Object.entries(sections)) s.el.hidden = k !== v;
  }
  show("functions");
  const el = h("div", { class: "tab-body" }, nav.el, h("div", { class: "sub-panel" }, Object.values(sections).map((s) => s.el)), exampleSection(ctx, "numerics"));
  return { el, update: () => Object.values(sections).forEach((s) => s.update()) };
}
