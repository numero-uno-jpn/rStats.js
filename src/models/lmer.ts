// Linear mixed models fitted by REML or maximum likelihood (lme4's lmer): the estimate of θ that minimises the
// profiled REML criterion or ML deviance, and the fit's results at it (fixed effects and their covariance, σ, the
// variance components, the conditional modes of the random effects, fitted values, log-likelihood and information
// criteria).
//
// Written for rStats.js (no ported code) from oracle/lmer-behaviour.md (stage 1c, "The fit and its results") and
// D. Bates, M. Mächler, B. Bolker, S. Walker (2015), "Fitting Linear Mixed-Effects Models Using lme4", Journal of
// Statistical Software 67(1). The structure comes from src/models/mixedStructure.ts and the criterion with its
// analytic gradient from src/models/mixedDeviance.ts. The minimiser is found in two phases:
//   1. L-BFGS-B (src/optim/lbfgsb.ts) from the initial θ, with the analytic gradient and the lower bounds (0 for the
//      diagonal elements of each block T_k), run to tight tolerances;
//   2. an active-set Newton method that locates the minimiser to rounding error: the bounded elements left below
//      1e-4 are candidates for the boundary and held at exactly 0; Newton steps on the other ("free") elements, with
//      the Hessian from central differences of the analytic gradient, until the step is at rounding level; an
//      element that a step would take below 0 joins the boundary. Then each element on the boundary is checked:
//      it stays there if the derivative of the criterion at 0 is positive, or zero (to rounding) with the derivative
//      at a small positive value positive (the criterion is even in a 1 × 1 block's element, so its derivative at 0
//      vanishes); otherwise it is released and the Newton phase repeats.
// lme4's own optimiser (and its convergence warnings) are not reproduced: the result is the exact minimiser, which
// lme4 approaches to its tolerances.

import { lbfgsb } from "../optim/lbfgsb.js";
import { profiledDeviance } from "./mixedDeviance.js";
import type { DataFrame } from "./modelFrame.js";
import type { ContrastName } from "./modelMatrix.js";
import { mixedModelStructure, type MixedModelStructure } from "./mixedStructure.js";

/**
 * Options of {@link lmer}.
 *
 * @category Mixed models
 */
export interface LmerOptions {
  /** Whether to minimise the REML criterion (default `true`) or the ML deviance (`false`). */
  REML?: boolean;
  /** A contrast per factor of the fixed-effects part (default `"contr.treatment"`); the random-effects terms always use treatment contrasts. */
  contrasts?: Record<string, ContrastName>;
  /** The order of the levels of a factor (`{ A: ["c", "a", "b"] }`), as `factor(x, levels = ...)` in R. */
  levels?: Record<string, readonly string[]>;
}

/**
 * The variance and correlation parameters of a random-effects term in a {@link LmerResult}: one entry of R's
 * `VarCorr()`.
 *
 * @category Mixed models
 */
export interface LmerVarCorr {
  /** The grouping factor's name, such as `"Subject"` or `"cask:batch"`. */
  group: string;
  /** The names of the term's columns, such as `["(Intercept)", "Days"]`. */
  columns: string[];
  /** The standard deviations of the random effects, one per column. */
  sd: number[];
  /** Their correlation matrix (array of rows; 1 on the diagonal). */
  corr: number[][];
}

/**
 * The conditional modes of the random effects of a grouping factor in a {@link LmerResult}: one entry of R's
 * `ranef()`.
 *
 * @category Mixed models
 */
export interface LmerRanef {
  /** The grouping factor's name. */
  group: string;
  /** Its levels (the rows of `values`). */
  levels: string[];
  /** The columns of all the terms of this grouping factor, in term order. */
  columns: string[];
  /** One array per level, one value per column. */
  values: number[][];
}

/**
 * Result of {@link lmer}: the fit of a linear mixed model and the quantities of R's methods for it.
 *
 * @category Mixed models
 */
export interface LmerResult {
  /** The formula. */
  formula: string;
  /** Whether the REML criterion was minimised (otherwise the ML deviance). */
  REML: boolean;
  /** Number of rows used. */
  nObs: number;
  /** 0-based indices of the rows of `data` used (rows with a missing value in a variable of the formula dropped). */
  rows: number[];
  /** The estimate of the covariance parameters θ (R's `getME(fit, "theta")`): the lower triangles of the relative covariance factors, by term, column-major. */
  theta: number[];
  /** Names of the columns of the fixed-effects model matrix (aliased columns dropped). */
  fixefNames: string[];
  /** The fixed effects β̂ (R's `fixef()`). */
  fixef: number[];
  /** The coefficient table of the fixed effects (R's `coef(summary(fit))`). */
  coefTable: {
    /** Estimates (R's `Estimate`). */
    estimate: number[];
    /** Standard errors (R's `Std. Error`). */
    stdError: number[];
    /** t statistics (R's `t value`). */
    tValue: number[];
  };
  /** The covariance matrix of the fixed effects (R's `vcov()`), array of rows. */
  vcov: number[][];
  /** The residual standard deviation (R's `sigma()`). */
  sigma: number;
  /** The variance components, one entry per random-effects term (R's `VarCorr()`). */
  varCorr: LmerVarCorr[];
  /** The conditional modes of the random effects, one entry per grouping factor (R's `ranef()`). */
  ranef: LmerRanef[];
  /** Fitted values Xβ̂ + Zb̂, one per row used (R's `fitted()`). */
  fitted: number[];
  /** Residuals y − fitted (R's `residuals()`). */
  residuals: number[];
  /** The log-likelihood, or the REML log-likelihood for a REML fit (R's `logLik()`). */
  logLik: number;
  /** Degrees of freedom of the log-likelihood: the numbers of fixed effects and of θ, plus 1 (for σ). */
  df: number;
  /** Akaike's information criterion (R's `AIC()`). */
  AIC: number;
  /** Schwarz's Bayesian information criterion (R's `BIC()`). */
  BIC: number;
  /** The ML deviance at the estimates, for either kind of fit (R's `deviance(fit, REML = FALSE)`). */
  deviance: number;
  /** The REML criterion at the estimates, for either kind of fit (R's `REMLcrit()`). */
  REMLcrit: number;
  /** Whether the fit is singular: a diagonal element of a relative covariance factor below 1e-4 (R's `isSingular()`). */
  singular: boolean;
  /** R's messages (a rank-deficient fixed-effects matrix, a singular fit). */
  messages: string[];
  /** R's warnings (predictors on very different scales). */
  warnings: string[];
}

/** Bounded elements of θ below this value after the quasi-Newton phase are candidates for the boundary */
const BOUNDARY_CANDIDATE = 1e-4;
/** Relative step (to max(1, |θ_j|)) of the central differences of the gradient that give the Hessian */
const HESSIAN_STEP = 1e-4;
/** The Newton phase stops when a step is below this, relative to max(1, max |θ|) */
const NEWTON_TOLERANCE = 1e-13;
/** ... or when the steps no longer decrease (rounding level) and are below this */
const NEWTON_FLOOR = 1e-10;
const MAX_NEWTON_STEPS = 50;
const MAX_ACTIVE_SET_ROUNDS = 20;

const OPTIMISATION_FAILED = "lmer: the minimisation of the criterion over theta did not converge";

/** Solves the symmetric positive definite system H x = g (k × k, array of rows) by Cholesky; undefined if not PD */
function solveSpd(h: number[][], g: number[]): number[] | undefined {
  const k = g.length;
  const l: number[][] = h.map(() => new Array<number>(k).fill(0));
  for (let j = 0; j < k; j++) {
    let d = h[j]![j]!;
    for (let m = 0; m < j; m++) d -= l[j]![m]! ** 2;
    if (!(d > 0)) return undefined;
    l[j]![j] = Math.sqrt(d);
    for (let i = j + 1; i < k; i++) {
      let s = h[i]![j]!;
      for (let m = 0; m < j; m++) s -= l[i]![m]! * l[j]![m]!;
      l[i]![j] = s / l[j]![j]!;
    }
  }
  const y = new Array<number>(k);
  for (let i = 0; i < k; i++) {
    let s = g[i]!;
    for (let m = 0; m < i; m++) s -= l[i]![m]! * y[m]!;
    y[i] = s / l[i]![i]!;
  }
  for (let i = k - 1; i >= 0; i--) {
    let s = y[i]!;
    for (let m = i + 1; m < k; m++) s -= l[m]![i]! * y[m]!;
    y[i] = s / l[i]![i]!;
  }
  return y;
}

/** The minimiser of the criterion over θ, subject to the lower bounds (see the header) */
function minimiseCriterion(s: MixedModelStructure, reml: boolean): number[] {
  const nTheta = s.theta.length;
  const bounded = s.lower.map((b) => b === 0);
  const evaluate = (theta: readonly number[]): { f: number; g: number[] } => {
    const r = profiledDeviance(s, theta, reml, { gradient: true });
    return { f: r.deviance, g: r.gradient! };
  };
  const gradientAt = (theta: readonly number[]): number[] => evaluate(theta).g;

  // 1. quasi-Newton with bounds
  const qn = lbfgsb(
    nTheta,
    10,
    s.theta,
    new Array<number>(nTheta).fill(0),
    new Array<number>(nTheta).fill(0),
    bounded.map((b) => (b ? 1 : 0)),
    10,
    0,
    (x) => evaluate(x),
    () => false,
  );
  if (qn.task.startsWith("ERROR") || !qn.x.every(Number.isFinite)) throw new Error(OPTIMISATION_FAILED);

  // 2. active-set Newton
  const theta = qn.x.map((v, j) => (bounded[j] && v < 0 ? 0 : v));
  const fixed = new Set<number>();
  theta.forEach((v, j) => {
    if (bounded[j] && v < BOUNDARY_CANDIDATE) {
      fixed.add(j);
      theta[j] = 0;
    }
  });

  /** Newton steps on the free elements; returns the bounded elements that a step took to 0 or below */
  const newton = (free: number[]): number[] => {
    const hessian = (): number[][] => {
      const cols = free.map((j) => {
        const h = HESSIAN_STEP * Math.max(1, Math.abs(theta[j]!));
        const plus = theta.slice();
        plus[j] = theta[j]! + h;
        const minus = theta.slice();
        minus[j] = theta[j]! - h;
        const gp = gradientAt(plus);
        const gm = gradientAt(minus);
        return free.map((i) => (gp[i]! - gm[i]!) / (2 * h));
      });
      return free.map((_, a) => free.map((_, b) => (cols[a]![b]! + cols[b]![a]!) / 2));
    };
    let h = hessian();
    let previous = Infinity;
    for (let step = 0; step < MAX_NEWTON_STEPS; step++) {
      const g = gradientAt(theta);
      const delta = solveSpd(
        h,
        free.map((j) => g[j]!),
      );
      if (delta === undefined) throw new Error(OPTIMISATION_FAILED);
      const hit: number[] = [];
      free.forEach((j, a) => {
        theta[j] = theta[j]! - delta[a]!;
        if (bounded[j] && theta[j]! <= 0) hit.push(j);
      });
      if (hit.length > 0) {
        for (const j of hit) theta[j] = 0;
        return hit;
      }
      const scale = Math.max(1, ...theta.map(Math.abs));
      const size = Math.max(...delta.map(Math.abs)) / scale;
      if (!Number.isFinite(size)) throw new Error(OPTIMISATION_FAILED);
      if (size <= NEWTON_TOLERANCE) return [];
      if (size > 0.5 * previous) {
        if (size <= NEWTON_FLOOR) return [];
        h = hessian(); // slow contraction: the Hessian is renewed
      }
      previous = size;
    }
    throw new Error(OPTIMISATION_FAILED);
  };

  /** Elements held at 0 that must be released (the criterion decreases into the feasible side) */
  const toRelease = (): number[] => {
    const out: number[] = [];
    if (fixed.size === 0) return out;
    const { f, g } = evaluate(theta);
    const tolerance = 1e-12 * Math.max(1, Math.abs(f));
    for (const j of fixed) {
      if (g[j]! > tolerance) continue;
      if (g[j]! >= -tolerance) {
        const probe = theta.slice();
        probe[j] = BOUNDARY_CANDIDATE;
        if (gradientAt(probe)[j]! > 0) continue;
      }
      out.push(j);
    }
    return out;
  };

  for (let round = 0; round < MAX_ACTIVE_SET_ROUNDS; round++) {
    const free = theta.map((_, j) => j).filter((j) => !fixed.has(j));
    if (free.length > 0) {
      const hit = newton(free);
      if (hit.length > 0) {
        for (const j of hit) fixed.add(j);
        continue;
      }
    }
    const release = toRelease();
    if (release.length === 0) return theta;
    for (const j of release) {
      fixed.delete(j);
      theta[j] = BOUNDARY_CANDIDATE;
    }
  }
  throw new Error(OPTIMISATION_FAILED);
}

/**
 * Fit a linear mixed model by REML (default) or maximum likelihood. Equivalent to `lme4::lmer()` in R. With the
 * quantities of its methods: `fixef()`, `coef(summary())` (without p-values), `vcov()`, `sigma()`, `VarCorr()`,
 * `ranef()`, `fitted()`, `residuals()`, `logLik()`, `AIC()`, `BIC()`, `deviance()`, `REMLcrit()` and `isSingular()`.
 *
 * The formula has random-effects terms `(lhs | group)` (correlated effects of the columns of `lhs` within each level
 * of `group`) or `(lhs || group)` (uncorrelated); `group` may be `a:b` (the combinations), `a/b` (nested: `b:a` and
 * `a`) and so on, as in lme4. The fixed-effects part is coded as in {@link lm}; aliased columns are dropped (with a
 * message). Rows with a missing value in a variable of the formula are dropped (`rows` lists those used).
 *
 * The covariance parameters θ are the lower triangles of the relative covariance factors of the terms; the estimate
 * is the exact minimiser of the profiled criterion (lme4's optimiser stops close to it, so lme4's values typically
 * differ in the 5th to 9th significant digit). Elements on the boundary are exactly 0, and the fit is then singular.
 * The computation is dense: the time grows with the cube of the number of random effects.
 *
 * @param formula A formula such as `"Reaction ~ Days + (Days | Subject)"`.
 * @param data The data frame: an object of columns.
 * @param options `REML`, and `contrasts` and `levels` as in {@link lm}.
 *
 * @example
 * ```ts
 * // R: lme4::lmer(y ~ 1 + (1 | g), data)
 * const fit = lmer("y ~ 1 + (1 | g)", {
 *   y: [9.8, 10.4, 10.1, 12.3, 12.9, 12.0, 8.1, 7.6, 8.4],
 *   g: ["a", "a", "a", "b", "b", "b", "c", "c", "c"],
 * });
 * fit.fixef;           // [10.177778]
 * fit.sigma;           // 0.39299
 * fit.varCorr[0].sd;   // [2.1726]
 * fit.ranef[0].levels; // ["a", "b", "c"]
 * fit.ranef[0].values; // [[-0.076939], [2.1982], [-2.1213]]
 * fit.REMLcrit;        // 19.015
 * ```
 *
 * @category Mixed models
 */
export function lmer(formula: string, data: DataFrame, options: LmerOptions = {}): LmerResult {
  const reml = options.REML ?? true;
  const modelOptions: { contrasts?: Record<string, ContrastName>; levels?: Record<string, readonly string[]> } = {};
  if (options.contrasts !== undefined) modelOptions.contrasts = options.contrasts;
  if (options.levels !== undefined) modelOptions.levels = options.levels;
  const s = mixedModelStructure(formula, data, modelOptions);
  const theta = minimiseCriterion(s, reml);

  const r = profiledDeviance(s, theta, reml, { rxInverse: true });
  const n = s.y.length;
  const p = s.xColNames.length;
  const twoPi = 2 * Math.PI;
  const deviance = r.logDetL + n * (1 + Math.log((twoPi * r.prss) / n));
  const REMLcrit = r.logDetL + r.logDetRX + (n - p) * (1 + Math.log((twoPi * r.prss) / (n - p)));
  const sigma2 = r.prss / (reml ? n - p : n);
  const sigma = Math.sqrt(sigma2);

  const vcov = r.rxInverse!.map((row) => row.map((v) => sigma2 * v));
  const stdError = vcov.map((row, i) => Math.sqrt(row[i]!));
  const tValue = r.beta.map((b, i) => b / stdError[i]!);

  // the blocks T_k and the variance components
  const varCorr: LmerVarCorr[] = s.terms.map((term) => {
    const nc = term.columns.length;
    const t: number[][] = Array.from({ length: nc }, () => new Array<number>(nc).fill(0));
    let k = term.thetaOffset;
    for (let j = 0; j < nc; j++) for (let i = j; i < nc; i++) t[i]![j] = theta[k++]!;
    const cov = t.map((ti) => t.map((tj) => sigma2 * ti.reduce((sum, v, m) => sum + v * tj[m]!, 0)));
    const sd = cov.map((row, i) => Math.sqrt(row[i]!));
    const corr = cov.map((row, i) => row.map((v, j) => (i === j ? 1 : v / (sd[i]! * sd[j]!))));
    return { group: s.groups[term.group]!.name, columns: [...term.columns], sd, corr };
  });

  const ranef: LmerRanef[] = s.groups.map((g, gi) => {
    const terms = s.terms.filter((t) => t.group === gi);
    return {
      group: g.name,
      levels: [...g.levels],
      columns: terms.flatMap((t) => t.columns),
      values: g.levels.map((_, l) =>
        terms.flatMap((t) => {
          const nc = t.columns.length;
          return t.columns.map((_, j) => r.b[t.zOffset + l * nc + j]!);
        }),
      ),
    };
  });

  const fitted = s.x.map((xi) => xi.reduce((sum, v, k) => sum + v * r.beta[k]!, 0));
  s.z.forEach((col, j) => {
    const bj = r.b[j]!;
    if (bj !== 0) col.rows.forEach((i, k) => (fitted[i]! += col.values[k]! * bj));
  });
  const residuals = s.y.map((y, i) => y - fitted[i]!);

  const logLik = -(reml ? REMLcrit : deviance) / 2;
  const df = p + theta.length + 1;
  const singular = theta.some((v, j) => s.lower[j] === 0 && v < 1e-4);
  const messages = [...s.messages];
  if (singular) messages.push("boundary (singular) fit: see help('isSingular')");

  return {
    formula,
    REML: reml,
    nObs: n,
    rows: [...s.rows],
    theta,
    fixefNames: [...s.xColNames],
    fixef: r.beta,
    coefTable: { estimate: [...r.beta], stdError, tValue },
    vcov,
    sigma,
    varCorr,
    ranef,
    fitted,
    residuals,
    logLik,
    df,
    AIC: -2 * logLik + 2 * df,
    BIC: -2 * logLik + Math.log(n) * df,
    deviance,
    REMLcrit,
    singular,
    messages,
    warnings: [...s.warnings],
  };
}
