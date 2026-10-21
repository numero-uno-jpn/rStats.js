// Distribution definitions (shared by the Distributions and Random numbers tabs) and the Distributions tab.

import { t } from "./i18n.js";
import { plot } from "./plot.js";
import {
  args, checkbox, codePanel, debounce, errorBox, field, fmt, h, jsArg, jsNum, jsObj, parseNumber, parseNumbers, rBool, rNum, rVec,
  select, setChildren, table, textInput, uid,
} from "./util.js";
import { exampleSection } from "./examples.js";

/** A parameter: positional (required, before the options object in JS) or an option (blank = omitted). */
const P = (name, def, pos = false) => ({ name, def: String(def), pos });
const NCP = P("ncp", "");

/**
 * The 20 distributions. x: default x values for d/p; lower/upper: bounds of the support used to choose the plot
 * range; kinds: which of d/p/q exist; random: whether an r* function exists.
 */
export const DISTS = [
  { id: "norm", params: [P("mean", 0), P("sd", 1)], x: "-1.96, 0, 1.96" },
  { id: "t", params: [P("df", 5, true), NCP], x: "-2, 0, 2.5" },
  { id: "chisq", params: [P("df", 3, true), NCP], x: "1, 3, 7.81", lower: 0 },
  { id: "f", params: [P("df1", 5, true), P("df2", 10, true), NCP], x: "0.5, 1, 3.33", lower: 0 },
  { id: "beta", params: [P("shape1", 2, true), P("shape2", 5, true), NCP], x: "0.1, 0.3, 0.6", lower: 0, upper: 1 },
  { id: "gamma", params: [P("shape", 2, true), P("rate", 1), P("scale", "")], x: "0.5, 2, 5", lower: 0 },
  { id: "exp", params: [P("rate", 1)], x: "0.5, 1, 3", lower: 0 },
  { id: "unif", params: [P("min", 0), P("max", 1)], x: "0.25, 0.5, 0.9" },
  { id: "lnorm", params: [P("meanlog", 0), P("sdlog", 1)], x: "0.5, 1, 3", lower: 0 },
  { id: "logis", params: [P("location", 0), P("scale", 1)], x: "-2, 0, 2" },
  { id: "cauchy", params: [P("location", 0), P("scale", 1)], x: "-3, 0, 3", tail: 0.03 },
  { id: "weibull", params: [P("shape", 1.5, true), P("scale", 1)], x: "0.5, 1, 2", lower: 0 },
  { id: "binom", params: [P("size", 10, true), P("prob", 0.3, true)], x: "0, 3, 6", discrete: true },
  { id: "pois", params: [P("lambda", 4, true)], x: "2, 4, 8", discrete: true },
  { id: "geom", params: [P("prob", 0.3, true)], x: "0, 2, 5", discrete: true },
  { id: "nbinom", params: [P("size", 5, true), P("prob", 0.5), P("mu", "")], x: "0, 5, 10", discrete: true },
  { id: "hyper", params: [P("m", 10, true), P("n", 7, true), P("k", 8, true)], x: "3, 5, 7", discrete: true },
  { id: "signrank", params: [P("n", 10, true)], x: "10, 27, 45", discrete: true },
  { id: "wilcox", params: [P("m", 4, true), P("n", 6, true)], x: "5, 12, 20", discrete: true },
  { id: "tukey", params: [P("nmeans", 3, true), P("df", 10, true), P("nranges", 1)], x: "1, 3.5, 5", lower: 0, kinds: ["p", "q"], random: false },
];
for (const d of DISTS) {
  d.kinds ??= ["d", "p", "q"];
  d.random ??= true;
}

export const distById = (id) => DISTS.find((d) => d.id === id);

/** Inputs for the parameters of a distribution. Returns { el, read() } where read() gives { pos, opts } or throws. */
export function paramInputs(dist, onInput, testid) {
  const inputs = dist.params.map((p) => {
    const input = textInput({ value: p.def, testid: `${testid}-${p.name}`, inputmode: "decimal", onInput });
    if (!p.pos) input.placeholder = t("blankDefault");
    input.dataset.i18nAttr = p.pos ? "" : "placeholder:blankDefault";
    return { p, input };
  });
  const el = h(
    "div",
    { class: "param-grid" },
    inputs.map(({ p, input }) => {
      input.id = uid("param");
      return h(
        "div",
        { class: "field" },
        h("label", { for: input.id }, h("span", { class: "mono", text: p.name }), p.pos ? null : h("span", { class: "opt-mark", i18n: "optionalMark" })),
        input,
      );
    }),
  );
  return {
    el,
    read() {
      const pos = [];
      const opts = [];
      for (const { p, input } of inputs) {
        const s = input.value.trim();
        if (s === "") {
          if (p.pos) throw new Error(t("err.required", p.name));
          continue;
        }
        const v = parseNumber(s);
        if (p.pos) pos.push([p.name, v]);
        else opts.push([p.name, v]);
      }
      return { pos, opts };
    },
  };
}

/** Calls kind+id with a first argument, parameters and flags; returns the result. */
export function callDist(lib, dist, kind, first, { pos, opts }, flags = []) {
  const fn = lib[`${kind}${dist.id}`];
  return fn(first, ...pos.map(([, v]) => v), Object.fromEntries([...opts, ...flags]));
}

/** JS and R source of a call. first: { js, r } literals; flags: [jsName, rName, boolean]. */
export function callCode(dist, kind, first, { pos, opts }, flags = []) {
  const name = `${kind}${dist.id}`;
  const jsOpts = jsObj([...opts.map(([k, v]) => [k, jsNum(v)]), ...flags.map(([k, , v]) => [k, String(v)])]);
  const js = `${name}(${args(first.js, ...pos.map(([, v]) => jsNum(v)), jsOpts)})`;
  const r = `${name}(${args(first.r, ...[...pos, ...opts].map(([k, v]) => `${k} = ${rNum(v)}`), ...flags.map(([, k, v]) => `${k} = ${rBool(v)}`))})`;
  return { js, r, name };
}

/** A plotting range [lo, hi] for the distribution with the given parameters (linear scale). */
export function plotRange(lib, dist, params) {
  const q = (p) => {
    try {
      return callDist(lib, dist, "q", p, params);
    } catch {
      return NaN;
    }
  };
  if (dist.discrete) {
    let lo = q(0.0005);
    let hi = q(0.9995);
    if (!Number.isFinite(lo)) lo = 0;
    if (!Number.isFinite(hi) || hi > lo + 400) hi = lo + Math.min(400, Number.isFinite(hi) ? hi - lo : 30);
    lo = Math.max(0, Math.floor(lo));
    hi = Math.max(Math.ceil(hi), lo + 4);
    return [lo, hi];
  }
  const tail = dist.tail ?? 0.002;
  let lo = q(tail);
  let hi = q(1 - tail);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || !(hi > lo)) {
    lo = Number.isFinite(lo) ? lo : -5;
    hi = Number.isFinite(hi) && hi > lo ? hi : lo + 10;
  }
  const w = hi - lo;
  if (dist.lower != null && lo - dist.lower < 0.35 * w) lo = dist.lower;
  else lo -= 0.08 * w;
  hi += 0.08 * w;
  if (dist.upper != null) hi = Math.min(hi, dist.upper);
  return [lo, hi];
}

/** Upper limit of the y axis: ignores spikes (densities that go to infinity at a boundary). */
export function yMax(values) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return 1;
  const max = finite[finite.length - 1];
  const p95 = finite[Math.floor(0.95 * (finite.length - 1))];
  return (max > 4 * p95 && p95 > 0 ? 2.5 * p95 : max) * 1.06 || 1;
}

/** Density/pmf and CDF plots. markers: x positions to highlight. */
export function distPlots(lib, dist, params, markers = []) {
  const [lo, hi] = plotRange(lib, dist, params);
  const plots = [];
  const safe = (kind, x) => {
    try {
      return callDist(lib, dist, kind, x, params);
    } catch {
      return [];
    }
  };
  if (dist.discrete) {
    const xs = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    const pmf = Array.from(safe("d", xs));
    const cdf = Array.from(safe("p", xs));
    plots.push(
      plot({
        title: t("plot.pmf"),
        series: [{ type: "bars", points: xs.map((x, i) => [x, pmf[i]]), width: 0.7 }],
        xDomain: [lo - 0.6, hi + 0.6],
        yDomain: [0, yMax(pmf)],
        markers,
        testid: "dist-plot-d",
      }),
      plot({
        title: t("plot.cdf"),
        series: [{ type: "step", points: [[lo - 0.6, lo > 0 ? cdf[0] : 0], ...xs.map((x, i) => [x, cdf[i]])] }],
        xDomain: [lo - 0.6, hi + 0.6],
        yDomain: [0, 1.04],
        markers,
        testid: "dist-plot-p",
      }),
    );
  } else {
    const N = 241;
    const xs = Array.from({ length: N }, (_, i) => lo + ((hi - lo) * i) / (N - 1));
    if (dist.kinds.includes("d")) {
      const d = Array.from(safe("d", xs));
      plots.push(
        plot({
          title: t("plot.density"),
          series: [{ type: "line", points: xs.map((x, i) => [x, d[i]]) }],
          xDomain: [lo, hi],
          yDomain: [0, yMax(d)],
          markers,
          testid: "dist-plot-d",
        }),
      );
    }
    const p = Array.from(safe("p", xs));
    plots.push(
      plot({
        title: t("plot.cdf"),
        series: [{ type: "line", points: xs.map((x, i) => [x, p[i]]) }],
        xDomain: [lo, hi],
        yDomain: [0, 1.04],
        markers,
        testid: "dist-plot-p",
      }),
    );
  }
  return plots;
}

const KIND_FIRST = { d: "x", p: "q", q: "p" };

export function createDistributionsTab(ctx) {
  const { lib } = ctx;
  const err = errorBox("dist-error");
  const output = h("div", { class: "output", "data-testid": "dist-output" });
  const plots = h("div", { class: "plots", "data-testid": "dist-plots" });
  const code = codePanel("dist-code");
  const run = debounce(update, 120);

  const distSelect = select(
    DISTS.map((d) => ({ value: d.id, i18n: `dist.${d.id}` })),
    { testid: "dist-select", onChange: () => changeDist() },
  );
  const kindSelect = select([], { testid: "dist-kind", onChange: () => changeKind() });
  const valuesInput = textInput({ testid: "dist-values", inputmode: "decimal", onInput: run });
  const valuesLabel = h("label", { for: "dist-values-input" });
  valuesInput.id = "dist-values-input";
  const lowerTail = checkbox("opt.lowerTail", { checked: true, testid: "dist-lowerTail", onChange: run });
  const logP = checkbox("opt.logP", { testid: "dist-logP", onChange: run });
  const logD = checkbox("opt.log", { testid: "dist-log", onChange: run });
  const paramsHost = h("div", { class: "params-host" });
  let params;

  // Values typed by the user, remembered per distribution and per kind of input (x or p).
  const remembered = new Map();
  let dist = DISTS[0];
  let kind = "d";
  const valueKey = () => `${dist.id}:${kind === "q" ? "p" : "x"}`;

  function changeDist() {
    dist = distById(distSelect.value);
    params = paramInputs(dist, run, "dist-param");
    setChildren(paramsHost, params.el);
    setChildren(
      kindSelect,
      dist.kinds.map((k) => h("option", { value: k, i18n: `kind.${k}${k === "d" && dist.discrete ? "Discrete" : ""}` })),
    );
    if (!dist.kinds.includes(kind)) kind = dist.kinds[0];
    kindSelect.value = kind;
    changeKind(true);
  }

  function changeKind(fromDist = false) {
    if (!fromDist) remembered.set(`${dist.id}:${kind === "q" ? "p" : "x"}`, valuesInput.value);
    kind = kindSelect.value;
    valuesInput.value = remembered.get(valueKey()) ?? (kind === "q" ? "0.025, 0.5, 0.975" : dist.x);
    update();
  }
  valuesInput.addEventListener("input", () => remembered.set(valueKey(), valuesInput.value));

  function update() {
    valuesLabel.textContent = t(kind === "q" ? (logP.input.checked ? "input.logp" : "input.p") : "input.x");
    lowerTail.el.hidden = kind === "d";
    logP.el.hidden = kind === "d";
    logD.el.hidden = kind !== "d";
    err.clear();
    try {
      const values = parseNumbers(valuesInput.value);
      const prm = params.read();
      const flags = kind === "d" ? [["log", "log", logD.input.checked]] : [["lowerTail", "lower.tail", lowerTail.input.checked], ["logP", "log.p", logP.input.checked]];
      const shownFlags = flags.filter(([k, , v]) => (k === "lowerTail" ? !v : v));
      const first = values.length === 1 ? values[0] : values;
      const result = callDist(lib, dist, kind, first, prm, shownFlags);
      const res = values.length === 1 ? [result] : Array.from(result);
      const c = callCode(dist, kind, { js: jsArg(values), r: rVec(values) }, prm, shownFlags);
      setChildren(
        output,
        table(
          [KIND_FIRST[kind] + (kind === "q" && logP.input.checked ? ` (log)` : ""), `${c.name}(…)`],
          values.map((v, i) => [fmt(v), fmt(res[i])]),
          { testid: "dist-table" },
        ),
      );
      code.set(`print(${c.r}, digits = 17)`, `${ctx.importLine([c.name])}\n${c.js};`);
      // Plot markers in linear scale: the x values for d/p, the computed quantiles for q
      const markers = kind === "q" ? res : values;
      setChildren(plots, distPlots(lib, dist, prm, markers.filter(Number.isFinite)));
    } catch (e) {
      err.show(e);
      setChildren(output);
      setChildren(plots);
    }
  }

  const form = h(
    "form",
    { class: "card form-card", on: { submit: (e) => e.preventDefault() }, "aria-labelledby": "dist-form-title" },
    h("h2", { class: "card-title", id: "dist-form-title", i18n: "tab.distributions" }),
    h("p", { class: "hint", i18n: "dist.intro" }),
    field("label.distribution", distSelect),
    field("label.function", kindSelect),
    paramsHost,
    h("div", { class: "field" }, valuesLabel, valuesInput, h("small", { class: "hint", i18n: "hint.commaList" })),
    h("div", { class: "checks" }, lowerTail.el, logP.el, logD.el),
    err.el,
  );

  const el = h(
    "div",
    { class: "tab-body" },
    h(
      "div",
      { class: "workbench" },
      form,
      h("div", { class: "card result-card" }, h("h3", { class: "sub-heading", i18n: "results" }), output, plots, code.el),
    ),
    exampleSection(ctx, "distributions"),
  );
  changeDist();
  return { el, update };
}
