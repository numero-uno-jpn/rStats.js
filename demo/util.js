// Shared helpers: DOM construction, parsing of user input, number formatting, code generation, copy buttons.

import { t } from "./i18n.js";

/**
 * Creates an element. props: class, text, i18n (key for textContent), i18nAttr ({ attr: key }), on ({ event: fn }),
 * dataset, and any other attribute (false/null/undefined are skipped, true sets an empty attribute).
 */
export function h(tag, props = {}, ...children) {
  const el = tag === "svg" || props.svg ? document.createElementNS("http://www.w3.org/2000/svg", tag) : document.createElement(tag);
  const { text, i18n, i18nAttr, on, dataset, svg, ...attrs } = props;
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === "class") el.setAttribute("class", v);
    else if (k === "value" && "value" in el) el.value = v;
    else if (k === "checked") el.checked = Boolean(v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  if (dataset) Object.assign(el.dataset, dataset);
  if (i18n) {
    el.dataset.i18n = i18n;
    el.textContent = t(i18n);
  } else if (text != null) el.textContent = text;
  if (i18nAttr) {
    el.dataset.i18nAttr = Object.entries(i18nAttr).map(([a, key]) => `${a}:${key}`).join(";");
    for (const [a, key] of Object.entries(i18nAttr)) el.setAttribute(a, t(key));
  }
  for (const [ev, fn] of Object.entries(on ?? {})) el.addEventListener(ev, fn);
  appendAll(el, children);
  return el;
}

function appendAll(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Replaces the children of el. */
export function setChildren(el, ...children) {
  el.replaceChildren();
  appendAll(el, children);
}

let idCounter = 0;
export const uid = (prefix = "f") => `${prefix}-${++idCounter}`;

/** Storage that never throws (private windows, blocked site data). */
export const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
};

// ---------- parsing ----------

const SPECIAL = { inf: Infinity, "+inf": Infinity, infinity: Infinity, "-inf": -Infinity, "-infinity": -Infinity, nan: NaN, na: NaN };

/** Parses one number; accepts JS and R spellings of the special values (Inf, -Inf, NaN, NA, Infinity). */
export function parseNumber(token) {
  const s = token.trim();
  const special = SPECIAL[s.toLowerCase()];
  if (special !== undefined) return special;
  const x = Number(s);
  if (s === "" || Number.isNaN(x)) throw new Error(t("err.parseNumber", s));
  return x;
}

/** Parses "1, 2 3;4" into [1, 2, 3, 4]. Brackets and c( ) are ignored so that pasted R/JS vectors work. */
export function parseNumbers(text, { allowEmpty = false } = {}) {
  const cleaned = text.replace(/^\s*c\s*\(/, "").replace(/[[\]()]/g, " ");
  const tokens = cleaned.split(/[\s,;]+/).filter(Boolean);
  if (tokens.length === 0 && !allowEmpty) throw new Error(t("err.empty"));
  return tokens.map(parseNumber);
}

/** Parses a matrix: one row per line, numbers separated by spaces or commas. */
export function parseMatrix(text, { allowEmpty = false } = {}) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseNumbers(line));
  if (rows.length === 0) {
    if (allowEmpty) return null;
    throw new Error(t("err.emptyMatrix"));
  }
  const ncol = rows[0].length;
  rows.forEach((r, i) => {
    if (r.length !== ncol) throw new Error(t("err.ragged", i + 1, r.length, ncol));
  });
  return rows;
}

/** Parses an optional number field: blank gives undefined. */
export function parseOptional(text) {
  return text.trim() === "" ? undefined : parseNumber(text);
}

// ---------- number formatting ----------

/** Full precision (shortest round-trip representation), keeping the sign of -0. */
export function fmt(x) {
  if (typeof x !== "number") return String(x);
  if (Object.is(x, -0)) return "-0";
  return String(x);
}

/** Compact display of a value that may be a number, an array or a typed array. */
export function fmtValue(v) {
  if (typeof v === "number") return fmt(v);
  if (Array.isArray(v) || ArrayBuffer.isView(v)) return `[${Array.from(v, fmtValue).join(", ")}]`;
  return String(v);
}

export function fmtRelErr(e) {
  if (e == null || Number.isNaN(e)) return "–";
  if (e === 0) return "0";
  if (!Number.isFinite(e)) return "∞";
  return e.toExponential(1);
}

// ---------- code generation ----------

export function jsNum(x) {
  if (Number.isNaN(x)) return "NaN";
  if (x === Infinity) return "Infinity";
  if (x === -Infinity) return "-Infinity";
  return fmt(x);
}

export function rNum(x) {
  if (Number.isNaN(x)) return "NaN";
  if (x === Infinity) return "Inf";
  if (x === -Infinity) return "-Inf";
  return fmt(x);
}

export const jsArr = (a) => `[${a.map(jsNum).join(", ")}]`;
export const rVec = (a) => (a.length === 1 ? rNum(a[0]) : `c(${a.map(rNum).join(", ")})`);
/** A JS argument: a scalar for one value, an array otherwise. */
export const jsArg = (a) => (a.length === 1 ? jsNum(a[0]) : jsArr(a));
export const jsMat = (m) => `[${m.map(jsArr).join(", ")}]`;
export const rMat = (m) => `matrix(${rVec(m.flat())}, nrow = ${m.length}, byrow = TRUE)`;
export const jsStr = (s) => JSON.stringify(s);
export const rStr = (s) => JSON.stringify(s);
export const rBool = (b) => (b ? "TRUE" : "FALSE");

/** "{ a: 1, b: true }" from [key, literal] pairs, or "" if there are none. */
export function jsObj(pairs) {
  const list = pairs.filter(Boolean);
  return list.length ? `{ ${list.map(([k, v]) => `${k}: ${v}`).join(", ")} }` : "";
}

/** Joins JS call arguments, dropping empty ones. */
export const args = (...list) => list.filter((a) => a !== "" && a != null).join(", ");


// ---------- copy ----------

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for insecure contexts (file:// or plain http on another host)
    const ta = h("textarea", { "aria-hidden": "true", style: "position:fixed;top:-1000px;opacity:0" });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

/** A code block with a language label and a copy button. Returns { el, set(code) }. */
export function codeBlock(lang, labelKey, testid) {
  const code = h("code", { class: `lang-${lang}` });
  const status = h("span", { class: "copy-status", "aria-live": "polite" });
  const button = h("button", {
    type: "button",
    class: "btn btn-small copy-btn",
    i18n: "copy",
    "data-testid": testid ? `${testid}-copy` : null,
    on: {
      click: async () => {
        const ok = await copyText(code.textContent);
        status.textContent = t(ok ? "copied" : "copyFailed");
        setTimeout(() => (status.textContent = ""), 1600);
      },
    },
  });
  const el = h(
    "div",
    { class: "code-block", "data-testid": testid },
    h("div", { class: "code-head" }, h("span", { class: "code-lang", i18n: labelKey }), status, button),
    h("pre", { tabindex: "0" }, code),
  );
  return {
    el,
    set(text) {
      code.textContent = text;
    },
  };
}

/** R and JS code side by side. Returns { el, set(r, js) }. */
export function codePanel(testid) {
  const r = codeBlock("r", "code.r", testid ? `${testid}-r` : null);
  const js = codeBlock("js", "code.js", testid ? `${testid}-js` : null);
  const el = h(
    "section",
    { class: "code-panel" },
    h("h3", { class: "sub-heading", i18n: "code.heading" }),
    h("p", { class: "hint", i18n: "code.hint" }),
    h("div", { class: "code-grid" }, r.el, js.el),
  );
  return {
    el,
    set(rCode, jsCode) {
      r.set(rCode);
      js.set(jsCode);
    },
  };
}

// ---------- form controls ----------

/** A labelled control. */
export function field(labelKey, control, { hintKey, labelText, wide } = {}) {
  const id = control.id || uid();
  control.id = id;
  const label = labelText != null ? h("label", { for: id, text: labelText }) : h("label", { for: id, i18n: labelKey });
  return h("div", { class: `field${wide ? " field-wide" : ""}` }, label, control, hintKey ? h("small", { class: "hint", i18n: hintKey }) : null);
}

export function checkbox(labelKey, { checked = false, testid, onChange } = {}) {
  const input = h("input", { type: "checkbox", checked, "data-testid": testid, on: onChange ? { change: onChange } : {} });
  const el = h("label", { class: "check" }, input, h("span", { i18n: labelKey }));
  return { el, input };
}

/** A select with options [{ value, i18n } | { value, text }]. */
export function select(options, { value, testid, onChange, id } = {}) {
  const el = h(
    "select",
    { "data-testid": testid, id, on: onChange ? { change: onChange } : {} },
    options.map((o) => h("option", { value: o.value, i18n: o.i18n, text: o.text })),
  );
  if (value != null) el.value = value;
  return el;
}

/** Segmented control (a group of toggle buttons). Calls onChange(value). Returns { el, get(), set(v) }. */
export function segmented(options, { value, labelKey, testid, onChange }) {
  let current = value ?? options[0].value;
  const buttons = options.map((o) =>
    h("button", {
      type: "button",
      class: "seg-btn",
      "data-value": o.value,
      "data-testid": testid ? `${testid}-${o.value}` : null,
      i18n: o.i18n,
      text: o.text,
      on: {
        click: () => {
          set(o.value);
          onChange?.(o.value);
        },
      },
    }),
  );
  const el = h("div", { class: "segmented", role: "group", i18nAttr: labelKey ? { "aria-label": labelKey } : null }, buttons);
  function set(v) {
    current = v;
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.value === v));
  }
  set(current);
  return { el, get: () => current, set };
}

export function textInput({ value = "", testid, inputmode, placeholder, onInput } = {}) {
  return h("input", {
    type: "text",
    value,
    "data-testid": testid,
    inputmode,
    placeholder,
    autocomplete: "off",
    spellcheck: "false",
    on: onInput ? { input: onInput } : {},
  });
}

export function textArea({ value = "", rows = 3, testid, onInput } = {}) {
  const el = h("textarea", { rows, "data-testid": testid, spellcheck: "false", autocomplete: "off", on: onInput ? { input: onInput } : {} });
  el.value = value;
  return el;
}

/** An error box next to a form. Returns { el, show(err), clear() }. */
export function errorBox(testid) {
  const el = h("div", { class: "error-box", role: "alert", hidden: true, "data-testid": testid });
  return {
    el,
    show(err) {
      const name = err?.name && err.name !== "Error" ? `${err.name}: ` : "";
      el.textContent = `${t("error")}: ${name}${err?.message ?? String(err)}`;
      el.hidden = false;
    },
    clear() {
      el.textContent = "";
      el.hidden = true;
    },
  };
}

/** Debounces fn so that typing does not recompute on every keystroke. */
export function debounce(fn, ms = 150) {
  let timer;
  return (...a) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...a), ms);
  };
}

// ---------- output rendering ----------

/** A two-column (or more) table: headers and rows of strings. */
export function table(headers, rows, { testid, className = "data-table" } = {}) {
  return h(
    "div",
    { class: "table-wrap", tabindex: "0" },
    h(
      "table",
      { class: className, "data-testid": testid },
      h("thead", {}, h("tr", {}, headers.map((x) => h("th", { scope: "col", text: x })))),
      h("tbody", {}, rows.map((r) => h("tr", {}, r.map((c, i) => (i === 0 ? h("th", { scope: "row", text: c }) : h("td", { text: c })))))),
    ),
  );
}

/** A matrix in R's layout: [1,] row labels and [,1] column labels. cell(x) formats an entry. */
export function matrixView(m, cell = fmt) {
  const ncol = m[0]?.length ?? 0;
  return h(
    "div",
    { class: "table-wrap matrix-wrap", tabindex: "0" },
    h(
      "table",
      { class: "matrix" },
      h("thead", {}, h("tr", {}, h("th", {}), Array.from({ length: ncol }, (_, j) => h("th", { scope: "col", text: `[,${j + 1}]` })))),
      h("tbody", {}, m.map((row, i) => h("tr", {}, h("th", { scope: "row", text: `[${i + 1},]` }), Array.from(row, (x) => h("td", { text: cell(x) }))))),
    ),
  );
}

/** A vector as an R-style indexed row. */
export function vectorView(v, cell = fmt) {
  return h(
    "div",
    { class: "vector" },
    Array.from(v, (x, i) => h("span", { class: "vec-item" }, h("span", { class: "vec-index", text: `[${i + 1}]` }), h("span", { class: "num", text: cell(x) }))),
  );
}

const isMatrix = (v) => Array.isArray(v) && v.length > 0 && v.every((r) => Array.isArray(r) || ArrayBuffer.isView(r));

/** Renders any value returned by the library: number, vector, matrix, or object of those. */
export function valueView(v) {
  if (typeof v === "number") return h("div", { class: "scalar num", text: fmt(v) });
  if (typeof v === "boolean" || typeof v === "string") return h("div", { class: "scalar num", text: String(v) });
  if (isMatrix(v)) return matrixView(v);
  if (Array.isArray(v) || ArrayBuffer.isView(v)) return v.length ? vectorView(v) : h("div", { class: "scalar num", text: "[]" });
  if (v && typeof v === "object")
    return h(
      "dl",
      { class: "object-view" },
      Object.entries(v).map(([k, x]) => [h("dt", { class: "mono", text: k }), h("dd", {}, valueView(x))]),
    );
  return h("div", { class: "scalar num", text: String(v) });
}

/** JSON with non-finite numbers written as strings (JSON.stringify would turn them into null). */
export function toJSON(v) {
  return JSON.stringify(
    v,
    (_, x) => {
      if (typeof x === "number" && !Number.isFinite(x)) return String(x);
      if (ArrayBuffer.isView(x)) return Array.from(x);
      return x;
    },
    2,
  );
}

/** A collapsible raw-JSON view. */
export function jsonDetails(v, testid) {
  return h(
    "details",
    { class: "json-details" },
    h("summary", { i18n: "rawJson" }),
    h("pre", { class: "json", "data-testid": testid, tabindex: "0" }, h("code", { text: toJSON(v) })),
  );
}
