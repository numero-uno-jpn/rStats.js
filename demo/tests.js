// Hypothesis tests tab: tTest, chisqTest, fisherTest, wilcoxTest, cor/corTest, pAdjust. Results are printed like
// R's print(htest) and shown as raw JSON.

import { t } from "./i18n.js";
import {
  args, checkbox, codePanel, debounce, errorBox, field, fmt, h, jsArr, jsMat, jsNum, jsObj, jsStr, jsonDetails, parseMatrix, parseNumber,
  parseNumbers, parseOptional, rMat, rNum, rStr, rVec, segmented, select, setChildren, table, textArea, textInput,
} from "./util.js";
import { exampleSection } from "./examples.js";

// ---------- R-style number formatting (format() with a number of significant digits) ----------

function sigNeeded(x, digits) {
  const r = Number(x.toPrecision(digits));
  for (let s = 1; s <= digits; s++) if (Number(r.toPrecision(s)) === r) return { s, r };
  return { s: digits, r };
}

const expo = (x) => (x === 0 ? 0 : Math.floor(Math.log10(Math.abs(x)) + 1e-12));

function sciString(x, s) {
  const [m, e] = x.toExponential(s - 1).split("e");
  const n = Number(e);
  return `${m}e${n < 0 ? "-" : "+"}${String(Math.abs(n)).padStart(2, "0")}`;
}

/** R's format(x, digits = digits) for a numeric vector: common number of decimals, fixed or scientific. */
export function formatR(values, digits = 7) {
  const xs = Array.isArray(values) ? values : [values];
  const finite = xs.filter(Number.isFinite);
  const special = (x) => (Number.isNaN(x) ? "NaN" : x > 0 ? "Inf" : "-Inf");
  if (!finite.length) return xs.map(special);
  let rgt = 0;
  let sigMax = 1;
  let eMin = Infinity;
  let eMax = -Infinity;
  for (const x of finite) {
    const { s, r } = sigNeeded(x, digits);
    const e = expo(r);
    rgt = Math.max(rgt, s - 1 - e);
    sigMax = Math.max(sigMax, s);
    eMin = Math.min(eMin, e);
    eMax = Math.max(eMax, e);
  }
  rgt = Math.max(0, Math.min(rgt, 15));
  const fixed = xs.map((x) => (Number.isFinite(x) ? x.toFixed(rgt) : special(x)));
  const sci = xs.map((x) => (Number.isFinite(x) ? sciString(x, sigMax) : special(x)));
  const wFixed = Math.max(...fixed.map((s) => s.length));
  const wSci = Math.max(...sci.map((s) => s.length));
  const out = wFixed <= wSci ? fixed : sci;
  const w = Math.max(...out.map((s) => s.length));
  return out.map((s) => s.padStart(w));
}

const format1 = (x, digits) => formatR([x], digits)[0].trim();

/** R's format.pval(p, digits). */
function formatPval(p, digits) {
  if (Number.isNaN(p)) return "NA";
  if (p < Number.EPSILON) return `< ${format1(Number.EPSILON, Math.max(1, digits - 2))}`;
  return format1(p, digits);
}

/** A named numeric vector printed as R does: names above values, right-aligned columns. */
function namedVector(names, values, digits) {
  const v = formatR(values, digits);
  const w = names.map((n, i) => Math.max(n.length, v[i].length));
  return `${names.map((n, i) => n.padStart(w[i])).join(" ")} \n${v.map((s, i) => s.padStart(w[i])).join(" ")} \n`;
}

/** Text resembling R's print() of an htest object. */
export function printHtest(r, dataName) {
  const digits = 7;
  let s = `\n\t${r.method}\n\ndata:  ${dataName}\n`;
  const out = [];
  if (r.statistic != null) out.push(`${r.statisticName} = ${format1(r.statistic, digits - 2)}`);
  if (r.parameter != null) out.push(`${r.parameterName} = ${format1(r.parameter, digits - 2)}`);
  if (r.pValue != null) {
    const fp = formatPval(r.pValue, digits - 3);
    out.push(`p-value ${fp.startsWith("<") ? fp : `= ${fp}`}`);
  }
  s += `${out.join(", ")}\n`;
  if (r.alternative != null) {
    if (r.nullValue != null) {
      const alt = { "two.sided": "not equal to", less: "less than", greater: "greater than" }[r.alternative];
      s += `alternative hypothesis: true ${r.nullValueName} is ${alt} ${format1(r.nullValue, digits)}\n`;
    } else s += `alternative hypothesis: ${r.alternative}\n`;
  }
  if (r.confInt) {
    s += `${format1(100 * r.confLevel, digits)} percent confidence interval:\n ${formatR(r.confInt, digits).map((x) => x.trim()).join(" ")}\n`;
  }
  if (r.estimate != null) {
    const est = Array.isArray(r.estimate) ? r.estimate : [r.estimate];
    const names = Array.isArray(r.estimateNames) ? r.estimateNames : [r.estimateNames ?? ""];
    s += `sample estimates:\n${namedVector(names, est, digits)}`;
  }
  return `${s}\n`;
}

// ---------- shared controls ----------

const ALTS = ["two.sided", "less", "greater"];
const altSelect = (testid, onChange) => select(ALTS.map((a) => ({ value: a, text: a })), { testid, onChange });
const exactSelect = (testid, onChange) =>
  select(
    [
      { value: "auto", i18n: "opt.exactAuto" },
      { value: "true", text: "TRUE" },
      { value: "false", text: "FALSE" },
    ],
    { testid, onChange },
  );

function readConf(input) {
  return parseNumber(input.value);
}

/** Form + result card for one test. build(ctx, ui) returns { form children, compute() -> { result, dataName, js, r } }. */
function testSection(ctx, id, titleText, build) {
  const err = errorBox(`${id}-error`);
  const printed = h("pre", { class: "htest", "data-testid": `${id}-print`, tabindex: "0" });
  const extra = h("div", { class: "output" });
  const jsonHost = h("div");
  const code = codePanel(`${id}-code`);
  const run = debounce(update, 150);
  const spec = build(run, update);

  function update() {
    spec.sync?.();
    err.clear();
    try {
      const { result, dataName, js, r, extraEl, noPrint } = spec.compute();
      printed.hidden = Boolean(noPrint);
      printed.textContent = noPrint ? "" : printHtest(result, dataName);
      setChildren(extra, extraEl ?? null);
      setChildren(jsonHost, jsonDetails(result, `${id}-json`));
      jsonHost.querySelector("details").open = true;
      code.set(r, js);
    } catch (e) {
      err.show(e);
      printed.textContent = "";
      setChildren(extra);
      setChildren(jsonHost);
    }
  }

  const form = h(
    "form",
    { class: "card form-card", on: { submit: (e) => e.preventDefault() } },
    h("h2", { class: "card-title mono", text: titleText }),
    h("p", { class: "hint", i18n: `tests.${id}.intro` }),
    ...spec.fields,
    err.el,
  );
  const el = h(
    "div",
    { class: "workbench" },
    form,
    h("div", { class: "card result-card" }, h("h3", { class: "sub-heading", i18n: "results" }), extra, printed, jsonHost, code.el),
  );
  update();
  return { el, update };
}

const DEP_X = "1.83, 0.50, 1.62, 2.48, 1.68, 1.88, 1.55, 3.06, 1.30";
const DEP_Y = "0.878, 0.647, 0.598, 2.05, 1.06, 1.29, 1.06, 3.14, 1.29";

const vecDecl = (name, v) => ({ js: `const ${name} = ${jsArr(v)};`, r: `${name} <- ${rVec(v)}` });

// ---------- tTest ----------

function tTestSection(ctx) {
  return testSection(ctx, "ttest", "tTest", (run, now) => {
    const type = select(
      [
        { value: "two", i18n: "tests.twoSample" },
        { value: "one", i18n: "tests.oneSample" },
        { value: "paired", i18n: "tests.paired" },
      ],
      { testid: "ttest-type", onChange: now },
    );
    const x = textInput({ value: DEP_X, testid: "ttest-x", inputmode: "decimal", onInput: run });
    const y = textInput({ value: DEP_Y, testid: "ttest-y", inputmode: "decimal", onInput: run });
    const mu = textInput({ value: "0", testid: "ttest-mu", inputmode: "decimal", onInput: run });
    const alt = altSelect("ttest-alternative", now);
    const conf = textInput({ value: "0.95", testid: "ttest-conf", inputmode: "decimal", onInput: run });
    const varEqual = checkbox("opt.varEqual", { testid: "ttest-varEqual", onChange: now });
    const yField = field(null, y, { labelText: "y" });
    return {
      fields: [
        field("label.type", type),
        field(null, x, { labelText: "x" }),
        yField,
        h("div", { class: "field-row" }, field("label.mu", mu), field("label.confLevel", conf)),
        field("label.alternative", alt),
        h("div", { class: "checks" }, varEqual.el),
      ],
      sync() {
        yField.hidden = type.value === "one";
        varEqual.el.hidden = type.value !== "two";
      },
      compute() {
        const xs = parseNumbers(x.value);
        const ys = type.value === "one" ? null : parseNumbers(y.value);
        const m = parseNumber(mu.value);
        const cl = readConf(conf);
        const opts = {};
        const jsO = [];
        const rO = [];
        if (alt.value !== "two.sided") (opts.alternative = alt.value), jsO.push(["alternative", jsStr(alt.value)]), rO.push(`alternative = ${rStr(alt.value)}`);
        if (m !== 0) (opts.mu = m), jsO.push(["mu", jsNum(m)]), rO.push(`mu = ${rNum(m)}`);
        if (type.value === "paired") (opts.paired = true), jsO.push(["paired", "true"]), rO.push("paired = TRUE");
        if (type.value === "two" && varEqual.input.checked) (opts.varEqual = true), jsO.push(["varEqual", "true"]), rO.push("var.equal = TRUE");
        if (cl !== 0.95) (opts.confLevel = cl), jsO.push(["confLevel", jsNum(cl)]), rO.push(`conf.level = ${rNum(cl)}`);
        const result = ys ? ctx.lib.tTest(xs, ys, opts) : ctx.lib.tTest(xs, opts);
        const dx = vecDecl("x", xs);
        const dy = ys ? vecDecl("y", ys) : null;
        return {
          result,
          dataName: ys ? "x and y" : "x",
          js: `${ctx.importLine(["tTest"])}\n${dx.js}\n${dy ? `${dy.js}\n` : ""}tTest(${args("x", ys && "y", jsObj(jsO))});`,
          r: `${dx.r}\n${dy ? `${dy.r}\n` : ""}t.test(${args("x", ys && "y", ...rO)})`,
        };
      },
    };
  });
}

// ---------- chisqTest ----------

function chisqSection(ctx) {
  return testSection(ctx, "chisq", "chisqTest", (run, now) => {
    const mode = select(
      [
        { value: "matrix", i18n: "tests.contingency" },
        { value: "vector", i18n: "tests.goodness" },
      ],
      { testid: "chisq-mode", onChange: now },
    );
    const mat = textArea({ value: "762 327 468\n484 239 477", rows: 3, testid: "chisq-matrix", onInput: run });
    const vec = textInput({ value: "89, 37, 30, 28, 2", testid: "chisq-x", inputmode: "decimal", onInput: run });
    const p = textInput({ value: "0.40, 0.20, 0.20, 0.19, 0.01", testid: "chisq-p", inputmode: "decimal", onInput: run });
    p.dataset.i18nAttr = "placeholder:blankEqual";
    p.placeholder = t("blankEqual");
    const correct = checkbox("opt.correct", { checked: true, testid: "chisq-correct", onChange: now });
    const rescale = checkbox("opt.rescaleP", { testid: "chisq-rescale", onChange: now });
    const matField = field("label.matrix", mat, { hintKey: "hint.matrix" });
    const vecField = field(null, vec, { labelText: "x" });
    const pField = field(null, p, { labelText: "p" });
    return {
      fields: [field("label.type", mode), matField, vecField, pField, h("div", { class: "checks" }, correct.el, rescale.el)],
      sync() {
        const m = mode.value === "matrix";
        matField.hidden = !m;
        correct.el.hidden = !m;
        vecField.hidden = m;
        pField.hidden = m;
        rescale.el.hidden = m;
      },
      compute() {
        if (mode.value === "matrix") {
          const x = parseMatrix(mat.value);
          const opts = correct.input.checked ? {} : { correct: false };
          const result = ctx.lib.chisqTest(x, opts);
          return {
            result,
            dataName: "x",
            js: `${ctx.importLine(["chisqTest"])}\nconst x = ${jsMat(x)};\nchisqTest(${args("x", correct.input.checked ? "" : "{ correct: false }")});`,
            r: `x <- ${rMat(x)}\nchisq.test(${args("x", correct.input.checked ? "" : "correct = FALSE")})`,
          };
        }
        const x = parseNumbers(vec.value);
        const pr = p.value.trim() === "" ? undefined : parseNumbers(p.value);
        const opts = { ...(pr && { p: pr }), ...(rescale.input.checked && { rescaleP: true }) };
        const result = ctx.lib.chisqTest(x, opts);
        const jsO = jsObj([pr && ["p", jsArr(pr)], rescale.input.checked && ["rescaleP", "true"]]);
        return {
          result,
          dataName: "x",
          js: `${ctx.importLine(["chisqTest"])}\nconst x = ${jsArr(x)};\nchisqTest(${args("x", jsO)});`,
          r: `x <- ${rVec(x)}\nchisq.test(${args("x", pr && `p = ${rVec(pr)}`, rescale.input.checked && "rescale.p = TRUE")})`,
        };
      },
    };
  });
}

// ---------- fisherTest ----------

function fisherSection(ctx) {
  return testSection(ctx, "fisher", "fisherTest", (run, now) => {
    const mat = textArea({ value: "3 1\n1 3", rows: 3, testid: "fisher-matrix", onInput: run });
    const alt = altSelect("fisher-alternative", now);
    const conf = textInput({ value: "0.95", testid: "fisher-conf", inputmode: "decimal", onInput: run });
    const confInt = checkbox("opt.confInt", { checked: true, testid: "fisher-confInt", onChange: now });
    const presets = h(
      "div",
      { class: "preset-row" },
      h("span", { class: "hint", i18n: "label.presets" }),
      h("button", { type: "button", class: "btn btn-small", "data-testid": "fisher-preset-2x2", text: "2 × 2", on: { click: () => ((mat.value = "3 1\n1 3"), now()) } }),
      h("button", {
        type: "button",
        class: "btn btn-small",
        "data-testid": "fisher-preset-rxc",
        text: "3 × 3",
        on: { click: () => ((mat.value = "2 3 6\n4 1 2\n1 5 3"), now()) },
      }),
    );
    return {
      fields: [field("label.matrix", mat, { hintKey: "hint.matrix" }), presets, field("label.alternative", alt), field("label.confLevel", conf), h("div", { class: "checks" }, confInt.el)],
      compute() {
        const x = parseMatrix(mat.value);
        const cl = readConf(conf);
        const opts = {};
        const jsO = [];
        const rO = [];
        if (alt.value !== "two.sided") (opts.alternative = alt.value), jsO.push(["alternative", jsStr(alt.value)]), rO.push(`alternative = ${rStr(alt.value)}`);
        if (!confInt.input.checked) (opts.confInt = false), jsO.push(["confInt", "false"]), rO.push("conf.int = FALSE");
        if (cl !== 0.95) (opts.confLevel = cl), jsO.push(["confLevel", jsNum(cl)]), rO.push(`conf.level = ${rNum(cl)}`);
        const result = ctx.lib.fisherTest(x, opts);
        return {
          result,
          dataName: "x",
          js: `${ctx.importLine(["fisherTest"])}\nconst x = ${jsMat(x)};\nfisherTest(${args("x", jsObj(jsO))});`,
          r: `x <- ${rMat(x)}\nfisher.test(${args("x", ...rO)})`,
        };
      },
    };
  });
}

// ---------- wilcoxTest ----------

function wilcoxSection(ctx) {
  return testSection(ctx, "wilcox", "wilcoxTest", (run, now) => {
    const type = select(
      [
        { value: "paired", i18n: "tests.paired" },
        { value: "two", i18n: "tests.twoSample" },
        { value: "one", i18n: "tests.oneSample" },
      ],
      { testid: "wilcox-type", onChange: now },
    );
    const x = textInput({ value: DEP_X, testid: "wilcox-x", inputmode: "decimal", onInput: run });
    const y = textInput({ value: DEP_Y, testid: "wilcox-y", inputmode: "decimal", onInput: run });
    const mu = textInput({ value: "0", testid: "wilcox-mu", inputmode: "decimal", onInput: run });
    const alt = altSelect("wilcox-alternative", now);
    const exact = exactSelect("wilcox-exact", now);
    const conf = textInput({ value: "0.95", testid: "wilcox-conf", inputmode: "decimal", onInput: run });
    const correct = checkbox("opt.correct", { checked: true, testid: "wilcox-correct", onChange: now });
    const confInt = checkbox("opt.confInt", { checked: true, testid: "wilcox-confInt", onChange: now });
    const yField = field(null, y, { labelText: "y" });
    return {
      fields: [
        field("label.type", type),
        field(null, x, { labelText: "x" }),
        yField,
        h("div", { class: "field-row" }, field("label.mu", mu), field("label.confLevel", conf)),
        field("label.alternative", alt),
        field("label.exact", exact),
        h("div", { class: "checks" }, correct.el, confInt.el),
      ],
      sync() {
        yField.hidden = type.value === "one";
      },
      compute() {
        const xs = parseNumbers(x.value);
        const ys = type.value === "one" ? null : parseNumbers(y.value);
        const m = parseNumber(mu.value);
        const cl = readConf(conf);
        const opts = {};
        const jsO = [];
        const rO = [];
        if (alt.value !== "two.sided") (opts.alternative = alt.value), jsO.push(["alternative", jsStr(alt.value)]), rO.push(`alternative = ${rStr(alt.value)}`);
        if (m !== 0) (opts.mu = m), jsO.push(["mu", jsNum(m)]), rO.push(`mu = ${rNum(m)}`);
        if (type.value === "paired") (opts.paired = true), jsO.push(["paired", "true"]), rO.push("paired = TRUE");
        if (exact.value !== "auto") {
          const e = exact.value === "true";
          opts.exact = e;
          jsO.push(["exact", String(e)]);
          rO.push(`exact = ${e ? "TRUE" : "FALSE"}`);
        }
        if (!correct.input.checked) (opts.correct = false), jsO.push(["correct", "false"]), rO.push("correct = FALSE");
        if (confInt.input.checked) (opts.confInt = true), jsO.push(["confInt", "true"]), rO.push("conf.int = TRUE");
        if (cl !== 0.95) (opts.confLevel = cl), jsO.push(["confLevel", jsNum(cl)]), rO.push(`conf.level = ${rNum(cl)}`);
        const result = ys ? ctx.lib.wilcoxTest(xs, ys, opts) : ctx.lib.wilcoxTest(xs, opts);
        const dx = vecDecl("x", xs);
        const dy = ys ? vecDecl("y", ys) : null;
        return {
          result,
          dataName: ys ? "x and y" : "x",
          js: `${ctx.importLine(["wilcoxTest"])}\n${dx.js}\n${dy ? `${dy.js}\n` : ""}wilcoxTest(${args("x", ys && "y", jsObj(jsO))});`,
          r: `${dx.r}\n${dy ? `${dy.r}\n` : ""}wilcox.test(${args("x", ys && "y", ...rO)})`,
        };
      },
    };
  });
}

// ---------- cor / corTest ----------

function corSection(ctx) {
  return testSection(ctx, "cor", "cor / corTest", (run, now) => {
    const x = textInput({ value: "44.4, 45.9, 41.9, 53.3, 44.7, 44.1, 50.7, 45.2, 60.1", testid: "cor-x", inputmode: "decimal", onInput: run });
    const y = textInput({ value: "2.6, 3.1, 2.5, 5.0, 3.6, 4.0, 5.2, 2.8, 3.8", testid: "cor-y", inputmode: "decimal", onInput: run });
    const method = select(["pearson", "kendall", "spearman"].map((m) => ({ value: m, text: m })), { testid: "cor-method", onChange: now });
    const alt = altSelect("cor-alternative", now);
    const exact = exactSelect("cor-exact", now);
    const conf = textInput({ value: "0.95", testid: "cor-conf", inputmode: "decimal", onInput: run });
    const continuity = checkbox("opt.continuity", { testid: "cor-continuity", onChange: now });
    return {
      fields: [
        field(null, x, { labelText: "x" }),
        field(null, y, { labelText: "y" }),
        field("label.method", method),
        field("label.alternative", alt),
        field("label.exact", exact),
        field("label.confLevel", conf),
        h("div", { class: "checks" }, continuity.el),
      ],
      compute() {
        const xs = parseNumbers(x.value);
        const ys = parseNumbers(y.value);
        const cl = readConf(conf);
        const m = method.value;
        const opts = {};
        const jsO = [];
        const rO = [];
        if (alt.value !== "two.sided") (opts.alternative = alt.value), jsO.push(["alternative", jsStr(alt.value)]), rO.push(`alternative = ${rStr(alt.value)}`);
        if (m !== "pearson") (opts.method = m), jsO.push(["method", jsStr(m)]), rO.push(`method = ${rStr(m)}`);
        if (exact.value !== "auto") {
          const e = exact.value === "true";
          opts.exact = e;
          jsO.push(["exact", String(e)]);
          rO.push(`exact = ${e ? "TRUE" : "FALSE"}`);
        }
        if (cl !== 0.95) (opts.confLevel = cl), jsO.push(["confLevel", jsNum(cl)]), rO.push(`conf.level = ${rNum(cl)}`);
        if (continuity.input.checked) (opts.continuity = true), jsO.push(["continuity", "true"]), rO.push("continuity = TRUE");
        const r = ctx.lib.cor(xs, ys, { method: m });
        const result = ctx.lib.corTest(xs, ys, opts);
        const dx = vecDecl("x", xs);
        const dy = vecDecl("y", ys);
        const corJs = `cor(x, y${m === "pearson" ? "" : `, { method: ${jsStr(m)} }`})`;
        const corR = `cor(x, y${m === "pearson" ? "" : `, method = ${rStr(m)}`})`;
        return {
          result,
          dataName: "x and y",
          extraEl: h("p", { class: "mono", "data-testid": "cor-value" }, `${corJs} = `, h("strong", { text: fmt(r) })),
          js: `${ctx.importLine(["cor", "corTest"])}\n${dx.js}\n${dy.js}\n${corJs};\ncorTest(${args("x", "y", jsObj(jsO))});`,
          r: `${dx.r}\n${dy.r}\nprint(${corR}, digits = 17)\ncor.test(${args("x", "y", ...rO)})`,
        };
      },
    };
  });
}

// ---------- pAdjust ----------

const PMETHODS = ["holm", "hochberg", "hommel", "bonferroni", "BH", "BY", "fdr", "none"];

function padjustSection(ctx) {
  return testSection(ctx, "padjust", "pAdjust", (run) => {
    const p = textInput({ value: "0.01, 0.02, 0.03, 0.04, 0.05, 0.2, 0.5", testid: "padjust-p", inputmode: "decimal", onInput: run });
    const n = textInput({ value: "", testid: "padjust-n", inputmode: "numeric", onInput: run });
    n.dataset.i18nAttr = "placeholder:blankLength";
    n.placeholder = t("blankLength");
    return {
      fields: [field(null, p, { labelText: "p", hintKey: "hint.commaList" }), field(null, n, { labelText: "n" })],
      compute() {
        const ps = parseNumbers(p.value);
        const nn = parseOptional(n.value);
        const res = Object.fromEntries(PMETHODS.map((m) => [m, ctx.lib.pAdjust(ps, nn === undefined ? { method: m } : { method: m, n: nn })]));
        const nJs = nn === undefined ? "" : `, n: ${jsNum(nn)}`;
        const nR = nn === undefined ? "" : `, n = ${rNum(nn)}`;
        return {
          result: res,
          noPrint: true,
          extraEl: table(
            ["p", ...PMETHODS],
            ps.map((v, i) => [fmt(v), ...PMETHODS.map((m) => fmt(res[m][i]))]),
            { testid: "padjust-table", className: "data-table compact" },
          ),
          js: `${ctx.importLine(["pAdjust"])}\nconst p = ${jsArr(ps)};\nconst methods = [${PMETHODS.map(jsStr).join(", ")}];\nObject.fromEntries(methods.map((method) => [method, pAdjust(p, { method${nJs} })]));`,
          r: `p <- ${rVec(ps)}\nprint(sapply(p.adjust.methods, function(m) p.adjust(p, m${nR})), digits = 17)`,
        };
      },
    };
  });
}


// ---------- the other tests (one section, with the test chosen from a list) ----------

const GROUPS = "2.9 3.0 2.5 2.6 3.2\n3.8 2.7 4.0 2.4\n2.8 3.4 3.7 2.2 2.0";
const BLOCKS = "31 27 24\n31 28 31\n45 29 46\n21 18 48\n42 36 46\n32 17 40";
const STRATA = "0 0\n6 5\n\n3 0\n3 6\n\n6 2\n0 4\n\n5 6\n1 0\n\n2 5\n0 0";

/** Groups: one sample per line */
const parseGroups = (text) => parseMatrixRagged(text);
function parseMatrixRagged(text) {
  const rows = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => parseNumbers(l));
  if (rows.length === 0) throw new Error(t("err.emptyMatrix"));
  return rows;
}
/** 2 x 2 (or I x J) tables separated by blank lines */
function parseStrata(text) {
  return text.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => parseMatrix(b));
}
const groupsDecl = (g) => ({ js: `const groups = [${g.map(jsArr).join(", ")}];`, r: `groups <- list(${g.map(rVec).join(", ")})` });
const longDecl = (g) => ({
  js: `${groupsDecl(g).js}\nconst x = groups.flat();\nconst g = groups.flatMap((s, i) => s.map(() => i + 1));`,
  r: `${groupsDecl(g).r}\nx <- unlist(groups)\ng <- factor(rep(seq_along(groups), lengths(groups)))`,
});
const rStrata = (k) => `array(${rVec(k.flatMap((m) => m[0].map((_, j) => m.map((row) => row[j])).flat()))}, dim = c(${k[0].length}, ${k[0][0].length}, ${k.length}))`;

function pairwiseTable(r) {
  return table(["", ...r.colNames], r.rowNames.map((name, i) => [name, ...r.pValue[i].map((v) => (Number.isNaN(v) ? "-" : fmt(v)))]), {
    testid: "more-pairwise",
    className: "data-table compact",
  });
}

/**
 * The tests. inputs: which inputs are shown (x, y, groups, matrix, strata, counts); run(lib, d) gives the result;
 * code(d) gives { js, r } after the data declarations; view(result) an extra table (non-htest results).
 */
const MORE = [
  { id: "binomTest", inputs: ["counts"], counts: [["x", "7"], ["n", "20"], ["p", "0.3"]],
    run: (l, d) => l.binomTest(d.x, d.n, { p: d.p }), code: (d) => ({ js: `binomTest(${d.x}, ${d.n}, { p: ${jsNum(d.p)} })`, r: `binom.test(${d.x}, ${d.n}, p = ${rNum(d.p)})` }) },
  { id: "poissonTest", inputs: ["counts"], counts: [["x", "10"], ["T", "2"], ["r", "3"]],
    run: (l, d) => l.poissonTest(d.x, { T: d.T, r: d.r }), code: (d) => ({ js: `poissonTest(${d.x}, { T: ${jsNum(d.T)}, r: ${jsNum(d.r)} })`, r: `poisson.test(${d.x}, ${rNum(d.T)}, r = ${rNum(d.r)})` }) },
  { id: "propTest", inputs: ["x", "y"], labels: ["x", "n"], x: "83, 90, 129, 70", y: "86, 93, 136, 82",
    run: (l, d) => l.propTest(d.x, d.y), code: () => ({ js: "propTest(x, n)", r: "prop.test(x, n)" }), names: ["x", "n"] },
  { id: "mcnemarTest", inputs: ["matrix"], matrix: "794 86\n150 570", run: (l, d) => l.mcnemarTest(d.m), code: () => ({ js: "mcnemarTest(m)", r: "mcnemar.test(m)" }) },
  { id: "varTest", inputs: ["x", "y"], run: (l, d) => l.varTest(d.x, d.y), code: () => same2("varTest(x, y)", "var.test(x, y)") },
  { id: "moodTest", inputs: ["x", "y"], run: (l, d) => l.moodTest(d.x, d.y), code: () => same2("moodTest(x, y)", "mood.test(x, y)") },
  { id: "ansariTest", inputs: ["x", "y"], run: (l, d) => l.ansariTest(d.x, d.y), code: () => same2("ansariTest(x, y)", "ansari.test(x, y)") },
  { id: "ksTest", inputs: ["x", "y"], run: (l, d) => l.ksTest(d.x, d.y), code: () => same2("ksTest(x, y)", "ks.test(x, y)") },
  { id: "shapiroTest", inputs: ["x"], run: (l, d) => l.shapiroTest(d.x), code: () => same2("shapiroTest(x)", "shapiro.test(x)") },
  { id: "zTest", inputs: ["x", "counts"], counts: [["mu", "1.5"], ["sigmaX", "0.6"]],
    run: (l, d) => l.zTest(d.x, { mu: d.mu, sigmaX: d.sigmaX }), code: (d) => ({ js: `zTest(x, { mu: ${jsNum(d.mu)}, sigmaX: ${jsNum(d.sigmaX)} })`, r: `BSDA::z.test(x, mu = ${rNum(d.mu)}, sigma.x = ${rNum(d.sigmaX)})` }) },
  { id: "bartlettTest", inputs: ["groups"], run: (l, d) => l.bartlettTest(d.g), code: () => same2("bartlettTest(groups)", "bartlett.test(groups)") },
  { id: "kruskalTest", inputs: ["groups"], run: (l, d) => l.kruskalTest(d.g), code: () => same2("kruskalTest(groups)", "kruskal.test(groups)") },
  { id: "flignerTest", inputs: ["groups"], run: (l, d) => l.flignerTest(d.g), code: () => same2("flignerTest(groups)", "fligner.test(groups)") },
  { id: "onewayTest", inputs: ["groups"], long: true, run: (l, d) => l.onewayTest(d.g), code: () => same2("onewayTest(groups)", "oneway.test(x ~ g)") },
  { id: "friedmanTest", inputs: ["blocks"], run: (l, d) => l.friedmanTest(d.m), code: () => same2("friedmanTest(m)", "friedman.test(m)") },
  { id: "quadeTest", inputs: ["blocks"], run: (l, d) => l.quadeTest(d.m), code: () => same2("quadeTest(m)", "quade.test(m)") },
  { id: "mantelhaenTest", inputs: ["strata"], run: (l, d) => l.mantelhaenTest(d.k), code: (d) => ({ js: "mantelhaenTest(strata)", r: `mantelhaen.test(${rStrata(d.k)})` }) },
  { id: "pairwiseTTest", inputs: ["groups"], long: true, noPrint: true, run: (l, d) => l.pairwiseTTest(d.g.flat(), labelsOf(d.g)), code: () => same2("pairwiseTTest(x, g)", "pairwise.t.test(x, g)"), view: pairwiseTable },
  { id: "pairwiseWilcoxTest", inputs: ["groups"], long: true, noPrint: true, run: (l, d) => l.pairwiseWilcoxTest(d.g.flat(), labelsOf(d.g)), code: () => same2("pairwiseWilcoxTest(x, g)", "pairwise.wilcox.test(x, g)"), view: pairwiseTable },
  { id: "pairwisePropTest", inputs: ["x", "y"], labels: ["x", "n"], x: "83, 90, 129, 70", y: "86, 93, 136, 82", noPrint: true,
    run: (l, d) => l.pairwisePropTest(d.x, d.y), code: () => ({ js: "pairwisePropTest(x, n)", r: "pairwise.prop.test(x, n)" }), view: pairwiseTable, names: ["x", "n"] },
  { id: "aov", inputs: ["groups"], long: true, noPrint: true, run: (l, d) => l.aov(d.g), code: () => same2("aov(groups)", "summary(aov(x ~ g))"),
    view: (r) => table(["", "Df", "Sum Sq", "Mean Sq", "F value", "Pr(>F)"], [["g", r.df[0], fmt(r.sumSq[0]), fmt(r.meanSq[0]), fmt(r.fValue), fmt(r.pValue)], ["Residuals", r.df[1], fmt(r.sumSq[1]), fmt(r.meanSq[1]), "", ""]], { testid: "more-aov", className: "data-table compact" }) },
  { id: "TukeyHSD", inputs: ["groups"], long: true, noPrint: true, run: (l, d) => l.TukeyHSD(d.g), code: () => same2("TukeyHSD(groups)", "TukeyHSD(aov(x ~ g))"),
    view: (r) => table(["", "diff", "lwr", "upr", "p adj"], r.names.map((n, i) => [n, fmt(r.diff[i]), fmt(r.lwr[i]), fmt(r.upr[i]), fmt(r.pAdj[i])]), { testid: "more-tukey", className: "data-table compact" }) },
  { id: "lm", inputs: ["x", "y"], noPrint: true, x: "1, 2, 3, 4, 5, 6, 7, 8", y: "2.1, 3.9, 6.2, 7.8, 10.1, 12.2, 13.8, 16.1",
    run: (l, d) => l.lm(d.x, d.y), code: () => same2("lm(x, y)", "summary(lm(y ~ x))"),
    view: (r) => h(
      "div",
      {},
      table(["", "Estimate", "Std. Error", "t value", "Pr(>|t|)"], r.coefTable.estimate.map((e, i) => [i === 0 ? "(Intercept)" : "x", fmt(e), fmt(r.coefTable.stdError[i]), fmt(r.coefTable.tValue[i]), fmt(r.coefTable.pValue[i])]), { testid: "more-lm", className: "data-table compact" }),
      h("p", { class: "mono", text: `sigma = ${fmt(r.sigma)}, R² = ${fmt(r.rSquared)}, adj. R² = ${fmt(r.adjRSquared)}, F = ${r.fStatistic ? fmt(r.fStatistic.value) : "—"}, p = ${r.fPValue === undefined ? "—" : fmt(r.fPValue)}` }),
    ) },
];
const same2 = (js, r) => ({ js, r });
const labelsOf = (g) => g.flatMap((s, i) => s.map(() => i + 1));

function moreSection(ctx) {
  const tests = MORE.filter((m) => ctx.lib[m.id]);
  return testSection(ctx, "more", t("tests.more"), (run, now) => {
    const which = select(tests.map((m) => ({ value: m.id, text: m.id })), { testid: "more-test", onChange: () => change() });
    const x = textInput({ value: DEP_X, testid: "more-x", inputmode: "decimal", onInput: run });
    const y = textInput({ value: DEP_Y, testid: "more-y", inputmode: "decimal", onInput: run });
    const groups = textArea({ value: GROUPS, rows: 4, testid: "more-groups", onInput: run });
    const matrix = textArea({ value: "794 86\n150 570", rows: 3, testid: "more-matrix", onInput: run });
    const blocks = textArea({ value: BLOCKS, rows: 6, testid: "more-blocks", onInput: run });
    const strata = textArea({ value: STRATA, rows: 8, testid: "more-strata", onInput: run });
    const countInputs = [0, 1, 2].map((i) => textInput({ value: "", testid: `more-count-${i}`, inputmode: "decimal", onInput: run }));
    const xField = field(null, x, { labelText: "x" });
    const yField = field(null, y, { labelText: "y" });
    const fields = {
      x: xField,
      y: yField,
      groups: field("tests.groups", groups),
      matrix: field("tests.matrix", matrix),
      blocks: field("tests.blocks", blocks),
      strata: field("tests.strata", strata),
    };
    const countFields = countInputs.map((input) => field(null, input, { labelText: "" }));
    let spec = tests[0];
    function setDefaults() {
      spec = tests.find((m) => m.id === which.value);
      x.value = spec.x ?? DEP_X;
      y.value = spec.y ?? DEP_Y;
      if (spec.matrix) matrix.value = spec.matrix;
      (spec.counts ?? []).forEach(([, def], i) => (countInputs[i].value = def));
    }
    function change() {
      setDefaults();
      now();
    }
    setDefaults();
    return {
      fields: [field("label.test", which), ...Object.values(fields), h("div", { class: "field-row" }, ...countFields)],
      sync() {
        for (const [k, f] of Object.entries(fields)) f.hidden = !spec.inputs.includes(k);
        const [lx, ly] = spec.labels ?? ["x", "y"];
        xField.querySelector("label").textContent = lx;
        yField.querySelector("label").textContent = ly;
        countFields.forEach((f, i) => {
          const c = spec.counts?.[i];
          f.hidden = !c;
          if (c) f.querySelector("label").textContent = c[0];
        });
      },
      compute() {
        const d = {};
        const decl = [];
        const [nx, ny] = spec.names ?? ["x", "y"];
        if (spec.inputs.includes("x")) d.x = parseNumbers(x.value), decl.push(vecDecl(nx, d.x));
        if (spec.inputs.includes("y")) d.y = parseNumbers(y.value), decl.push(vecDecl(ny, d.y));
        if (spec.inputs.includes("groups")) d.g = parseGroups(groups.value), decl.push(spec.long ? longDecl(d.g) : groupsDecl(d.g));
        if (spec.inputs.includes("matrix")) d.m = parseMatrix(matrix.value), decl.push({ js: `const m = ${jsMat(d.m)};`, r: `m <- ${rMat(d.m)}` });
        if (spec.inputs.includes("blocks")) d.m = parseMatrix(blocks.value), decl.push({ js: `const m = ${jsMat(d.m)};`, r: `m <- ${rMat(d.m)}` });
        if (spec.inputs.includes("strata")) d.k = parseStrata(strata.value), decl.push({ js: `const strata = [${d.k.map(jsMat).join(", ")}];`, r: "" });
        (spec.counts ?? []).forEach(([name], i) => (d[name] = parseNumber(countInputs[i].value)));
        const result = spec.run(ctx.lib, d);
        const c = spec.code(d);
        return {
          result,
          dataName: [nx, ny].filter((n, i) => spec.inputs.includes(i ? "y" : "x")).join(" and ") || "data",
          noPrint: spec.noPrint,
          extraEl: spec.view?.(result),
          js: `${ctx.importLine([spec.id])}\n${decl.map((v) => v.js).filter(Boolean).join("\n")}${decl.length ? "\n" : ""}${c.js};`,
          r: `${decl.map((v) => v.r).filter(Boolean).join("\n")}${decl.some((v) => v.r) ? "\n" : ""}${c.r}`,
        };
      },
    };
  });
}

export function createTestsTab(ctx) {
  const sections = {
    ttest: tTestSection(ctx),
    chisq: chisqSection(ctx),
    fisher: fisherSection(ctx),
    wilcox: wilcoxSection(ctx),
    cor: corSection(ctx),
    padjust: padjustSection(ctx),
    more: moreSection(ctx),
  };
  const nav = segmented(
    [
      { value: "ttest", text: "tTest" },
      { value: "chisq", text: "chisqTest" },
      { value: "fisher", text: "fisherTest" },
      { value: "wilcox", text: "wilcoxTest" },
      { value: "cor", text: "cor / corTest" },
      { value: "padjust", text: "pAdjust" },
      ...(ctx.lib.binomTest ? [{ value: "more", i18n: "tests.more" }] : []),
    ],
    { labelKey: "tests.sections", testid: "tests-nav", onChange: show },
  );
  function show(v) {
    for (const [k, s] of Object.entries(sections)) s.el.hidden = k !== v;
  }
  show("ttest");
  const el = h("div", { class: "tab-body" }, nav.el, h("div", { class: "sub-panel" }, Object.values(sections).map((s) => s.el)), exampleSection(ctx, "tests"));
  return { el, update: () => Object.values(sections).forEach((s) => s.update()) };
}
