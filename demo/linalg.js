// Linear algebra tab: one matrix A, an optional right-hand side b / B / y, and every operation of the library.

import { t } from "./i18n.js";
import {
  args, checkbox, codePanel, debounce, errorBox, field, fmt, h, jsMat, jsArr, jsonDetails, matrixView, parseMatrix, rMat, rVec, select,
  setChildren, textArea, valueView, vectorView,
} from "./util.js";
import { exampleSection } from "./examples.js";

const PRESETS = [
  { id: "spd", a: "4 2 0.6\n2 5 1\n0.6 1 3", b: "1 2 3" },
  { id: "nonsym", a: "1 -2 0\n2 1 0\n0 0 3", b: "1 0 2" },
  { id: "tall", a: "1 1\n1 2\n1 3\n1 4", b: "1 3 4 4" },
  { id: "upper", a: "2 1 3\n0 4 1\n0 0 5", b: "1 2 3" },
  { id: "singular", a: "1 2\n2 4", b: "1 2" },
];

/**
 * Operations. b: "none" | "optional" | "required" (the right-hand side); opts: names of option controls used.
 * run(lib, A, B, o) computes; code(B, o) gives { js, r } for the call, where B is the variable name of the
 * right-hand side (b or B) or null.
 */
const OPS = [
  { id: "t", run: (l, A) => l.t(A), code: () => same("t(A)") },
  { id: "diag", run: (l, A) => l.diag(A), code: () => same("diag(A)") },
  { id: "matMul", b: "required", run: (l, A, B) => l.matMul(A, B), code: (B) => ({ js: `matMul(A, ${B})`, r: `A %*% ${B}` }) },
  ...[
    ["add", "+"],
    ["subtract", "-"],
    ["multiply", "*"],
    ["divide", "/"],
  ].map(([id, op]) => ({ id, b: "required", run: (l, A, B) => l[id](A, B), code: (B) => ({ js: `${id}(A, ${B})`, r: `A ${op} ${B}` }) })),
  { id: "kronecker", b: "required", run: (l, A, B) => l.kronecker(A, B), code: (B) => same(`kronecker(A, ${B})`) },
  { id: "cbind", b: "required", run: (l, A, B) => l.cbind(A, B), code: (B) => same(`cbind(A, ${B})`) },
  { id: "rbind", b: "required", run: (l, A, B) => l.rbind(A, B), code: (B) => same(`rbind(A, ${B})`) },
  { id: "crossprod", b: "optional", run: (l, A, B) => (B ? l.crossprod(A, B) : l.crossprod(A)), code: (B) => same(`crossprod(${args("A", B)})`) },
  // a one-line right-hand side is taken as a 1-row matrix, so that A %*% t(B) is defined
  { id: "tcrossprod", b: "optional", rowB: true, run: (l, A, B) => (B ? l.tcrossprod(A, B) : l.tcrossprod(A)), code: (B) => same(`tcrossprod(${args("A", B)})`) },
  {
    id: "norm",
    opts: ["normType"],
    run: (l, A, B, o) => l.norm(A, { type: o.normType }),
    code: (B, o) => ({ js: `norm(A, { type: "${o.normType}" })`, r: `norm(A, type = "${o.normType}")` }),
  },
  {
    id: "backsolve",
    b: "required",
    opts: ["transpose"],
    run: (l, A, B, o) => l.backsolve(A, B, o.transpose ? { transpose: true } : {}),
    code: (B, o) => ({ js: `backsolve(${args("A", B, o.transpose && "{ transpose: true }")})`, r: `backsolve(${args("A", B, o.transpose && "transpose = TRUE")})` }),
  },
  {
    id: "forwardsolve",
    b: "required",
    opts: ["transpose"],
    run: (l, A, B, o) => l.forwardsolve(A, B, o.transpose ? { transpose: true } : {}),
    code: (B, o) => ({ js: `forwardsolve(${args("A", B, o.transpose && "{ transpose: true }")})`, r: `forwardsolve(${args("A", B, o.transpose && "transpose = TRUE")})` }),
  },
  {
    id: "chol",
    opts: ["pivot"],
    run: (l, A, B, o) => (o.pivot ? l.chol(A, { pivot: true }) : l.chol(A)),
    code: (B, o) => ({ js: `chol(${args("A", o.pivot && "{ pivot: true }")})`, r: `chol(${args("A", o.pivot && "pivot = TRUE")})${o.pivot ? "  # pivot is 1-based in R" : ""}` }),
  },
  { id: "chol2inv", run: (l, A) => l.chol2inv(l.chol(A)), code: () => same("chol2inv(chol(A))") },
  { id: "qr", run: (l, A) => l.qr(A), code: () => same("qr(A)") },
  ...["qrQ", "qrR", "qrX"].map((id) => ({
    id,
    opts: ["complete"],
    run: (l, A, B, o) => l[id](l.qr(A), o.complete ? { complete: true } : {}),
    code: (B, o) => ({
      js: `${id}(${args("qr(A)", o.complete && "{ complete: true }")})`,
      r: `qr.${id.slice(2)}(${args("qr(A)", o.complete && "complete = TRUE")})`,
    }),
  })),
  ...[
    ["qrCoef", "qr.coef"],
    ["qrQy", "qr.qy"],
    ["qrQty", "qr.qty"],
    ["qrResid", "qr.resid"],
    ["qrFitted", "qr.fitted"],
  ].map(([id, rName]) => ({
    id,
    b: "required",
    run: (l, A, B) => l[id](l.qr(A), B),
    code: (B) => ({ js: `${id}(qr(A), ${B})`, r: `${rName}(qr(A), ${B})` }),
  })),
  { id: "qrSolve", b: "optional", run: (l, A, B) => (B ? l.qrSolve(A, B) : l.qrSolve(A)), code: (B) => ({ js: `qrSolve(${args("A", B)})`, r: `qr.solve(${args("A", B)})` }) },
  { id: "rank", run: (l, A) => l.qr(A).rank, code: () => ({ js: "qr(A).rank", r: "qr(A)$rank" }), fns: ["qr"] },
  { id: "pivot", run: (l, A) => l.qr(A).pivot, code: () => ({ js: "qr(A).pivot", r: "qr(A)$pivot - 1  # rStats.js is 0-based" }), fns: ["qr"] },
  { id: "solve", b: "optional", run: (l, A, B) => (B ? l.solve(A, B) : l.solve(A)), code: (B) => same(`solve(${args("A", B)})`) },
  { id: "det", run: (l, A) => l.det(A), code: () => same("det(A)") },
  {
    id: "determinant",
    opts: ["logarithm"],
    run: (l, A, B, o) => l.determinant(A, { logarithm: o.logarithm }),
    code: (B, o) => ({ js: `determinant(${args("A", !o.logarithm && "{ logarithm: false }")})`, r: `determinant(${args("A", !o.logarithm && "logarithm = FALSE")})` }),
  },
  {
    id: "rcond",
    opts: ["rcondNorm"],
    run: (l, A, B, o) => l.rcond(A, { norm: o.rcondNorm }),
    code: (B, o) => ({ js: `rcond(${args("A", o.rcondNorm !== "O" && `{ norm: "${o.rcondNorm}" }`)})`, r: `rcond(${args("A", o.rcondNorm !== "O" && `norm = "${o.rcondNorm}"`)})` }),
  },
  {
    id: "kappa",
    opts: ["exact"],
    run: (l, A, B, o) => l.kappa(A, o.exact ? { exact: true } : {}),
    code: (B, o) => ({ js: `kappa(${args("A", o.exact && "{ exact: true }")})`, r: `kappa(${args("A", o.exact && "exact = TRUE")})` }),
  },
  { id: "svd", run: (l, A) => l.svd(A), code: () => same("svd(A)") },
  {
    id: "eigen",
    opts: ["symmetric", "onlyValues"],
    run: (l, A, B, o) => l.eigen(A, eigenOpts(o)),
    code: (B, o) => {
      const e = eigenOpts(o);
      const js = Object.entries(e).map(([k, v]) => `${k}: ${v}`);
      const r = Object.entries(e).map(([k, v]) => `${k === "onlyValues" ? "only.values" : k} = ${v ? "TRUE" : "FALSE"}`);
      return { js: `eigen(${args("A", js.length && `{ ${js.join(", ")} }`)})`, r: `eigen(${args("A", ...r)})` };
    },
  },
  { id: "ginv", run: (l, A) => l.ginv(A), code: () => ({ js: "ginv(A)", r: "MASS::ginv(A)" }) },
  { id: "lu", run: (l, A) => l.lu(A), code: () => ({ js: "lu(A)", r: "Matrix::expand(Matrix::lu(A))  # P, L, U with A = P L U" }) },
  { id: "prcomp", run: (l, A) => l.prcomp(A), code: () => same("prcomp(A)") },
];

function same(code) {
  return { js: code, r: code };
}

function eigenOpts(o) {
  const e = {};
  if (o.symmetric !== "auto") e.symmetric = o.symmetric === "true";
  if (o.onlyValues) e.onlyValues = true;
  return e;
}

/** "a + bi" with full precision. */
function complex(re, im) {
  if (!im) return fmt(re);
  return `${fmt(re)} ${im < 0 || Object.is(im, -0) ? "−" : "+"} ${fmt(Math.abs(im))}i`;
}

/** eigen() results, with complex values and vectors shown as a ± bi. */
function eigenView(res) {
  if (!res.valuesIm) return valueView(res);
  const values = res.values.map((v, i) => complex(v, res.valuesIm[i]));
  const parts = [h("dt", { class: "mono", text: "values" }), h("dd", {}, vectorView(values, (s) => s))];
  if (res.vectors) {
    const m = res.vectors.map((row, i) => row.map((v, j) => complex(v, res.vectorsIm[i][j])));
    parts.push(h("dt", { class: "mono", text: "vectors" }), h("dd", {}, matrixView(m, (s) => s)));
  }
  return h("dl", { class: "object-view" }, parts);
}

export function createLinalgTab(ctx) {
  const { lib } = ctx;
  const err = errorBox("linalg-error");
  const output = h("div", { class: "output", "data-testid": "linalg-output" });
  const jsonHost = h("div");
  const code = codePanel("linalg-code");
  const run = debounce(update, 150);

  const aInput = textArea({ value: PRESETS[0].a, rows: 4, testid: "linalg-a", onInput: run });
  const bInput = textArea({ value: PRESETS[0].b, rows: 2, testid: "linalg-b", onInput: run });
  const opSelect = select(
    OPS.filter((o) => lib[o.id === "rank" || o.id === "pivot" ? "qr" : o.id]).map((o) => ({ value: o.id, text: o.id === "rank" || o.id === "pivot" ? `qr(A).${o.id}` : o.id })),
    { testid: "linalg-op", value: "solve", onChange: () => update() },
  );
  const controls = {
    normType: select(["O", "I", "F", "M", "2"].map((v) => ({ value: v, text: v })), { testid: "linalg-normType", onChange: () => update() }),
    rcondNorm: select(["O", "I"].map((v) => ({ value: v, text: v })), { testid: "linalg-rcondNorm", onChange: () => update() }),
    symmetric: select(
      [
        { value: "auto", i18n: "opt.symAuto" },
        { value: "true", text: "TRUE" },
        { value: "false", text: "FALSE" },
      ],
      { testid: "linalg-symmetric", onChange: () => update() },
    ),
    transpose: checkbox("opt.transpose", { testid: "linalg-transpose", onChange: () => update() }),
    pivot: checkbox("opt.pivot", { testid: "linalg-pivot", onChange: () => update() }),
    complete: checkbox("opt.complete", { testid: "linalg-complete", onChange: () => update() }),
    logarithm: checkbox("opt.logarithm", { checked: true, testid: "linalg-logarithm", onChange: () => update() }),
    exact: checkbox("opt.exactKappa", { testid: "linalg-exact", onChange: () => update() }),
    onlyValues: checkbox("opt.onlyValues", { testid: "linalg-onlyValues", onChange: () => update() }),
  };
  const optionEls = {
    normType: field("label.normType", controls.normType),
    rcondNorm: field("label.normType", controls.rcondNorm),
    symmetric: field("label.symmetric", controls.symmetric),
    transpose: controls.transpose.el,
    pivot: controls.pivot.el,
    complete: controls.complete.el,
    logarithm: controls.logarithm.el,
    exact: controls.exact.el,
    onlyValues: controls.onlyValues.el,
  };
  const bLabel = h("label", { for: "linalg-b-input" });
  bInput.id = "linalg-b-input";
  const bField = h("div", { class: "field" }, bLabel, bInput, h("small", { class: "hint", i18n: "hint.rhs" }));
  const presets = h(
    "div",
    { class: "preset-row" },
    h("span", { class: "hint", i18n: "label.presets" }),
    PRESETS.map((p) =>
      h("button", {
        type: "button",
        class: "btn btn-small",
        "data-testid": `linalg-preset-${p.id}`,
        i18n: `preset.${p.id}`,
        on: {
          click: () => {
            aInput.value = p.a;
            bInput.value = p.b;
            update();
          },
        },
      }),
    ),
  );

  function readOpts() {
    return {
      normType: controls.normType.value,
      rcondNorm: controls.rcondNorm.value,
      symmetric: controls.symmetric.value,
      transpose: controls.transpose.input.checked,
      pivot: controls.pivot.input.checked,
      complete: controls.complete.input.checked,
      logarithm: controls.logarithm.input.checked,
      exact: controls.exact.input.checked,
      onlyValues: controls.onlyValues.input.checked,
    };
  }

  function update() {
    const op = OPS.find((o) => o.id === opSelect.value);
    const bMode = op.b ?? "none";
    bField.hidden = bMode === "none";
    bLabel.textContent = t(bMode === "required" ? "label.rhsRequired" : "label.rhsOptional");
    for (const [k, el] of Object.entries(optionEls)) el.hidden = !(op.opts ?? []).includes(k);
    err.clear();
    try {
      const A = parseMatrix(aInput.value);
      let B = null;
      if (bMode !== "none") {
        const m = parseMatrix(bInput.value, { allowEmpty: true });
        if (!m && bMode === "required") throw new Error(t("err.rhsRequired"));
        B = m && (m.length === 1 && !op.rowB ? m[0] : m);
      }
      const o = readOpts();
      const result = op.run(lib, A, B, o);
      const bName = B ? (Array.isArray(B[0]) ? "B" : "b") : null;
      const c = op.code(bName, o);
      const fn = op.id === "rank" || op.id === "pivot" ? "qr" : op.id;
      const used = [...new Set([fn, ...(c.js.match(/\b(qr|chol)\(/g) ?? []).map((s) => s.slice(0, -1))])];
      const rDecl = [`A <- ${rMat(A)}`, B && `${bName} <- ${bName === "B" ? rMat(B) : rVec(B)}`].filter(Boolean).join("\n");
      const jsDecl = [`const A = ${jsMat(A)};`, B && `const ${bName} = ${bName === "B" ? jsMat(B) : jsArr(B)};`].filter(Boolean).join("\n");
      const rCall = c.r.includes("#") ? c.r : `print(${c.r}, digits = 17)`;
      code.set(`${rDecl}\n${rCall}`, `${ctx.importLine(used)}\n${jsDecl}\n${c.js};`);
      setChildren(output, op.id === "eigen" ? eigenView(result) : valueView(result));
      setChildren(jsonHost, jsonDetails(result, "linalg-json"));
    } catch (e) {
      err.show(e);
      setChildren(output);
      setChildren(jsonHost);
    }
  }

  const form = h(
    "form",
    { class: "card form-card", on: { submit: (e) => e.preventDefault() } },
    h("h2", { class: "card-title", i18n: "tab.linalg" }),
    h("p", { class: "hint", i18n: "linalg.intro" }),
    field("label.matrixA", aInput, { hintKey: "hint.matrix" }),
    presets,
    field("label.operation", opSelect),
    bField,
    h("div", { class: "option-group" }, Object.values(optionEls)),
    err.el,
  );
  const el = h(
    "div",
    { class: "tab-body" },
    h("div", { class: "workbench" }, form, h("div", { class: "card result-card" }, h("h3", { class: "sub-heading", i18n: "results" }), output, jsonHost, code.el)),
    exampleSection(ctx, "linalg"),
  );
  update();
  return { el, update };
}

export const LINALG_OPS = OPS.map((o) => o.id);
export const LINALG_PRESETS = PRESETS.map((p) => p.id);
