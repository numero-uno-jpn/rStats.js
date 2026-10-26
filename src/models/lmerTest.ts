// lmerTest's tests for the fixed effects of a linear mixed model fitted by lmer (src/models/lmer.ts): t- and F-tests
// of contrasts with Satterthwaite's approximation of the denominator degrees of freedom, the coefficient table of
// lmerTest's summary, and lmerTest's contest.
//
// Written for rStats.js (no ported code) from oracle/lmertest-behaviour.md (section 1, "The Satterthwaite machinery")
// and A. Kuznetsova, P. B. Brockhoff, R. H. B. Christensen (2017), "lmerTest Package: Tests in Linear Mixed Effects
// Models", Journal of Statistical Software 82(13). The derivatives (the Hessian of the deviance in the variance
// parameters and the Jacobians of the covariance of the fixed effects) are computed analytically at the exact optimum
// by src/models/mixedDerivatives.ts; lmerTest differentiates numerically at lme4's approximate optimum, so its numbers
// typically differ from these in the 4th to 8th significant digit.
//
// The Satterthwaite quantities of a fit are computed once and kept with the fit (a WeakMap keyed by the result), so
// that the summary, the contrasts and the ANOVA tables of the same fit share them (and the Hessian's warnings are the
// same in every result).

import { pf1 } from "../distributions/f.js";
import { pt1, qt1 } from "../distributions/t.js";
import { eigen } from "../linalg/eigen.js";
import { ginv } from "../linalg/kappa.js";
import { Warnings } from "./glmFamily.js";
import { lmerInternals, type LmerResult } from "./lmer.js";
import { varparDerivatives } from "./mixedDerivatives.js";
import type { MixedModelStructure } from "./mixedStructure.js";

/** Eigenvalues of the Hessian within this of 0 (or below) are left out of its inverse and warned about */
const HESSIAN_TOLERANCE = 1e-8;
/** Eigenvalues of L V L' at most this times the largest are left out of a joint test */
const RANK_TOLERANCE = Math.sqrt(Number.EPSILON);
/** Satterthwaite's degrees of freedom of a joint test are averaged when they differ by less than this */
const EQUAL_DF_TOLERANCE = 1e-8;

/**
 * The Satterthwaite quantities of a fit (internal): the variance parameters varpar = (θ, σ), the Hessian H of the
 * deviance in them with its eigenvalues, their asymptotic covariance A = 2 H⁺ (lmerTest's `vcov_varpar`), the fixed
 * effects β̂ with their covariance V = C(varpar) and its Jacobians J_k = ∂C/∂varpar_k, and the warnings of the Hessian.
 */
export interface LmerSatterthwaite {
  varpar: number[];
  hessian: number[][];
  hessianEigenvalues: number[];
  vcovVarpar: number[][];
  beta: number[];
  sigma: number;
  vcov: number[][];
  jacobian: number[][][];
  warnings: string[];
}

const satterthwaiteByFit = new WeakMap<LmerResult, LmerSatterthwaite>();

/** A number as C's printf("%1.1e") writes it: "-3.2e-04" */
function formatE1(v: number): string {
  if (!Number.isFinite(v)) return Number.isNaN(v) ? "nan" : v > 0 ? "inf" : "-inf";
  const [mantissa, exponent] = v.toExponential(1).split("e") as [string, string];
  const e = Number(exponent);
  return `${mantissa}e${e < 0 ? "-" : "+"}${String(Math.abs(e)).padStart(2, "0")}`;
}

/** The warnings about the Hessian's eigenvalues (negative, or close to 0; internal) */
export function hessianWarnings(values: readonly number[]): string[] {
  const out: string[] = [];
  const negative = values.filter((v) => v < -HESSIAN_TOLERANCE);
  const zero = values.filter((v) => Math.abs(v) < HESSIAN_TOLERANCE);
  const plural = (k: number): string => (k === 1 ? "eigenvalue" : "eigenvalues");
  if (negative.length > 0) {
    out.push(`Model failed to converge with ${negative.length} negative ${plural(negative.length)}: ${negative.map(formatE1).join(" ")}`);
  }
  if (zero.length > 0) {
    out.push(`Model may not have converged with ${zero.length} ${plural(zero.length)} close to zero: ${zero.map(formatE1).join(" ")}`);
  }
  return out;
}

/**
 * The Satterthwaite quantities of a fit by {@link lmer} (see {@link LmerSatterthwaite}), computed once per fit.
 * Internal: the summary, the contrasts and the ANOVA tables use it.
 */
export function lmerSatterthwaite(fit: LmerResult): LmerSatterthwaite {
  const cached = satterthwaiteByFit.get(fit);
  if (cached !== undefined) return cached;
  const internals = lmerInternals(fit);
  const result = satterthwaiteAt(internals.structure, internals.theta, internals.reml);
  satterthwaiteByFit.set(fit, result);
  return result;
}

/**
 * The Satterthwaite quantities at any θ (σ from the penalised residual sum of squares there). Internal: the test
 * evaluates them at lme4's optimum too, to compare with lmerTest's numerical derivatives at the same point.
 */
export function satterthwaiteAt(structure: MixedModelStructure, theta: readonly number[], reml: boolean): LmerSatterthwaite {
  const d = varparDerivatives(structure, theta, reml);
  const m = d.varpar.length;
  const e = eigen(d.hessian, { symmetric: true });
  const values = e.values;
  const vectors = e.vectors!;
  const vcovVarpar = Array.from({ length: m }, () => new Array<number>(m).fill(0));
  values.forEach((lambda, k) => {
    if (!(lambda > HESSIAN_TOLERANCE)) return;
    for (let i = 0; i < m; i++) {
      const vi = (2 * vectors[i]![k]!) / lambda;
      for (let j = 0; j < m; j++) vcovVarpar[i]![j]! += vi * vectors[j]![k]!;
    }
  });
  return {
    varpar: d.varpar,
    hessian: d.hessian,
    hessianEigenvalues: values,
    vcovVarpar,
    beta: d.beta,
    sigma: d.varpar[m - 1]!,
    vcov: d.vcov,
    jacobian: d.jacobian,
    warnings: hessianWarnings(values),
  };
}

const quadraticForm = (l: readonly number[], m: readonly (readonly number[])[]): number => {
  let s = 0;
  for (let i = 0; i < l.length; i++) {
    const li = l[i]!;
    if (li === 0) continue;
    const row = m[i]!;
    for (let j = 0; j < l.length; j++) s += li * row[j]! * l[j]!;
  }
  return s;
};
const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((s, v, i) => s + v * b[i]!, 0);

/** The one-dimensional test of a contrast l (internal) */
export interface TRow {
  estimate: number;
  stdError: number;
  df: number;
  tValue: number;
  pValue: number;
}

/** l'β̂ − rhs over its standard error, with Satterthwaite's degrees of freedom 2 var² / (g'Ag), g_k = l'J_k l */
export function tTestOf(s: LmerSatterthwaite, l: readonly number[], rhs: number, beta: readonly number[] = s.beta): TRow {
  if (l.some(Number.isNaN) || Number.isNaN(rhs)) return { estimate: NaN, stdError: NaN, df: NaN, tValue: NaN, pValue: NaN };
  const estimate = dot(l, beta);
  const variance = quadraticForm(l, s.vcov);
  const stdError = Math.sqrt(variance);
  const g = s.jacobian.map((j) => quadraticForm(l, j));
  const df = (2 * variance * variance) / quadraticForm(g, s.vcovVarpar);
  const tValue = (estimate - rhs) / stdError;
  const pValue = 2 * pt1(Math.abs(tValue), df, false, false);
  return { estimate, stdError, df, tValue, pValue };
}

/** One row of an F table (internal): lmerTest's `Sum Sq`, `Mean Sq`, `NumDF`, `DenDF`, `F value`, `Pr(>F)` */
export interface LmerFRow {
  sumSq: number;
  meanSq: number;
  numDF: number;
  denDF: number;
  F: number;
  pValue: number;
}

function fRowOf(s: LmerSatterthwaite, f: number, numDF: number, denDF: number): LmerFRow {
  const s2 = s.sigma * s.sigma;
  return { sumSq: f * s2 * numDF, meanSq: f * s2, numDF, denDF, F: f, pValue: pf1(f, numDF, denDF, false, false) };
}

/** The denominator degrees of freedom of a joint test from those of its rotated contrasts */
function jointDenDF(nu: readonly number[]): number {
  if (nu.length === 1) return nu[0]!;
  if (nu.every((v, i) => i === 0 || Math.abs(v - nu[i - 1]!) < EQUAL_DF_TOLERANCE)) return nu.reduce((a, b) => a + b, 0) / nu.length;
  if (nu.some((v) => v <= 2)) return 2;
  const e = nu.reduce((sum, v) => sum + v / (v - 2), 0);
  return (2 * e) / (e - nu.length);
}

/**
 * The joint F-test of the rows of L (r × p) with Satterthwaite's denominator degrees of freedom (internal; the ANOVA
 * tables use it): undefined when the rows have rank 0 (no test). `rhs` has one value per row (default 0); a non-zero
 * right-hand side with a rank-deficient L adds the warning to `warnings`.
 */
export function lmerFTest(fit: LmerResult, L: readonly (readonly number[])[], rhs: readonly number[] | undefined, warnings: Warnings): LmerFRow | undefined {
  return fTestOf(lmerSatterthwaite(fit), L, rhs, warnings);
}

/** {@link lmerFTest} with the Satterthwaite quantities given (internal) */
export function fTestOf(s: LmerSatterthwaite, L: readonly (readonly number[])[], rhs: readonly number[] | undefined, warnings: Warnings): LmerFRow | undefined {
  const r = L.length;
  if (r === 0) return undefined;
  const right = rhs ?? new Array<number>(r).fill(0);
  if (r === 1) {
    const t = tTestOf(s, L[0]!, right[0]!);
    return fRowOf(s, t.tValue * t.tValue, 1, t.df);
  }
  if (L.some((row) => row.some(Number.isNaN)) || right.some(Number.isNaN)) return fRowOf(s, NaN, NaN, NaN);
  // L V L' and its eigendecomposition
  const lv = L.map((row) => s.vcov.map((_, j) => row.reduce((sum, v, k) => sum + v * s.vcov[k]![j]!, 0)));
  const e = eigen(
    lv.map((a) => L.map((rj) => dot(a, rj))),
    { symmetric: true },
  );
  const d = e.values;
  const cut = Math.max(RANK_TOLERANCE * d[0]!, 0);
  let kept = 0;
  while (kept < r && d[kept]! > cut) kept++;
  if (kept === 0) return undefined;
  if (kept < r && right.some((v) => v !== 0)) warnings.add("Contrast is rank deficient and test may be affected");
  // β̂ − b0 with b0 = ginv(L) rhs, the minimum-norm solution of L b0 = rhs
  let beta = s.beta;
  if (right.some((v) => v !== 0)) {
    const g = ginv(L.map((row) => [...row]));
    beta = s.beta.map((b, i) => b - dot(g[i]!, right));
  }
  const p = s.beta.length;
  const rotated = Array.from({ length: kept }, (_, k) =>
    Array.from({ length: p }, (_, j) => L.reduce((sum, row, i) => sum + e.vectors![i]![k]! * row[j]!, 0)),
  );
  if (kept === 1) {
    const t = tTestOf(s, rotated[0]!, 0, beta);
    return fRowOf(s, t.tValue * t.tValue, 1, t.df);
  }
  let f = 0;
  const nu: number[] = [];
  rotated.forEach((row, i) => {
    f += dot(row, beta) ** 2 / d[i]!;
    const g = s.jacobian.map((j) => quadraticForm(row, j));
    nu.push((2 * d[i]! * d[i]!) / quadraticForm(g, s.vcovVarpar));
  });
  return fRowOf(s, f / kept, kept, jointDenDF(nu));
}

/**
 * Options of {@link lmerSummary}.
 *
 * @category Mixed models
 */
export interface LmerSummaryOptions {
  /**
   * The denominator degrees of freedom: `"Satterthwaite"` (default; with df and p-values) or `"lme4"` (lme4's table:
   * estimates, standard errors and t values only).
   */
  ddf?: "Satterthwaite" | "lme4";
}

/**
 * Result of {@link lmerSummary}: the coefficient table of lmerTest's `summary()`.
 *
 * @category Mixed models
 */
export interface LmerSummary {
  /** The method of the degrees of freedom. */
  ddf: "Satterthwaite" | "lme4";
  /** The names of the fixed effects (R's row names). */
  names: string[];
  /** Estimates (R's `Estimate`). */
  estimate: number[];
  /** Standard errors (R's `Std. Error`). */
  stdError: number[];
  /** Satterthwaite's degrees of freedom (R's `df`; not with `ddf: "lme4"`). */
  df?: number[];
  /** t statistics (R's `t value`). */
  tValue: number[];
  /** Two-sided p-values (R's `Pr(>|t|)`; not with `ddf: "lme4"`). */
  pValue?: number[];
  /** R's messages (none so far). */
  messages: string[];
  /** R's warnings: those about the eigenvalues of the Hessian of the deviance in the variance parameters. */
  warnings: string[];
}

/**
 * The coefficient table of a linear mixed model fitted by {@link lmer}, with Satterthwaite's degrees of freedom and
 * the p-values of the t-tests: the `summary()` of a fit by lmerTest. Equivalent to `lmerTest::summary()` in R.
 *
 * The degrees of freedom of each coefficient are Satterthwaite's: 2 var² / (g'Ag), with var its variance, g its
 * derivative in the variance parameters (θ, σ) and A their asymptotic covariance (twice the inverse Hessian of the
 * deviance). The derivatives are computed analytically at the exact optimum (lmerTest differentiates numerically at
 * lme4's optimum, so its degrees of freedom typically differ in the 5th to 8th significant digit). With
 * `ddf: "lme4"` the table is lme4's (as `coefTable` of the fit), without degrees of freedom and p-values.
 *
 * @param fit A result of {@link lmer} (the object it returned, not a copy).
 * @param options `ddf`: `"Satterthwaite"` (default) or `"lme4"`.
 *
 * @example
 * ```ts
 * // R: summary(lmerTest::lmer(y ~ x + (1 | g), data))
 * const fit = lmer("y ~ x + (1 | g)", {
 *   y: [3.1, 4.0, 5.2, 6.8, 7.1, 8.3, 2.2, 3.5, 3.9, 5.9, 6.1, 7.4],
 *   x: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3],
 *   g: ["a", "a", "a", "b", "b", "b", "c", "c", "c", "d", "d", "d"],
 * });
 * const s = lmerSummary(fit);
 * s.names;  // ["(Intercept)", "x"]
 * s.df;     // [3.2717, 7]
 * s.pValue; // [0.032598, 7.9895e-5]
 * ```
 *
 * @category Mixed models
 */
export function lmerSummary(fit: LmerResult, options: LmerSummaryOptions = {}): LmerSummary {
  const ddf = options.ddf ?? "Satterthwaite";
  if (ddf !== "Satterthwaite" && ddf !== "lme4") throw new RangeError(`ddf must be "Satterthwaite" or "lme4", not ${JSON.stringify(ddf)}`);
  const internals = lmerInternals(fit);
  const names = [...internals.structure.xColNames];
  if (ddf === "lme4") {
    const { estimate, stdError, tValue } = fit.coefTable;
    return { ddf, names, estimate: [...estimate], stdError: [...stdError], tValue: [...tValue], messages: [], warnings: [] };
  }
  const s = lmerSatterthwaite(fit);
  const p = names.length;
  const rows = names.map((_, i) => tTestOf(s, Array.from({ length: p }, (_, j) => (j === i ? 1 : 0)), 0));
  return {
    ddf,
    names,
    estimate: rows.map((r) => r.estimate),
    stdError: rows.map((r) => r.stdError),
    df: rows.map((r) => r.df),
    tValue: rows.map((r) => r.tValue),
    pValue: rows.map((r) => r.pValue),
    messages: [],
    warnings: [...s.warnings],
  };
}

/**
 * Options of {@link lmerContest}.
 *
 * @category Mixed models
 */
export interface LmerContestOptions {
  /** The right-hand side of the hypothesis L β = rhs: one value, or one per row of L (default 0). */
  rhs?: number | readonly number[];
  /** Test the rows jointly with one F-test (default `true`), or each row with its own t-test (`false`). */
  joint?: boolean;
  /** With `joint: false`, whether to add the confidence intervals (default `true`). */
  confint?: boolean;
  /** The confidence level of the intervals (default 0.95). */
  level?: number;
}

/**
 * Result of {@link lmerContest} with `joint: true` (the default): one row of an F table, or none when the rows of L
 * have rank 0.
 *
 * @category Mixed models
 */
export interface LmerContestF {
  /** Whether the rows were tested jointly: always `true` here. */
  joint: true;
  /** R's `Sum Sq`: F σ² NumDF. */
  sumSq: number[];
  /** R's `Mean Sq`: F σ². */
  meanSq: number[];
  /** R's `NumDF`: the rank of the hypothesis. */
  numDF: number[];
  /** R's `DenDF`: Satterthwaite's denominator degrees of freedom. */
  denDF: number[];
  /** R's `F value`. */
  F: number[];
  /** R's `Pr(>F)`. */
  pValue: number[];
  /** R's messages (none so far). */
  messages: string[];
  /** R's warnings (about the Hessian's eigenvalues; `Contrast is rank deficient and test may be affected`). */
  warnings: string[];
}

/**
 * Result of {@link lmerContest} with `joint: false`: one t-test per row of L.
 *
 * @category Mixed models
 */
export interface LmerContestT {
  /** Whether the rows were tested jointly: always `false` here. */
  joint: false;
  /** R's `Estimate`: l'β̂. */
  estimate: number[];
  /** R's `Std. Error`. */
  stdError: number[];
  /** R's `df`: Satterthwaite's degrees of freedom. */
  df: number[];
  /** R's `t value`: (estimate − rhs) / stdError. */
  tValue: number[];
  /** R's `Pr(>|t|)`. */
  pValue: number[];
  /** R's `lower`: the lower limit of the confidence interval of the estimate (unless `confint: false`). */
  lower?: number[];
  /** R's `upper`: the upper limit of the confidence interval (unless `confint: false`). */
  upper?: number[];
  /** R's messages (none so far). */
  messages: string[];
  /** R's warnings (about the Hessian's eigenvalues). */
  warnings: string[];
}

/** The rows of a contrast argument: a vector is one row; each row must have one value per fixed effect */
function contrastRows(L: readonly number[] | readonly (readonly number[])[], p: number): number[][] {
  if (!Array.isArray(L)) throw new TypeError("L must be an array of numbers or an array of rows");
  const rows = L.length > 0 && Array.isArray(L[0]) ? (L as readonly (readonly number[])[]).map((r) => [...r]) : [[...(L as readonly number[])]];
  for (const row of rows) {
    if (!Array.isArray(row) || row.some((v) => typeof v !== "number")) throw new TypeError("L must be an array of numbers or an array of rows");
    if (row.length !== p) throw new TypeError(`each contrast must have ${p} values (one per fixed effect), not ${row.length}`);
  }
  return rows;
}

/**
 * Tests of contrasts L β = rhs of the fixed effects of a linear mixed model fitted by {@link lmer}, with Satterthwaite's
 * degrees of freedom. Equivalent to `lmerTest::contest()` in R.
 *
 * `L` is one contrast (a vector, one value per fixed effect) or several (an array of rows). By default the rows are
 * tested jointly: an F-test of the hypothesis, rotated to its eigenvectors (rows that are linearly dependent count
 * once; a row set of rank 0 gives an empty table). With `joint: false` each row has its own t-test, with a confidence
 * interval at `level` unless `confint` is false. The degrees of freedom come from the analytic derivatives at the exact
 * optimum (see {@link lmerSummary}).
 *
 * @param fit A result of {@link lmer} (the object it returned, not a copy).
 * @param L A contrast, or an array of contrasts (rows).
 * @param options `rhs`, `joint`, `confint`, `level`.
 *
 * @example
 * ```ts
 * // R: contest(lmerTest::lmer(y ~ x + (1 | g), data), c(0, 1), joint = FALSE)
 * const fit = lmer("y ~ x + (1 | g)", {
 *   y: [3.1, 4.0, 5.2, 6.8, 7.1, 8.3, 2.2, 3.5, 3.9, 5.9, 6.1, 7.4],
 *   x: [1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3],
 *   g: ["a", "a", "a", "b", "b", "b", "c", "c", "c", "d", "d", "d"],
 * });
 * const t = lmerContest(fit, [0, 1], { joint: false });
 * t.estimate; // [0.85]
 * t.lower;    // [0.60388]
 * // R: contest(fit, diag(2))
 * const f = lmerContest(fit, [[1, 0], [0, 1]]);
 * f.numDF; // [2]
 * f.F;     // [47.804]
 * ```
 *
 * @category Mixed models
 */
export function lmerContest(fit: LmerResult, L: readonly number[] | readonly (readonly number[])[], options?: LmerContestOptions & { joint?: true }): LmerContestF;
export function lmerContest(fit: LmerResult, L: readonly number[] | readonly (readonly number[])[], options: LmerContestOptions & { joint: false }): LmerContestT;
export function lmerContest(fit: LmerResult, L: readonly number[] | readonly (readonly number[])[], options?: LmerContestOptions): LmerContestF | LmerContestT;
export function lmerContest(fit: LmerResult, L: readonly number[] | readonly (readonly number[])[], options: LmerContestOptions = {}): LmerContestF | LmerContestT {
  const internals = lmerInternals(fit);
  const p = internals.structure.xColNames.length;
  const rows = contrastRows(L, p);
  const joint = options.joint ?? true;
  const confint = options.confint ?? true;
  const level = options.level ?? 0.95;
  if (typeof level !== "number" || !(level >= 0 && level <= 1)) throw new RangeError("level must be a number between 0 and 1");
  const rhsOption = options.rhs ?? 0;
  const rhs = typeof rhsOption === "number" ? new Array<number>(rows.length).fill(rhsOption) : [...rhsOption];
  if (rhs.length !== rows.length || rhs.some((v) => typeof v !== "number")) {
    throw new TypeError(`rhs must be a number or have one value per contrast (${rows.length})`);
  }
  const warnings = new Warnings();
  const s = lmerSatterthwaite(fit);
  s.warnings.forEach((w) => warnings.add(w));
  if (joint) {
    const row = p === 0 ? undefined : lmerFTest(fit, rows, rhs, warnings);
    const pick = (k: keyof LmerFRow): number[] => (row === undefined ? [] : [row[k]]);
    return {
      joint: true,
      sumSq: pick("sumSq"),
      meanSq: pick("meanSq"),
      numDF: pick("numDF"),
      denDF: pick("denDF"),
      F: pick("F"),
      pValue: pick("pValue"),
      messages: [],
      warnings: warnings.list,
    };
  }
  const tests = p === 0 ? [] : rows.map((row, i) => tTestOf(s, row, rhs[i]!));
  const out: LmerContestT = {
    joint: false,
    estimate: tests.map((t) => t.estimate),
    stdError: tests.map((t) => t.stdError),
    df: tests.map((t) => t.df),
    tValue: tests.map((t) => t.tValue),
    pValue: tests.map((t) => t.pValue),
    messages: [],
    warnings: warnings.list,
  };
  if (confint) {
    const quantiles = tests.map((t) => qt1((1 - level) / 2, t.df, false, false));
    out.lower = tests.map((t, i) => t.estimate - t.stdError * quantiles[i]!);
    out.upper = tests.map((t, i) => t.estimate + t.stdError * quantiles[i]!);
  }
  return out;
}
