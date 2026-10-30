// Analysis of variance tables of linear models fitted from a formula: R's anova(fit) (sequential sums of squares),
// anova(fit1, fit2, ...) (comparison of models) and summary(aov(...)) for a fit without Error().
//
// Written for rStats.js (no ported code) from oracle/anova-behaviour.md. The sequential sum of squares of a term is
// the sum of the squared effects (Q'y of the pivoted QR decomposition) of its columns that are not aliased; the
// terms appear in the order of their first column among the columns kept.

import { pf1 } from "../distributions/f.js";
import { ldexp, scaleToUnit } from "../internal/summary.js";
import type { AovStrataFit, AovStratum } from "./aovStrata.js";
import type { LmFormulaResult } from "./lm.js";

/**
 * An analysis of variance table, in the form of R's printed table.
 *
 * @category Linear models and ANOVA
 */
export interface AnovaTable {
  /** R's column names, such as `"Df"`, `"Sum Sq"`, `"Mean Sq"`, `"F value"`, `"Pr(>F)"`. */
  colNames: string[];
  /** Row names (term labels and `"Residuals"`, or `"1"`, `"2"`, ... for a comparison). */
  rowNames: string[];
  /** One array per row; NaN where R prints nothing or NA. */
  table: number[][];
  /** R's warnings. */
  warnings: string[];
}

/** The exponent k that brings the responses of the fits (fitted values and residuals) into [1, 2) */
function responseScale(fits: readonly LmFormulaResult[]): number {
  return scaleToUnit(fits.flatMap((f) => [f.fittedValues, f.residuals])).k;
}

/**
 * Residual sums of squares of fits in the scale of the response divided by 2^k (see src/internal/summary.ts): rss /
 * 2^2k when rss is in range, otherwise from the residuals scaled by 2^-k
 */
function scaledRss(fits: readonly LmFormulaResult[], k: number): number[] {
  return fits.map((f) => {
    if (f.rss >= MIN_NORMAL && f.rss < Infinity) return ldexp(f.rss, -2 * k);
    let s = 0;
    f.residuals.forEach((r, i) => {
      const v = ldexp(r, -k);
      s += (f.weights?.[i] ?? 1) * v * v;
    });
    return s;
  });
}

const MIN_NORMAL = 2 ** -1022;

/**
 * Sequential sums of squares of the terms (intercept row included when the model has one) and the residuals, of the
 * response scaled by 2^-k (k returned): F and p-values come from these, the sums of squares are scaled back by 2^2k
 */
export function sequentialTerms(fit: LmFormulaResult): { terms: { term: number; df: number; ss: number }[]; rdf: number; rss: number; k: number } {
  const k = responseScale([fit]);
  const { pivot } = fit.qr;
  const terms: { term: number; df: number; ss: number }[] = [];
  const byTerm = new Map<number, { term: number; df: number; ss: number }>();
  for (let i = 0; i < fit.rank; i++) {
    const t = fit.assign[pivot[i]!]!;
    let row = byTerm.get(t);
    if (row === undefined) {
      row = { term: t, df: 0, ss: 0 };
      byTerm.set(t, row);
      terms.push(row);
    }
    row.df++;
    row.ss += ldexp(fit.effects[i]!, -k) ** 2;
  }
  return { terms, rdf: fit.dfResidual, rss: scaledRss([fit], k)[0]!, k };
}

const upperF = (f: number, df1: number, df2: number): number => pf1(f, df1, df2, false, false);

/** The rows of the sequential table without the intercept, and the warning on a perfect fit */
function sequentialRows(fit: LmFormulaResult): { names: string[]; rows: { df: number; ss: number }[]; rdf: number; rss: number; k: number; perfect: boolean } {
  const s = sequentialTerms(fit);
  const kept = s.terms.filter((t) => t.term !== 0);
  let fss = 0;
  fit.fittedValues.forEach((f, i) => (fss += (fit.weights?.[i] ?? 1) * ldexp(f, -s.k) ** 2));
  return {
    names: kept.map((t) => fit.termLabels[t.term - 1]!),
    rows: kept,
    rdf: s.rdf,
    rss: s.rss,
    k: s.k,
    perfect: s.rss < 1e-10 * fss,
  };
}

function sequentialTable(fit: LmFormulaResult): AnovaTable {
  const { names, rows, rdf, rss, k, perfect } = sequentialRows(fit);
  const rms = rss / rdf;
  const back = (v: number): number => ldexp(v, 2 * k);
  const table = rows.map(({ df, ss }) => {
    const f = ss / df / rms;
    return [df, back(ss), back(ss / df), f, upperF(f, df, rdf)];
  });
  table.push([rdf, back(rss), rdf === 0 ? NaN : back(rms), NaN, NaN]);
  return {
    colNames: ["Df", "Sum Sq", "Mean Sq", "F value", "Pr(>F)"],
    rowNames: [...names, "Residuals"],
    table,
    warnings: perfect ? ["ANOVA F-tests on an essentially perfect fit are unreliable"] : [],
  };
}

function comparisonTable(fits: readonly LmFormulaResult[]): AnovaTable {
  const rdf = fits.map((f) => f.dfResidual);
  // F from the residual sums of squares of the responses scaled by 2^-k; the sums of squares are scaled back
  const k = responseScale(fits);
  const rss = scaledRss(fits, k);
  const back = (v: number): number => ldexp(v, 2 * k);
  // the scale: the residual mean square of the (first) model with the smallest residual df
  let big = 0;
  rdf.forEach((d, i) => {
    if (d < rdf[big]!) big = i;
  });
  const scale = rss[big]! / rdf[big]!;
  const table = fits.map((_, i) => {
    if (i === 0) return [rdf[0]!, back(rss[0]!), NaN, NaN, NaN, NaN];
    const df = rdf[i - 1]! - rdf[i]!;
    const ss = rss[i - 1]! - rss[i]!;
    let f = df === 0 ? NaN : ss / df / scale;
    if (f < 0) f = NaN;
    return [rdf[i]!, back(rss[i]!), df, back(ss), f, Number.isNaN(f) ? NaN : upperF(f, Math.abs(df), rdf[big]!)];
  });
  return {
    colNames: ["Res.Df", "RSS", "Df", "Sum of Sq", "F", "Pr(>F)"],
    rowNames: fits.map((_, i) => String(i + 1)),
    table,
    warnings: [],
  };
}

/**
 * Analysis of variance of linear models fitted from a formula. Equivalent to R's `anova()`. With one fit, the table of sequential (type I) sums
 * of squares, equivalent to R's `anova(fit)`: one row per term (the intercept left out), in the order of the model,
 * and `Residuals`. With several fits, the comparison of the models in the order given, equivalent to R's
 * `anova(fit1, fit2, ...)`: columns `Res.Df`, `RSS`, `Df`, `Sum of Sq`, `F`, `Pr(>F)`, the F tests scaled by the
 * residual mean square of the model with the fewest residual degrees of freedom.
 *
 * @param fit A fit from {@link lm} (or {@link aov} without `Error()`) with a formula.
 * @param fits More fits to compare with the first.
 *
 * @example
 * ```ts
 * const data = { y: [4.2, 5.1, 6.3, 5.8, 7.9, 8.4], g: ["a", "a", "b", "b", "c", "c"] };
 * const t = anova(lm("y ~ g", data));
 * t.rowNames; // ["g", "Residuals"]
 * ```
 *
 * @category Linear models and ANOVA
 */
export function anova(fit: LmFormulaResult, ...fits: LmFormulaResult[]): AnovaTable {
  const all = [fit, ...fits];
  for (const f of all) {
    if (typeof f !== "object" || f === null || !Array.isArray((f as Partial<LmFormulaResult>).effects)) {
      throw new TypeError("anova() needs fits from lm() or aov() with a formula");
    }
  }
  if (all.length === 1) return sequentialTable(fit);
  if (all.some((f) => f.rows.length !== fit.rows.length)) throw new Error("models were not all fitted to the same size of dataset");
  const same = all.filter((f) => f.response === fit.response);
  const warnings: string[] = [];
  if (same.length < all.length) {
    const removed = [...new Set(all.filter((f) => f.response !== fit.response).map((f) => f.response))];
    warnings.push(`models with response ${removed.map((r) => `‘${r}’`).join(", ")} removed because response differs from model 1`);
  }
  const tab = same.length === 1 ? sequentialTable(fit) : comparisonTable(same);
  tab.warnings = [...warnings, ...tab.warnings];
  return tab;
}

/**
 * Result of {@link aovSummary} for a fit with error strata.
 *
 * @category Linear models and ANOVA
 */
export interface AovStrataSummary {
  /** The table of each stratum, in order, without the intercept stratum. */
  strata: AovStratum[];
  /** Warnings of the summary (empty; the fit's warnings are in its own `warnings`). */
  warnings: string[];
}

/**
 * The table of an analysis of variance fitted by {@link aov}. Equivalent to R's `summary()`. As R's
 * `summary(aov(formula, data))` for a fit without `Error()`: the rows of {@link anova}'s
 * sequential table, except that without residual degrees of freedom there is no `Residuals` row and no `F value` and
 * `Pr(>F)` columns. For a fit with an `Error()` term, the tables of the strata (`{ strata: [{ stratum: "Error: id",
 * colNames, rowNames, table }, ...] }`), without the intercept stratum.
 *
 * @param fit A fit from {@link aov} (or {@link lm}) with a formula.
 *
 * @example
 * ```ts
 * const fit = aov("y ~ g", { y: [4.2, 5.1, 6.3, 5.8, 7.9, 8.4], g: ["a", "a", "b", "b", "c", "c"] });
 * const t = aovSummary(fit);
 * t.colNames; // ["Df", "Sum Sq", "Mean Sq", "F value", "Pr(>F)"]
 * t.table[0]; // [2, 12.413, 6.2067, 28.427, 0.011221]
 * ```
 *
 * @category Linear models and ANOVA
 */
export function aovSummary(fit: AovStrataFit): AovStrataSummary;
export function aovSummary(fit: LmFormulaResult): AnovaTable;
export function aovSummary(fit: LmFormulaResult | AovStrataFit): AnovaTable | AovStrataSummary;
export function aovSummary(fit: LmFormulaResult | AovStrataFit): AnovaTable | AovStrataSummary {
  if (typeof fit === "object" && fit !== null && (fit as AovStrataFit).multistratum === true) {
    const f = fit as AovStrataFit;
    return { strata: f.strata.filter((s) => s.stratum !== "Error: (Intercept)").map((s) => ({ ...s })), warnings: [] };
  }
  if (typeof fit !== "object" || fit === null || !Array.isArray((fit as Partial<LmFormulaResult>).effects)) {
    throw new TypeError("aovSummary() needs a fit from aov() with a formula");
  }
  const t = sequentialTable(fit as LmFormulaResult);
  if ((fit as LmFormulaResult).dfResidual > 0) return { ...t, warnings: [] };
  return {
    colNames: t.colNames.slice(0, 3),
    rowNames: t.rowNames.slice(0, -1),
    table: t.table.slice(0, -1).map((r) => r.slice(0, 3)),
    warnings: [],
  };
}
