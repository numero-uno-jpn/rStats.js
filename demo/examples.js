// Curated examples (demo/examples.json) compared with R's output (demo/r-results.json): the example cards on each
// tab and the "Compare with R" tab.

import { getLang, t } from "./i18n.js";
import { codeBlock, fmt, fmtRelErr, fmtValue, h, select, setChildren, checkbox } from "./util.js";

export const TABS = ["distributions", "special", "random", "tests", "linalg"];

/** Parses one of R's "%.17g" strings. */
export function parseR(s) {
  if (typeof s === "number") return s;
  const v = String(s).trim();
  if (v === "NA" || v === "NaN" || v === "-NaN") return NaN;
  if (v === "Inf") return Infinity;
  if (v === "-Inf") return -Infinity;
  if (v === "TRUE") return 1;
  if (v === "FALSE") return 0;
  return Number(v);
}

/** Flattens a returned value into numbers (nested arrays and typed arrays). */
function flatten(v) {
  if (typeof v === "number") return [v];
  if (typeof v === "boolean") return [Number(v)];
  if (ArrayBuffer.isView(v)) return Array.from(v);
  if (Array.isArray(v)) return v.flatMap(flatten);
  throw new TypeError(t("cmp.notNumeric"));
}

/** Largest relative error (absolute where R's value is 0); Infinity if NaN/Inf do not match or lengths differ. */
export function maxRelErr(js, r) {
  if (js.length !== r.length) return Infinity;
  let worst = 0;
  for (let i = 0; i < js.length; i++) {
    const a = js[i];
    const b = r[i];
    if (!Number.isFinite(b) || !Number.isFinite(a)) {
      if (!(Object.is(a, b) || (Number.isNaN(a) && Number.isNaN(b)) || a === b)) return Infinity;
      continue;
    }
    const e = b === 0 ? Math.abs(a) : Math.abs(a - b) / Math.abs(b);
    if (e > worst) worst = e;
  }
  return worst;
}

/** Evaluates every example once and caches the results on ctx. */
export function evaluateAll(ctx) {
  if (ctx.evaluated) return ctx.evaluated;
  const names = Object.keys(ctx.lib);
  const fns = names.map((n) => ctx.lib[n]);
  const results = ctx.rResults?.results ?? {};
  ctx.evaluated = (ctx.examples ?? []).map((ex) => {
    const tol = ex.tol ?? 1e-12;
    const entry = { ex, tol, value: null, jsError: null, rValue: null, rError: null, relErr: NaN, pass: false, status: "fail" };
    try {
      entry.value = flatten(new Function(...names, `return (${ex.js});`)(...fns));
    } catch (e) {
      entry.jsError = `${e?.name ?? "Error"}: ${e?.message ?? e}`;
    }
    const r = results[ex.id];
    if (r == null) entry.status = "noR";
    else if (Array.isArray(r)) entry.rValue = r.map(parseR);
    else entry.rError = r.error ?? "error";
    if (entry.status !== "noR") {
      if (entry.rError != null || entry.jsError != null) {
        entry.pass = entry.rError != null && entry.jsError != null;
      } else {
        entry.relErr = maxRelErr(entry.value, entry.rValue);
        entry.pass = entry.relErr <= tol;
      }
      entry.status = entry.pass ? "pass" : "fail";
    }
    return entry;
  });
  return ctx.evaluated;
}

const title = (ex) => ex.title?.[getLang()] ?? ex.title?.en ?? ex.id;

function badge(entry) {
  return h("span", { class: `badge badge-${entry.status}`, "data-testid": "example-status", i18n: `cmp.${entry.status}` });
}

const jsShown = (e) => (e.jsError ? e.jsError : fmtValue(e.value.length === 1 ? e.value[0] : e.value));
const rShown = (e) => (e.rError ? `${t("cmp.rError")}: ${e.rError}` : e.rValue ? fmtValue(e.rValue.length === 1 ? e.rValue[0] : e.rValue) : "–");

function card(entry) {
  const { ex } = entry;
  const js = codeBlock("js", "code.js");
  js.set(ex.js);
  const r = codeBlock("r", "code.r");
  r.set(ex.r);
  return h(
    "article",
    { class: `example-card status-${entry.status}`, "data-testid": "example-card", "data-id": ex.id },
    h("header", { class: "example-head" }, h("h4", { text: title(ex) }), badge(entry)),
    js.el,
    r.el,
    h(
      "dl",
      { class: "example-values" },
      h("dt", { text: "rStats.js" }),
      h("dd", { class: "num", text: jsShown(entry) }),
      h("dt", { text: "R" }),
      h("dd", { class: "num", text: rShown(entry) }),
      h("dt", { i18n: "cmp.relErr" }),
      h("dd", { class: "num", text: `${fmtRelErr(entry.relErr)}  (${t("cmp.tol")} ${fmt(entry.tol)})` }),
    ),
  );
}

/** The examples section shown at the bottom of a tab. */
export function exampleSection(ctx, tab) {
  const body = h("div", { class: "example-grid" });
  const count = h("span", { class: "count" });
  const el = h(
    "section",
    { class: "examples", "data-testid": `examples-${tab}` },
    h(
      "div",
      { class: "examples-head" },
      h("h2", { class: "section-title" }, h("span", { i18n: "examples.title" }), " ", count),
      h("p", { class: "hint" }, h("span", { i18n: "examples.hint" }), " ", h("a", { href: "examples.R", download: "examples.R", i18n: "examples.rLink" })),
    ),
    body,
  );
  function render() {
    if (!ctx.examples) {
      setChildren(body, h("p", { class: "notice", i18n: "examples.missing" }));
      count.textContent = "";
      return;
    }
    const list = evaluateAll(ctx).filter((e) => e.ex.tab === tab);
    count.textContent = `(${list.length})`;
    setChildren(body, list.length ? list.map(card) : h("p", { class: "notice", i18n: "examples.none" }));
  }
  ctx.refreshers.push(render);
  render();
  return el;
}

export function createCompareTab(ctx) {
  const summary = h("div", { class: "compare-summary", "data-testid": "compare-summary" });
  const tbodyHost = h("div", { class: "compare-table-host" });
  const filter = select([{ value: "all", i18n: "cmp.allTabs" }, ...TABS.map((x) => ({ value: x, i18n: `tab.${x}` }))], {
    testid: "compare-filter",
    onChange: render,
  });
  const failuresOnly = checkbox("cmp.failuresOnly", { testid: "compare-failures", onChange: render });

  function render() {
    if (!ctx.examples) {
      setChildren(summary, h("p", { class: "notice", "data-testid": "compare-missing", i18n: "cmp.noExamples" }));
      setChildren(tbodyHost);
      return;
    }
    const all = evaluateAll(ctx);
    const pass = all.filter((e) => e.status === "pass").length;
    const fail = all.filter((e) => e.status === "fail").length;
    const noR = all.filter((e) => e.status === "noR").length;
    Object.assign(summary.dataset, { pass, fail, total: all.length, noR });
    const info = ctx.rResults
      ? h("p", { class: "hint" }, t("cmp.rInfo", ctx.rResults.r_version ?? "?", ctx.rResults.platform ?? "?", ctx.rResults.generated ?? "?"))
      : h("p", { class: "notice", "data-testid": "compare-no-r", i18n: "cmp.noRFile" });
    setChildren(
      summary,
      h(
        "div",
        { class: "summary-row" },
        h("div", { class: `big-count ${fail ? "has-fail" : "all-pass"}` }, h("span", { class: "num", text: `${pass} / ${all.length}` }), " ", h("span", { i18n: "cmp.passed" })),
        fail ? h("span", { class: "badge badge-fail", text: `${fail} ${t("cmp.failed")}` }) : null,
        noR ? h("span", { class: "badge badge-noR", text: `${noR} ${t("cmp.noRShort")}` }) : null,
      ),
      info,
    );
    const rows = all.filter((e) => (filter.value === "all" || e.ex.tab === filter.value) && (!failuresOnly.input.checked || e.status === "fail"));
    setChildren(
      tbodyHost,
      h(
        "div",
        { class: "table-wrap", tabindex: "0" },
        h(
          "table",
          { class: "data-table compare-table", "data-testid": "compare-table" },
          h(
            "thead",
            {},
            h(
              "tr",
              {},
              ["cmp.example", "cmp.tab", "rStats.js", "R", "cmp.relErr", "cmp.status"].map((k) =>
                h("th", { scope: "col", text: k.includes(".") && !k.endsWith(".js") ? t(k) : k }),
              ),
            ),
          ),
          h(
            "tbody",
            {},
            rows.map((e) =>
              h(
                "tr",
                { class: `status-${e.status}`, "data-id": e.ex.id },
                h("th", { scope: "row" }, h("div", { text: title(e.ex) }), h("code", { class: "small-code", text: e.ex.js })),
                h("td", { class: "tab-name", text: t(`tab.${e.ex.tab}`) }),
                h("td", { class: "num wrap", text: jsShown(e) }),
                h("td", { class: "num wrap", text: rShown(e) }),
                h("td", { class: "num", text: fmtRelErr(e.relErr) }),
                h("td", {}, badge(e)),
              ),
            ),
          ),
        ),
      ),
      rows.length ? null : h("p", { class: "notice", i18n: "cmp.empty" }),
    );
  }

  const el = h(
    "div",
    { class: "tab-body" },
    h(
      "section",
      { class: "card" },
      h("h2", { class: "card-title", i18n: "tab.compare" }),
      h("p", { class: "hint" }, h("span", { i18n: "cmp.intro" }), " ", h("a", { href: "examples.R", download: "examples.R", i18n: "examples.rLink" })),
      summary,
      h("div", { class: "toolbar" }, h("label", { class: "inline-label" }, h("span", { i18n: "cmp.filter" }), filter), failuresOnly.el),
      tbodyHost,
    ),
  );
  ctx.refreshers.push(render);
  render();
  return { el, update: render };
}
