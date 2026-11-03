// Type II and type III tests of linear models fitted from a formula, as car's Anova(fit, type = 2 or 3).
//
// Written for rStats.js (no ported code) from oracle/anova-behaviour.md ("Anova(fit, { type })"); car's source was
// not read. Both tests compare the least squares fit on a subset of the model matrix's columns with the fit that adds
// the columns of the term tested: type II drops the term and the terms that contain it, type III the term alone.
// The difference of the residual sums of squares is computed as the sum of the squared effects of the added columns
// in a QR decomposition (same pivoting and tolerance as lm) with the other columns first, which is the same quantity
// without the cancellation of a difference; the rank is decided in double precision as lm does, the effects are
// computed in double-double (src/models/ddLeastSquares.ts).

import { pf1 } from "../distributions/f.js";
import { ldexp } from "../internal/summary.js";
import { qr } from "../linalg/qr.js";
import { ddAdd, ddMul, ddMulNum, type DD } from "../special/dd.js";
import { ddLeastSquares, ddSqrtWeights } from "./ddLeastSquares.js";
import { responseScale, scaledRss, type AnovaTable } from "./anovaSequential.js";
import type { LmFormulaResult } from "./lm.js";

/**
 * Options for {@link Anova}.
 *
 * @category Linear models and ANOVA
 */
export interface AnovaOptions {
  /** The type of the tests: 2 (default, as car) or 3; `"II"` and `"III"` are accepted too. */
  type?: 2 | 3 | "II" | "III";
}

/**
 * The sum of the squared effects of the columns `added` after the columns `base`, and the number of added columns
 * that are not aliased (the decrease of the residual sum of squares and the increase of the rank), for the response
 * scaled by 2^-k (src/internal/summary.ts) and the weights by 2^-kw (kw even, so that their square roots are scaled
 * exactly)
 */
function addedSS(fit: LmFormulaResult, base: number[], added: number[], k: number, kw = 0): { ss: number; df: number } {
  const cols = [...base, ...added];
  if (cols.length === 0) return { ss: 0, df: 0 };
  const rows = fit.y.flatMap((_, i) => (fit.weights === undefined || fit.weights[i] !== 0 ? [i] : []));
  // the rank and the aliased columns as lm decides them (double precision, sqrt(w) rounded as lm does)
  const sw = rows.map((i) => (fit.weights === undefined ? 1 : Math.sqrt(fit.weights[i]!)));
  const q = qr(rows.map((i, k) => cols.map((j) => fit.x[i]![j]! * sw[k]!)));
  // the effects in double-double
  const swd = ddSqrtWeights(fit.weights === undefined ? undefined : rows.map((i) => ldexp(fit.weights![i]!, -kw)), rows.length);
  const kept = q.pivot.slice(0, q.rank);
  const { qty } = ddLeastSquares(
    kept.map((c) => rows.map((i, k) => ddMulNum(swd[k]!, fit.x[i]![cols[c]!]!))),
    rows.map((i, r) => ddMulNum(swd[r]!, ldexp(fit.y[i]!, -k))),
  );
  let ss: DD = [0, 0];
  let df = 0;
  kept.forEach((c, k) => {
    if (c >= base.length) {
      ss = ddAdd(ss, ddMul(qty[k]!, qty[k]!));
      df++;
    }
  });
  return { ss: ss[0], df };
}

/**
 * Type II or type III tests of the terms of a linear model. Equivalent to `car::Anova()` in R. As
 * `car::Anova(fit, type = 2)` or `type = 3` for an `lm` fit: columns `Sum Sq`, `Df`, `F value`, `Pr(>F)`; rows the terms (type III: `(Intercept)` first when the
 * model has one) and `Residuals`.
 *
 * Type II tests each term after all the others except the terms that contain it (car's marginality; it does not
 * depend on the contrasts). Type III tests each column set of the model's own matrix after all the other columns, so
 * it depends on the contrasts (`contr.sum` is the usual choice).
 *
 * Errors as car: `residual df = 0`, `residual sum of squares is 0 (within rounding error)`, and for type III `there
 * are aliased coefficients in the model`. Type II of a model with only an intercept gives the type III table with a
 * warning.
 *
 * @param fit A fit from {@link lm} with a formula.
 *
 * @example
 * ```ts
 * const data = { y: [4.2, 5.1, 6.3, 5.8, 7.9, 8.4, 6.1, 7.2], A: ["a", "a", "b", "b", "a", "a", "b", "b"], B: ["p", "q", "p", "q", "p", "q", "p", "q"] };
 * const t = Anova(lm("y ~ A * B", data, { contrasts: { A: "contr.sum", B: "contr.sum" } }), { type: 3 });
 * t.rowNames; // ["(Intercept)", "A", "B", "A:B", "Residuals"]
 * ```
 *
 * @category Linear models and ANOVA
 */
export function Anova(fit: LmFormulaResult, options: AnovaOptions = {}): AnovaTable {
  if (typeof fit !== "object" || fit === null || !Array.isArray((fit as Partial<LmFormulaResult>).effects)) {
    throw new TypeError("Anova() needs a fit from lm() with a formula");
  }
  const t0 = options.type ?? 2;
  let type: 2 | 3;
  if (t0 === 2 || t0 === "II") type = 2;
  else if (t0 === 3 || t0 === "III") type = 3;
  else throw new RangeError(`invalid type (${String(t0)}): use 2 or 3`);
  const rdf = fit.dfResidual;
  // sums of squares of the response scaled by 2^-k: F and p from them, the Sum Sq column scaled back
  const k = responseScale([fit]);
  const rss = scaledRss([fit], k)[0]!;

  if (rdf === 0) throw new Error("residual df = 0");
  // car compares the residual sum of squares with sqrt(eps) in the units of the data, which depends on them; here it
  // is compared with sqrt(eps) times the total (weighted, centred) sum of squares of the response
  const wy = fit.y.flatMap((v, i) => ((fit.weights?.[i] ?? 1) === 0 ? [] : [[fit.weights?.[i] ?? 1, ldexp(v, -k)] as const]));
  // Where a sum over the weights overflows (the total of the weights of 1e308, #347), the weights are divided by an
  // even power of 2 2^kw: the sums of squares are then in units of 2^(2k + kw). kw is 0 otherwise (the same bits)
  const evenWeightExponent = (): number => {
    const e = Math.floor(Math.log2(wy.reduce((a, [w]) => Math.max(a, w), 0)));
    return e - (((e % 2) + 2) % 2);
  };
  const weightedTss = (kw: number): number => {
    const ws = wy.map(([w, v]) => [ldexp(w, -kw), v] as const);
    const sw = ws.reduce((a, [w]) => a + w, 0);
    const my = ws.reduce((a, [w, v]) => a + w * v, 0) / sw;
    return Number.isFinite(sw) && Number.isFinite(my) ? ws.reduce((a, [w, v]) => a + w * (v - my) ** 2, 0) : NaN;
  };
  let kw = 0;
  let tss = weightedTss(0);
  if (!Number.isFinite(tss)) {
    kw = evenWeightExponent();
    tss = weightedTss(kw);
  }
  if (!(ldexp(rss, -kw) >= Math.sqrt(2.220446049250313e-16) * tss) || rss === 0) throw new Error("residual sum of squares is 0 (within rounding error)");
  // the fit's warnings (from its model matrix and summary) first, as for aov with Error(); R gives them when fitting
  const warnings: string[] = [...fit.warnings];
  const nTerms = fit.termLabels.length;
  if (type === 2 && nTerms === 0 && fit.intercept) {
    warnings.push("the model contains only an intercept: Type III test substituted");
    type = 3;
  }
  const columnsOf = (terms: Set<number>): number[] => fit.assign.flatMap((a, j) => (terms.has(a) ? [j] : []));
  const allTerms = [...new Set(fit.assign)];
  const names: string[] = [];
  let rows: { ss: number; df: number }[] = [];
  const termRows = (kw: number): { ss: number; df: number }[] => {
    names.length = 0;
    const out: { ss: number; df: number }[] = [];
    if (type === 3) {
      if (fit.coefficients.some((c) => Number.isNaN(c))) throw new Error("there are aliased coefficients in the model");
      for (const t of allTerms) {
        const added = columnsOf(new Set([t]));
        const base = columnsOf(new Set(allTerms.filter((u) => u !== t)));
        names.push(t === 0 ? "(Intercept)" : fit.termLabels[t - 1]!);
        out.push({ ss: addedSS(fit, base, added, k, kw).ss, df: added.length });
      }
    } else {
      // the variables of each term (from the factors attribute)
      const varsOf = (t: number): number[] => fit.factors.flatMap((codes, v) => (codes[t - 1]! > 0 ? [v] : []));
      for (const t of allTerms) {
        if (t === 0) continue;
        const vt = varsOf(t);
        const containing = allTerms.filter((u) => u !== 0 && u !== t && vt.every((v) => fit.factors[v]![u - 1]! > 0));
        const base = columnsOf(new Set(allTerms.filter((u) => u !== t && !containing.includes(u))));
        const r = addedSS(fit, base, columnsOf(new Set([t])), k, kw);
        names.push(fit.termLabels[t - 1]!);
        out.push(r);
      }
    }
    return out;
  };
  rows = termRows(kw);
  if (kw === 0 && fit.weights !== undefined && rows.some((r) => !Number.isFinite(r.ss))) {
    kw = evenWeightExponent();
    rows = termRows(kw);
  }
  const back = (v: number): number => ldexp(v, 2 * k + kw);
  const rssW = ldexp(rss, -kw);
  const rms = rssW / rdf;
  const table = rows.map(({ ss, df }) => {
    const f = ss / df / rms;
    return [back(ss), df, f, pf1(f, df, rdf, false, false)];
  });
  table.push([back(rssW), rdf, NaN, NaN]);
  return { colNames: ["Sum Sq", "Df", "F value", "Pr(>F)"], rowNames: [...names, "Residuals"], table, warnings };
}
