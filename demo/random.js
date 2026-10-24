// Random numbers tab: r* functions with a histogram, sample / sampleInt, rmultinom, and saving/restoring the state.

import { t } from "./i18n.js";
import { histogram, plot } from "./plot.js";
import { DISTS, callCode, distById, paramInputs, plotRange, yMax } from "./distributions.js";
import {
  args, checkbox, codePanel, debounce, errorBox, field, fmt, h, jsArr, jsObj, jsStr, matrixView, parseNumber, parseNumbers, rStr, rVec,
  segmented, select, setChildren, textInput, vectorView,
} from "./util.js";
import { exampleSection } from "./examples.js";

const RDISTS = DISTS.filter((d) => d.random);

function seedField(testid, onInput, value = "42") {
  const input = textInput({ value, testid, inputmode: "numeric", onInput });
  return { input, el: field("label.seed", input) };
}

function readSeed(input) {
  const s = parseNumber(input.value);
  if (!Number.isInteger(s)) throw new Error(t("err.integer", "seed"));
  return s;
}

function readCount(input, name = "n") {
  const n = parseNumber(input.value);
  if (!Number.isInteger(n) || n < 0) throw new Error(t("err.count", name));
  if (n > 100000) throw new Error(t("err.tooMany", 100000));
  return n;
}

/** Workbench: form on the left, results on the right. */
function workbench(form, ...results) {
  return h("div", { class: "workbench" }, form, h("div", { class: "card result-card" }, h("h3", { class: "sub-heading", i18n: "results" }), ...results));
}

function formCard(titleKey, introKey, ...children) {
  return h(
    "form",
    { class: "card form-card", on: { submit: (e) => e.preventDefault() } },
    h("h2", { class: "card-title", i18n: titleKey }),
    introKey ? h("p", { class: "hint", i18n: introKey }) : null,
    ...children,
  );
}

// ---------- r* functions ----------

function rfunSection(ctx) {
  const { lib } = ctx;
  const err = errorBox("random-error");
  const values = h("div", { class: "output scroll-box", "data-testid": "random-values" });
  const plots = h("div", { class: "plots plots-single", "data-testid": "random-plot" });
  const stats = h("p", { class: "hint mono", "data-testid": "random-stats" });
  const code = codePanel("random-code");
  const run = debounce(update, 150);
  const seed = seedField("random-seed", run);
  const fnSelect = select(
    RDISTS.filter((d) => lib[`r${d.id}`]).map((d) => ({ value: d.id, text: `r${d.id}` })),
    { testid: "random-fn", onChange: () => changeDist() },
  );
  const nInput = textInput({ value: "500", testid: "random-n", inputmode: "numeric", onInput: run });
  const paramsHost = h("div", { class: "params-host" });
  let dist;
  let params;

  function changeDist() {
    dist = distById(fnSelect.value);
    params = paramInputs(dist, run, "random-param");
    setChildren(paramsHost, params.el);
    update();
  }

  function update() {
    err.clear();
    try {
      const s = readSeed(seed.input);
      const n = readCount(nInput);
      const prm = params.read();
      lib.setSeed(s);
      const fn = lib[`r${dist.id}`];
      const x = fn(n, ...prm.pos.map(([, v]) => v), Object.fromEntries(prm.opts));
      const c = callCode(dist, "r", { js: String(n), r: String(n) }, prm);
      code.set(`set.seed(${s})\nprint(${c.r}, digits = 17)`, `${ctx.importLine(["setSeed", c.name])}\nsetSeed(${s});\n${c.js};`);
      setChildren(values, vectorView(x));
      const finite = x.filter(Number.isFinite);
      const mean = finite.reduce((a, b) => a + b, 0) / finite.length;
      const sd = Math.sqrt(finite.reduce((a, b) => a + (b - mean) ** 2, 0) / (finite.length - 1));
      stats.textContent = n ? `${t("stats.mean")} = ${fmt(mean)}, ${t("stats.sd")} = ${fmt(sd)}, min = ${fmt(Math.min(...x))}, max = ${fmt(Math.max(...x))}` : "";
      setChildren(plots, n ? hist(x, prm) : null);
    } catch (e) {
      err.show(e);
      setChildren(values);
      setChildren(plots);
      stats.textContent = "";
    }
  }

  function hist(x, prm) {
    let [lo, hi] = plotRange(lib, dist, prm);
    const sMin = Math.min(...x);
    const sMax = Math.max(...x);
    const w = hi - lo;
    if (sMin < lo && sMin > lo - 1.5 * w) lo = sMin;
    if (sMax > hi && sMax < hi + 1.5 * w) hi = sMax;
    let series;
    let outside;
    let yTop;
    if (dist.discrete) {
      lo = Math.floor(lo);
      hi = Math.ceil(hi);
      const counts = new Map();
      outside = 0;
      for (const v of x) {
        if (v < lo || v > hi) outside++;
        else counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      const ks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
      const freq = ks.map((k) => [k, (counts.get(k) ?? 0) / x.length]);
      const pmf = Array.from(lib[`d${dist.id}`](ks, ...prm.pos.map(([, v]) => v), Object.fromEntries(prm.opts)));
      series = [
        { type: "bars", points: freq, width: 0.7, className: "series-hist" },
        { type: "points", points: ks.map((k, i) => [k, pmf[i]]), className: "series-2" },
      ];
      yTop = yMax([...freq.map((f) => f[1]), ...pmf]);
      lo -= 0.6;
      hi += 0.6;
    } else {
      const bins = Math.min(60, Math.max(8, Math.ceil(Math.log2(x.length) + 1) * 2));
      const hgm = histogram(x, lo, hi, bins);
      outside = hgm.outside;
      const dens = hgm.counts.map((c, i) => [hgm.edges[i] + hgm.width / 2, c / (x.length * hgm.width)]);
      const N = 200;
      const xs = Array.from({ length: N }, (_, i) => lo + ((hi - lo) * i) / (N - 1));
      const d = Array.from(lib[`d${dist.id}`](xs, ...prm.pos.map(([, v]) => v), Object.fromEntries(prm.opts)));
      series = [
        { type: "bars", points: dens, width: hgm.width * 0.94, className: "series-hist" },
        { type: "line", points: xs.map((v, i) => [v, d[i]]), className: "series-2" },
      ];
      yTop = yMax([...dens.map((p) => p[1]), ...d]);
    }
    return h(
      "figure",
      { class: "figure" },
      plot({ title: t("plot.histogram"), series, xDomain: [lo, hi], yDomain: [0, yTop], testid: "random-hist" }),
      h("figcaption", { class: "hint" }, t("plot.histCaption"), outside ? ` ${t("plot.outside", outside)}` : ""),
    );
  }

  const form = formCard(
    "random.rfun",
    "random.intro",
    seed.el,
    field("label.function", fnSelect),
    field("label.n", nInput),
    paramsHost,
    err.el,
  );
  const el = workbench(form, stats, plots, values, code.el);
  changeDist();
  return { el, update };
}

// ---------- sample / sampleInt ----------

function sampleSection(ctx) {
  const { lib } = ctx;
  const err = errorBox("sample-error");
  const output = h("div", { class: "output", "data-testid": "sample-output" });
  const code = codePanel("sample-code");
  const run = debounce(update, 150);
  const seed = seedField("sample-seed", run);
  const mode = select(
    [
      { value: "sample", text: "sample(x)" },
      { value: "sampleInt", text: "sampleInt(n)" },
    ],
    { testid: "sample-mode", onChange: () => update() },
  );
  const xInput = textInput({ value: "apple, banana, cherry, durian, elderberry", testid: "sample-x", onInput: run });
  const nInput = textInput({ value: "10", testid: "sample-n", inputmode: "numeric", onInput: run });
  const sizeInput = textInput({ value: "", testid: "sample-size", inputmode: "numeric", onInput: run });
  sizeInput.dataset.i18nAttr = "placeholder:blankDefault";
  sizeInput.placeholder = t("blankDefault");
  const replace = checkbox("opt.replace", { testid: "sample-replace", onChange: run });
  const probInput = textInput({ value: "", testid: "sample-prob", inputmode: "decimal", onInput: run });
  probInput.dataset.i18nAttr = "placeholder:blankEqual";
  probInput.placeholder = t("blankEqual");
  const xField = field("label.items", xInput, { hintKey: "hint.items" });
  const nField = field("label.n", nInput);

  function update() {
    const isInt = mode.value === "sampleInt";
    xField.hidden = isInt;
    nField.hidden = !isInt;
    err.clear();
    try {
      const s = readSeed(seed.input);
      const size = sizeInput.value.trim() === "" ? undefined : readCount(sizeInput, "size");
      const prob = probInput.value.trim() === "" ? undefined : parseNumbers(probInput.value);
      const opts = { ...(size !== undefined && { size }), ...(replace.input.checked && { replace: true }), ...(prob && { prob }) };
      const jsOpts = jsObj([size !== undefined && ["size", size], replace.input.checked && ["replace", "true"], prob && ["prob", jsArr(prob)]]);
      const rOpts = [size !== undefined && `size = ${size}`, replace.input.checked && `replace = TRUE`, prob && `prob = ${rVec(prob)}`].filter(Boolean);
      lib.setSeed(s);
      let result;
      if (isInt) {
        const n = readCount(nInput);
        result = lib.sampleInt(n, opts);
        code.set(
          `set.seed(${s})\nsample.int(${args(String(n), ...rOpts)}) - 1  # rStats.js is 0-based`,
          `${ctx.importLine(["setSeed", "sampleInt"])}\nsetSeed(${s});\nsampleInt(${args(String(n), jsOpts)});`,
        );
      } else {
        const items = xInput.value.split(",").map((v) => v.trim()).filter(Boolean);
        if (!items.length) throw new Error(t("err.empty"));
        const numeric = items.every((v) => v !== "" && !Number.isNaN(Number(v)));
        const xs = numeric ? items.map(Number) : items;
        result = lib.sample(xs, opts);
        const jsX = numeric ? jsArr(xs) : `[${xs.map(jsStr).join(", ")}]`;
        const rX = numeric ? rVec(xs) : `c(${xs.map(rStr).join(", ")})`;
        code.set(`set.seed(${s})\nsample(${args(rX, ...rOpts)})`, `${ctx.importLine(["setSeed", "sample"])}\nsetSeed(${s});\nsample(${args(jsX, jsOpts)});`);
      }
      setChildren(output, vectorView(result, (v) => (typeof v === "number" ? fmt(v) : JSON.stringify(v))));
    } catch (e) {
      err.show(e);
      setChildren(output);
    }
  }

  const form = formCard(
    "random.sample",
    "random.sampleIntro",
    seed.el,
    field("label.mode", mode),
    xField,
    nField,
    field("label.size", sizeInput),
    field("label.prob", probInput, { hintKey: "hint.prob" }),
    h("div", { class: "checks" }, replace.el),
    err.el,
  );
  const el = workbench(form, output, code.el);
  update();
  return { el, update };
}

// ---------- rmultinom ----------

function multinomSection(ctx) {
  const { lib } = ctx;
  const err = errorBox("multinom-error");
  const output = h("div", { class: "output", "data-testid": "multinom-output" });
  const code = codePanel("multinom-code");
  const run = debounce(update, 150);
  const seed = seedField("multinom-seed", run);
  const nInput = textInput({ value: "5", testid: "multinom-n", inputmode: "numeric", onInput: run });
  const sizeInput = textInput({ value: "20", testid: "multinom-size", inputmode: "numeric", onInput: run });
  const probInput = textInput({ value: "0.2, 0.3, 0.5", testid: "multinom-prob", inputmode: "decimal", onInput: run });

  function update() {
    err.clear();
    try {
      const s = readSeed(seed.input);
      const n = readCount(nInput);
      const size = readCount(sizeInput, "size");
      const prob = parseNumbers(probInput.value);
      lib.setSeed(s);
      const res = lib.rmultinom(n, size, prob);
      setChildren(output, res.length ? matrixView(res) : h("div", { class: "scalar num", text: "[]" }), h("p", { class: "hint", i18n: "random.multinomNote" }));
      code.set(
        `set.seed(${s})\nt(rmultinom(${n}, ${size}, ${rVec(prob)}))  # one row per draw, as in rStats.js`,
        `${ctx.importLine(["setSeed", "rmultinom"])}\nsetSeed(${s});\nrmultinom(${n}, ${size}, ${jsArr(prob)});`,
      );
    } catch (e) {
      err.show(e);
      setChildren(output);
    }
  }
  const form = formCard("random.multinom", "random.multinomIntro", seed.el, field("label.n", nInput), field("label.size", sizeInput), field("label.prob", probInput), err.el);
  const el = workbench(form, output, code.el);
  update();
  return { el, update };
}

// ---------- getRandomSeed / setRandomSeed ----------

function stateSection(ctx) {
  const { lib } = ctx;
  const err = errorBox("state-error");
  const output = h("div", { class: "output", "data-testid": "state-output" });
  const code = codePanel("state-code");
  const run = debounce(update, 150);
  const seed = seedField("state-seed", run, "2024");
  const nInput = textInput({ value: "5", testid: "state-n", inputmode: "numeric", onInput: run });

  function update() {
    err.clear();
    try {
      const s = readSeed(seed.input);
      const n = readCount(nInput);
      lib.setSeed(s);
      const state = lib.getRandomSeed();
      const first = lib.rnorm(n);
      const third = lib.rnorm(n);
      lib.setRandomSeed(state);
      const second = lib.rnorm(n);
      const identical = first.length === second.length && first.every((v, i) => Object.is(v, second[i]));
      setChildren(
        output,
        h(
          "dl",
          { class: "object-view" },
          h("dt", { i18n: "state.state" }),
          h("dd", { class: "num", text: `Int32Array(${state.length}) [${Array.from(state.slice(0, 4)).join(", ")}, …]` }),
          h("dt", { i18n: "state.first" }),
          h("dd", {}, vectorView(first)),
          h("dt", { i18n: "state.next" }),
          h("dd", {}, vectorView(third)),
          h("dt", { i18n: "state.second" }),
          h("dd", {}, vectorView(second)),
          h("dt", { i18n: "state.identical" }),
          h("dd", { class: `num ${identical ? "ok" : "bad"}`, "data-testid": "state-identical", text: String(identical) }),
        ),
      );
      code.set(
        `set.seed(${s})\nstate <- .Random.seed  # 626 integers\nfirst <- rnorm(${n})\n.Random.seed <- state\nsecond <- rnorm(${n})\nidentical(first, second)  # TRUE`,
        `${ctx.importLine(["setSeed", "getRandomSeed", "setRandomSeed", "rnorm"])}\nsetSeed(${s});\nconst state = getRandomSeed(); // Int32Array(626), same as .Random.seed\nconst first = rnorm(${n});\nsetRandomSeed(state);\nconst second = rnorm(${n});\nfirst.every((v, i) => v === second[i]); // true`,
      );
    } catch (e) {
      err.show(e);
      setChildren(output);
    }
  }
  const form = formCard("random.state", "random.stateIntro", seed.el, field("label.n", nInput), err.el);
  const el = workbench(form, output, code.el);
  update();
  return { el, update };
}

export function createRandomTab(ctx) {
  const sections = { rfun: rfunSection(ctx), sample: sampleSection(ctx), multinom: multinomSection(ctx), state: stateSection(ctx) };
  const host = h("div", { class: "sub-panel" });
  const nav = segmented(
    [
      { value: "rfun", i18n: "random.rfunShort" },
      { value: "sample", text: "sample" },
      { value: "multinom", text: "rmultinom" },
      { value: "state", i18n: "random.stateShort" },
    ],
    { labelKey: "random.sections", testid: "random-nav", onChange: show },
  );
  function show(v) {
    for (const [k, s] of Object.entries(sections)) s.el.hidden = k !== v;
  }
  setChildren(host, Object.values(sections).map((s) => s.el));
  show("rfun");
  const el = h("div", { class: "tab-body" }, nav.el, host, exampleSection(ctx, "random"));
  return { el, update: () => Object.values(sections).forEach((s) => s.update()) };
}

