// Repeated-measures and mixed analysis of variance as afex's aov_ez computes it (its anova_table), with car's
// univariate tests, sphericity corrections and Mauchly tests for the multivariate linear model of the wide data.
//
// Written for rStats.js (no ported code) from oracle/anova-behaviour.md ("aovEz"); the source of afex and car was not
// read. The long data are put in wide form (one row per subject, one column per combination of the within-subject
// levels, the first within factor varying slowest). For each within term (columns P of its contr.sum coding over the
// cells) and each between term b, P'S_bP and P'EP are the cross-products of the coordinates of YP in orthonormal bases
// of the between model's columns (Householder QR in double-double, src/models/ddLeastSquares.ts): the columns of b
// orthogonal to the others for the hypothesis, the residual space for the error. The sums of squares are the traces
// of these matrices times (P'P)^-1, and the epsilons and Mauchly's W follow from P'EP (src/models/ddMatrix.ts).

import { pf1 } from "../distributions/f.js";
import { levelText, numberLevels } from "../internal/levels.js";
import { ldexp, scaleToUnit } from "../internal/summary.js";
import { eigen } from "../linalg/eigen.js";
import { qr } from "../linalg/qr.js";
import { ddAdd, ddDiv, ddDivNum, ddMul, ddMulNum, type DD } from "../special/dd.js";
import type { AnovaTable } from "./anovaSequential.js";
import { Anova } from "./carAnova.js";
import { ddLeastSquaresMulti } from "./ddLeastSquares.js";
import { ddHi, ddInverse, ddMatMul, ddTrace, type DDMatrix } from "./ddMatrix.js";
import { lm } from "./lm.js";
import { mauchlyPValue, sphericityW } from "./mauchly.js";
import { compareCodePoints, type DataFrame } from "./modelFrame.js";
import { modelMatrix, type ContrastName } from "./modelMatrix.js";

/**
 * An effect size of {@link aovEz}: generalized (`"ges"`) or partial (`"pes"`) eta squared.
 *
 * @category Linear models and ANOVA
 */
export type AovEzEffectSize = "ges" | "pes";

/**
 * Options for {@link aovEz}.
 *
 * @category Linear models and ANOVA
 */
export interface AovEzOptions {
  /** Column of the subject identifiers. */
  id: string;
  /** Column of the response. */
  dv: string;
  /** Between-subjects factors (columns). */
  between?: readonly string[] | string;
  /** Within-subjects factors (columns). */
  within?: readonly string[] | string;
  /** Type of the sums of squares: 3 (default) or 2. */
  type?: 2 | 3;
  /** Sphericity correction of the anova table: `"GG"` (default), `"HF"` or `"none"`. */
  correction?: "GG" | "HF" | "none";
  /** Effect sizes: `"ges"` (default), `"pes"`, or both. */
  es?: AovEzEffectSize | readonly AovEzEffectSize[];
  /** Observed (not manipulated) factors, for the generalized eta squared. */
  observed?: readonly string[] | string;
}

/**
 * A table of {@link aovEz}.
 *
 * @category Linear models and ANOVA
 */
export interface AovEzTable {
  /** Column names, such as afex's `"num Df"`, `"den Df"`, `"MSE"`, `"F"`, `"ges"`, `"Pr(>F)"`. */
  colNames: string[];
  /** Row names: the terms (and `"(Intercept)"` in car's tables). */
  rowNames: string[];
  /** One array per row, one value per column. */
  table: number[][];
}

/**
 * Result of {@link aovEz}.
 *
 * @category Linear models and ANOVA
 */
export interface AovEzResult {
  /** afex's anova table (without the intercept). */
  anova: AovEzTable;
  /** car's univariate tests (intercept included); without within-subject factors, car's Anova table. */
  univariate: AovEzTable;
  /** Greenhouse-Geisser and Huynh-Feldt corrections of the rows with more than one within-subject df. */
  corrections?: AovEzTable;
  /** Mauchly's tests of the same rows. */
  sphericity?: AovEzTable;
  /** The within-subject factors (columns), as given. */
  within: string[];
  /** afex's and car's warnings (averaged cells, removed subjects, `HF eps > 1 treated as 1`, ...). */
  warnings: string[];
}

const list = (v: readonly string[] | string | undefined): string[] => (v === undefined ? [] : typeof v === "string" ? [v] : [...v]);

/** Eigenvalues of the error SSP matrix below this fraction of the largest one count as 0 */
const REL_RANK_TOL = 1e-12;

function column(data: DataFrame, name: string): readonly unknown[] {
  const c = Object.prototype.hasOwnProperty.call(data, name) ? data[name] : undefined;
  if (c === undefined) throw new Error(`object '${name}' not found`);
  return Array.from(c as ArrayLike<unknown>);
}

const label = (v: unknown): string => (typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : levelText(v));

/** Levels sorted (numbers as numbers, strings by code point) */
function sortedLevels(values: readonly unknown[]): string[] {
  const distinct = [...new Set(values)];
  if (distinct.every((v) => typeof v === "number")) return (distinct as number[]).sort((a, b) => a - b).map(label);
  return [...new Set(distinct.map(label))].sort(compareCodePoints);
}

// Whether a variable is one of the components of a term name such as "a:b" (compared as names, so that a name that is
// not a run of word characters, such as ".grp", is found too)
const inTerm = (variable: string, term: string): boolean => term.split(":").includes(variable);

/** Row of the anova table before the effect sizes */
interface Row {
  name: string;
  ss: number;
  numDf: number;
  errSS: number;
  denDf: number;
  f: number;
  p: number;
}

/**
 * The anova table from the rows (intercept excluded) with the effect sizes; `errorSS` are the error sums of squares of
 * each error stratum (keyed by its within-subject term, so that two strata whose sums happen to be equal both count).
 * The sums of squares are those of the scaled response: the
 * effect sizes are ratios of them, and only the MSE is scaled back (`unscale`)
 */
function anovaTable(rows: Row[], errorSS: ReadonlyMap<number, number>, es: AovEzEffectSize[], observed: string[], unscale: (v: number) => number): AovEzTable {
  const isObserved = (name: string): boolean => observed.some((o) => inTerm(o, name));
  for (const o of observed) {
    if (!rows.some((r) => inTerm(o, r.name))) throw new Error(`Observed variable not in data: ${o}`);
  }
  const distinctError = [...errorSS.values()].reduce((s, v) => s + v, 0);
  const O = rows.reduce((s, r) => (isObserved(r.name) ? s + r.ss : s), 0);
  const want = (["pes", "ges"] as const).filter((e) => es.includes(e));
  return {
    colNames: ["num Df", "den Df", "MSE", "F", ...want, "Pr(>F)"],
    rowNames: rows.map((r) => r.name),
    table: rows.map((r) => {
      const effects = want.map((e) =>
        e === "pes" ? r.ss / (r.ss + r.errSS) : r.ss / (r.ss + distinctError + O - (isObserved(r.name) ? r.ss : 0)),
      );
      return [r.numDf, r.denDf, unscale(r.errSS / r.denDf), r.f, ...effects, r.p];
    }),
  };
}

/**
 * Repeated-measures (within-subjects), between-subjects and mixed analysis of variance from long data. Equivalent to
 * `afex::aov_ez()` in R. As afex's
 * `aov_ez(id, dv, data, between, within, type, observed, anova_table = list(correction, es))`, it returns afex's
 * anova table and car's univariate tests, sphericity corrections (Greenhouse-Geisser, Huynh-Feldt) and Mauchly tests.
 *
 * Between-subjects factors use `contr.sum` and sorted levels; the levels of within-subjects factors are taken in order
 * of first appearance. Several rows for a subject and a cell are averaged (with afex's warning); subjects that miss
 * a cell are removed (with a warning).
 *
 * @param data Long data: one row per observation.
 *
 * @example
 * ```ts
 * const data = {
 *   id: ["s1", "s1", "s2", "s2", "s3", "s3", "s4", "s4"],
 *   W: ["a", "b", "a", "b", "a", "b", "a", "b"],
 *   y: [4.1, 5.0, 3.8, 4.9, 4.4, 5.6, 4.0, 4.7],
 * };
 * aovEz(data, { id: "id", dv: "y", within: "W" }).anova.rowNames; // ["W"]
 * ```
 *
 * @category Linear models and ANOVA
 */
export function aovEz(data: DataFrame, options: AovEzOptions): AovEzResult {
  const between = list(options.between);
  const within = list(options.within);
  if (between.length === 0 && within.length === 0) throw new Error("Either between or within need to be non-NULL!");
  const type = options.type ?? 3;
  if (type !== 2 && type !== 3) throw new RangeError(`invalid type (${String(type)}): use 2 or 3`);
  const correction = options.correction ?? "GG";
  if (!["GG", "HF", "none"].includes(correction)) throw new RangeError(`invalid 'correction': ${String(correction)}`);
  const es = list(options.es ?? "ges") as AovEzEffectSize[];
  for (const e of es) if (e !== "ges" && e !== "pes") throw new RangeError(`invalid 'es': ${String(e)}`);
  const observed = list(options.observed);
  const warnings: string[] = [];

  // 1. the columns as factors
  // (the id and factor columns as R's factor() makes them: numbers with the same 15-digit text are one level)
  // Rows with a missing id or factor value (null, undefined or NaN) are dropped, as from a model frame. A missing
  // response (null or NaN) makes its cell missing, so that its id is removed in step 6, as afex does
  const isMissing = (v: unknown): boolean => v === null || v === undefined || (typeof v === "number" && Number.isNaN(v));
  const dvRaw = column(data, options.dv);
  const keyCols = [options.id, ...between, ...within].map((c) => column(data, c));
  for (const c of keyCols) if (c.length !== dvRaw.length) throw new RangeError("the columns must have the same length");
  const keep = dvRaw.map((_, i) => keyCols.every((c) => !isMissing(c[i])));
  const used = <T>(c: readonly T[]): T[] => c.filter((_, i) => keep[i]);
  const ids = numberLevels(used(keyCols[0]!)).map(label);
  const dvUsed = used(dvRaw).map((v) => {
    if (isMissing(v)) return NaN;
    if (typeof v !== "number") throw new TypeError(`the response '${options.dv}' must be numeric`);
    if (!Number.isFinite(v)) throw new RangeError(`the response '${options.dv}' must be finite`);
    return v;
  });
  // The response scaled by 2^-k (exact), so that its cross-products stay in range; sums of squares are scaled back by
  // 2^2k for output, and F, the epsilons and Mauchly's W do not depend on the units
  const { groups: scaledDv, k: dvExp } = scaleToUnit([dvUsed]);
  const dv = scaledDv[0]!;
  const unscale = (v: number): number => ldexp(v, 2 * dvExp);
  const bcols = between.map((_, k) => numberLevels(used(keyCols[1 + k]!)));
  const wcols = within.map((_, k) => numberLevels(used(keyCols[1 + between.length + k]!)));
  const nrow = ids.length;
  for (const c of [dv, ...bcols, ...wcols]) if (c.length !== nrow) throw new RangeError("the columns must have the same length");
  const blevels = bcols.map((c) => sortedLevels(c));
  const blabels = bcols.map((c) => c.map(label));
  const wlabels = wcols.map((c) => c.map(label));
  const wlevels = wlabels.map((c) => [...new Set(c)]);
  // 2. a between factor with one level
  blevels.forEach((l, k) => {
    if (l.length < 2) throw new Error(`Factor "${between[k]}" consists of one level only. Remove factor from model?`);
  });
  // a within factor with one level is also an error (afex returns an empty table, which hides the mistake)
  wlevels.forEach((l, k) => {
    if (l.length < 2) throw new Error(`Factor "${within[k]}" consists of one level only. Remove factor from model?`);
  });
  // 3. ids in more than one between cell
  const idOrder = [...new Set(ids)];
  const cellOf = new Map<string, string>();
  const multiple = new Set<string>();
  ids.forEach((id, i) => {
    const key = JSON.stringify(blabels.map((c) => c[i]));
    const seen = cellOf.get(id);
    if (seen === undefined) cellOf.set(id, key);
    else if (seen !== key) multiple.add(id);
  });
  if (multiple.size > 0) {
    throw new Error(`Following ids are in more than one between subjects condition:\n${idOrder.filter((id) => multiple.has(id)).join(", ")}`);
  }
  // 4. the within cells, the first factor varying slowest; a cell without rows is an error
  let cells: string[][] = [[]];
  for (const lv of wlevels) cells = cells.flatMap((c) => lv.map((l) => [...c, l]));
  const cellKey = (i: number): string => JSON.stringify(wlabels.map((c) => c[i]));
  const cellIndex = new Map(cells.map((c, k) => [JSON.stringify(c), k]));
  const present = new Set(ids.map((_, i) => cellKey(i)));
  if (cells.some((c) => !present.has(JSON.stringify(c)))) throw new Error("Empty cells in within-subjects design (i.e., bad data structure).");
  // 5. the wide data (means of the rows of an id and a cell)
  const nc = cells.length;
  const sums = new Map<string, { s: DD[]; n: number[] }>();
  ids.forEach((id, i) => {
    let e = sums.get(id);
    if (e === undefined) sums.set(id, (e = { s: cells.map((): DD => [0, 0]), n: cells.map(() => 0) }));
    const k = cellIndex.get(cellKey(i))!;
    e.s[k] = ddAdd(e.s[k]!, [dv[i]!, 0]);
    e.n[k]!++;
  });
  if ([...sums.values()].some((e) => e.n.some((v) => v > 1))) {
    warnings.push(
      "More than one observation per design cell, aggregating data using `fun_aggregate = mean`.\nTo turn off this warning, pass `fun_aggregate = mean` explicitly.",
    );
  }
  // 6. ids that miss a cell (or have a missing response in one) are removed
  const missing = idOrder.filter((id) => sums.get(id)!.n.some((v, k) => v === 0 || Number.isNaN(sums.get(id)!.s[k]![0])));
  if (missing.length > 0) {
    // the ids sorted as the levels of a factor; afex goes on with a printout of the data, which is not reproduced
    const sorted = [...missing].sort(compareCodePoints);
    const shown = sorted.length >= 10 ? `${sorted.slice(0, 10).join(", ")}, ... [showing first 10 only]` : sorted.join(", ");
    warnings.push(`Missing values for ${missing.length} ID(s), which were removed before analysis:\n${shown}`);
  }
  const subjects = idOrder.filter((id) => !missing.includes(id));
  const firstRow = new Map<string, number>();
  ids.forEach((id, i) => firstRow.has(id) || firstRow.set(id, i));
  const Y: DD[][] = subjects.map((id) => {
    const e = sums.get(id)!;
    return e.s.map((s, k) => ddDivNum(s, e.n[k]!));
  });
  // the between data, one row per subject
  const bdata: DataFrame = {};
  between.forEach((b, k) => (bdata[b] = subjects.map((id) => blabels[k]![firstRow.get(id)!]!)));
  const sum: Record<string, ContrastName> = Object.fromEntries(between.map((b) => [b, "contr.sum"]));
  const blevelOpt = Object.fromEntries(between.map((b, k) => [b, blevels[k]!]));
  const rankDeficient = "Rank deficient model matrix; insufficient data to estimate full model.";

  if (nc === 1) return betweenOnly();
  return withinAnalysis();

  /** Without within-subject factors (or a single within cell): lm on one value per subject and car's Anova */
  function betweenOnly(): AovEzResult {
    const dvName = between.includes("y") ? "y_" : "y";
    const frame: DataFrame = { ...bdata, [dvName]: Y.map((r) => r[0]![0]) };
    const fit = lm(`${dvName} ~ ${between.length > 0 ? between.join(" * ") : "1"}`, frame, { contrasts: sum, levels: blevelOpt });
    if (fit.rank < fit.coefNames.length) throw new Error(rankDeficient);
    if (fit.dfResidual <= 0) throw new RangeError(`no residual degrees of freedom: ${Y.length} subject(s) for ${fit.rank} parameter(s)`);
    const tab: AnovaTable = Anova(fit, { type });
    warnings.push(...tab.warnings.filter((w) => !warnings.includes(w)));
    const rdf = fit.dfResidual;
    const rows: Row[] = tab.rowNames.flatMap((name, i) => {
      if (name === "(Intercept)" || name === "Residuals") return [];
      const [ss, df, f, p] = tab.table[i]!;
      return [{ name, ss: ss!, numDf: df!, errSS: fit.rss, denDf: rdf, f: f!, p: p! }];
    });
    const ssCol = tab.colNames.indexOf("Sum Sq");
    return {
      anova: anovaTable(rows, new Map([[0, fit.rss]]), es, observed, unscale),
      univariate: { colNames: tab.colNames, rowNames: tab.rowNames, table: tab.table.map((r) => r.map((v, j) => (j === ssCol ? unscale(v) : v))) },
      within,
      warnings,
    };
  }

  function withinAnalysis(): AovEzResult {
    const n = subjects.length;
    // without between factors (an empty data frame) the model matrix is the column of ones
    const X =
      between.length > 0
        ? modelMatrix(`~ ${between.join(" * ")}`, bdata, { contrasts: sum, levels: blevelOpt })
        : { colNames: ["(Intercept)"], assign: [0], x: subjects.map(() => [1]), termLabels: [] as string[], factors: [] as number[][] };
    const px = X.colNames.length;
    if (n === 0 || qr(X.x).rank < px) throw new Error(rankDeficient);
    const d = n - px;
    if (d <= 0) throw new RangeError(`no residual degrees of freedom: ${n} subject(s) for ${px} between-subject parameter(s)`);
    const bterms = [0, ...X.termLabels.map((_, j) => j + 1)];
    const blabs = ["(Intercept)", ...X.termLabels];
    const colsOf = (terms: number[]): number[] => X.assign.flatMap((a, j) => (terms.includes(a) ? [j] : []));
    const varsOf = (t: number): number[] => X.factors.flatMap((codes, v) => (codes[t - 1]! > 0 ? [v] : []));
    const xcol = (j: number): DD[] => X.x.map((r): DD => [r[j]!, 0]);
    const zero: DD[] = new Array<DD>(n).fill([0, 0]);
    /** Coordinates of the vectors in the columns `added` after the columns `base` (rows: one per added column) */
    const coordinates = (base: number[], added: number[], vectors: DD[][]): DD[][] => {
      const { qtv } = ddLeastSquaresMulti([...base, ...added].map(xcol), zero, vectors);
      return qtv.map((v) => v.slice(base.length, base.length + added.length));
    };
    const residualCoordinates = (vectors: DD[][]): DD[][] => {
      const { qtv } = ddLeastSquaresMulti(X.colNames.map((_, j) => xcol(j)), zero, vectors);
      return qtv.map((v) => v.slice(px));
    };
    // the within design over the cells
    const cdata: DataFrame = Object.fromEntries(within.map((w, k) => [w, cells.map((c) => c[k]!)]));
    const W = modelMatrix(`~ ${within.join(" * ")}`, cdata, {
      contrasts: Object.fromEntries(within.map((w) => [w, "contr.sum" as ContrastName])),
      levels: Object.fromEntries(within.map((w, k) => [w, wlevels[k]!])),
    });
    const wterms = [0, ...W.termLabels.map((_, j) => j + 1)];
    const wlabs = ["(Intercept)", ...W.termLabels];
    const cross = (C: DD[][]): DDMatrix => {
      // C: one array per column of YP (its coordinates); returns C'C
      return C.map((a) =>
        C.map((b) => {
          let s: DD = [0, 0];
          a.forEach((v, i) => (s = ddAdd(s, ddMul(v, b[i]!))));
          return s;
        }),
      );
    };
    const uni: number[][] = [];
    const uniNames: string[] = [];
    const corr: number[][] = [];
    const sph: number[][] = [];
    const corrNames: string[] = [];
    const rows: Row[] = [];
    const errorSS = new Map<number, number>();
    let hfAbove = false;
    for (const wt of wterms) {
      const wc = W.assign.flatMap((a, j) => (a === wt ? [j] : []));
      const p = wc.length;
      // YP, one array per column of P
      const YP: DD[][] = wc.map((j) => Y.map((r) => r.reduce<DD>((s, v, c) => ddAdd(s, ddMulNum(v, W.x[c]![j]!)), [0, 0])));
      const PtP: DDMatrix = wc.map((a) => wc.map((b): DD => [W.x.reduce((s, r) => s + r[a]! * r[b]!, 0), 0]));
      const M = ddInverse(PtP);
      const PEP = cross(residualCoordinates(YP));
      const A = ddMatMul(PEP, M);
      const errSS = ddTrace(A)[0];
      let gg = NaN;
      let hf = NaN;
      let mw = NaN;
      let mp = NaN;
      let corrected = false;
      if (p >= 2) {
        // Each correction is judged on its own condition (car gives none of them for a singular error SSP matrix):
        // - GG: tr(A)^2 / (p tr(A^2)) is defined for any nonzero A, singular or not (1/p for rank 1)
        // - HF: needs d - p GG > 0
        // - Mauchly: needs a nonsingular matrix. The rank is judged relative to its largest eigenvalue (an absolute
        //   threshold would depend on the units of the response): exactly singular matrices, from d < p or collinear
        //   measurements, have eigenvalues near 1e-16 of the largest one
        const term = wlabs[wt];
        const tA = ddTrace(A);
        const tAA = ddTrace(ddMatMul(A, A));
        if (tAA[0] > 0 && Number.isFinite(tAA[0])) {
          corrected = true;
          gg = ddDiv(ddMul(tA, tA), ddMulNum(tAA, p))[0];
          if (d - p * gg > 0) hf = ((d + 1) * p * gg - 2) / (p * (d - p * gg));
          else warnings.push(`The Huynh-Feldt epsilon of ${term} is undefined (d - p GG <= 0)${correction === "HF" ? ": corrected with GG" : ""}`);
        } else {
          warnings.push(`The error SSP matrix of ${term} is 0: no sphericity corrections (the p-values are uncorrected)`);
        }
        const ev = eigen(ddHi(PEP), { symmetric: true, onlyValues: true }).values as number[];
        const top = ev.reduce((a, b) => Math.max(a, b), 0);
        if (top > 0 && ev.every((v) => v > top * REL_RANK_TOL)) {
          mw = sphericityW(ddMatMul(M, PEP));
          mp = mauchlyPValue(mw, p, d, nc);
        } else if (corrected) {
          warnings.push(`The error SSP matrix of ${term} is singular: no Mauchly test (the epsilons are still defined)`);
        }
      }
      for (let bi = 0; bi < bterms.length; bi++) {
        const bt = bterms[bi]!;
        let C: DD[][];
        if (type === 3) C = coordinates(colsOf(bterms.filter((u) => u !== bt)), colsOf([bt]), YP);
        else if (bt === 0) C = coordinates([], colsOf([0]), YP);
        else {
          const vt = varsOf(bt);
          const rel = bterms.filter((u) => u !== 0 && u !== bt && vt.every((v) => X.factors[v]![u - 1]! > 0));
          C = coordinates(colsOf(bterms.filter((u) => u !== bt && !rel.includes(u))), colsOf([bt]), YP);
        }
        const ss = ddTrace(ddMatMul(cross(C), M))[0];
        const dfb = bt === 0 ? 1 : colsOf([bt]).length;
        const numDf = dfb * p;
        const denDf = d * p;
        const f = ss / numDf / (errSS / denDf);
        const pval = pf1(f, numDf, denDf, false, false);
        const name = wt === 0 ? blabs[bi]! : bt === 0 ? wlabs[wt]! : `${blabs[bi]}:${wlabs[wt]}`;
        uni.push([unscale(ss), numDf, unscale(errSS), denDf, f, pval]);
        uniNames.push(name);
        errorSS.set(wt, errSS);
        let row: Row = { name, ss, numDf, errSS, denDf, f, p: pval };
        if (corrected) {
          const hf1 = Math.min(1, hf);
          const pgg = pf1(f, gg * numDf, gg * denDf, false, false);
          const phf = pf1(f, hf1 * numDf, hf1 * denDf, false, false);
          corr.push([gg, pgg, hf, phf]);
          sph.push([mw, mp]);
          corrNames.push(name);
          if (correction === "GG") row = { ...row, numDf: gg * numDf, denDf: gg * denDf, p: pgg };
          else if (correction === "HF") {
            if (hf > 1) hfAbove = true;
            // an undefined HF epsilon falls back on GG (with the warning above), not on the uncorrected test
            row = Number.isNaN(hf)
              ? { ...row, numDf: gg * numDf, denDf: gg * denDf, p: pgg }
              : { ...row, numDf: hf1 * numDf, denDf: hf1 * denDf, p: phf };
          }
        }
        if (!(wt === 0 && bt === 0)) rows.push(row);
      }
    }
    if (hfAbove) warnings.push("HF eps > 1 treated as 1");
    const out: AovEzResult = {
      anova: anovaTable(rows, errorSS, es, observed, unscale),
      univariate: { colNames: ["Sum Sq", "num Df", "Error SS", "den Df", "F value", "Pr(>F)"], rowNames: uniNames, table: uni },
      within,
      warnings,
    };
    if (corr.length > 0) {
      out.corrections = { colNames: ["GG eps", "Pr(>F[GG])", "HF eps", "Pr(>F[HF])"], rowNames: corrNames, table: corr };
      out.sphericity = { colNames: ["Test statistic", "p-value"], rowNames: [...corrNames], table: sph };
    }
    return out;
  }
}

